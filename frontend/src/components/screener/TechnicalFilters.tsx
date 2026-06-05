"use client";

import React, { useState, useEffect } from "react";
import { screenerService } from "@/services/screenerService";
import { ScannerTable } from "./ScannerTable";
import { StockData } from "@/types/screener";

export default function TechnicalFilters() {
    const [stocks, setStocks] = useState<StockData[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Filter states
    const [filters, setFilters] = useState({
        rsi_min: "",
        rsi_max: "",
        ema20_min: "",
        ema20_max: "",
        ema50_min: "",
        ema50_max: "",
        macd_min: "",
        macd_max: "",
        volume_min: "",
        volume_max: "",
    });

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFilters({
            ...filters,
            [e.target.name]: e.target.value,
        });
    };

    const fetchStocks = async () => {
        setLoading(true);
        setError(null);
        try {
            // Clean up empty strings to undefined
            const params: Record<string, any> = {};
            Object.entries(filters).forEach(([key, value]) => {
                if (value !== "") {
                    params[key] = Number(value);
                }
            });

            const response = await screenerService.getTechnicalFilters(params);
            if (response.data.success) {
                setStocks(response.data.data);
            } else {
                setError(response.data.error || "Failed to fetch data");
            }
        } catch (err: any) {
            console.error("Error fetching technical filters:", err);
            setError(err.message || "Network error occurred");
        } finally {
            setLoading(false);
        }
    };

    // Initial load
    useEffect(() => {
        fetchStocks();
    }, []);

    const handleApply = (e: React.FormEvent) => {
        e.preventDefault();
        fetchStocks();
    };

    const handleClear = () => {
        setFilters({
            rsi_min: "", rsi_max: "",
            ema20_min: "", ema20_max: "",
            ema50_min: "", ema50_max: "",
            macd_min: "", macd_max: "",
            volume_min: "", volume_max: "",
        });
    };

    return (
        <div className="space-y-6">
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold text-white">Custom Technical Screener</h2>
                    <button 
                        onClick={handleClear}
                        className="text-sm text-gray-400 hover:text-white transition-colors"
                    >
                        Clear Filters
                    </button>
                </div>
                
                <form onSubmit={handleApply} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        
                        {/* RSI Filter */}
                        <div className="space-y-2">
                            <label className="text-sm text-gray-400 font-medium">RSI (14)</label>
                            <div className="flex space-x-2">
                                <input 
                                    type="number" name="rsi_min" placeholder="Min" 
                                    value={filters.rsi_min} onChange={handleFilterChange}
                                    className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-blue-500"
                                />
                                <input 
                                    type="number" name="rsi_max" placeholder="Max" 
                                    value={filters.rsi_max} onChange={handleFilterChange}
                                    className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-blue-500"
                                />
                            </div>
                        </div>

                        {/* EMA 20 Filter */}
                        <div className="space-y-2">
                            <label className="text-sm text-gray-400 font-medium">EMA (20)</label>
                            <div className="flex space-x-2">
                                <input 
                                    type="number" name="ema20_min" placeholder="Min" 
                                    value={filters.ema20_min} onChange={handleFilterChange}
                                    className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-blue-500"
                                />
                                <input 
                                    type="number" name="ema20_max" placeholder="Max" 
                                    value={filters.ema20_max} onChange={handleFilterChange}
                                    className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-blue-500"
                                />
                            </div>
                        </div>

                        {/* EMA 50 Filter */}
                        <div className="space-y-2">
                            <label className="text-sm text-gray-400 font-medium">EMA (50)</label>
                            <div className="flex space-x-2">
                                <input 
                                    type="number" name="ema50_min" placeholder="Min" 
                                    value={filters.ema50_min} onChange={handleFilterChange}
                                    className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-blue-500"
                                />
                                <input 
                                    type="number" name="ema50_max" placeholder="Max" 
                                    value={filters.ema50_max} onChange={handleFilterChange}
                                    className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-blue-500"
                                />
                            </div>
                        </div>

                        {/* MACD Filter */}
                        <div className="space-y-2">
                            <label className="text-sm text-gray-400 font-medium">MACD</label>
                            <div className="flex space-x-2">
                                <input 
                                    type="number" name="macd_min" placeholder="Min" 
                                    value={filters.macd_min} onChange={handleFilterChange}
                                    step="0.01"
                                    className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-blue-500"
                                />
                                <input 
                                    type="number" name="macd_max" placeholder="Max" 
                                    value={filters.macd_max} onChange={handleFilterChange}
                                    step="0.01"
                                    className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-blue-500"
                                />
                            </div>
                        </div>

                        {/* Volume Filter */}
                        <div className="space-y-2">
                            <label className="text-sm text-gray-400 font-medium">Volume</label>
                            <div className="flex space-x-2">
                                <input 
                                    type="number" name="volume_min" placeholder="Min" 
                                    value={filters.volume_min} onChange={handleFilterChange}
                                    className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-blue-500"
                                />
                                <input 
                                    type="number" name="volume_max" placeholder="Max" 
                                    value={filters.volume_max} onChange={handleFilterChange}
                                    className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-blue-500"
                                />
                            </div>
                        </div>

                    </div>
                    
                    <div className="pt-4 flex justify-end">
                        <button 
                            type="submit" 
                            disabled={loading}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors disabled:opacity-50"
                        >
                            {loading ? "Searching..." : "Apply Filters"}
                        </button>
                    </div>
                </form>
            </div>

            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-white">Results ({stocks.length})</h2>
                </div>
                
                {error ? (
                    <div className="text-red-400 p-4 bg-red-400/10 rounded-lg text-sm">
                        {error}
                    </div>
                ) : (
                    <ScannerTable stocks={stocks} isLoading={loading} />
                )}
            </div>
        </div>
    );
}
