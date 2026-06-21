"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { screenerService } from "@/services/screenerService";
import { PlusIcon } from "@heroicons/react/24/outline";
import AddToWatchlistModal from "@/components/watchlists/AddToWatchlistModal";

interface SurgeEvent {
    date: string;
    volume: number;
    volume_ratio: number;
    day_return: number;
    close: number;
}
interface VolumeSurgeStock {
    symbol: string;
    company_name: string;
    price: number;
    volume: number;
    avg_volume_20d: number;
    volume_ratio: number;
    day_return_pct: number;
    surge_stats: {
        max_ratio_3yr: number;
        avg_return_on_surge: number;
        total_surge_days_3yr: number;
        positive_surge_pct: number;
        avg_return_2d?: number;
        avg_return_5d?: number;
        avg_return_10d?: number;
        win_rate_5d?: number;
    };
    recent_surge_events: SurgeEvent[];
    has_current_surge: boolean;
}

const PAGE_SIZE = 50;

function fmtVol(n: number | null | undefined): string {
    if (!n) return "—";
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
    return String(n);
}
function getRatioBadge(r: number | null | undefined): string {
    if (!r) return "bg-gray-700 text-gray-400";
    if (r >= 5) return "bg-red-500/20 text-red-300 border border-red-500/40";
    if (r >= 3) return "bg-orange-500/20 text-orange-300 border border-orange-500/40";
    if (r >= 2) return "bg-yellow-500/20 text-yellow-300 border border-yellow-500/40";
    return "bg-gray-700/60 text-gray-400";
}
function getReturnColor(r: number | null | undefined): string {
    if (r == null) return "text-gray-500";
    if (r > 5)  return "text-green-400 font-bold";
    if (r > 0)  return "text-green-300";
    if (r < -5) return "text-red-400 font-bold";
    if (r < 0)  return "text-red-300";
    return "text-gray-400";
}

const defaultFilters = () => ({
    volume_ratio_min: "", day_return_min: "", day_return_max: "",
    surges_3yr_min: "", positive_surge_pct_min: "", current_surge_only: false,
});

