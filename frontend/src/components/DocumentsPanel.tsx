'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { DocumentItem } from '@/lib/types';

export default function DocumentsPanel({
  agentId,
  onChange,
}: {
  agentId: string;
  onChange?: () => void;
}) {
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      setDocs(await api.listDocuments(agentId));
    } catch (err: any) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  async function upload(file: File) {
    setUploading(true);
    setError('');
    try {
      await api.uploadDocument(agentId, file);
      await load();
      onChange?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function remove(id: string) {
    await api.deleteDocument(agentId, id);
    await load();
    onChange?.();
  }

  return (
    <div className="flex h-full flex-col">
      <h3 className="mb-3 text-sm font-semibold text-slate-200">Knowledge base</h3>

      <label className="mb-3 block cursor-pointer rounded-lg border border-dashed border-slate-600 bg-ink/50 p-4 text-center text-xs text-slate-400 hover:border-indigo-500">
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.md,.markdown,.pdf,text/plain,text/markdown,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
          }}
        />
        {uploading ? (
          <span>Indexing… (chunking + embeddings)</span>
        ) : (
          <span>
            ⬆ Upload a document
            <br />
            <span className="text-slate-500">TXT · MD · PDF</span>
          </span>
        )}
      </label>

      {error && <p className="mb-2 text-xs text-red-400">{error}</p>}

      <div className="scroll-thin flex-1 space-y-2 overflow-y-auto">
        {docs.length === 0 ? (
          <p className="text-xs text-slate-500">
            No documents yet. Upload a file so the agent can cite it.
          </p>
        ) : (
          docs.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between rounded-lg border border-slate-700 bg-ink/50 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-xs text-slate-200">{d.filename}</p>
                <p className="text-[11px] text-slate-500">
                  {d.chunkCount} chunks
                </p>
              </div>
              <button
                onClick={() => remove(d.id)}
                className="ml-2 text-slate-500 hover:text-red-400"
                title="Delete"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
