'use client';

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

  const streakColor = !s ? '#64748b'
    : s.currentStreak > 0 ? '#22c55e'
    : s.currentStreak < 0 ? '#ef4444'
    : '#64748b';

  const rows: Row[] = [
    { icon: Trophy,     label: 'Best Setup',          value: s?.bestSetup ?? '—',                                color: '#22c55e', detail: 'Highest P&L setup' },
    { icon: XCircle,    label: 'Worst Setup',         value: s?.worstSetup ?? '—',                               color: '#ef4444', detail: 'Lowest P&L setup' },
    { icon: Zap,        label: 'Best Session',        value: s?.bestSession ?? '—',                              color: '#a78bfa', detail: 'Most profitable session' },
    { icon: Zap,        label: 'Weakest Session',     value: s?.worstSession ?? '—',                             color: '#fb923c', detail: 'Least profitable session' },
    { icon: Flame,      label: 'Current Streak',      value: streakVal,                                          color: streakColor },
    { icon: Clock,      label: 'Avg Hold Time',       value: formatHold(s?.avgHoldMinutes ?? null),              color: '#38bdf8' },
    { icon: TrendingUp, label: 'Average RR',          value: s?.avgRR != null ? `${s.avgRR}R` : '—',            color: '#a78bfa' },
    { icon: Hash,       label: 'Top Instrument',      value: s?.mostTradedInstrument ?? '—',                    color: '#fbbf24' },
  ];

  return (
    <div className="glass-card p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Compass className="w-4 h-4 text-indigo-400" />
        <h3 className="text-sm font-black">Trading Improvement Center</h3>
        {!snapshot && (
          <span className="text-[10px] text-muted-foreground ml-1">· close a trade to populate</span>
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
                style={{ background: `${r.color}12`, color: r.color }}>
                <Icon className="w-3.5 h-3.5" />
              </span>
              <div className="min-w-0">
                <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-500 mb-0.5">{r.label}</div>
                <div className={`text-[12px] font-black truncate ${isEmpty ? 'text-slate-600' : ''}`} style={!isEmpty ? { color: r.color } : {}}>
                  {r.value}
                </div>
                {r.detail && <div className="text-[8px] text-slate-600 mt-0.5">{r.detail}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
