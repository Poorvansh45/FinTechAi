"use client";

import React, { useState, useEffect, useCallback, useMemo, useContext, useRef } from "react";
import { screenerService } from "@/services/screenerService";
import AddToWatchlistModal from "@/components/watchlists/AddToWatchlistModal";
import SavedFiltersPanel from "@/components/screener/SavedFiltersPanel";
import { useScreenerExport } from "@/hooks/useScreenerUtils";
import { Download, Search, SearchX, Info } from "lucide-react";
import { ScannerContext } from "../context";
import {
  RangeFilter,
  RSI_PRESETS,
  EMA_DIST_PRESETS,
  VOLUME_PRESETS,
} from "@/components/screener/filters";

const formatISTDate = (isoString: string) => {
  try {
    const date = new Date(isoString);
    const options = { timeZone: "Asia/Kolkata", day: "2-digit" as const, month: "short" as const, year: "numeric" as const, hour: "2-digit" as const, minute: "2-digit" as const, hour12: false };
    const formatter = new Intl.DateTimeFormat("en-IN", options);
    const parts = formatter.formatToParts(date);
    const partMap = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return `${partMap.day} ${partMap.month} ${partMap.year} ${partMap.hour}:${partMap.minute} IST`;
  } catch {
    return "—";
  }
};


// ── Filter config ─────────────────────────────────────────────────────────────
// `bounds` drive the slider only; typed values are never clamped to them, so
// every value that worked before still works.
const FILTERS = [
  {
    key: "rsi", label: "RSI (14)", hint: "0 – 100", step: 1, color: "yellow",
    minParam: "rsi_min", maxParam: "rsi_max",
    bounds: [0, 100] as [number, number], accent: "amber" as const, presets: RSI_PRESETS,
    description: "Relative Strength Index. 30–70 neutral. <30 oversold, >70 overbought.",
  },
  {
    key: "ema50dist", label: "EMA 50 Dist %", hint: "+5 = 5% above EMA50", step: 0.5, color: "blue",
    minParam: "ema50_dist_min", maxParam: "ema50_dist_max",
    bounds: [-50, 50] as [number, number], accent: "blue" as const, unit: "%", presets: EMA_DIST_PRESETS,
    description: "((Price − EMA50) / EMA50) × 100. Positive = bullish alignment. Works at any price level.",
  },
  {
    key: "ema200dist", label: "EMA 200 Dist %", hint: "+10 = 10% above EMA200", step: 0.5, color: "purple",
    minParam: "ema200_dist_min", maxParam: "ema200_dist_max",
    bounds: [-50, 50] as [number, number], accent: "purple" as const, unit: "%", presets: EMA_DIST_PRESETS,
    description: "((Price − EMA200) / EMA200) × 100. Long-term trend positioning.",
  },
  {
    key: "macd", label: "MACD Hist", hint: "+ = bullish momentum", step: 0.1, color: "green",
    minParam: "macd_min", maxParam: "macd_max",
    bounds: [-20, 20] as [number, number], accent: "emerald" as const,
    presets: [
      { label: "Bullish >0", min: 0, max: null },
      { label: "Bearish <0", min: null, max: 0 },
    ],
    description: "MACD histogram (12,26,9). Positive = bullish crossover momentum.",
  },
  {
    key: "volume", label: "Volume", hint: "shares/day", step: 100000, color: "orange",
    minParam: "volume_min", maxParam: "volume_max",
    bounds: [0, 20_000_000] as [number, number], accent: "orange" as const, presets: VOLUME_PRESETS,
    description: "Today's traded volume in shares.",
  },
];

type FilterState = Record<string, { min: string; max: string }>;
const defaultFilters = (): FilterState =>
  Object.fromEntries(FILTERS.map((f) => [f.key, { min: "", max: "" }]));

const PAGE_SIZE = 50;

