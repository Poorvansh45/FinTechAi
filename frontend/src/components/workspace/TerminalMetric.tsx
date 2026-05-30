'use client';

import type { LucideIcon } from 'lucide-react';

interface Props {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  icon?: LucideIcon;
  tooltip?: string;
  trend?: 'up' | 'down' | 'neutral';
}

export function TerminalMetric({ label, value, sub, color, icon: Icon, tooltip, trend }: Props) {
  return (
    <div className="glass-card px-3 py-2 group relative terminal-row-hover" title={tooltip}>
      <div className="flex items-center justify-between gap-1 mb-0.5">
        <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</span>
        <div className="flex items-center gap-1">
          {trend && (
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                trend === 'up' ? 'bg-emerald-400' : trend === 'down' ? 'bg-red-400' : 'bg-slate-500'
              }`}
            />
          )}
          {Icon && <Icon className="w-3 h-3 text-slate-600 group-hover:text-violet-400 transition-colors" />}
        </div>
      </div>
      <div className={`text-[15px] font-bold tabular-nums leading-tight ${color ?? 'text-slate-900 dark:text-white'}`}>
        {value}
      </div>
      {sub && <div className="text-[9px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}
