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

async function fetchSurge(params: Record<string, any>) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== "" && v !== null && v !== undefined && v !== false) q.set(k, String(v));
  });
  const res = await fetch(`${FASTAPI_URL}/api/scanner/volume-surge?${q.toString()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

type Filters = {
  volume_ratio_min: string; price_min: string; price_max: string;
  avg_1d_min: string; win_rate_min: string; surges_min: string; max_gain_min: string;
};

const DEFAULT: Filters = {
  volume_ratio_min: "2.5", price_min: "300", price_max: "10000",
  avg_1d_min: "", win_rate_min: "", surges_min: "", max_gain_min: "",
};

export default function VolumeScanner() {
  const [stocks, setStocks]         = useState<any[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [currentOnly, setCurrentOnly] = useState(false);
  const [filters, setFilters]       = useState<Filters>(DEFAULT);
  const { exportCSV }               = useScreenerExport();

  const run = async () => {
    setLoading(true); setError(null);
    try {
      const params: Record<string, any> = {};
      Object.entries(filters).forEach(([k, v]) => { if (v !== "") params[k] = v; });
      if (currentOnly) params.current_surge_only = true;
      const json = await fetchSurge(params);
      if (json.success) setStocks(json.data || []);
      else setError(json.error || "Failed");
    } catch (e: any) { setError(e.message || "Network error"); }
    finally { setLoading(false); }
  };

  useEffect(() => { run(); }, []);

  const set  = (k: string, v: string) => setFilters((p) => ({ ...p, [k]: v }));
  const iCls = "w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-blue-500 placeholder-gray-600";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Volume Surge Scanner</h2>
          <p className="text-xs text-gray-500 mt-0.5">Per-surge historical analysis — expand any row to see every surge with 1D–20D forward returns</p>
        </div>
        <div className="flex items-center gap-2">
          {stocks.length > 0 && (
            <button onClick={() => exportCSV(stocks, "volume_surge_scan")}
              className="flex items-center gap-1.5 text-xs border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 px-3 py-1.5 rounded-lg transition-all">
              <Download size={11} /> Export CSV
            </button>
          )}
          <SavedFiltersPanel
            scanner="volume"
            currentFilters={{ ...filters, current_surge_only: currentOnly }}
            onLoad={(f) => { setFilters({ ...DEFAULT, ...f }); setCurrentOnly(!!f.current_surge_only); }}
          />
          <button onClick={run} disabled={loading}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50">
            {loading ? "Scanning…" : "Run Scan"}
          </button>
        </div>
      </div>

      {/* Today only toggle */}
      <button
        onClick={() => setCurrentOnly(!currentOnly)}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
          currentOnly
            ? "bg-orange-600/20 text-orange-300 border-orange-500/40"
            : "bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500"
        }`}
      >
        🔥 Today's Surges Only
      </button>

      {/* Filters */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { k: "volume_ratio_min", lbl: "Min Vol Ratio",       ph: "e.g. 2.5"  },
            { k: "price_min",        lbl: "Price Min (₹)",       ph: "300"        },
            { k: "price_max",        lbl: "Price Max (₹)",       ph: "10000"      },
            { k: "avg_1d_min",       lbl: "Avg 1D Return % Min", ph: "e.g. 1"     },
            { k: "win_rate_min",     lbl: "Win Rate 1D % Min",   ph: "e.g. 60"    },
            { k: "surges_min",       lbl: "Min Hist. Surges",    ph: "e.g. 3"     },
            { k: "max_gain_min",     lbl: "Max Gain Ever % Min", ph: "e.g. 10"    },
          ].map(({ k, lbl, ph }) => (
            <div key={k} className="space-y-1">
              <label className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">{lbl}</label>
              <input type="number" placeholder={ph} value={(filters as any)[k]}
                onChange={(e) => set(k, e.target.value)} className={iCls} />
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center mt-4">
          <button onClick={() => { setFilters(DEFAULT); setCurrentOnly(false); }}
            className="text-xs text-gray-500 hover:text-white transition-colors">Reset Defaults</button>
          <button onClick={run} disabled={loading}
            className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50">
            {loading ? "Scanning…" : "Apply Filters"}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="text-xs text-gray-500 flex items-center gap-4 flex-wrap">
        <span><span className="text-orange-400 font-semibold">SURGE</span> badge = surging today</span>
        <span>Click ▶ to expand full surge history for each stock</span>
      </div>

      {/* Results */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-gray-400">{loading ? "Loading…" : `${stocks.length} stocks`}</span>
        </div>
        {error ? (
          <div className="text-red-400 p-4 bg-red-400/10 rounded-lg text-sm">{error}</div>
        ) : (
          <ScannerTable data={stocks} isLoading={loading} sourceModule="Volume Scanner" mode="volume-surge" />
        )}
      </div>
    </div>
  );
}
