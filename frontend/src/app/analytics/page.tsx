"use client";

import { useEffect, useState, useMemo } from "react";
import { BarChart3, TrendingUp, TrendingDown, Target, Zap, AlertTriangle, Award } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, PieChart, Pie, Cell, BarChart, Bar, Legend, ReferenceLine,
} from "recharts";
import { listSetups, listTradesBySetup, seedDemo, ensureTradeIdsUnique } from "@/lib/journal/storage";
import { derive } from "@/lib/journal/types";
import type { Trade } from "@/lib/journal/types";

type Range = "weekly" | "monthly" | "all";

function groupKey(iso: string, range: Range) {
  const d = new Date(iso);
  if (range === "monthly") return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  if (range === "weekly") {
    const day = (d.getDay() + 6) % 7;
    const tgt = new Date(d); tgt.setDate(d.getDate() - day + 3);
    const jan4 = new Date(tgt.getFullYear(), 0, 4);
    const w = 1 + Math.floor((tgt.getTime() - jan4.getTime()) / 86400000 / 7);
    return `${tgt.getFullYear()}-W${String(w).padStart(2, "0")}`;
  }
  return "All";
}

const DONUT_COLORS = ["#22c55e", "#ef4444", "#64748b"];

function computeAdvancedMetrics(trades: Trade[]) {
  const closed = trades.filter(t => t.exitPrice != null);
  const pnls = closed.map(t => derive(t).pnl ?? 0);
  if (!pnls.length) return { profitFactor: 0, expectancy: 0, maxDrawdown: 0, avgWin: 0, avgLoss: 0, sharpe: 0 };

  const wins = pnls.filter(p => p > 0);
  const losses = pnls.filter(p => p < 0);
  const grossProfit = wins.reduce((a, b) => a + b, 0);
  const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99 : 0;

  const winRate = pnls.length ? wins.length / pnls.length : 0;
  const avgWin = wins.length ? grossProfit / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;
  const expectancy = winRate * avgWin - (1 - winRate) * avgLoss;

  // Max drawdown from equity curve
  let peak = 0, equity = 0, maxDD = 0;
  for (const p of pnls) {
    equity += p;
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > maxDD) maxDD = dd;
  }

  // Simplified Sharpe (mean/std of pnls)
  const mean = pnls.reduce((a, b) => a + b, 0) / pnls.length;
  const std = Math.sqrt(pnls.map(p => (p - mean) ** 2).reduce((a, b) => a + b, 0) / pnls.length);
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