// ── Formatters ────────────────────────────────────────────────────────────────
const fmtVol = (n?: number | null) => {
  if (!n) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(0) + "K";
  return String(n);
};
const rsiBadge = (rsi?: number | null) => {
  if (!rsi) return "bg-neutral-700 text-neutral-400";
  if (rsi >= 70) return "bg-negative-500/20 text-negative-300 border border-negative-500/30";
  if (rsi <= 30) return "bg-positive-500/20 text-positive-300 border border-positive-500/30";
  return "bg-warning-500/20 text-warning-300 border border-warning-500/30";
};
const distColor = (v?: number | null) => {
  if (v == null) return "text-neutral-500";
  if (v > 10) return "text-positive-400 font-semibold";
  if (v > 0)  return "text-positive-300";
  if (v < -10) return "text-negative-400 font-semibold";
  return "text-negative-300";
};
const fmtDist = (v?: number | null) =>
  v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;

// ── Preset serialiser ─────────────────────────────────────────────────────────
const filtersToFlat = (f: FilterState): Record<string, string> => {
  const out: Record<string, string> = {};
  FILTERS.forEach(({ key }) => {
    out[`${key}_min`] = f[key].min;
    out[`${key}_max`] = f[key].max;
  });
  return out;
};
const flatToFilters = (flat: Record<string, any>): FilterState => {
  const f = defaultFilters();
  FILTERS.forEach(({ key }) => {
    f[key].min = String(flat[`${key}_min`] ?? "");
    f[key].max = String(flat[`${key}_max`] ?? "");
  });
  return f;
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function ScreenerPage() {
  const [allStocks, setAllStocks]   = useState<any[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [filters, setFilters]       = useState<FilterState>(defaultFilters());
  const [search, setSearch]         = useState("");
  const [page, setPage]             = useState(1);
  const [sortKey, setSortKey]       = useState("volume");
  const [sortDir, setSortDir]       = useState<"asc" | "desc">("desc");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState<any | null>(null);
  const { exportCSV } = useScreenerExport();

  const { scanMeta, registerData, registerRefresh, registerSearch } = useContext(ScannerContext);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    registerSearch(searchInputRef);
  }, [registerSearch]);

  useEffect(() => {
    registerData(allStocks);
  }, [allStocks, registerData]);

  const fetchStocks = useCallback(async (f: FilterState) => {
    setLoading(true); setError(null); setPage(1);
    try {
      const params: Record<string, any> = { limit: 2500 };
      FILTERS.forEach(({ key, minParam, maxParam }) => {
        if (f[key].min !== "") params[minParam] = Number(f[key].min);
        if (f[key].max !== "") params[maxParam] = Number(f[key].max);
      });
      const resp = await screenerService.getTechnicalFilters(params);
      if (resp.data?.success) setAllStocks(resp.data.data);
      else setError(resp.data?.error || "Failed to fetch");
    } catch (err: any) {
      setError(err?.message || "Network error — is FastAPI running on port 8000?");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchStocks(defaultFilters()); }, [fetchStocks]);

  useEffect(() => {
    registerRefresh(() => fetchStocks(filters));
  }, [registerRefresh, fetchStocks, filters]);


  const filtered = useMemo(() => {
    let rows = allStocks;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((s) =>
        s.symbol?.toLowerCase().includes(q) || s.company_name?.toLowerCase().includes(q)
      );
    }
    return [...rows].sort((a, b) => {
      let av: any = 0, bv: any = 0;
      if      (sortKey === "symbol")  { av = a.symbol; bv = b.symbol; }
      else if (sortKey === "price")   { av = a.price ?? 0; bv = b.price ?? 0; }
      else if (sortKey === "volume")  { av = a.volume ?? 0; bv = b.volume ?? 0; }
      else if (sortKey === "rsi")     { av = a.indicators?.rsi_14 ?? 0; bv = b.indicators?.rsi_14 ?? 0; }
      else if (sortKey === "ema50d")  { av = a.indicators?.ema_50_dist_pct  ?? -999; bv = b.indicators?.ema_50_dist_pct  ?? -999; }
      else if (sortKey === "ema200d") { av = a.indicators?.ema_200_dist_pct ?? -999; bv = b.indicators?.ema_200_dist_pct ?? -999; }
      else if (sortKey === "macd")    { av = a.indicators?.macd ?? 0; bv = b.indicators?.macd ?? 0; }
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [allStocks, search, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageRows   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSort = (key: string) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };
  const SortIcon = ({ col }: { col: string }) => (
    <span className="ml-1 text-neutral-500 text-[11px]">
      {sortKey === col ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
    </span>
  );

  const handleApply = (e: React.FormEvent) => { e.preventDefault(); fetchStocks(filters); };
  const handleClear = () => { const c = defaultFilters(); setFilters(c); setSearch(""); fetchStocks(c); };
  const activeCount = Object.values(filters).filter(({ min, max }) => min || max).length;

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Technical Screener</h1>
          <div className="flex items-center gap-2 sm:gap-4 text-xs text-neutral-500 mt-1 flex-wrap">
            <span>Updated: <span className="text-neutral-300 font-semibold">{scanMeta?.last_ran ? formatISTDate(scanMeta.last_ran) : "—"}</span></span>
            <span className="text-neutral-500">•</span>
            <span>Stocks: <span className="text-neutral-300 font-semibold">{scanMeta?.record_count ?? scanMeta?.symbols_processed ?? allStocks.length}</span></span>
            <span className="text-neutral-500">•</span>
            <span>Status: <span className={`font-semibold font-mono text-[11px] px-1.5 py-0.5 rounded ${
              scanMeta?.status === "RUNNING"
                ? "text-warning-400 bg-warning-500/10 border border-warning-500/20 animate-pulse"
                : scanMeta?.status === "FAILED"
                ? "text-negative-400 bg-negative-500/10 border border-negative-500/20"
                : "text-positive-400 bg-positive-500/10 border border-positive-500/20"
            }`}>{scanMeta?.status || "Ready"}</span></span>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {filtered.length > 0 && (
            <button
              onClick={() => exportCSV(filtered, "technical_scan")}
              className="flex items-center gap-1.5 text-xs border border-neutral-700 text-neutral-400 hover:text-foreground hover:border-neutral-500 px-2.5 sm:px-3 py-1.5 rounded-lg transition-all"
            >
              <Download size={11} /> <span className="hidden sm:inline">Export CSV</span>
            </button>
          )}
          <SavedFiltersPanel
            scanner="technical"
            currentFilters={filtersToFlat(filters)}
            onLoad={(flat) => { const f = flatToFilters(flat); setFilters(f); fetchStocks(f); }}
          />
          <div className="bg-brand-500/10 border border-brand-500/30 rounded-xl px-3 sm:px-5 py-2 text-center min-w-[60px] sm:min-w-[80px]">
            <div className="text-xl sm:text-2xl font-bold text-brand-400">{filtered.length.toLocaleString()}</div>
            <div className="text-neutral-500 text-xs">matched</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <form onSubmit={handleApply} className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-sm text-foreground">Filter Conditions</h2>
            {activeCount > 0 && (
              <span className="bg-brand-600 text-white text-xs px-2 py-0.5 rounded-md">{activeCount} active</span>
            )}
          </div>
          <button type="button" onClick={handleClear} className="text-xs text-neutral-500 hover:text-foreground transition-colors">
            Clear all
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2.5 mb-4">
          {FILTERS.map((ind) => {
            const f = filters[ind.key];
            return (
              <RangeFilter
                key={ind.key}
                label={ind.label}
                description={`${ind.description} (${ind.hint})`}
                value={{
                  min: f.min === "" ? null : Number(f.min),
                  max: f.max === "" ? null : Number(f.max),
                }}
                onChange={(next) =>
                  setFilters((prev) => ({
                    ...prev,
                    [ind.key]: {
                      min: next.min === null ? "" : String(next.min),
                      max: next.max === null ? "" : String(next.max),
                    },
                  }))
                }
                min={ind.bounds[0]}
                max={ind.bounds[1]}
                step={ind.step}
                unit={(ind as any).unit}
                presets={ind.presets}
                accent={ind.accent}
              />
            );
          })}
        </div>

        {/* EMA explanation */}
        <div className="bg-brand-500/5 border border-brand-500/20 rounded-xl px-4 py-2 text-xs text-neutral-300 mb-4">
          <Info className="mr-1 inline h-3.5 w-3.5 align-text-bottom" aria-hidden /> <strong>EMA Dist %</strong> = (Price − EMA) / EMA × 100 · Positive = above EMA (bullish) · Comparable across all price levels
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" aria-hidden />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search symbol or company…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-sm text-foreground placeholder-neutral-500 focus:outline-none focus:border-brand-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-brand-600 hover:bg-brand-500 text-white font-semibold px-6 sm:px-8 py-2 rounded-xl transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-2"
          >
            {loading
              ? <><span className="w-3.5 h-3.5 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" />Scanning…</>
              : "Apply Filters"}
          </button>
        </div>
      </form>

      {/* Results table */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-3 sm:px-5 py-3 border-b border-neutral-800">
          <div className="text-sm font-medium text-neutral-300">
            {filtered.length > 0
              ? <>Showing <span className="text-foreground font-semibold">{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)}</span> of <span className="text-foreground font-semibold">{filtered.length.toLocaleString()}</span></>
              : "No results"}
          </div>
          <div className="hidden sm:flex items-center gap-4 text-xs text-neutral-500">
            <span><span className="inline-block w-2 h-2 rounded-full bg-positive-400 mr-1" />RSI ≤30 Oversold</span>
            <span><span className="inline-block w-2 h-2 rounded-full bg-negative-400 mr-1" />RSI ≥70 Overbought</span>
          </div>
        </div>

        {error ? (
          <div className="m-6 bg-negative-500/10 border border-negative-500/30 rounded-xl p-4 text-negative-400 text-sm">
            <strong>Error:</strong> {error}
            <p className="text-negative-400 text-xs mt-1">Start FastAPI: <code className="bg-neutral-800 px-1 rounded">uvicorn main:app --port 8000</code></p>
          </div>
        ) : loading && allStocks.length === 0 ? (
          <div className="space-y-3 px-5 py-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-12 rounded-xl bg-neutral-800/40 border border-neutral-800/30 animate-pulse flex items-center justify-between px-4" style={{ opacity: 1 - i * 0.1 }}>
                <div className="w-8 h-4 bg-neutral-700/50 rounded" />
                <div className="w-24 h-4 bg-neutral-700/50 rounded" />
                <div className="w-40 h-4 bg-neutral-700/50 rounded" />
                <div className="w-16 h-4 bg-neutral-700/50 rounded" />
                <div className="w-16 h-4 bg-neutral-700/50 rounded" />
                <div className="w-12 h-4 bg-neutral-700/50 rounded" />
                <div className="w-12 h-4 bg-neutral-700/50 rounded" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-20 gap-3 text-center">
            <SearchX className="h-10 w-10 text-neutral-500" aria-hidden />
            <p className="text-neutral-400 text-sm">No stocks match your filters.</p>
            <p className="text-neutral-500 text-xs">Try widening the conditions or click Refresh Data in the toolbar above.</p>
          </div>
        ) : (
          <div className="mobile-table-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-800/40 border-b border-neutral-800 text-xs text-neutral-400">
                  <th className="px-3 sm:px-4 py-3 text-left w-8 sm:w-10">#</th>
                  {[
                    ["symbol",  "Symbol",       false, ""],
                    ["company", "Company",       false, "hidden sm:table-cell"],
                    ["price",   "LTP (₹)",       true,  ""],
                    ["volume",  "Volume",        true,  "hidden sm:table-cell"],
                    ["rsi",     "RSI 14",        true,  ""],
                    ["ema50d",  "EMA50%",        true,  ""],
                    ["ema200d", "EMA200%",       true,  "hidden sm:table-cell"],
                    ["macd",    "MACD",          true,  ""],
                    ["action",  "",              false, ""],
                  ].map(([key, lbl, sortable, extraCls]) => (
                    <th
                      key={key as string}
                      onClick={() => (sortable as boolean) && handleSort(key as string)}
                      className={`px-2 sm:px-4 py-3 ${key === "company" || key === "action" ? "text-left" : "text-right"} ${
                        (sortable as boolean) ? "cursor-pointer hover:text-foreground" : ""
                      } ${key === "rsi" ? "text-warning-400" : key === "ema50d" ? "text-brand-400" : key === "ema200d" ? "text-brand-400" : key === "macd" ? "text-positive-400" : ""} ${extraCls as string}`}
                    >
                      {lbl}
                      {(sortable as boolean) && <SortIcon col={key as string} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((s, idx) => {
                  const ind    = s.indicators ?? {};
                  const absIdx = (page - 1) * PAGE_SIZE + idx + 1;
                  return (
                    <tr key={s.symbol || idx} className="border-b border-neutral-800/50 hover:bg-neutral-800/25 transition-colors">
                      <td className="px-3 sm:px-4 py-2.5 text-neutral-500 text-xs">{absIdx}</td>
                      <td className="px-3 sm:px-4 py-2.5">
                        <span className="font-bold text-brand-400 tracking-wide text-xs sm:text-sm">{s.symbol}</span>
                      </td>
                      <td className="hidden sm:table-cell px-4 py-2.5 text-neutral-400 text-xs max-w-[180px] truncate">{s.company_name || "—"}</td>
                      <td className="px-2 sm:px-4 py-2.5 text-right font-semibold text-foreground font-mono text-xs sm:text-sm">
                        {s.price ? `₹${s.price.toFixed(2)}` : "—"}
                      </td>
                      <td className="hidden sm:table-cell px-4 py-2.5 text-right text-neutral-400 text-xs">{fmtVol(s.volume)}</td>
                      <td className="px-2 sm:px-4 py-2.5 text-right">
                        {ind.rsi_14 != null
                          ? <span className={`px-1.5 sm:px-2 py-0.5 rounded text-xs font-medium ${rsiBadge(ind.rsi_14)}`}>{ind.rsi_14.toFixed(1)}</span>
                          : <span className="text-neutral-500">—</span>}
                      </td>
                      <td className={`px-2 sm:px-4 py-2.5 text-right text-xs ${distColor(ind.ema_50_dist_pct)}`}>
                        {fmtDist(ind.ema_50_dist_pct)}
                      </td>
                      <td className={`hidden sm:table-cell px-4 py-2.5 text-right text-xs ${distColor(ind.ema_200_dist_pct)}`}>
                        {fmtDist(ind.ema_200_dist_pct)}
                      </td>
                      <td className={`px-2 sm:px-4 py-2.5 text-right text-xs font-medium ${
                        ind.macd != null ? (ind.macd >= 0 ? "text-positive-400" : "text-negative-400") : "text-neutral-500"
                      }`}>
                        {ind.macd != null ? ind.macd.toFixed(2) : "—"}
                      </td>
                      <td className="px-2 sm:px-4 py-2.5 text-right">
                        <button
                          onClick={() => { setSelectedStock(s); setIsModalOpen(true); }}
                          className="text-xs bg-brand-600/20 text-brand-400 border border-brand-500/30 hover:bg-brand-600/40 hover:text-foreground px-2 sm:px-3 py-1.5 rounded-lg transition-all"
                        >
                          <span className="hidden sm:inline">+ Watch</span>
                          <span className="sm:hidden">+</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-3 sm:px-5 py-3 sm:py-4 border-t border-neutral-800">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 sm:px-4 py-1.5 text-xs sm:text-sm rounded-lg bg-neutral-800 text-neutral-300 hover:bg-neutral-700 disabled:opacity-30"
            >← Prev</button>
            <div className="flex items-center gap-0.5 sm:gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p: number;
                if      (totalPages <= 5)        p = i + 1;
                else if (page <= 3)              p = i + 1;
                else if (page >= totalPages - 2) p = totalPages - 4 + i;
                else                             p = page - 2 + i;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-7 h-7 sm:w-8 sm:h-8 text-xs rounded-lg ${p === page ? "bg-brand-600 text-white" : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"}`}>
                    {p}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 sm:px-4 py-1.5 text-xs sm:text-sm rounded-lg bg-neutral-800 text-neutral-300 hover:bg-neutral-700 disabled:opacity-30"
            >Next →</button>
          </div>
        )}
      </div>

      {selectedStock && (
        <AddToWatchlistModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          symbol={selectedStock.symbol}
          companyName={selectedStock.company_name || ""}
          sourceModule="Technical Screener"
          currentPrice={selectedStock.price || 0}
        />
      )}
    </div>
  );
}
