"use client";

import React, { useState, useEffect, useCallback, useMemo, useContext, useRef } from "react";
import { screenerService } from "@/services/screenerService";
import { PlusIcon } from "@heroicons/react/24/outline";
import AddToWatchlistModal from "@/components/watchlists/AddToWatchlistModal";
import { ScannerContext } from "../context";

const formatISTDate = (isoString: string) => {
    try {
        const date = new Date(isoString);
        const options = {
            timeZone: "Asia/Kolkata",
            day: "2-digit" as const,
            month: "short" as const,
            year: "numeric" as const,
            hour: "2-digit" as const,
            minute: "2-digit" as const,
            hour12: false
        };
        const formatter = new Intl.DateTimeFormat("en-IN", options);
        const parts = formatter.formatToParts(date);
        const partMap = Object.fromEntries(parts.map(p => [p.type, p.value]));
        return `${partMap.day} ${partMap.month} ${partMap.year} ${partMap.hour}:${partMap.minute} IST`;
    } catch {
        return "—";
    }
};

interface FVGZone {
    low: number;
    high: number;
    distance_pct?: number;
}

interface FVGStock {
    symbol: string;
    company_name: string;
    company: string;
    ltp: number;
    price: number;
    week52_high: number;
    week52_low: number;
    distance_high_pct: number;
    distance_low_pct: number;
    historical_fvg_count: number;
    active_fvg_count: number;
    nearest_fvg_high: number | null;
    nearest_fvg_dist_pct: number | null;
    fvgs: FVGZone[];
}

const PAGE_SIZE = 50;

function fmtPrice(n?: number | null) {
    return n != null ? `₹${n.toFixed(2)}` : "—";
}

const defaultFilters = () => ({
    distance_fvg_min: "",
    distance_fvg_max: "",
    distance_high_min: "",
    distance_high_max: "",
    distance_low_min: "",
    distance_low_max: "",
    near_52w_high: false,
    near_52w_low: false,
    price_min: "",
    price_max: "",
    has_fvg_only: true,
});

