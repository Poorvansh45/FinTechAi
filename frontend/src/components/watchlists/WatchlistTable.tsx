import React from "react";
import { WatchlistStock } from "@/services/watchlistService";
import { TrashIcon } from '@heroicons/react/24/outline';

interface Props {
    stocks: WatchlistStock[];
    onRemove: (symbol: string) => void;
}

export default function WatchlistTable({ stocks, onRemove }: Props) {
    if (stocks.length === 0) {
        return (
            <div className="p-8 text-center text-slate-500">
                This watchlist is empty. Add stocks from the Screeners.
            </div>
        );
    }

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric'
        });
    };

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/50">
                        <th className="px-5 py-3 text-left font-semibold text-slate-400">Symbol</th>
                        <th className="px-5 py-3 text-left font-semibold text-slate-400">Added</th>
                        <th className="px-5 py-3 text-right font-semibold text-slate-400">Added (₹)</th>
                        <th className="px-5 py-3 text-right font-semibold text-slate-400">Current (₹)</th>
                        <th className="px-5 py-3 text-right font-semibold text-slate-400">Return</th>
                        <th className="px-5 py-3 text-right font-semibold text-slate-400">High/Low Ret</th>
                        <th className="px-5 py-3 text-right font-semibold text-slate-400">Volatility</th>
                        <th className="px-5 py-3 text-right font-semibold text-slate-400">Held</th>
                        <th className="px-5 py-3 text-left font-semibold text-slate-400">Source</th>
                        <th className="px-5 py-3 text-right font-semibold text-slate-400">Action</th>
                    </tr>
                </thead>
                <tbody>
                    {stocks.map((stock, idx) => {
                        const isPos = stock.return_pct >= 0;
                        return (
                            <tr key={stock.id || `${stock.symbol}-${idx}`} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                                <td className="px-5 py-4">
                                    <div className="font-bold text-white">{stock.symbol}</div>
                                    <div className="text-xs text-slate-500 max-w-[150px] truncate">{stock.company_name}</div>
                                </td>
                                <td className="px-5 py-4 text-slate-300">
                                    {formatDate(stock.added_date)}
                                </td>
                                <td className="px-5 py-4 text-right text-slate-300">
                                    ₹{stock.added_price?.toFixed(2) || "—"}
                                </td>
                                <td className="px-5 py-4 text-right font-medium text-white">
                                    ₹{stock.current_price?.toFixed(2) || "—"}
                                </td>
                                <td className={`px-5 py-4 text-right font-bold ${isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {isPos ? '+' : ''}{stock.return_pct?.toFixed(2) || "0.00"}%
                                </td>
                                <td className="px-5 py-4 text-right text-xs">
                                    <div className="text-emerald-400">High: +{(stock as any).highest_return_pct?.toFixed(2) || "0.00"}%</div>
                                    <div className="text-rose-400">Low: {(stock as any).lowest_return_pct?.toFixed(2) || "0.00"}%</div>
                                </td>
                                <td className="px-5 py-4 text-right text-slate-300">
                                    {(stock as any).volatility_pct?.toFixed(2) || "0.00"}%
                                </td>
                                <td className="px-5 py-4 text-right text-slate-400">
                                    {stock.days_held}d
                                </td>
                                <td className="px-5 py-4 text-left text-xs">
                                    <span className="px-2 py-1 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded-md">
                                        {stock.source_module}
                                    </span>
                                </td>
                                <td className="px-5 py-4 text-right">
                                    <button 
                                        onClick={() => onRemove(stock.symbol)}
                                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                                        title="Remove from Watchlist"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
