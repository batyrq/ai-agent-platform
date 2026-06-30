'use client';

import { useEffect, useState } from 'react';
import { clearGroqKey, getGroqKey, setGroqKey } from '@/lib/settings';

export default function SettingsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [key, setKey] = useState('');
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open) {
      setKey(getGroqKey());
      setSaved(false);
    }
  }, [open]);

  if (!open) return null;

  function save() {
    setGroqKey(key);
    setSaved(true);
    setTimeout(onClose, 600);
  }

  function remove() {
    clearGroqKey();
    setKey('');
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-700 bg-panel p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Настройки</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        <label className="mb-1 block text-sm font-medium text-slate-200">
          Groq API key
        </label>
        <div className="flex gap-2">
          <input
            type={show ? 'text' : 'password'}
            className="flex-1 rounded-lg border border-slate-700 bg-ink px-3 py-2 text-sm outline-none focus:border-indigo-500"
            placeholder="gsk_..."
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
          <button
            onClick={() => setShow(!show)}
            className="rounded-lg border border-slate-700 px-3 text-xs text-slate-300 hover:bg-slate-800"
          >
            {show ? 'Скрыть' : 'Показать'}
          </button>
        </div>

        <p className="mt-2 text-xs text-slate-400">
          Бесплатный ключ:{' '}
          <a
            href="https://console.groq.com/keys"
            target="_blank"
            rel="noreferrer"
            className="text-indigo-400 hover:underline"
          >
            console.groq.com/keys
          </a>
        </p>

        <div className="mt-3 rounded-lg border border-slate-700 bg-ink/60 p-3 text-xs text-slate-400">
          🔒 Ключ хранится <span className="text-slate-200">только в этом
          браузере</span> (localStorage) и отправляется на сервер лишь для
          вызова модели. На сервере он <span className="text-slate-200">не
          сохраняется и не логируется</span>.
        </div>

        <div className="mt-5 flex items-center justify-between">
          <button
            onClick={remove}
            className="text-xs text-slate-500 hover:text-red-400"
          >
            Удалить ключ
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Отмена
            </button>
            <button
              onClick={save}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500"
            >
              {saved ? 'Сохранено ✓' : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
