'use client';

import { withAlpha } from '@/lib/utils';
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
    <span className={`flex items-center gap-0.5 text-[11px] font-bold ${positive ? 'text-positive-400' : 'text-negative-400'}`}>
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
  'Total P&L': 'rgb(var(--brand-400))',
  'Win Rate': 'rgb(var(--positive-400))',
  'Profit Factor': 'rgb(var(--warning-400))',
  'Expectancy': 'rgb(var(--brand-400))',
  'Max Drawdown': 'rgb(var(--negative-400))',
  'Total Trades': 'rgb(var(--brand-400))',
};

function KpiItem({ metric, loading, size = 'md' }: { metric: KpiMetric | null; loading?: boolean; size?: 'lg' | 'md' }) {
  const lg = size === 'lg';
  const pad = lg ? 'px-7 py-6' : 'px-5 py-5';

  if (loading || !metric) {
    return (
      <div className={`kpi-card ${pad} flex flex-col gap-2`}>
        <div className="h-2 w-16 skeleton rounded" />
        <div className={`${lg ? 'h-9 w-32' : 'h-6 w-20'} skeleton rounded mt-1`} />
        <div className="h-2 w-12 skeleton rounded" />
      </div>
    );
  }

  const Icon = ICONS[metric.label] ?? Activity;
  const color = COLORS[metric.label] ?? 'rgb(var(--brand-400))';
  const valueColor = metric.label === 'Max Drawdown'
    ? 'text-negative-400'
    : metric.positive ? 'text-positive-400' : 'text-warning-400';

  return (
    <div className={`kpi-card ${pad} flex flex-col group relative overflow-hidden`}>
      {/* Top accent */}
      <div className="absolute inset-x-0 top-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: `linear-gradient(90deg, transparent, ${withAlpha(color, 0.53)}, transparent)` }} />

      {/* Label row */}
      <div className="flex items-center justify-between gap-2">
        <span className={`font-bold text-neutral-500 ${lg ? 'text-[11px]' : 'text-[11px]'}`}>
          {metric.label}
        </span>
        <span
          className={`flex items-center justify-center rounded-lg ${lg ? 'w-7 h-7' : 'w-6 h-6'}`}
          style={{ background: `${withAlpha(color, 0.08)}`, color }}
        >
          <Icon className={lg ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
        </span>
      </div>

      {/* Value + sparkline row */}
      <div className={`flex flex-wrap items-end justify-between gap-x-3 gap-y-2 ${lg ? 'mt-5' : 'mt-3'}`}>
        <span className={`min-w-0 font-bold tabular-nums leading-none ${valueColor} ${lg ? 'text-3xl xl:text-4xl' : 'text-2xl'}`}>
          {metric.formatted}
        </span>
        <Spark
          data={metric.sparkline}
          color={color}
          height={lg ? 40 : 28}
          width={lg ? 108 : 64}
        />
      </div>

      {/* Change indicator */}
      <div className={lg ? 'mt-3.5' : 'mt-2.5'}>
        {metric.change !== null ? (
          <ChangeArrow change={metric.change} />
        ) : (
          <span className="text-[11px] text-neutral-500">vs previous</span>
        )}
      </div>
    </div>
  );
}

/**
 * Two headline metrics over four supporting ones, rather than six identical
 * tiles. P&L and win rate are what the page is actually about; giving all six
 * equal weight made the reader scan every card to find them.
 */
export function KpiStrip({ bundle, loading }: Props) {
  const headline: (keyof KpiBundle)[] = ['totalPnl', 'winRate'];
  const secondary: (keyof KpiBundle)[] = ['expectancy', 'profitFactor', 'maxDrawdown', 'totalTrades'];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {headline.map((k) => (
          <KpiItem key={k} metric={bundle?.[k] ?? null} loading={loading} size="lg" />
        ))}
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
        {secondary.map((k) => (
          <KpiItem key={k} metric={bundle?.[k] ?? null} loading={loading} size="md" />
        ))}
      </div>
    </div>
  );
}
