"use client";

import React, { useState, useEffect, useContext } from "react";
import {
  Upload, Trash2, Play, CheckCircle2, Clock, FileSpreadsheet,
  AlertCircle, ShieldAlert, FolderOpen, ArrowRight, Loader2, Info
} from "lucide-react";
import { ScannerContext } from "../context";

const FASTAPI_URL =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_FASTAPI_URL || "http://localhost:8000")
    : "http://localhost:8000";

type FileStatus = {
  filename: string;
  symbol: string;
  size_bytes: number;
  last_modified: string;
  rows: number;
  synced_db: {
    screener: boolean;
    fvg: boolean;
    smc: boolean;
  };
};

type ScanResult = {
  symbol: string;
  price?: number;
  volume?: number;
  avg_volume_20d?: number;
  rsi?: number;
  ema_50_dist_pct?: number;
  ema_200_dist_pct?: number;
  macd_hist?: number;
  has_fvg?: boolean;
  fvg_score?: number;
  fvg_status?: string;
  fvg_strength?: string;
  smc_score?: number;
  structure?: {
    last_bullish_event?: string;
    last_bearish_event?: string;
  };
  nearest_demand?: {
    zone_high?: number;
    zone_low?: number;
    distance_pct?: number;
    zone_age_days?: number;
    touch_count?: number;
  };
  updated_at?: string;
};

