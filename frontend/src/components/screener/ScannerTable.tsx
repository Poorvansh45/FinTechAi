"use client";

import React, { useState, useMemo } from "react";
import AddToWatchlistModal from "../watchlists/AddToWatchlistModal";
import { ChevronDown, ChevronRight, Plus, TrendingUp, TrendingDown, Minus } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Indicators {
  rsi_14?: number | null;
  ema_50?: number | null;
  ema_200?: number | null;
  ema_50_dist_pct?: number | null;
  ema_200_dist_pct?: number | null;
  macd?: number | null;
  macd_signal?: number | null;
  macd_hist?: number | null;
}

interface FVGZone {
  gap_low: number;
  gap_high: number;
  gap_size_pct: number;
  fvg_score: number;
  strength: "Strong" | "Medium" | "Weak";
  status: "Untouched" | "Touched" | "PartiallyFilled" | "MostlyFilled";
  mitigation_pct: number;
  distance_pct: number;
  age_days: number;
  touch_count?: number | null;
}

interface SurgeStat {
  surge_date: string;
  surge_price: number;
  volume_ratio: number;
  day_return_pct: number | null;
  return_1d: number | null;
  return_2d: number | null;
  return_3d: number | null;
  return_5d: number | null;
  return_10d: number | null;
  return_20d: number | null;
  max_gain_pct: number | null;
  max_drawdown_pct: number | null;
}

interface StockRow {
  symbol: string;
  company_name?: string;
  price?: number | null;
  ltp?: number | null;
  volume?: number | null;
  indicators?: Indicators;
  // FVG fields
  best_fvg_score?: number | null;
  top_bullish_fvgs?: FVGZone[];
  nearest_bullish_fvg?: FVGZone | null;
  total_fvgs_bullish?: number;
  // Volume surge fields
  current_volume_ratio?: number | null;
  surge_history?: SurgeStat[];
  surge_stats?: Record<string, number | null>;
  has_current_surge?: boolean;
  // Momentum fields
  momentum_score?: number | null;
  category?: string;
  ema_50_dist_pct?: number | null;
  ema_200_dist_pct?: number | null;
  rsi?: number | null;
  week52_high_dist_pct?: number | null;
  relative_strength?: number | null;
  // SMC fields
  smc_score?: number | null;
  structure?: Record<string, any>;
  nearest_demand?: Record<string, any>;
  current_zone?: string;
}

interface Props {
  stocks?: StockRow[];
  data?: StockRow[];
  isLoading?: boolean;
  sourceModule?: string;
  mode?: "technical" | "fvg" | "volume-surge" | "momentum" | "smc";
}

// ── Formatters ────────────────────────────────────────────────────────────────

const fmt = (n: number | null | undefined, dec = 2): string => {
  if (n == null) return "—";
  return n.toFixed(dec);
};

const fmtPct = (n: number | null | undefined): string => {
  if (n == null) return "—";
  const s = n >= 0 ? `+${n.toFixed(2)}` : n.toFixed(2);
  return `${s}%`;
};

const fmtVol = (n: number | null | undefined): string => {
  if (!n) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
};

const ltp = (row: StockRow): number | null => row.ltp ?? row.price ?? null;

// ── Badge Helpers ─────────────────────────────────────────────────────────────

const rsiBadge = (rsi?: number | null) => {
  if (rsi == null) return "bg-gray-700/50 text-gray-400";
  if (rsi >= 70) return "bg-red-500/20 text-red-300 border border-red-500/30";
  if (rsi <= 30) return "bg-green-500/20 text-green-300 border border-green-500/30";
  return "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30";
};

const distColor = (v?: number | null) => {
  if (v == null) return "text-gray-500";
  if (v > 10) return "text-emerald-400 font-semibold";
  if (v > 0) return "text-emerald-300";
  if (v < -10) return "text-red-400 font-semibold";
  return "text-red-300";
};

const retColor = (v?: number | null) =>
  v == null ? "text-gray-500" : v > 0 ? "text-emerald-400" : v < 0 ? "text-red-400" : "text-gray-400";

