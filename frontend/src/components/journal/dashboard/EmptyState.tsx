'use client';

import { BookOpen, Plus, Upload, Target, LineChart } from 'lucide-react';

interface Props {
  onAddTrade: () => void;
}

const TIPS = [
  { icon: BookOpen, label: 'Log your first trade', desc: 'Capture entry, exit, and setup details.' },
  { icon: Upload, label: 'Upload screenshots', desc: 'Attach chart images to each trade.' },
  { icon: LineChart, label: 'Track performance', desc: 'Your equity curve builds automatically.' },
  { icon: Target, label: 'Unlock AI coaching', desc: 'Get behavior insights after 3+ trades.' },
];

export function EmptyState({ onAddTrade }: Props) {
  return (
    <div className="flex flex-col items-center text-center py-12 px-4 animate-fadeIn">
      {/* Hero icon */}
      <div
        className="relative w-16 h-16 rounded-xl flex items-center justify-center mb-5"
        style={{
          background: 'rgb(var(--brand-600))',
          border: '1px solid rgb(var(--brand-500) / 0.2)',
          boxShadow: 'none',
        }}
      >
        <BookOpen className="w-7 h-7 text-brand-400" />
      </div>

      {/* Headline */}
      <h2 className="text-xl font-bold mb-2">Start your trading journal</h2>
      <p className="text-sm text-muted-foreground max-w-sm leading-relaxed mb-6">
        Start journaling your trades to unlock analytics, equity tracking, and AI coaching insights.
      </p>

      {/* CTA */}
      <button
        onClick={onAddTrade}
        className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white transition-all active:scale-95 mb-10"
        style={{
          background: 'rgb(var(--brand-600))',
          boxShadow: 'none',
        }}
      >
        <Plus className="w-4 h-4" />
        Add First Trade
      </button>

      {/* Tips grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-2xl">
        {TIPS.map((tip, i) => {
          const IconComp = tip.icon;
          return (
            <div
              key={i}
              className="glass-card p-4 flex flex-col items-center gap-2 text-center"
            >
              <span
                className="flex w-9 h-9 items-center justify-center rounded-xl"
                style={{ background: 'rgb(var(--brand-500) / 0.1)', color: 'rgb(var(--brand-400))' }}
              >
                <IconComp className="w-4 h-4" />
              </span>
              <div className="text-[11px] font-bold">{tip.label}</div>
              <div className="text-[11px] text-muted-foreground leading-snug">{tip.desc}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
