// Тонкий клиент к backend. Токен храним в localStorage (демо-уровень;
// для прода лучше httpOnly-cookie).

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const TOKEN_KEY = 'aiap_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}

function authHeaders(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function handle(res: Response) {
  if (!res.ok) {
    let msg = `Ошибка ${res.status}`;
    try {
      const body = await res.json();
      msg = body.message || msg;
    } catch {
      /* ignore */
    }
    throw new Error(Array.isArray(msg) ? msg.join(', ') : msg);
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  async register(email: string, password: string, name?: string) {
    return handle(
      await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      }),
    );
  },

  async login(email: string, password: string) {
    return handle(
      await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      }),
    );
  },

  async listAgents() {
    return handle(
      await fetch(`${API_URL}/agents`, { headers: authHeaders() }),
    );
  },

  async getAgent(id: string) {
    return handle(
      await fetch(`${API_URL}/agents/${id}`, { headers: authHeaders() }),
    );
  },

  async createAgent(data: {
    name: string;
    description?: string;
    systemPrompt?: string;
  }) {
    return handle(
      await fetch(`${API_URL}/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(data),
      }),
    );
  },

  async deleteAgent(id: string) {
    return handle(
      await fetch(`${API_URL}/agents/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      }),
    );
  },

  async listDocuments(agentId: string) {
    return handle(
      await fetch(`${API_URL}/agents/${agentId}/documents`, {
        headers: authHeaders(),
      }),
    );
  },

  async uploadDocument(agentId: string, file: File) {
    const fd = new FormData();
    fd.append('file', file);
    return handle(
      await fetch(`${API_URL}/agents/${agentId}/documents`, {
        method: 'POST',
        headers: authHeaders(), // без Content-Type — браузер сам поставит boundary
        body: fd,
      }),
    );
  },

  async deleteDocument(agentId: string, docId: string) {
    return handle(
      await fetch(`${API_URL}/agents/${agentId}/documents/${docId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      }),
    );
  },

  async chatHistory(agentId: string) {
    return handle(
      await fetch(`${API_URL}/agents/${agentId}/chat/history`, {
        headers: authHeaders(),
      }),
    );
  },
};
