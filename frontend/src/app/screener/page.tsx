"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { screenerService } from "@/services/screenerService";
import AddToWatchlistModal from "@/components/watchlists/AddToWatchlistModal";

// ── Filter definitions ────────────────────────────────────────────────────────
const FILTERS = [
    {
        key: "rsi", label: "RSI (14)", hint: "0–100", step: 1, color: "yellow",
        minParam: "rsi_min", maxParam: "rsi_max",
        description: "Relative Strength Index",
    },
    {
        key: "ema50dist", label: "EMA 50 Dist %", hint: "% above/below EMA50", step: 0.5, color: "blue",
        minParam: "ema50_dist_min", maxParam: "ema50_dist_max",
        description: "((Price − EMA50) / EMA50) × 100. +5 = price 5% above EMA50",
    },
    {
        key: "ema200dist", label: "EMA 200 Dist %", hint: "% above/below EMA200", step: 0.5, color: "purple",
        minParam: "ema200_dist_min", maxParam: "ema200_dist_max",
        description: "((Price − EMA200) / EMA200) × 100. Works across all price ranges",
    },
    {
        key: "macd", label: "MACD", hint: "+/− value", step: 0.01, color: "green",
        minParam: "macd_min", maxParam: "macd_max",
        description: "MACD (12,26,9) histogram value",
    },
    {
        key: "volume", label: "Volume", hint: "shares/day", step: 100000, color: "orange",
        minParam: "volume_min", maxParam: "volume_max",
        description: "Today's traded volume",
    },
];

type FilterState = Record<string, { min: string; max: string }>;
const defaultFilters = (): FilterState =>
    Object.fromEntries(FILTERS.map(f => [f.key, { min: "", max: "" }]));

const PAGE_SIZE = 50;

