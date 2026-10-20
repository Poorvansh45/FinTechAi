"use client";

import React, { useState, useEffect, useContext, useMemo } from "react";
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
    v == null ? "text-neutral-500" : v > 0 ? "text-positive-400" : v < 0 ? "text-negative-400" : "text-neutral-400";

  const SHEETS = [
    { key: "new"     as const, label: "🆕 New",   color: "bg-positive-500/10 border-positive-500/30 text-positive-300", count: data.new.length },
    { key: "old"     as const, label: "Active", color: "bg-brand-500/10 border-brand-500/30 text-brand-300",     count: data.old.length },
    { key: "removed" as const, label: "Removed", color: "bg-negative-500/10 border-negative-500/30 text-negative-300",       count: data.removed.length },
  ];

  const [sortKey, setSortKey] = useState<string>("distance_pct");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = (key: string) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "symbol" || key === "distance_pct" ? "asc" : "desc"); }
  };

  const SortIcon = ({ col }: { col: string }) => (
    <span className="ml-1 text-neutral-500 text-[11px] select-none inline-block">
      {sortKey === col ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
    </span>
  );

  const sortedRows = useMemo(() => {
    const raw = data[activeSheet] || [];
    return [...raw].sort((a, b) => {
      let av: any = 0, bv: any = 0;
      if (sortKey === "symbol") { av = a.symbol || ""; bv = b.symbol || ""; }
      else if (sortKey === "ltp") { av = a.ltp ?? 0; bv = b.ltp ?? 0; }
      else if (sortKey === "distance_pct") { av = a.distance_pct ?? 0; bv = b.distance_pct ?? 0; }
      else if (sortKey === "zone_low") { av = a.zone_low ?? 0; bv = b.zone_low ?? 0; }
      else if (sortKey === "zone_high") { av = a.zone_high ?? 0; bv = b.zone_high ?? 0; }
      else if (sortKey === "event") { av = a.event || ""; bv = b.event || ""; }
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [data, activeSheet, sortKey, sortDir]);

  const rows = sortedRows;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">Zone Proximity Scanner</h3>
          <p className="text-xs text-neutral-500 mt-0.5">Stocks within ±{distMax}% of their active SMC demand zone</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <span>Distance ≤</span>
            <input
              type="number" value={distMax}
              onChange={(e) => setDistMax(Number(e.target.value))}
              className="w-16 bg-neutral-800 border border-neutral-700 rounded-lg px-2 py-1 text-foreground text-xs"
            />
            <span>%</span>
          </div>
          <button onClick={run} disabled={loading}
            className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium transition-colors disabled:opacity-50">
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Sheet tabs */}
      <div className="flex gap-2">
        {SHEETS.map(({ key, label, color, count }) => (
          <button key={key} onClick={() => setActiveSheet(key)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-all ${activeSheet === key ? color : "bg-neutral-800 text-neutral-400 border-neutral-700 hover:border-neutral-500"}`}>
            {label} <span className="ml-1 opacity-70">({count})</span>
          </button>
        ))}
      </div>

      {error ? (
        <div className="text-negative-400 p-4 bg-negative-400/10 rounded-lg text-sm">{error}</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-800">
          {loading && rows.length === 0 ? (
            <div className="space-y-3 px-5 py-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-12 rounded-xl bg-neutral-800/40 border border-neutral-800/30 animate-pulse flex items-center justify-between px-4" style={{ opacity: 1 - i * 0.12 }}>
                  <div className="w-8 h-4 bg-neutral-700/50 rounded" />
                  <div className="w-24 h-4 bg-neutral-700/50 rounded" />
                  <div className="w-40 h-4 bg-neutral-700/50 rounded" />
                  <div className="w-16 h-4 bg-neutral-700/50 rounded" />
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (

            <div className="py-16 text-center text-neutral-500 text-sm">
              No stocks in this category.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-800/40 border-b border-neutral-800 text-xs text-neutral-400">
                  <th className="px-4 py-3 text-left">#</th>
                  <th onClick={() => handleSort("symbol")} className="px-4 py-3 text-left cursor-pointer hover:text-foreground transition-colors select-none">
                    Symbol <SortIcon col="symbol" />
                  </th>
                  <th onClick={() => handleSort("ltp")} className="px-4 py-3 text-right cursor-pointer hover:text-foreground transition-colors select-none">
                    LTP (₹) <SortIcon col="ltp" />
                  </th>
                  <th onClick={() => handleSort("distance_pct")} className="px-4 py-3 text-right cursor-pointer hover:text-foreground transition-colors select-none">
                    Dist to Zone <SortIcon col="distance_pct" />
                  </th>
                  <th onClick={() => handleSort("zone_low")} className="px-4 py-3 text-right cursor-pointer hover:text-foreground transition-colors select-none">
                    Zone Low <SortIcon col="zone_low" />
                  </th>
                  <th onClick={() => handleSort("zone_high")} className="px-4 py-3 text-right cursor-pointer hover:text-foreground transition-colors select-none">
                    Zone High <SortIcon col="zone_high" />
                  </th>
                  <th onClick={() => handleSort("event")} className="px-4 py-3 text-left cursor-pointer hover:text-foreground transition-colors select-none">
                    Event <SortIcon col="event" />
                  </th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s: any, i: number) => (
                  <tr key={s.symbol || i} className="border-b border-neutral-800/50 hover:bg-neutral-800/25 transition-colors">
                    <td className="px-4 py-3 text-neutral-500 text-xs">{i + 1}</td>
                    <td className="px-4 py-3 font-bold text-brand-400">{s.symbol}</td>
                    <td className="px-4 py-3 text-right font-mono text-foreground font-semibold">
                      {s.ltp ? `₹${s.ltp.toFixed(2)}` : "—"}
                    </td>
                    <td className={`px-4 py-3 text-right text-xs font-semibold ${s.distance_pct === 0 ? "text-positive-400" : "text-warning-400"}`}>
                      {s.distance_pct === 0 ? "Inside Zone" : `${s.distance_pct?.toFixed(2)}%`}
                    </td>
                    <td className="px-4 py-3 text-right text-neutral-300 font-mono text-xs">
                      {s.zone_low ? `₹${s.zone_low.toFixed(2)}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-neutral-300 font-mono text-xs">
                      {s.zone_high ? `₹${s.zone_high.toFixed(2)}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {s.event ? (
                        <span className={`px-2 py-0.5 rounded text-[11px] border font-semibold ${
                          s.event === "BOS"
                            ? "bg-brand-500/20 text-brand-300 border-brand-500/30"
                            : "bg-brand-500/20 text-brand-300 border-brand-500/30"
                        }`}>{s.event}</span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setModal({ open: true, symbol: s.symbol, name: s.symbol, ltp: s.ltp || 0 })}
                        className="text-xs bg-brand-600/20 text-brand-400 border border-brand-500/30 hover:bg-brand-600/40 px-3 py-1.5 rounded-lg transition-all"
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
      active ? "bg-brand-600/20 text-brand-300 border-brand-500/40" : "bg-neutral-800 text-neutral-400 border-neutral-700 hover:border-neutral-500"
    }`;

  const STAT_CARDS = [
    { label: "Active Zones",     value: stats.total_active_zones, color: "text-foreground" },
    { label: "Inside Zone",      value: stats.inside_zone,        color: "text-positive-400" },
    { label: "Within 2%",        value: stats.within_2_pct,       color: "text-brand-400" },
    { label: "Within 5%",        value: stats.within_5_pct,       color: "text-brand-400" },
    { label: "BOS Events",       value: stats.bos_count,          color: "text-warning-400" },
    { label: "CHoCH Events",     value: stats.choch_count,        color: "text-warning-400" },
    { label: "High Score (≥70)", value: stats.high_score_count,   color: "text-positive-300" },
    { label: "Avg SMC Score",    value: stats.avg_smc_score,      color: "text-brand-300" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">SMC Scanner</h1>
          <div className="flex items-center gap-4 text-xs text-neutral-500 mt-1 flex-wrap">
            <span>Last Updated: <span className="text-neutral-300 font-semibold">{scanMeta?.last_ran ? formatISTDate(scanMeta.last_ran) : "—"}</span></span>
            <span className="text-neutral-500">•</span>
            <span>Stocks: <span className="text-neutral-300 font-semibold">{scanMeta?.record_count ?? scanMeta?.symbols_processed ?? stocks.length}</span></span>
            <span className="text-neutral-500">•</span>
            <span>Status: <span className={`font-semibold font-mono text-[11px] px-1.5 py-0.5 rounded ${
              scanMeta?.status === "RUNNING"
                ? "text-warning-400 bg-warning-500/10 border border-warning-500/20 animate-pulse"
                : scanMeta?.status === "FAILED"
                ? "text-negative-400 bg-negative-500/10 border border-negative-500/20"
                : "text-positive-400 bg-positive-500/10 border border-positive-500/20"
            }`}>{scanMeta?.status || "Ready"}</span></span>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView("scanner")}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${view === "scanner" ? "bg-brand-600/20 text-brand-300 border-brand-500/40" : "bg-neutral-800 text-neutral-400 border-neutral-700"}`}>
            Zone Scores
          </button>
          <button onClick={() => setView("zones")}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${view === "zones" ? "bg-positive-600/20 text-positive-300 border-positive-500/40" : "bg-neutral-800 text-neutral-400 border-neutral-700"}`}>
            Zone Proximity
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {STAT_CARDS.map(({ label, value, color }) => (
          <div key={label} className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-center">
            <div className={`text-xl font-bold ${color}`}>{value ?? "—"}</div>
            <div className="text-neutral-500 text-[11px] mt-0.5 leading-tight">{label}</div>
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
            <label className="text-xs text-neutral-500 font-medium whitespace-nowrap">Min SMC Score</label>
            <input type="number" placeholder="0–100" value={minScore}
              onChange={(e) => setMinScore(e.target.value)}
              className="w-28 bg-neutral-800 text-foreground rounded-lg px-3 py-1.5 text-sm border border-neutral-700 focus:outline-none focus:border-brand-500"
            />
            <button onClick={run} disabled={loading}
              className="px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm transition-colors disabled:opacity-50">
              Apply
            </button>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 text-xs text-neutral-500">
            <span className="flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded text-[11px] bg-brand-500/20 text-brand-300 border border-brand-500/30">BOS</span>
              Break of Structure
            </span>
            <span className="flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded text-[11px] bg-brand-500/20 text-brand-300 border border-brand-500/30">CHoCH</span>
              Change of Character
            </span>
            <span className="flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded text-[11px] bg-positive-500/20 text-positive-300 border border-positive-500/30">Discount</span>
              Below equilibrium
            </span>
            <span className="flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded text-[11px] bg-negative-500/20 text-negative-300 border border-negative-500/30">Premium</span>
              Above equilibrium
            </span>
          </div>

          {/* Results */}
          {error ? (
            <div className="text-negative-400 p-4 bg-negative-400/10 rounded-lg text-sm">{error}</div>
          ) : (
            <div>
              <div className="text-sm text-neutral-400 mb-3">{loading ? "Loading…" : `${stocks.length} zones found`}</div>
              <ScannerTable data={stocks} isLoading={loading && stocks.length === 0} sourceModule="SMC Scanner" mode="smc" />
            </div>
          )}
        </>
      )}
    </div>
  );
}