const fvgStrengthBadge = (s: string) => {
  if (s === "Strong") return "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30";
  if (s === "Medium") return "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30";
  return "bg-red-500/20 text-red-300 border border-red-500/30";
};

const scoreBadge = (score?: number | null) => {
  if (score == null) return "bg-gray-700/50 text-gray-400";
  if (score >= 70) return "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30";
  if (score >= 45) return "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30";
  return "bg-red-500/20 text-red-300 border border-red-500/30";
};

const zoneBadge = (zone?: string) => {
  if (zone === "Discount") return "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30";
  if (zone === "Premium") return "bg-red-500/20 text-red-300 border border-red-500/30";
  return "bg-gray-700/50 text-gray-400";
};

// ── Volume Surge Expanded Panel ───────────────────────────────────────────────

const SurgeHistoryTable = ({ history, stats }: { history: SurgeStat[]; stats: any }) => (
  <div className="mt-3 space-y-3">
    {/* Aggregate stats */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
      {[
        ["Avg 1D", stats?.avg_1d_return],
        ["Avg 5D", stats?.avg_5d_return],
        ["Avg 10D", stats?.avg_10d_return],
        ["Avg 20D", stats?.avg_20d_return],
      ].map(([label, val]) => (
        <div key={label as string} className="bg-gray-900 rounded p-2">
          <div className="text-gray-500 text-[10px] mb-0.5">{label}</div>
          <div className={`font-semibold ${retColor(val as number)}`}>{fmtPct(val as number)}</div>
        </div>
      ))}
    </div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
      {[
        ["Win Rate 1D", stats?.win_rate_1d],
        ["Win Rate 5D", stats?.win_rate_5d],
        ["Max Gain", stats?.max_gain_ever],
        ["Max DD", stats?.max_drawdown_ever],
      ].map(([label, val]) => (
        <div key={label as string} className="bg-gray-900 rounded p-2">
          <div className="text-gray-500 text-[10px] mb-0.5">{label}</div>
          <div className={`font-semibold ${retColor(val as number)}`}>{fmtPct(val as number)}</div>
        </div>
      ))}
    </div>

    {/* Per-surge history */}
    <div className="overflow-x-auto rounded border border-gray-800">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-800/70 text-gray-400">
            {["Date", "Price", "Ratio", "Day%", "1D", "2D", "3D", "5D", "10D", "20D", "Max↑", "Max↓"].map((h) => (
              <th key={h} className="px-2 py-1.5 text-right first:text-left font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {history.map((s, i) => (
            <tr key={i} className="border-t border-gray-800/60 hover:bg-gray-800/30">
              <td className="px-2 py-1.5 text-gray-300">{s.surge_date}</td>
              <td className={`px-2 py-1.5 text-right font-mono`}>₹{s.surge_price?.toFixed(0)}</td>
              <td className="px-2 py-1.5 text-right text-blue-300">{s.volume_ratio?.toFixed(1)}x</td>
              <td className={`px-2 py-1.5 text-right ${retColor(s.day_return_pct)}`}>{fmtPct(s.day_return_pct)}</td>
              <td className={`px-2 py-1.5 text-right ${retColor(s.return_1d)}`}>{fmtPct(s.return_1d)}</td>
              <td className={`px-2 py-1.5 text-right ${retColor(s.return_2d)}`}>{fmtPct(s.return_2d)}</td>
              <td className={`px-2 py-1.5 text-right ${retColor(s.return_3d)}`}>{fmtPct(s.return_3d)}</td>
              <td className={`px-2 py-1.5 text-right ${retColor(s.return_5d)}`}>{fmtPct(s.return_5d)}</td>
              <td className={`px-2 py-1.5 text-right ${retColor(s.return_10d)}`}>{fmtPct(s.return_10d)}</td>
              <td className={`px-2 py-1.5 text-right ${retColor(s.return_20d)}`}>{fmtPct(s.return_20d)}</td>
              <td className={`px-2 py-1.5 text-right text-emerald-400`}>{fmtPct(s.max_gain_pct)}</td>
              <td className={`px-2 py-1.5 text-right text-red-400`}>{fmtPct(s.max_drawdown_pct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// ── FVG Expanded Panel ────────────────────────────────────────────────────────

const FVGExpandedPanel = ({ fvgs, ltp }: { fvgs: FVGZone[]; ltp: number | null }) => (
  <div className="mt-3 space-y-2">
    {fvgs.map((fvg, i) => (
      <div key={i} className="bg-gray-900 rounded-lg p-3 border border-gray-700/50 flex flex-wrap gap-3 items-center text-xs">
        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${fvgStrengthBadge(fvg.strength)}`}>{fvg.strength}</span>
        <span className="text-gray-400">Zone <span className="text-white font-mono">₹{fvg.gap_low?.toFixed(1)} – ₹{fvg.gap_high?.toFixed(1)}</span></span>
        <span className="text-gray-400">Gap <span className={scoreBadge(fvg.fvg_score).includes("emerald") ? "text-emerald-300" : "text-yellow-300"}>{fmtPct(fvg.gap_size_pct)}</span></span>
        <span className="text-gray-400">Mitigated <span className="text-white">{fmt(fvg.mitigation_pct)}%</span></span>
        <span className="text-gray-400">Dist <span className={distColor(-fvg.distance_pct)}>{fmtPct(fvg.distance_pct)}</span></span>
        <span className="text-gray-400">Age <span className="text-white">{fvg.age_days}d</span></span>
        <span className="text-gray-400">Touches <span className="text-white">{fvg.touch_count ?? 0}</span></span>
        <span className={`ml-auto px-2 py-0.5 rounded text-[10px] border ${scoreBadge(fvg.fvg_score)}`}>Score {fvg.fvg_score}</span>
      </div>
    ))}
  </div>
);

// ── Main Table ────────────────────────────────────────────────────────────────

export default function ScannerTable({ stocks, data, isLoading, sourceModule = "Scanner", mode = "technical" }: Props) {
  const rows = stocks || data || [];
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState<StockRow | null>(null);

  const toggleExpand = (sym: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(sym) ? next.delete(sym) : next.add(sym);
      return next;
    });
  };

  const handleAdd = (stock: StockRow) => {
    setSelectedStock(stock);
    setIsModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-2 px-1">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-gray-800/50 animate-pulse" style={{ opacity: 1 - i * 0.12 }} />
        ))}
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
        <div className="w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center text-2xl">🔍</div>
        <p className="text-gray-400 text-sm">No stocks match your filters.<br />Try widening the conditions.</p>
      </div>
    );
  }

  const [sortKey, setSortKey] = useState<string>("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const handleSort = (key: string) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "symbol" || key === "company" ? "asc" : "desc");
    }
  };

  const SortIcon = ({ col }: { col: string }) => (
    <span className="ml-1 text-gray-500 text-[10px] select-none inline-block">
      {sortKey === col ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
    </span>
  );

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    return [...rows].sort((a, b) => {
      let av: any = 0, bv: any = 0;
      const ra = a as any;
      const rb = b as any;
      if (sortKey === "symbol") { av = a.symbol || ""; bv = b.symbol || ""; }
      else if (sortKey === "company") { av = a.company_name || ""; bv = b.company_name || ""; }
      else if (sortKey === "price") { av = ltp(a) ?? 0; bv = ltp(b) ?? 0; }
      else if (sortKey === "volume") { av = a.volume ?? 0; bv = b.volume ?? 0; }
      else if (sortKey === "rsi") { av = a.indicators?.rsi_14 ?? ra.rsi ?? 0; bv = b.indicators?.rsi_14 ?? rb.rsi ?? 0; }
      else if (sortKey === "ema50d") { av = a.indicators?.ema_50_dist_pct ?? ra.ema_50_dist_pct ?? -999; bv = b.indicators?.ema_50_dist_pct ?? rb.ema_50_dist_pct ?? -999; }
      else if (sortKey === "ema200d") { av = a.indicators?.ema_200_dist_pct ?? ra.ema_200_dist_pct ?? -999; bv = b.indicators?.ema_200_dist_pct ?? rb.ema_200_dist_pct ?? -999; }
      else if (sortKey === "macd") { av = a.indicators?.macd ?? 0; bv = b.indicators?.macd ?? 0; }
      else if (sortKey === "fvg_score") { av = ra.fvg_score ?? ra.best_fvg_score ?? 0; bv = rb.fvg_score ?? rb.best_fvg_score ?? 0; }
      else if (sortKey === "strength") { av = ra.nearest_bullish_fvg?.strength || ra.strength || ""; bv = rb.nearest_bullish_fvg?.strength || rb.strength || ""; }
      else if (sortKey === "gap_zone") { av = ra.nearest_bullish_fvg?.gap_size_pct ?? ra.gap_size_pct ?? 0; bv = rb.nearest_bullish_fvg?.gap_size_pct ?? rb.gap_size_pct ?? 0; }
      else if (sortKey === "dist_fvg") { av = ra.nearest_bullish_fvg?.distance_pct ?? ra.distance_to_fvg_pct ?? 999; bv = rb.nearest_bullish_fvg?.distance_pct ?? rb.distance_to_fvg_pct ?? 999; }
      else if (sortKey === "vol_ratio") { av = ra.current_volume_ratio ?? ra.volume_ratio ?? 0; bv = rb.current_volume_ratio ?? rb.volume_ratio ?? 0; }
      else if (sortKey === "score") { av = a.momentum_score ?? a.smc_score ?? 0; bv = b.momentum_score ?? b.smc_score ?? 0; }
      else if (sortKey === "dist_zone") { av = ra.distance_pct ?? ra.nearest_demand?.distance_pct ?? 999; bv = rb.distance_pct ?? rb.nearest_demand?.distance_pct ?? 999; }
      else if (sortKey === "event") { av = ra.event ?? ra.nearest_demand?.event ?? ""; bv = rb.event ?? rb.nearest_demand?.event ?? ""; }

      if (typeof av === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [rows, sortKey, sortDir]);

  // ── Column definitions per mode ─────────────────────────────────────────

  const isFVG      = mode === "fvg";
  const isSurge    = mode === "volume-surge";
  const isMomentum = mode === "momentum";
  const isSMC      = mode === "smc";
  const canExpand  = isFVG || isSurge;

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-gray-800/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-800/40">
              {canExpand && <th className="w-8" />}
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">#</th>
              <th onClick={() => handleSort("symbol")} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors select-none">
                Symbol <SortIcon col="symbol" />
              </th>
              <th onClick={() => handleSort("company")} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors select-none">
                Company <SortIcon col="company" />
              </th>
              <th onClick={() => handleSort("price")} className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors select-none">
                LTP <SortIcon col="price" />
              </th>

              {/* Technical columns */}
              {!isFVG && !isSurge && !isMomentum && !isSMC && (
                <>
                  <th onClick={() => handleSort("volume")} className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase cursor-pointer hover:text-white transition-colors select-none">
                    Volume <SortIcon col="volume" />
                  </th>
                  <th onClick={() => handleSort("rsi")} className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase cursor-pointer hover:text-white transition-colors select-none">
                    RSI <SortIcon col="rsi" />
                  </th>
                  <th onClick={() => handleSort("ema50d")} className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase cursor-pointer hover:text-white transition-colors select-none">
                    EMA50 Dist <SortIcon col="ema50d" />
                  </th>
                  <th onClick={() => handleSort("ema200d")} className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase cursor-pointer hover:text-white transition-colors select-none">
                    EMA200 Dist <SortIcon col="ema200d" />
                  </th>
                  <th onClick={() => handleSort("macd")} className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase cursor-pointer hover:text-white transition-colors select-none">
                    MACD <SortIcon col="macd" />
                  </th>
                </>
              )}

              {/* FVG columns */}
              {isFVG && (
                <>
                  <th onClick={() => handleSort("rsi")} className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase cursor-pointer hover:text-white transition-colors select-none">
                    RSI <SortIcon col="rsi" />
                  </th>
                  <th onClick={() => handleSort("fvg_score")} className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase cursor-pointer hover:text-white transition-colors select-none">
                    FVG Score <SortIcon col="fvg_score" />
                  </th>
                  <th onClick={() => handleSort("strength")} className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase cursor-pointer hover:text-white transition-colors select-none">
                    Strength <SortIcon col="strength" />
                  </th>
                  <th onClick={() => handleSort("gap_zone")} className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase cursor-pointer hover:text-white transition-colors select-none">
                    Gap Zone <SortIcon col="gap_zone" />
                  </th>
                  <th onClick={() => handleSort("dist_fvg")} className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase cursor-pointer hover:text-white transition-colors select-none">
                    Dist % <SortIcon col="dist_fvg" />
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Mitigated</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">FVGs</th>
                </>
              )}

              {/* Volume Surge columns */}
              {isSurge && (
                <>
                  <th onClick={() => handleSort("vol_ratio")} className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase cursor-pointer hover:text-white transition-colors select-none">
                    Vol Ratio <SortIcon col="vol_ratio" />
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Avg 1D</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Avg 5D</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Win Rate 1D</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Win Rate 5D</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Surges</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Max Gain</th>
                </>
              )}

              {/* Momentum columns */}
              {isMomentum && (
                <>
                  <th onClick={() => handleSort("score")} className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase cursor-pointer hover:text-white transition-colors select-none">
                    Score <SortIcon col="score" />
                  </th>
                  <th className="px-4 py-3 text-left  text-xs font-semibold text-gray-400 uppercase">Category</th>
                  <th onClick={() => handleSort("rsi")} className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase cursor-pointer hover:text-white transition-colors select-none">
                    RSI <SortIcon col="rsi" />
                  </th>
                  <th onClick={() => handleSort("ema50d")} className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase cursor-pointer hover:text-white transition-colors select-none">
                    EMA50 Dist <SortIcon col="ema50d" />
                  </th>
                  <th onClick={() => handleSort("ema200d")} className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase cursor-pointer hover:text-white transition-colors select-none">
                    EMA200 Dist <SortIcon col="ema200d" />
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">RS vs Nifty</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">52W High Dist</th>
                </>
              )}

              {/* SMC columns */}
              {isSMC && (
                <>
                  <th onClick={() => handleSort("score")} className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase cursor-pointer hover:text-white transition-colors select-none">
                    SMC Score <SortIcon col="score" />
                  </th>
                  <th onClick={() => handleSort("event")} className="px-4 py-3 text-left  text-xs font-semibold text-gray-400 uppercase cursor-pointer hover:text-white transition-colors select-none">
                    Event <SortIcon col="event" />
                  </th>
                  <th onClick={() => handleSort("dist_zone")} className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase cursor-pointer hover:text-white transition-colors select-none">
                    Dist to Zone <SortIcon col="dist_zone" />
                  </th>
                  <th className="px-4 py-3 text-left  text-xs font-semibold text-gray-400 uppercase">Zone</th>
                  <th className="px-4 py-3 text-left  text-xs font-semibold text-gray-400 uppercase">PD Zone</th>
                </>
              )}

              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((item, idx) => {
              const price    = ltp(item);
              const sym      = item.symbol;
              const isOpen   = expanded.has(sym);
              const ind      = item.indicators ?? {};
              const nearFvg  = item.nearest_bullish_fvg;
              const ss       = item.surge_stats ?? {};
              const nearDmd  = item.nearest_demand ?? {};

              return (
                <React.Fragment key={sym || idx}>
                  <tr className="border-b border-gray-800/50 hover:bg-gray-800/25 transition-colors group">
                    {canExpand && (
                      <td className="pl-3 pr-1 py-3 w-8">
                        {((isFVG && (item.top_bullish_fvgs?.length ?? 0) > 0) ||
                          (isSurge && (item.surge_history?.length ?? 0) > 0)) && (
                          <button
                            onClick={() => toggleExpand(sym)}
                            className="text-gray-500 hover:text-white transition-colors"
                          >
                            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                        )}
                      </td>
                    )}

                    {/* # */}
                    <td className="px-4 py-3 text-gray-600 text-xs">{idx + 1}</td>

                    {/* Symbol */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-blue-400 tracking-wide">{sym}</span>
                        {item.has_current_surge && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] bg-orange-500/20 text-orange-300 border border-orange-500/30 font-semibold">SURGE</span>
                        )}
                      </div>
                    </td>

                    {/* Company */}
                    <td className="px-4 py-3 text-gray-400 text-xs max-w-[160px] truncate">{item.company_name || "—"}</td>

                    {/* LTP */}
                    <td className="px-4 py-3 text-right font-semibold text-white font-mono">
                      {price != null ? `₹${price.toFixed(2)}` : "—"}
                    </td>

                    {/* Technical */}
                    {!isFVG && !isSurge && !isMomentum && !isSMC && (
                      <>
                        <td className="px-4 py-3 text-right text-gray-300">{fmtVol(item.volume)}</td>
                        <td className="px-4 py-3 text-right">
                          {ind.rsi_14 != null ? (
                            <span className={`px-2 py-0.5 rounded text-xs ${rsiBadge(ind.rsi_14)}`}>{fmt(ind.rsi_14)}</span>
                          ) : "—"}
                        </td>
                        <td className={`px-4 py-3 text-right text-xs ${distColor(ind.ema_50_dist_pct)}`}>
                          {ind.ema_50_dist_pct != null ? fmtPct(ind.ema_50_dist_pct) : "—"}
                        </td>
                        <td className={`px-4 py-3 text-right text-xs ${distColor(ind.ema_200_dist_pct)}`}>
                          {ind.ema_200_dist_pct != null ? fmtPct(ind.ema_200_dist_pct) : "—"}
                        </td>
                        <td className={`px-4 py-3 text-right text-xs ${ind.macd != null ? (ind.macd >= 0 ? "text-emerald-400" : "text-red-400") : "text-gray-500"}`}>
                          {fmt(ind.macd)}
                        </td>
                      </>
                    )}

                    {/* FVG */}
                    {isFVG && (
                      <>
                        <td className="px-4 py-3 text-right">
                          {ind.rsi_14 != null ? (
                            <span className={`px-2 py-0.5 rounded text-xs ${rsiBadge(ind.rsi_14)}`}>{fmt(ind.rsi_14)}</span>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`px-2 py-0.5 rounded text-xs border ${scoreBadge(item.best_fvg_score)}`}>
                            {item.best_fvg_score ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {nearFvg ? (
                            <span className={`px-2 py-0.5 rounded text-[10px] border ${fvgStrengthBadge(nearFvg.strength)}`}>{nearFvg.strength}</span>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-mono text-gray-300">
                          {nearFvg ? `₹${nearFvg.gap_low?.toFixed(0)} – ₹${nearFvg.gap_high?.toFixed(0)}` : "—"}
                        </td>
                        <td className={`px-4 py-3 text-right text-xs ${distColor(nearFvg ? -nearFvg.distance_pct : null)}`}>
                          {nearFvg ? fmtPct(nearFvg.distance_pct) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-gray-300">
                          {nearFvg ? `${fmt(nearFvg.mitigation_pct)}%` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-400 text-xs">{item.total_fvgs_bullish ?? "—"}</td>
                      </>
                    )}

                    {/* Volume Surge */}
                    {isSurge && (
                      <>
                        <td className="px-4 py-3 text-right">
                          {item.current_volume_ratio != null ? (
                            <span className="text-orange-300 font-semibold">{item.current_volume_ratio?.toFixed(1)}x</span>
                          ) : "—"}
                        </td>
                        <td className={`px-4 py-3 text-right text-xs ${retColor(ss.avg_1d_return as number)}`}>{fmtPct(ss.avg_1d_return as number)}</td>
                        <td className={`px-4 py-3 text-right text-xs ${retColor(ss.avg_5d_return as number)}`}>{fmtPct(ss.avg_5d_return as number)}</td>
                        <td className="px-4 py-3 text-right text-xs text-gray-300">{ss.win_rate_1d != null ? `${fmt(ss.win_rate_1d as number)}%` : "—"}</td>
                        <td className="px-4 py-3 text-right text-xs text-gray-300">{ss.win_rate_5d != null ? `${fmt(ss.win_rate_5d as number)}%` : "—"}</td>
                        <td className="px-4 py-3 text-right text-xs text-gray-400">{ss.total_surges ?? "—"}</td>
                        <td className="px-4 py-3 text-right text-xs text-emerald-400">{fmtPct(ss.max_gain_ever as number)}</td>
                      </>
                    )}

                    {/* Momentum */}
                    {isMomentum && (
                      <>
                        <td className="px-4 py-3 text-right">
                          <span className={`px-2 py-0.5 rounded text-xs border ${scoreBadge(item.momentum_score)}`}>
                            {item.momentum_score ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-left text-xs text-gray-300">{item.category || "—"}</td>
                        <td className="px-4 py-3 text-right">
                          {(item.rsi ?? ind.rsi_14) != null ? (
                            <span className={`px-2 py-0.5 rounded text-xs ${rsiBadge(item.rsi ?? ind.rsi_14)}`}>{fmt(item.rsi ?? ind.rsi_14)}</span>
                          ) : "—"}
                        </td>
                        <td className={`px-4 py-3 text-right text-xs ${distColor(item.ema_50_dist_pct)}`}>
                          {fmtPct(item.ema_50_dist_pct)}
                        </td>
                        <td className={`px-4 py-3 text-right text-xs ${distColor(item.ema_200_dist_pct)}`}>
                          {fmtPct(item.ema_200_dist_pct)}
                        </td>
                        <td className={`px-4 py-3 text-right text-xs ${retColor(item.relative_strength)}`}>
                          {fmtPct(item.relative_strength)}
                        </td>
                        <td className={`px-4 py-3 text-right text-xs ${distColor(item.week52_high_dist_pct != null ? -item.week52_high_dist_pct : null)}`}>
                          {fmtPct(item.week52_high_dist_pct)}
                        </td>
                      </>
                    )}

                    {/* SMC */}
                    {isSMC && (
                      <>
                        <td className="px-4 py-3 text-right">
                          <span className={`px-2 py-0.5 rounded text-xs border ${scoreBadge(item.smc_score)}`}>
                            {item.smc_score ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-left text-xs">
                          {item.structure?.last_bullish_event ? (
                            <span className={`px-2 py-0.5 rounded text-[10px] border ${
                              item.structure.last_bullish_event === "BOS"
                                ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                                : "bg-purple-500/20 text-purple-300 border-purple-500/30"
                            }`}>{item.structure.last_bullish_event}</span>
                          ) : "—"}
                        </td>
                        <td className={`px-4 py-3 text-right text-xs ${distColor(nearDmd.distance_pct != null ? -nearDmd.distance_pct : null)}`}>
                          {nearDmd.distance_pct != null ? fmtPct(nearDmd.distance_pct) : "—"}
                        </td>
                        <td className="px-4 py-3 text-left text-xs font-mono text-gray-300">
                          {nearDmd.zone_high ? `₹${nearDmd.zone_low?.toFixed(0)}–${nearDmd.zone_high?.toFixed(0)}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-left">
                          {item.current_zone ? (
                            <span className={`px-2 py-0.5 rounded text-[10px] border ${zoneBadge(item.current_zone)}`}>{item.current_zone}</span>
                          ) : "—"}
                        </td>
                      </>
                    )}

                    {/* Action */}
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleAdd(item)}
                        className="inline-flex items-center gap-1 text-xs bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-600/40 hover:text-white px-3 py-1.5 rounded-lg transition-all"
                      >
                        <Plus size={11} />
                        <span>Watch</span>
                      </button>
                    </td>
                  </tr>

                  {/* Expanded panel */}
                  {isOpen && (
                    <tr className="border-b border-gray-800/50">
                      <td colSpan={99} className="px-6 pb-5 pt-1 bg-gray-800/20">
                        {isFVG && item.top_bullish_fvgs && (
                          <FVGExpandedPanel fvgs={item.top_bullish_fvgs} ltp={price} />
                        )}
                        {isSurge && item.surge_history && (
                          <SurgeHistoryTable history={item.surge_history} stats={item.surge_stats} />
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedStock && (
        <AddToWatchlistModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          symbol={selectedStock.symbol}
          companyName={selectedStock.company_name || ""}
          sourceModule={sourceModule}
          currentPrice={ltp(selectedStock) || 0}
        />
      )}
    </>
  );
}
