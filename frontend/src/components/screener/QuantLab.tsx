"use client";

/**
 * Quant Lab — shared presentation components for the proprietary scanners
 * (LaunchPad, Alpha Zone). They render the real strategy-engine outputs:
 * signal strength, the explainable confidence/score breakdown, the ATR-based
 * trade plan, an expandable explainability panel, and a footer glossary + FAQ.
 *
 * All components are data-driven so both scanners reuse them.
 */

import React, { useState } from "react";
import { ChevronDown, Info, HelpCircle, ShieldCheck, Gauge } from "lucide-react";

// ── Signal / zone strength badge ────────────────────────────────────────────────
export function SignalBadge({ label, size = "sm" }: { label?: string; size?: "sm" | "md" }) {
  const l = (label || "").toLowerCase();
  const cfg =
    l === "strong"
      ? { c: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10", dots: 3 }
      : l === "medium"
      ? { c: "text-amber-300 border-amber-500/30 bg-amber-500/10", dots: 2 }
      : { c: "text-slate-300 border-slate-500/30 bg-slate-500/10", dots: 1 };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-bold ${cfg.c} ${
        size === "md" ? "text-[11px]" : "text-[10px]"
      }`}
    >
      <span className="flex items-center gap-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`h-1.5 w-1.5 rounded-full ${i < cfg.dots ? "bg-current" : "bg-current/25"}`}
          />
        ))}
      </span>
      {label || "—"}
    </span>
  );
}

// ── Explainable score breakdown (bars) ──────────────────────────────────────────
const SCORE_LABELS: Record<string, string> = {
  proximity: "Proximity",
  gap_quality: "Gap Quality",
  trend: "Trend",
  freshness: "Freshness",
  rsi: "Momentum (RSI)",
  structure: "SMC Structure",
  institutional: "Institutional",
  breakout_strength: "Breakout Strength",
  volume: "Volume Confirmation",
  risk_quality: "Risk Quality",
};

function barColor(v: number): string {
  if (v >= 75) return "bg-emerald-500";
  if (v >= 50) return "bg-amber-500";
  return "bg-slate-500";
}

export function ScoreBreakdown({
  scores,
  accent = "purple",
}: {
  scores?: Record<string, number>;
  accent?: string;
}) {
  if (!scores || Object.keys(scores).length === 0) return null;
  return (
    <div className="space-y-2">
      {Object.entries(scores).map(([k, v]) => (
        <div key={k} className="flex items-center gap-2.5">
          <span className="w-24 shrink-0 text-[10px] font-medium text-gray-400">
            {SCORE_LABELS[k] || k}
          </span>
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-gray-800">
            <div
              className={`absolute inset-y-0 left-0 rounded-full ${barColor(v)} transition-all duration-500`}
              style={{ width: `${Math.max(0, Math.min(100, v))}%` }}
            />
          </div>
          <span className="w-7 shrink-0 text-right font-mono text-[10px] font-bold text-gray-300">
            {Math.round(v)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Expandable explainability panel ─────────────────────────────────────────────
export function ExplainPanel({
  rationale,
  scores,
  rows,
  accent = "purple",
}: {
  rationale: string;
  scores?: Record<string, number>;
  rows?: { label: string; value: React.ReactNode }[];
  accent?: string;
}) {
  const [open, setOpen] = useState(false);
  const accentText = accent === "blue" ? "text-blue-300" : "text-purple-300";
  const accentBorder = accent === "blue" ? "border-blue-500/20" : "border-purple-500/20";
  return (
    <div className={`mt-4 rounded-2xl border ${accentBorder} bg-gray-950/50 overflow-hidden`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400 transition-colors hover:text-gray-200"
      >
        <span className="flex items-center gap-1.5">
          <Gauge size={12} className={accentText} /> Why this setup
        </span>
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-3.5 px-3.5 pb-4">
          <p className="text-[11.5px] leading-relaxed text-gray-300">{rationale}</p>

          {scores && (
            <div className="space-y-1.5">
              <span className="text-[9px] font-bold uppercase tracking-widest text-gray-600">
                Confidence Breakdown
              </span>
              <ScoreBreakdown scores={scores} accent={accent} />
            </div>
          )}

          {rows && rows.length > 0 && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-gray-850 pt-3">
              {rows.map((r) => (
                <div key={r.label} className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-500">{r.label}</span>
                  <span className="font-mono text-[10px] font-semibold text-gray-300">{r.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Compact ATR trade-plan strip ────────────────────────────────────────────────
export function TradePlanStrip({
  entry,
  stop,
  target,
  riskReward,
  riskPct,
  atr,
}: {
  entry: number;
  stop: number;
  target: number;
  riskReward?: string;
  riskPct?: number;
  atr?: number | null;
}) {
  return (
    <div className="mt-4 space-y-2.5">
      <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
        <div className="rounded-xl border border-gray-850 bg-gray-900/40 py-2">
          <span className="block text-gray-500">Entry</span>
          <span className="font-mono text-xs font-bold text-gray-200">₹{entry}</span>
        </div>
        <div className="rounded-xl border border-red-500/15 bg-red-500/[0.04] py-2">
          <span className="block text-gray-500">Stop</span>
          <span className="font-mono text-xs font-bold text-red-400">₹{stop}</span>
        </div>
        <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] py-2">
          <span className="block text-gray-500">Target</span>
          <span className="font-mono text-xs font-bold text-emerald-400">₹{target}</span>
        </div>
      </div>
      <div className="flex items-center justify-between px-1 text-[10px] text-gray-500">
        <span className="flex items-center gap-1">
          <ShieldCheck size={11} className="text-gray-600" /> R:R{" "}
          <strong className="text-gray-300">{riskReward ?? "—"}</strong>
        </span>
        {riskPct != null && (
          <span>
            Risk <strong className="text-gray-300">{riskPct}%</strong>
          </span>
        )}
        {atr != null && (
          <span>
            ATR <strong className="text-gray-300">₹{atr}</strong>
          </span>
        )}
      </div>
    </div>
  );
}

// ── Footer: plain-English glossary + FAQ ────────────────────────────────────────
export function StrategyFooter({
  terms,
  faqs,
  accent = "purple",
}: {
  terms: { term: string; def: string }[];
  faqs: { q: string; a: string }[];
  accent?: string;
}) {
  const accentText = accent === "blue" ? "text-blue-400" : "text-purple-400";
  return (
    <div className="mt-12 space-y-8 border-t border-gray-850 pt-10">
      {/* Glossary */}
      <div>
        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-white">
          <Info size={15} className={accentText} /> What the numbers mean
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {terms.map((t) => (
            <div
              key={t.term}
              className="rounded-2xl border border-gray-850 bg-gray-900/40 p-4 transition-colors hover:border-gray-700"
            >
              <div className={`text-xs font-bold ${accentText}`}>{t.term}</div>
              <p className="mt-1 text-[11.5px] leading-relaxed text-gray-400">{t.def}</p>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div>
        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-white">
          <HelpCircle size={15} className={accentText} /> Frequently asked questions
        </h3>
        <div className="space-y-2.5">
          {faqs.map((f, i) => (
            <FaqItem key={i} q={f.q} a={f.a} />
          ))}
        </div>
      </div>

      <p className="text-center text-[10px] leading-relaxed text-gray-600">
        Educational analytics only — not investment advice. Signals are model-generated from historical
        price structure; always do your own research and manage risk. Markets are uncertain and past
        setups do not guarantee future results.
      </p>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-850 bg-gray-900/40">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-[12.5px] font-semibold text-gray-200 transition-colors hover:bg-gray-900/60"
      >
        {q}
        <ChevronDown size={15} className={`shrink-0 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <p className="px-4 pb-4 text-[12px] leading-relaxed text-gray-400">{a}</p>}
    </div>
  );
}
