'use client';

import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { LongShortBreakdown } from '@/lib/api/journalApi';

interface Props {
  data: LongShortBreakdown | null;
  loading?: boolean;
}

export function LongShortCard({ data, loading }: Props) {
  if (loading) return <div className="glass-card p-4 h-52 skeleton rounded-xl" />;

  if (!data) return (
    <div className="glass-card p-4 flex flex-col items-center justify-center gap-2 h-52">
      <ArrowUpRight className="w-6 h-6 text-neutral-500" />
      <p className="text-[11px] text-neutral-500">No closed trades yet</p>
    </div>
  );

  const chartData = [
    { name: 'Long',  value: data.longs,  fill: 'rgb(var(--positive-400))' },
    { name: 'Short', value: data.shorts, fill: 'rgb(var(--negative-400))' },
  ];

  return (
    <div className="glass-card p-4 flex flex-col">
      <h3 className="text-xs font-bold mb-3">Long vs Short</h3>
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
            <span className="text-lg font-bold tabular-nums">{data.total}</span>
            <span className="text-[11px] text-muted-foreground">Total</span>
          </div>
        </div>

        {/* Stats */}
        <div className="space-y-3 flex-1">
          <div className="flex items-center gap-2">
            <ArrowUpRight className="w-3.5 h-3.5 text-positive-400 flex-shrink-0" />
            <div className="flex-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-positive-400">{data.longs} Long</span>
                <span className="text-muted-foreground">({((data.longs / data.total) * 100).toFixed(0)}%)</span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">WR: {data.longWinRate}%</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ArrowDownRight className="w-3.5 h-3.5 text-negative-400 flex-shrink-0" />
            <div className="flex-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-negative-400">{data.shorts} Short</span>
                <span className="text-muted-foreground">({((data.shorts / data.total) * 100).toFixed(0)}%)</span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">WR: {data.shortWinRate}%</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
