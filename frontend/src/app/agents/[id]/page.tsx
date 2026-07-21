'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, getToken } from '@/lib/api';
import { streamChat } from '@/lib/chatStream';
import { Agent, AgentStep, ChatMessage, Citation } from '@/lib/types';
import DocumentsPanel from '@/components/DocumentsPanel';
import StepsPanel from '@/components/StepsPanel';
import SettingsModal from '@/components/SettingsModal';
import { hasGroqKey } from '@/lib/settings';

export default function AgentPage() {
  const router = useRouter();
  const params = useParams();
  const agentId = params.id as string;

  const [agent, setAgent] = useState<Agent | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [liveSteps, setLiveSteps] = useState<AgentStep[]>([]);
  const [error, setError] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [keySet, setKeySet] = useState(false);

  // Track whether a key is present (for the banner and the hint).
  useEffect(() => {
    setKeySet(hasGroqKey());
  }, [settingsOpen]);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    (async () => {
      try {
        const a = await api.getAgent(agentId);
        setAgent(a);
        const history = await api.chatHistory(agentId);
        setMessages(
          history.map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            citations: m.meta?.citations || [],
            steps: m.meta?.steps || [],
          })),
        );
      } catch (err: any) {
        setError(err.message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, liveSteps]);

  function updateLast(patch: Partial<ChatMessage>) {
    setMessages((prev) => {
      const copy = [...prev];
      const last = copy[copy.length - 1];
      copy[copy.length - 1] = { ...last, ...patch };
      return copy;
    });
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || streaming) return;

    setInput('');
    setError('');
    setLiveSteps([]);
    setStreaming(true);

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
    };
    const assistantMsg: ChatMessage = {
      id: `a-${Date.now()}`,
      role: 'assistant',
      content: '',
      steps: [],
      citations: [],
      streaming: true,
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    const steps: AgentStep[] = [];

    await streamChat(agentId, text, {
      onStep: (s) => {
        steps.push(s);
        setLiveSteps([...steps]);
        updateLast({ steps: [...steps] });
      },
      onToken: (t) => {
        updateLast({ content: (assistantMsg.content += t) });
      },
      onReset: () => {
        assistantMsg.content = '';
        updateLast({ content: '' });
      },
      onCitations: (c: Citation[]) => updateLast({ citations: c }),
      onDone: () => {
        updateLast({ streaming: false });
        setStreaming(false);
      },
      onError: (msg) => {
        updateLast({
          content: assistantMsg.content || `⚠️ ${msg}`,
          streaming: false,
        });
        setError(msg);
        setStreaming(false);
      },
    });
  }

  const lastAssistant = [...messages]
    .reverse()
    .find((m) => m.role === 'assistant');
  const stepsToShow = streaming ? liveSteps : lastAssistant?.steps || [];

  return (
    <main className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-slate-400 hover:text-slate-200"
          >
            ← Agents
          </Link>
          <div>
            <h1 className="text-base font-semibold">
              {agent?.name || 'Agent'}
            </h1>
            <p className="text-xs text-slate-500">
              {agent?.description || ''}
            </p>
          </div>
        </div>
        <button
          onClick={() => setSettingsOpen(true)}
          className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
        >
          ⚙ Groq key
          <span
            className={
              'h-2 w-2 rounded-full ' +
              (keySet ? 'bg-emerald-400' : 'bg-amber-400')
            }
            title={keySet ? 'Key is set' : 'Key is not set'}
          />
        </button>
      </header>

      {!keySet && (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-5 py-2 text-xs text-amber-300">
          To let the agent answer, add your Groq API key in{' '}
          <button
            onClick={() => setSettingsOpen(true)}
            className="font-medium underline"
          >
            Settings
          </button>
          . The key is stored only in your browser.
        </div>
      )}

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      <div className="grid flex-1 grid-cols-1 gap-0 overflow-hidden lg:grid-cols-[280px_1fr_320px]">
        {/* Left column: documents */}
        <aside className="hidden border-r border-slate-800 p-4 lg:block">
          <DocumentsPanel
            agentId={agentId}
            onChange={() => api.getAgent(agentId).then(setAgent)}
          />
        </aside>

        {/* Center: chat */}
        <section className="flex min-h-0 flex-col">
          <div
            ref={scrollRef}
            className="scroll-thin flex-1 space-y-4 overflow-y-auto p-5"
          >
            {messages.length === 0 && (
              <div className="mt-10 text-center text-sm text-slate-500">
                Ask a question — the agent will find the answer in the knowledge
                base and cite its sources.
              </div>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={
                  m.role === 'user' ? 'flex justify-end' : 'flex justify-start'
                }
              >
                <div
                  className={
                    'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ' +
                    (m.role === 'user'
                      ? 'bg-indigo-600 text-white'
                      : 'border border-slate-700 bg-panel text-slate-100')
                  }
                >
                  <p className="whitespace-pre-wrap break-words">
                    {m.content}
                    {m.streaming && (
                      <span className="ml-0.5 inline-block animate-pulse">▋</span>
                    )}
                  </p>

                  {m.role === 'assistant' &&
                    m.citations &&
                    m.citations.length > 0 && (
                      <div className="mt-3 space-y-1 border-t border-slate-700 pt-2">
                        <p className="text-[11px] font-semibold text-slate-400">
                          Sources:
                        </p>
                        {m.citations.map((c) => (
                          <div
                            key={c.index}
                            className="text-[11px] text-slate-400"
                            title={c.snippet}
                          >
                            <span className="text-indigo-400">[{c.index}]</span>{' '}
                            {c.filename}{' '}
                            <span className="text-slate-600">
                              · similarity {Math.round(c.score * 100)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              </div>
            ))}
          </div>

          <form
            onSubmit={send}
            className="flex gap-2 border-t border-slate-800 p-4"
          >
            <input
              className="flex-1 rounded-lg border border-slate-700 bg-ink px-3 py-2 text-sm outline-none focus:border-indigo-500"
              placeholder="Ask something…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={streaming}
            />
            <button
              disabled={streaming || !input.trim()}
              className="rounded-lg bg-indigo-600 px-5 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
            >
              {streaming ? '…' : 'Send'}
            </button>
          </form>
          {error && (
            <p className="px-4 pb-3 text-xs text-red-400">{error}</p>
          )}
        </section>

        {/* Right column: agent steps */}
        <aside className="hidden border-l border-slate-800 p-4 lg:block">
          <StepsPanel steps={stepsToShow} live={streaming} />
        </aside>
      </div>
    </main>
  );
}
