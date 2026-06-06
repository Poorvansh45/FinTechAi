import React from "react";
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon, ChartBarIcon, PresentationChartLineIcon } from '@heroicons/react/24/outline';

interface Stats {
  total_stocks: number;
  avg_return_pct: number;
  win_rate_pct: number;
  best_performer: { symbol: string; return: number } | null;
  worst_performer: { symbol: string; return: number } | null;
  overall_volatility_pct?: number;
  overall_drawdown_pct?: number;
  overall_alpha_vs_nifty?: number;
}

export default function WatchlistSummaryCards({ stats }: { stats: Stats }) {
  const isPos = (val: number) => val >= 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {/* Avg Return */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
        <div className="flex items-center gap-3 text-slate-400 mb-2">
          <ChartBarIcon className="w-5 h-5 text-indigo-400" />
          <span className="text-sm font-medium">Avg Return</span>
        </div>
        <div className={`text-2xl font-bold ${isPos(stats.avg_return_pct) ? 'text-emerald-400' : 'text-rose-400'}`}>
          {stats.avg_return_pct > 0 ? '+' : ''}{stats.avg_return_pct.toFixed(2)}%
        </div>
      </div>

      {/* Win Rate */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
        <div className="flex items-center gap-3 text-slate-400 mb-2">
          <PresentationChartLineIcon className="w-5 h-5 text-blue-400" />
          <span className="text-sm font-medium">Win Rate</span>
        </div>
        <div className="text-2xl font-bold text-white">
          {stats.win_rate_pct.toFixed(0)}%
        </div>
        <div className="text-xs text-slate-500 mt-1">
          {stats.total_stocks} Total Stocks
        </div>
      </div>

      {/* Alpha vs Nifty */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
        <div className="flex items-center gap-3 text-slate-400 mb-2">
          <ChartBarIcon className="w-5 h-5 text-amber-400" />
          <span className="text-sm font-medium">Alpha (Nifty 50)</span>
        </div>
        <div className={`text-2xl font-bold ${isPos(stats.overall_alpha_vs_nifty || 0) ? 'text-emerald-400' : 'text-rose-400'}`}>
          {(stats.overall_alpha_vs_nifty || 0) > 0 ? '+' : ''}{(stats.overall_alpha_vs_nifty || 0).toFixed(2)}%
        </div>
      </div>

      {/* Drawdown */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
        <div className="flex items-center gap-3 text-slate-400 mb-2">
          <ArrowTrendingDownIcon className="w-5 h-5 text-purple-400" />
          <span className="text-sm font-medium">Drawdown</span>
        </div>
        <div className="text-2xl font-bold text-rose-400">
          {(stats.overall_drawdown_pct || 0).toFixed(2)}%
        </div>
      </div>

      {/* Best Performer */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
        <div className="flex items-center gap-3 text-slate-400 mb-2">
          <ArrowTrendingUpIcon className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-medium">Best</span>
        </div>
        {stats.best_performer ? (
          <>
            <div className="text-xl font-bold text-emerald-400">
              {stats.best_performer.symbol}
            </div>
            <div className="text-sm text-emerald-500/80 mt-0.5">
              +{stats.best_performer.return.toFixed(2)}%
            </div>
          </>
        ) : (
          <div className="text-slate-600">—</div>
        )}
      </div>

      {/* Worst Performer */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
        <div className="flex items-center gap-3 text-slate-400 mb-2">
          <ArrowTrendingDownIcon className="w-5 h-5 text-rose-400" />
          <span className="text-sm font-medium">Worst</span>
        </div>
        {stats.worst_performer ? (
          <>
            <div className="text-xl font-bold text-rose-400">
              {stats.worst_performer.symbol}
            </div>
            <div className="text-sm text-rose-500/80 mt-0.5">
              {stats.worst_performer.return.toFixed(2)}%
            </div>
          </>
        ) : (
          <div className="text-slate-600">—</div>
        )}
      </div>
    </div>
  );
}
