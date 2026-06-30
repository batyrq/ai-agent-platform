'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, clearToken, getToken } from '@/lib/api';
import { Agent } from '@/lib/types';
import SettingsModal from '@/components/SettingsModal';

export default function DashboardPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);

  async function load() {
    try {
      setAgents(await api.listAgents());
    } catch (err: any) {
      setError(err.message);
      if (/401/.test(err.message)) router.replace('/login');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError('');
    try {
      const agent = await api.createAgent({ name, description });
      setName('');
      setDescription('');
      router.push(`/agents/${agent.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Удалить агента вместе с базой знаний?')) return;
    await api.deleteAgent(id);
    load();
  }

  function logout() {
    clearToken();
    router.replace('/login');
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Мои агенты</h1>
          <p className="text-sm text-slate-400">
            Создавай агентов, загружай документы, общайся в чате с цитатами.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setSettingsOpen(true)}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
          >
            ⚙ Groq key
          </button>
          <button
            onClick={logout}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
          >
            Выйти
          </button>
        </div>
      </header>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      <form
        onSubmit={create}
        className="mb-8 rounded-2xl border border-slate-700 bg-panel p-5"
      >
        <h2 className="mb-3 text-sm font-medium text-slate-200">Новый агент</h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            className="flex-1 rounded-lg border border-slate-700 bg-ink px-3 py-2 text-sm outline-none focus:border-indigo-500"
            placeholder="Название (напр. «Поддержка по API»)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="flex-1 rounded-lg border border-slate-700 bg-ink px-3 py-2 text-sm outline-none focus:border-indigo-500"
            placeholder="Описание (необязательно)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <button
            disabled={creating}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
          >
            {creating ? '...' : 'Создать'}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      </form>

      {loading ? (
        <p className="text-slate-400">Загрузка…</p>
      ) : agents.length === 0 ? (
        <p className="text-slate-400">
          Пока нет агентов. Создай первого выше 👆
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((a) => (
            <div
              key={a.id}
              className="flex flex-col rounded-2xl border border-slate-700 bg-panel p-5 transition hover:border-indigo-500"
            >
              <Link href={`/agents/${a.id}`} className="flex-1">
                <h3 className="text-lg font-medium">{a.name}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-slate-400">
                  {a.description || 'Без описания'}
                </p>
                <div className="mt-4 flex gap-4 text-xs text-slate-500">
                  <span>📄 {a._count?.documents ?? 0} док.</span>
                  <span>🧩 {a._count?.chunks ?? 0} чанков</span>
                </div>
              </Link>
              <div className="mt-4 flex gap-2">
                <Link
                  href={`/agents/${a.id}`}
                  className="flex-1 rounded-lg bg-indigo-600 py-1.5 text-center text-sm hover:bg-indigo-500"
                >
                  Открыть чат
                </Link>
                <button
                  onClick={() => remove(a.id)}
                  className="rounded-lg border border-slate-700 px-3 text-sm text-slate-400 hover:bg-slate-800"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
