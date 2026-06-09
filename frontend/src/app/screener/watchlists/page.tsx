"use client";

import React, { useState, useEffect } from "react";
import { watchlistService, Watchlist, WatchlistDetails } from "@/services/watchlistService";
import WatchlistTable from "@/components/watchlists/WatchlistTable";
import WatchlistSummaryCards from "@/components/watchlists/WatchlistSummaryCards";
import WatchlistComparison from "@/components/watchlists/WatchlistComparison";
import SourceAnalytics from "@/components/watchlists/SourceAnalytics";
import { TrashIcon, PencilSquareIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline';

export default function WatchlistsPage() {
    const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
    const [selectedWatchlistId, setSelectedWatchlistId] = useState<string | null>(null);
    const [details, setDetails] = useState<WatchlistDetails | null>(null);
    const [loadingList, setLoadingList] = useState(true);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"Holdings" | "Comparison" | "SourceAnalytics">("Holdings");

    useEffect(() => {
        loadWatchlists();
    }, []);

    useEffect(() => {
        if (selectedWatchlistId) {
            loadDetails(selectedWatchlistId);
        } else {
            setDetails(null);
        }
    }, [selectedWatchlistId]);

    const loadWatchlists = async () => {
        try {
            setLoadingList(true);
            const data = await watchlistService.getWatchlists();
            setWatchlists(data);
            if (data.length > 0 && !selectedWatchlistId) {
                setSelectedWatchlistId(data[0].id);
            }
        } catch (err: any) {
            setError(err.message || "Failed to load watchlists");
        } finally {
            setLoadingList(false);
        }
    };

    const loadDetails = async (id: string) => {
        try {
            setLoadingDetails(true);
            const data = await watchlistService.getWatchlistDetails(id);
            setDetails(data);
        } catch (err: any) {
            setError(err.message || "Failed to load watchlist details");
        } finally {
            setLoadingDetails(false);
        }
    };

    const handleRemoveStock = async (symbol: string) => {
        if (!selectedWatchlistId) return;
        try {
            await watchlistService.removeStock(selectedWatchlistId, symbol);
            // Refresh details
            loadDetails(selectedWatchlistId);
        } catch (err: any) {
            setError(err.message || "Failed to remove stock");
        }
    };

    const handleDeleteWatchlist = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to delete this watchlist? Historical performance will be preserved.")) return;
        try {
            await watchlistService.deleteWatchlist(id);
            if (selectedWatchlistId === id) setSelectedWatchlistId(null);
            loadWatchlists();
        } catch (err: any) {
            setError(err.message || "Failed to delete watchlist");
        }
    };

    const handleRenameWatchlist = async (id: string, currentName: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const newName = prompt("Enter new watchlist name:", currentName);
        if (!newName || newName === currentName) return;
        try {
            await watchlistService.renameWatchlist(id, newName);
            loadWatchlists();
            if (selectedWatchlistId === id) loadDetails(id);
        } catch (err: any) {
            setError(err.message || "Failed to rename watchlist");
        }
    };

    const handleDuplicateWatchlist = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await watchlistService.duplicateWatchlist(id);
            loadWatchlists();
        } catch (err: any) {
            setError(err.message || "Failed to duplicate watchlist");
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white p-6 md:p-12">
            <div className="max-w-7xl mx-auto space-y-8">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
                            Smart Watchlists
                        </h1>
                        <p className="text-slate-400 mt-2">
                            Track performance of your picks dynamically across all screener modules.
                        </p>
                    </div>
                </div>

                {error && (
                    <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl">
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Left Sidebar - List of Watchlists */}
                    <div className="lg:col-span-1 space-y-4">
                        <h2 className="text-lg font-semibold text-white">Your Watchlists</h2>
                        {loadingList ? (
                            <div className="animate-pulse space-y-3">
                                {[1, 2, 3].map(i => <div key={i} className="h-16 bg-slate-900 rounded-xl" />)}
                            </div>
                        ) : watchlists.length === 0 ? (
                            <div className="p-6 bg-slate-900/50 rounded-xl border border-slate-800 text-center text-slate-500 text-sm">
                                No watchlists found.<br/>Go to the Screeners to add your first stock!
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {watchlists.map(wl => (
                                    <div
                                        key={wl.id}
                                        onClick={() => setSelectedWatchlistId(wl.id)}
                                        className={`w-full group cursor-pointer flex items-center justify-between p-4 rounded-xl transition-all border ${
                                            selectedWatchlistId === wl.id 
                                            ? "bg-indigo-600/10 border-indigo-500/30 text-indigo-300" 
                                            : "bg-slate-900/50 border-slate-800 text-slate-400 hover:bg-slate-900 hover:border-slate-700 hover:text-slate-300"
                                        }`}
                                    >
                                        <div className="text-left">
                                            <div className="font-medium">{wl.name}</div>
                                            <div className="text-xs opacity-60 mt-1">{wl.stock_count} stocks</div>
                                        </div>
                                        
                                        {/* Action buttons appear on hover via group */}
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={(e) => handleDuplicateWatchlist(wl.id, e)} className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white" title="Duplicate">
                                                <DocumentDuplicateIcon className="w-4 h-4" />
                                            </button>
                                            <button onClick={(e) => handleRenameWatchlist(wl.id, wl.name, e)} className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white" title="Rename">
                                                <PencilSquareIcon className="w-4 h-4" />
                                            </button>
                                            <button onClick={(e) => handleDeleteWatchlist(wl.id, e)} className="p-1.5 hover:bg-rose-500/20 rounded text-rose-400 hover:text-rose-300" title="Delete">
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Right Main Content - Stats & Table */}
                    <div className="lg:col-span-3 space-y-6">
                        {loadingDetails ? (
                            <div className="flex flex-col items-center justify-center py-32 text-slate-500">
                                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
                                Analyzing performance...
                            </div>
                        ) : details ? (
                            <>
                                <WatchlistSummaryCards stats={details.stats} />
                                
                                {/* Tabs */}
                                <div className="flex gap-4 border-b border-slate-800">
                                    <button 
                                        className={`pb-3 px-2 font-medium border-b-2 transition-colors ${activeTab === "Holdings" ? "border-indigo-500 text-indigo-400" : "border-transparent text-slate-400 hover:text-slate-300"}`}
                                        onClick={() => setActiveTab("Holdings")}
                                    >
                                        Holdings
                                    </button>
                                    <button 
                                        className={`pb-3 px-2 font-medium border-b-2 transition-colors ${activeTab === "Comparison" ? "border-indigo-500 text-indigo-400" : "border-transparent text-slate-400 hover:text-slate-300"}`}
                                        onClick={() => setActiveTab("Comparison")}
                                    >
                                        Comparison Engine
                                    </button>
                                    <button 
                                        className={`pb-3 px-2 font-medium border-b-2 transition-colors ${activeTab === "SourceAnalytics" ? "border-indigo-500 text-indigo-400" : "border-transparent text-slate-400 hover:text-slate-300"}`}
                                        onClick={() => setActiveTab("SourceAnalytics")}
                                    >
                                        Source Analytics
                                    </button>
                                </div>

                                {activeTab === "Holdings" && (
                                    <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
                                        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                                            <h3 className="font-semibold text-lg text-white">
                                                Holdings in {details.watchlist.name}
                                            </h3>
                                        </div>
                                        <WatchlistTable 
                                            stocks={details.stocks} 
                                            onRemove={handleRemoveStock}
                                        />
                                    </div>
                                )}
                                
                                {activeTab === "Comparison" && (
                                    <WatchlistComparison stocks={details.stocks} />
                                )}

                                {activeTab === "SourceAnalytics" && (
                                    <SourceAnalytics />
                                )}
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-32 text-slate-500 border border-dashed border-slate-800 rounded-2xl">
                                Select a watchlist to view its performance.
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
