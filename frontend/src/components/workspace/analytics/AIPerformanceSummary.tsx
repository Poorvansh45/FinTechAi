'use client';

import { Sparkles } from 'lucide-react';
import { computePerformanceSummary } from '@/lib/journal/behavior-analytics';
import type { Trade } from '@/lib/journal/types';

interface Props {
  trades: Trade[];
  setupName: (id: string) => string;
}

export function AIPerformanceSummary({ trades, setupName }: Props) {
  const s = computePerformanceSummary(trades, setupName);
  const items = [
    { label: 'Best setup', value: s.bestSetup },
    { label: 'Strongest session', value: s.strongestSession },
    { label: 'Worst behavior', value: s.worstBehavior },
    { label: 'Best day', value: s.bestDay },
    { label: 'Top instrument', value: s.topInstrument },
  ];

  return (
    <div className="glass-card p-4 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-violet-400" />
        <h3 className="text-sm font-semibold">AI Performance Summary</h3>
      </div>
      <p className="text-[10px] text-muted-foreground mb-3">Interpreted from your journal — not just raw stats.</p>
      <div className="space-y-2 flex-1">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-lg px-3 py-2 border border-white/5 bg-white/[0.02] terminal-row-hover"
          >
            <div className="text-[9px] uppercase tracking-wide text-slate-500">{item.label}</div>
            <div className="text-[12px] font-semibold text-slate-200 mt-0.5 truncate">{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
