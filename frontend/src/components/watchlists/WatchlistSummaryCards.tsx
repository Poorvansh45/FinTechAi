"use client";

interface Stats {
  total_stocks?: number;
  avg_return_pct?: number;
  win_rate_pct?: number;
  best_performer?: { symbol: string; return: number } | null;
  worst_performer?: { symbol: string; return: number } | null;
  overall_volatility_pct?: number;
  overall_drawdown_pct?: number;
  overall_alpha_vs_nifty?: number;
}

interface Props { stats: Stats; }

export default function WatchlistSummaryCards({ stats }: Props) {
  const fmtPct = (v?: number | null) =>
    v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;

  const retColor = (v?: number | null) =>
    v == null ? "text-neutral-400"
    : v > 0   ? "text-positive-400"
    : v < 0   ? "text-negative-400"
    : "text-neutral-400";

  const cards = [
    {
      label: "Avg Return",
      value: fmtPct(stats.avg_return_pct),
      color: retColor(stats.avg_return_pct),
      sub: `${stats.total_stocks ?? 0} stocks`,
    },
    {
      label: "Win Rate",
      value: stats.win_rate_pct != null ? `${stats.win_rate_pct.toFixed(1)}%` : "—",
      color: (stats.win_rate_pct ?? 0) >= 50 ? "text-positive-400" : "text-negative-400",
      sub: "trades profitable",
    },
    {
      label: "Alpha vs Nifty",
      value: fmtPct(stats.overall_alpha_vs_nifty),
      color: retColor(stats.overall_alpha_vs_nifty),
      sub: "excess return",
    },
    {
      label: "Best Pick",
      value: stats.best_performer?.symbol ?? "—",
      color: "text-positive-400",
      sub: stats.best_performer ? fmtPct(stats.best_performer.return) : "",
    },
    {
      label: "Worst Pick",
      value: stats.worst_performer?.symbol ?? "—",
      color: "text-negative-400",
      sub: stats.worst_performer ? fmtPct(stats.worst_performer.return) : "",
    },
    {
      label: "Volatility",
      value: stats.overall_volatility_pct != null ? `${stats.overall_volatility_pct.toFixed(1)}%` : "—",
      color: "text-warning-400",
      sub: "annualised",
    },
    {
      label: "Drawdown",
      value: fmtPct(stats.overall_drawdown_pct),
      color: retColor(stats.overall_drawdown_pct),
      sub: "from peak",
    },
    {
      label: "Holdings",
      value: String(stats.total_stocks ?? 0),
      color: "text-brand-400",
      sub: "active stocks",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
      {cards.map(({ label, value, color, sub }) => (
        <div
          key={label}
          className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-center hover:border-neutral-700 transition-colors"
        >
          <div className={`text-lg font-bold ${color}`}>{value}</div>
          <div className="text-neutral-500 text-[11px] mt-0.5 leading-tight">{label}</div>
          {sub && <div className="text-neutral-500 text-[11px] mt-0.5">{sub}</div>}
        </div>
      ))}
    </div>
  );
}
