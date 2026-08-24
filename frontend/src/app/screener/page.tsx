"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Rocket, Shield, Filter, Waves, BookMarked,
  RefreshCw, Clock, BarChart3, TrendingUp, Sparkles, Landmark
} from "lucide-react";
import { screenerService } from "@/services/screenerService";
import { ScanStepper } from "@/components/screener/ScanStepper";

const formatISTDate = (isoString?: string) => {
  if (!isoString) return "—";
  try {
    const date = new Date(isoString);
    const options = {
      timeZone: "Asia/Kolkata",
      day: "2-digit" as const,
      month: "short" as const,
      year: "numeric" as const,
      hour: "2-digit" as const,
      minute: "2-digit" as const,
      hour12: false
    };
    const formatter = new Intl.DateTimeFormat("en-IN", options);
    const parts = formatter.formatToParts(date);
    const partMap = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return `${partMap.day} ${partMap.month} ${partMap.year} ${partMap.hour}:${partMap.minute} IST`;
  } catch {
    return "—";
  }
};

export default function ScreenerOverviewPage() {
  const [lpCount, setLpCount] = useState<number | null>(null);
  const [azCount, setAzCount] = useState<number | null>(null);
  const [ivCount, setIvCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanMeta, setScanMeta] = useState<any>(null);
  const prevStatusRef = useRef<string | null>(null);

  const fetchCounts = useCallback(async () => {
    setLoading(true);
    try {
      const [lpRes, azRes, ivRes] = await Promise.allSettled([
        screenerService.getLaunchPad(),
        screenerService.getAlphaZone(),
        screenerService.getIpoVintage(),
      ]);
      if (lpRes.status === "fulfilled" && lpRes.value.data?.success) {
        setLpCount(lpRes.value.data.count);
      }
      if (azRes.status === "fulfilled" && azRes.value.data?.success) {
        setAzCount(azRes.value.data.count);
      }
      if (ivRes.status === "fulfilled" && ivRes.value.data?.success) {
        setIvCount(ivRes.value.data.count);
      }
    } catch (err) {
      console.error("Failed to load opportunity counts", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  // Overview owns the scan-status poll (the only "Run Full Scan" trigger
  // lives here now): fetch once on mount, then every 3s while RUNNING. When
  // it transitions RUNNING -> COMPLETED, re-fetch the opportunity counts so
  // the cards reflect the scan that just finished.
  const checkStatus = useCallback(async () => {
    try {
      const res = await screenerService.getScanStatus();
      if (res.data?.success) {
        const data = res.data.data;
        setScanMeta(data);
        const currentStatus = data?.status?.toUpperCase();
        if (prevStatusRef.current === "RUNNING" && currentStatus === "COMPLETED") {
          fetchCounts();
        }
        prevStatusRef.current = currentStatus;
      }
    } catch {}
  }, [fetchCounts]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  useEffect(() => {
    if (scanMeta?.status?.toUpperCase() !== "RUNNING") return;
    const intervalId = setInterval(checkStatus, 3000);
    return () => clearInterval(intervalId);
  }, [scanMeta?.status, checkStatus]);

  const handleTriggerScan = async () => {
    setTriggering(true);
    setScanError(null);
    try {
      await screenerService.triggerScan();
      setScanMeta((m: any) => ({ ...m, status: "RUNNING", stage: "downloading" }));
      prevStatusRef.current = "RUNNING";
      checkStatus();
    } catch (err: any) {
      // The endpoint now rejects deliberately (auth / already-running /
      // cooldown). Swallowing those left the button looking broken, so each
      // reason gets its own message.
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      if (status === 401) {
        setScanError("Sign in to run a full scan.");
      } else if (status === 409) {
        setScanError(detail?.message || "A scan is already running.");
        checkStatus();
      } else if (status === 429) {
        setScanError(detail?.message || "A scan ran recently — please wait before running another.");
      } else {
        setScanError("Couldn't start the scan. Check that the analytics service is running.");
      }
    } finally {
      setTriggering(false);
    }
  };

  const status = scanMeta?.status?.toUpperCase() || "READY";
  const lastRanStr = scanMeta?.last_ran ? formatISTDate(scanMeta.last_ran) : "Never";
  const stocksScanned = scanMeta?.total_symbols || scanMeta?.record_count || 0;
  const totalOpportunities = (lpCount || 0) + (azCount || 0) + (ivCount || 0);

  return (
    <div className="space-y-10 py-2">
      {/* ── Top Dashboard Section ────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl border border-gray-800/80 bg-gradient-to-br from-gray-900/60 to-gray-950/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 -z-10 h-72 w-72 rounded-full bg-blue-500/5 blur-3xl" />
        <div className="absolute bottom-0 left-10 -z-10 h-72 w-72 rounded-full bg-purple-500/5 blur-3xl" />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Scanner Dashboard</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white md:text-4xl bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
              Market Scan Overview
            </h1>
            <p className="text-sm text-gray-400 max-w-xl">
              Rethinking financial research with proprietary signal detection, institution-grade structures, and low-risk momentum swings.
            </p>
          </div>

          <div className="flex flex-col items-stretch gap-2 w-full md:w-auto md:items-end">
            <button
              onClick={handleTriggerScan}
              disabled={triggering || status === "RUNNING"}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-semibold text-sm px-6 py-3.5 rounded-2xl shadow-lg hover:shadow-indigo-500/20 active:scale-98 transition-all disabled:opacity-50 w-full md:w-auto"
            >
              <RefreshCw size={15} className={`${triggering || status === "RUNNING" ? "animate-spin" : ""}`} />
              {status === "RUNNING" ? "Scanning Market…" : "Run Full Scan"}
            </button>
            {scanError && (
              <p className="text-xs text-amber-300/90 md:text-right max-w-xs">{scanError}</p>
            )}
          </div>
        </div>

        <ScanStepper meta={scanMeta} />

        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-6 border-t border-gray-800/80 pt-8">
          <div className="space-y-1">
            <span className="text-xs text-gray-500">Scan Status</span>
            <div className="flex items-center gap-2">
              <span className={`inline-block h-2 w-2 rounded-full ${status === "RUNNING" ? "bg-yellow-400 animate-pulse" : "bg-emerald-400"}`} />
              <span className={`font-semibold text-sm uppercase tracking-wider ${status === "RUNNING" ? "text-yellow-400" : "text-emerald-400"}`}>
                {status}
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-xs text-gray-500">Last Scanned</span>
            <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-200">
              <Clock size={13} className="text-gray-500" />
              <span>{lastRanStr}</span>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-xs text-gray-500">Total Stocks Scanned</span>
            <span className="block text-lg font-bold text-white font-mono">
              {stocksScanned.toLocaleString()}
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-xs text-gray-500">Total Setup Opportunities</span>
            <span className="block text-lg font-bold text-indigo-400 font-mono">
              {loading ? (
                <span className="inline-block w-8 h-4 bg-gray-800/80 animate-pulse rounded" />
              ) : (
                totalOpportunities
              )}
            </span>
          </div>
        </div>
      </div>

      {/* ── Featured Strategies Section ────────────────────────────────── */}
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-yellow-400" />
          <h2 className="text-xl font-bold tracking-tight text-white">Featured Proprietary Strategies</h2>
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-8">
          {/* Card 1: LaunchPad */}
          <div className="group relative overflow-hidden rounded-3xl border border-purple-500/20 bg-gradient-to-br from-purple-950/20 via-gray-900/40 to-gray-950/60 p-8 shadow-xl transition-all duration-300 hover:scale-[1.01] hover:border-purple-500/40 hover:shadow-purple-900/10">
            <div className="absolute top-0 right-0 -z-10 h-40 w-40 rounded-full bg-purple-500/10 blur-3xl opacity-50" />
            
            <div className="flex items-start justify-between">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 shadow-inner shadow-purple-500/5 group-hover:scale-110 transition-transform">
                <Rocket size={24} className="animate-bounce" style={{ animationDuration: '3s' }} />
              </div>
              <span className="px-3 py-1 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-purple-500/10 border border-purple-500/20 text-purple-300">
                Fast Momentum
              </span>
            </div>

            <div className="mt-6 space-y-2">
              <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                LaunchPad Strategy
              </h3>
              <p className="text-sm text-gray-400">
                Designed to catch quick-swing momentum breakouts using freshly formed Fair Value Gaps aligned near the 200 EMA support.
              </p>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-4 border-y border-gray-800/80 py-4 text-xs">
              <div className="space-y-1">
                <span className="text-gray-500">Average Holding Period</span>
                <span className="block font-semibold text-gray-200">5 – 7 Days</span>
              </div>
              <div className="space-y-1">
                <span className="text-gray-500">Typical Return Target</span>
                <span className="block font-semibold text-purple-400">+5% to +20%</span>
              </div>
              <div className="space-y-1">
                <span className="text-gray-500">Core Technical Signal</span>
                <span className="block font-semibold text-gray-200">FVG + 200 EMA</span>
              </div>
              <div className="space-y-1">
                <span className="text-gray-500">Current Opportunities</span>
                <span className="block font-bold text-white text-sm font-mono">
                  {loading ? (
                    <span className="inline-block w-8 h-3.5 bg-gray-800/80 animate-pulse rounded" />
                  ) : (
                    lpCount ?? "—"
                  )}
                </span>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end">
              <Link 
                href="/screener/launchpad" 
                className="w-full text-center bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm px-6 py-3.5 rounded-xl transition-all shadow-md group-hover:shadow-purple-500/10 active:scale-99"
              >
                Scan LaunchPad Opportunities
              </Link>
            </div>
          </div>

          {/* Card 2: Alpha Zone */}
          <div className="group relative overflow-hidden rounded-3xl border border-blue-500/20 bg-gradient-to-br from-blue-950/20 via-gray-900/40 to-gray-950/60 p-8 shadow-xl transition-all duration-300 hover:scale-[1.01] hover:border-blue-500/40 hover:shadow-blue-900/10">
            <div className="absolute top-0 right-0 -z-10 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl opacity-50" />
            
            <div className="flex items-start justify-between">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 shadow-inner shadow-blue-500/5 group-hover:scale-110 transition-transform">
                <Shield size={24} />
              </div>
              <span className="px-3 py-1 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-blue-500/10 border border-blue-500/20 text-blue-300">
                Institutional Swings
              </span>
            </div>

            <div className="mt-6 space-y-2">
              <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                Alpha Zone Strategy
              </h3>
              <p className="text-sm text-gray-400">
                Detects low-risk demand mitigation points in fresh institutional order blocks for medium-term capital appreciation.
              </p>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-4 border-y border-gray-800/80 py-4 text-xs">
              <div className="space-y-1">
                <span className="text-gray-500">Average Holding Period</span>
                <span className="block font-semibold text-gray-200">30 – 60 Days</span>
              </div>
              <div className="space-y-1">
                <span className="text-gray-500">Expected Profit Target</span>
                <span className="block font-semibold text-blue-400">+10% to +40%</span>
              </div>
              <div className="space-y-1">
                <span className="text-gray-500">Institutional Concept</span>
                <span className="block font-semibold text-gray-200">Unmitigated Demand OB</span>
              </div>
              <div className="space-y-1">
                <span className="text-gray-500">Current Opportunities</span>
                <span className="block font-bold text-white text-sm font-mono">
                  {loading ? (
                    <span className="inline-block w-8 h-3.5 bg-gray-800/80 animate-pulse rounded" />
                  ) : (
                    azCount ?? "—"
                  )}
                </span>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end">
              <Link
                href="/screener/alpha-zone"
                className="w-full text-center bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm px-6 py-3.5 rounded-xl transition-all shadow-md group-hover:shadow-blue-500/10 active:scale-99"
              >
                Scan Alpha Zone Opportunities
              </Link>
            </div>
          </div>

          {/* Card 3: IPO Vintage */}
          <div className="group relative overflow-hidden rounded-3xl border border-teal-500/20 bg-gradient-to-br from-teal-950/20 via-gray-900/40 to-gray-950/60 p-8 shadow-xl transition-all duration-300 hover:scale-[1.01] hover:border-teal-500/40 hover:shadow-teal-900/10">
            <div className="absolute top-0 right-0 -z-10 h-40 w-40 rounded-full bg-teal-500/10 blur-3xl opacity-50" />

            <div className="flex items-start justify-between">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 shadow-inner shadow-teal-500/5 group-hover:scale-110 transition-transform">
                <Landmark size={24} />
              </div>
              <span className="px-3 py-1 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-teal-500/10 border border-teal-500/20 text-teal-300">
                Rule-Based
              </span>
            </div>

            <div className="mt-6 space-y-2">
              <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                IPO Vintage
              </h3>
              <p className="text-sm text-gray-400">
                Watches recently-listed IPOs for the first close above their own listing-day close, then
                tracks a fixed calendar of time-based exits — no price target, no ML.
              </p>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-4 border-y border-gray-800/80 py-4 text-xs">
              <div className="space-y-1">
                <span className="text-gray-500">Exit Horizons</span>
                <span className="block font-semibold text-gray-200">1 – 4 Weeks (fixed)</span>
              </div>
              <div className="space-y-1">
                <span className="text-gray-500">Entry Trigger</span>
                <span className="block font-semibold text-teal-400">Close &gt; Listing Close</span>
              </div>
              <div className="space-y-1">
                <span className="text-gray-500">Core Signal</span>
                <span className="block font-semibold text-gray-200">Subscription-free breakout</span>
              </div>
              <div className="space-y-1">
                <span className="text-gray-500">Current Opportunities</span>
                <span className="block font-bold text-white text-sm font-mono">
                  {loading ? (
                    <span className="inline-block w-8 h-3.5 bg-gray-800/80 animate-pulse rounded" />
                  ) : (
                    ivCount ?? "—"
                  )}
                </span>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end">
              <Link
                href="/screener/ipo-vintage"
                className="w-full text-center bg-teal-600 hover:bg-teal-500 text-white font-semibold text-sm px-6 py-3.5 rounded-xl transition-all shadow-md group-hover:shadow-teal-500/10 active:scale-99"
              >
                Scan IPO Vintage Opportunities
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Other Scanners Section ────────────────────────────────────── */}
      <div className="space-y-6">
        <h2 className="text-lg font-bold text-gray-300">Alternative Scanners</h2>
        <div className="grid sm:grid-cols-3 gap-6">
          <Link 
            href="/screener/technical"
            className="group relative overflow-hidden rounded-2xl border border-gray-850 bg-gray-900/30 p-6 hover:bg-gray-800/20 hover:border-yellow-500/20 transition-all flex items-center gap-4"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-yellow-500/5 border border-yellow-500/15 text-yellow-400 group-hover:scale-105 transition-transform">
              <Filter size={18} />
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm group-hover:text-yellow-400 transition-colors">Technical Scanner</h4>
              <p className="text-xs text-gray-500 mt-0.5">Filter by RSI, EMA offsets, MACD momentum</p>
            </div>
          </Link>

          <Link 
            href="/screener/volume"
            className="group relative overflow-hidden rounded-2xl border border-gray-850 bg-gray-900/30 p-6 hover:bg-gray-800/20 hover:border-orange-500/20 transition-all flex items-center gap-4"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500/5 border border-orange-500/15 text-orange-400 group-hover:scale-105 transition-transform">
              <Waves size={18} />
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm group-hover:text-orange-400 transition-colors">Volume Scanner</h4>
              <p className="text-xs text-gray-500 mt-0.5">Identify sudden spikes in institutional buying</p>
            </div>
          </Link>

          <Link 
            href="/screener/watchlists"
            className="group relative overflow-hidden rounded-2xl border border-gray-850 bg-gray-900/30 p-6 hover:bg-gray-800/20 hover:border-emerald-500/20 transition-all flex items-center gap-4"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/5 border border-emerald-500/15 text-emerald-400 group-hover:scale-105 transition-transform">
              <BookMarked size={18} />
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm group-hover:text-emerald-400 transition-colors">Your Watchlists</h4>
              <p className="text-xs text-gray-500 mt-0.5">Track saved setups and trigger alerts</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
