"use client";

import React, { useState, useEffect } from "react";
import ScannerTable from "./ScannerTable";
import SavedFiltersPanel from "./SavedFiltersPanel";
import { useScreenerExport } from "@/hooks/useScreenerUtils";
import { Download } from "lucide-react";

const FASTAPI_URL =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_FASTAPI_URL || "http://localhost:8000")
    : "http://localhost:8000";

const STATUS_OPTIONS   = ["All", "Untouched", "Touched", "PartiallyFilled", "MostlyFilled"];
const STRENGTH_OPTIONS = ["All", "Strong", "Medium", "Weak"];

async function fetchFVG(params: Record<string, any>) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== "" && v !== null && v !== undefined && v !== "All") q.set(k, String(v));
  });
  const res = await fetch(`${FASTAPI_URL}/api/scanner/fvg?${q.toString()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

type Filters = { rsi_min: string; rsi_max: string; score_min: string; price_min: string; price_max: string; min_fvg_count: string; };
const DEFAULT: Filters = { rsi_min: "", rsi_max: "", score_min: "", price_min: "", price_max: "", min_fvg_count: "" };

export default function FVGScanner() {
  const [stocks, setStocks]     = useState<any[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [status, setStatus]     = useState("All");
  const [strength, setStrength] = useState("All");
  const [filters, setFilters]   = useState<Filters>(DEFAULT);
  const { exportCSV }           = useScreenerExport();

  const run = async () => {
    setLoading(true); setError(null);
    try {
      const params: Record<string, any> = { has_fvg_only: true };
      Object.entries(filters).forEach(([k, v]) => { if (v !== "") params[k] = v; });
      if (status   !== "All") params.fvg_status   = status;
      if (strength !== "All") params.fvg_strength = strength;
      const json = await fetchFVG(params);
      if (json.success) setStocks(json.data || []);
      else setError(json.error || "Failed");
    } catch (e: any) { setError(e.message || "Network error"); }
    finally { setLoading(false); }
  };

  useEffect(() => { run(); }, []);

  const set    = (k: string, v: string) => setFilters((p) => ({ ...p, [k]: v }));
  const tabCls = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${active ? "bg-blue-600/20 text-blue-300 border-blue-500/40" : "bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500"}`;
  const iCls = "w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-blue-500 placeholder-gray-600";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">FVG Scanner</h2>
          <p className="text-xs text-gray-500 mt-0.5">ICT-style Fair Value Gaps · scoring, mitigation tracking, strength classification · expand rows for per-FVG detail</p>
        </div>
        <div className="flex items-center gap-2">
          {stocks.length > 0 && (
            <button onClick={() => exportCSV(stocks, "fvg_scan")}
              className="flex items-center gap-1.5 text-xs border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 px-3 py-1.5 rounded-lg transition-all">
              <Download size={11} /> Export CSV
            </button>
          )}
          <SavedFiltersPanel
            scanner="fvg"
            currentFilters={{ ...filters, status, strength }}
            onLoad={(f) => { setFilters({ ...DEFAULT, ...f }); setStatus(f.status ?? "All"); setStrength(f.strength ?? "All"); }}
          />
          <button onClick={run} disabled={loading}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50">
            {loading ? "Scanning…" : "Run Scan"}
          </button>
        </div>
      </div>

      {/* Signal strength legend */}
      <div className="flex gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" />Strong (Score ≥70)</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-400" />Medium (45–69)</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400" />Weak (&lt;45)</span>
        <span className="ml-auto text-gray-600">Click ▶ to expand per-FVG detail</span>
      </div>

      {/* Status tabs */}
      <div className="space-y-2">
        <p className="text-[11px] text-gray-500 uppercase tracking-wide font-medium">FVG Status</p>
        <div className="flex gap-2 flex-wrap">{STATUS_OPTIONS.map((s) => <button key={s} onClick={() => setStatus(s)} className={tabCls(status === s)}>{s}</button>)}</div>
      </div>

      {/* Strength tabs */}
      <div className="space-y-2">
        <p className="text-[11px] text-gray-500 uppercase tracking-wide font-medium">FVG Strength</p>
        <div className="flex gap-2 flex-wrap">{STRENGTH_OPTIONS.map((s) => <button key={s} onClick={() => setStrength(s)} className={tabCls(strength === s)}>{s}</button>)}</div>
      </div>

      {/* Filters */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { k: "rsi_min",       lbl: "RSI Min",       ph: "e.g. 40" },
            { k: "rsi_max",       lbl: "RSI Max",       ph: "e.g. 70" },
            { k: "score_min",     lbl: "Min FVG Score", ph: "0–100"   },
            { k: "min_fvg_count", lbl: "Min FVG Count", ph: "e.g. 2"  },
            { k: "price_min",     lbl: "Price Min (₹)", ph: "e.g. 300" },
            { k: "price_max",     lbl: "Price Max (₹)", ph: "e.g. 5000" },
          ].map(({ k, lbl, ph }) => (
            <div key={k} className="space-y-1">
              <label className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">{lbl}</label>
              <input type="number" placeholder={ph} value={(filters as any)[k]} onChange={(e) => set(k, e.target.value)} className={iCls} />
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center mt-4">
          <button onClick={() => { setFilters(DEFAULT); setStatus("All"); setStrength("All"); }}
            className="text-xs text-gray-500 hover:text-white transition-colors">Clear All</button>
          <button onClick={run} disabled={loading}
            className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50">
            {loading ? "Scanning…" : "Apply Filters"}
          </button>
        </div>
      </div>

      {/* Results */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-gray-400">{loading ? "Loading…" : `${stocks.length} stocks with bullish FVGs`}</span>
        </div>
        {error ? (
          <div className="text-red-400 p-4 bg-red-400/10 rounded-lg text-sm">{error}</div>
        ) : (
          <ScannerTable data={stocks} isLoading={loading} sourceModule="FVG Scanner" mode="fvg" />
        )}
      </div>
    </div>
  );
}
