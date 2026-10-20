"use client";

import React from "react";
import { TrashIcon } from "@heroicons/react/24/outline";

interface Stock {
  symbol: string;
  company_name?: string;
  source_module?: string;
  added_date?: string;
  added_price?: number;
  current_price?: number;
  return_pct?: number;
  days_held?: number;
  highest_return_pct?: number;
  lowest_return_pct?: number;
  current_drawdown_pct?: number;
  volatility_pct?: number;
  alpha_vs_nifty?: number;
}

interface Props {
  stocks: Stock[];
  onRemove?: (symbol: string) => void;
}

const fmtPct = (v?: number | null): string => {
  if (v == null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
};

const retColor = (v?: number | null) =>
  v == null ? "text-neutral-500" : v > 0 ? "text-positive-400" : v < 0 ? "text-negative-400" : "text-neutral-400";

const SOURCE_COLORS: Record<string, string> = {
  "SMC Scanner":       "bg-brand-500/20 text-brand-300 border-brand-500/30",
  "FVG Scanner":       "bg-brand-500/20 text-brand-300 border-brand-500/30",
  "Volume Scanner":    "bg-warning-500/20 text-warning-300 border-warning-500/30",
  "Momentum Scanner":  "bg-positive-500/20 text-positive-300 border-positive-500/30",
  "Technical Screener": "bg-warning-500/20 text-warning-300 border-warning-500/30",
};

const sourceBadge = (src?: string) =>
  src && SOURCE_COLORS[src]
    ? SOURCE_COLORS[src]
    : "bg-neutral-700/50 text-neutral-400 border-neutral-600";

export default function WatchlistTable({ stocks, onRemove }: Props) {
  if (!stocks.length) {
    return (
      <div className="py-16 text-center text-neutral-500 text-sm">
        No stocks in this watchlist.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-neutral-800/40 border-b border-neutral-800 text-xs text-neutral-400">
            <th className="px-4 py-3 text-left">#</th>
            <th className="px-4 py-3 text-left">Symbol</th>
            <th className="px-4 py-3 text-left">Company</th>
            <th className="px-4 py-3 text-left">Source</th>
            <th className="px-4 py-3 text-right">Added ₹</th>
            <th className="px-4 py-3 text-right">Current ₹</th>
            <th className="px-4 py-3 text-right">Return</th>
            <th className="px-4 py-3 text-right">Max ↑</th>
            <th className="px-4 py-3 text-right">Max ↓</th>
            <th className="px-4 py-3 text-right">Drawdown</th>
            <th className="px-4 py-3 text-right">Vol %</th>
            <th className="px-4 py-3 text-right">Alpha</th>
            <th className="px-4 py-3 text-right">Days</th>
            <th className="px-4 py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {stocks.map((s, i) => (
            <tr
              key={s.symbol}
              className="border-b border-neutral-800/50 hover:bg-neutral-800/25 transition-colors"
            >
              <td className="px-4 py-3 text-neutral-500 text-xs">{i + 1}</td>

              <td className="px-4 py-3">
                <span className="font-bold text-brand-400">{s.symbol}</span>
              </td>

              <td className="px-4 py-3 text-neutral-400 text-xs max-w-[140px] truncate">
                {s.company_name || "—"}
              </td>

              <td className="px-4 py-3">
                {s.source_module ? (
                  <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${sourceBadge(s.source_module)}`}>
                    {s.source_module.replace(" Scanner", "").replace(" Screener", "")}
                  </span>
                ) : "—"}
              </td>

              <td className="px-4 py-3 text-right text-neutral-300 font-mono text-xs">
                {s.added_price != null ? `₹${s.added_price.toFixed(2)}` : "—"}
              </td>

              <td className="px-4 py-3 text-right font-semibold text-foreground font-mono text-xs">
                {s.current_price != null ? `₹${s.current_price.toFixed(2)}` : "—"}
              </td>

              <td className={`px-4 py-3 text-right font-bold text-sm ${retColor(s.return_pct)}`}>
                {fmtPct(s.return_pct)}
              </td>

              <td className="px-4 py-3 text-right text-positive-400 text-xs">
                {fmtPct(s.highest_return_pct)}
              </td>

              <td className="px-4 py-3 text-right text-negative-400 text-xs">
                {fmtPct(s.lowest_return_pct)}
              </td>

              <td className={`px-4 py-3 text-right text-xs ${retColor(s.current_drawdown_pct)}`}>
                {fmtPct(s.current_drawdown_pct)}
              </td>

              <td className="px-4 py-3 text-right text-neutral-400 text-xs">
                {s.volatility_pct != null ? `${s.volatility_pct.toFixed(1)}%` : "—"}
              </td>

              <td className={`px-4 py-3 text-right text-xs ${retColor(s.alpha_vs_nifty)}`}>
                {fmtPct(s.alpha_vs_nifty)}
              </td>

              <td className="px-4 py-3 text-right text-neutral-500 text-xs">
                {s.days_held != null ? `${s.days_held}d` : "—"}
              </td>

              <td className="px-4 py-3 text-right">
                {onRemove && (
                  <button
                    onClick={() => onRemove(s.symbol)}
                    className="p-1.5 rounded hover:bg-negative-500/20 text-neutral-500 hover:text-negative-400 transition-colors"
                    title="Remove from watchlist"
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
