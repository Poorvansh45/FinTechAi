'use client';

import { Trophy, XCircle, Clock, TrendingUp, Hash, Flame, Zap } from 'lucide-react';
import type { PerformanceSnapshot } from '@/lib/api/journalApi';

interface Props {
  snapshot: PerformanceSnapshot | null;
  loading?: boolean;
}

function formatHoldTime(minutes: number | null): string {
  if (minutes === null) return '—';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

interface StatChipProps {
  icon: React.ElementType;
  label: string;
  value: string;
  color?: string;
  accentColor?: string;
  loading?: boolean;
}

function StatChip({ icon: Icon, label, value, color = '#818cf8', accentColor, loading }: StatChipProps) {
  return (
    <div
      className="flex items-center gap-2.5 px-3.5 py-3 rounded-2xl transition-all hover:-translate-y-0.5"
      style={{
        background: `${accentColor ?? color}0d`,
        border: `1px solid ${accentColor ?? color}22`,
      }}
    >
      <span
        className="flex items-center justify-center w-7 h-7 rounded-xl flex-shrink-0"
        style={{ background: `${color}1a`, color }}
      >
        <Icon className="w-3.5 h-3.5" />
      </span>
      <div className="min-w-0">
        <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-0.5">{label}</div>
        {loading ? (
          <div className="h-4 w-20 skeleton rounded" />
        ) : (
          <div className="text-[12px] font-black truncate" style={{ color }}>
            {value}
          </div>
        )}
      </div>
    </div>
  );
}

export function PerformanceSnapshotRow({ snapshot, loading }: Props) {
  const s = snapshot;

  const streakVal = s
    ? s.currentStreak === 0
      ? 'Neutral'
      : s.currentStreak > 0
      ? `${s.currentStreak}W Streak`
      : `${Math.abs(s.currentStreak)}L Streak`
    : '—';

  const streakColor = !s
    ? '#64748b'
    : s.currentStreak > 0
    ? '#22c55e'
    : s.currentStreak < 0
    ? '#ef4444'
    : '#64748b';

  const chips: StatChipProps[] = [
    { icon: Trophy,     label: 'Best Setup',        value: s?.bestSetup ?? '—',             color: '#22c55e' },
    { icon: XCircle,    label: 'Worst Setup',        value: s?.worstSetup ?? '—',            color: '#ef4444' },
    { icon: Zap,        label: 'Best Session',       value: s?.bestSession ?? '—',           color: '#a78bfa' },
    { icon: Zap,        label: 'Worst Session',      value: s?.worstSession ?? '—',          color: '#fb923c' },
    { icon: Clock,      label: 'Avg Hold Time',      value: formatHoldTime(s?.avgHoldMinutes ?? null), color: '#38bdf8' },
    { icon: TrendingUp, label: 'Avg RR',             value: s?.avgRR != null ? `${s.avgRR}R` : '—', color: '#a78bfa' },
    { icon: Hash,       label: 'Top Instrument',     value: s?.mostTradedInstrument ?? '—', color: '#fbbf24' },
    { icon: Flame,      label: 'Current Streak',     value: streakVal,                       color: streakColor },
  ];

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-5 h-5 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(99,102,241,0.1)' }}
        >
          <TrendingUp className="w-3 h-3 text-indigo-400" />
        </div>
        <span className="text-xs font-black">Performance Snapshot</span>
        {!snapshot && !loading && (
          <span className="text-[10px] text-muted-foreground ml-1">
            · close a trade to populate
          </span>
        )}
      </div>

      {loading && !snapshot ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 skeleton rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {chips.map((chip) => (
            <StatChip key={chip.label} {...chip} loading={loading} />
          ))}
        </div>
      )}
    </div>
  );
}
