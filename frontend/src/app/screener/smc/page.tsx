"use client";

import React, { useState, useEffect, useContext } from "react";
import ScannerTable from "@/components/screener/ScannerTable";
import AddToWatchlistModal from "@/components/watchlists/AddToWatchlistModal";
import { ScannerContext } from "../context";
import { env } from "@/config/env";
import { authHeader } from "@/lib/api/authToken";

const formatISTDate = (isoString: string) => {
  try {
    const date = new Date(isoString);
    const options = { timeZone: "Asia/Kolkata", day: "2-digit" as const, month: "short" as const, year: "numeric" as const, hour: "2-digit" as const, minute: "2-digit" as const, hour12: false };
    const formatter = new Intl.DateTimeFormat("en-IN", options);
    const parts = formatter.formatToParts(date);
    const partMap = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return `${partMap.day} ${partMap.month} ${partMap.year} ${partMap.hour}:${partMap.minute} IST`;
  } catch {
    return "—";
  }
};


const FASTAPI_URL = env.fastapiUrl;

const CATEGORIES = [
  "All", "Inside Zone", "Near Zone (2%)", "Near Zone (5%)",
  "Fresh Zones", "BOS Zones", "CHoCH Zones",
  "Discount", "Premium", "Unmitigated",
];

async function fetchSMC(params: Record<string, any>) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== "" && v !== null && v !== undefined && v !== "All") q.set(k, String(v));
  });
  // FastAPI denies by default now — these reads used to be public and are not.
  const res = await fetch(`${FASTAPI_URL}/api/v2/scanner/smc?${q.toString()}`, {
    headers: await authHeader(),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchStats() {
  const res = await fetch(`${FASTAPI_URL}/api/v2/scanner/smc/stats`, {
    headers: await authHeader(),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchZoneProximity(distMax: number) {
  const res = await fetch(
    `${FASTAPI_URL}/api/v2/scanner/smc/zone-proximity?distance_pct_max=${distMax}&limit=200`,
    { headers: await authHeader() },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Zone Proximity Tab ────────────────────────────────────────────────────────
function ZoneProximityTab() {
  const [data, setData]         = useState<{ old: any[]; new: any[]; removed: any[] }>({ old: [], new: [], removed: [] });
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [distMax, setDistMax]   = useState(10);
  const [activeSheet, setActiveSheet] = useState<"old" | "new" | "removed">("new");
  const [modal, setModal]       = useState<{ open: boolean; symbol: string; name: string; ltp: number } | null>(null);

  const run = async () => {
    setLoading(true); setError(null);
    try {
      const json = await fetchZoneProximity(distMax);
      if (json.success) setData({ old: json.old || [], new: json.new || [], removed: json.removed || [] });
      else setError(json.error || "Failed");
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { run(); }, []);

  const fmtPct = (v?: number | null) => v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
  const retColor = (v?: number | null) =>
    v == null ? "text-gray-500" : v > 0 ? "text-emerald-400" : v < 0 ? "text-red-400" : "text-gray-400";

  const SHEETS = [
    { key: "new"     as const, label: "🆕 New",   color: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300", count: data.new.length },
    { key: "old"     as const, label: "📘 Active", color: "bg-blue-500/10 border-blue-500/30 text-blue-300",     count: data.old.length },
    { key: "removed" as const, label: "❌ Removed", color: "bg-red-500/10 border-red-500/30 text-red-300",       count: data.removed.length },
  ];

  const rows = data[activeSheet];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-base font-semibold text-white">Zone Proximity Scanner</h3>
          <p className="text-xs text-gray-500 mt-0.5">Stocks within ±{distMax}% of their active SMC demand zone</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>Distance ≤</span>
            <input
              type="number" value={distMax}
              onChange={(e) => setDistMax(Number(e.target.value))}
              className="w-16 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-white text-xs"
            />
            <span>%</span>
          </div>
          <button onClick={run} disabled={loading}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50">
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Sheet tabs */}
      <div className="flex gap-2">
        {SHEETS.map(({ key, label, color, count }) => (
          <button key={key} onClick={() => setActiveSheet(key)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-all ${activeSheet === key ? color : "bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500"}`}>
            {label} <span className="ml-1 opacity-70">({count})</span>
          </button>
        ))}
      </div>

      {error ? (
        <div className="text-red-400 p-4 bg-red-400/10 rounded-lg text-sm">{error}</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          {loading && rows.length === 0 ? (
            <div className="space-y-3 px-5 py-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-12 rounded-xl bg-gray-800/40 border border-gray-800/30 animate-pulse flex items-center justify-between px-4" style={{ opacity: 1 - i * 0.12 }}>
                  <div className="w-8 h-4 bg-gray-700/50 rounded" />
                  <div className="w-24 h-4 bg-gray-700/50 rounded" />
                  <div className="w-40 h-4 bg-gray-700/50 rounded" />
                  <div className="w-16 h-4 bg-gray-700/50 rounded" />
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (

            <div className="py-16 text-center text-gray-600 text-sm">
              No stocks in this category.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-800/40 border-b border-gray-800 text-xs text-gray-400 uppercase">
                  <th className="px-4 py-3 text-left">#</th>
                  <th className="px-4 py-3 text-left">Symbol</th>
                  <th className="px-4 py-3 text-right">LTP (₹)</th>
                  <th className="px-4 py-3 text-right">Dist to Zone</th>
                  <th className="px-4 py-3 text-right">Zone Low</th>
                  <th className="px-4 py-3 text-right">Zone High</th>
                  <th className="px-4 py-3 text-left">Event</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s: any, i: number) => (
                  <tr key={s.symbol || i} className="border-b border-gray-800/50 hover:bg-gray-800/25 transition-colors">
                    <td className="px-4 py-3 text-gray-600 text-xs">{i + 1}</td>
                    <td className="px-4 py-3 font-bold text-blue-400">{s.symbol}</td>
                    <td className="px-4 py-3 text-right font-mono text-white font-semibold">
                      {s.ltp ? `₹${s.ltp.toFixed(2)}` : "—"}
                    </td>
                    <td className={`px-4 py-3 text-right text-xs font-semibold ${s.distance_pct === 0 ? "text-emerald-400" : "text-yellow-400"}`}>
                      {s.distance_pct === 0 ? "Inside Zone" : `${s.distance_pct?.toFixed(2)}%`}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300 font-mono text-xs">
                      {s.zone_low ? `₹${s.zone_low.toFixed(2)}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300 font-mono text-xs">
                      {s.zone_high ? `₹${s.zone_high.toFixed(2)}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {s.event ? (
                        <span className={`px-2 py-0.5 rounded text-[10px] border font-semibold ${
                          s.event === "BOS"
                            ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                            : "bg-purple-500/20 text-purple-300 border-purple-500/30"
                        }`}>{s.event}</span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setModal({ open: true, symbol: s.symbol, name: s.symbol, ltp: s.ltp || 0 })}
                        className="text-xs bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-600/40 px-3 py-1.5 rounded-lg transition-all"
                      >
                        + Watch
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {modal && (
        <AddToWatchlistModal
          isOpen={modal.open}
          onClose={() => setModal(null)}
          symbol={modal.symbol}
          companyName={modal.name}
          sourceModule="SMC Scanner"
          currentPrice={modal.ltp}
        />
      )}
    </div>
  );
}

// ── Main SMC Page ─────────────────────────────────────────────────────────────
export default function SMCPage() {
  const [stocks, setStocks]     = useState<any[]>([]);
  const [stats, setStats]       = useState<any>({});
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [category, setCategory] = useState("All");
  const [minScore, setMinScore] = useState("");
  const [view, setView]         = useState<"scanner" | "zones">("scanner");

  const { scanMeta, registerData, registerRefresh } = useContext(ScannerContext);

  useEffect(() => {
    registerData(stocks);
  }, [stocks, registerData]);

  useEffect(() => {
    registerRefresh(() => { run(); });
  }, [registerRefresh, category, minScore]);


  const run = async () => {
    setLoading(true); setError(null);
    try {
      const params: Record<string, any> = { limit: 200 };
      if (category !== "All") params.category = category;
      if (minScore !== "")    params.min_score = minScore;
      const [json, statsJson] = await Promise.all([fetchSMC(params), fetchStats().catch(() => ({ success: false, data: {} }))]);
      if (json.success) setStocks(json.data || []);
      else setError(json.error || "Failed");
      if (statsJson.success) setStats(statsJson.data || {});
    } catch (e: any) { setError(e.message || "Network error"); }
    finally { setLoading(false); }
  };

  useEffect(() => { run(); }, []);

  const tabCls = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-medium transition-all border cursor-pointer ${
      active ? "bg-blue-600/20 text-blue-300 border-blue-500/40" : "bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500"
    }`;

  const STAT_CARDS = [
    { label: "Active Zones",     value: stats.total_active_zones, color: "text-white" },
    { label: "Inside Zone",      value: stats.inside_zone,        color: "text-emerald-400" },
    { label: "Within 2%",        value: stats.within_2_pct,       color: "text-blue-400" },
    { label: "Within 5%",        value: stats.within_5_pct,       color: "text-purple-400" },
    { label: "BOS Events",       value: stats.bos_count,          color: "text-yellow-400" },
    { label: "CHoCH Events",     value: stats.choch_count,        color: "text-orange-400" },
    { label: "High Score (≥70)", value: stats.high_score_count,   color: "text-emerald-300" },
    { label: "Avg SMC Score",    value: stats.avg_smc_score,      color: "text-blue-300" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">SMC Scanner</h1>
          <div className="flex items-center gap-4 text-xs text-gray-500 mt-1 flex-wrap">
            <span>Last Updated: <span className="text-gray-300 font-semibold">{scanMeta?.last_ran ? formatISTDate(scanMeta.last_ran) : "—"}</span></span>
            <span className="text-gray-700">•</span>
            <span>Stocks: <span className="text-gray-300 font-semibold">{scanMeta?.record_count ?? scanMeta?.symbols_processed ?? stocks.length}</span></span>
            <span className="text-gray-700">•</span>
            <span>Status: <span className={`font-semibold font-mono uppercase tracking-wider text-[10px] px-1.5 py-0.5 rounded ${
              scanMeta?.status === "RUNNING"
                ? "text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 animate-pulse"
                : scanMeta?.status === "FAILED"
                ? "text-red-400 bg-red-500/10 border border-red-500/20"
                : "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20"
            }`}>{scanMeta?.status || "Ready"}</span></span>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView("scanner")}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${view === "scanner" ? "bg-blue-600/20 text-blue-300 border-blue-500/40" : "bg-gray-800 text-gray-400 border-gray-700"}`}>
            Zone Scores
          </button>
          <button onClick={() => setView("zones")}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${view === "zones" ? "bg-emerald-600/20 text-emerald-300 border-emerald-500/40" : "bg-gray-800 text-gray-400 border-gray-700"}`}>
            Zone Proximity
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {STAT_CARDS.map(({ label, value, color }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
            <div className={`text-xl font-bold ${color}`}>{value ?? "—"}</div>
            <div className="text-gray-500 text-[10px] mt-0.5 leading-tight">{label}</div>
          </div>
        ))}
      </div>

      {view === "zones" ? (
        <ZoneProximityTab />
      ) : (
        <>
          {/* Category tabs */}
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button key={c} onClick={() => setCategory(c)} className={tabCls(category === c)}>{c}</button>
            ))}
          </div>

          {/* Score filter */}
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-500 font-medium uppercase tracking-wide whitespace-nowrap">Min SMC Score</label>
            <input type="number" placeholder="0–100" value={minScore}
              onChange={(e) => setMinScore(e.target.value)}
              className="w-28 bg-gray-800 text-white rounded-lg px-3 py-1.5 text-sm border border-gray-700 focus:outline-none focus:border-blue-500"
            />
            <button onClick={run} disabled={loading}
              className="px-4 py-1.5 rounded-lg bg-blue-600/80 hover:bg-blue-600 text-white text-sm transition-colors disabled:opacity-50">
              Apply
            </button>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded text-[9px] bg-blue-500/20 text-blue-300 border border-blue-500/30">BOS</span>
              Break of Structure
            </span>
            <span className="flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30">CHoCH</span>
              Change of Character
            </span>
            <span className="flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Discount</span>
              Below equilibrium
            </span>
            <span className="flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded text-[9px] bg-red-500/20 text-red-300 border border-red-500/30">Premium</span>
              Above equilibrium
            </span>
          </div>

          {/* Results */}
          {error ? (
            <div className="text-red-400 p-4 bg-red-400/10 rounded-lg text-sm">{error}</div>
          ) : (
            <div>
              <div className="text-sm text-gray-400 mb-3">{loading ? "Loading…" : `${stocks.length} zones found`}</div>
              <ScannerTable data={stocks} isLoading={loading && stocks.length === 0} sourceModule="SMC Scanner" mode="smc" />
            </div>
          )}
        </>
      )}
    </div>
  );
}
