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
  index: number; // [1], [2] ... — на это ссылается ответ
  filename: string;
  documentId: string;
  chunkId: string;
  chunkIndex: number;
  score: number;
  snippet: string;
}

/**
 * ──────────────────────────────────────────────────────────────────────────
 * LangGraph-граф агента (мульти-шаговый RAG + tool-calling).
 *
 * Узлы и рёбра:
 *
 *   START → retrieve → agent ──(есть tool_calls?)──► tools → agent → ...
 *                          └──(нет)──► END
 *
 *   • retrieve — первичный векторный поиск по базе знаний агента; кладёт
 *     найденный контекст и цитаты в состояние.
 *   • agent    — вызывает LLM (Groq) с привязанным инструментом. Модель либо
 *     отвечает финальным текстом, либо просит вызвать инструмент.
 *   • tools    — выполняет запрошенный инструмент (доп. поиск по базе) и
 *     возвращает результат обратно агенту. Цитаты докапливаются.
 *
 * Это классический ReAct-цикл: модель сама решает, хватает ли ей контекста,
 * или нужно сходить в базу знаний ещё раз. Глубина цикла ограничена
 * iterations, чтобы не уйти в бесконечность.
 * ──────────────────────────────────────────────────────────────────────────
 */

// Состояние графа. MessagesAnnotation.spec даёт канал messages с правильным
// reducer'ом (накопление истории сообщений).
const AgentState = Annotation.Root({
  ...MessagesAnnotation.spec,
  agentId: Annotation<string>(),
  question: Annotation<string>(),
  // Контекст из базы знаний (строкой) — подмешивается в системный промпт.
  context: Annotation<string>({
    reducer: (_a, b) => b,
    default: () => '',
  }),
  // Цитаты копятся (concat) на протяжении всего прогона.
  citations: Annotation<Citation[]>({
    reducer: (a, b) => a.concat(b),
    default: () => [],
  }),
  // Счётчик итераций tool-цикла — предохранитель от зацикливания.
  iterations: Annotation<number>({
    reducer: (_a, b) => b,
    default: () => 0,
  }),
});

const MAX_ITERATIONS = 4;
const TOP_K = 4;

// Описание инструмента в формате OpenAI/Groq function-calling.
const SEARCH_TOOL = {
  type: 'function' as const,
  function: {
    name: 'search_knowledge_base',
    description:
      'Поиск дополнительных фрагментов в базе знаний агента. Используй, ' +
      'если предоставленного контекста не хватает для точного ответа.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Поисковый запрос на естественном языке',
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
  if (citations.length === 0) return 'База знаний пуста или ничего не найдено.';
  return citations
    .map((c) => `[${c.index}] (источник: ${c.filename})\n${c.snippet}`)
    .join('\n\n');
}

/**
 * Собирает скомпилированный граф. Зависимости передаём явно (DI-friendly).
 *
 * apiKey приходит ИЗВНЕ (из заголовка запроса или env-фоллбэка) — граф его
 * только использует для вызова Groq и никуда не сохраняет. См. chat.service.ts.
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
  // Привязываем инструмент — теперь модель умеет его «звать».
  const modelWithTools = model.bindTools([SEARCH_TOOL as any]);

  // Узел: первичный поиск по базе знаний.
  async function retrieve(state: typeof AgentState.State) {
    const found = await retrieval.search(state.agentId, state.question, TOP_K);
    const citations = toCitations(found, 0);
    return {
      context: renderContext(citations),
      citations,
    };
  }

  // Узел: вызов LLM. Контекст подмешиваем как системное сообщение сразу
  // после основного системного промпта — так порядок сообщений валиден.
  async function agent(state: typeof AgentState.State) {
    const msgs: any[] = [...state.messages];
    if (state.context) {
      msgs.splice(
        1,
        0,
        new SystemMessage(
          `Контекст из базы знаний (ссылайся на источники по номерам [1], [2], ...):\n\n${state.context}`,
        ),
      );
    }
    const res = await modelWithTools.invoke(msgs);
    return { messages: [res], iterations: state.iterations + 1 };
  }

  // Узел: выполнение инструментов, запрошенных моделью.
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
            : 'По этому запросу ничего не найдено.';
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
            content: 'Неизвестный инструмент.',
            tool_call_id: call.id,
            name: call.name || 'unknown',
          }),
        );
      }
    }

    return { messages: toolMessages, citations: newCitations };
  }

  // Условный переход после узла agent: идти в tools или завершать.
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
