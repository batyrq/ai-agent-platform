// BYOK: the Groq key is stored ONLY in the user's browser (localStorage).
// It goes to the server just in the x-groq-key header on each chat request
// and is not stored there. See backend: chat.controller.ts / chat.service.ts.

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
