'use client';

import { Sparkles } from 'lucide-react';

interface Props {
  text: string;
  severity?: 'info' | 'warn' | 'positive';
}

const BORDER: Record<string, string> = {
  info: 'border-violet-500/25',
  warn: 'border-amber-500/30',
  positive: 'border-emerald-500/25',
};

export function InsightCard({ text, severity = 'info' }: Props) {
  return (
    <div
      className={`flex gap-2.5 p-3 rounded-xl border bg-white/[0.02] ${BORDER[severity]} terminal-row-hover`}
    >
      <Sparkles className="w-3.5 h-3.5 text-violet-400 flex-shrink-0 mt-0.5" />
      <p className="text-[11px] text-slate-400 leading-relaxed">{text}</p>
    </div>
  );
}
