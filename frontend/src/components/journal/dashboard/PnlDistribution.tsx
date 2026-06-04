'use client';

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { PieChart as PieIcon } from 'lucide-react';

interface Props {
  wins: number;
  losses: number;
  breakeven: number;
  loading?: boolean;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card px-3 py-2 text-[11px]"
      style={{ border: '1px solid rgba(99,102,241,0.25)' }}>
      <span className="font-bold" style={{ color: payload[0].payload.fill }}>
        {payload[0].name}: {payload[0].value}
      </span>
    </div>
  );
};

export function PnlDistribution({ wins, losses, breakeven, loading }: Props) {
  const total = wins + losses + breakeven;
  const isEmpty = !loading && total === 0;

  const data = [
    { name: 'Wins',     value: wins,     fill: '#22c55e' },
    { name: 'Losses',   value: losses,   fill: '#ef4444' },
    ...(breakeven > 0 ? [{ name: 'BE', value: breakeven, fill: '#64748b' }] : []),
  ];

  const winPct  = total > 0 ? ((wins / total) * 100).toFixed(0) : '0';
  const lossPct = total > 0 ? ((losses / total) * 100).toFixed(0) : '0';

  return (
    <div className="glass-card p-4">
      {/* Compact horizontal layout */}
      <div className="flex items-center gap-4">
        {/* Header + legend stacked left */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-2">
            <PieIcon className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
            <span className="text-xs font-bold">P&amp;L Distribution</span>
          </div>

          {loading ? (
            <div className="space-y-1.5">
              {[1,2].map(i => <div key={i} className="h-5 skeleton rounded" />)}
            </div>
          ) : isEmpty ? (
            <p className="text-[11px] text-slate-500">No closed trades yet.</p>
          ) : (
            <div className="space-y-1.5">
              {[
                { label: 'Wins',    value: wins,      pct: winPct,  color: '#22c55e' },
                { label: 'Losses',  value: losses,    pct: lossPct, color: '#ef4444' },
                ...(breakeven > 0 ? [{ label: 'BE', value: breakeven, pct: '—', color: '#64748b' }] : []),
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: row.color }} />
                    {row.label}
                  </span>
                  <span className="font-black tabular-nums" style={{ color: row.color }}>
                    {row.value}
                    <span className="text-slate-500 font-normal text-[10px] ml-1">({row.pct}%)</span>
                  </span>
                </div>
              ))}
              {/* Bar */}
              <div className="mt-2 h-1.5 rounded-full overflow-hidden flex gap-0.5" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div className="h-full rounded-full" style={{ width: `${winPct}%`, background: '#22c55e' }} />
                <div className="h-full rounded-full" style={{ width: `${lossPct}%`, background: '#ef4444' }} />
              </div>
            </div>
          )}
        </div>

        {/* Compact donut */}
        <div className="w-24 h-24 flex-shrink-0 relative">
          {loading ? (
            <div className="w-full h-full rounded-full skeleton" />
          ) : isEmpty ? (
            <div className="w-full h-full rounded-full flex items-center justify-center"
              style={{ border: '3px solid rgba(255,255,255,0.06)' }}>
              <PieIcon className="w-6 h-6 text-slate-700" />
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data} dataKey="value" innerRadius="52%" outerRadius="80%" paddingAngle={3} stroke="none">
                    {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-sm font-black tabular-nums text-emerald-400">{winPct}%</div>
                  <div className="text-[8px] text-muted-foreground">WR</div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
