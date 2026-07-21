import {
  Annotation,
  MessagesAnnotation,
  StateGraph,
  START,
  END,
} from '@langchain/langgraph';
import { SystemMessage, ToolMessage } from '@langchain/core/messages';
import { ChatGroq } from '@langchain/groq';
import { RetrievalService } from '../rag/retrieval.service';

export interface Citation {
  index: number; // [1], [2] ... — what the answer refers to
  filename: string;
  documentId: string;
  chunkId: string;
  chunkIndex: number;
  score: number;
  snippet: string;
}

/**
 * ──────────────────────────────────────────────────────────────────────────
 * The agent's LangGraph graph (multi-step RAG + tool-calling).
 *
 * Nodes and edges:
 *
 *   START → retrieve → agent ──(any tool_calls?)──► tools → agent → ...
 *                          └──(no)──► END
 *
 *   • retrieve — initial vector search over the agent's knowledge base; puts
 *     the retrieved context and citations into the state.
 *   • agent    — calls the LLM (Groq) with the tool bound. The model either
 *     returns a final answer or asks to call the tool.
 *   • tools    — runs the requested tool (another search over the base) and
 *     returns the result to the agent. Citations accumulate along the way.
 *
 * This is the classic ReAct loop: the model decides for itself whether it has
 * enough context or needs to hit the knowledge base again. The loop depth is
 * capped by iterations so it cannot run forever.
 * ──────────────────────────────────────────────────────────────────────────
 */

// Graph state. MessagesAnnotation.spec provides the messages channel with the
// right reducer (accumulating the message history).
const AgentState = Annotation.Root({
  ...MessagesAnnotation.spec,
  agentId: Annotation<string>(),
  question: Annotation<string>(),
  // Context from the knowledge base (as a string) — mixed into the system prompt.
  context: Annotation<string>({
    reducer: (_a, b) => b,
    default: () => '',
  }),
  // Citations accumulate (concat) over the whole run.
  citations: Annotation<Citation[]>({
    reducer: (a, b) => a.concat(b),
    default: () => [],
  }),
  // Tool-loop iteration counter — a safeguard against infinite looping.
  iterations: Annotation<number>({
    reducer: (_a, b) => b,
    default: () => 0,
  }),
});

const MAX_ITERATIONS = 4;
const TOP_K = 4;

// Tool definition in the OpenAI/Groq function-calling format.
const SEARCH_TOOL = {
  type: 'function' as const,
  function: {
    name: 'search_knowledge_base',
    description:
      "Search for additional chunks in the agent's knowledge base. Use it " +
      'when the provided context is not enough for an accurate answer.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'A natural-language search query',
        },
      },
      required: ['query'],
    },
  },
};

function toCitations(
  found: Awaited<ReturnType<RetrievalService['search']>>,
  offset: number,
): Citation[] {
  return found.map((c, i) => ({
    index: offset + i + 1,
    filename: c.filename,
    documentId: c.documentId,
    chunkId: c.id,
    chunkIndex: c.chunkIndex,
    score: c.score,
    snippet: c.content.slice(0, 280),
  }));
}

function renderContext(citations: Citation[]): string {
  if (citations.length === 0)
    return 'The knowledge base is empty or nothing was found.';
  return citations
    .map((c) => `[${c.index}] (source: ${c.filename})\n${c.snippet}`)
    .join('\n\n');
}

/**
 * Builds the compiled graph. Dependencies are passed explicitly (DI-friendly).
 *
 * apiKey comes from OUTSIDE (the request header or an env fallback) — the graph
 * only uses it to call Groq and never stores it. See chat.service.ts.
 */
export function buildAgentGraph(
  retrieval: RetrievalService,
  systemPrompt: string,
  apiKey: string,
) {
  const model = new ChatGroq({
    apiKey,
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    temperature: 0.3,
  });
  // Bind the tool — the model can now call it.
  const modelWithTools = model.bindTools([SEARCH_TOOL as any]);

  // Node: initial search over the knowledge base.
  async function retrieve(state: typeof AgentState.State) {
    const found = await retrieval.search(state.agentId, state.question, TOP_K);
    const citations = toCitations(found, 0);
    return {
      context: renderContext(citations),
      citations,
    };
  }

  // Node: LLM call. The context is injected as a system message right
  // after the main system prompt — that keeps the message order valid.
  async function agent(state: typeof AgentState.State) {
    const msgs: any[] = [...state.messages];
    if (state.context) {
      msgs.splice(
        1,
        0,
        new SystemMessage(
          `Context from the knowledge base (cite sources by number [1], [2], ...):\n\n${state.context}`,
        ),
      );
    }
    const res = await modelWithTools.invoke(msgs);
    return { messages: [res], iterations: state.iterations + 1 };
  }

  // Node: execution of the tools requested by the model.
  async function tools(state: typeof AgentState.State) {
    const last: any = state.messages[state.messages.length - 1];
    const toolMessages: ToolMessage[] = [];
    let newCitations: Citation[] = [];

    for (const call of last.tool_calls || []) {
      if (call.name === 'search_knowledge_base') {
        const query = call.args?.query || state.question;
        const found = await retrieval.search(state.agentId, query, TOP_K);
        const offset = state.citations.length + newCitations.length;
        const cites = toCitations(found, offset);
        newCitations = newCitations.concat(cites);
        const text =
          cites.length > 0
            ? cites
                .map((c) => `[${c.index}] (${c.filename})\n${c.snippet}`)
                .join('\n\n')
            : 'Nothing was found for this query.';
        toolMessages.push(
          new ToolMessage({
            content: text,
            tool_call_id: call.id,
            name: call.name,
          }),
        );
      } else {
        toolMessages.push(
          new ToolMessage({
            content: 'Unknown tool.',
            tool_call_id: call.id,
            name: call.name || 'unknown',
          }),
        );
      }
    }

    return { messages: toolMessages, citations: newCitations };
  }

  // Conditional edge after the agent node: go to tools or finish.
  function shouldContinue(state: typeof AgentState.State): 'tools' | typeof END {
    const last: any = state.messages[state.messages.length - 1];
    const hasToolCalls =
      last && Array.isArray(last.tool_calls) && last.tool_calls.length > 0;
    if (hasToolCalls && state.iterations < MAX_ITERATIONS) {
      return 'tools';
    }
    return END;
  }

  const graph = new StateGraph(AgentState)
    .addNode('retrieve', retrieve)
    .addNode('agent', agent)
    .addNode('tools', tools)
    .addEdge(START, 'retrieve')
    .addEdge('retrieve', 'agent')
    .addConditionalEdges('agent', shouldContinue, {
      tools: 'tools',
      [END]: END,
    })
    .addEdge('tools', 'agent')
    .compile();

  return graph;
}

export { AgentState };