const CustomTip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card p-3 text-xs" style={{ border: "1px solid rgba(99,102,241,0.3)", minWidth: 120 }}>
      <div className="text-muted-foreground mb-1 font-medium">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="tabular-nums flex justify-between gap-4" style={{ color: p.color }}>
          <span>{p.name}</span>
          <span className="font-bold">{p.value >= 0 ? "+" : ""}{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function AnalyticsPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [range, setRange] = useState<Range>("monthly");

  useEffect(() => {
    seedDemo(); ensureTradeIdsUnique();
    const s = listSetups();
    setTrades(s.flatMap(x => listTradesBySetup(x.id)).sort((a, b) => new Date(a.entryAt).getTime() - new Date(b.entryAt).getTime()));
  }, []);

  const setupNames = useMemo(() => {
    const s = listSetups();
    return (id: string) => s.find(x => x.id === id)?.name ?? "Unknown";
  }, [trades]);

  const closed = useMemo(() => trades.filter(t => t.exitPrice != null), [trades]);
  const pnls = useMemo(() => closed.map(t => derive(t).pnl ?? 0), [closed]);
  const wins = useMemo(() => pnls.filter(p => p > 0), [pnls]);
  const totalPnl = useMemo(() => pnls.reduce((a, b) => a + b, 0), [pnls]);
  const winRate = useMemo(() => pnls.length ? wins.length / pnls.length * 100 : 0, [pnls, wins]);

  const adv = useMemo(() => computeAdvancedMetrics(trades), [trades]);

  const winLoss = useMemo(() => {
    const loss = pnls.filter(p => p < 0).length;
    const flat = pnls.filter(p => p === 0).length;
    return [{ name: "Wins", value: wins.length }, { name: "Losses", value: loss }, { name: "Breakeven", value: flat }];
  }, [pnls, wins]);

  const trend = useMemo(() => {
    const acc: Record<string, number> = {};
    let cum = 0;
    trades.forEach(t => {
      if (!t.exitPrice) return;
      const k = groupKey(t.entryAt, range);
      acc[k] = (acc[k] ?? 0) + (derive(t).pnl ?? 0);
    });
    return Object.entries(acc).sort(([a], [b]) => a > b ? 1 : -1).map(([name, value]) => {
      cum += value;
      return { name, pnl: parseFloat(value.toFixed(2)), cumulative: parseFloat(cum.toFixed(2)) };
    });
  }, [trades, range]);

  const equityCurve = useMemo(() => {
    let cum = 0;
    return closed.map((t, i) => {
      cum += derive(t).pnl ?? 0;
      return { name: `T${i + 1}`, equity: parseFloat(cum.toFixed(2)), drawdown: 0 };
    });
  }, [closed]);

  const setupPerf = useMemo(() => {
    const map: Record<string, { sum: number; n: number; wins: number }> = {};
    trades.forEach(t => {
      if (!t.exitPrice) return;
      const name = setupNames(t.setupId);
      if (!map[name]) map[name] = { sum: 0, n: 0, wins: 0 };
      const p = derive(t).pnl ?? 0;
      map[name].sum += p; map[name].n++;
      if (p > 0) map[name].wins++;
    });
    return Object.entries(map).map(([name, v]) => ({
      name,
      avgPnl: v.n ? +(v.sum / v.n).toFixed(2) : 0,
      winRate: v.n ? +(v.wins / v.n * 100).toFixed(1) : 0,
      trades: v.n,
    })).sort((a, b) => b.avgPnl - a.avgPnl);
  }, [trades, setupNames]);

  const sessionPerf = useMemo(() => {
    const map: Record<string, { sum: number; n: number; wins: number }> = {};
    trades.forEach(t => {
      if (!t.exitPrice) return;
      const h = (new Date(t.entryAt).getUTCHours() + 5.5) % 24;
      const sess = h < 8.5 ? "Asian" : h < 17.5 ? "London" : "NY";
      if (!map[sess]) map[sess] = { sum: 0, n: 0, wins: 0 };
      const p = derive(t).pnl ?? 0;
      map[sess].sum += p; map[sess].n++;
      if (p > 0) map[sess].wins++;
    });
    return Object.entries(map).map(([name, v]) => ({
      name,
      avgPnl: v.n ? +(v.sum / v.n).toFixed(2) : 0,
      winRate: v.n ? +(v.wins / v.n * 100).toFixed(1) : 0,
      trades: v.n,
    }));
  }, [trades]);

  const KPI_ROWS = [
    [
      { label: "Total P&L",     val: `${totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}`, col: totalPnl >= 0 ? "#22c55e" : "#ef4444", icon: TrendingUp },
      { label: "Win Rate",      val: `${winRate.toFixed(1)}%`,      col: winRate >= 50 ? "#22c55e" : "#f59e0b", icon: Target },
      { label: "Profit Factor", val: adv.profitFactor > 50 ? "∞" : String(adv.profitFactor), col: adv.profitFactor >= 1.5 ? "#22c55e" : "#f59e0b", icon: Award },
      { label: "Expectancy",    val: `${adv.expectancy >= 0 ? "+" : ""}${adv.expectancy}`, col: adv.expectancy >= 0 ? "#22c55e" : "#ef4444", icon: Zap },
    ],
    [
      { label: "Avg Win",       val: `+${adv.avgWin.toFixed(2)}`,  col: "#22c55e", icon: TrendingUp },
      { label: "Avg Loss",      val: `-${adv.avgLoss.toFixed(2)}`, col: "#ef4444", icon: TrendingDown },
      { label: "Max Drawdown",  val: `-${adv.maxDrawdown.toFixed(2)}`, col: "#ef4444", icon: AlertTriangle },
      { label: "Sharpe Ratio",  val: String(adv.sharpe),           col: adv.sharpe >= 1 ? "#22c55e" : "#f59e0b", icon: BarChart3 },
    ],
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-400" /> Analytics
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {closed.length} closed trades · {trades.filter(t => !t.exitPrice).length} open
          </p>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-xl"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          {(["weekly", "monthly", "all"] as Range[]).map(r => (
            <button key={r} onClick={() => setRange(r)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all"
              style={range === r
                ? { background: "linear-gradient(135deg,#4f46e5,#7c3aed)", color: "white" }
                : { color: "hsl(var(--muted-foreground))" }}>
              {r === "all" ? "All Time" : r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* KPI rows */}
      {KPI_ROWS.map((row, ri) => (
        <div key={ri} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {row.map(k => (
            <div key={k.label} className="kpi-card px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${k.col}18`, border: `1px solid ${k.col}30` }}>
                <k.icon className="w-4 h-4" style={{ color: k.col }} />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k.label}</div>
                <div className="text-base font-bold tabular-nums" style={{ color: k.col }}>{k.val}</div>
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Charts row 1: Donut + Equity Curve */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-1">Win / Loss Split</h3>
          <p className="text-[10px] text-muted-foreground mb-3">{closed.length} total closed</p>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={winLoss} dataKey="value" innerRadius={46} outerRadius={70} paddingAngle={3}>
                  {winLoss.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, fontSize: 11 }} />
                <Legend formatter={v => <span style={{ fontSize: 10 }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-2 glass-card p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold">Equity Curve</h3>
            <span className={`text-xs font-bold tabular-nums px-2 py-0.5 rounded-lg ${totalPnl >= 0 ? "profit-badge" : "loss-badge"}`}>
              {totalPnl >= 0 ? "+" : ""}{totalPnl.toFixed(2)}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground mb-3">Cumulative P&L per trade</p>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={equityCurve} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTip />} />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />
                <Area type="monotone" dataKey="equity" stroke="#6366f1" strokeWidth={2} fill="url(#eqGrad)" dot={false} name="Equity" activeDot={{ r: 4, fill: "#6366f1", stroke: "#0f172a", strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts row 2: P&L Trend */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold mb-1">P&L Trend <span className="text-muted-foreground font-normal">({range})</span></h3>
        <div className="h-48 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="gradPnl" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTip />} />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.12)" />
              <Area type="monotone" dataKey="cumulative" stroke="#6366f1" strokeWidth={2} fill="url(#gradPnl)" dot={false} name="Cumulative" />
              <Area type="monotone" dataKey="pnl" stroke="#22c55e" strokeWidth={1.5} fill="none" dot={false} strokeDasharray="4 2" name="Period" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 3: Setup + Session */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4">Setup Performance</h3>
          {setupPerf.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-xs text-muted-foreground">No setup data</div>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={setupPerf} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTip />} />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />
                  <Bar dataKey="avgPnl" name="Avg P&L" radius={[6, 6, 0, 0]}>
                    {setupPerf.map((e, i) => <Cell key={i} fill={e.avgPnl >= 0 ? "#4f46e5" : "#ef4444"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4">Session Analysis</h3>
          {sessionPerf.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-xs text-muted-foreground">No session data</div>
          ) : (
            <div className="space-y-3">
              {["London", "NY", "Asian"].map(s => {
                const perf = sessionPerf.find(x => x.name === s);
                if (!perf) return null;
                const pct = perf.winRate;
                return (
                  <div key={s} className="rounded-xl p-3"
                    style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-sm font-semibold">{s}</span>
                        <span className="text-[10px] text-muted-foreground ml-2">{perf.trades} trades</span>
                      </div>
                      <div className={`text-sm font-bold tabular-nums ${perf.avgPnl >= 0 ? "profit" : "loss"}`}>
                        {perf.avgPnl >= 0 ? "+" : ""}{perf.avgPnl} avg
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div className="h-full rounded-full"
                          style={{ width: `${pct}%`, background: pct >= 50 ? "linear-gradient(90deg,#22c55e,#16a34a)" : "linear-gradient(90deg,#ef4444,#dc2626)" }} />
                      </div>
                      <span className="text-[10px] font-semibold text-muted-foreground">{pct.toFixed(0)}% WR</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Insights summary */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Award className="w-4 h-4 text-indigo-400" /> Performance Summary
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Best Setup",   val: setupPerf[0]?.name ?? "—",        sub: setupPerf[0] ? `Avg P&L +${setupPerf[0].avgPnl}` : "No data", col: "#22c55e" },
            { label: "Worst Setup",  val: setupPerf.at(-1)?.name ?? "—",    sub: setupPerf.at(-1) ? `Avg P&L ${setupPerf.at(-1)!.avgPnl}` : "No data", col: "#ef4444" },
            { label: "Best Session", val: [...sessionPerf].sort((a,b)=>b.avgPnl-a.avgPnl)[0]?.name ?? "—", sub: "Highest avg P&L session", col: "#818cf8" },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-4"
              style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{s.label}</div>
              <div className="text-base font-bold" style={{ color: s.col }}>{s.val}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{s.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
