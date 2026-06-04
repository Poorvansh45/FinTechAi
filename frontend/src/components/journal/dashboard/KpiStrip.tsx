'use client';

import {
  TrendingUp, TrendingDown, Target, Award,
  Activity, BarChart2, ArrowUp, ArrowDown,
} from 'lucide-react';
import type { KpiBundle, KpiMetric } from '@/lib/api/journalApi';

interface Props {
  bundle: KpiBundle | null;
  loading?: boolean;
}

/* Tiny sparkline rendered as inline SVG — no dependencies */
function Spark({ data, color, height = 24, width = 56 }: { data: number[]; color: string; height?: number; width?: number }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} className="flex-shrink-0 opacity-60">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChangeArrow({ change }: { change: number | null }) {
  if (change === null) return null;
  const positive = change >= 0;
  return (
    <span className={`flex items-center gap-0.5 text-[9px] font-bold ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
      {positive ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
      {Math.abs(change).toFixed(1)}%
    </span>
  );
}

const ICONS: Record<string, React.ElementType> = {
  'Total P&L': TrendingUp,
  'Win Rate': Target,
  'Profit Factor': Award,
  'Expectancy': BarChart2,
  'Max Drawdown': TrendingDown,
  'Total Trades': Activity,
};

const COLORS: Record<string, string> = {
  'Total P&L': '#818cf8',
  'Win Rate': '#34d399',
  'Profit Factor': '#fbbf24',
  'Expectancy': '#60a5fa',
  'Max Drawdown': '#f87171',
  'Total Trades': '#a78bfa',
};

function KpiItem({ metric, loading }: { metric: KpiMetric | null; loading?: boolean }) {
  if (loading || !metric) {
    return (
      <div className="kpi-card px-3.5 py-3 flex flex-col gap-1.5">
        <div className="h-2 w-16 skeleton rounded" />
        <div className="h-5 w-20 skeleton rounded mt-1" />
        <div className="h-2 w-12 skeleton rounded" />
      </div>
    );
  }

  const Icon = ICONS[metric.label] ?? Activity;
  const color = COLORS[metric.label] ?? '#818cf8';
  const valueColor = metric.label === 'Max Drawdown'
    ? 'text-red-400'
    : metric.positive ? 'text-emerald-400' : 'text-amber-400';

  return (
    <div className="kpi-card px-3.5 py-3 flex flex-col gap-0.5 group relative overflow-hidden">
      {/* Top accent */}
      <div className="absolute inset-x-0 top-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: `linear-gradient(90deg, transparent, ${color}88, transparent)` }} />

      {/* Label row */}
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">{metric.label}</span>
        <Icon className="w-3 h-3" style={{ color }} />
      </div>

      {/* Value + sparkline row */}
      <div className="flex items-end justify-between gap-2 mt-0.5">
        <span className={`text-lg font-black tabular-nums leading-none ${valueColor}`}>
          {metric.formatted}
        </span>
        <Spark data={metric.sparkline} color={color} />
      </div>

      {/* Change indicator */}
      <div className="mt-1">
        {metric.change !== null ? (
          <ChangeArrow change={metric.change} />
        ) : (
          <span className="text-[9px] text-slate-600">vs previous</span>
        )}
      </div>
    </div>
  );
}

export function KpiStrip({ bundle, loading }: Props) {
  const keys: (keyof KpiBundle)[] = ['totalPnl', 'winRate', 'profitFactor', 'expectancy', 'maxDrawdown', 'totalTrades'];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5">
      {keys.map((k) => (
        <KpiItem key={k} metric={bundle?.[k] ?? null} loading={loading} />
      ))}
    </div>
  );
}
