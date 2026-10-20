"use client";

import { Search, SearchX, Zap } from 'lucide-react';
import React, { useState, useEffect, useCallback, useMemo, useContext, useRef } from "react";
import { screenerService } from "@/services/screenerService";
import { PlusIcon } from "@heroicons/react/24/outline";
import AddToWatchlistModal from "@/components/watchlists/AddToWatchlistModal";
import { ScannerContext } from "../context";
import { RangeFilter, FilterToggle } from "@/components/screener/filters";

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


// ── Interface matching actual API response ────────────────────────────────
interface SurgeEvent {
    date: string;
    volume: number | null;
    volume_ratio: number;
    day_return: number;
    close: number;
}

interface VolumeSurgeStock {
    symbol: string;
    company_name: string;
    ltp: number;
    price: number;
    volume: number | null;
    avg_volume_20d: number | null;
    volume_ratio: number | null;
    current_volume_ratio: number | null;
    day_return_pct: number | null;
    surge_stats: {
        total_surges: number;
        total_surge_days_3yr: number;
        positive_surge_pct: number | null;
        max_ratio_3yr: number | null;
        avg_return_on_surge: number | null;
        avg_1d_return: number | null;
        avg_2d_return: number | null;
        avg_5d_return: number | null;
        avg_10d_return: number | null;
        avg_20d_return: number | null;
        win_rate_1d: number | null;
        win_rate_5d: number | null;
        win_rate_10d: number | null;
        max_gain_ever: number | null;
        max_drawdown_ever: number | null;
    };
    recent_surge_events: SurgeEvent[];
    has_current_surge: boolean;
}

const PAGE_SIZE = 50;

// ── Helpers ───────────────────────────────────────────────────────────────
function getPrice(s: VolumeSurgeStock): number {
    return s.price ?? s.ltp ?? 0;
}
function getVolRatio(s: VolumeSurgeStock): number | null {
    return s.volume_ratio ?? s.current_volume_ratio ?? null;
}

function fmtVol(n: number | null | undefined): string {
    if (!n) return "—";
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
    return String(n);
}
function getRatioBadge(r: number | null | undefined): string {
    if (!r) return "bg-neutral-700 text-neutral-400";
    if (r >= 5) return "bg-negative-500/20 text-negative-300 border border-negative-500/40";
    if (r >= 3) return "bg-warning-500/20 text-warning-300 border border-warning-500/40";
    if (r >= 2) return "bg-warning-500/20 text-warning-300 border border-warning-500/40";
    return "bg-neutral-700/60 text-neutral-400";
}
function getReturnColor(r: number | null | undefined): string {
    if (r == null) return "text-neutral-500";
    if (r > 5)  return "text-positive-400 font-bold";
    if (r > 0)  return "text-positive-300";
    if (r < -5) return "text-negative-400 font-bold";
    if (r < 0)  return "text-negative-300";
    return "text-neutral-400";
}

const defaultFilters = () => ({
    volume_ratio_min: "", day_return_min: "", day_return_max: "",
    surges_3yr_min: "", positive_surge_pct_min: "", current_surge_only: false,
});