export default function FVGScannerPage() {
    const [allStocks, setAllStocks]   = useState<FVGStock[]>([]);
    const [loading, setLoading]       = useState(false);
    const [error, setError]           = useState<string | null>(null);
    const [filters, setFilters]       = useState(defaultFilters());
    const [search, setSearch]         = useState("");
    const [page, setPage]             = useState(1);
    const [sortKey, setSortKey]       = useState("dist_fvg");
    const [sortDir, setSortDir]       = useState<"asc" | "desc">("asc");
    const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);

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

    const handleAddClick = (stock: FVGStock, e: React.MouseEvent) => {
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
            if (f.distance_fvg_min !== "") params.distance_fvg_min = Number(f.distance_fvg_min);
            if (f.distance_fvg_max !== "") params.distance_fvg_max = Number(f.distance_fvg_max);
            if (f.price_min !== "")        params.price_min = Number(f.price_min);
            if (f.price_max !== "")        params.price_max = Number(f.price_max);

            if (f.distance_high_min !== "") params.distance_high_min = Number(f.distance_high_min);
            if (f.distance_high_max !== "") params.distance_high_max = Number(f.distance_high_max);
            if (f.distance_low_min !== "")  params.distance_low_min = Number(f.distance_low_min);
            if (f.distance_low_max !== "")  params.distance_low_max = Number(f.distance_low_max);

            if (f.near_52w_high)     params.near_52w_high = true;
            if (f.near_52w_low)      params.near_52w_low = true;
            params.has_fvg_only = f.has_fvg_only;

            const resp = await screenerService.getFVG(params);
            if (resp.data?.success) setAllStocks(resp.data.data);
            else setError(resp.data?.error || "Failed to fetch FVG data");
        } catch (err: any) {
            setError(err?.message || "Network error — is FastAPI running?");
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
            if (sortKey === "symbol") {
                av = a.symbol;
                bv = b.symbol;
            } else if (sortKey === "price") {
                av = a.price ?? a.ltp ?? 0;
                bv = b.price ?? b.ltp ?? 0;
            } else if (sortKey === "dist_fvg") {
                av = a.nearest_fvg_dist_pct ?? 9999;
                bv = b.nearest_fvg_dist_pct ?? 9999;
            } else if (sortKey === "52wh") {
                av = a.week52_high ?? 0;
                bv = b.week52_high ?? 0;
            } else if (sortKey === "52wl") {
                av = a.week52_low ?? 0;
                bv = b.week52_low ?? 0;
            } else if (sortKey === "dist_high") {
                av = a.distance_high_pct ?? 0;
                bv = b.distance_high_pct ?? 0;
            } else if (sortKey === "dist_low") {
                av = a.distance_low_pct ?? 0;
                bv = b.distance_low_pct ?? 0;
            }
            if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
            return sortDir === "asc" ? av - bv : bv - av;
        });
    }, [allStocks, search, sortKey, sortDir]);

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const pageRows   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const handleSort = (key: string) => {
        if (key === sortKey) setSortDir(d => d === "asc" ? "desc" : "asc");
        else { setSortKey(key); setSortDir("asc"); }
    };
    const SortIcon = ({ col }: { col: string }) => (
        <span className="ml-1 opacity-50">{sortKey === col ? (sortDir === "asc" ? "↑" : "↓") : "↕"}</span>
    );

    const handleApply = (e: React.FormEvent) => { e.preventDefault(); fetchData(filters); };
    const handleClear = () => { const c = defaultFilters(); setFilters(c); setSearch(""); fetchData(c); };

    const withFvg = allStocks.filter(s => s.active_fvg_count > 0).length;

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            <div className="max-w-[1600px] mx-auto px-6 py-8 space-y-5">

                {/* Header */}
                <div className="flex items-start justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Fair Value Gap (FVG) Scanner</h1>
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
                        <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl px-4 py-2 text-center">
                            <div className="text-2xl font-bold text-purple-400">{withFvg.toLocaleString()}</div>
                            <div className="text-gray-400 text-xs">have FVG zones</div>
                        </div>
                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl px-4 py-2 text-center">
                            <div className="text-2xl font-bold text-blue-400">{filtered.length.toLocaleString()}</div>
                            <div className="text-gray-400 text-xs">matched</div>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleApply} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-semibold text-sm">Filters <span className="text-gray-500 font-normal text-xs ml-2">ICT Fair Value Gap · Active Style</span></h2>
                        <button type="button" onClick={handleClear} className="text-xs text-gray-500 hover:text-white transition-colors">Reset</button>
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
                        {/* Distance to FVG Range Filter */}
                        <div className="rounded-xl p-3 border border-gray-800 bg-gray-800/30">
                            <div className="flex justify-between mb-1 text-xs font-semibold text-purple-400">
                                <span>Distance to FVG %</span>
                            </div>
                            <div className="flex gap-2">
                                <input type="number" step="0.1" placeholder="Min %"
                                    value={filters.distance_fvg_min}
                                    onChange={e => setFilters(f => ({ ...f, distance_fvg_min: e.target.value }))}
                                    className="w-1/2 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-purple-500"
                                />
                                <input type="number" step="0.1" placeholder="Max %"
                                    value={filters.distance_fvg_max}
                                    onChange={e => setFilters(f => ({ ...f, distance_fvg_max: e.target.value }))}
                                    className="w-1/2 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-purple-500"
                                />
                            </div>
                        </div>

                        {/* Dist 52W High % Filter */}
                        <div className="rounded-xl p-3 border border-gray-800 bg-gray-800/30">
                            <div className="flex justify-between mb-1 text-xs font-semibold text-emerald-400">
                                <span>Distance to 52W High %</span>
                            </div>
                            <div className="flex gap-2">
                                <input type="number" placeholder="Min"
                                    value={filters.distance_high_min}
                                    onChange={e => setFilters(f => ({ ...f, distance_high_min: e.target.value }))}
                                    className="w-1/2 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
                                />
                                <input type="number" placeholder="Max"
                                    value={filters.distance_high_max}
                                    onChange={e => setFilters(f => ({ ...f, distance_high_max: e.target.value }))}
                                    className="w-1/2 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
                                />
                            </div>
                        </div>

                        {/* Dist 52W Low % Filter */}
                        <div className="rounded-xl p-3 border border-gray-800 bg-gray-800/30">
                            <div className="flex justify-between mb-1 text-xs font-semibold text-blue-400">
                                <span>Distance to 52W Low %</span>
                            </div>
                            <div className="flex gap-2">
                                <input type="number" placeholder="Min"
                                    value={filters.distance_low_min}
                                    onChange={e => setFilters(f => ({ ...f, distance_low_min: e.target.value }))}
                                    className="w-1/2 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                                />
                                <input type="number" placeholder="Max"
                                    value={filters.distance_low_max}
                                    onChange={e => setFilters(f => ({ ...f, distance_low_max: e.target.value }))}
                                    className="w-1/2 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                                />
                            </div>
                        </div>

                        {/* Price Range */}
                        <div className="rounded-xl p-3 border border-gray-800 bg-gray-800/30">
                            <div className="flex justify-between mb-1 text-xs font-semibold text-gray-300">
                                <span>LTP Range</span>
                            </div>
                            <div className="flex gap-2">
                                <input type="number" placeholder="Min"
                                    value={filters.price_min}
                                    onChange={e => setFilters(f => ({ ...f, price_min: e.target.value }))}
                                    className="w-1/2 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-gray-500"
                                />
                                <input type="number" placeholder="Max"
                                    value={filters.price_max}
                                    onChange={e => setFilters(f => ({ ...f, price_max: e.target.value }))}
                                    className="w-1/2 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-gray-500"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-4 items-center">
                        {/* Near 52W High toggle */}
                        <label className="flex items-center gap-2 cursor-pointer bg-gray-800/40 border border-gray-800 rounded-xl p-2.5 text-xs select-none">
                            <input type="checkbox"
                                checked={filters.near_52w_high}
                                onChange={e => setFilters(f => ({ ...f, near_52w_high: e.target.checked }))}
                                className="accent-purple-500 h-4 w-4 rounded cursor-pointer"
                            />
                            <span className="text-gray-300 font-medium">Near 52W High (≤5%)</span>
                        </label>

                        {/* Near 52W Low toggle */}
                        <label className="flex items-center gap-2 cursor-pointer bg-gray-800/40 border border-gray-800 rounded-xl p-2.5 text-xs select-none">
                            <input type="checkbox"
                                checked={filters.near_52w_low}
                                onChange={e => setFilters(f => ({ ...f, near_52w_low: e.target.checked }))}
                                className="accent-purple-500 h-4 w-4 rounded cursor-pointer"
                            />
                            <span className="text-gray-300 font-medium">Near 52W Low (≤5%)</span>
                        </label>

                        {/* FVG Only toggle */}
                        <label className="flex items-center gap-2 cursor-pointer bg-gray-800/40 border border-gray-800 rounded-xl p-2.5 text-xs select-none">
                            <input type="checkbox"
                                checked={filters.has_fvg_only}
                                onChange={e => setFilters(f => ({ ...f, has_fvg_only: e.target.checked }))}
                                className="accent-purple-500 h-4 w-4 rounded cursor-pointer"
                            />
                            <span className="text-purple-300 font-medium">FVG Only</span>
                        </label>
                    </div>

                    <div className="flex items-center gap-3 justify-between">
                        <div className="relative flex-1 max-w-sm">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
                            <input ref={searchInputRef} type="text" placeholder="Search symbol or company…"
                                value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                                className="w-full pl-9 pr-3 py-2 bg-gray-850 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                            />
                        </div>
                        <button type="submit" disabled={loading}
                            className="bg-purple-700 hover:bg-purple-600 text-white font-semibold px-8 py-2 rounded-xl transition-all disabled:opacity-50 text-sm">
                            {loading
                                ? <span className="flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Scanning…</span>
                                : "Apply Filters"}
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
                        <div className="text-xs text-gray-500">Click row to expand FVG history</div>
                    </div>

                    {error ? (
                        <div className="m-6 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
                            <strong>Error:</strong> {error}
                            <p className="text-xs text-red-300/70 mt-1">Make sure the offline daily scan has run to populate the database cache.</p>
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
                        <div className="flex flex-col items-center py-24 gap-2">
                            <div className="text-4xl">🔍</div>
                            <p className="text-gray-400">No stocks match your filters.</p>
                            <p className="text-gray-600 text-xs">Try loosening your gap size, FVG count, or 52-week distance parameters.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-800/40 border-b border-gray-800 text-[11px] text-gray-400 uppercase tracking-wider">
                                        <th className="px-4 py-3 text-left w-10">#</th>
                                        <th className="px-4 py-3 text-left cursor-pointer hover:text-white" onClick={() => handleSort("symbol")}>Symbol <SortIcon col="symbol" /></th>
                                        <th className="px-4 py-3 text-left">Company</th>
                                        <th className="px-4 py-3 text-right cursor-pointer hover:text-white" onClick={() => handleSort("price")}>LTP (₹) <SortIcon col="price" /></th>
                                        <th className="px-4 py-3 text-right cursor-pointer hover:text-white" onClick={() => handleSort("52wh")}>52W High <SortIcon col="52wh" /></th>
                                        <th className="px-4 py-3 text-right cursor-pointer hover:text-white" onClick={() => handleSort("52wl")}>52W Low <SortIcon col="52wl" /></th>
                                        <th className="px-4 py-3 text-right cursor-pointer hover:text-white text-emerald-400 font-semibold" onClick={() => handleSort("dist_high")}>Dist High % <SortIcon col="dist_high" /></th>
                                        <th className="px-4 py-3 text-right cursor-pointer hover:text-white text-blue-400 font-semibold" onClick={() => handleSort("dist_low")}>Dist Low % <SortIcon col="dist_low" /></th>
                                        <th className="px-4 py-3 text-right">Nearest Active FVG</th>
                                        <th className="px-4 py-3 text-right cursor-pointer hover:text-white text-purple-400 font-semibold" onClick={() => handleSort("dist_fvg")}>Distance To FVG % <SortIcon col="dist_fvg" /></th>
                                        <th className="px-4 py-3 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pageRows.map((stock, idx) => {
                                        const absIdx = (page - 1) * PAGE_SIZE + idx + 1;
                                        
                                        // Colors mapping for distances (Green for Near 52W High, Blue for Near 52W Low)
                                        const distHighColor = stock.distance_high_pct >= -5.0 ? "text-emerald-400 font-semibold" : "text-gray-300";
                                        const distLowColor = stock.distance_low_pct <= 5.0 ? "text-blue-400 font-semibold" : "text-gray-300";

                                        return (
                                            <tr key={stock.symbol} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors cursor-pointer"
                                                onClick={() => setExpandedSymbol(stock.symbol)}>
                                                <td className="px-4 py-2.5 text-gray-600 text-xs">{absIdx}</td>
                                                <td className="px-4 py-2.5">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-bold text-blue-400 text-sm">{stock.symbol}</span>
                                                        <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded leading-none font-medium">ICT FVG</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2.5 text-gray-300 text-xs max-w-[180px] truncate">{stock.company_name || stock.company}</td>
                                                <td className="px-4 py-2.5 text-right font-semibold text-white text-sm">{fmtPrice(stock.price || stock.ltp)}</td>
                                                <td className="px-4 py-2.5 text-right text-gray-400 text-xs">{fmtPrice(stock.week52_high)}</td>
                                                <td className="px-4 py-2.5 text-right text-gray-400 text-xs">{fmtPrice(stock.week52_low)}</td>
                                                <td className={`px-4 py-2.5 text-right text-xs ${distHighColor}`}>{stock.distance_high_pct?.toFixed(2)}%</td>
                                                <td className={`px-4 py-2.5 text-right text-xs ${distLowColor}`}>+{stock.distance_low_pct?.toFixed(2)}%</td>
                                                <td className="px-4 py-2.5 text-right text-purple-300/80 font-mono text-xs">{stock.nearest_fvg_high != null ? fmtPrice(stock.nearest_fvg_high) : "—"}</td>
                                                <td className={`px-4 py-2.5 text-right font-bold text-sm ${stock.nearest_fvg_dist_pct != null && stock.nearest_fvg_dist_pct < 0 ? 'text-red-400' : 'text-purple-300'}`}>
                                                    {stock.nearest_fvg_dist_pct != null ? `${stock.nearest_fvg_dist_pct > 0 ? '+' : ''}${stock.nearest_fvg_dist_pct.toFixed(2)}%` : "—"}
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
                                    if      (totalPages <= 7)           p = i + 1;
                                    else if (page <= 4)                 p = i + 1;
                                    else if (page >= totalPages - 3)    p = totalPages - 6 + i;
                                    else                                p = page - 3 + i;
                                    return (
                                        <button key={p} onClick={() => setPage(p)}
                                            className={`w-8 h-8 text-xs rounded-lg transition-colors ${p === page ? "bg-purple-700 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}>
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

            {/* Side Panel for FVG Details */}
            {expandedSymbol && (() => {
                const stock = allStocks.find(s => s.symbol === expandedSymbol);
                if (!stock) return null;
                return (
                    <>
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 transition-opacity" onClick={() => setExpandedSymbol(null)} />
                        <div className="fixed inset-y-0 right-0 w-[420px] bg-gray-900 border-l border-gray-800 shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out">
                            {/* Header */}
                            <div className="p-6 border-b border-gray-800 flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                        <span className="text-blue-400">{stock.symbol}</span>
                                        <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded leading-none font-medium">ICT FVG</span>
                                    </h3>
                                    <p className="text-gray-400 text-xs mt-1">{stock.company_name || stock.company}</p>
                                </div>
                                <button 
                                    onClick={() => setExpandedSymbol(null)}
                                    className="text-gray-400 hover:text-white p-1.5 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-colors"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                            
                            {/* Content */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                {/* Stock Price Info */}
                                <div className="grid grid-cols-2 gap-4 bg-gray-850 p-4 rounded-xl border border-gray-800/40">
                                    <div>
                                        <div className="text-gray-500 text-[10px] uppercase tracking-wider font-semibold">LTP</div>
                                        <div className="text-lg font-bold text-white mt-0.5">{fmtPrice(stock.price || stock.ltp)}</div>
                                    </div>
                                    <div>
                                        <div className="text-gray-500 text-[10px] uppercase tracking-wider font-semibold">Nearest FVG Dist</div>
                                        <div className={`text-lg font-bold mt-0.5 ${stock.nearest_fvg_dist_pct != null && stock.nearest_fvg_dist_pct < 0 ? 'text-red-400' : 'text-purple-400'}`}>
                                            {stock.nearest_fvg_dist_pct != null ? `${stock.nearest_fvg_dist_pct > 0 ? '+' : ''}${stock.nearest_fvg_dist_pct.toFixed(2)}%` : "—"}
                                        </div>
                                    </div>
                                </div>

                                {/* Active FVGs List */}
                                <div className="space-y-3">
                                    <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider">Active Bullish FVGs (Max 5)</h4>
                                    <div className="space-y-3">
                                        {stock.fvgs && stock.fvgs.length > 0 ? (
                                            stock.fvgs.slice(0, 5).map((fvg, index) => {
                                                const dist = fvg.distance_pct ?? ((stock.price - fvg.high) / fvg.high * 100);
                                                return (
                                                    <div key={index} className="bg-gray-850 border border-gray-800/80 rounded-xl p-4 flex flex-col gap-2.5 hover:border-purple-500/30 transition-colors">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs font-bold text-gray-300">Active FVG #{index + 1}</span>
                                                            <span className={`text-xs font-bold font-mono ${dist < 0 ? 'text-red-400' : 'text-purple-300'}`}>
                                                                {dist > 0 ? '+' : ''}{dist.toFixed(2)}%
                                                            </span>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                                            <div className="bg-gray-900/50 p-2.5 rounded-lg border border-gray-800/40">
                                                                <span className="text-gray-500 block text-[9px] uppercase font-semibold mb-0.5">Low</span>
                                                                <span className="font-mono text-purple-300 font-bold">{fmtPrice(fvg.low)}</span>
                                                            </div>
                                                            <div className="bg-gray-900/50 p-2.5 rounded-lg border border-gray-800/40">
                                                                <span className="text-gray-500 block text-[9px] uppercase font-semibold mb-0.5">High</span>
                                                                <span className="font-mono text-green-300 font-bold">{fmtPrice(fvg.high)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="text-center py-8 text-gray-500 text-xs">No active Fair Value Gaps found for this stock.</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                );
            })()}

            <AddToWatchlistModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                symbol={selectedStock?.symbol}
                companyName={selectedStock?.company_name}
                currentPrice={selectedStock?.price}
                sourceModule="FVG Scanner"
            />
        </div>
    );
}
