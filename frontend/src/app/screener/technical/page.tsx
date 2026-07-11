"use client";

import React, { useState, useEffect, useCallback, useMemo, useContext, useRef } from "react";
import { screenerService } from "@/services/screenerService";
import AddToWatchlistModal from "@/components/watchlists/AddToWatchlistModal";
import SavedFiltersPanel from "@/components/screener/SavedFiltersPanel";
import { useScreenerExport } from "@/hooks/useScreenerUtils";
import { Download } from "lucide-react";
import { ScannerContext } from "../context";

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
const FILTERS = [
  {
    key: "rsi", label: "RSI (14)", hint: "0 – 100", step: 1, color: "yellow",
    minParam: "rsi_min", maxParam: "rsi_max",
    description: "Relative Strength Index. 30–70 neutral. <30 oversold, >70 overbought.",
  },
  {
    key: "ema50dist", label: "EMA 50 Dist %", hint: "+5 = 5% above EMA50", step: 0.5, color: "blue",
    minParam: "ema50_dist_min", maxParam: "ema50_dist_max",
    description: "((Price − EMA50) / EMA50) × 100. Positive = bullish alignment. Works at any price level.",
  },
  {
    key: "ema200dist", label: "EMA 200 Dist %", hint: "+10 = 10% above EMA200", step: 0.5, color: "purple",
    minParam: "ema200_dist_min", maxParam: "ema200_dist_max",
    description: "((Price − EMA200) / EMA200) × 100. Long-term trend positioning.",
  },
  {
    key: "macd", label: "MACD Hist", hint: "+ = bullish momentum", step: 0.01, color: "green",
    minParam: "macd_min", maxParam: "macd_max",
    description: "MACD histogram (12,26,9). Positive = bullish crossover momentum.",
  },
  {
    key: "volume", label: "Volume", hint: "shares/day", step: 100000, color: "orange",
    minParam: "volume_min", maxParam: "volume_max",
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
  if (!rsi) return "bg-gray-700 text-gray-400";
  if (rsi >= 70) return "bg-red-500/20 text-red-300 border border-red-500/30";
  if (rsi <= 30) return "bg-green-500/20 text-green-300 border border-green-500/30";
  return "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30";
};
const distColor = (v?: number | null) => {
  if (v == null) return "text-gray-500";
  if (v > 10) return "text-emerald-400 font-semibold";
  if (v > 0)  return "text-emerald-300";
  if (v < -10) return "text-red-400 font-semibold";
  return "text-red-300";
};
const fmtDist = (v?: number | null) =>
  v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;

const colorBorder: Record<string, string> = {
  yellow: "border-yellow-500/50 bg-yellow-500/5",
  blue:   "border-blue-500/50 bg-blue-500/5",
  purple: "border-purple-500/50 bg-purple-500/5",
  green:  "border-green-500/50 bg-green-500/5",
  orange: "border-orange-500/50 bg-orange-500/5",
};
const colorLabel: Record<string, string> = {
  yellow: "text-yellow-400", blue: "text-blue-400",
  purple: "text-purple-400", green: "text-green-400", orange: "text-orange-400",
};

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
  const [tooltip, setTooltip]       = useState<string | null>(null);
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
    <span className="ml-1 text-gray-600 text-[10px]">
      {sortKey === col ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
    </span>
  );

  const handleApply = (e: React.FormEvent) => { e.preventDefault(); fetchStocks(filters); };
  const handleClear = () => { const c = defaultFilters(); setFilters(c); setSearch(""); fetchStocks(c); };
  const activeCount = Object.values(filters).filter(({ min, max }) => min || max).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Technical Screener</h1>
          <div className="flex items-center gap-4 text-xs text-gray-500 mt-1 flex-wrap">
            <span>Last Updated: <span className="text-gray-300 font-semibold">{scanMeta?.last_ran ? formatISTDate(scanMeta.last_ran) : "—"}</span></span>
            <span className="text-gray-700">•</span>
            <span>Stocks: <span className="text-gray-300 font-semibold">{scanMeta?.record_count ?? scanMeta?.symbols_processed ?? allStocks.length}</span></span>
            <span className="text-gray-700">•</span>
            <span>Status: <span className={`font-semibold font-mono uppercase tracking-wider text-[10px] px-1.5 py-0.5 rounded ${
              scanMeta?.status === "RUNNING"
                ? "text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 animate-pulse"
                : scanMeta?.status === "FAILED"
                ? "text-red-400 bg-red-500/10 border border-red-500/20"
                : "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20"
            }`}>{scanMeta?.status || "Ready"}</span></span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {filtered.length > 0 && (
            <button
              onClick={() => exportCSV(filtered, "technical_scan")}
              className="flex items-center gap-1.5 text-xs border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 px-3 py-1.5 rounded-lg transition-all"
            >
              <Download size={11} /> Export CSV
            </button>
          )}
          <SavedFiltersPanel
            scanner="technical"
            currentFilters={filtersToFlat(filters)}
            onLoad={(flat) => { const f = flatToFilters(flat); setFilters(f); fetchStocks(f); }}
          />
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl px-5 py-2 text-center min-w-[80px]">
            <div className="text-2xl font-bold text-blue-400">{filtered.length.toLocaleString()}</div>
            <div className="text-gray-500 text-xs">matched</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <form onSubmit={handleApply} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-sm text-white">Filter Conditions</h2>
            {activeCount > 0 && (
              <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">{activeCount} active</span>
            )}
          </div>
          <button type="button" onClick={handleClear} className="text-xs text-gray-500 hover:text-white transition-colors">
            Clear all
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
          {FILTERS.map((ind) => {
            const f      = filters[ind.key];
            const active = f.min !== "" || f.max !== "";
            return (
              <div
                key={ind.key}
                className={`rounded-xl p-3 border transition-all ${active ? colorBorder[ind.color] : "border-gray-800 bg-gray-800/30"}`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-xs font-semibold ${colorLabel[ind.color]}`}>{ind.label}</span>
                  <button
                    type="button"
                    onMouseEnter={() => setTooltip(ind.key)}
                    onMouseLeave={() => setTooltip(null)}
                    className="text-gray-600 hover:text-gray-300 text-xs"
                  >ⓘ</button>
                </div>
                {tooltip === ind.key && (
                  <div className="text-xs text-gray-400 bg-gray-800 border border-gray-700 rounded-lg p-2 mb-2 leading-relaxed">
                    {ind.description}
                  </div>
                )}
                <span className="text-xs text-gray-600 block mb-1.5">{ind.hint}</span>
                <div className="flex gap-1.5">
                  {["min", "max"].map((side) => (
                    <input
                      key={side}
                      type="number"
                      step={ind.step}
                      placeholder={side === "min" ? "Min" : "Max"}
                      value={(f as any)[side]}
                      onChange={(e) =>
                        setFilters((prev) => ({ ...prev, [ind.key]: { ...prev[ind.key], [side]: e.target.value } }))
                      }
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* EMA explanation */}
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl px-4 py-2 text-xs text-blue-300/70 mb-4">
          💡 <strong>EMA Dist %</strong> = (Price − EMA) / EMA × 100 · Positive = above EMA (bullish) · Comparable across all price levels
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search symbol or company…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 py-2 rounded-xl transition-all disabled:opacity-50 text-sm flex items-center gap-2"
          >
            {loading
              ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Scanning…</>
              : "Apply Filters"}
          </button>
        </div>
      </form>

      {/* Results table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
          <div className="text-sm font-medium text-gray-300">
            {filtered.length > 0
              ? <>Showing <span className="text-white font-semibold">{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)}</span> of <span className="text-white font-semibold">{filtered.length.toLocaleString()}</span></>
              : "No results"}
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-600">
            <span><span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-1" />RSI ≤30 Oversold</span>
            <span><span className="inline-block w-2 h-2 rounded-full bg-red-400 mr-1" />RSI ≥70 Overbought</span>
          </div>
        </div>

        {error ? (
          <div className="m-6 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
            <strong>Error:</strong> {error}
            <p className="text-red-400/60 text-xs mt-1">Start FastAPI: <code className="bg-gray-800 px-1 rounded">uvicorn main:app --port 8000</code></p>
          </div>
        ) : loading && allStocks.length === 0 ? (
          <div className="space-y-3 px-5 py-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-12 rounded-xl bg-gray-800/40 border border-gray-800/30 animate-pulse flex items-center justify-between px-4" style={{ opacity: 1 - i * 0.1 }}>
                <div className="w-8 h-4 bg-gray-700/50 rounded" />
                <div className="w-24 h-4 bg-gray-700/50 rounded" />
                <div className="w-40 h-4 bg-gray-700/50 rounded" />
                <div className="w-16 h-4 bg-gray-700/50 rounded" />
                <div className="w-16 h-4 bg-gray-700/50 rounded" />
                <div className="w-12 h-4 bg-gray-700/50 rounded" />
                <div className="w-12 h-4 bg-gray-700/50 rounded" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-20 gap-3 text-center">
            <div className="text-4xl">🔍</div>
            <p className="text-gray-400 text-sm">No stocks match your filters.</p>
            <p className="text-gray-600 text-xs">Try widening the conditions or click Refresh Data in the toolbar above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-800/40 border-b border-gray-800 text-xs text-gray-400 uppercase tracking-wider">
                  <th className="px-4 py-3 text-left w-10">#</th>
                  {[
                    ["symbol",  "Symbol",       false],
                    ["company", "Company",       false],
                    ["price",   "LTP (₹)",       true ],
                    ["volume",  "Volume",        true ],
                    ["rsi",     "RSI 14",        true ],
                    ["ema50d",  "EMA50 Dist%",   true ],
                    ["ema200d", "EMA200 Dist%",  true ],
                    ["macd",    "MACD Hist",     true ],
                    ["action",  "Action",        false],
                  ].map(([key, lbl, sortable]) => (
                    <th
                      key={key as string}
                      onClick={() => (sortable as boolean) && handleSort(key as string)}
                      className={`px-4 py-3 ${key === "company" || key === "action" ? "text-left" : "text-right"} ${
                        (sortable as boolean) ? "cursor-pointer hover:text-white" : ""
                      } ${key === "rsi" ? "text-yellow-400/70" : key === "ema50d" ? "text-blue-400/70" : key === "ema200d" ? "text-purple-400/70" : key === "macd" ? "text-green-400/70" : ""}`}
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
                    <tr key={s.symbol || idx} className="border-b border-gray-800/50 hover:bg-gray-800/25 transition-colors">
                      <td className="px-4 py-2.5 text-gray-600 text-xs">{absIdx}</td>
                      <td className="px-4 py-2.5">
                        <span className="font-bold text-blue-400 tracking-wide">{s.symbol}</span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-400 text-xs max-w-[180px] truncate">{s.company_name || "—"}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-white font-mono">
                        {s.price ? `₹${s.price.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-400 text-xs">{fmtVol(s.volume)}</td>
                      <td className="px-4 py-2.5 text-right">
                        {ind.rsi_14 != null
                          ? <span className={`px-2 py-0.5 rounded text-xs font-medium ${rsiBadge(ind.rsi_14)}`}>{ind.rsi_14.toFixed(1)}</span>
                          : <span className="text-gray-600">—</span>}
                      </td>
                      <td className={`px-4 py-2.5 text-right text-xs ${distColor(ind.ema_50_dist_pct)}`}>
                        {fmtDist(ind.ema_50_dist_pct)}
                      </td>
                      <td className={`px-4 py-2.5 text-right text-xs ${distColor(ind.ema_200_dist_pct)}`}>
                        {fmtDist(ind.ema_200_dist_pct)}
                      </td>
                      <td className={`px-4 py-2.5 text-right text-xs font-medium ${
                        ind.macd != null ? (ind.macd >= 0 ? "text-emerald-400" : "text-red-400") : "text-gray-600"
                      }`}>
                        {ind.macd != null ? ind.macd.toFixed(2) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => { setSelectedStock(s); setIsModalOpen(true); }}
                          className="text-xs bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-600/40 hover:text-white px-3 py-1.5 rounded-lg transition-all"
                        >
                          + Watch
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
          <div className="flex items-center justify-between px-5 py-4 border-t border-gray-800">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-1.5 text-sm rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-30"
            >← Prev</button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                let p: number;
                if      (totalPages <= 7)        p = i + 1;
                else if (page <= 4)              p = i + 1;
                else if (page >= totalPages - 3) p = totalPages - 6 + i;
                else                             p = page - 3 + i;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-8 h-8 text-xs rounded-lg ${p === page ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}>
                    {p}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-1.5 text-sm rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-30"
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
