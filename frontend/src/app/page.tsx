"use client";

import Link from "next/link";
import {
  BrainCircuit, BarChart3, BookOpen, Bot, ScanLine,
  ArrowRight, Shield, Zap, TrendingUp,
  Plug, Sparkles, Settings2, Clock,
  CheckCircle2, Lock,
} from "lucide-react";

const FEATURES = [
  { icon: BookOpen,  title: "Trading Journal",   desc: "9-step wizard to log every trade. Track execution, psychology, and learnings.", href: "/journal", badge: "Core" },
  { icon: BarChart3, title: "Analytics",          desc: "Profit factor, expectancy, max drawdown, equity curve, and session breakdown.", href: "/analytics", badge: "Pro" },
  { icon: Bot,       title: "AI Insights",        desc: "Personalized coaching from Gemini AI — pattern detection, mistake analysis.", href: "/ai-insights", badge: "AI" },
  { icon: ScanLine,  title: "Stock Screener",     desc: "Filter stocks from your CSV using technical criteria with live charts.", href: "/dashboard/interactive", badge: "Tool" },
];

const BADGE_COLORS: Record<string, string> = {
  Core: "rgba(99,102,241,0.15)",
  Pro: "rgba(168,85,247,0.15)",
  AI: "rgba(34,197,94,0.12)",
  Tool: "rgba(245,158,11,0.12)",
};
const BADGE_TEXT: Record<string, string> = {
  Core: "#a5b4fc", Pro: "#c084fc", AI: "#4ade80", Tool: "#fbbf24",
};

const UPCOMING = [
  {
    icon: Plug,
    title: "MT5 Integration",
    tag: "Coming Soon",
    desc: "Connect your MetaTrader 5 account using your ID & password. Automatically fetch executed trades and journal them in one click.",
    bullets: ["Auto-fetch trades from MT5", "No manual entry required", "Works with any MT5 broker"],
    color: "#6366f1",
  },
  {
    icon: Sparkles,
    title: "Smart Auto Journaling",
    tag: "In Development",
    desc: "AI detects your trades from broker feeds, tags setups automatically, and fills in entry logic — so you can focus on trading.",
    bullets: ["Auto-tag setups (FVG, BOS, OB…)", "Smart session detection", "Duplicate trade filtering"],
    color: "#22c55e",
  },
  {
    icon: Bot,
    title: "AI Trade Assistant",
    tag: "Planned",
    desc: "A real-time AI coach that reviews trades as you log them — suggests improvements, flags mistakes, and tracks your growth.",
    bullets: ["Real-time mistake detection", "R:R improvement suggestions", "Psychological pattern alerts"],
    color: "#a78bfa",
  },
  {
    icon: Settings2,
    title: "Custom Strategy Builder",
    tag: "Planned",
    desc: "Define your own trading setups with custom rules, criteria, and risk parameters — then track performance per strategy.",
    bullets: ["Define entry/exit rules", "Per-strategy analytics", "Backtesting integration"],
    color: "#f59e0b",
  },
];

const STATS = [
  { val: "9-Step", label: "Trade entry wizard" },
  { val: "100%", label: "Local — data never leaves device" },
  { val: "AI", label: "Powered by Gemini 2.0 Flash" },
];

const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  "Coming Soon":    { bg: "rgba(99,102,241,0.15)",  text: "#a5b4fc" },
  "In Development": { bg: "rgba(34,197,94,0.12)",   text: "#4ade80" },
  "Planned":        { bg: "rgba(245,158,11,0.12)",  text: "#fbbf24" },
};

