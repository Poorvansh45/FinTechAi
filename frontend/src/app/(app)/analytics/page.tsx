'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  BarChart3, TrendingUp, TrendingDown, Target, Zap, AlertTriangle, Award,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, PieChart, Pie, Cell, BarChart, Bar, ReferenceLine,
} from 'recharts';
import { listSetups, listTradesBySetup, seedDemo, ensureTradeIdsUnique } from '@/lib/journal/storage';
import { derive, getTradeSession } from '@/lib/journal/types';
import type { Trade } from '@/lib/journal/types';
import { TerminalMetric } from '@/components/workspace/TerminalMetric';
import { LiveIndicator } from '@/components/workspace/LiveIndicator';
import { AIPerformanceSummary } from '@/components/workspace/analytics/AIPerformanceSummary';
import { BehaviorIntelligence } from '@/components/workspace/analytics/BehaviorIntelligence';

function computeAdvancedMetrics(trades: Trade[]) {
  const closed = trades.filter((t) => t.exitPrice != null);
  const pnls = closed.map((t) => derive(t).pnl ?? 0);
  if (!pnls.length) return { profitFactor: 0, expectancy: 0, maxDrawdown: 0, avgWin: 0, avgLoss: 0, sharpe: 0 };

  const wins = pnls.filter((p) => p > 0);
  const losses = pnls.filter((p) => p < 0);
  const grossProfit = wins.reduce((a, b) => a + b, 0);
  const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99 : 0;
  const winRate = pnls.length ? wins.length / pnls.length : 0;
  const avgWin = wins.length ? grossProfit / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;
  const expectancy = winRate * avgWin - (1 - winRate) * avgLoss;

  let peak = 0, equity = 0, maxDD = 0;
  for (const p of pnls) {
    equity += p;
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > maxDD) maxDD = dd;
  }

  const mean = pnls.reduce((a, b) => a + b, 0) / pnls.length;
  const std = Math.sqrt(pnls.map((p) => (p - mean) ** 2).reduce((a, b) => a + b, 0) / pnls.length);
  const sharpe = std > 0 ? mean / std : 0;

  return {
    profitFactor: parseFloat(profitFactor.toFixed(2)),
    expectancy: parseFloat(expectancy.toFixed(2)),
    maxDrawdown: parseFloat(maxDD.toFixed(2)),
    avgWin: parseFloat(avgWin.toFixed(2)),
    avgLoss: parseFloat(avgLoss.toFixed(2)),
    sharpe: parseFloat(sharpe.toFixed(2)),
  };
}

const DONUT_COLORS = ['#22c55e', '#ef4444', '#64748b'];

const CustomTip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card p-2 text-[10px]" style={{ border: '1px solid rgba(99,102,241,0.3)' }}>
      <div className="text-muted-foreground mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="tabular-nums font-bold" style={{ color: p.color }}>
          {p.name}: {p.value >= 0 ? '+' : ''}{p.value}
        </div>
      ))}
    </div>
  );
};

