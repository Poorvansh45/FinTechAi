'use client';

import { Eye, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { WATCHLIST } from '@/lib/market-data';

export function WatchlistIntel() {
  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-0.5 h-3.5 rounded-full bg-gradient-to-b from-violet-500 to-indigo-500"/>
        <Eye className="w-3 h-3 text-violet-500"/>
        <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Watchlist Intelligence</h2>
        <div className="flex-1 h-px bg-gradient-to-r from-slate-200/80 dark:from-white/[0.04] to-transparent"/>
        <span className="text-[9px] text-slate-400 tabular-nums">{WATCHLIST.length} tracked</span>
      </div>
      <div className="glass-card overflow-hidden divide-y divide-black/[0.025] dark:divide-white/[0.035]">
        {WATCHLIST.map(item => {
          const pos = item.changePct >= 0;
          const Icon = item.trend==='up'?TrendingUp:item.trend==='down'?TrendingDown:Minus;
          return (
            <div key={item.symbol} className="group flex items-center gap-2.5 px-3 py-2.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.04] transition-all duration-200 border-l-2 border-transparent hover:border-violet-500/50 hover:pl-4">
              <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${item.trend==='up'?'bg-emerald-500/10':item.trend==='down'?'bg-red-500/10':'bg-slate-500/10'}`}>
                <Icon className={`w-3 h-3 ${item.trend==='up'?'text-emerald-500':item.trend==='down'?'text-red-500':'text-slate-400'}`}/>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] font-bold text-slate-900 dark:text-white">{item.symbol}</span>
                  <span className={`text-[10px] font-semibold tabular-nums ${pos?'text-emerald-600 dark:text-emerald-400':'text-red-600 dark:text-red-400'}`}>{pos?'+':''}{item.changePct.toFixed(2)}%</span>
                </div>
                <span className="text-[9px] text-slate-500">{item.signal}</span>
              </div>
              <span className="text-[12px] font-bold tabular-nums text-slate-900 dark:text-white/90 flex-shrink-0">₹{item.price.toLocaleString()}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
