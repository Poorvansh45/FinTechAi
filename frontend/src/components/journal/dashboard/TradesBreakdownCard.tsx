'use client';

import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { PieChart as PieIcon } from 'lucide-react';
import type { TradesBreakdown } from '@/lib/api/journalApi';

interface Props {
  data: TradesBreakdown | null;
  loading?: boolean;
}

export function TradesBreakdownCard({ data, loading }: Props) {
  if (loading) return <div className="glass-card p-4 h-52 skeleton rounded-2xl" />;

  if (!data) return (
    <div className="glass-card p-4 flex flex-col items-center justify-center gap-2 h-52">
      <PieIcon className="w-6 h-6 text-slate-600" />
      <p className="text-[11px] text-slate-500">No closed trades yet</p>
    </div>
  );

  const chartData = [
    { name: 'Wins',   value: data.wins,      fill: '#22c55e' },
    { name: 'Losses', value: data.losses,     fill: '#ef4444' },
    ...(data.breakeven > 0 ? [{ name: 'BE', value: data.breakeven, fill: '#64748b' }] : []),
  ];

  return (
    <div className="glass-card p-4 flex flex-col">
      <h3 className="text-xs font-black mb-3">Trades Breakdown</h3>
      <div className="flex items-center gap-4 flex-1">
        {/* Donut */}
        <div className="relative w-24 h-24 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={chartData} dataKey="value" innerRadius="52%" outerRadius="80%" paddingAngle={3} stroke="none">
                {chartData.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-black tabular-nums">{data.total}</span>
            <span className="text-[8px] text-muted-foreground">Total</span>
          </div>
        </div>

        {/* Legend */}
        <div className="space-y-2 flex-1">
          {[
            { label: 'Wins',   v: data.wins,      pct: data.winRate,  color: '#22c55e' },
            { label: 'Losses', v: data.losses,     pct: data.lossRate, color: '#ef4444' },
            { label: 'BE',     v: data.breakeven,  pct: data.beRate,   color: '#64748b' },
          ].map(r => (
            <div key={r.label} className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: r.color }} />
                {r.label}
              </span>
              <span className="text-[11px] font-bold tabular-nums">
                <span style={{ color: r.color }}>{r.v}</span>
                <span className="text-slate-500 font-normal ml-1">({r.pct}%)</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
