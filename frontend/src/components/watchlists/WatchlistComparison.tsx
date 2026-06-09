import React from "react";
import { WatchlistStock } from "@/services/watchlistService";
import { TableCellsIcon } from '@heroicons/react/24/outline';

interface Props {
  stocks: WatchlistStock[];
}

export default function WatchlistComparison({ stocks }: Props) {
  const isPos = (val: number | null) => val !== null && val >= 0;

  const renderReturnCell = (val: number | null | undefined) => {
    if (val === null || val === undefined) return <span className="text-slate-600">—</span>;
    return (
      <span className={`font-medium ${isPos(val) ? 'text-emerald-400' : 'text-rose-400'}`}>
        {val > 0 ? '+' : ''}{val.toFixed(2)}%
      </span>
    );
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
      <div className="p-5 border-b border-slate-800 flex items-center gap-3">
        <TableCellsIcon className="w-5 h-5 text-indigo-400" />
        <h3 className="text-lg font-bold text-white">Return Since Addition Date</h3>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-400 bg-slate-900/50 border-b border-slate-800">
            <tr>
              <th className="px-4 py-3 font-semibold uppercase tracking-wider">Symbol</th>
              <th className="px-4 py-3 font-semibold uppercase tracking-wider">Added Date</th>
              <th className="px-4 py-3 font-semibold uppercase tracking-wider text-right">1D</th>
              <th className="px-4 py-3 font-semibold uppercase tracking-wider text-right">5D</th>
              <th className="px-4 py-3 font-semibold uppercase tracking-wider text-right">10D</th>
              <th className="px-4 py-3 font-semibold uppercase tracking-wider text-right">30D</th>
              <th className="px-4 py-3 font-semibold uppercase tracking-wider text-right">90D</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {stocks.map((stock) => {
              const comp = (stock as any).comparison_returns || {};
              return (
                <tr key={stock.symbol} className="hover:bg-slate-800/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{stock.symbol}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {new Date(stock.added_date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">{renderReturnCell(comp['1D'])}</td>
                  <td className="px-4 py-3 text-right">{renderReturnCell(comp['5D'])}</td>
                  <td className="px-4 py-3 text-right">{renderReturnCell(comp['10D'])}</td>
                  <td className="px-4 py-3 text-right">{renderReturnCell(comp['30D'])}</td>
                  <td className="px-4 py-3 text-right">{renderReturnCell(comp['90D'])}</td>
                </tr>
              );
            })}
            {stocks.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No stocks to compare.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
