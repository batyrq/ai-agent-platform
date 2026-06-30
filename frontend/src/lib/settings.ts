// BYOK: ключ Groq хранится ТОЛЬКО в браузере пользователя (localStorage).
// На сервер он уходит лишь в заголовке x-groq-key при каждом запросе чата
// и там не сохраняется. См. backend: chat.controller.ts / chat.service.ts.

const GROQ_KEY = 'aiap_groq_key';

export function getGroqKey(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(GROQ_KEY) || '';
}

export function setGroqKey(key: string) {
  window.localStorage.setItem(GROQ_KEY, key.trim());
}

export function clearGroqKey() {
  window.localStorage.removeItem(GROQ_KEY);
}

export function hasGroqKey(): boolean {
  return getGroqKey().length > 0;
}
