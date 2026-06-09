"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { screenerService } from "@/services/screenerService";
import { PlusIcon } from "@heroicons/react/24/outline";
import AddToWatchlistModal from "@/components/watchlists/AddToWatchlistModal";

interface FVGZone {
    low: number;
    high: number;
    start_date: string;
    end_date: string;
}
interface FVGStock {
    symbol: string;
    company_name: string;
    price: number;
    volume: number;
    indicators: {
        rsi_14: number;
        ema_9: number;
        ema_50: number;
        ema_200: number;
        macd: number;
        macd_signal: number;
    };
    week52: { high: number; low: number };
    fvg: {
        has_fvg_bullish: boolean;
        total_fvgs_detected: number;
        fvg1: FVGZone | null;
        fvg2: FVGZone | null;
        fvg3: FVGZone | null;
    };
}

const PAGE_SIZE = 50;

function fmtVol(n?: number | null) {
    if (!n) return "—";
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (n >= 1_000)     return (n / 1_000).toFixed(0) + "K";
    return String(n);
}
function fmtPrice(n?: number | null) {
    return n != null ? `₹${n.toFixed(2)}` : "—";
}
function getRsiColor(rsi?: number | null) {
    if (!rsi) return "text-gray-500";
    if (rsi >= 70) return "text-red-400 font-semibold";
    if (rsi <= 30) return "text-green-400 font-semibold";
    if (rsi >= 55) return "text-yellow-300";
    return "text-blue-300";
}
function getRsiBadge(rsi?: number | null) {
    if (!rsi) return "bg-gray-800 text-gray-500";
    if (rsi >= 70) return "bg-red-500/20 text-red-300 border border-red-500/30";
    if (rsi <= 30) return "bg-green-500/20 text-green-300 border border-green-500/30";
    return "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30";
}

const defaultFilters = () => ({
    rsi_min: "40", rsi_max: "70",
    min_fvg_count: "", price_min: "", price_max: "",
    has_fvg_only: true,
});

