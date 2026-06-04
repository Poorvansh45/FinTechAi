'use client';

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
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
        {isNull ? (
          <span className="flex items-center gap-1 text-[9px] text-slate-600">
            <Lock className="w-2.5 h-2.5" /> Needs data
          </span>
        ) : (
          <span className="text-[12px] font-black tabular-nums" style={{ color }}>{value}/100</span>
        )}
      </div>
      <div
        className="h-2 rounded-full overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.06)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: isNull ? '0%' : `${pct}%`,
            background: isNull
              ? 'rgba(100,116,139,0.3)'
              : `linear-gradient(90deg, ${bgColor}, ${color})`,
            boxShadow: isNull ? 'none' : `0 0 8px ${color}55`,
          }}
        />
      </div>
    </div>
  );
}

const SCORE_DIMENSIONS: { key: keyof TraderScore; label: string; color: string; bg: string }[] = [
  { key: 'execution',      label: 'Execution',       color: '#818cf8', bg: '#4f46e5' },
  { key: 'riskManagement', label: 'Risk Management', color: '#34d399', bg: '#059669' },
  { key: 'consistency',    label: 'Consistency',      color: '#fbbf24', bg: '#d97706' },
  { key: 'discipline',     label: 'Discipline',       color: '#f472b6', bg: '#db2777' },
];

function ScoreRing({ value }: { value: number | null }) {
  const pct = value ?? 0;
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (pct / 100) * circumference;
  const color = !value ? '#334155' : value >= 70 ? '#22c55e' : value >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative w-28 h-28 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        {/* Track */}
        <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
        {/* Progress */}
        <circle
          cx="50" cy="50" r="42" fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s ease, stroke 0.5s ease', filter: `drop-shadow(0 0 6px ${color}88)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {value === null ? (
          <>
            <Lock className="w-5 h-5 text-slate-600" />
            <span className="text-[9px] text-slate-600 mt-1">Not ready</span>
          </>
        ) : (
          <>
            <span className="text-2xl font-black tabular-nums" style={{ color }}>{value}</span>
            <span className="text-[9px] text-muted-foreground">/ 100</span>
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
      style={{ border: '1px solid rgba(99,102,241,0.15)' }}
    >
      {/* Premium ambient glow */}
      <div
        className="pointer-events-none absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-20 blur-3xl"
        style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)' }}
      />

      {/* Section header */}
      <div className="flex items-center gap-2 mb-4">
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)' }}
        >
          <Brain className="w-3.5 h-3.5 text-indigo-400" />
        </div>
        <span className="text-xs font-black">Trader Score</span>
        <span
          className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full flex items-center gap-1"
          style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8' }}
        >
          <Sparkles className="w-2.5 h-2.5" /> AI
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground">
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
        <p className="text-[10px] text-muted-foreground mt-3 leading-relaxed">
          The Trader Score will be computed after you log at least{' '}
          <strong className="text-slate-400">3 closed trades</strong>.
          Dimensions include execution quality, risk management, consistency, and discipline.
        </p>
      )}
    </div>
  );
}
