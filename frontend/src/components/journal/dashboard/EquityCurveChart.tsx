'use client';

import { useState } from 'react';
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
} from 'recharts';
import { TrendingUp, BarChart2 } from 'lucide-react';
import type { PerformancePoint } from '@/lib/api/journalApi';

const PERIODS = ['1W', '1M', '3M', '6M', '1Y', 'ALL'] as const;
type Period = (typeof PERIODS)[number];

interface Props {
  data: PerformancePoint[];
  activePeriod: Period;
  onPeriodChange: (p: Period) => void;
  loading?: boolean;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const val: number = payload[0].value;
  return (
    <div className="glass-card px-3 py-2 text-[11px]"
      style={{ border: '1px solid rgba(99,102,241,0.3)' }}>
      <div className="text-muted-foreground mb-0.5">{label}</div>
      <div className={`font-bold tabular-nums ${val >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
        {val >= 0 ? '+' : ''}{val.toFixed(2)}
      </div>
    </div>
  );
};

export function EquityCurveChart({ data, activePeriod, onPeriodChange, loading }: Props) {
  const isEmpty = !loading && data.length === 0;
  const finalEquity = data.length ? data[data.length - 1].equity : 0;
  const isPositive = finalEquity >= 0;

  return (
    <div className="glass-card p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-xs font-bold">Equity Curve</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Cumulative P&amp;L per closed trade</p>
        </div>

        {/* Period tabs */}
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => onPeriodChange(p)}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                activePeriod === p
                  ? 'text-white'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
              style={activePeriod === p
                ? { background: 'rgba(99,102,241,0.35)', boxShadow: '0 0 8px rgba(99,102,241,0.2)' }
                : {}}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Chart area */}
      <div className="h-[160px]">
        {loading ? (
          <div className="h-full rounded-xl skeleton" />
        ) : isEmpty ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 py-6">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}>
              <BarChart2 className="w-5 h-5 text-indigo-400" />
            </div>
            <p className="text-xs font-medium text-slate-500 text-center">
              No journal performance data available yet.
            </p>
            <p className="text-[10px] text-muted-foreground text-center max-w-[200px]">
              Close your first trade to generate the equity curve.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="eqGradJournal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={isPositive ? '#6366f1' : '#ef4444'} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={isPositive ? '#6366f1' : '#ef4444'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 8, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 8, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.12)" />
              <Area
                type="monotone"
                dataKey="equity"
                stroke={isPositive ? '#818cf8' : '#f87171'}
                strokeWidth={2}
                fill="url(#eqGradJournal)"
                dot={false}
                activeDot={{ r: 4, fill: isPositive ? '#a5b4fc' : '#fca5a5', stroke: isPositive ? '#6366f1' : '#ef4444', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
