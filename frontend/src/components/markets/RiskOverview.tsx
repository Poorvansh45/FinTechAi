'use client';

import { ShieldAlert, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';
import { RISK_ITEMS } from '@/lib/market-data';

const L = {
  high:   { icon: AlertTriangle, cls: 'text-red-500 bg-red-500/10 border-red-500/15', label: 'HIGH' },
  medium: { icon: AlertCircle,   cls: 'text-amber-500 bg-amber-500/10 border-amber-500/15', label: 'MED' },
  low:    { icon: CheckCircle,   cls: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/15', label: 'LOW' },
};

export function RiskOverview() {
  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-0.5 h-3.5 rounded-full bg-gradient-to-b from-red-500 to-orange-500"/>
        <ShieldAlert className="w-3 h-3 text-red-500"/>
        <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Risk Overview</h2>
        <div className="flex-1 h-px bg-gradient-to-r from-slate-200/80 dark:from-white/[0.04] to-transparent"/>
      </div>
      <div className="grid grid-cols-1 gap-1.5">
        {RISK_ITEMS.map(item => {
          const c = L[item.level]; const Icon = c.icon;
          return (
            <div key={item.zone} className="flex items-center gap-2.5 p-3 glass-card hover:border-current/20 transition-all duration-200">
              <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 border ${c.cls}`}>
                <Icon className="w-3 h-3"/>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] font-bold text-slate-900 dark:text-white">{item.zone}</span>
                  <span className={`text-[8px] font-bold uppercase px-1 py-px rounded border ${c.cls}`}>{c.label}</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-snug">{item.detail}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
