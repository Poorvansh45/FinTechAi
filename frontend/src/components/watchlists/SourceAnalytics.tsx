"use client";

import { Trophy } from 'lucide-react';
import { withAlpha } from "@/lib/utils";
import React, { useEffect, useState } from "react";
import { watchlistService } from "@/services/watchlistService";

interface SourcePerf {
  source_module: string;
  avg_return_pct: number;
  total_stocks: number;
}

const SOURCE_COLORS: Record<string, string> = {
  "SMC Scanner":        "rgb(var(--brand-400))",
  "FVG Scanner":        "rgb(var(--brand-400))",
  "Volume Scanner":     "rgb(var(--warning-400))",
  "Momentum Scanner":   "rgb(var(--positive-400))",
  "Technical Screener": "rgb(var(--warning-400))",
};

const fmtPct = (v?: number | null) =>
  v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;

const retColor = (v?: number | null) =>
  v == null ? "text-neutral-500" : v > 0 ? "text-positive-400" : v < 0 ? "text-negative-400" : "text-neutral-400";

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
          <div key={i} className="h-16 bg-neutral-800/50 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="text-negative-400 text-sm p-4 bg-negative-400/10 rounded-lg">{error}</div>;
  }

  if (!data.length) {
    return (
      <div className="py-16 text-center text-neutral-500 text-sm">
        No source analytics available yet. Add stocks from multiple scanners to compare.
      </div>
    );
  }

  const maxAbs = Math.max(...data.map((d) => Math.abs(d.avg_return_pct)), 1);

  return (
    <div className="space-y-5">
      {/* Ranking */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-neutral-300 mb-4">Scanner Performance Ranking</h3>
        <div className="space-y-4">
          {data.map((d, i) => {
            const color  = SOURCE_COLORS[d.source_module] || "rgb(var(--neutral-500))";
            const barW   = (Math.abs(d.avg_return_pct) / maxAbs) * 100;
            const isTop  = i === 0;
            return (
              <div key={d.source_module} className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-neutral-500">#{i + 1}</span>
                    <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                    <span className="text-sm text-neutral-300">{d.source_module}</span>
                    {isTop && (
                      <span className="px-1.5 py-0.5 rounded text-[11px] bg-positive-500/20 text-positive-300 border border-positive-500/30">
                        <Trophy className="mr-1 inline h-3 w-3 align-text-bottom" aria-hidden />Best
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-neutral-500">{d.total_stocks} stocks</span>
                    <span className={`text-sm font-bold ${retColor(d.avg_return_pct)}`}>
                      {fmtPct(d.avg_return_pct)}
                    </span>
                  </div>
                </div>
                <div className="h-5 bg-neutral-800 rounded-lg overflow-hidden">
                  <div
                    className="h-full rounded-lg transition-all duration-700"
                    style={{ width: `${barW}%`, background: `${withAlpha(color, 0.31)}`, border: `1px solid ${withAlpha(color, 0.25)}` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Insight callout */}
      {data.length > 0 && (
        <div className="bg-brand-500/5 border border-brand-500/20 rounded-xl p-4 text-sm text-brand-300">
          <strong>Insight:</strong> Your best performing scanner is{" "}
          <span className="font-semibold text-foreground">{data[0].source_module}</span> with an average return
          of <span className="font-semibold text-positive-400">{fmtPct(data[0].avg_return_pct)}</span> across{" "}
          {data[0].total_stocks} stocks. Prioritise adding picks from this scanner.
        </div>
      )}
    </div>
  );
}
