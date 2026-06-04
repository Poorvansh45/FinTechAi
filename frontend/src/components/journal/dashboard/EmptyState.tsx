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
        className="relative w-16 h-16 rounded-3xl flex items-center justify-center mb-5"
        style={{
          background: 'linear-gradient(135deg, rgba(79,70,229,0.15), rgba(124,58,237,0.1))',
          border: '1px solid rgba(99,102,241,0.2)',
          boxShadow: '0 0 40px rgba(99,102,241,0.12)',
        }}
      >
        <BookOpen className="w-7 h-7 text-indigo-400" />
        {/* Pulse ring */}
        <span
          className="absolute inset-0 rounded-3xl animate-ping opacity-30"
          style={{ background: 'rgba(99,102,241,0.15)', animationDuration: '2s' }}
        />
      </div>

      {/* Headline */}
      <h2 className="text-xl font-black mb-2">Start your trading journal</h2>
      <p className="text-sm text-muted-foreground max-w-sm leading-relaxed mb-6">
        Start journaling your trades to unlock analytics, equity tracking, and AI coaching insights.
      </p>

      {/* CTA */}
      <button
        onClick={onAddTrade}
        className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold text-white transition-all hover:scale-105 active:scale-95 mb-10"
        style={{
          background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
          boxShadow: '0 0 24px rgba(99,102,241,0.35)',
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
                style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8' }}
              >
                <IconComp className="w-4 h-4" />
              </span>
              <div className="text-[11px] font-bold">{tip.label}</div>
              <div className="text-[10px] text-muted-foreground leading-snug">{tip.desc}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