export default function AnalyticsPage() {
  const [trades, setTrades] = useState<Trade[]>([]);

  useEffect(() => {
    seedDemo();
    ensureTradeIdsUnique();
    const s = listSetups();
    setTrades(
      s.flatMap((x) => listTradesBySetup(x.id)).sort(
        (a, b) => new Date(a.entryAt).getTime() - new Date(b.entryAt).getTime()
      )
    );
  }, []);

  const setupNames = useMemo(() => {
    const s = listSetups();
    return (id: string) => s.find((x) => x.id === id)?.name ?? 'Unknown';
  }, [trades]);

  const closed = useMemo(() => trades.filter((t) => t.exitPrice != null), [trades]);
  const pnls = useMemo(() => closed.map((t) => derive(t).pnl ?? 0), [closed]);
  const wins = useMemo(() => pnls.filter((p) => p > 0), [pnls]);
  const totalPnl = useMemo(() => pnls.reduce((a, b) => a + b, 0), [pnls]);
  const winRate = useMemo(() => (pnls.length ? (wins.length / pnls.length) * 100 : 0), [pnls, wins]);
  const adv = useMemo(() => computeAdvancedMetrics(trades), [trades]);

  const equityCurve = useMemo(() => {
    let cum = 0;
    return closed.map((t, i) => {
      cum += derive(t).pnl ?? 0;
      return { name: `T${i + 1}`, equity: parseFloat(cum.toFixed(2)) };
    });
  }, [closed]);

  const winLoss = useMemo(() => {
    const loss = pnls.filter((p) => p < 0).length;
    const flat = pnls.filter((p) => p === 0).length;
    return [
      { name: 'Wins', value: wins.length },
      { name: 'Losses', value: loss },
      { name: 'BE', value: flat },
    ];
  }, [pnls, wins]);

  const setupPerf = useMemo(() => {
    const map: Record<string, number> = {};
    closed.forEach((t) => {
      const name = setupNames(t.setupId);
      map[name] = (map[name] ?? 0) + (derive(t).pnl ?? 0);
    });
    return Object.entries(map)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [closed, setupNames]);

  const sessionPerf = useMemo(() => {
    const map: Record<string, number> = {};
    closed.forEach((t) => {
      const sess = getTradeSession(t) ?? 'Unknown';
      map[sess] = (map[sess] ?? 0) + (derive(t).pnl ?? 0);
    });
    return Object.entries(map).map(([name, total]) => ({ name, total }));
  }, [closed]);

  const dayPerf = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const map: Record<string, number> = {};
    closed.forEach((t) => {
      const d = days[new Date(t.entryAt).getDay()];
      map[d] = (map[d] ?? 0) + (derive(t).pnl ?? 0);
    });
    return days.map((d) => ({ name: d, pnl: map[d] ?? 0 }));
  }, [closed]);

  const instrPerf = useMemo(() => {
    const map: Record<string, number> = {};
    closed.forEach((t) => {
      map[t.instrument] = (map[t.instrument] ?? 0) + (derive(t).pnl ?? 0);
    });
    return Object.entries(map)
      .map(([name, pnl]) => ({ name, pnl }))
      .sort((a, b) => b.pnl - a.pnl)
      .slice(0, 5);
  }, [closed]);

  const rrDist = useMemo(() => {
    const buckets = { '<1R': 0, '1-2R': 0, '2R+': 0 };
    closed.forEach((t) => {
      const rr = derive(t).rr ?? 0;
      if (rr < 1) buckets['<1R']++;
      else if (rr < 2) buckets['1-2R']++;
      else buckets['2R+']++;
    });
    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }, [closed]);

  const metrics = [
    { label: 'Total P&L', value: `${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}`, color: totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400', icon: TrendingUp, trend: totalPnl >= 0 ? 'up' as const : 'down' as const, tooltip: 'Sum of closed trade P&L' },
    { label: 'Win Rate', value: `${winRate.toFixed(1)}%`, color: winRate >= 50 ? 'text-emerald-400' : 'text-amber-400', icon: Target, tooltip: 'Winning trades / closed trades' },
    { label: 'Avg Win', value: `+${adv.avgWin.toFixed(2)}`, color: 'text-emerald-400', icon: TrendingUp },
    { label: 'Avg Loss', value: `-${adv.avgLoss.toFixed(2)}`, color: 'text-red-400', icon: TrendingDown },
    { label: 'Profit Factor', value: adv.profitFactor > 50 ? '∞' : String(adv.profitFactor), color: adv.profitFactor >= 1.5 ? 'text-emerald-400' : 'text-amber-400', icon: Award, tooltip: 'Gross profit / gross loss' },
    { label: 'Drawdown', value: `-${adv.maxDrawdown.toFixed(2)}`, color: 'text-red-400', icon: AlertTriangle },
    { label: 'Sharpe Ratio', value: String(adv.sharpe), color: adv.sharpe >= 1 ? 'text-emerald-400' : 'text-amber-400', icon: BarChart3 },
    { label: 'Expectancy', value: `${adv.expectancy >= 0 ? '+' : ''}${adv.expectancy}`, color: adv.expectancy >= 0 ? 'text-emerald-400' : 'text-red-400', icon: Zap },
  ];

  return (
    <div className="space-y-4 animate-fadeIn pb-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-400" />
            Performance Analytics
            <LiveIndicator />
          </h1>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {closed.length} closed · institutional density layout
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {metrics.map((m) => (
          <TerminalMetric
            key={m.label}
            label={m.label}
            value={m.value}
            color={m.color}
            icon={m.icon}
            tooltip={m.tooltip}
            trend={m.trend}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[65fr_35fr] gap-3">
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold mb-1">Equity Curve</h3>
          <p className="text-[10px] text-muted-foreground mb-2">Cumulative growth per trade</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={equityCurve} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="eqGrad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="name" tick={{ fontSize: 8, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 8, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTip />} />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />
                <Area type="monotone" dataKey="equity" stroke="#818cf8" strokeWidth={2} fill="url(#eqGrad2)" dot={false} activeDot={{ r: 5, fill: '#a5b4fc', stroke: '#6366f1', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <AIPerformanceSummary trades={trades} setupName={setupNames} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        <div className="glass-card p-3 col-span-1">
          <h4 className="text-[10px] font-bold uppercase text-slate-500 mb-2">Win/Loss</h4>
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={winLoss} dataKey="value" innerRadius={22} outerRadius={36} paddingAngle={2}>
                  {winLoss.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % 3]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="glass-card p-3 col-span-1 md:col-span-2">
          <h4 className="text-[10px] font-bold uppercase text-slate-500 mb-2">Setup Performance</h4>
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={setupPerf} margin={{ left: -28, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 7, fill: '#64748b' }} interval={0} angle={-25} textAnchor="end" height={40} />
                <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                  {setupPerf.map((e, i) => <Cell key={i} fill={e.total >= 0 ? '#6366f1' : '#ef4444'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="glass-card p-3 col-span-1">
          <h4 className="text-[10px] font-bold uppercase text-slate-500 mb-2">Sessions</h4>
          <div className="space-y-1.5 mt-1">
            {sessionPerf.map((s) => (
              <div key={s.name} className="flex justify-between text-[10px]">
                <span className="text-muted-foreground">{s.name}</span>
                <span className={`font-bold tabular-nums ${s.total >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {s.total >= 0 ? '+' : ''}{s.total.toFixed(0)}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="glass-card p-3 col-span-1">
          <h4 className="text-[10px] font-bold uppercase text-slate-500 mb-2">By Day</h4>
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dayPerf} margin={{ left: -28 }}>
                <XAxis dataKey="name" tick={{ fontSize: 7, fill: '#64748b' }} />
                <Bar dataKey="pnl" radius={[2, 2, 0, 0]}>
                  {dayPerf.map((e, i) => <Cell key={i} fill={e.pnl >= 0 ? '#22c55e' : '#ef4444'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="glass-card p-3 col-span-1">
          <h4 className="text-[10px] font-bold uppercase text-slate-500 mb-2">Instruments</h4>
          <div className="space-y-1 mt-1">
            {instrPerf.map((x) => (
              <div key={x.name} className="flex justify-between text-[9px]">
                <span className="truncate text-muted-foreground max-w-[60px]">{x.name}</span>
                <span className={x.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>{x.pnl >= 0 ? '+' : ''}{x.pnl.toFixed(0)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="glass-card p-3 col-span-1">
          <h4 className="text-[10px] font-bold uppercase text-slate-500 mb-2">RR Distribution</h4>
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rrDist} margin={{ left: -28 }}>
                <XAxis dataKey="name" tick={{ fontSize: 8, fill: '#64748b' }} />
                <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <BehaviorIntelligence trades={trades} setupName={setupNames} />
    </div>
  );
}
