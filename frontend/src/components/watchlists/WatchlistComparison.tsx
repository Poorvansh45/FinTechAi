"use client";

interface Stock {
  symbol: string;
  source_module?: string;
  return_pct?: number;
  highest_return_pct?: number;
  lowest_return_pct?: number;
  current_drawdown_pct?: number;
  days_held?: number;
  alpha_vs_nifty?: number;
}

interface Props { stocks: Stock[]; }

const fmtPct = (v?: number | null) =>
  v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;

const retColor = (v?: number | null) =>
  v == null ? "text-gray-500" : v > 0 ? "text-emerald-400" : v < 0 ? "text-red-400" : "text-gray-400";

const SOURCE_COLORS: Record<string, string> = {
  "SMC Scanner":        "#a78bfa",
  "FVG Scanner":        "#60a5fa",
  "Volume Scanner":     "#fb923c",
  "Momentum Scanner":   "#34d399",
  "Technical Screener": "#fbbf24",
};

export default function WatchlistComparison({ stocks }: Props) {
  if (!stocks.length) {
    return (
      <div className="py-16 text-center text-gray-600 text-sm">
        No holdings to compare.
      </div>
    );
  }

  // Group by source
  const groups: Record<string, Stock[]> = {};
  stocks.forEach((s) => {
    const src = s.source_module || "Unknown";
    if (!groups[src]) groups[src] = [];
    groups[src].push(s);
  });

  // Compute per-source metrics
  const metrics = Object.entries(groups).map(([src, items]) => {
    const n        = items.length;
    const returns  = items.map((s) => s.return_pct ?? 0);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / n;
    const winRate   = (returns.filter((v) => v > 0).length / n) * 100;
    const maxGain   = Math.max(...items.map((s) => s.highest_return_pct ?? -999));
    const maxDD     = Math.min(...items.map((s) => s.lowest_return_pct ?? 999));
    const avgDays   = items.reduce((s, x) => s + (x.days_held ?? 0), 0) / n;
    const avgAlpha  = items.reduce((s, x) => s + (x.alpha_vs_nifty ?? 0), 0) / n;
    return { src, n, avgReturn, winRate, maxGain, maxDD, avgDays, avgAlpha };
  }).sort((a, b) => b.avgReturn - a.avgReturn);

  // Best performing source
  const best = metrics[0];

  return (
    <div className="space-y-5">
      {/* Scanner ranking */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">Scanner Comparison</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-800">
                <th className="pb-2 text-left">Source</th>
                <th className="pb-2 text-right">Picks</th>
                <th className="pb-2 text-right">Avg Return</th>
                <th className="pb-2 text-right">Win Rate</th>
                <th className="pb-2 text-right">Max Gain</th>
                <th className="pb-2 text-right">Max Loss</th>
                <th className="pb-2 text-right">Avg Alpha</th>
                <th className="pb-2 text-right">Avg Days</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map(({ src, n, avgReturn, winRate, maxGain, maxDD, avgDays, avgAlpha }) => (
                <tr key={src} className="border-b border-gray-800/50 hover:bg-gray-800/25">
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full"
                        style={{ background: SOURCE_COLORS[src] || "#6b7280" }} />
                      <span className="text-gray-300 text-xs">{src}</span>
                      {src === best.src && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Best</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 text-right text-gray-400 text-xs">{n}</td>
                  <td className={`py-3 text-right font-bold text-sm ${retColor(avgReturn)}`}>{fmtPct(avgReturn)}</td>
                  <td className="py-3 text-right text-xs text-gray-300">{winRate.toFixed(0)}%</td>
                  <td className="py-3 text-right text-xs text-emerald-400">{fmtPct(maxGain)}</td>
                  <td className="py-3 text-right text-xs text-red-400">{fmtPct(maxDD)}</td>
                  <td className={`py-3 text-right text-xs ${retColor(avgAlpha)}`}>{fmtPct(avgAlpha)}</td>
                  <td className="py-3 text-right text-xs text-gray-500">{avgDays.toFixed(0)}d</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Visual bar comparison */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">Average Return by Source</h3>
        <div className="space-y-3">
          {metrics.map(({ src, avgReturn }) => {
            const pct    = Math.abs(avgReturn);
            const maxPct = Math.max(...metrics.map((m) => Math.abs(m.avgReturn)), 1);
            const barW   = (pct / maxPct) * 100;
            const color  = SOURCE_COLORS[src] || "#6b7280";
            return (
              <div key={src} className="flex items-center gap-3">
                <div className="w-36 text-xs text-gray-400 text-right truncate">{src}</div>
                <div className="flex-1 h-7 bg-gray-800 rounded-lg overflow-hidden relative">
                  <div
                    className="h-full rounded-lg transition-all duration-700"
                    style={{ width: `${barW}%`, background: `${color}40` }}
                  />
                  <div
                    className="absolute inset-y-0 left-0 rounded-lg transition-all duration-700"
                    style={{ width: `${barW}%`, background: `${color}20`, border: `1px solid ${color}40` }}
                  />
                  <span className={`absolute inset-0 flex items-center px-3 text-xs font-bold ${retColor(avgReturn)}`}>
                    {fmtPct(avgReturn)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
