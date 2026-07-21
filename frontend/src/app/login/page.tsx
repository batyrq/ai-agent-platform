'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, setToken } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('demo@aiap.dev');
  const [password, setPassword] = useState('demo1234');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res =
        mode === 'login'
          ? await api.login(email, password)
          : await api.register(email, password, name);
      setToken(res.accessToken);
      router.replace('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-panel p-8 shadow-xl">
        <h1 className="mb-1 text-2xl font-semibold">AI Agent Platform</h1>
        <p className="mb-6 text-sm text-slate-400">
          {mode === 'login' ? 'Sign in to your account' : 'Create an account'}
        </p>

        <form onSubmit={submit} className="space-y-3">
          {mode === 'register' && (
            <input
              className="w-full rounded-lg border border-slate-700 bg-ink px-3 py-2 text-sm outline-none focus:border-indigo-500"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
          <input
            className="w-full rounded-lg border border-slate-700 bg-ink px-3 py-2 text-sm outline-none focus:border-indigo-500"
            placeholder="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="w-full rounded-lg border border-slate-700 bg-ink px-3 py-2 text-sm outline-none focus:border-indigo-500"
            placeholder="Password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading
              ? '...'
              : mode === 'login'
                ? 'Sign in'
                : 'Sign up'}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          className="mt-4 text-xs text-slate-400 hover:text-slate-200"
        >
          {mode === 'login'
            ? "Don't have an account? Sign up"
            : 'Already have an account? Sign in'}
        </button>

        <div className="mt-6 rounded-lg border border-slate-700 bg-ink/60 p-3 text-xs text-slate-400">
          Demo credentials are pre-filled:
          <br />
          <span className="text-slate-200">demo@aiap.dev / demo1234</span>
        </div>
      </div>
    </main>
  );
}
