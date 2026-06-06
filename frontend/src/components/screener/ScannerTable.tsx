"use client";

import React, { useState } from "react";
import AddToWatchlistModal from "../watchlists/AddToWatchlistModal";

interface Indicators {
    rsi_14?: number | null;
    ema_20?: number | null;
    ema_50?: number | null;
    macd?: number | null;
    macd_signal?: number | null;
    macd_hist?: number | null;
}

interface StockRow {
    symbol: string;
    company_name?: string;
    price?: number | null;
    volume?: number | null;
    indicators?: Indicators;
}

interface Props {
    stocks?: StockRow[];
    data?: StockRow[];
    isLoading?: boolean;
    sourceModule?: string;
}

function getRsiColor(rsi: number | null | undefined): string {
    if (!rsi) return "text-gray-400";
    if (rsi >= 70) return "text-red-400 font-semibold";
    if (rsi <= 30) return "text-green-400 font-semibold";
    return "text-yellow-300";
}

function getRsiBadge(rsi: number | null | undefined): string {
    if (!rsi) return "bg-gray-700 text-gray-300";
    if (rsi >= 70) return "bg-red-500/20 text-red-300 border border-red-500/30";
    if (rsi <= 30) return "bg-green-500/20 text-green-300 border border-green-500/30";
    return "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30";
}

function fmt(n: number | null | undefined, decimals = 2): string {
    if (n === null || n === undefined) return "—";
    return n.toFixed(decimals);
}

function fmtVol(n: number | null | undefined): string {
    if (!n) return "—";
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
    return n.toString();
}

export default function ScannerTable({ stocks, data, isLoading, sourceModule = "Scanner" }: Props) {
    const rows = stocks || data || [];
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedStock, setSelectedStock] = useState<StockRow | null>(null);

    const handleAddClick = (stock: StockRow) => {
        setSelectedStock(stock);
        setIsModalOpen(true);
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-10 h-10 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                <p className="text-gray-400 text-sm">Fetching screener data…</p>
            </div>
        );
    }

    if (!rows || rows.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
                <div className="text-4xl">🔍</div>
                <p className="text-gray-400 text-sm">No stocks match your current filters.<br />Try widening your conditions.</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-gray-800 bg-gray-800/50">
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">#</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Symbol</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Company</th>
                        <th className="px-5 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">LTP (₹)</th>
                        <th className="px-5 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Volume</th>
                        <th className="px-5 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">RSI (14)</th>
                        <th className="px-5 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">EMA 20</th>
                        <th className="px-5 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">EMA 50</th>
                        <th className="px-5 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">MACD</th>
                        <th className="px-5 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Action</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((item, idx) => {
                        const ind = item.indicators;
                        return (
                            <tr
                                key={item.symbol || idx}
                                className="border-b border-gray-800/60 hover:bg-gray-800/40 transition-colors"
                            >
                                <td className="px-5 py-3 text-gray-500 text-xs">{idx + 1}</td>
                                <td className="px-5 py-3">
                                    <span className="font-bold text-blue-400 tracking-wide">{item.symbol}</span>
                                </td>
                                <td className="px-5 py-3 text-gray-300 text-xs max-w-[180px] truncate">
                                    {item.company_name || "—"}
                                </td>
                                <td className="px-5 py-3 text-right font-semibold text-white">
                                    {item.price ? `₹${item.price.toFixed(2)}` : "—"}
                                </td>
                                <td className="px-5 py-3 text-right text-gray-300">
                                    {fmtVol(item.volume)}
                                </td>
                                <td className="px-5 py-3 text-right">
                                    {ind?.rsi_14 != null ? (
                                        <span className={`px-2 py-0.5 rounded text-xs ${getRsiBadge(ind.rsi_14)}`}>
                                            {fmt(ind.rsi_14)}
                                        </span>
                                    ) : "—"}
                                </td>
                                <td className="px-5 py-3 text-right text-gray-300">{fmt(ind?.ema_20)}</td>
                                <td className="px-5 py-3 text-right text-gray-300">{fmt(ind?.ema_50)}</td>
                                <td className={`px-5 py-3 text-right ${ind?.macd != null ? (ind.macd >= 0 ? "text-green-400" : "text-red-400") : "text-gray-500"}`}>
                                    {fmt(ind?.macd)}
                                </td>
                                <td className="px-5 py-3 text-right">
                                    <button 
                                        onClick={() => handleAddClick(item)}
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

            {selectedStock && (
                <AddToWatchlistModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    symbol={selectedStock.symbol}
                    companyName={selectedStock.company_name || ""}
                    sourceModule={sourceModule}
                    currentPrice={selectedStock.price || 0}
                />
            )}
        </div>
    );
}