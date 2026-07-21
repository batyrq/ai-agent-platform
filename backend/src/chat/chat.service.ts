import { Injectable, Logger } from '@nestjs/common';
import type { Response } from 'express';
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import { PrismaService } from '../prisma/prisma.service';
import { RetrievalService } from '../rag/retrieval.service';
import { AgentsService } from '../agents/agents.service';
import { buildAgentGraph, Citation } from './graph';

interface StepEvent {
  node: string;
  title: string;
  detail?: string;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly retrieval: RetrievalService,
    private readonly agents: AgentsService,
  ) {}

  async getHistory(userId: string, agentId: string) {
    await this.agents.assertOwned(userId, agentId);
    return this.prisma.message.findMany({
      where: { agentId },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
  }

  /**
   * Runs the question through the LangGraph graph and streams the result (SSE).
   *
   * We take TWO kinds of events from the graph via streamMode ["updates","messages"]:
   *   • updates  → agent steps (retrieve / agent / tools) for visualization;
   *   • messages → tokens of the final LLM answer (live streaming into the chat).
   *
   * SSE protocol (event: data):
   *   step      — the next agent step
   *   token     — a piece of the answer text
   *   citations — the list of sources
   *   done      — the end (with the id of the saved message)
   *   error     — a failure (e.g. GROQ_API_KEY is not set)
   */
  async streamChat(
    userId: string,
    agentId: string,
    message: string,
    res: Response,
    groqKey?: string,
  ) {
    const agent = await this.agents.assertOwned(userId, agentId);

    // BYOK: the key from the x-groq-key header takes priority; the server-side
    // GROQ_API_KEY from env is an optional fallback. The key is used only
    // here, to call Groq, and is NEVER stored or logged.
    const userKey = (groqKey || '').trim();
    const apiKey = userKey || process.env.GROQ_API_KEY || '';
    const keyValid = apiKey.length > 0 && !apiKey.includes('replace');

    // SSE header setup.
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const steps: StepEvent[] = [];
    const emitStep = (s: StepEvent) => {
      steps.push(s);
      send('step', s);
    };

    try {
      // No valid key → a clear error instead of a crash.
      if (!keyValid) {
        send('error', {
          message:
            'No Groq API key set. Open “Settings” and paste your own key ' +
            '(free at https://console.groq.com/keys). The key is stored only ' +
            'in your browser and is never saved on the server.',
        });
        return;
      }

      // The most recent messages — to keep the conversation coherent.
      const history = await this.prisma.message.findMany({
        where: { agentId },
        orderBy: { createdAt: 'desc' },
        take: 6,
      });
      history.reverse();

      const systemPrompt =
        `${agent.systemPrompt}\n\n` +
        'Answer based on the context from the knowledge base. When you use ' +
        'information from a source, put a citation like [1], [2] right after ' +
        'the statement. If the context is not enough, call the ' +
        'search_knowledge_base tool. If the answer is not in the knowledge ' +
        'base, say so honestly.';

      const lcHistory = history.map((m) =>
        m.role === 'user'
          ? new HumanMessage(m.content)
          : new AIMessage(m.content),
      );

      const graph = buildAgentGraph(this.retrieval, systemPrompt, apiKey);

      const initialState = {
        messages: [
          new SystemMessage(systemPrompt),
          ...lcHistory,
          new HumanMessage(message),
        ],
        agentId,
        question: message,
      };

      let answer = '';
      let citations: Citation[] = [];

      const stream = await graph.stream(initialState as any, {
        streamMode: ['updates', 'messages'],
        recursionLimit: 25,
      });

      for await (const chunk of stream as any) {
        const [mode, data] = chunk as [string, any];

        if (mode === 'updates') {
          // data = { nodeName: partialStateUpdate }
          for (const [node, update] of Object.entries<any>(data)) {
            if (node === 'retrieve') {
              const n = update?.citations?.length || 0;
              emitStep({
                node,
                title: 'Searching the knowledge base',
                detail: `Chunks found: ${n}`,
              });
              if (update?.citations) citations = update.citations;
            } else if (node === 'agent') {
              const last = update?.messages?.[update.messages.length - 1];
              const toolCalls = last?.tool_calls || [];
              if (toolCalls.length > 0) {
                // This pass through the agent node ended in a tool call —
                // so its text was only reasoning along the way ("let me
                // search..."), not an answer. Drop what we accumulated and ask
                // the client to clear the bubble, otherwise the final answer
                // gets glued to the draft and duplicated.
                answer = '';
                send('reset', {});
                emitStep({
                  node,
                  title: 'Agent decided to call a tool',
                  // The tool-call arguments may not have arrived in the streamed
                  // update yet — in that case just show the tool name,
                  // without empty parentheses.
                  detail: toolCalls
                    .map((t: any) => {
                      const q = t.args?.query;
                      return q ? `${t.name}("${q}")` : t.name;
                    })
                    .join(', '),
                });
              } else {
                emitStep({ node, title: 'Synthesizing the answer' });
              }
            } else if (node === 'tools') {
              if (update?.citations?.length) {
                citations = citations.concat(update.citations);
              }
              emitStep({
                node,
                title: 'Running tool',
                detail: 'search_knowledge_base',
              });
            }
          }
        } else if (mode === 'messages') {
          // data = [messageChunk, metadata]. Stream tokens ONLY from the
          // "agent" node (the final LLM synthesis). Otherwise ToolMessage text
          // leaks into the stream — raw retrieved chunks, not the model's answer.
          const [msgChunk, meta] = data as [any, any];
          const fromAgent = meta?.langgraph_node === 'agent';
          const content =
            typeof msgChunk?.content === 'string' ? msgChunk.content : '';
          if (fromAgent && content) {
            answer += content;
            send('token', { text: content });
          }
        }
      }

      // Send the final list of sources.
      send('citations', citations);

      // Persist the exchange (question + answer with steps/citations in meta).
      await this.prisma.message.create({
        data: { agentId, role: 'user', content: message },
      });
      const saved = await this.prisma.message.create({
        data: {
          agentId,
          role: 'assistant',
          content: answer,
          meta: { steps, citations } as any,
        },
      });

      send('done', { messageId: saved.id });
    } catch (err: any) {
      this.logger.error(`Chat error: ${err?.message}`, err?.stack);
      const looksLikeAuth = /api key|apikey|401|unauthor|invalid/i.test(
        String(err?.message),
      );
      const hint = looksLikeAuth
        ? 'Groq rejected the key. Check your Groq API key in “Settings” ' +
          '(free key: https://console.groq.com/keys).'
        : String(err?.message || 'Unknown error');
      send('error', { message: hint });
    } finally {
      res.end();
    }
  }
}
