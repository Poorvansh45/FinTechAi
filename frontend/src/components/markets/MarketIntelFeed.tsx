'use client';

import { Sparkles, TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react';
import { INTEL_FEED, type IntelItem } from '@/lib/market-data';

const S_CFG = {
  bullish: { icon: TrendingUp, cls: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/15', rail: 'bg-emerald-500' },
  bearish: { icon: TrendingDown, cls: 'text-red-500 bg-red-500/10 border-red-500/15', rail: 'bg-red-500' },
  neutral: { icon: Minus, cls: 'text-slate-400 bg-slate-500/10 border-slate-500/15', rail: 'bg-slate-500' },
};
const I_CFG: Record<string,string> = {
  high: 'bg-orange-500/10 text-orange-500 border-orange-500/15',
  medium: 'bg-blue-500/10 text-blue-400 border-blue-500/15',
  low: 'bg-slate-500/8 text-slate-400 border-slate-500/15',
};

function IntelCard({ item }: { item: IntelItem }) {
  const s = S_CFG[item.sentiment]; const SIcon = s.icon;
  return (
    <div className="group relative flex gap-2.5 px-3 py-2.5 rounded-xl border transition-all duration-200
      glass-card overflow-hidden">
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${s.rail} opacity-50 group-hover:opacity-100 transition-opacity`} />
      <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 border mt-0.5 ml-1 ${s.cls}`}>
        <SIcon className="w-3 h-3"/>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] leading-[1.45] text-slate-700 dark:text-slate-300 font-medium">{item.summary}</p>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <span className={`text-[8px] font-bold uppercase px-1 py-px rounded border ${s.cls}`}>{item.sentiment}</span>
          <span className={`text-[8px] font-bold uppercase px-1 py-px rounded border ${I_CFG[item.impact]}`}>{item.impact}</span>
          <span className="text-[9px] text-slate-400 dark:text-slate-600 flex items-center gap-0.5 ml-auto">
            <Clock className="w-2.5 h-2.5"/>{item.timestamp}
          </span>
        </div>
      </div>
    </div>
  );
}

export function MarketIntelFeed() {
  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-0.5 h-3.5 rounded-full bg-gradient-to-b from-violet-500 to-pink-500"/>
        <Sparkles className="w-3 h-3 text-violet-500"/>
        <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">AI Market Intelligence</h2>
        <div className="flex-1 h-px bg-gradient-to-r from-slate-200/80 dark:from-white/[0.04] to-transparent"/>
        <span className="text-[9px] font-semibold text-violet-500 dark:text-violet-400 flex items-center gap-1">
          <Sparkles className="w-2.5 h-2.5"/>Processed
        </span>
      </div>
      <div className="space-y-1 max-h-[420px] overflow-y-auto pr-0.5">
        {INTEL_FEED.map(item => <IntelCard key={item.id} item={item}/>)}
      </div>
    </section>
  );
}
