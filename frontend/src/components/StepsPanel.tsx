'use client';

import { AgentStep } from '@/lib/types';

// Иконка по типу узла графа агента.
const NODE_ICON: Record<string, string> = {
  retrieve: '🔍',
  agent: '🧠',
  tools: '🛠️',
};

export default function StepsPanel({
  steps,
  live,
}: {
  steps: AgentStep[];
  live: boolean;
}) {
  return (
    <div className="flex h-full flex-col">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
        Шаги агента
        {live && (
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
        )}
      </h3>

      {steps.length === 0 ? (
        <p className="text-xs text-slate-500">
          Здесь появится трассировка: как агент ищет в базе знаний, вызывает
          инструменты и синтезирует ответ.
        </p>
      ) : (
        <ol className="scroll-thin flex-1 space-y-3 overflow-y-auto">
          {steps.map((s, i) => (
            <li key={i} className="relative pl-6">
              {/* вертикальная линия таймлайна */}
              {i < steps.length - 1 && (
                <span className="absolute left-[9px] top-5 h-full w-px bg-slate-700" />
              )}
              <span className="absolute left-0 top-0 text-sm">
                {NODE_ICON[s.node] || '•'}
              </span>
              <p className="text-xs font-medium text-slate-200">{s.title}</p>
              {s.detail && (
                <p className="mt-0.5 text-[11px] text-slate-400">{s.detail}</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
