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
   * Прогоняет вопрос через LangGraph-граф и отдаёт результат потоком (SSE).
   *
   * Из графа берём ДВА вида событий через streamMode ["updates","messages"]:
   *   • updates  → шаги агента (retrieve / agent / tools) для визуализации;
   *   • messages → токены финального ответа LLM (живой стриминг в чат).
   *
   * Протокол SSE (event: data):
   *   step      — очередной шаг агента
   *   token     — кусочек текста ответа
   *   citations — список источников
   *   done      — финал (с id сохранённого сообщения)
   *   error     — ошибка (например, не задан GROQ_API_KEY)
   */
  async streamChat(
    userId: string,
    agentId: string,
    message: string,
    res: Response,
    groqKey?: string,
  ) {
    const agent = await this.agents.assertOwned(userId, agentId);

    // BYOK: ключ из заголовка x-groq-key имеет приоритет; серверный
    // GROQ_API_KEY из env — опциональный фоллбэк. Ключ используется только
    // здесь, для вызова Groq, и НИКУДА не сохраняется и не логируется.
    const userKey = (groqKey || '').trim();
    const apiKey = userKey || process.env.GROQ_API_KEY || '';
    const keyValid = apiKey.length > 0 && !apiKey.includes('replace');

    // Настройка SSE-заголовков.
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
      // Нет валидного ключа → понятная ошибка, без краша.
      if (!keyValid) {
        send('error', {
          message:
            'Не указан Groq API key. Откройте «Настройки» и вставьте свой ' +
            'ключ (бесплатно: https://console.groq.com/keys). Ключ хранится ' +
            'только в вашем браузере и не сохраняется на сервере.',
        });
        return;
      }

      // История последних сообщений — для связности диалога.
      const history = await this.prisma.message.findMany({
        where: { agentId },
        orderBy: { createdAt: 'desc' },
        take: 6,
      });
      history.reverse();

      const systemPrompt =
        `${agent.systemPrompt}\n\n` +
        'Отвечай на основе контекста из базы знаний. Если используешь информацию ' +
        'из источника, ставь ссылку вида [1], [2] сразу после утверждения. ' +
        'Если контекста не хватает — вызови инструмент search_knowledge_base. ' +
        'Если ответа нет в базе знаний — честно скажи об этом.';

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
          // data = { имяУзла: частичноеОбновлениеСостояния }
          for (const [node, update] of Object.entries<any>(data)) {
            if (node === 'retrieve') {
              const n = update?.citations?.length || 0;
              emitStep({
                node,
                title: 'Поиск в базе знаний',
                detail: `Найдено фрагментов: ${n}`,
              });
              if (update?.citations) citations = update.citations;
            } else if (node === 'agent') {
              const last = update?.messages?.[update.messages.length - 1];
              const toolCalls = last?.tool_calls || [];
              if (toolCalls.length > 0) {
                emitStep({
                  node,
                  title: 'Агент решил вызвать инструмент',
                  detail: toolCalls
                    .map((t: any) => `${t.name}(${t.args?.query ?? ''})`)
                    .join(', '),
                });
              } else {
                emitStep({ node, title: 'Синтез ответа' });
              }
            } else if (node === 'tools') {
              if (update?.citations?.length) {
                citations = citations.concat(update.citations);
              }
              emitStep({
                node,
                title: 'Выполнение инструмента',
                detail: 'search_knowledge_base',
              });
            }
          }
        } else if (mode === 'messages') {
          // data = [messageChunk, metadata]. Стримим токены ТОЛЬКО узла
          // "agent" (финальный синтез LLM). Иначе в поток просочится текст
          // из ToolMessage — сырые найденные фрагменты, а не ответ модели.
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

      // Отдаём итоговые источники.
      send('citations', citations);

      // Сохраняем диалог (вопрос + ответ со steps/citations в meta).
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
      this.logger.error(`Ошибка чата: ${err?.message}`, err?.stack);
      const looksLikeAuth = /api key|apikey|401|unauthor|invalid/i.test(
        String(err?.message),
      );
      const hint = looksLikeAuth
        ? 'Groq отклонил ключ. Проверьте Groq API key в «Настройках» ' +
          '(бесплатный ключ: https://console.groq.com/keys).'
        : String(err?.message || 'Неизвестная ошибка');
      send('error', { message: hint });
    } finally {
      res.end();
    }
  }
}
