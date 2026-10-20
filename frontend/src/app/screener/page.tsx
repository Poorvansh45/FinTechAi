"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Rocket, Shield, Filter, Waves, BookMarked,
  RefreshCw, Clock, BarChart3, TrendingUp, Sparkles, Landmark, Lock
} from "lucide-react";
import { screenerService } from "@/services/screenerService";
import { ScanStepper } from "@/components/screener/ScanStepper";
import { useAuth } from "@/context/AuthProvider";

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
  const { user } = useAuth();
  const isAdmin = user?.email?.trim().toLowerCase() === "poorvanshnandwar145@gmail.com";

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
    if (!isAdmin) {
      setScanError("Only admin (poorvanshnandwar145@gmail.com) can trigger market scans.");
      return;
    }
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
      } else if (status === 403) {
        setScanError("Only admin (poorvanshnandwar145@gmail.com) can trigger market scans.");
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
      <div className="relative overflow-hidden rounded-xl border border-neutral-800/80 bg-neutral-900 p-8 shadow-2xl">

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-brand-500" />
              <span className="text-xs font-semibold text-brand-400">Scanner Dashboard</span>
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground text-foreground ">
              Market Scan Overview
            </h1>
            <p className="text-sm text-neutral-400 max-w-xl hidden sm:block">
              Rethinking financial research with proprietary signal detection, institution-grade structures, and low-risk momentum swings.
            </p>
          </div>

          <div className="flex flex-col items-stretch gap-2 w-full md:w-auto md:items-end">
            <button
              onClick={handleTriggerScan}
              disabled={triggering || status === "RUNNING" || !isAdmin}
              title={!isAdmin ? "Only admin (poorvanshnandwar145@gmail.com) can trigger market scans" : undefined}
              className="flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm px-6 py-3.5 rounded-xl shadow-lg hover:shadow-brand-500/20 active:scale-98 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-brand-600 disabled:hover:to-brand-600 w-full md:w-auto"
            >
              {!isAdmin ? (
                <>
                  <Lock size={15} className="text-neutral-300" />
                  <span>Admin Only</span>
                </>
              ) : (
                <>
                  <RefreshCw size={15} className={`${triggering || status === "RUNNING" ? "animate-spin" : ""}`} />
                  <span>{status === "RUNNING" ? "Scanning Market…" : "Run Full Scan"}</span>
                </>
              )}
            </button>
            {!isAdmin ? (
              <p className="text-[11px] text-neutral-400/90 md:text-right max-w-xs flex items-center justify-center md:justify-end gap-1">
                <Lock size={11} className="text-warning-400" />
                <span>Full scans are restricted to admin account</span>
              </p>
            ) : scanError ? (
              <p className="text-xs text-warning-300 md:text-right max-w-xs">{scanError}</p>
            ) : null}
          </div>
        </div>

        <ScanStepper meta={scanMeta} />

        <div className="mt-6 sm:mt-8 grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 border-t border-neutral-800/80 pt-6 sm:pt-8">
          <div className="space-y-1">
            <span className="text-xs text-neutral-500">Scan Status</span>
            <div className="flex items-center gap-2">
              <span className={`inline-block h-2 w-2 rounded-full ${status === "RUNNING" ? "bg-warning-400 animate-pulse" : "bg-positive-400"}`} />
              <span className={`font-semibold text-sm ${status === "RUNNING" ? "text-warning-400" : "text-positive-400"}`}>
                {status}
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-xs text-neutral-500">Last Scanned</span>
            <div className="flex items-center gap-1.5 text-sm font-semibold text-neutral-200">
              <Clock size={13} className="text-neutral-500" />
              <span>{lastRanStr}</span>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-xs text-neutral-500">Total Stocks Scanned</span>
            <span className="block text-lg font-bold text-foreground font-mono">
              {stocksScanned.toLocaleString()}
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-xs text-neutral-500">Total Setup Opportunities</span>
            <span className="block text-lg font-bold text-brand-400 font-mono">
              {loading ? (
                <span className="inline-block w-8 h-4 bg-neutral-800/80 animate-pulse rounded" />
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
          <Sparkles size={16} className="text-warning-400" />
          <h2 className="text-xl font-bold tracking-tight text-foreground">Featured Proprietary Strategies</h2>
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-8">
          {/* Card 1: LaunchPad */}
          <div className="group relative overflow-hidden rounded-xl border border-brand-500/20 bg-neutral-900 p-8 shadow-xl transition-all duration-300 hover:scale-[1.01] hover:border-brand-500/40 hover:shadow-brand-900/10">
            
            <div className="flex items-start justify-between">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400 shadow-inner shadow-brand-500/5 group-hover:scale-110 transition-transform">
                <Rocket size={24} className="animate-bounce" style={{ animationDuration: '3s' }} />
              </div>
              <span className="px-3 py-1 rounded-md text-[11px] font-semibold bg-brand-500/10 border border-brand-500/20 text-brand-300">
                Fast Momentum
              </span>
            </div>

            <div className="mt-6 space-y-2">
              <h3 className="text-2xl font-bold text-foreground flex items-center gap-2">
                LaunchPad Strategy
              </h3>
              <p className="text-sm text-neutral-400">
                Designed to catch quick-swing momentum breakouts using freshly formed Fair Value Gaps aligned near the 200 EMA support.
              </p>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-4 border-y border-neutral-800/80 py-4 text-xs">
              <div className="space-y-1">
                <span className="text-neutral-500">Average Holding Period</span>
                <span className="block font-semibold text-neutral-200">5 – 7 Days</span>
              </div>
              <div className="space-y-1">
                <span className="text-neutral-500">Typical Return Target</span>
                <span className="block font-semibold text-brand-400">+5% to +20%</span>
              </div>
              <div className="space-y-1">
                <span className="text-neutral-500">Core Technical Signal</span>
                <span className="block font-semibold text-neutral-200">FVG + 200 EMA</span>
              </div>
              <div className="space-y-1">
                <span className="text-neutral-500">Current Opportunities</span>
                <span className="block font-bold text-foreground text-sm font-mono">
                  {loading ? (
                    <span className="inline-block w-8 h-3.5 bg-neutral-800/80 animate-pulse rounded" />
                  ) : (
                    lpCount ?? "—"
                  )}
                </span>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end">
              <Link 
                href="/screener/launchpad" 
                className="w-full text-center bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm px-6 py-3.5 rounded-xl transition-all shadow-md group-hover:shadow-brand-500/10 active:scale-99"
              >
                Scan LaunchPad Opportunities
              </Link>
            </div>
          </div>

          {/* Card 2: Alpha Zone */}
          <div className="group relative overflow-hidden rounded-xl border border-brand-500/20 bg-neutral-900 p-8 shadow-xl transition-all duration-300 hover:scale-[1.01] hover:border-brand-500/40 hover:shadow-brand-900/10">
            
            <div className="flex items-start justify-between">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400 shadow-inner shadow-brand-500/5 group-hover:scale-110 transition-transform">
                <Shield size={24} />
              </div>
              <span className="px-3 py-1 rounded-md text-[11px] font-semibold bg-brand-500/10 border border-brand-500/20 text-brand-300">
                Institutional Swings
              </span>
            </div>

            <div className="mt-6 space-y-2">
              <h3 className="text-2xl font-bold text-foreground flex items-center gap-2">
                Alpha Zone Strategy
              </h3>
              <p className="text-sm text-neutral-400">
                Detects low-risk demand mitigation points in fresh institutional order blocks for medium-term capital appreciation.
              </p>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-4 border-y border-neutral-800/80 py-4 text-xs">
              <div className="space-y-1">
                <span className="text-neutral-500">Average Holding Period</span>
                <span className="block font-semibold text-neutral-200">30 – 60 Days</span>
              </div>
              <div className="space-y-1">
                <span className="text-neutral-500">Expected Profit Target</span>
                <span className="block font-semibold text-brand-400">+10% to +40%</span>
              </div>
              <div className="space-y-1">
                <span className="text-neutral-500">Institutional Concept</span>
                <span className="block font-semibold text-neutral-200">Unmitigated Demand OB</span>
              </div>
              <div className="space-y-1">
                <span className="text-neutral-500">Current Opportunities</span>
                <span className="block font-bold text-foreground text-sm font-mono">
                  {loading ? (
                    <span className="inline-block w-8 h-3.5 bg-neutral-800/80 animate-pulse rounded" />
                  ) : (
                    azCount ?? "—"
                  )}
                </span>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end">
              <Link
                href="/screener/alpha-zone"
                className="w-full text-center bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm px-6 py-3.5 rounded-xl transition-all shadow-md group-hover:shadow-brand-500/10 active:scale-99"
              >
                Scan Alpha Zone Opportunities
              </Link>
            </div>
          </div>

          {/* Card 3: IPO Vintage */}
          <div className="group relative overflow-hidden rounded-xl border border-brand-500/20 bg-neutral-900 p-8 shadow-xl transition-all duration-300 hover:scale-[1.01] hover:border-brand-500/40 hover:shadow-brand-900/10">

            <div className="flex items-start justify-between">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400 shadow-inner shadow-brand-500/5 group-hover:scale-110 transition-transform">
                <Landmark size={24} />
              </div>
              <span className="px-3 py-1 rounded-md text-[11px] font-semibold bg-brand-500/10 border border-brand-500/20 text-brand-300">
                Rule-Based
              </span>
            </div>

            <div className="mt-6 space-y-2">
              <h3 className="text-2xl font-bold text-foreground flex items-center gap-2">
                IPO Vintage
              </h3>
              <p className="text-sm text-neutral-400">
                Watches recently-listed IPOs for the first close above their own listing-day close, then
                tracks a fixed calendar of time-based exits — no price target, no ML.
              </p>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-4 border-y border-neutral-800/80 py-4 text-xs">
              <div className="space-y-1">
                <span className="text-neutral-500">Exit Horizons</span>
                <span className="block font-semibold text-neutral-200">1 – 4 Weeks (fixed)</span>
              </div>
              <div className="space-y-1">
                <span className="text-neutral-500">Entry Trigger</span>
                <span className="block font-semibold text-brand-400">Close &gt; Listing Close</span>
              </div>
              <div className="space-y-1">
                <span className="text-neutral-500">Core Signal</span>
                <span className="block font-semibold text-neutral-200">Subscription-free breakout</span>
              </div>
              <div className="space-y-1">
                <span className="text-neutral-500">Current Opportunities</span>
                <span className="block font-bold text-foreground text-sm font-mono">
                  {loading ? (
                    <span className="inline-block w-8 h-3.5 bg-neutral-800/80 animate-pulse rounded" />
                  ) : (
                    ivCount ?? "—"
                  )}
                </span>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end">
              <Link
                href="/screener/ipo-vintage"
                className="w-full text-center bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm px-6 py-3.5 rounded-xl transition-all shadow-md group-hover:shadow-brand-500/10 active:scale-99"
              >
                Scan IPO Vintage Opportunities
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Other Scanners Section ────────────────────────────────────── */}
      <div className="space-y-6">
        <h2 className="text-lg font-bold text-neutral-300">Alternative Scanners</h2>
        <div className="grid sm:grid-cols-3 gap-6">
          <Link 
            href="/screener/technical"
            className="group relative overflow-hidden rounded-xl border border-neutral-850 bg-neutral-900/30 p-6 hover:bg-neutral-800/20 hover:border-warning-500/20 transition-all flex items-center gap-4"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-warning-500/5 border border-warning-500/15 text-warning-400 group-hover:scale-105 transition-transform">
              <Filter size={18} />
            </div>
            <div>
              <h4 className="font-semibold text-foreground text-sm group-hover:text-warning-400 transition-colors">Technical Scanner</h4>
              <p className="text-xs text-neutral-500 mt-0.5">Filter by RSI, EMA offsets, MACD momentum</p>
            </div>
          </Link>

          <Link 
            href="/screener/volume"
            className="group relative overflow-hidden rounded-xl border border-neutral-850 bg-neutral-900/30 p-6 hover:bg-neutral-800/20 hover:border-warning-500/20 transition-all flex items-center gap-4"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-warning-500/5 border border-warning-500/15 text-warning-400 group-hover:scale-105 transition-transform">
              <Waves size={18} />
            </div>
            <div>
              <h4 className="font-semibold text-foreground text-sm group-hover:text-warning-400 transition-colors">Volume Scanner</h4>
              <p className="text-xs text-neutral-500 mt-0.5">Identify sudden spikes in institutional buying</p>
            </div>
          </Link>

          <Link 
            href="/screener/watchlists"
            className="group relative overflow-hidden rounded-xl border border-neutral-850 bg-neutral-900/30 p-6 hover:bg-neutral-800/20 hover:border-positive-500/20 transition-all flex items-center gap-4"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-positive-500/5 border border-positive-500/15 text-positive-400 group-hover:scale-105 transition-transform">
              <BookMarked size={18} />
            </div>
            <div>
              <h4 className="font-semibold text-foreground text-sm group-hover:text-positive-400 transition-colors">Your Watchlists</h4>
              <p className="text-xs text-neutral-500 mt-0.5">Track saved setups and trigger alerts</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
