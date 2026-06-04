'use client';

import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { LongShortBreakdown } from '@/lib/api/journalApi';

interface Props {
  data: LongShortBreakdown | null;
  loading?: boolean;
}

export function LongShortCard({ data, loading }: Props) {
  if (loading) return <div className="glass-card p-4 h-52 skeleton rounded-2xl" />;

  if (!data) return (
    <div className="glass-card p-4 flex flex-col items-center justify-center gap-2 h-52">
      <ArrowUpRight className="w-6 h-6 text-slate-600" />
      <p className="text-[11px] text-slate-500">No closed trades yet</p>
    </div>
  );

  const chartData = [
    { name: 'Long',  value: data.longs,  fill: '#22c55e' },
    { name: 'Short', value: data.shorts, fill: '#f87171' },
  ];

  return (
    <div className="glass-card p-4 flex flex-col">
      <h3 className="text-xs font-black mb-3">Long vs Short</h3>
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

        {/* Stats */}
        <div className="space-y-3 flex-1">
          <div className="flex items-center gap-2">
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <div className="flex-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-emerald-400">{data.longs} Long</span>
                <span className="text-muted-foreground">({((data.longs / data.total) * 100).toFixed(0)}%)</span>
              </div>
              <div className="text-[9px] text-muted-foreground mt-0.5">WR: {data.longWinRate}%</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ArrowDownRight className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
            <div className="flex-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-red-400">{data.shorts} Short</span>
                <span className="text-muted-foreground">({((data.shorts / data.total) * 100).toFixed(0)}%)</span>
              </div>
              <div className="text-[9px] text-muted-foreground mt-0.5">WR: {data.shortWinRate}%</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