export default function VolumeSurgePage() {
    const [allStocks, setAllStocks]       = useState<VolumeSurgeStock[]>([]);
    const [loading, setLoading]           = useState(false);
    const [error, setError]               = useState<string | null>(null);
    const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);
    const [filters, setFilters]           = useState(defaultFilters());
    const [search, setSearch]             = useState("");
    const [page, setPage]                 = useState(1);
    const [sortKey, setSortKey]           = useState("volume_ratio");
    const [sortDir, setSortDir]           = useState<"asc"|"desc">("desc");

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedStock, setSelectedStock] = useState<any>(null);

    const handleAddClick = (stock: VolumeSurgeStock, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedStock({
            symbol: stock.symbol,
            company_name: stock.company_name,
            price: stock.price
        });
        setIsModalOpen(true);
    };

    const fetchData = useCallback(async (f: ReturnType<typeof defaultFilters>) => {
        setLoading(true); setError(null); setPage(1);
        try {
            const params: Record<string, any> = { limit: 2500 };
            if (f.volume_ratio_min !== "")       params.volume_ratio_min       = Number(f.volume_ratio_min);
            if (f.day_return_min !== "")          params.day_return_min          = Number(f.day_return_min);
            if (f.day_return_max !== "")          params.day_return_max          = Number(f.day_return_max);
            if (f.surges_3yr_min !== "")          params.surges_3yr_min          = Number(f.surges_3yr_min);
            if (f.positive_surge_pct_min !== "")  params.positive_surge_pct_min  = Number(f.positive_surge_pct_min);
            if (f.current_surge_only)             params.current_surge_only      = true;
            const resp = await screenerService.getVolumeSurges(params);
            if (resp.data?.success) setAllStocks(resp.data.data);
            else setError(resp.data?.error || "Failed to fetch");
        } catch (err: any) {
            setError(err?.message || "Network error");
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchData(defaultFilters()); }, [fetchData]);

    // Client-side search + sort
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
            if (sortKey === "symbol")          { av = a.symbol; bv = b.symbol; }
            else if (sortKey === "price")      { av = a.price ?? 0; bv = b.price ?? 0; }
            else if (sortKey === "volume")     { av = a.volume ?? 0; bv = b.volume ?? 0; }
            else if (sortKey === "volume_ratio"){ av = a.volume_ratio ?? 0; bv = b.volume_ratio ?? 0; }
            else if (sortKey === "day_return") { av = a.day_return_pct ?? 0; bv = b.day_return_pct ?? 0; }
            else if (sortKey === "surges_3yr") { av = a.surge_stats?.total_surge_days_3yr ?? 0; bv = b.surge_stats?.total_surge_days_3yr ?? 0; }
            else if (sortKey === "pos_pct")    { av = a.surge_stats?.positive_surge_pct ?? 0; bv = b.surge_stats?.positive_surge_pct ?? 0; }
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
        <span className="ml-1 opacity-50">{sortKey === col ? (sortDir === "asc" ? "↑" : "↓") : "↕"}</span>
    );

    const handleApply = (e: React.FormEvent) => { e.preventDefault(); fetchData(filters); };
    const handleClear = () => { const c = defaultFilters(); setFilters(c); setSearch(""); fetchData(c); };

    const surgingNow = allStocks.filter(s => s.has_current_surge).length;

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            <div className="max-w-[1600px] mx-auto px-6 py-8 space-y-5">

                {/* Header */}
                <div className="flex items-start justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Volume Surge Scanner</h1>
                        <p className="text-gray-400 text-sm mt-1">
                            {loading ? "Loading…" : `${filtered.length.toLocaleString()} stocks · ${surgingNow} surging today · 3yr historical analysis`}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-2 text-center">
                            <div className="text-2xl font-bold text-yellow-400">{surgingNow}</div>
                            <div className="text-gray-400 text-xs">surging today</div>
                        </div>
                        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl px-4 py-2 text-center">
                            <div className="text-2xl font-bold text-orange-400">{filtered.length.toLocaleString()}</div>
                            <div className="text-gray-400 text-xs">matched</div>
                        </div>
                    </div>
                </div>

                {/* Filter Panel */}
                <form onSubmit={handleApply} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-semibold text-sm">Surge Filters <span className="text-gray-500 font-normal text-xs ml-2">3-year historical analysis</span></h2>
                        <button type="button" onClick={handleClear} className="text-xs text-gray-500 hover:text-white transition-colors">Reset</button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
                        {[
                            { key: "volume_ratio_min", label: "Vol Ratio Min", hint: "vs 20d avg",      color: "orange", step: "0.5" },
                            { key: "day_return_min",   label: "Return % Min",  hint: "on surge day",    color: "green",  step: "0.5" },
                            { key: "day_return_max",   label: "Return % Max",  hint: "filter extremes", color: "red",    step: "0.5" },
                            { key: "surges_3yr_min",   label: "Min Surge Days",hint: "in 3 years",      color: "blue",   step: "1"   },
                        ].map(field => (
                            <div key={field.key} className={`rounded-xl p-3 border transition-all ${(filters as any)[field.key] !== "" ? `border-${field.color}-500/50 bg-${field.color}-500/5` : "border-gray-800 bg-gray-800/30"}`}>
                                <div className="flex justify-between mb-1.5">
                                    <span className={`text-xs font-semibold text-${field.color}-400`}>{field.label}</span>
                                    <span className="text-xs text-gray-600">{field.hint}</span>
                                </div>
                                <input type="number" step={field.step} placeholder="—"
                                    value={(filters as any)[field.key]}
                                    onChange={e => setFilters(f => ({ ...f, [field.key]: e.target.value }))}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500"
                                />
                            </div>
                        ))}
                        {/* Currently Surging toggle */}
                        <div className="rounded-xl p-3 border border-gray-800 bg-gray-800/30 flex flex-col gap-1.5">
                            <span className="text-xs font-semibold text-yellow-400">Currently Surging</span>
                            <span className="text-xs text-gray-600">today's spike only</span>
                            <button type="button"
                                onClick={() => setFilters(f => ({ ...f, current_surge_only: !f.current_surge_only }))}
                                className={`rounded-lg px-2 py-1.5 text-xs font-medium transition-all border ${filters.current_surge_only ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-300" : "bg-gray-900 border-gray-700 text-gray-400 hover:text-white"}`}>
                                {filters.current_surge_only ? "⚡ Active" : "All stocks"}
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 justify-between">
                        {/* Search */}
                        <div className="relative flex-1 max-w-sm">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
                            <input type="text" placeholder="Search symbol or company…"
                                value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                                className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
                            />
                        </div>
                        <button type="submit" disabled={loading}
                            className="bg-orange-600 hover:bg-orange-500 text-white font-semibold px-8 py-2 rounded-xl transition-all disabled:opacity-50 text-sm">
                            {loading ? <span className="flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Scanning…</span> : "Apply Filters"}
                        </button>
                    </div>
                </form>

                {/* Results */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
                        <div className="text-sm font-medium text-gray-300">
                            {filtered.length > 0
                                ? <>Showing <span className="text-white font-semibold">{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)}</span> of <span className="text-white font-semibold">{filtered.length.toLocaleString()}</span></>
                                : "No results"}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span><span className="inline-block w-2 h-2 rounded-full bg-red-400 mr-1"/>Vol ≥ 5×</span>
                            <span><span className="inline-block w-2 h-2 rounded-full bg-orange-400 mr-1"/>Vol ≥ 3×</span>
                            <span><span className="inline-block w-2 h-2 rounded-full bg-yellow-400 mr-1"/>Vol ≥ 2×</span>
                        </div>
                    </div>

                    {error ? (
                        <div className="m-6 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
                            <strong>Error:</strong> {error}
                        </div>
                    ) : loading ? (
                        <div className="flex flex-col items-center justify-center py-24 gap-3">
                            <div className="w-10 h-10 rounded-full border-2 border-orange-500 border-t-transparent animate-spin"/>
                            <p className="text-gray-400 text-sm">Loading 2,100+ stocks…</p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center py-24 gap-2">
                            <div className="text-4xl">📊</div>
                            <p className="text-gray-400">No stocks match your filters.</p>
                            <p className="text-gray-600 text-xs">Try loosening the filters.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-800/40 border-b border-gray-800 text-xs text-gray-400 uppercase tracking-wider">
                                        <th className="px-4 py-3 text-left w-10">#</th>
                                        <th className="px-4 py-3 text-left cursor-pointer hover:text-white" onClick={() => handleSort("symbol")}>Symbol <SortIcon col="symbol"/></th>
                                        <th className="px-4 py-3 text-left">Company</th>
                                        <th className="px-4 py-3 text-right cursor-pointer hover:text-white" onClick={() => handleSort("price")}>LTP (₹) <SortIcon col="price"/></th>
                                        <th className="px-4 py-3 text-right cursor-pointer hover:text-white text-orange-400" onClick={() => handleSort("volume_ratio")}>Vol Ratio <SortIcon col="volume_ratio"/></th>
                                        <th className="px-4 py-3 text-right cursor-pointer hover:text-white" onClick={() => handleSort("volume")}>Today Vol <SortIcon col="volume"/></th>
                                        <th className="px-4 py-3 text-right">Avg Vol 20d</th>
                                        <th className="px-4 py-3 text-right cursor-pointer hover:text-white text-green-400" onClick={() => handleSort("day_return")}>Day Return <SortIcon col="day_return"/></th>
                                        <th className="px-4 py-3 text-right cursor-pointer hover:text-white text-blue-400" onClick={() => handleSort("surges_3yr")}>Surges 3yr <SortIcon col="surges_3yr"/></th>
                                        <th className="px-4 py-3 text-right text-cyan-400">Avg 2D Ret</th>
                                        <th className="px-4 py-3 text-right text-cyan-400">Avg 5D Ret</th>
                                        <th className="px-4 py-3 text-right text-cyan-400">Avg 10D Ret</th>
                                        <th className="px-4 py-3 text-right text-purple-400">Win Rate 5D</th>
                                        <th className="px-4 py-3 text-right cursor-pointer hover:text-white text-purple-400" onClick={() => handleSort("pos_pct")}>+ve Surge % <SortIcon col="pos_pct"/></th>
                                        <th className="px-4 py-3 text-center">History</th>
                                        <th className="px-4 py-3 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pageRows.map((stock, idx) => {
                                        const absIdx = (page - 1) * PAGE_SIZE + idx + 1;
                                        return (
                                            <React.Fragment key={stock.symbol}>
                                                <tr className={`border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors cursor-pointer ${stock.has_current_surge ? "bg-orange-500/5" : ""}`}
                                                    onClick={() => setExpandedSymbol(expandedSymbol === stock.symbol ? null : stock.symbol)}>
                                                    <td className="px-4 py-2.5 text-gray-600 text-xs">{absIdx}</td>
                                                    <td className="px-4 py-2.5">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-bold text-blue-400 text-sm">{stock.symbol}</span>
                                                            {stock.has_current_surge && <span className="text-xs bg-orange-500/20 text-orange-300 border border-orange-500/30 px-1.5 py-0.5 rounded leading-none">⚡</span>}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2.5 text-gray-300 text-xs max-w-[160px] truncate">{stock.company_name}</td>
                                                    <td className="px-4 py-2.5 text-right font-semibold text-white text-sm">
                                                        {stock.price ? `₹${stock.price.toFixed(2)}` : "—"}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-right">
                                                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getRatioBadge(stock.volume_ratio)}`}>
                                                            {stock.volume_ratio ? `${stock.volume_ratio.toFixed(1)}×` : "—"}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2.5 text-right text-gray-300 text-xs">{fmtVol(stock.volume)}</td>
                                                    <td className="px-4 py-2.5 text-right text-gray-500 text-xs">{fmtVol(stock.avg_volume_20d)}</td>
                                                    <td className={`px-4 py-2.5 text-right text-xs ${getReturnColor(stock.day_return_pct)}`}>
                                                        {stock.day_return_pct != null ? `${stock.day_return_pct > 0 ? "+" : ""}${stock.day_return_pct.toFixed(2)}%` : "—"}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-right text-blue-300 text-xs font-medium">
                                                        {stock.surge_stats?.total_surge_days_3yr ?? "—"}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-right text-xs font-medium">
                                                        {stock.surge_stats?.avg_return_2d != null
                                                            ? <span className={stock.surge_stats.avg_return_2d >= 0 ? "text-cyan-400" : "text-red-400"}>{stock.surge_stats.avg_return_2d > 0 ? "+" : ""}{stock.surge_stats.avg_return_2d.toFixed(1)}%</span>
                                                            : <span className="text-gray-600">—</span>}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-right text-xs font-medium">
                                                        {stock.surge_stats?.avg_return_5d != null
                                                            ? <span className={stock.surge_stats.avg_return_5d >= 0 ? "text-cyan-400" : "text-red-400"}>{stock.surge_stats.avg_return_5d > 0 ? "+" : ""}{stock.surge_stats.avg_return_5d.toFixed(1)}%</span>
                                                            : <span className="text-gray-600">—</span>}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-right text-xs font-medium">
                                                        {stock.surge_stats?.avg_return_10d != null
                                                            ? <span className={stock.surge_stats.avg_return_10d >= 0 ? "text-cyan-400" : "text-red-400"}>{stock.surge_stats.avg_return_10d > 0 ? "+" : ""}{stock.surge_stats.avg_return_10d.toFixed(1)}%</span>
                                                            : <span className="text-gray-600">—</span>}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-right text-xs">
                                                        {stock.surge_stats?.win_rate_5d != null
                                                            ? <span className={`px-2 py-0.5 rounded font-semibold ${ stock.surge_stats.win_rate_5d >= 60 ? "bg-green-500/20 text-green-300" : stock.surge_stats.win_rate_5d >= 50 ? "bg-yellow-500/20 text-yellow-300" : "bg-red-500/20 text-red-300"}`}>{stock.surge_stats.win_rate_5d.toFixed(0)}%</span>
                                                            : <span className="text-gray-600">—</span>}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-right text-purple-300 text-xs">
                                                        {stock.surge_stats?.positive_surge_pct != null ? `${stock.surge_stats.positive_surge_pct.toFixed(0)}%` : "—"}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-center">
                                                        <span className="text-gray-600 text-xs hover:text-white">
                                                            {expandedSymbol === stock.symbol ? "▲" : "▼"}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2.5 text-center">
                                                        <button 
                                                            onClick={(e) => handleAddClick(stock, e)}
                                                            className="inline-flex items-center gap-1 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 px-2 py-1 rounded text-xs transition-colors"
                                                            title="Add to Watchlist"
                                                        >
                                                            <PlusIcon className="w-3 h-3" />
                                                            Watchlist
                                                        </button>
                                                    </td>
                                                </tr>
                                                {/* Expanded surge history */}
                                                {expandedSymbol === stock.symbol && (
                                                    <tr className="bg-gray-900/80 border-b border-gray-700">
                                                        <td colSpan={11} className="px-6 py-4">
                                                            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3">
                                                                Recent Surge Events (last 90 days)
                                                                <span className="ml-3 text-gray-600 normal-case font-normal">Max ratio ever: {stock.surge_stats?.max_ratio_3yr?.toFixed(1)}× · Avg return on surge: {stock.surge_stats?.avg_return_on_surge?.toFixed(2)}%</span>
                                                            </p>
                                                            {stock.recent_surge_events.length === 0 ? (
                                                                <p className="text-gray-600 text-xs">No surge events in last 90 days.</p>
                                                            ) : (
                                                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                                                                    {stock.recent_surge_events.map((ev, i) => (
                                                                        <div key={i} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                                                                            <div className="flex justify-between mb-1">
                                                                                <span className="text-xs font-medium text-white">{ev.date}</span>
                                                                                <span className={`text-xs font-bold ${getRatioBadge(ev.volume_ratio)} px-1.5 py-0.5 rounded`}>{ev.volume_ratio?.toFixed(1)}×</span>
                                                                            </div>
                                                                            <div className="flex justify-between">
                                                                                <span className="text-xs text-gray-400">{fmtVol(ev.volume)}</span>
                                                                                <span className={`text-xs font-semibold ${getReturnColor(ev.day_return)}`}>
                                                                                    {ev.day_return != null ? `${ev.day_return > 0 ? "+" : ""}${ev.day_return.toFixed(2)}%` : "—"}
                                                                                </span>
                                                                            </div>
                                                                            <div className="text-xs text-gray-600 mt-0.5">₹{ev.close?.toFixed(2)}</div>
                                                                        </div>
                                                                    ))}
                                                                </div>
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
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-800">
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                                className="px-4 py-1.5 text-sm rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                                ← Prev
                            </button>
                            <div className="flex items-center gap-1">
                                {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                                    let p: number;
                                    if (totalPages <= 7) p = i + 1;
                                    else if (page <= 4) p = i + 1;
                                    else if (page >= totalPages - 3) p = totalPages - 6 + i;
                                    else p = page - 3 + i;
                                    return (
                                        <button key={p} onClick={() => setPage(p)}
                                            className={`w-8 h-8 text-xs rounded-lg transition-colors ${p === page ? "bg-orange-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}>
                                            {p}
                                        </button>
                                    );
                                })}
                            </div>
                            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                                className="px-4 py-1.5 text-sm rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                                Next →
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <AddToWatchlistModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                symbol={selectedStock?.symbol}
                companyName={selectedStock?.company_name}
                currentPrice={selectedStock?.price}
                sourceModule="Volume Breakouts"
            />
        </div>
    );
}
