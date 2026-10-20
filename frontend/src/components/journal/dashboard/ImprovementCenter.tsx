'use client';

import { withAlpha } from '@/lib/utils';
import { Compass, Trophy, XCircle, Zap, Clock, TrendingUp, Hash, Flame } from 'lucide-react';
import type { PerformanceSnapshot } from '@/lib/api/journalApi';

interface Props {
  snapshot: PerformanceSnapshot | null;
  loading?: boolean;
}

function formatHold(m: number | null): string {
  if (m === null) return '—';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return m % 60 > 0 ? `${h}h ${m % 60}m` : `${h}h`;
}

interface Row {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
  detail?: string;
}

export function ImprovementCenter({ snapshot, loading }: Props) {
  if (loading) {
    return (
      <div className="glass-card p-5">
        <div className="h-4 w-44 skeleton rounded mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-10 skeleton rounded-lg" />)}
        </div>
      </div>
    );
  }

  const s = snapshot;

  const streakVal = !s ? '—'
    : s.currentStreak === 0 ? 'Neutral'
    : s.currentStreak > 0 ? `${s.currentStreak}W Streak`
    : `${Math.abs(s.currentStreak)}L Streak`;

  const streakColor = !s ? 'rgb(var(--neutral-500))'
    : s.currentStreak > 0 ? 'rgb(var(--positive-400))'
    : s.currentStreak < 0 ? 'rgb(var(--negative-400))'
    : 'rgb(var(--neutral-500))';

  const rows: Row[] = [
    { icon: Trophy,     label: 'Best Setup',          value: s?.bestSetup ?? '—',                                color: 'rgb(var(--positive-400))', detail: 'Highest P&L setup' },
    { icon: XCircle,    label: 'Worst Setup',         value: s?.worstSetup ?? '—',                               color: 'rgb(var(--negative-400))', detail: 'Lowest P&L setup' },
    { icon: Zap,        label: 'Best Session',        value: s?.bestSession ?? '—',                              color: 'rgb(var(--brand-400))', detail: 'Most profitable session' },
    { icon: Zap,        label: 'Weakest Session',     value: s?.worstSession ?? '—',                             color: 'rgb(var(--warning-400))', detail: 'Least profitable session' },
    { icon: Flame,      label: 'Current Streak',      value: streakVal,                                          color: streakColor },
    { icon: Clock,      label: 'Avg Hold Time',       value: formatHold(s?.avgHoldMinutes ?? null),              color: 'rgb(var(--brand-400))' },
    { icon: TrendingUp, label: 'Average RR',          value: s?.avgRR != null ? `${s.avgRR}R` : '—',            color: 'rgb(var(--brand-400))' },
    { icon: Hash,       label: 'Top Instrument',      value: s?.mostTradedInstrument ?? '—',                    color: 'rgb(var(--warning-400))' },
  ];

  return (
    <div className="glass-card p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Compass className="w-4 h-4 text-brand-400" />
        <h3 className="text-sm font-bold">Trading Improvement Center</h3>
        {!snapshot && (
          <span className="text-[11px] text-muted-foreground ml-1">· close a trade to populate</span>
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4">
        {rows.map((r) => {
          const Icon = r.icon;
          const isEmpty = r.value === '—';
          return (
            <div key={r.label} className="flex items-start gap-2.5">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0 mt-0.5"
                style={{ background: `${withAlpha(r.color, 0.07)}`, color: r.color }}>
                <Icon className="w-3.5 h-3.5" />
              </span>
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-neutral-500 mb-0.5">{r.label}</div>
                <div className={`text-[12px] font-bold truncate ${isEmpty ? 'text-neutral-500' : ''}`} style={!isEmpty ? { color: r.color } : {}}>
                  {r.value}
                </div>
                {r.detail && <div className="text-[11px] text-neutral-500 mt-0.5">{r.detail}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
