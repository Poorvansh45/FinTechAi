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
  v == null ? "text-gray-500" : v > 0 ? "text-emerald-400" : v < 0 ? "text-red-400" : "text-gray-400";

const SOURCE_COLORS: Record<string, string> = {
  "SMC Scanner":       "bg-purple-500/20 text-purple-300 border-purple-500/30",
  "FVG Scanner":       "bg-blue-500/20 text-blue-300 border-blue-500/30",
  "Volume Scanner":    "bg-orange-500/20 text-orange-300 border-orange-500/30",
  "Momentum Scanner":  "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  "Technical Screener": "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
};

const sourceBadge = (src?: string) =>
  src && SOURCE_COLORS[src]
    ? SOURCE_COLORS[src]
    : "bg-gray-700/50 text-gray-400 border-gray-600";

export default function WatchlistTable({ stocks, onRemove }: Props) {
  if (!stocks.length) {
    return (
      <div className="py-16 text-center text-gray-600 text-sm">
        No stocks in this watchlist.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-800/40 border-b border-gray-800 text-xs text-gray-400 uppercase tracking-wider">
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
              className="border-b border-gray-800/50 hover:bg-gray-800/25 transition-colors"
            >
              <td className="px-4 py-3 text-gray-600 text-xs">{i + 1}</td>

              <td className="px-4 py-3">
                <span className="font-bold text-blue-400">{s.symbol}</span>
              </td>

              <td className="px-4 py-3 text-gray-400 text-xs max-w-[140px] truncate">
                {s.company_name || "—"}
              </td>

              <td className="px-4 py-3">
                {s.source_module ? (
                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${sourceBadge(s.source_module)}`}>
                    {s.source_module.replace(" Scanner", "").replace(" Screener", "")}
                  </span>
                ) : "—"}
              </td>

              <td className="px-4 py-3 text-right text-gray-300 font-mono text-xs">
                {s.added_price != null ? `₹${s.added_price.toFixed(2)}` : "—"}
              </td>

              <td className="px-4 py-3 text-right font-semibold text-white font-mono text-xs">
                {s.current_price != null ? `₹${s.current_price.toFixed(2)}` : "—"}
              </td>

              <td className={`px-4 py-3 text-right font-bold text-sm ${retColor(s.return_pct)}`}>
                {fmtPct(s.return_pct)}
              </td>

              <td className="px-4 py-3 text-right text-emerald-400 text-xs">
                {fmtPct(s.highest_return_pct)}
              </td>

              <td className="px-4 py-3 text-right text-red-400 text-xs">
                {fmtPct(s.lowest_return_pct)}
              </td>

              <td className={`px-4 py-3 text-right text-xs ${retColor(s.current_drawdown_pct)}`}>
                {fmtPct(s.current_drawdown_pct)}
              </td>

              <td className="px-4 py-3 text-right text-gray-400 text-xs">
                {s.volatility_pct != null ? `${s.volatility_pct.toFixed(1)}%` : "—"}
              </td>

              <td className={`px-4 py-3 text-right text-xs ${retColor(s.alpha_vs_nifty)}`}>
                {fmtPct(s.alpha_vs_nifty)}
              </td>

              <td className="px-4 py-3 text-right text-gray-500 text-xs">
                {s.days_held != null ? `${s.days_held}d` : "—"}
              </td>

              <td className="px-4 py-3 text-right">
                {onRemove && (
                  <button
                    onClick={() => onRemove(s.symbol)}
                    className="p-1.5 rounded hover:bg-red-500/20 text-gray-600 hover:text-red-400 transition-colors"
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