// This page stores filter values as strings ("" = unset); the shared
// RangeFilter speaks numbers/null. These two adapt between them.
const str2num = (s: string): number | null => (s === "" ? null : Number(s));
const num2str = (n: number | null): string => (n === null ? "" : String(n));

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

    const { scanMeta, registerData, registerRefresh, registerSearch } = useContext(ScannerContext);
    const searchInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        registerSearch(searchInputRef);
    }, [registerSearch]);

    useEffect(() => {
        registerData(allStocks);
    }, [allStocks, registerData]);


    const handleAddClick = (stock: VolumeSurgeStock, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedStock({
            symbol: stock.symbol,
            company_name: stock.company_name,
            price: getPrice(stock)
        });
        setIsModalOpen(true);
    };

    // Use summary endpoint for fast page load (no surge_history in payload)
    const fetchData = useCallback(async (f: ReturnType<typeof defaultFilters>) => {
        setLoading(true); setError(null); setPage(1);
        try {
            const params: Record<string, any> = { limit: 2500 };
            if (f.volume_ratio_min !== "")        params.volume_ratio_min        = Number(f.volume_ratio_min);
            if (f.day_return_min !== "")           params.day_return_min           = Number(f.day_return_min);
            if (f.day_return_max !== "")           params.day_return_max           = Number(f.day_return_max);
            if (f.surges_3yr_min !== "")           params.surges_3yr_min           = Number(f.surges_3yr_min);
            if (f.positive_surge_pct_min !== "")   params.positive_surge_pct_min   = Number(f.positive_surge_pct_min);
            if (f.current_surge_only)              params.current_surge_only       = true;
            // Use summary endpoint for initial load (excludes heavy surge_history)
            const resp = await screenerService.getVolumeSurgeSummary(params);
            if (resp.data?.success) setAllStocks(resp.data.data);
            else setError(resp.data?.error || "Failed to fetch");
        } catch (err: any) {
            setError(err?.message || "Network error");
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchData(defaultFilters()); }, [fetchData]);

    useEffect(() => {
        registerRefresh(() => fetchData(filters));
    }, [registerRefresh, fetchData, filters]);


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
            else if (sortKey === "price")      { av = getPrice(a); bv = getPrice(b); }
            else if (sortKey === "volume")     { av = a.volume ?? 0; bv = b.volume ?? 0; }
            else if (sortKey === "volume_ratio"){ av = getVolRatio(a) ?? 0; bv = getVolRatio(b) ?? 0; }
            else if (sortKey === "day_return") { av = a.day_return_pct ?? 0; bv = b.day_return_pct ?? 0; }
            else if (sortKey === "surges_3yr") { av = a.surge_stats?.total_surge_days_3yr ?? a.surge_stats?.total_surges ?? 0; bv = b.surge_stats?.total_surge_days_3yr ?? b.surge_stats?.total_surges ?? 0; }
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
        <div className="min-h-screen bg-neutral-950 text-foreground">
            <div className="max-w-[1600px] mx-auto px-6 py-8 space-y-5">

                {/* Header */}
                <div className="flex items-start justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Volume Surge Scanner</h1>
                        <div className="flex items-center gap-4 text-xs text-neutral-500 mt-1 flex-wrap">
                            <span>Last Updated: <span className="text-neutral-300 font-semibold">{scanMeta?.last_ran ? formatISTDate(scanMeta.last_ran) : "—"}</span></span>
                            <span className="text-neutral-500">•</span>
                            <span>Stocks: <span className="text-neutral-300 font-semibold">{allStocks.length.toLocaleString()}</span></span>
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
                    <div className="flex items-center gap-3">
                        <div className="bg-warning-500/10 border border-warning-500/30 rounded-xl px-4 py-2 text-center">
                            <div className="text-2xl font-bold text-warning-400">{surgingNow}</div>
                            <div className="text-neutral-400 text-xs">surging today</div>
                        </div>
                        <div className="bg-warning-500/10 border border-warning-500/30 rounded-xl px-4 py-2 text-center">
                            <div className="text-2xl font-bold text-warning-400">{filtered.length.toLocaleString()}</div>
                            <div className="text-neutral-400 text-xs">matched</div>
                        </div>
                    </div>
                </div>

                {/* Filter Panel */}
                <form onSubmit={handleApply} className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-semibold text-sm">Surge Filters <span className="text-neutral-500 font-normal text-xs ml-2">3-year historical analysis</span></h2>
                        <button type="button" onClick={handleClear} className="text-xs text-neutral-500 hover:text-foreground transition-colors">Reset</button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2.5 mb-4">
                        <RangeFilter
                            label="Vol Ratio"
                            description="Volume vs its 20-day average."
                            value={{ min: str2num(filters.volume_ratio_min), max: null }}
                            onChange={(n) => setFilters(f => ({ ...f, volume_ratio_min: num2str(n.min) }))}
                            min={0} max={20} step={0.5} singleEnded accent="orange"
                            unit="×"
                            presets={[
                                { label: "2×+", min: 2, max: null },
                                { label: "3×+", min: 3, max: null },
                                { label: "5×+", min: 5, max: null },
                            ]}
                        />

                        <RangeFilter
                            label="Day Return"
                            description="Return on the surge day."
                            value={{ min: str2num(filters.day_return_min), max: str2num(filters.day_return_max) }}
                            onChange={(n) => setFilters(f => ({
                                ...f,
                                day_return_min: num2str(n.min),
                                day_return_max: num2str(n.max),
                            }))}
                            min={-20} max={20} step={0.5} accent="emerald" unit="%"
                            presets={[
                                { label: "Up", min: 0, max: null },
                                { label: "5%+", min: 5, max: null },
                                { label: "Down", min: null, max: 0 },
                            ]}
                        />

                        <RangeFilter
                            label="Surge Days"
                            description="Number of surge days in the last 3 years."
                            value={{ min: str2num(filters.surges_3yr_min), max: null }}
                            onChange={(n) => setFilters(f => ({ ...f, surges_3yr_min: num2str(n.min) }))}
                            min={0} max={100} step={1} singleEnded accent="blue"
                            presets={[
                                { label: "5+", min: 5, max: null },
                                { label: "10+", min: 10, max: null },
                                { label: "20+", min: 20, max: null },
                            ]}
                        />

                        <RangeFilter
                            label="Positive Surge %"
                            description="Share of past surges that closed positive."
                            value={{ min: str2num(filters.positive_surge_pct_min), max: null }}
                            onChange={(n) => setFilters(f => ({ ...f, positive_surge_pct_min: num2str(n.min) }))}
                            min={0} max={100} step={5} singleEnded accent="cyan" unit="%"
                            presets={[
                                { label: "50%+", min: 50, max: null },
                                { label: "70%+", min: 70, max: null },
                            ]}
                        />

                        <FilterToggle
                            label="Currently Surging"
                            description="Only stocks spiking today"
                            checked={filters.current_surge_only}
                            onChange={(v) => setFilters(f => ({ ...f, current_surge_only: v }))}
                            accent="amber"
                        />
                    </div>
                    <div className="flex items-center gap-3 justify-between">
                        {/* Search */}
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" aria-hidden />
                            <input ref={searchInputRef} type="text" placeholder="Search symbol or company…"
                                value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                                className="w-full pl-9 pr-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-sm text-foreground placeholder-neutral-500 focus:outline-none focus:border-warning-500"
                            />
                        </div>
                        <button type="submit" disabled={loading}
                            className="bg-warning-700 hover:bg-warning-700 text-white font-semibold px-8 py-2 rounded-xl transition-all disabled:opacity-50 text-sm">
                            {loading ? <span className="flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin"/>Scanning…</span> : "Apply Filters"}
                        </button>
                    </div>
                </form>

                {/* Results */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-800">
                        <div className="text-sm font-medium text-neutral-300">
                            {filtered.length > 0
                                ? <>Showing <span className="text-foreground font-semibold">{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)}</span> of <span className="text-foreground font-semibold">{filtered.length.toLocaleString()}</span></>
                                : "No results"}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-neutral-500">
                            <span><span className="inline-block w-2 h-2 rounded-full bg-negative-400 mr-1"/>Vol ≥ 5×</span>
                            <span><span className="inline-block w-2 h-2 rounded-full bg-warning-400 mr-1"/>Vol ≥ 3×</span>
                            <span><span className="inline-block w-2 h-2 rounded-full bg-warning-400 mr-1"/>Vol ≥ 2×</span>
                        </div>
                    </div>

                    {error ? (
                        <div className="m-6 bg-negative-500/10 border border-negative-500/30 rounded-xl p-4 text-negative-400 text-sm">
                            <strong>Error:</strong> {error}
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
                        <div className="flex flex-col items-center py-24 gap-2">
                            <SearchX className="h-10 w-10 text-neutral-500" aria-hidden />
                            <p className="text-neutral-400">No stocks match your filters.</p>
                            <p className="text-neutral-500 text-xs">Try loosening the filters.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-neutral-800/40 border-b border-neutral-800 text-xs text-neutral-400">
                                        <th className="px-4 py-3 text-left w-10">#</th>
                                        <th className="px-4 py-3 text-left cursor-pointer hover:text-foreground" onClick={() => handleSort("symbol")}>Symbol <SortIcon col="symbol"/></th>
                                        <th className="px-4 py-3 text-left">Company</th>
                                        <th className="px-4 py-3 text-right cursor-pointer hover:text-foreground" onClick={() => handleSort("price")}>LTP (₹) <SortIcon col="price"/></th>
                                        <th className="px-4 py-3 text-right cursor-pointer hover:text-foreground text-warning-400" onClick={() => handleSort("volume_ratio")}>Vol Ratio <SortIcon col="volume_ratio"/></th>
                                        <th className="px-4 py-3 text-right cursor-pointer hover:text-foreground" onClick={() => handleSort("volume")}>Today Vol <SortIcon col="volume"/></th>
                                        <th className="px-4 py-3 text-right">Avg Vol 20d</th>
                                        <th className="px-4 py-3 text-right cursor-pointer hover:text-foreground text-positive-400" onClick={() => handleSort("day_return")}>Day Return <SortIcon col="day_return"/></th>
                                        <th className="px-4 py-3 text-right cursor-pointer hover:text-foreground text-brand-400" onClick={() => handleSort("surges_3yr")}>Surges 3yr <SortIcon col="surges_3yr"/></th>
                                        <th className="px-4 py-3 text-right text-brand-400">Avg 2D Ret</th>
                                        <th className="px-4 py-3 text-right text-brand-400">Avg 5D Ret</th>
                                        <th className="px-4 py-3 text-right text-brand-400">Avg 10D Ret</th>
                                        <th className="px-4 py-3 text-right text-brand-400">Win Rate 5D</th>
                                        <th className="px-4 py-3 text-right cursor-pointer hover:text-foreground text-brand-400" onClick={() => handleSort("pos_pct")}>+ve Surge % <SortIcon col="pos_pct"/></th>
                                        <th className="px-4 py-3 text-center">History</th>
                                        <th className="px-4 py-3 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pageRows.map((stock, idx) => {
                                        const absIdx = (page - 1) * PAGE_SIZE + idx + 1;
                                        const vr = getVolRatio(stock);
                                        const price = getPrice(stock);
                                        return (
                                            <React.Fragment key={stock.symbol}>
                                                <tr className={`border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors cursor-pointer ${stock.has_current_surge ? "bg-warning-500/5" : ""}`}
                                                    onClick={() => setExpandedSymbol(expandedSymbol === stock.symbol ? null : stock.symbol)}>
                                                    <td className="px-4 py-2.5 text-neutral-500 text-xs">{absIdx}</td>
                                                    <td className="px-4 py-2.5">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-bold text-brand-400 text-sm">{stock.symbol}</span>
                                                            {stock.has_current_surge && <span className="text-xs bg-warning-500/20 text-warning-300 border border-warning-500/30 px-1.5 py-0.5 rounded leading-none inline-flex items-center" title="Active volume surge"><Zap className="h-3 w-3" aria-hidden /><span className="sr-only">Active volume surge</span></span>}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2.5 text-neutral-300 text-xs max-w-[160px] truncate">{stock.company_name || "—"}</td>
                                                    <td className="px-4 py-2.5 text-right font-semibold text-foreground text-sm">
                                                        {price ? `₹${price.toFixed(2)}` : "—"}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-right">
                                                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getRatioBadge(vr)}`}>
                                                            {vr ? `${vr.toFixed(1)}×` : "—"}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2.5 text-right text-neutral-300 text-xs">{fmtVol(stock.volume)}</td>
                                                    <td className="px-4 py-2.5 text-right text-neutral-500 text-xs">{fmtVol(stock.avg_volume_20d)}</td>
                                                    <td className={`px-4 py-2.5 text-right text-xs ${getReturnColor(stock.day_return_pct)}`}>
                                                        {stock.day_return_pct != null ? `${stock.day_return_pct > 0 ? "+" : ""}${stock.day_return_pct.toFixed(2)}%` : "—"}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-right text-brand-300 text-xs font-medium">
                                                        {stock.surge_stats?.total_surge_days_3yr ?? stock.surge_stats?.total_surges ?? "—"}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-right text-xs font-medium">
                                                        {stock.surge_stats?.avg_2d_return != null
                                                            ? <span className={stock.surge_stats.avg_2d_return >= 0 ? "text-brand-400" : "text-negative-400"}>{stock.surge_stats.avg_2d_return > 0 ? "+" : ""}{stock.surge_stats.avg_2d_return.toFixed(1)}%</span>
                                                            : <span className="text-neutral-500">—</span>}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-right text-xs font-medium">
                                                        {stock.surge_stats?.avg_5d_return != null
                                                            ? <span className={stock.surge_stats.avg_5d_return >= 0 ? "text-brand-400" : "text-negative-400"}>{stock.surge_stats.avg_5d_return > 0 ? "+" : ""}{stock.surge_stats.avg_5d_return.toFixed(1)}%</span>
                                                            : <span className="text-neutral-500">—</span>}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-right text-xs font-medium">
                                                        {stock.surge_stats?.avg_10d_return != null
                                                            ? <span className={stock.surge_stats.avg_10d_return >= 0 ? "text-brand-400" : "text-negative-400"}>{stock.surge_stats.avg_10d_return > 0 ? "+" : ""}{stock.surge_stats.avg_10d_return.toFixed(1)}%</span>
                                                            : <span className="text-neutral-500">—</span>}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-right text-xs">
                                                        {stock.surge_stats?.win_rate_5d != null
                                                            ? <span className={`px-2 py-0.5 rounded font-semibold ${ stock.surge_stats.win_rate_5d >= 60 ? "bg-positive-500/20 text-positive-300" : stock.surge_stats.win_rate_5d >= 50 ? "bg-warning-500/20 text-warning-300" : "bg-negative-500/20 text-negative-300"}`}>{stock.surge_stats.win_rate_5d.toFixed(0)}%</span>
                                                            : <span className="text-neutral-500">—</span>}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-right text-brand-300 text-xs">
                                                        {stock.surge_stats?.positive_surge_pct != null ? `${stock.surge_stats.positive_surge_pct.toFixed(0)}%` : "—"}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-center">
                                                        <span className="text-neutral-500 text-xs hover:text-foreground">
                                                            {expandedSymbol === stock.symbol ? "▲" : "▼"}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2.5 text-center">
                                                        <button 
                                                            onClick={(e) => handleAddClick(stock, e)}
                                                            className="inline-flex items-center gap-1 bg-brand-600/20 hover:bg-brand-600/40 text-brand-300 border border-brand-500/30 px-2 py-1 rounded text-xs transition-colors"
                                                            title="Add to Watchlist"
                                                        >
                                                            <PlusIcon className="w-3 h-3" />
                                                            Watchlist
                                                        </button>
                                                    </td>
                                                </tr>
                                                {/* Expanded surge history */}
                                                {expandedSymbol === stock.symbol && (
                                                    <tr className="bg-neutral-900/80 border-b border-neutral-700">
                                                        <td colSpan={16} className="px-6 py-4">
                                                            <p className="text-xs text-neutral-400 font-semibold mb-3">
                                                                Recent Surge Events (last 90 days)
                                                                <span className="ml-3 text-neutral-500 normal-case font-normal">Max ratio ever: {stock.surge_stats?.max_ratio_3yr?.toFixed(1) ?? "—"}× · Avg return on surge: {stock.surge_stats?.avg_return_on_surge?.toFixed(2) ?? "—"}%</span>
                                                            </p>
                                                            {(!stock.recent_surge_events || stock.recent_surge_events.length === 0) ? (
                                                                <p className="text-neutral-500 text-xs">No surge events in last 90 days.</p>
                                                            ) : (
                                                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                                                                    {stock.recent_surge_events.map((ev, i) => (
                                                                        <div key={i} className="bg-neutral-800 rounded-lg p-3 border border-neutral-700">
                                                                            <div className="flex justify-between mb-1">
                                                                                <span className="text-xs font-medium text-foreground">{ev.date}</span>
                                                                                <span className={`text-xs font-bold ${getRatioBadge(ev.volume_ratio)} px-1.5 py-0.5 rounded`}>{ev.volume_ratio?.toFixed(1)}×</span>
                                                                            </div>
                                                                            <div className="flex justify-between">
                                                                                <span className="text-xs text-neutral-400">{fmtVol(ev.volume)}</span>
                                                                                <span className={`text-xs font-semibold ${getReturnColor(ev.day_return)}`}>
                                                                                    {ev.day_return != null ? `${ev.day_return > 0 ? "+" : ""}${ev.day_return.toFixed(2)}%` : "—"}
                                                                                </span>
                                                                            </div>
                                                                            <div className="text-xs text-neutral-500 mt-0.5">₹{ev.close?.toFixed(2)}</div>
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
                        <div className="flex items-center justify-between gap-2 px-3 sm:px-5 py-4 border-t border-neutral-800">
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                                className="px-4 py-1.5 text-sm rounded-lg bg-neutral-800 text-neutral-300 hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                                ← Prev
                            </button>
                            <span className="text-xs text-neutral-400 tabular-nums sm:hidden">Page {page} of {totalPages}</span>
                                <div className="hidden sm:flex items-center gap-1">
                                {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                                    let p: number;
                                    if (totalPages <= 7) p = i + 1;
                                    else if (page <= 4) p = i + 1;
                                    else if (page >= totalPages - 3) p = totalPages - 6 + i;
                                    else p = page - 3 + i;
                                    return (
                                        <button key={p} onClick={() => setPage(p)}
                                            className={`w-8 h-8 text-xs rounded-lg transition-colors ${p === page ? "bg-warning-700 text-white" : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"}`}>
                                            {p}
                                        </button>
                                    );
                                })}
                            </div>
                            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                                className="px-4 py-1.5 text-sm rounded-lg bg-neutral-800 text-neutral-300 hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
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