export default function LocalOHLCScanner() {
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [results, setResults] = useState<ScanResult[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingResults, setLoadingResults] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  // Modal for delete confirmation
  const [deleteSymbol, setDeleteSymbol] = useState<string | null>(null);

  const { registerData, registerRefresh } = useContext(ScannerContext);

  const fetchStatusAndResults = async () => {
    setLoadingFiles(true);
    setLoadingResults(true);
    setError(null);
    try {
      const [statusRes, resultsRes] = await Promise.all([
        fetch(`${FASTAPI_URL}/api/v2/scanner/local-ohlc/status`),
        fetch(`${FASTAPI_URL}/api/v2/scanner/local-ohlc/results`)
      ]);

      if (!statusRes.ok || !resultsRes.ok) {
        throw new Error("Failed to load local stock data.");
      }

      const statusJson = await statusRes.json();
      const resultsJson = await resultsRes.json();

      if (statusJson.success) setFiles(statusJson.data || []);
      if (resultsJson.success) {
        setResults(resultsJson.data || []);
        registerData(resultsJson.data || []);
      }
    } catch (err: any) {
      setError(err.message || "An error occurred fetching data.");
    } finally {
      setLoadingFiles(false);
      setLoadingResults(false);
    }
  };

  useEffect(() => {
    fetchStatusAndResults();
    registerRefresh(fetchStatusAndResults);
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setUploadError(null);
    setUploading(true);

    if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
      setUploadError("Only CSV files are supported.");
      setUploading(false);
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setUploadError("File exceeds the 5MB size limit.");
      setUploading(false);
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const res = await fetch(`${FASTAPI_URL}/api/v2/scanner/local-ohlc/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Upload and processing failed.");
      }

      await fetchStatusAndResults();
    } catch (err: any) {
      setUploadError(err.message || "Upload failed.");
    } finally {
      setUploading(false);
      if (e.target) e.target.value = ""; // Clear input
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch(`${FASTAPI_URL}/api/v2/scanner/local-ohlc/trigger`, {
        method: "POST"
      });
      if (!res.ok) throw new Error("Sync trigger failed.");
      
      // Wait briefly for execution and reload
      setTimeout(async () => {
        await fetchStatusAndResults();
        setSyncing(false);
      }, 3000);
    } catch (err: any) {
      setError(err.message || "Failed to trigger incremental update.");
      setSyncing(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteSymbol) return;
    try {
      const res = await fetch(`${FASTAPI_URL}/api/v2/scanner/local-ohlc/delete/${deleteSymbol}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error("Delete failed.");
      await fetchStatusAndResults();
    } catch (err: any) {
      setError(err.message || "Delete failed.");
    } finally {
      setDeleteSymbol(null);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatPct = (val?: number) => {
    if (val === undefined || val === null) return "-";
    const sign = val > 0 ? "+" : "";
    return `${sign}${val.toFixed(2)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FolderOpen className="text-emerald-400" size={22} />
            My Stock OHLC Scanner
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Incremental loader, CSV editor, and SMC/FVG scanner for custom or imported stock datasets.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSync}
            disabled={syncing || files.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-all shadow-lg shadow-emerald-950/20"
          >
            {syncing ? (
              <>
                <Loader2 className="animate-spin" size={14} />
                Syncing Files...
              </>
            ) : (
              <>
                <Play size={14} />
                Sync & Run Scan
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left column: Upload & File management */}
        <div className="space-y-6 lg:col-span-1">
          {/* Uploader Card */}
          <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-5 backdrop-blur-sm space-y-4">
            <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wider">Upload Custom Stock</h3>
            
            <label className="border-2 border-dashed border-gray-800 hover:border-emerald-500/50 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all bg-gray-950/40 group">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                disabled={uploading}
              />
              {uploading ? (
                <Loader2 className="animate-spin text-emerald-400 mb-3" size={28} />
              ) : (
                <Upload className="text-gray-500 group-hover:text-emerald-400 transition-colors mb-3" size={28} />
              )}
              <span className="text-sm font-semibold text-gray-300 group-hover:text-white transition-colors">
                {uploading ? "Analyzing & Scanning..." : "Click to select CSV"}
              </span>
              <span className="text-[11px] text-gray-500 mt-1">Maximum size 5MB</span>
            </label>

            {uploadError && (
              <div className="flex items-start gap-2 bg-red-950/30 border border-red-900/40 text-red-300 p-3 rounded-lg text-xs">
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            <div className="border-t border-gray-800/80 pt-4 space-y-3">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                <Info size={12} className="text-emerald-400" /> Expected CSV Format
              </h4>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                CSV header names must contain: <code className="bg-gray-950 px-1 py-0.5 rounded text-gray-300 font-mono text-[10px]">Date</code>, 
                <code className="bg-gray-950 px-1 py-0.5 rounded text-gray-300 font-mono text-[10px]">Open</code>, 
                <code className="bg-gray-950 px-1 py-0.5 rounded text-gray-300 font-mono text-[10px]">High</code>, 
                <code className="bg-gray-950 px-1 py-0.5 rounded text-gray-300 font-mono text-[10px]">Low</code>, and 
                <code className="bg-gray-950 px-1 py-0.5 rounded text-gray-300 font-mono text-[10px]">Close</code>. Volume is optional. 
                The file name will designate the ticker symbol (e.g. <span className="font-semibold text-gray-400">TCS.NS.csv</span>).
              </p>
            </div>
          </div>

          {/* Files List Card */}
          <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-5 backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wider">Local File Universe</h3>
              <span className="text-xs bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2 py-0.5 rounded-full font-semibold">
                {files.length} Tickers
              </span>
            </div>

            {loadingFiles ? (
              <div className="py-12 flex justify-center">
                <Loader2 className="animate-spin text-emerald-400" size={24} />
              </div>
            ) : files.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-500 border border-gray-800/60 rounded-xl border-dashed">
                No custom stock files loaded. Upload a CSV to begin.
              </div>
            ) : (
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                {files.map((file) => (
                  <div
                    key={file.symbol}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-800 bg-gray-950/40 hover:border-gray-700/80 transition-all"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet size={13} className="text-emerald-400" />
                        <span className="text-sm font-semibold text-white">{file.symbol}</span>
                        <span className="text-[10px] text-gray-500">({file.rows} candles)</span>
                      </div>
                      <div className="flex gap-2 text-[10px] text-gray-400">
                        <span>{formatSize(file.size_bytes)}</span>
                        <span>·</span>
                        <span>Mod: {new Date(file.last_modified).toLocaleDateString()}</span>
                      </div>
                      <div className="flex gap-1.5 mt-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${file.synced_db.screener ? 'bg-yellow-500/10 text-yellow-400' : 'bg-gray-800 text-gray-600'}`}>TA</span>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${file.synced_db.fvg ? 'bg-blue-500/10 text-blue-400' : 'bg-gray-800 text-gray-600'}`}>FVG</span>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${file.synced_db.smc ? 'bg-purple-500/10 text-purple-400' : 'bg-gray-800 text-gray-600'}`}>SMC</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setDeleteSymbol(file.symbol)}
                      className="text-gray-500 hover:text-red-400 p-1.5 hover:bg-gray-900 rounded-lg transition-colors"
                      title="Delete stock file and caches"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Scan outcomes */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-5 backdrop-blur-sm space-y-4">
            <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wider">Analysis & Scanner Results</h3>

            {error && (
              <div className="flex items-center gap-2 bg-red-950/30 border border-red-900/40 text-red-300 p-4 rounded-xl text-sm">
                <AlertCircle size={16} className="flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {loadingResults ? (
              <div className="py-24 flex flex-col items-center justify-center gap-3">
                <Loader2 className="animate-spin text-emerald-400" size={32} />
                <span className="text-xs text-gray-500 font-medium">Running computations...</span>
              </div>
            ) : results.length === 0 ? (
              <div className="py-24 text-center text-sm text-gray-500 border border-gray-800/60 rounded-xl border-dashed">
                No active calculations. Add file data and hit "Sync & Run Scan".
              </div>
            ) : (
              <div className="overflow-x-auto border border-gray-800/80 rounded-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-950/60 border-b border-gray-800 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                      <th className="py-3.5 px-4">Symbol</th>
                      <th className="py-3.5 px-3 text-right">LTP (₹)</th>
                      <th className="py-3.5 px-3 text-right">RSI</th>
                      <th className="py-3.5 px-3 text-right">EMA 50%</th>
                      <th className="py-3.5 px-3 text-right">EMA 200%</th>
                      <th className="py-3.5 px-4 text-center">FVG Score</th>
                      <th className="py-3.5 px-4 text-center">SMC Score</th>
                      <th className="py-3.5 px-4">Active Zone</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50 text-xs">
                    {results.map((res) => (
                      <tr key={res.symbol} className="hover:bg-gray-900/20 transition-colors">
                        <td className="py-3 px-4 font-bold text-white flex items-center gap-1.5">
                          <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" />
                          {res.symbol}
                        </td>
                        <td className="py-3 px-3 text-right text-gray-200 font-mono">
                          {res.price ? res.price.toLocaleString("en-IN") : "-"}
                        </td>
                        <td className="py-3 px-3 text-right font-semibold font-mono">
                          <span className={
                            res.rsi && res.rsi >= 70 ? "text-red-400" :
                            res.rsi && res.rsi <= 30 ? "text-emerald-400" : "text-gray-300"
                          }>
                            {res.rsi?.toFixed(1) || "-"}
                          </span>
                        </td>
                        <td className={`py-3 px-3 text-right font-mono font-semibold ${
                          res.ema_50_dist_pct && res.ema_50_dist_pct >= 0 ? "text-emerald-400" : "text-red-400"
                        }`}>
                          {formatPct(res.ema_50_dist_pct)}
                        </td>
                        <td className={`py-3 px-3 text-right font-mono font-semibold ${
                          res.ema_200_dist_pct && res.ema_200_dist_pct >= 0 ? "text-emerald-400" : "text-red-400"
                        }`}>
                          {formatPct(res.ema_200_dist_pct)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {res.fvg_score ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                              res.fvg_strength === "Strong" ? "bg-emerald-400/15 text-emerald-400" :
                              res.fvg_strength === "Medium" ? "bg-yellow-400/15 text-yellow-400" : "bg-red-400/15 text-red-400"
                            }`}>
                              {res.fvg_score} ({res.fvg_strength})
                            </span>
                          ) : (
                            <span className="text-gray-600 font-medium">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center font-bold font-mono">
                          {res.smc_score ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] ${
                              res.smc_score >= 70 ? "bg-purple-500/15 text-purple-300" :
                              res.smc_score >= 50 ? "bg-blue-500/15 text-blue-300" : "bg-gray-800 text-gray-500"
                            }`}>
                              {res.smc_score}
                            </span>
                          ) : (
                            <span className="text-gray-600 font-medium">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-gray-400">
                          {res.nearest_demand?.zone_high ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[10px] font-semibold text-emerald-400">
                                Demand [₹{res.nearest_demand.zone_low} - ₹{res.nearest_demand.zone_high}]
                              </span>
                              <span className="text-[9px] text-gray-500">
                                Dist: {res.nearest_demand.distance_pct?.toFixed(2)}% · Age: {res.nearest_demand.zone_age_days}d
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-600 font-medium">None</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteSymbol && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <ShieldAlert size={24} />
              <h3 className="text-lg font-bold text-white">Delete Stock Data?</h3>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Are you sure you want to delete <span className="font-semibold text-white">{deleteSymbol}</span>? This will permanently delete the local CSV file and purge all calculated scans from MongoDB.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteSymbol(null)}
                className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-semibold text-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-xs font-semibold text-white transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
