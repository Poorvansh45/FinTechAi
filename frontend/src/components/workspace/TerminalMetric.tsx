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
        <span className="text-[11px] font-bold text-neutral-500">{label}</span>
        <div className="flex items-center gap-1">
          {trend && (
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                trend === 'up' ? 'bg-positive-400' : trend === 'down' ? 'bg-negative-400' : 'bg-neutral-500'
              }`}
            />
          )}
          {Icon && <Icon className="w-3 h-3 text-neutral-500 group-hover:text-brand-400 transition-colors" />}
        </div>
      </div>
      <div className={`text-[15px] font-bold tabular-nums leading-tight ${color ?? 'text-foreground'}`}>
        {value}
      </div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}