function fmtVol(n?: number | null) {
    if (!n) return "—";
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (n >= 1_000)     return (n / 1_000).toFixed(0) + "K";
    return String(n);
}
function getRsiBadge(rsi?: number | null) {
    if (!rsi) return "bg-gray-700 text-gray-400";
    if (rsi >= 70) return "bg-red-500/20 text-red-300 border border-red-500/30";
    if (rsi <= 30) return "bg-green-500/20 text-green-300 border border-green-500/30";
    return "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30";
}
function getDistColor(v?: number | null) {
    if (v == null) return "text-gray-500";
    if (v > 10)  return "text-green-400 font-semibold";
    if (v > 0)   return "text-green-300";
    if (v < -10) return "text-red-400 font-semibold";
    return "text-red-300";
}
function fmtDist(v?: number | null) {
    if (v == null) return "—";
    return `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
}

export default function ScreenerPage() {
    const [allStocks, setAllStocks] = useState<any[]>([]);
    const [loading, setLoading]     = useState(false);
    const [error, setError]         = useState<string | null>(null);
    const [filters, setFilters]     = useState<FilterState>(defaultFilters());
    const [search, setSearch]       = useState("");
    const [page, setPage]           = useState(1);
    const [sortKey, setSortKey]     = useState("volume");
    const [sortDir, setSortDir]     = useState<"asc" | "desc">("desc");
    const [tooltip, setTooltip]     = useState<string | null>(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedStock, setSelectedStock] = useState<any | null>(null);

    const handleAddClick = (stock: any) => {
        setSelectedStock(stock);
        setIsModalOpen(true);
    };

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
            setError(err?.message || "Network error — is FastAPI running?");
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchStocks(defaultFilters()); }, [fetchStocks]);

    const filtered = useMemo(() => {
        let rows = allStocks;
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            rows = rows.filter(s =>
                s.symbol?.toLowerCase().includes(q) || s.company_name?.toLowerCase().includes(q)
            );
        }
        return [...rows].sort((a, b) => {
            let av: any = 0, bv: any = 0;
            if      (sortKey === "symbol")    { av = a.symbol; bv = b.symbol; }
            else if (sortKey === "price")     { av = a.price ?? 0; bv = b.price ?? 0; }
            else if (sortKey === "volume")    { av = a.volume ?? 0; bv = b.volume ?? 0; }
            else if (sortKey === "rsi")       { av = a.indicators?.rsi_14 ?? 0; bv = b.indicators?.rsi_14 ?? 0; }
            else if (sortKey === "ema50d")    { av = a.indicators?.ema_50_dist_pct ?? -999; bv = b.indicators?.ema_50_dist_pct ?? -999; }
            else if (sortKey === "ema200d")   { av = a.indicators?.ema_200_dist_pct ?? -999; bv = b.indicators?.ema_200_dist_pct ?? -999; }
            else if (sortKey === "macd")      { av = a.indicators?.macd ?? 0; bv = b.indicators?.macd ?? 0; }
            if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
            return sortDir === "asc" ? av - bv : bv - av;
        });
    }, [allStocks, search, sortKey, sortDir]);

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const pageRows   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const handleSort = (key: string) => {
        if (key === sortKey) setSortDir(d => d === "asc" ? "desc" : "asc");
        else { setSortKey(key); setSortDir("desc"); }
    };
    const SortIcon = ({ col }: { col: string }) => (
        <span className="ml-1 text-gray-600">{sortKey === col ? (sortDir === "asc" ? "↑" : "↓") : "↕"}</span>
    );

    const handleApply = (e: React.FormEvent) => { e.preventDefault(); fetchStocks(filters); };
    const handleClear = () => { const c = defaultFilters(); setFilters(c); setSearch(""); fetchStocks(c); };
    const activeCount = Object.values(filters).filter(({ min, max }) => min || max).length;

    // Color map for filter card borders
    const colorMap: Record<string, string> = {
        yellow: "border-yellow-500/50 bg-yellow-500/5",
        blue:   "border-blue-500/50 bg-blue-500/5",
        purple: "border-purple-500/50 bg-purple-500/5",
        green:  "border-green-500/50 bg-green-500/5",
        orange: "border-orange-500/50 bg-orange-500/5",
    };
    const labelMap: Record<string, string> = {
        yellow: "text-yellow-400", blue: "text-blue-400",
        purple: "text-purple-400", green: "text-green-400", orange: "text-orange-400",
    };

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            <div className="max-w-[1600px] mx-auto px-6 py-8 space-y-5">

                {/* Header */}
                <div className="flex items-start justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Technical Screener</h1>
                        <p className="text-gray-400 text-sm mt-1">
                            {loading ? "Loading…" : `${filtered.length.toLocaleString()} stocks matched · ${allStocks.length.toLocaleString()} total NSE universe`}
                        </p>
                    </div>
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl px-5 py-2 text-center">
                        <div className="text-2xl font-bold text-blue-400">{filtered.length.toLocaleString()}</div>
                        <div className="text-gray-400 text-xs">matched</div>
                    </div>
                </div>

                {/* Filter Panel */}
                <form onSubmit={handleApply} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <h2 className="font-semibold text-sm">Filter Conditions</h2>
                            {activeCount > 0 && (
                                <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">{activeCount} active</span>
                            )}
                        </div>
                        <button type="button" onClick={handleClear} className="text-xs text-gray-500 hover:text-white">Clear all</button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
                        {FILTERS.map(ind => {
                            const f      = filters[ind.key];
                            const active = f.min !== "" || f.max !== "";
                            return (
                                <div key={ind.key}
                                    className={`rounded-xl p-3 border transition-all ${active ? colorMap[ind.color] : "border-gray-800 bg-gray-800/30"}`}>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className={`text-xs font-semibold ${labelMap[ind.color]}`}>{ind.label}</span>
                                        <button type="button"
                                            onMouseEnter={() => setTooltip(ind.key)}
                                            onMouseLeave={() => setTooltip(null)}
                                            className="text-gray-600 hover:text-gray-300 text-xs">ⓘ</button>
                                    </div>
                                    {tooltip === ind.key && (
                                        <div className="text-xs text-gray-400 bg-gray-800 border border-gray-700 rounded-lg p-2 mb-2">
                                            {ind.description}
                                        </div>
                                    )}
                                    <span className="text-xs text-gray-600 block mb-1.5">{ind.hint}</span>
                                    <div className="flex gap-1.5">
                                        <input type="number" step={ind.step} placeholder="Min" value={f.min}
                                            onChange={e => setFilters(prev => ({ ...prev, [ind.key]: { ...prev[ind.key], min: e.target.value } }))}
                                            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
                                        />
                                        <input type="number" step={ind.step} placeholder="Max" value={f.max}
                                            onChange={e => setFilters(prev => ({ ...prev, [ind.key]: { ...prev[ind.key], max: e.target.value } }))}
                                            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* EMA Distance explainer */}
                    <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl px-4 py-2 text-xs text-blue-300/80 mb-4">
                        💡 <strong>EMA Distance %</strong> = (Price − EMA) / EMA × 100 · Positive = price above EMA (bullish) · Works across all price levels
                        <span className="ml-3 text-gray-500">Example: EMA200 Dist &gt; +5% filters stocks trading 5%+ above their 200-day average</span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                        <div className="relative flex-1 max-w-sm">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
                            <input type="text" placeholder="Search symbol or company…"
                                value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                                className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                            />
                        </div>
                        <button type="submit" disabled={loading}
                            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 py-2 rounded-xl transition-all disabled:opacity-50 text-sm">
                            {loading ? <span className="flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Scanning…</span> : "Apply Filters"}
                        </button>
                    </div>
                </form>

                {/* Results Table */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
                        <div className="text-sm font-medium text-gray-300">
                            {filtered.length > 0
                                ? <>Showing <span className="text-white font-semibold">{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)}</span> of <span className="text-white font-semibold">{filtered.length.toLocaleString()}</span></>
                                : "No results"}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span><span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-1" />RSI &lt; 30: Oversold</span>
                            <span><span className="inline-block w-2 h-2 rounded-full bg-red-400 mr-1" />RSI &gt; 70: Overbought</span>
                        </div>
                    </div>

                    {error ? (
                        <div className="m-6 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
                            <strong>Error:</strong> {error}
                        </div>
                    ) : loading ? (
                        <div className="flex flex-col items-center justify-center py-24 gap-3">
                            <div className="w-10 h-10 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                            <p className="text-gray-400 text-sm">Fetching 2,000+ stocks…</p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center py-24 gap-2">
                            <div className="text-4xl">🔍</div>
                            <p className="text-gray-400">No stocks match your filters.</p>
                            <p className="text-gray-600 text-xs">Run: <code className="bg-gray-800 px-1 rounded">python backend/fastapi_app/scripts/populate_screener.py</code> to refresh data</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-800/40 border-b border-gray-800 text-xs text-gray-400 uppercase tracking-wider">
                                        <th className="px-4 py-3 text-left w-10">#</th>
                                        <th className="px-4 py-3 text-left cursor-pointer hover:text-white" onClick={() => handleSort("symbol")}>Symbol <SortIcon col="symbol" /></th>
                                        <th className="px-4 py-3 text-left">Company</th>
                                        <th className="px-4 py-3 text-right cursor-pointer hover:text-white" onClick={() => handleSort("price")}>LTP (₹) <SortIcon col="price" /></th>
                                        <th className="px-4 py-3 text-right cursor-pointer hover:text-white" onClick={() => handleSort("volume")}>Volume <SortIcon col="volume" /></th>
                                        <th className="px-4 py-3 text-right cursor-pointer hover:text-white text-yellow-400" onClick={() => handleSort("rsi")}>RSI 14 <SortIcon col="rsi" /></th>
                                        <th className="px-4 py-3 text-right cursor-pointer hover:text-white text-blue-400" onClick={() => handleSort("ema50d")}>EMA50 Dist% <SortIcon col="ema50d" /></th>
                                        <th className="px-4 py-3 text-right cursor-pointer hover:text-white text-purple-400" onClick={() => handleSort("ema200d")}>EMA200 Dist% <SortIcon col="ema200d" /></th>
                                        <th className="px-4 py-3 text-right cursor-pointer hover:text-white text-green-400" onClick={() => handleSort("macd")}>MACD <SortIcon col="macd" /></th>
                                        <th className="px-4 py-3 text-right text-gray-400 uppercase tracking-wider">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pageRows.map((s, idx) => {
                                        const ind    = s.indicators;
                                        const absIdx = (page - 1) * PAGE_SIZE + idx + 1;
                                        return (
                                            <tr key={s.symbol || idx} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                                                <td className="px-4 py-2.5 text-gray-600 text-xs">{absIdx}</td>
                                                <td className="px-4 py-2.5">
                                                    <span className="font-bold text-blue-400 text-sm">{s.symbol}</span>
                                                </td>
                                                <td className="px-4 py-2.5 text-gray-300 text-xs max-w-[200px] truncate">{s.company_name || "—"}</td>
                                                <td className="px-4 py-2.5 text-right font-semibold text-white">
                                                    {s.price ? `₹${s.price.toFixed(2)}` : "—"}
                                                </td>
                                                <td className="px-4 py-2.5 text-right text-gray-400 text-xs">{fmtVol(s.volume)}</td>
                                                <td className="px-4 py-2.5 text-right">
                                                    {ind?.rsi_14 != null
                                                        ? <span className={`px-2 py-0.5 rounded text-xs font-medium ${getRsiBadge(ind.rsi_14)}`}>{ind.rsi_14.toFixed(1)}</span>
                                                        : <span className="text-gray-600">—</span>}
                                                </td>
                                                <td className={`px-4 py-2.5 text-right text-xs ${getDistColor(ind?.ema_50_dist_pct)}`}>
                                                    {fmtDist(ind?.ema_50_dist_pct)}
                                                </td>
                                                <td className={`px-4 py-2.5 text-right text-xs ${getDistColor(ind?.ema_200_dist_pct)}`}>
                                                    {fmtDist(ind?.ema_200_dist_pct)}
                                                </td>
                                                <td className={`px-4 py-2.5 text-right text-xs font-medium ${ind?.macd != null ? (ind.macd >= 0 ? "text-green-400" : "text-red-400") : "text-gray-600"}`}>
                                                    {ind?.macd != null ? ind.macd.toFixed(2) : "—"}
                                                </td>
                                                <td className="px-4 py-2.5 text-right">
                                                    <button 
                                                        onClick={() => handleAddClick(s)}
                                                        className="text-xs bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-600/40 hover:text-white px-3 py-1.5 rounded transition-colors"
                                                    >
                                                        + Watchlist
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
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                                className="px-4 py-1.5 text-sm rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed">← Prev</button>
                            <div className="flex items-center gap-1">
                                {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                                    let p: number;
                                    if      (totalPages <= 7)         p = i + 1;
                                    else if (page <= 4)               p = i + 1;
                                    else if (page >= totalPages - 3)  p = totalPages - 6 + i;
                                    else                              p = page - 3 + i;
                                    return (
                                        <button key={p} onClick={() => setPage(p)}
                                            className={`w-8 h-8 text-xs rounded-lg ${p === page ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}>
                                            {p}
                                        </button>
                                    );
                                })}
                            </div>
                            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                                className="px-4 py-1.5 text-sm rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed">Next →</button>
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
        </div>
    );
}
