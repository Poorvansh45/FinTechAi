"use client";

import React, { useState, useEffect } from "react";
import ScannerTable from "./ScannerTable";
import SavedFiltersPanel from "./SavedFiltersPanel";
import { useScreenerExport } from "@/hooks/useScreenerUtils";
import { Download } from "lucide-react";
import { env } from "@/config/env";

const CATEGORIES = ["All", "Strong Momentum", "Emerging Momentum", "Breakout Candidate", "Watch"];

const FASTAPI_URL = env.fastapiUrl;

async function fetchMomentum(params: Record<string, any>) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== "" && v !== null && v !== undefined) q.set(k, String(v));
  });
  const res = await fetch(`${FASTAPI_URL}/api/scanner/momentum?${q.toString()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

type Filters = {
  score_min: string; rsi_min: string; rsi_max: string;
  ema50_dist_min: string; ema200_dist_min: string;
  price_min: string; price_max: string; volume_ratio_min: string;
  week52_dist_max: string; above_ema50: boolean; above_ema200: boolean;
};

const DEFAULT: Filters = {
  score_min: "", rsi_min: "", rsi_max: "", ema50_dist_min: "",
  ema200_dist_min: "", price_min: "", price_max: "", volume_ratio_min: "",
  week52_dist_max: "", above_ema50: false, above_ema200: false,
};

export default function MomentumScanner() {
  const [stocks, setStocks]     = useState<any[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [category, setCategory] = useState("All");
  const [filters, setFilters]   = useState<Filters>(DEFAULT);
  const { exportCSV }           = useScreenerExport();

  const run = async () => {
    setLoading(true); setError(null);
    try {
      const params: Record<string, any> = {};
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== "" && v !== false && v !== null) params[k] = v;
      });
      if (category !== "All") params.category = category;
      const json = await fetchMomentum(params);
      if (json.success) setStocks(json.data || []);
      else setError(json.error || "Failed");
    } catch (e: any) { setError(e.message || "Network error"); }
    finally { setLoading(false); }
  };

  useEffect(() => { run(); }, []);

  const set  = (k: string, v: any) => setFilters((p) => ({ ...p, [k]: v }));
  const iCls = "w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-blue-500 placeholder-gray-600";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Momentum Scanner</h2>
          <p className="text-xs text-gray-500 mt-0.5">Composite score — RSI, EMA alignment, volume, 52W proximity, relative strength vs Nifty50</p>
        </div>
        <div className="flex items-center gap-2">
          {stocks.length > 0 && (
            <button
              onClick={() => exportCSV(stocks, "momentum_scan")}
              className="flex items-center gap-1.5 text-xs border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 px-3 py-1.5 rounded-lg transition-all"
            >
              <Download size={11} /> Export CSV
            </button>
          )}
          <SavedFiltersPanel
            scanner="momentum"
            currentFilters={filters}
            onLoad={(f) => { setFilters({ ...DEFAULT, ...f }); }}
          />
          <button onClick={run} disabled={loading}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50">
            {loading ? "Scanning…" : "Run Scan"}
          </button>
        </div>
      </div>

      {/* Signal strength legend */}
      <div className="flex gap-4 flex-wrap text-xs text-gray-500">
        {[
          { label: "Strong Momentum", color: "bg-emerald-400", range: "Score ≥80" },
          { label: "Emerging Momentum", color: "bg-blue-400", range: "65–79" },
          { label: "Breakout Candidate", color: "bg-yellow-400", range: "50–64" },
          { label: "Watch", color: "bg-gray-500", range: "<50" },
        ].map(({ label, color, range }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${color}`} />
            {label} <span className="text-gray-600">({range})</span>
          </span>
        ))}
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => setCategory(c)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              category === c ? "bg-blue-600/20 text-blue-300 border-blue-500/40" : "bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500"
            }`}>{c}</button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {[
            { k: "score_min",        lbl: "Min Score",          ph: "0–100" },
            { k: "rsi_min",          lbl: "RSI Min",            ph: "e.g. 50" },
            { k: "ema50_dist_min",   lbl: "EMA50 Dist % Min",   ph: "+2 = 2% above" },
            { k: "ema200_dist_min",  lbl: "EMA200 Dist % Min",  ph: "+5 = 5% above" },
            { k: "week52_dist_max",  lbl: "52W High Dist % Max", ph: "-5 = within 5%" },
            { k: "volume_ratio_min", lbl: "Vol Ratio Min",      ph: "e.g. 1.5" },
            { k: "price_min",        lbl: "Price Min (₹)",      ph: "e.g. 300" },
            { k: "price_max",        lbl: "Price Max (₹)",      ph: "e.g. 5000" },
          ].map(({ k, lbl, ph }) => (
            <div key={k} className="space-y-1">
              <label className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">{lbl}</label>
              <input type="number" placeholder={ph} value={(filters as any)[k]}
                onChange={(e) => set(k, e.target.value)} className={iCls} />
            </div>
          ))}
          <div className="space-y-2 col-span-2">
            <label className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">Quick Filters</label>
            <div className="flex flex-wrap gap-2">
              {[{ key: "above_ema50", label: "Price > EMA50" }, { key: "above_ema200", label: "Price > EMA200" }].map(({ key, label }) => (
                <button key={key} onClick={() => set(key, !(filters as any)[key])}
                  className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                    (filters as any)[key] ? "bg-emerald-600/20 text-emerald-300 border-emerald-500/40" : "bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500"
                  }`}>{label}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-between items-center mt-4">
          <button onClick={() => { setFilters(DEFAULT); setCategory("All"); }}
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
          <span className="text-sm text-gray-400">{loading ? "Loading…" : `${stocks.length} stocks`}</span>
        </div>
        {error ? (
          <div className="text-red-400 p-4 bg-red-400/10 rounded-lg text-sm">{error}</div>
        ) : (
          <ScannerTable data={stocks} isLoading={loading} sourceModule="Momentum Scanner" mode="momentum" />
        )}
      </div>
    </div>
  );
}