export default function HomePage() {
  return (
    <div className="space-y-20 py-6 animate-fadeIn">
      {/* ── HERO ── */}
      <div className="text-center space-y-6 max-w-3xl mx-auto px-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold"
          style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)", color: "#a5b4fc" }}>
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          AI-Powered Trading Intelligence Platform
        </div>

        <h1 className="text-4xl md:text-5xl font-black leading-tight tracking-tight">
          Trade Smarter With{" "}
          <span className="gradient-text">FinAI Edge</span>
        </h1>

        <p className="text-base text-muted-foreground leading-relaxed max-w-xl mx-auto">
          A premium trading journal and analytics platform with AI coaching,
          real-time screener, and performance insights — built for serious traders.
        </p>

        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link href="/dashboard"
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white transition-all hover:scale-105"
            style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed)", boxShadow: "0 0 24px rgba(99,102,241,0.35)" }}>
            Open Dashboard <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/journal"
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all hover:bg-white/8"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
            Start Journaling
          </Link>
        </div>
      </div>

      {/* ── STATS ── */}
      <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto px-4">
        {STATS.map(s => (
          <div key={s.val} className="glass-card p-5 text-center">
            <div className="text-2xl font-black gradient-text">{s.val}</div>
            <div className="text-[11px] text-muted-foreground mt-1 leading-snug">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── CURRENT FEATURES ── */}
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold">Everything you need to <span className="gradient-text">trade better</span></h2>
          <p className="text-sm text-muted-foreground mt-2">All tools in one platform — journal, analytics, screener, and AI.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FEATURES.map((f, i) => (
            <Link key={f.href} href={f.href}
              className="glass-card p-6 group animate-fadeUp"
              style={{ animationDelay: `${i * 70}ms`, textDecoration: "none" }}>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110"
                  style={{ background: "linear-gradient(135deg,rgba(79,70,229,0.2),rgba(124,58,237,0.15))", border: "1px solid rgba(99,102,241,0.25)" }}>
                  <f.icon className="w-5 h-5 text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-bold">{f.title}</h3>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: BADGE_COLORS[f.badge], color: BADGE_TEXT[f.badge] }}>
                      {f.badge}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                  <div className="flex items-center gap-1 mt-2 text-xs font-medium text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    Explore <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── UPCOMING FEATURES ── */}
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-3"
            style={{ background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.25)", color: "#c084fc" }}>
            <Clock className="w-3.5 h-3.5" /> Roadmap
          </div>
          <h2 className="text-2xl font-bold">🚀 Upcoming Features</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-lg mx-auto">
            We're building the most complete trading platform for retail traders.
            Here's what's coming next.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {UPCOMING.map((f, i) => {
            const tagStyle = TAG_COLORS[f.tag] ?? { bg: "rgba(99,102,241,0.1)", text: "#a5b4fc" };
            return (
              <div key={f.title}
                className="glass-card p-6 animate-fadeUp relative overflow-hidden"
                style={{ animationDelay: `${i * 80}ms` }}>
                {/* Subtle color glow */}
                <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-10 blur-2xl"
                  style={{ background: f.color }} />

                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${f.color}18`, border: `1px solid ${f.color}30` }}>
                    <f.icon className="w-5 h-5" style={{ color: f.color }} />
                  </div>
                  <span className="text-[9px] font-bold px-2 py-1 rounded-full"
                    style={{ background: tagStyle.bg, color: tagStyle.text }}>
                    {f.tag}
                  </span>
                </div>

                <h3 className="text-sm font-bold mb-2">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">{f.desc}</p>

                <ul className="space-y-1.5">
                  {f.bullets.map(b => (
                    <li key={b} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="w-3 h-3 flex-shrink-0" style={{ color: f.color }} />
                      {b}
                    </li>
                  ))}
                </ul>

                <div className="mt-4 flex items-center gap-2 text-[10px] text-muted-foreground">
                  <Lock className="w-3 h-3" />
                  <span>Not yet available</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── BOTTOM CTA ── */}
      <div className="text-center max-w-xl mx-auto px-4">
        <div className="glass-card p-8 space-y-4"
          style={{ background: "linear-gradient(135deg,rgba(79,70,229,0.08),rgba(124,58,237,0.05))", border: "1px solid rgba(99,102,241,0.2)" }}>
          <div className="flex items-center justify-center gap-2">
            <Shield className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-medium text-indigo-300">100% Local — Your data never leaves your device</span>
          </div>
          <h2 className="text-lg font-bold">Start improving your trading today</h2>
          <p className="text-xs text-muted-foreground">Join traders who use FinAI Edge to build discipline and improve performance.</p>
          <Link href="/journal"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white hover:scale-105 transition-all"
            style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed)" }}>
            <Zap className="w-4 h-4" /> Add Your First Trade
          </Link>
        </div>
      </div>
    </div>
  );
}
