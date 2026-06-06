import React, { useEffect, useState } from "react";
import { watchlistService } from "@/services/watchlistService";
import { ChartBarIcon, CpuChipIcon } from '@heroicons/react/24/outline';

interface SourceData {
  source_module: string;
  avg_return_pct: number;
  total_stocks: number;
}

export default function SourceAnalytics() {
  const [data, setData] = useState<SourceData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    watchlistService.getSourcePerformance().then(res => {
      setData(res);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="text-slate-400 py-10 text-center animate-pulse">Loading Source Analytics...</div>;

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <CpuChipIcon className="w-6 h-6 text-indigo-400" />
          Average Return by Source Module
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {data.map((src, idx) => (
            <div key={src.source_module} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 hover:border-slate-600 transition-all">
              <div className="text-sm font-medium text-slate-400 truncate mb-2">
                {src.source_module}
              </div>
              <div className={`text-2xl font-bold ${src.avg_return_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {src.avg_return_pct > 0 ? '+' : ''}{src.avg_return_pct.toFixed(2)}%
              </div>
              <div className="text-xs text-slate-500 mt-2">
                Based on {src.total_stocks} stocks
              </div>
            </div>
          ))}
          {data.length === 0 && (
            <div className="text-slate-500 py-4 col-span-full text-center">No source data available yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
