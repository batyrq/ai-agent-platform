export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
}

export interface Agent {
  id: string;
  name: string;
  description?: string | null;
  systemPrompt: string;
  createdAt: string;
  _count?: { documents: number; chunks: number };
}

export interface DocumentItem {
  id: string;
  filename: string;
  mimeType: string;
  chunkCount: number;
  createdAt: string;
}

export interface Citation {
  index: number;
  filename: string;
  documentId: string;
  chunkId: string;
  chunkIndex: number;
  score: number;
  snippet: string;
}

export interface AgentStep {
  node: string;
  title: string;
  detail?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  steps?: AgentStep[];
  streaming?: boolean;
}
