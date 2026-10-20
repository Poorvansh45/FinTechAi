'use client';

import { withAlpha } from '@/lib/utils';
import { Brain, Sparkles, Lock } from 'lucide-react';
import type { TraderScore } from '@/lib/api/journalApi';

interface Props {
  score: TraderScore;
  loading?: boolean;
}

interface DimensionBarProps {
  label: string;
  value: number | null;
  color: string;
  bgColor: string;
}

function DimensionBar({ label, value, color, bgColor }: DimensionBarProps) {
  const pct = value ?? 0;
  const isNull = value === null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-muted-foreground">{label}</span>
        {isNull ? (
          <span className="flex items-center gap-1 text-[11px] text-neutral-500">
            <Lock className="w-2.5 h-2.5" /> Needs data
          </span>
        ) : (
          <span className="text-[12px] font-bold tabular-nums" style={{ color }}>{value}/100</span>
        )}
      </div>
      <div
        className="h-2 rounded-full overflow-hidden"
        style={{ background: 'rgb(var(--foreground) / 0.06)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: isNull ? '0%' : `${pct}%`,
            background: isNull
              ? 'rgb(var(--neutral-500) / 0.3)'
              : `linear-gradient(90deg, ${bgColor}, ${color})`,
            boxShadow: isNull ? 'none' : `0 0 8px ${withAlpha(color, 0.33)}`,
          }}
        />
      </div>
    </div>
  );
}

const SCORE_DIMENSIONS: { key: keyof TraderScore; label: string; color: string; bg: string }[] = [
  { key: 'execution',      label: 'Execution',       color: 'rgb(var(--brand-400))', bg: 'rgb(var(--brand-600))' },
  { key: 'riskManagement', label: 'Risk Management', color: 'rgb(var(--positive-400))', bg: 'rgb(var(--positive-600))' },
  { key: 'consistency',    label: 'Consistency',      color: 'rgb(var(--warning-400))', bg: 'rgb(var(--warning-600))' },
  { key: 'discipline',     label: 'Discipline',       color: 'rgb(var(--brand-400))', bg: 'rgb(var(--brand-600))' },
];

function ScoreRing({ value }: { value: number | null }) {
  const pct = value ?? 0;
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (pct / 100) * circumference;
  const color = !value ? 'rgb(var(--neutral-700))' : value >= 70 ? 'rgb(var(--positive-400))' : value >= 50 ? 'rgb(var(--warning-400))' : 'rgb(var(--negative-400))';

  return (
    <div className="relative w-28 h-28 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        {/* Track */}
        <circle cx="50" cy="50" r="42" fill="none" stroke="rgb(var(--foreground) / 0.06)" strokeWidth="8" />
        {/* Progress */}
        <circle
          cx="50" cy="50" r="42" fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s ease, stroke 0.5s ease', filter: `drop-shadow(0 0 6px ${withAlpha(color, 0.53)})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {value === null ? (
          <>
            <Lock className="w-5 h-5 text-neutral-500" />
            <span className="text-[11px] text-neutral-500 mt-1">Not ready</span>
          </>
        ) : (
          <>
            <span className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</span>
            <span className="text-[11px] text-muted-foreground">/ 100</span>
          </>
        )}
      </div>
    </div>
  );
}

export function TraderScoreCard({ score, loading }: Props) {
  const scoreLabel =
    score.overall === null ? 'Needs data'
    : score.overall >= 80 ? 'Elite'
    : score.overall >= 65 ? 'Proficient'
    : score.overall >= 50 ? 'Developing'
    : 'Beginner';

  return (
    <div
      className="glass-card p-4 relative overflow-hidden"
      style={{ border: '1px solid rgb(var(--brand-500) / 0.15)' }}
    >
      {/* Premium ambient glow */}

      {/* Section header */}
      <div className="flex items-center gap-2 mb-4">
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center"
          style={{ background: 'rgb(var(--brand-500) / 0.15)', border: '1px solid rgb(var(--brand-500) / 0.25)' }}
        >
          <Brain className="w-3.5 h-3.5 text-brand-400" />
        </div>
        <span className="text-xs font-bold">Trader Score</span>
        <span
          className="text-[11px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1"
          style={{ background: 'rgb(var(--brand-500) / 0.12)', color: 'rgb(var(--brand-400))' }}
        >
          <Sparkles className="w-2.5 h-2.5" /> AI
        </span>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {score.overall === null ? 'Log 3+ trades to unlock' : scoreLabel}
        </span>
      </div>

      {loading ? (
        <div className="flex gap-6">
          <div className="w-28 h-28 rounded-full skeleton flex-shrink-0" />
          <div className="flex-1 space-y-3 pt-2">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-6 skeleton rounded-lg" />)}
          </div>
        </div>
      ) : (
        <div className="flex gap-5 items-center">
          {/* Ring */}
          <ScoreRing value={score.overall} />

          {/* Dimension bars */}
          <div className="flex-1 space-y-3">
            {SCORE_DIMENSIONS.map((d) => (
              <DimensionBar
                key={d.key}
                label={d.label}
                value={score[d.key]}
                color={d.color}
                bgColor={d.bg}
              />
            ))}
          </div>
        </div>
      )}

      {score.overall === null && !loading && (
        <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
          The Trader Score will be computed after you log at least{' '}
          <strong className="text-neutral-400">3 closed trades</strong>.
          Dimensions include execution quality, risk management, consistency, and discipline.
        </p>
      )}
    </div>
  );
}
