'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Target, ImageIcon, TrendingUp, TrendingDown } from 'lucide-react';
import type { Trade } from '@/lib/journal/types';
import { buildTradeInsights } from '@/lib/journal/insights';
import { SectionHeader } from './SectionHeader';

interface Props {
  trade: Trade;
  setupName: (id: string) => string;
  onClose: () => void;
}

const TAG_COLORS: Record<string, string> = {
  disciplined: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  patient: 'bg-blue-500/15 text-blue-300 border-blue-500/25',
  impulsive: 'bg-red-500/15 text-red-400 border-red-500/25',
  'revenge risk': 'bg-orange-500/15 text-orange-400 border-orange-500/25',
  'confident execution': 'bg-violet-500/15 text-violet-300 border-violet-500/25',
  uncertain: 'bg-slate-500/15 text-slate-400 border-slate-500/20',
  neutral: 'bg-slate-500/10 text-slate-500 border-slate-500/15',
};

export function TradeInsightPanel({ trade, setupName, onClose }: Props) {
  const insight = useMemo(() => buildTradeInsights(trade, setupName(trade.setupId)), [trade, setupName]);
  const { snapshot, reviews, executionScore, behaviorTags, keyImprovement } = insight;
  const isProfit = snapshot.pnl != null && snapshot.pnl > 0;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={trade.id}
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 8 }}
        className="glass-card h-full flex flex-col min-h-[400px] overflow-hidden"
      >
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${trade.side === 'Buy' ? 'bg-green-500/15' : 'bg-red-500/15'}`}>
              {trade.side === 'Buy' ? <TrendingUp className="w-4 h-4 text-green-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
            </div>
            <div>
              <div className="text-sm font-bold">{snapshot.instrument}</div>
              <div className="text-[10px] text-muted-foreground">AI Trade Insight</div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <div>
            <SectionHeader title="Trade Snapshot" />
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              {[
                ['Direction', snapshot.direction],
                ['Outcome', snapshot.outcome],
                ['P&L', snapshot.pnl != null ? `${snapshot.pnl >= 0 ? '+' : ''}${snapshot.pnl.toFixed(2)}` : '—'],
                ['RR', snapshot.rr != null ? snapshot.rr.toFixed(2) : '—'],
                ['Duration', snapshot.durationMin != null ? `${snapshot.durationMin}m` : '—'],
                ['Session', snapshot.session],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg px-2 py-1.5 bg-white/[0.03] border border-white/5">
                  <div className="text-muted-foreground">{k}</div>
                  <div className="font-semibold tabular-nums mt-0.5">{v}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <SectionHeader icon={Sparkles} title="AI Trade Review" live />
            <ul className="space-y-1.5">
              {reviews.map((line, i) => (
                <li key={i} className="text-[11px] text-slate-400 border-l-2 border-violet-500/40 pl-2 leading-relaxed">
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <SectionHeader icon={Target} title="Execution Score" />
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${executionScore}%`,
                    background: executionScore >= 70 ? 'linear-gradient(90deg,#22c55e,#4ade80)' : executionScore >= 45 ? 'linear-gradient(90deg,#f59e0b,#fbbf24)' : 'linear-gradient(90deg,#ef4444,#f87171)',
                  }}
                />
              </div>
              <span className="text-lg font-bold tabular-nums text-violet-300">{executionScore}</span>
            </div>
          </div>

          <div>
            <SectionHeader title="Behavior Tags" />
            <div className="flex flex-wrap gap-1.5">
              {behaviorTags.map((tag) => (
                <span
                  key={tag}
                  className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border capitalize ${TAG_COLORS[tag] ?? TAG_COLORS.neutral}`}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div>
            <SectionHeader title="Screenshot" />
            <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] h-24 flex flex-col items-center justify-center gap-1 text-muted-foreground">
              <ImageIcon className="w-5 h-5 opacity-40" />
              <span className="text-[10px]">Upload trade screenshot (coming soon)</span>
            </div>
          </div>

          <div className="rounded-xl p-3 border border-violet-500/20 bg-violet-500/5">
            <div className="text-[9px] font-bold uppercase tracking-wide text-violet-400 mb-1">Key Improvement</div>
            <p className="text-[11px] text-slate-300 leading-relaxed">{keyImprovement}</p>
          </div>

          <div
            className={`rounded-xl p-3 text-center text-sm font-bold tabular-nums ${
              isProfit ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' : 'text-red-400 bg-red-500/10 border border-red-500/20'
            }`}
          >
            {snapshot.pnl != null ? `${snapshot.pnl >= 0 ? '+' : ''}${snapshot.pnl.toFixed(2)}` : 'Open position'}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