export default function FVGScannerPage() {
    const [allStocks, setAllStocks]   = useState<FVGStock[]>([]);
    const [loading, setLoading]       = useState(false);
    const [error, setError]           = useState<string | null>(null);
    const [filters, setFilters]       = useState(defaultFilters());
    const [search, setSearch]         = useState("");
    const [page, setPage]             = useState(1);
    const [sortKey, setSortKey]       = useState("fvg_count");
    const [sortDir, setSortDir]       = useState<"asc" | "desc">("desc");
    const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedStock, setSelectedStock] = useState<any>(null);

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
            if (f.rsi_min !== "")       params.rsi_min       = Number(f.rsi_min);
            if (f.rsi_max !== "")       params.rsi_max       = Number(f.rsi_max);
            if (f.min_fvg_count !== "") params.min_fvg_count = Number(f.min_fvg_count);
            if (f.price_min !== "")     params.price_min     = Number(f.price_min);
            if (f.price_max !== "")     params.price_max     = Number(f.price_max);
            params.has_fvg_only = f.has_fvg_only;

            const resp = await screenerService.getFVG(params);
            if (resp.data?.success) setAllStocks(resp.data.data);
            else setError(resp.data?.error || "Failed to fetch FVG data");
        } catch (err: any) {
            setError(err?.message || "Network error — is FastAPI running?");
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
            if      (sortKey === "symbol")    { av = a.symbol; bv = b.symbol; }
            else if (sortKey === "price")     { av = a.price ?? 0; bv = b.price ?? 0; }
            else if (sortKey === "rsi")       { av = a.indicators?.rsi_14 ?? 0; bv = b.indicators?.rsi_14 ?? 0; }
            else if (sortKey === "ema_9")     { av = a.indicators?.ema_9 ?? 0; bv = b.indicators?.ema_9 ?? 0; }
            else if (sortKey === "ema_50")    { av = a.indicators?.ema_50 ?? 0; bv = b.indicators?.ema_50 ?? 0; }
            else if (sortKey === "ema_200")   { av = a.indicators?.ema_200 ?? 0; bv = b.indicators?.ema_200 ?? 0; }
            else if (sortKey === "macd")      { av = a.indicators?.macd ?? 0; bv = b.indicators?.macd ?? 0; }
            else if (sortKey === "fvg_count") { av = a.fvg?.total_fvgs_detected ?? 0; bv = b.fvg?.total_fvgs_detected ?? 0; }
            else if (sortKey === "52wh")      { av = a.week52?.high ?? 0; bv = b.week52?.high ?? 0; }
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

    const withFvg = allStocks.filter(s => s.fvg?.has_fvg_bullish).length;

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            <div className="max-w-[1600px] mx-auto px-6 py-8 space-y-5">

                {/* Header */}
                <div className="flex items-start justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Fair Value Gap (FVG) Scanner</h1>
                        <p className="text-gray-400 text-sm mt-1">
                            ICT-style 3-candle bullish FVG detection · EMA 9/50/200 · RSI 14 · 52-week H/L
                        </p>
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

                {/* Filter Panel */}
                <form onSubmit={handleApply} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-semibold text-sm">Filters <span className="text-gray-500 font-normal text-xs ml-2">ICT Fair Value Gap · 2yr history</span></h2>
                        <button type="button" onClick={handleClear} className="text-xs text-gray-500 hover:text-white transition-colors">Reset</button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">

                        {/* RSI Min */}
                        <div className={`rounded-xl p-3 border transition-all ${filters.rsi_min !== "" ? "border-yellow-500/50 bg-yellow-500/5" : "border-gray-800 bg-gray-800/30"}`}>
                            <div className="flex justify-between mb-1.5">
                                <span className="text-xs font-semibold text-yellow-400">RSI Min</span>
                                <span className="text-xs text-gray-600">0–100</span>
                            </div>
                            <input type="number" step="1" min="0" max="100" placeholder="40"
                                value={filters.rsi_min}
                                onChange={e => setFilters(f => ({ ...f, rsi_min: e.target.value }))}
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-yellow-500"
                            />
                        </div>

                        {/* RSI Max */}
                        <div className={`rounded-xl p-3 border transition-all ${filters.rsi_max !== "" ? "border-yellow-500/50 bg-yellow-500/5" : "border-gray-800 bg-gray-800/30"}`}>
                            <div className="flex justify-between mb-1.5">
                                <span className="text-xs font-semibold text-yellow-400">RSI Max</span>
                                <span className="text-xs text-gray-600">0–100</span>
                            </div>
                            <input type="number" step="1" min="0" max="100" placeholder="70"
                                value={filters.rsi_max}
                                onChange={e => setFilters(f => ({ ...f, rsi_max: e.target.value }))}
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-yellow-500"
                            />
                        </div>

                        {/* Min FVG Count */}
                        <div className={`rounded-xl p-3 border transition-all ${filters.min_fvg_count !== "" ? "border-purple-500/50 bg-purple-500/5" : "border-gray-800 bg-gray-800/30"}`}>
                            <div className="flex justify-between mb-1.5">
                                <span className="text-xs font-semibold text-purple-400">Min FVGs</span>
                                <span className="text-xs text-gray-600">2yr count</span>
                            </div>
                            <input type="number" step="1" min="1" placeholder="e.g. 5"
                                value={filters.min_fvg_count}
                                onChange={e => setFilters(f => ({ ...f, min_fvg_count: e.target.value }))}
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                            />
                        </div>

                        {/* Price Min */}
                        <div className={`rounded-xl p-3 border transition-all ${filters.price_min !== "" ? "border-blue-500/50 bg-blue-500/5" : "border-gray-800 bg-gray-800/30"}`}>
                            <div className="flex justify-between mb-1.5">
                                <span className="text-xs font-semibold text-blue-400">Price Min (₹)</span>
                                <span className="text-xs text-gray-600">LTP</span>
                            </div>
                            <input type="number" step="1" placeholder="e.g. 100"
                                value={filters.price_min}
                                onChange={e => setFilters(f => ({ ...f, price_min: e.target.value }))}
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                            />
                        </div>

                        {/* Price Max */}
                        <div className={`rounded-xl p-3 border transition-all ${filters.price_max !== "" ? "border-blue-500/50 bg-blue-500/5" : "border-gray-800 bg-gray-800/30"}`}>
                            <div className="flex justify-between mb-1.5">
                                <span className="text-xs font-semibold text-blue-400">Price Max (₹)</span>
                                <span className="text-xs text-gray-600">LTP</span>
                            </div>
                            <input type="number" step="1" placeholder="e.g. 5000"
                                value={filters.price_max}
                                onChange={e => setFilters(f => ({ ...f, price_max: e.target.value }))}
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                            />
                        </div>

                        {/* Has FVG Only toggle */}
                        <div className="rounded-xl p-3 border border-gray-800 bg-gray-800/30 flex flex-col gap-1.5">
                            <span className="text-xs font-semibold text-purple-400">FVG Only</span>
                            <span className="text-xs text-gray-600">only stocks with FVG</span>
                            <button type="button"
                                onClick={() => setFilters(f => ({ ...f, has_fvg_only: !f.has_fvg_only }))}
                                className={`rounded-lg px-2 py-1.5 text-xs font-medium transition-all border ${filters.has_fvg_only ? "bg-purple-500/20 border-purple-500/50 text-purple-300" : "bg-gray-900 border-gray-700 text-gray-400 hover:text-white"}`}>
                                {filters.has_fvg_only ? "✓ FVG Only" : "All stocks"}
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 justify-between">
                        <div className="relative flex-1 max-w-sm">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
                            <input type="text" placeholder="Search symbol or company…"
                                value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                                className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
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
                        <div className="text-xs text-gray-500">Click row to expand FVG zones</div>
                    </div>

                    {error ? (
                        <div className="m-6 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
                            <strong>Error:</strong> {error}
                            <p className="text-xs text-red-300/70 mt-1">Run: <code className="bg-gray-800 px-1 rounded">python backend/fastapi_app/scripts/fvg_ingest.py</code> to populate FVG data</p>
                        </div>
                    ) : loading ? (
                        <div className="flex flex-col items-center justify-center py-24 gap-3">
                            <div className="w-10 h-10 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
                            <p className="text-gray-400 text-sm">Scanning FVG patterns across 2,000+ stocks…</p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center py-24 gap-2">
                            <div className="text-4xl">🔍</div>
                            <p className="text-gray-400">No stocks match your filters.</p>
                            <p className="text-gray-600 text-xs">Try removing RSI limits or running the FVG ingest script first.</p>
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
                                        <th className="px-4 py-3 text-right cursor-pointer hover:text-white text-yellow-400" onClick={() => handleSort("rsi")}>RSI 14 <SortIcon col="rsi" /></th>
                                        <th className="px-4 py-3 text-right cursor-pointer hover:text-white" onClick={() => handleSort("ema_9")}>EMA 9 <SortIcon col="ema_9" /></th>
                                        <th className="px-4 py-3 text-right cursor-pointer hover:text-white" onClick={() => handleSort("ema_50")}>EMA 50 <SortIcon col="ema_50" /></th>
                                        <th className="px-4 py-3 text-right cursor-pointer hover:text-white" onClick={() => handleSort("ema_200")}>EMA 200 <SortIcon col="ema_200" /></th>
                                        <th className="px-4 py-3 text-right cursor-pointer hover:text-white" onClick={() => handleSort("macd")}>MACD <SortIcon col="macd" /></th>
                                        <th className="px-4 py-3 text-right cursor-pointer hover:text-white text-purple-400" onClick={() => handleSort("fvg_count")}>FVGs (2yr) <SortIcon col="fvg_count" /></th>
                                        <th className="px-4 py-3 text-right cursor-pointer hover:text-white" onClick={() => handleSort("52wh")}>52W High <SortIcon col="52wh" /></th>
                                        <th className="px-4 py-3 text-center">Zones</th>
                                        <th className="px-4 py-3 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pageRows.map((stock, idx) => {
                                        const absIdx = (page - 1) * PAGE_SIZE + idx + 1;
                                        const ind    = stock.indicators;
                                        const fvg    = stock.fvg;
                                        const expanded = expandedSymbol === stock.symbol;
                                        return (
                                            <React.Fragment key={stock.symbol}>
                                                <tr className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors cursor-pointer"
                                                    onClick={() => setExpandedSymbol(expanded ? null : stock.symbol)}>
                                                    <td className="px-4 py-2.5 text-gray-600 text-xs">{absIdx}</td>
                                                    <td className="px-4 py-2.5">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-bold text-blue-400 text-sm">{stock.symbol}</span>
                                                            {fvg?.has_fvg_bullish && (
                                                                <span className="text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded leading-none">FVG</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2.5 text-gray-300 text-xs max-w-[160px] truncate">{stock.company_name}</td>
                                                    <td className="px-4 py-2.5 text-right font-semibold text-white text-sm">{fmtPrice(stock.price)}</td>
                                                    <td className="px-4 py-2.5 text-right">
                                                        {ind?.rsi_14 != null
                                                            ? <span className={`px-2 py-0.5 rounded text-xs font-medium ${getRsiBadge(ind.rsi_14)}`}>{ind.rsi_14.toFixed(1)}</span>
                                                            : <span className="text-gray-600">—</span>}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-right text-gray-300 text-xs">{ind?.ema_9 ? ind.ema_9.toFixed(2) : "—"}</td>
                                                    <td className="px-4 py-2.5 text-right text-gray-300 text-xs">{ind?.ema_50 ? ind.ema_50.toFixed(2) : "—"}</td>
                                                    <td className="px-4 py-2.5 text-right text-gray-300 text-xs">{ind?.ema_200 ? ind.ema_200.toFixed(2) : "—"}</td>
                                                    <td className={`px-4 py-2.5 text-right text-xs font-medium ${ind?.macd != null ? (ind.macd >= 0 ? "text-green-400" : "text-red-400") : "text-gray-600"}`}>
                                                        {ind?.macd != null ? ind.macd.toFixed(2) : "—"}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-right">
                                                        <span className="text-purple-300 font-semibold">{fvg?.total_fvgs_detected ?? "—"}</span>
                                                    </td>
                                                    <td className="px-4 py-2.5 text-right text-gray-400 text-xs">{fmtPrice(stock.week52?.high)}</td>
                                                    <td className="px-4 py-2.5 text-center text-gray-600 text-xs hover:text-white">
                                                        {expanded ? "▲" : "▼"}
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

                                                {/* Expanded FVG Zones */}
                                                {expanded && (
                                                    <tr className="bg-gray-900/80 border-b border-gray-700">
                                                        <td colSpan={12} className="px-6 py-4">
                                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                                {[fvg?.fvg1, fvg?.fvg2, fvg?.fvg3].map((zone, zi) =>
                                                                    zone ? (
                                                                        <div key={zi} className="bg-gray-800 border border-purple-500/30 rounded-xl p-4">
                                                                            <div className="flex items-center justify-between mb-2">
                                                                                <span className="text-xs font-bold text-purple-300">FVG Zone {zi + 1}</span>
                                                                                <span className="text-xs text-gray-500">{zone.start_date} → {zone.end_date}</span>
                                                                            </div>
                                                                            <div className="flex items-center gap-3">
                                                                                <div className="flex-1 bg-purple-500/10 rounded-lg p-2 text-center border border-purple-500/20">
                                                                                    <div className="text-xs text-gray-400 mb-0.5">Low</div>
                                                                                    <div className="font-bold text-purple-300">₹{zone.low.toFixed(2)}</div>
                                                                                </div>
                                                                                <div className="text-gray-600 text-xs">↔</div>
                                                                                <div className="flex-1 bg-green-500/10 rounded-lg p-2 text-center border border-green-500/20">
                                                                                    <div className="text-xs text-gray-400 mb-0.5">High</div>
                                                                                    <div className="font-bold text-green-300">₹{zone.high.toFixed(2)}</div>
                                                                                </div>
                                                                            </div>
                                                                            <div className="text-xs text-gray-500 mt-2 text-center">
                                                                                Gap: ₹{(zone.high - zone.low).toFixed(2)} ({(((zone.high - zone.low) / zone.low) * 100).toFixed(2)}%)
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <div key={zi} className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 flex items-center justify-center">
                                                                            <span className="text-gray-600 text-xs">No FVG Zone {zi + 1}</span>
                                                                        </div>
                                                                    )
                                                                )}
                                                            </div>
                                                            <div className="mt-3 text-xs text-gray-500 flex items-center gap-4">
                                                                <span>52W High: <span className="text-white">{fmtPrice(stock.week52?.high)}</span></span>
                                                                <span>52W Low: <span className="text-white">{fmtPrice(stock.week52?.low)}</span></span>
                                                                <span>EMA 200: <span className="text-white">{ind?.ema_200 ? `₹${ind.ema_200.toFixed(2)}` : "—"}</span></span>
                                                                <span>MACD Signal: <span className={ind?.macd_signal != null ? (ind.macd_signal >= 0 ? "text-green-400" : "text-red-400") : "text-gray-500"}>{ind?.macd_signal?.toFixed(3) ?? "—"}</span></span>
                                                            </div>
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
