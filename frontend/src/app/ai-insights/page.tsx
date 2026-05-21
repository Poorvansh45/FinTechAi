"use client";

import { useEffect, useState, useMemo } from "react";
import { Bot, Sparkles, RefreshCw, TrendingUp, AlertCircle, Zap, CheckCircle2, XCircle, Clock } from "lucide-react";
import { listSetups, listTradesBySetup, seedDemo, ensureTradeIdsUnique } from "@/lib/journal/storage";
import { derive } from "@/lib/journal/types";
import type { Trade } from "@/lib/journal/types";

type Message = { role: "ai" | "user"; text: string; ts: Date };

const STATIC_INSIGHTS = [
  { icon: TrendingUp,   color: "#22c55e", tag: "Edge",    title: "Strongest Setup", body: "FVG setups show highest win rate in your journal. Focus on quality FVG entries." },
  { icon: AlertCircle, color: "#f59e0b", tag: "Warning",  title: "Risk Discipline",  body: "3 of your last 5 losses exceeded your planned stop. Review your SL placement." },
  { icon: Zap,         color: "#818cf8", tag: "Pattern",  title: "Best Session",    body: "London session trades yield 2.4x better results than NY session in your data." },
  { icon: CheckCircle2,color: "#22c55e", tag: "Win",      title: "Thursday Edge",   body: "Thursdays show 68% win rate — highest of any weekday. Prioritize that day." },
  { icon: XCircle,     color: "#ef4444", tag: "Mistake",  title: "Overtrading",     body: "Days with 3+ trades show lower avg P&L. Quality over quantity matters." },
  { icon: Clock,       color: "#60a5fa", tag: "Timing",   title: "Time in Trade",   body: "Trades held < 30 mins underperform. Give setups room to develop." },
];

function kpiFromTrades(trades: Trade[]) {
  const closed = trades.filter(t => t.exitPrice != null);
  const pnls = closed.map(t => derive(t).pnl ?? 0);
  const wins = pnls.filter(p => p > 0).length;
  return {
    totalTrades: closed.length,
    winRate: closed.length ? (wins / closed.length) * 100 : 0,
    avgPnl: closed.length ? pnls.reduce((a, b) => a + b, 0) / closed.length : 0,
    best: pnls.length ? Math.max(...pnls) : 0,
    worst: pnls.length ? Math.min(...pnls) : 0,
  };
}

export default function AIInsightsPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);

  useEffect(() => {
    seedDemo(); ensureTradeIdsUnique();
    const s = listSetups();
    setTrades(s.flatMap(x => listTradesBySetup(x.id)));
  }, []);

  const kpi = useMemo(() => kpiFromTrades(trades), [trades]);

  const fetchInsights = async (tradeCount?: number) => {
    setLoading(true);
    const subset = tradeCount ? [...trades].reverse().slice(0, tradeCount) : trades;
    try {
      const res = await fetch("/api/journal/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trades: subset, kpi }),
      });
      const data = await res.json();
      const text: string = data.text || "No insights available.";
      setAnalyzed(true);

      // Stream text char-by-char
      let i = 0;
      const msg: Message = { role: "ai", text: "", ts: new Date() };
      setMessages(prev => [...prev, msg]);
      const iv = setInterval(() => {
        i += 4;
        setMessages(prev => {
          const last = [...prev];
          last[last.length - 1] = { ...msg, text: text.slice(0, i) };
          return last;
        });
        if (i >= text.length) clearInterval(iv);
      }, 14);
    } catch {
      setMessages(prev => [...prev, { role: "ai", text: "Failed to fetch AI insights. Check your API key.", ts: new Date() }]);
    } finally {
      setLoading(false);
    }
  };

  const parseSection = (text: string, marker: string) => {
    const idx = text.indexOf(marker);
    if (idx < 0) return "";
    const rest = text.slice(idx + marker.length);
    const nextMarkers = ["PROS:", "CONS:", "SUGGESTIONS:", "VIEW:"].filter(m => m !== marker);
    let end = rest.length;
    for (const m of nextMarkers) { const i = rest.indexOf(m); if (i >= 0) end = Math.min(end, i); }
    return rest.slice(0, end).trim();
  };

  const lastAiMsg = messages.filter(m => m.role === "ai").at(-1);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Bot className="w-5 h-5 text-indigo-400" /> AI Insights
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Powered by Gemini · {trades.length} trades analyzed
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchInsights(10)} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-indigo-400 transition-all disabled:opacity-50"
            style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            Last 10 Trades
          </button>
          <button onClick={() => fetchInsights()} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:scale-105 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed)" }}>
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Full Analysis
          </button>
        </div>
      </div>

      {/* Static insight cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {STATIC_INSIGHTS.map((ins, i) => (
          <div key={i} className="glass-card p-4 flex gap-3 animate-fadeUp" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${ins.color}18`, border: `1px solid ${ins.color}30` }}>
              <ins.icon className="w-4 h-4" style={{ color: ins.color }} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold">{ins.title}</span>
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ background: `${ins.color}15`, color: ins.color }}>
                  {ins.tag}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{ins.body}</p>
            </div>
          </div>
        ))}
      </div>

      {/* AI Chat panel */}
      <div className="glass-card overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-white/5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed)" }}>
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">AI Coach</h2>
            <p className="text-[10px] text-muted-foreground">Powered by Gemini 2.0 Flash</p>
          </div>
          <div className="ml-auto w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        </div>

        <div className="p-4 min-h-[200px] space-y-4">
          {!analyzed && !loading && (
            <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center animate-float"
                style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
                <Sparkles className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-medium">Ready to analyze your journal</p>
                <p className="text-xs text-muted-foreground mt-1">Click "Full Analysis" to get personalized insights</p>
              </div>
            </div>
          )}

          {loading && !lastAiMsg && (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="skeleton h-4 rounded" style={{ width: `${70 + i * 8}%` }} />
              ))}
            </div>
          )}

          {lastAiMsg && (
            <div className="space-y-4">
              {[
                { marker: "PROS:",        label: "✅ Strengths",   color: "#22c55e" },
                { marker: "CONS:",        label: "❌ Weaknesses",  color: "#ef4444" },
                { marker: "SUGGESTIONS:", label: "💡 Suggestions", color: "#f59e0b" },
                { marker: "VIEW:",        label: "🔮 AI View",     color: "#818cf8" },
              ].map(sec => {
                const content = parseSection(lastAiMsg.text, sec.marker);
                if (!content) return null;
                return (
                  <div key={sec.marker} className="ai-bubble">
                    <div className="text-xs font-bold mb-2" style={{ color: sec.color }}>{sec.label}</div>
                    <p className="text-xs leading-relaxed whitespace-pre-wrap text-foreground/90">{content}</p>
                  </div>
                );
              })}

              {/* If text is still streaming and no sections parsed yet */}
              {!parseSection(lastAiMsg.text, "PROS:") && (
                <div className="ai-bubble">
                  <p className="text-xs leading-relaxed whitespace-pre-wrap text-foreground/90">{lastAiMsg.text}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
