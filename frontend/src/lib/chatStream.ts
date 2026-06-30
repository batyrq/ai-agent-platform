import { API_URL, getToken } from './api';
import { getGroqKey } from './settings';
import { AgentStep, Citation } from './types';

export interface ChatStreamHandlers {
  onStep?: (step: AgentStep) => void;
  onToken?: (text: string) => void;
  onCitations?: (citations: Citation[]) => void;
  onDone?: () => void;
  onError?: (message: string) => void;
}

/**
 * Отправляет вопрос и читает SSE-ответ через fetch + ReadableStream.
 *
 * Используем fetch (а не EventSource), потому что нужен Authorization-заголовок,
 * которого EventSource не поддерживает. Парсим SSE вручную: события разделены
 * пустой строкой, внутри — строки "event:" и "data:".
 */
export async function streamChat(
  agentId: string,
  message: string,
  handlers: ChatStreamHandlers,
) {
  const res = await fetch(`${API_URL}/agents/${agentId}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      // BYOK: пользовательский ключ Groq. На сервере не сохраняется.
      'x-groq-key': getGroqKey(),
    },
    body: JSON.stringify({ message }),
  });

  if (!res.ok || !res.body) {
    handlers.onError?.(`Ошибка соединения (${res.status})`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const dispatch = (event: string, data: string) => {
    let parsed: any = data;
    try {
      parsed = JSON.parse(data);
    } catch {
      /* оставляем строкой */
    }
    switch (event) {
      case 'step':
        handlers.onStep?.(parsed);
        break;
      case 'token':
        handlers.onToken?.(parsed.text ?? '');
        break;
      case 'citations':
        handlers.onCitations?.(parsed);
        break;
      case 'done':
        handlers.onDone?.();
        break;
      case 'error':
        handlers.onError?.(parsed.message ?? 'Ошибка');
        break;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Разбираем все полные SSE-сообщения (разделитель — пустая строка).
    let idx;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);

      let event = 'message';
      const dataLines: string[] = [];
      for (const line of raw.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
      }
      if (dataLines.length) dispatch(event, dataLines.join('\n'));
    }
  }
}
