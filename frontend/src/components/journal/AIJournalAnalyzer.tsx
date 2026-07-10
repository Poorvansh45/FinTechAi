"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Download, RefreshCw, Sparkles } from "lucide-react";
import type { Trade } from "@/lib/journal/types";
import { derive } from "@/lib/journal/types";
import { authHeader } from "@/lib/api/authToken";

// Recharts (ensure installed: npm i recharts)
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
} from "recharts";

export type AnalyzerRange = "weekly" | "monthly" | "all";

function groupKey(dateISO: string, range: AnalyzerRange) {
  const d = new Date(dateISO);
  if (range === "weekly") {
    // ISO week key: YYYY-Www
    const target = new Date(d);
    const dayNr = (d.getDay() + 6) % 7;
    target.setDate(d.getDate() - dayNr + 3);
    const firstThursday = new Date(target.getFullYear(), 0, 4);
    const diff = (target.getTime() - firstThursday.getTime()) / 86400000;
    const week = 1 + Math.floor(diff / 7);
    return `${target.getFullYear()}-W${String(week).padStart(2, "0")}`;
  }
  if (range === "monthly") {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  return "All";
}

function kpiFromTrades(trades: Trade[]) {
  const derived = trades.map((t) => ({ t, m: derive(t) }));
  const realized = derived.filter((x) => x.t.exitPrice != null);
  const pnls = realized.map((x) => x.m.pnl || 0);
  const wins = pnls.filter((p) => p > 0).length;
  const losses = pnls.filter((p) => p < 0).length;
  const totalTrades = realized.length;
  const winRate = totalTrades ? (wins / totalTrades) * 100 : 0;
  const avgPnl = totalTrades ? pnls.reduce((a, b) => a + b, 0) / totalTrades : 0;
  const best = pnls.length ? Math.max(...pnls) : 0;
  const worst = pnls.length ? Math.min(...pnls) : 0;
  return { totalTrades, winRate, avgPnl, best, worst };
}

function useTrend(trades: Trade[], range: AnalyzerRange) {
  return useMemo(() => {
    const acc: Record<string, number> = {};
    trades.forEach((t) => {
      if (!t.exitPrice) return;
      const key = groupKey(t.entryAt, range);
      acc[key] = (acc[key] || 0) + (derive(t).pnl || 0);
    });
    return Object.entries(acc)
      .sort((a, b) => (a[0] > b[0] ? 1 : -1))
      .map(([name, value]) => ({ name, value }));
  }, [trades, range]);
}

function useWinLoss(trades: Trade[]) {
  return useMemo(() => {
    let win = 0,
      loss = 0,
      flat = 0;
    trades.forEach((t) => {
      if (t.exitPrice == null) return;
      const pnl = derive(t).pnl || 0;
      if (pnl > 0) win++;
      else if (pnl < 0) loss++;
      else flat++;
    });
    return [
      { name: "Wins", value: win, color: "#16a34a" },
      { name: "Losses", value: loss, color: "#ef4444" },
      { name: "Breakeven", value: flat, color: "#64748b" },
    ];
  }, [trades]);
}

function useMarketDist(trades: Trade[]) {
  return useMemo(() => {
    const acc: Record<string, number> = {};
    trades.forEach((t) => {
      acc[t.marketType] = (acc[t.marketType] || 0) + 1;
    });
    return Object.entries(acc).map(([name, value]) => ({ name, value }));
  }, [trades]);
}

function useAvgPnlBySetup(trades: Trade[], setupName: (id: string) => string) {
  return useMemo(() => {
    const sums: Record<string, { sum: number; n: number }> = {};
    trades.forEach((t) => {
      if (t.exitPrice == null) return;
      const name = setupName(t.setupId) || "Unknown";
      if (!sums[name]) sums[name] = { sum: 0, n: 0 };
      sums[name].sum += derive(t).pnl || 0;
      sums[name].n += 1;
    });
    return Object.entries(sums).map(([name, v]) => ({ name, value: v.n ? v.sum / v.n : 0 }));
  }, [trades, setupName]);
}

export function AIJournalAnalyzer({ trades, setupName }: { trades: Trade[]; setupName: (id: string) => string }) {
  const [tab, setTab] = useState<"charts" | "summary" | "ai">("charts");
  const [range, setRange] = useState<AnalyzerRange>("weekly");
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiText, setAiText] = useState<string>("");

  const kpi = useMemo(() => kpiFromTrades(trades), [trades]);
  const trend = useTrend(trades, range);
  const winLoss = useWinLoss(trades);
  const marketDist = useMarketDist(trades);
  const avgBySetup = useAvgPnlBySetup(trades, setupName);

  const fetchAI = async () => {
    try {
      setLoadingAI(true);
      setAiText("");
      const res = await fetch("/api/journal/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ trades, kpi }),
      });
      const data = await res.json();
      const text = data.text || "No insights available.";
      // simple typing effect
      let i = 0;
      const int = setInterval(() => {
        i += 3;
        setAiText(text.slice(0, i));
        if (i >= text.length) clearInterval(int);
      }, 16);
    } catch (e) {
      setAiText("Failed to fetch AI insights. Check your API key in env.");
    } finally {
      setLoadingAI(false);
    }
  };

  const exportPDF = () => {
    // lightweight fallback: print to PDF
    window.print();
  };

  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle>AI Journal Analyzer</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <select className="h-9 rounded-md border bg-background px-2 text-sm" value={range} onChange={(e) => (setRange(e.target.value as AnalyzerRange))}>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="all">All-Time</option>
            </select>
            <Button variant="outline" size="sm" onClick={exportPDF}>
              <Download className="h-4 w-4 mr-2" /> Export PDF
            </Button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-3">
          <KPI label="Total Trades" value={kpi.totalTrades} />
          <KPI label="Win Rate" value={`${kpi.winRate.toFixed(1)}%`} />
          <KPI label="Avg PnL" value={kpi.avgPnl.toFixed(2)} />
          <KPI label="Best Trade" value={kpi.best.toFixed(2)} />
          <KPI label="Worst Trade" value={kpi.worst.toFixed(2)} />
        </div>

        <div className="mt-6 flex items-center gap-2">
          <TabButton active={tab === "charts"} onClick={() => setTab("charts")}>Graphs & Stats</TabButton>
          <TabButton active={tab === "summary"} onClick={() => setTab("summary")}>Summary Report</TabButton>
          <TabButton active={tab === "ai"} onClick={() => setTab("ai")}>AI Insights</TabButton>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {tab === "charts" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-4">
              <h4 className="text-sm font-medium mb-3">Win / Loss Ratio</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={winLoss} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={4}>
                      {winLoss.map((e, i) => (
                        <Cell key={i} fill={e.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-4">
              <h4 className="text-sm font-medium mb-3">PnL Trend ({range})</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-4">
              <h4 className="text-sm font-medium mb-3">Trades by Market</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={marketDist}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#22c55e" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-4">
              <h4 className="text-sm font-medium mb-3">Average PnL per Setup</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={avgBySetup}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" hide={false} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        )}

        {tab === "summary" && (
          <Summary trades={trades} setupName={setupName} />
        )}

        {tab === "ai" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Let AI review your journal and suggest improvements.</p>
              <Button onClick={fetchAI} disabled={loadingAI} className="gap-2">
                {loadingAI ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {loadingAI ? "Analyzing..." : "Refresh AI Analysis"}
              </Button>
            </div>
            <Card className="p-4">
              <div className="space-y-3">
                <Section title="Pros ✅" text={aiText} marker="PROS:" />
                <Section title="Cons ❌" text={aiText} marker="CONS:" />
                <Section title="Suggestions 💡" text={aiText} marker="SUGGESTIONS:" />
                <Section title="AI View 🔮" text={aiText} marker="VIEW:" />
              </div>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function KPI({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border p-3 bg-muted/20">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${active ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
    >
      {children}
    </button>
  );
}

function Summary({ trades, setupName }: { trades: Trade[]; setupName: (id: string) => string }) {
  const { totalTrades, winRate, avgPnl, best, worst } = useMemo(() => kpiFromTrades(trades), [trades]);
  // weekly profit/loss
  const weekly = useTrend(trades, "weekly");
  const last = weekly[weekly.length - 1];
  const lastVal = last?.value || 0;
  const lastCls = lastVal >= 0 ? "text-emerald-600" : "text-red-600";

  // most successful instrument by avg pnl
  const avgByInstrument = useMemo(() => {
    const map: Record<string, { sum: number; n: number }> = {};
    trades.forEach((t) => {
      if (t.exitPrice == null) return;
      if (!map[t.instrument]) map[t.instrument] = { sum: 0, n: 0 };
      map[t.instrument].sum += derive(t).pnl || 0;
      map[t.instrument].n += 1;
    });
    const arr = Object.entries(map).map(([name, { sum, n }]) => ({ name, v: n ? sum / n : 0 }));
    arr.sort((a, b) => b.v - a.v);
    return arr;
  }, [trades]);
  const bestInst = avgByInstrument[0]?.name || "-";

  // most used setup and winrate
  const setupStats = useMemo(() => {
    const map: Record<string, { wins: number; n: number }> = {};
    trades.forEach((t) => {
      if (!map[t.setupId]) map[t.setupId] = { wins: 0, n: 0 };
      const pnl = derive(t).pnl || 0;
      map[t.setupId].n += (t.exitPrice != null ? 1 : 0);
      map[t.setupId].wins += pnl > 0 ? 1 : 0;
    });
    const arr = Object.entries(map).map(([id, st]) => ({ id, name: setupName(id), n: st.n, win: st.n ? (st.wins / st.n) * 100 : 0 }));
    arr.sort((a, b) => b.n - a.n);
    return arr;
  }, [trades, setupName]);
  const mostUsed = setupStats[0];

  return (
    <div className="space-y-3 text-sm leading-relaxed">
      <p>
        Total Trades: <b>{totalTrades}</b> • Win Rate: <b>{winRate.toFixed(1)}%</b> • Avg PnL: <b>{avgPnl.toFixed(2)}</b> • Best/Worst: <b>{best.toFixed(2)}</b> / <b>{worst.toFixed(2)}</b>
      </p>
      <p>
        This week P/L: <b className={lastCls}>{lastVal.toFixed(2)}</b>
      </p>
      <p>
        Most successful instrument: <b>{bestInst}</b>
      </p>
      <p>
        Most used setup: <b>{mostUsed?.name || '-'}</b> with win rate <b>{mostUsed ? mostUsed.win.toFixed(1) : '-'}%</b>
      </p>
    </div>
  );
}

function Section({ title, text, marker }: { title: string; text: string; marker: string }) {
  const content = extractSection(text, marker);
  return (
    <div>
      <div className="text-sm font-semibold mb-1">{title}</div>
      <div className="text-sm whitespace-pre-wrap bg-muted/30 p-3 rounded-md min-h-[48px]">{content || "—"}</div>
    </div>
  );
}

function extractSection(text: string, key: string) {
  // naive parser: expects sections like "PROS:\n - ...\nCONS:\n - ..."
  const idx = text.indexOf(key);
  if (idx < 0) return "";
  const rest = text.slice(idx + key.length);
  const nextKeys = ["PROS:", "CONS:", "SUGGESTIONS:", "VIEW:"].filter((k) => k !== key);
  let end = rest.length;
  for (const k of nextKeys) {
    const i = rest.indexOf(k);
    if (i >= 0) end = Math.min(end, i);
  }
  return rest.slice(0, end).trim();
}
