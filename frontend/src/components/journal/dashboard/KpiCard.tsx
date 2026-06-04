'use client';

import type { LucideIcon } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: string | null;       // null = loading
  subLabel?: string;
  color?: string;             // tailwind color class e.g. 'text-emerald-400'
  icon: LucideIcon;
  accentColor?: string;       // hex for icon bg tint
  emptyMessage?: string;
}

export function KpiCard({
  label,
  value,
  subLabel,
  color,
  icon: Icon,
  accentColor = '#6366f1',
  emptyMessage = 'No journal data',
}: KpiCardProps) {
  const isEmpty = value === '—' || value === null;

  return (
    <div className="kpi-card px-4 py-3.5 flex flex-col gap-1 group relative overflow-hidden">
      {/* Top accent line on hover */}
      <div className="absolute inset-x-0 top-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: `linear-gradient(90deg, transparent, ${accentColor}88, transparent)` }} />

      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-500">
          {label}
        </span>
        <span
          className="flex items-center justify-center w-6 h-6 rounded-lg transition-colors"
          style={{ background: `${accentColor}14`, color: accentColor }}
        >
          <Icon className="w-3.5 h-3.5" />
        </span>
      </div>

      {/* Value */}
      {value === null ? (
        // Loading skeleton
        <div className="h-6 w-24 rounded skeleton mt-0.5" />
      ) : isEmpty ? (
        <div className="mt-0.5">
          <div className="text-xl font-bold tabular-nums text-slate-400 dark:text-slate-600">—</div>
          <div className="text-[10px] text-slate-400 dark:text-slate-600 mt-0.5">{emptyMessage}</div>
        </div>
      ) : (
        <div className="mt-0.5">
          <div className={`text-xl font-bold tabular-nums leading-tight ${color ?? 'text-slate-900 dark:text-white'}`}>
            {value}
          </div>
          {subLabel && (
            <div className="text-[10px] text-muted-foreground mt-0.5">{subLabel}</div>
          )}
        </div>
      )}
    </div>
  );
}
