'use client';

import { useState } from 'react';
import { Zap, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { TOP_GAINERS, TOP_LOSERS, VOLUME_BREAKOUTS, type MoverStock } from '@/lib/market-data';

const TABS = [
  { key: 'gainers', label: 'Gainers', icon: TrendingUp, data: TOP_GAINERS },
  { key: 'losers', label: 'Losers', icon: TrendingDown, data: TOP_LOSERS },
  { key: 'volume', label: 'Vol Breakout', icon: BarChart3, data: VOLUME_BREAKOUTS },
] as const;

function StockRow({ stock, rank }: { stock: MoverStock; rank: number }) {
  const pos = stock.changePct >= 0;
  return (
    <div className="group flex items-center gap-2.5 px-3 py-2.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.04] transition-all duration-200
      border-l-2 border-transparent hover:border-indigo-500/50 hover:pl-4">
      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 w-3 text-center tabular-nums">{rank}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-bold text-slate-900 dark:text-white">{stock.symbol}</span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{stock.name}</span>
        </div>
        <span className="inline-block mt-0.5 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400">{stock.momentum}</span>
      </div>
      <div className="text-right flex-shrink-0">
        <div className={`text-[13px] font-bold tabular-nums px-1.5 py-0.5 rounded ${pos ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' : 'text-red-600 dark:text-red-400 bg-red-500/10'}`}>
          {pos?'+':''}{stock.changePct.toFixed(2)}%
        </div>
        <div className="text-[9px] text-slate-400 dark:text-slate-500 tabular-nums mt-0.5">{stock.volume}</div>
      </div>
    </div>
  );
}

export function TopMovers() {
  const [active, setActive] = useState<string>('gainers');
  const cur = TABS.find(t => t.key === active) ?? TABS[0];
  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-0.5 h-3.5 rounded-full bg-gradient-to-b from-orange-500 to-amber-500"/>
        <Zap className="w-3 h-3 text-orange-500"/>
        <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Top Movers</h2>
        <div className="flex-1 h-px bg-gradient-to-r from-slate-200/80 dark:from-white/[0.04] to-transparent"/>
      </div>
      <div className="flex gap-0.5 mb-2 p-0.5 rounded-md bg-black/[0.025] dark:bg-white/[0.025] w-fit">
        {TABS.map(tab => {
          const Icon = tab.icon; const isA = tab.key === active;
          return (
            <button key={tab.key} onClick={() => setActive(tab.key)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-semibold transition-all ${
                isA ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}>
              <Icon className="w-2.5 h-2.5"/>{tab.label}
            </button>
          );
        })}
      </div>
      <div className="glass-card overflow-hidden divide-y divide-black/[0.025] dark:divide-white/[0.035]">
        {cur.data.map((s,i) => <StockRow key={s.symbol} stock={s} rank={i+1}/>)}
      </div>
    </section>
  );
}
