"use client";

import React, { useEffect, useState } from "react";
import { watchlistService } from "@/services/watchlistService";

interface SourcePerf {
  source_module: string;
  avg_return_pct: number;
  total_stocks: number;
}

const SOURCE_COLORS: Record<string, string> = {
  "SMC Scanner":        "#a78bfa",
  "FVG Scanner":        "#60a5fa",
  "Volume Scanner":     "#fb923c",
  "Momentum Scanner":   "#34d399",
  "Technical Screener": "#fbbf24",
};

const fmtPct = (v?: number | null) =>
  v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;

const retColor = (v?: number | null) =>
  v == null ? "text-gray-500" : v > 0 ? "text-emerald-400" : v < 0 ? "text-red-400" : "text-gray-400";

export default function SourceAnalytics() {
  const [data, setData]       = useState<SourcePerf[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    watchlistService.getSourcePerformance()
      .then((res) => setData(res))
      .catch((e) => setError(e.message || "Failed"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-gray-800/50 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="text-red-400 text-sm p-4 bg-red-400/10 rounded-lg">{error}</div>;
  }

  if (!data.length) {
    return (
      <div className="py-16 text-center text-gray-600 text-sm">
        No source analytics available yet. Add stocks from multiple scanners to compare.
      </div>
    );
  }

  const maxAbs = Math.max(...data.map((d) => Math.abs(d.avg_return_pct)), 1);

  return (
    <div className="space-y-5">
      {/* Ranking */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">Scanner Performance Ranking</h3>
        <div className="space-y-4">
          {data.map((d, i) => {
            const color  = SOURCE_COLORS[d.source_module] || "#6b7280";
            const barW   = (Math.abs(d.avg_return_pct) / maxAbs) * 100;
            const isTop  = i === 0;
            return (
              <div key={d.source_module} className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-600">#{i + 1}</span>
                    <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                    <span className="text-sm text-gray-300">{d.source_module}</span>
                    {isTop && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        🏆 Best
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-600">{d.total_stocks} stocks</span>
                    <span className={`text-sm font-bold ${retColor(d.avg_return_pct)}`}>
                      {fmtPct(d.avg_return_pct)}
                    </span>
                  </div>
                </div>
                <div className="h-5 bg-gray-800 rounded-lg overflow-hidden">
                  <div
                    className="h-full rounded-lg transition-all duration-700"
                    style={{ width: `${barW}%`, background: `${color}50`, border: `1px solid ${color}40` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Insight callout */}
      {data.length > 0 && (
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 text-sm text-blue-300/80">
          <strong>Insight:</strong> Your best performing scanner is{" "}
          <span className="font-semibold text-white">{data[0].source_module}</span> with an average return
          of <span className="font-semibold text-emerald-400">{fmtPct(data[0].avg_return_pct)}</span> across{" "}
          {data[0].total_stocks} stocks. Prioritise adding picks from this scanner.
        </div>
      )}
    </div>
  );
}
