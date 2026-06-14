"use client";

import React, { useState, useEffect, useCallback } from "react";
import { watchlistService, Watchlist, WatchlistDetails } from "@/services/watchlistService";
import WatchlistTable from "@/components/watchlists/WatchlistTable";
import WatchlistSummaryCards from "@/components/watchlists/WatchlistSummaryCards";
import WatchlistComparison from "@/components/watchlists/WatchlistComparison";
import SourceAnalytics from "@/components/watchlists/SourceAnalytics";
import {
  TrashIcon, PencilSquareIcon, DocumentDuplicateIcon,
  PlusIcon, XMarkIcon, ChartBarIcon, ArrowTrendingUpIcon,
} from "@heroicons/react/24/outline";

// ── Types ─────────────────────────────────────────────────────────────────────
type Tab = "Holdings" | "Comparison" | "Source" | "Benchmark";

interface DeleteConfirmProps {
  watchlistName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// ── Delete Confirm Modal ──────────────────────────────────────────────────────
function DeleteConfirmModal({ watchlistName, onConfirm, onCancel }: DeleteConfirmProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
            <TrashIcon className="w-5 h-5 text-red-400" />
          </div>
          <h3 className="font-semibold text-white text-lg">Delete Watchlist</h3>
        </div>
        <p className="text-gray-400 text-sm mb-2">
          Are you sure you want to delete <span className="font-semibold text-white">{watchlistName}</span>?
        </p>
        <p className="text-gray-600 text-xs mb-6">
          Historical performance data will be preserved in the archive.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 px-4 rounded-xl bg-gray-800 text-white hover:bg-gray-700 transition-colors text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 text-white hover:bg-red-500 transition-colors text-sm font-medium"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Benchmark Analytics ───────────────────────────────────────────────────────
function BenchmarkTab({ stocks }: { stocks: any[] }) {
  const totalStocks = stocks.length;
  if (totalStocks === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500 text-sm">
        No holdings to benchmark.
      </div>
    );
  }

  const avgReturn = stocks.reduce((s, x) => s + (x.return_pct ?? 0), 0) / totalStocks;
  const avgAlpha  = stocks.reduce((s, x) => s + (x.alpha_vs_nifty ?? 0), 0) / totalStocks;
  const winCount  = stocks.filter((x) => (x.return_pct ?? 0) > 0).length;
  const winRate   = (winCount / totalStocks) * 100;

  const benchmarks = [
    { name: "NIFTY 50",    return: avgReturn - avgAlpha, alpha: avgAlpha },
    { name: "Your List",   return: avgReturn,            alpha: 0 },
  ];

  const retColor  = (v: number) => (v >= 0 ? "text-emerald-400" : "text-red-400");
  const fmtPct    = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;

  // Sort by best performers
  const best  = [...stocks].sort((a, b) => (b.return_pct ?? 0) - (a.return_pct ?? 0)).slice(0, 5);
  const worst = [...stocks].sort((a, b) => (a.return_pct ?? 0) - (b.return_pct ?? 0)).slice(0, 5);

  const STAT_CARDS = [
    { label: "Portfolio Return", value: fmtPct(avgReturn), color: retColor(avgReturn) },
    { label: "Alpha vs Nifty50", value: fmtPct(avgAlpha), color: retColor(avgAlpha) },
    { label: "Win Rate", value: `${winRate.toFixed(1)}%`, color: winRate >= 50 ? "text-emerald-400" : "text-red-400" },
    { label: "Total Holdings", value: String(totalStocks), color: "text-blue-400" },
  ];

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {STAT_CARDS.map(({ label, value, color }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-gray-500 text-xs mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Benchmark comparison bars */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">Performance vs Benchmarks</h3>
        {benchmarks.map((b) => {
          const barW = Math.min(Math.abs(b.return), 50) * 2;
          return (
            <div key={b.name} className="flex items-center gap-4 mb-4">
              <div className="w-28 text-xs text-gray-400 text-right">{b.name}</div>
              <div className="flex-1 h-8 bg-gray-800 rounded-lg overflow-hidden relative">
                <div
                  className={`h-full rounded-lg transition-all duration-700 ${b.return >= 0 ? "bg-emerald-500/40" : "bg-red-500/40"}`}
                  style={{ width: `${barW}%` }}
                />
                <span className={`absolute inset-0 flex items-center px-3 text-xs font-semibold ${retColor(b.return)}`}>
                  {fmtPct(b.return)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Best/Worst performers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <ArrowTrendingUpIcon className="w-4 h-4 text-emerald-400" />
            Best Performers
          </h3>
          {best.map((s) => (
            <div key={s.symbol} className="flex justify-between items-center py-2 border-b border-gray-800/50 last:border-0">
              <span className="text-sm font-bold text-blue-400">{s.symbol}</span>
              <span className="text-sm font-semibold text-emerald-400">{fmtPct(s.return_pct ?? 0)}</span>
            </div>
          ))}
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <ChartBarIcon className="w-4 h-4 text-red-400" />
            Worst Performers
          </h3>
          {worst.map((s) => (
            <div key={s.symbol} className="flex justify-between items-center py-2 border-b border-gray-800/50 last:border-0">
              <span className="text-sm font-bold text-blue-400">{s.symbol}</span>
              <span className="text-sm font-semibold text-red-400">{fmtPct(s.return_pct ?? 0)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Heatmap */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">Performance Heatmap</h3>
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
          {stocks.map((s) => {
            const ret = s.return_pct ?? 0;
            const intensity = Math.min(Math.abs(ret) / 20, 1);
            const bg = ret >= 0
              ? `rgba(52,211,153,${0.15 + intensity * 0.6})`
              : `rgba(239,68,68,${0.15 + intensity * 0.6})`;
            return (
              <div
                key={s.symbol}
                title={`${s.symbol}: ${ret >= 0 ? "+" : ""}${ret.toFixed(2)}%`}
                className="rounded-lg p-2 text-center cursor-default transition-transform hover:scale-110"
                style={{ background: bg }}
              >
                <div className="text-[10px] font-bold text-white truncate">{s.symbol}</div>
                <div className={`text-[10px] font-semibold mt-0.5 ${ret >= 0 ? "text-emerald-200" : "text-red-200"}`}>
                  {ret >= 0 ? "+" : ""}{ret.toFixed(1)}%
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500/60" />Positive return</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-500/60" />Negative return</span>
          <span className="ml-auto">Hover cell for details</span>
        </div>
      </div>
    </div>
  );
}

// ── Scanner Distribution Pie (SVG) ────────────────────────────────────────────
function ScannerDistribution({ stocks }: { stocks: any[] }) {
  const counts: Record<string, number> = {};
  stocks.forEach((s) => {
    const src = s.source_module || "Unknown";
    counts[src] = (counts[src] || 0) + 1;
  });
  const total   = stocks.length;
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const colors  = ["#6366f1", "#22d3ee", "#f59e0b", "#a78bfa", "#34d399", "#f87171"];

  if (total === 0) return null;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-300 mb-4">Scanner Distribution</h3>
      <div className="flex flex-wrap gap-3">
        {entries.map(([src, count], i) => {
          const pct = (count / total) * 100;
          return (
            <div key={src} className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: colors[i % colors.length] }} />
              <span className="text-xs text-gray-300">{src}</span>
              <span className="text-xs font-bold text-white">{count}</span>
              <span className="text-xs text-gray-500">({pct.toFixed(0)}%)</span>
            </div>
          );
        })}
      </div>
      {/* Bar chart */}
      <div className="mt-4 space-y-2">
        {entries.map(([src, count], i) => {
          const pct = (count / total) * 100;
          return (
            <div key={src} className="flex items-center gap-3">
              <div className="w-28 text-xs text-gray-500 text-right truncate">{src}</div>
              <div className="flex-1 h-5 bg-gray-800 rounded overflow-hidden">
                <div
                  className="h-full rounded transition-all duration-700"
                  style={{ width: `${pct}%`, background: colors[i % colors.length] }}
                />
              </div>
              <span className="text-xs text-gray-400 w-8 text-right">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Portfolio Curve (mini equity curve) ───────────────────────────────────────
function PortfolioCurve({ stocks }: { stocks: any[] }) {
  if (!stocks.length) return null;

  // Build cumulative return series using comparison_returns if available
  const windows = ["1D", "5D", "10D", "30D", "90D"];
  const labels  = ["1D", "5D", "10D", "30D", "90D", "Now"];

  const avgByWindow = windows.map((w) => {
    const vals = stocks
      .map((s) => s.comparison_returns?.[w])
      .filter((v) => v != null) as number[];
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  });

  const avgNow = stocks.reduce((s, x) => s + (x.return_pct ?? 0), 0) / stocks.length;
  const points  = [...avgByWindow, avgNow];
  const valid   = points.filter((v) => v != null) as number[];

  if (valid.length < 2) return null;

  const minV = Math.min(...valid);
  const maxV = Math.max(...valid);
  const range = maxV - minV || 1;

  const W = 500, H = 100;
  const pad = 20;
  const stepX = (W - pad * 2) / (points.length - 1);

  const toY = (v: number | null) =>
    v != null ? H - pad - ((v - minV) / range) * (H - pad * 2) : null;

  const pathPts = points
    .map((v, i) => {
      const y = toY(v);
      if (y == null) return null;
      return `${pad + i * stepX},${y}`;
    })
    .filter(Boolean);

  const pathD = `M ${pathPts.join(" L ")}`;
  const fillD = `${pathD} L ${pad + (points.length - 1) * stepX},${H} L ${pad},${H} Z`;
  const isUp  = (avgNow ?? 0) >= 0;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-semibold text-gray-300">Portfolio Cumulative Return</h3>
        <span className={`text-sm font-bold ${isUp ? "text-emerald-400" : "text-red-400"}`}>
          {avgNow >= 0 ? "+" : ""}{avgNow.toFixed(2)}%
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-24">
        <defs>
          <linearGradient id="pf-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={isUp ? "#34d399" : "#f87171"} stopOpacity="0.3" />
            <stop offset="100%" stopColor={isUp ? "#34d399" : "#f87171"} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={fillD} fill="url(#pf-fill)" />
        <path d={pathD} stroke={isUp ? "#34d399" : "#f87171"} strokeWidth="2" fill="none" strokeLinecap="round" />
        {/* Zero line */}
        {minV < 0 && maxV > 0 && (
          <line
            x1={pad} y1={toY(0) ?? 0}
            x2={W - pad} y2={toY(0) ?? 0}
            stroke="#4b5563" strokeDasharray="4,4" strokeWidth="1"
          />
        )}
        {/* Labels */}
        {points.map((v, i) =>
          v != null ? (
            <text key={i} x={pad + i * stepX} y={H - 2} textAnchor="middle"
              fontSize="9" fill="#6b7280">{labels[i]}</text>
          ) : null
        )}
      </svg>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function WatchlistsPage() {
  const [watchlists, setWatchlists]       = useState<Watchlist[]>([]);
  const [selectedId, setSelectedId]       = useState<string | null>(null);
  const [details, setDetails]             = useState<WatchlistDetails | null>(null);
  const [loadingList, setLoadingList]     = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [activeTab, setActiveTab]         = useState<Tab>("Holdings");
  const [deleteTarget, setDeleteTarget]   = useState<{ id: string; name: string } | null>(null);
  const [newName, setNewName]             = useState("");
  const [creating, setCreating]           = useState(false);

  const loadWatchlists = useCallback(async () => {
    try {
      setLoadingList(true);
      const data = await watchlistService.getWatchlists();
      setWatchlists(data);
      if (data.length > 0 && !selectedId) setSelectedId(data[0].id);
    } catch (err: any) {
      setError(err.message || "Failed to load watchlists");
    } finally {
      setLoadingList(false);
    }
  }, [selectedId]);

  const loadDetails = useCallback(async (id: string) => {
    try {
      setLoadingDetails(true);
      const data = await watchlistService.getWatchlistDetails(id);
      setDetails(data);
    } catch (err: any) {
      setError(err.message || "Failed to load watchlist details");
    } finally {
      setLoadingDetails(false);
    }
  }, []);

  useEffect(() => { loadWatchlists(); }, []);
  useEffect(() => { if (selectedId) loadDetails(selectedId); else setDetails(null); }, [selectedId]);

  const handleRemoveStock = async (symbol: string) => {
    if (!selectedId) return;
    await watchlistService.removeStock(selectedId, symbol);
    loadDetails(selectedId);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await watchlistService.deleteWatchlist(deleteTarget.id);
      if (selectedId === deleteTarget.id) setSelectedId(null);
      setDeleteTarget(null);
      loadWatchlists();
    } catch (err: any) {
      setError(err.message || "Failed to delete watchlist");
    }
  };

  const handleRename = async (id: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = prompt("Rename watchlist:", currentName);
    if (!next || next === currentName) return;
    await watchlistService.renameWatchlist(id, next);
    loadWatchlists();
    if (selectedId === id) loadDetails(id);
  };

  const handleDuplicate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await watchlistService.duplicateWatchlist(id);
    loadWatchlists();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const wl = await watchlistService.createWatchlist(newName.trim());
      setNewName("");
      await loadWatchlists();
      setSelectedId(wl.id);
    } catch (err: any) {
      setError(err.message || "Failed to create watchlist");
    } finally {
      setCreating(false);
    }
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: "Holdings",   label: "Holdings" },
    { key: "Comparison", label: "Comparison Engine" },
    { key: "Source",     label: "Source Analytics" },
    { key: "Benchmark",  label: "Benchmark" },
  ];

  const stocks = details?.stocks ?? [];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {deleteTarget && (
        <DeleteConfirmModal
          watchlistName={deleteTarget.name}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Smart Watchlists</h1>
          <p className="text-gray-500 text-sm mt-1">
            Track performance of all your screener picks in one place
          </p>
        </div>

        {error && (
          <div className="flex items-center justify-between bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">
            <span>{error}</span>
            <button onClick={() => setError(null)}><XMarkIcon className="w-4 h-4" /></button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* ── Left sidebar ──────────────────────────────────────────── */}
          <div className="lg:col-span-1 space-y-4">
            {/* Create form */}
            <form onSubmit={handleCreate} className="flex gap-2">
              <input
                type="text"
                placeholder="New watchlist name…"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="flex-1 min-w-0 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={creating || !newName.trim()}
                className="p-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors flex-shrink-0"
              >
                {creating ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <PlusIcon className="w-4 h-4 text-white" />
                )}
              </button>
            </form>

            {/* Watchlist list */}
            {loadingList ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 bg-gray-800/50 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : watchlists.length === 0 ? (
              <div className="text-center py-8 text-gray-600 text-sm border border-dashed border-gray-800 rounded-xl">
                No watchlists yet.<br />
                <span className="text-xs">Add stocks from any scanner.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {watchlists.map((wl) => (
                  <div
                    key={wl.id}
                    onClick={() => setSelectedId(wl.id)}
                    className={`group relative cursor-pointer rounded-xl border p-3 transition-all ${
                      selectedId === wl.id
                        ? "bg-blue-600/10 border-blue-500/40 text-blue-300"
                        : "bg-gray-900/60 border-gray-800 text-gray-400 hover:bg-gray-900 hover:border-gray-700"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-sm text-white truncate">{wl.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{wl.stock_count} stocks</div>
                      </div>
                      {/* Action icons — visible on hover */}
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button
                          onClick={(e) => handleDuplicate(wl.id, e)}
                          className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-white"
                          title="Duplicate"
                        >
                          <DocumentDuplicateIcon className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleRename(wl.id, wl.name, e)}
                          className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-white"
                          title="Rename"
                        >
                          <PencilSquareIcon className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: wl.id, name: wl.name }); }}
                          className="p-1 rounded hover:bg-red-500/20 text-red-500 hover:text-red-400"
                          title="Delete"
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Main content ──────────────────────────────────────────── */}
          <div className="lg:col-span-3 space-y-5">
            {loadingDetails ? (
              <div className="flex flex-col items-center justify-center py-32 gap-3 text-gray-500">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Analysing performance…</span>
              </div>
            ) : details ? (
              <>
                {/* Summary cards */}
                <WatchlistSummaryCards stats={details.stats} />

                {/* Portfolio curve + scanner distribution */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <PortfolioCurve stocks={stocks} />
                  <ScannerDistribution stocks={stocks} />
                </div>

                {/* Tabs */}
                <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1">
                  {TABS.map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setActiveTab(key)}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                        activeTab === key
                          ? "bg-blue-600/20 text-blue-300 border border-blue-500/30"
                          : "text-gray-500 hover:text-gray-300"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                {activeTab === "Holdings" && (
                  <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-800 flex justify-between items-center">
                      <h3 className="font-semibold text-sm text-white">
                        {details.watchlist.name}
                      </h3>
                      <span className="text-xs text-gray-500">{stocks.length} stocks</span>
                    </div>
                    <WatchlistTable stocks={stocks} onRemove={handleRemoveStock} />
                  </div>
                )}

                {activeTab === "Comparison" && (
                  <WatchlistComparison stocks={stocks} />
                )}

                {activeTab === "Source" && (
                  <SourceAnalytics />
                )}

                {activeTab === "Benchmark" && (
                  <BenchmarkTab stocks={stocks} />
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-32 text-gray-600 text-sm border border-dashed border-gray-800 rounded-2xl gap-3">
                <div className="text-4xl">📋</div>
                <span>Select a watchlist to view performance</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
