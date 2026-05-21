'use client';

import { Globe, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { SECTORS } from '@/lib/market-data';

export function SectorHeatmap() {
  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-0.5 h-3.5 rounded-full bg-gradient-to-b from-cyan-500 to-blue-500"/>
        <Globe className="w-3 h-3 text-cyan-500"/>
        <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Sector Heatmap</h2>
        <div className="flex-1 h-px bg-gradient-to-r from-slate-200/80 dark:from-white/[0.04] to-transparent"/>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-1.5">
        {SECTORS.map(s => {
          const pos = s.changePct > 0, flat = s.momentum === 'flat';
          const abs = Math.abs(s.changePct), int = Math.min(abs / 4, 1);
          const Icon = pos ? TrendingUp : flat ? Minus : TrendingDown;
          return (
            <div key={s.name} className="group relative rounded-xl p-2.5 cursor-pointer transition-all duration-300 hover:scale-[1.03] hover:z-10 overflow-hidden"
              style={{
                background: flat ? 'rgba(100,116,139,0.06)' : pos ? `linear-gradient(135deg, rgba(34,197,94,${0.03+int*0.1}), rgba(34,197,94,${0.01+int*0.05}))` : `linear-gradient(135deg, rgba(239,68,68,${0.03+int*0.1}), rgba(239,68,68,${0.01+int*0.05}))`,
                borderColor: flat ? 'rgba(100,116,139,0.1)' : pos ? `rgba(34,197,94,${0.15+int*0.2})` : `rgba(239,68,68,${0.15+int*0.2})`,
                borderWidth: '1px',
                boxShadow: `inset 0 1px 0 0 rgba(255,255,255,0.05), ${pos ? `0 4px 12px rgba(34,197,94,${int*0.1})` : `0 4px 12px rgba(239,68,68,${int*0.1})`}`
              }}>
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: pos ? 'linear-gradient(180deg, rgba(34,197,94,0.1), transparent)' : 'linear-gradient(180deg, rgba(239,68,68,0.1), transparent)' }}/>
              <div className="relative flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">{s.name}</span>
                <Icon className={`w-3 h-3 ${pos?'text-emerald-500':flat?'text-slate-400':'text-red-500'}`}/>
              </div>
              <div className={`relative text-[15px] font-bold tabular-nums leading-tight ${pos?'text-emerald-600 dark:text-emerald-400':flat?'text-slate-500':'text-red-600 dark:text-red-400'}`}>
                {pos?'+':''}{s.changePct.toFixed(2)}%
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
