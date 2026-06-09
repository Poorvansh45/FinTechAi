"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { screenerService } from "@/services/screenerService";
import { PlusIcon } from "@heroicons/react/24/outline";
import AddToWatchlistModal from "@/components/watchlists/AddToWatchlistModal";

interface SMCZoneResult {
    symbol: string;
    ltp: number;
    zone_id: number;
    zone_high: number;
    zone_low: number;
    zone_width_pct: number;
    distance_pct: number;
    created_date: string;
    zone_age_days: number;
    event: string;
    status: string;
}

interface SMCStats {
    total_active_zones: number;
    inside_zone: number;
    within_2_pct: number;
    within_5_pct: number;
    avg_distance: number;
}

const CATEGORIES = [
    "All",
    "Inside Zone",
    "Near Zone (2%)",
    "Near Zone (5%)",
    "Fresh Zones",
    "CHoCH Zones",
    "BOS Zones"
];

const PAGE_SIZE = 50;

function fmtPrice(n?: number | null) {
    return n != null ? `₹${n.toFixed(2)}` : "—";
}

export default function SMCScannerPage() {
    const [results, setResults] = useState<SMCZoneResult[]>([]);
    const [stats, setStats] = useState<SMCStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [category, setCategory] = useState("All");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedStock, setSelectedStock] = useState<any>(null);

    const handleAddClick = (stock: SMCZoneResult, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedStock({
            symbol: stock.symbol,
            company_name: stock.symbol, // We don't have company name in SMC results right now
            price: stock.ltp
        });
        setIsModalOpen(true);
    };

    const fetchData = useCallback(async (cat: string) => {
        setLoading(true); setError(null); setPage(1);
        try {
            const params: any = { limit: 500 };
            if (cat !== "All") params.category = cat;
            
            const [resp, statsResp] = await Promise.all([
                screenerService.getSMC(params),
                screenerService.getSMCStats()
            ]);
            
            if (resp.data?.success) setResults(resp.data.data);
            else setError(resp.data?.error || "Failed to fetch SMC data");
            
            if (statsResp.data?.success) setStats(statsResp.data.data);
        } catch (err: any) {
            setError(err?.message || "Network error — is FastAPI running?");
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchData(category); }, [category, fetchData]);

    const filtered = useMemo(() => {
        let rows = results;
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            rows = rows.filter(s => s.symbol.toLowerCase().includes(q));
        }
        return rows;
    }, [results, search]);

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            <div className="max-w-[1600px] mx-auto px-6 py-8 space-y-5">
                
                {/* Header & Stats */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Institutional Demand Scanner</h1>
                        <p className="text-gray-400 text-sm mt-1">
                            Smart Money Concepts (SMC) · Demand Zones · BOS & CHoCH
                        </p>
                    </div>
                </div>
                
                {stats && (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                            <div className="text-sm text-gray-400 mb-1">Total Active Zones</div>
                            <div className="text-2xl font-bold text-white">{stats.total_active_zones}</div>
                        </div>
                        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                            <div className="text-sm text-green-400/80 mb-1">Inside Zone (0%)</div>
                            <div className="text-2xl font-bold text-green-400">{stats.inside_zone}</div>
                        </div>
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                            <div className="text-sm text-blue-400/80 mb-1">Near Zone (≤ 2%)</div>
                            <div className="text-2xl font-bold text-blue-400">{stats.within_2_pct}</div>
                        </div>
                        <div className="bg-blue-900/10 border border-blue-900/30 rounded-xl p-4">
                            <div className="text-sm text-blue-300/80 mb-1">Near Zone (≤ 5%)</div>
                            <div className="text-2xl font-bold text-blue-300">{stats.within_5_pct}</div>
                        </div>
                        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
                            <div className="text-sm text-purple-400/80 mb-1">Average Distance</div>
                            <div className="text-2xl font-bold text-purple-400">{stats.avg_distance}%</div>
                        </div>
                    </div>
                )}

                {/* Filter Panel */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                    <div className="flex flex-wrap gap-2 mb-4">
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setCategory(cat)}
                                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${category === cat ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <div className="relative flex-1 max-w-sm">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
                            <input type="text" placeholder="Search symbol…"
                                value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                                className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Results Table */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
                        <div className="text-sm font-medium text-gray-300">
                            {filtered.length > 0
                                ? <>Showing <span className="text-white font-semibold">{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)}</span> of <span className="text-white font-semibold">{filtered.length.toLocaleString()}</span></>
                                : "No results"}
                        </div>
                    </div>

                    {error ? (
                        <div className="m-6 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
                            <strong>Error:</strong> {error}
                        </div>
                    ) : loading ? (
                        <div className="flex flex-col items-center justify-center py-24 gap-3">
                            <div className="w-10 h-10 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                            <p className="text-gray-400 text-sm">Scanning Demand Zones…</p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center py-24 gap-2">
                            <div className="text-4xl">🔍</div>
                            <p className="text-gray-400">No stocks match your filters.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-800/40 border-b border-gray-800 text-xs text-gray-400 uppercase tracking-wider">
                                        <th className="px-4 py-3 text-left w-10">#</th>
                                        <th className="px-4 py-3 text-left">Symbol</th>
                                        <th className="px-4 py-3 text-right">LTP (₹)</th>
                                        <th className="px-4 py-3 text-right">Distance %</th>
                                        <th className="px-4 py-3 text-right">Zone High</th>
                                        <th className="px-4 py-3 text-right">Zone Low</th>
                                        <th className="px-4 py-3 text-right">Width %</th>
                                        <th className="px-4 py-3 text-center">Event</th>
                                        <th className="px-4 py-3 text-center">Age (Days)</th>
                                        <th className="px-4 py-3 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pageRows.map((s, idx) => {
                                        const absIdx = (page - 1) * PAGE_SIZE + idx + 1;
                                        return (
                                            <tr key={s.symbol} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                                                <td className="px-4 py-2.5 text-gray-600 text-xs">{absIdx}</td>
                                                <td className="px-4 py-2.5">
                                                    <span className="font-bold text-blue-400 text-sm">{s.symbol}</span>
                                                </td>
                                                <td className="px-4 py-2.5 text-right font-semibold text-white">{fmtPrice(s.ltp)}</td>
                                                <td className={`px-4 py-2.5 text-right font-semibold ${s.distance_pct === 0 ? "text-green-400" : s.distance_pct <= 2 ? "text-blue-400" : "text-gray-400"}`}>
                                                    {s.distance_pct.toFixed(2)}%
                                                </td>
                                                <td className="px-4 py-2.5 text-right text-gray-300">{fmtPrice(s.zone_high)}</td>
                                                <td className="px-4 py-2.5 text-right text-gray-300">{fmtPrice(s.zone_low)}</td>
                                                <td className="px-4 py-2.5 text-right text-gray-400 text-xs">{s.zone_width_pct.toFixed(2)}%</td>
                                                <td className="px-4 py-2.5 text-center">
                                                    <span className={`text-xs px-2 py-0.5 rounded ${s.event === "CHoCH" ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" : "bg-purple-500/20 text-purple-400 border border-purple-500/30"}`}>
                                                        {s.event}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2.5 text-center text-gray-400 text-xs">{s.zone_age_days}</td>
                                                <td className="px-4 py-2.5 text-center">
                                                    <button 
                                                        onClick={(e) => handleAddClick(s, e)}
                                                        className="inline-flex items-center gap-1 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 px-2 py-1 rounded text-xs transition-colors"
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
                    
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-800">
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                                className="px-4 py-1.5 text-sm rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                                ← Prev
                            </button>
                            <span className="text-gray-400 text-xs">Page {page} of {totalPages}</span>
                            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                                className="px-4 py-1.5 text-sm rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                                Next →
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {selectedStock && (
                <AddToWatchlistModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    symbol={selectedStock?.symbol}
                    companyName={selectedStock?.company_name}
                    currentPrice={selectedStock?.price}
                    sourceModule="SMC Scanner"
                />
            )}
        </div>
    );
}
