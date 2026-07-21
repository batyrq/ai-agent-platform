import { API_URL, getToken } from './api';
import { getGroqKey } from './settings';
import { AgentStep, Citation } from './types';

export interface ChatStreamHandlers {
  onStep?: (step: AgentStep) => void;
  onToken?: (text: string) => void;
  /** The draft before the tool call was cancelled — clear the answer text. */
  onReset?: () => void;
  onCitations?: (citations: Citation[]) => void;
  onDone?: () => void;
  onError?: (message: string) => void;
}

/**
 * Sends the question and reads the SSE response via fetch + ReadableStream.
 *
 * We use fetch (not EventSource) because we need an Authorization header,
 * which EventSource does not support. SSE is parsed by hand: events are
 * separated by a blank line, and contain "event:" and "data:" lines.
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
      // BYOK: the user's own Groq key. Never stored on the server.
      'x-groq-key': getGroqKey(),
    },
    body: JSON.stringify({ message }),
  });

  if (!res.ok || !res.body) {
    handlers.onError?.(`Connection error (${res.status})`);
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
      /* keep it as a string */
    }
    switch (event) {
      case 'step':
        handlers.onStep?.(parsed);
        break;
      case 'token':
        handlers.onToken?.(parsed.text ?? '');
        break;
      case 'reset':
        handlers.onReset?.();
        break;
      case 'citations':
        handlers.onCitations?.(parsed);
        break;
      case 'done':
        handlers.onDone?.();
        break;
      case 'error':
        handlers.onError?.(parsed.message ?? 'Error');
        break;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Parse every complete SSE message (separated by a blank line).
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
