"use client";

import React, { useState, useEffect, useCallback, useContext } from "react";
import Link from "next/link";
import {
  Rocket, Search, AlertCircle, Bookmark, Sparkles,
  ExternalLink, TrendingUp, HelpCircle, Check, Loader2
} from "lucide-react";
import { screenerService } from "@/services/screenerService";
import AddToWatchlistModal from "@/components/watchlists/AddToWatchlistModal";
import { ScannerContext } from "../context";
import { SignalBadge, TradePlanStrip, ExplainPanel, StrategyFooter } from "@/components/screener/QuantLab";
import { LAUNCHPAD_TERMS, LAUNCHPAD_FAQS } from "@/lib/screener/quantContent";

function buildRationale(s: any): string {
  const dist = s.fvg_dist_pct ?? s.nearest_fvg_dist;
  const ema = s.ema_200_dist_pct ?? s.ema_200_dist;
  return (
    `Price ₹${s.cmp ?? s.entry} is holding ${dist}% above a fresh bullish Fair Value Gap ` +
    `(₹${s.fvg_low}–₹${s.fvg_high}, gap ${s.gap_pct}%, formed ${s.days_since_formation} day(s) ago) ` +
    `that now acts as demand support. The trend is constructive at ${ema}% versus the 200 EMA. ` +
    `The stop sits just below the gap using ATR${s.atr_14 ? ` (₹${s.atr_14})` : ""}, with the target ` +
    `at a ${s.risk_reward} reward — every level is derived from real price structure.`
  );
}

export default function LaunchPadPage() {
  const [stocks, setStocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheEmpty, setCacheEmpty] = useState(false);

  // Filters state
  const [market, setMarket] = useState("all");
  const [signalStars, setSignalStars] = useState("all");
  const [priceRange, setPriceRange] = useState("all");
  const [expectedReturn, setExpectedReturn] = useState("");
  const [search, setSearch] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState<any>(null);
  const [scanRunning, setScanRunning] = useState(false);

  const { scanMeta, registerData, registerRefresh } = useContext(ScannerContext);

  useEffect(() => {
    registerData(stocks);
  }, [stocks, registerData]);

  // One-shot check on mount — never polled while on this page, so a running
  // scan can't be interrupted or duplicated by this page's own requests.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await screenerService.getScanStatus();
        const data = res.data?.data;
        const status = (data?.overall_status ?? data?.status)?.toUpperCase();
        if (!cancelled && status === "RUNNING") setScanRunning(true);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  const runScan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, any> = { limit: 100 };
      if (market !== "all") params.market = market;
      
      // Expected return
      if (expectedReturn !== "") {
        params.min_return = Number(expectedReturn);
      }
      
      // Signal strength to confidence mapping
      if (signalStars === "5") {
        params.min_confidence = 90;
      } else if (signalStars === "4") {
        params.min_confidence = 80;
      } else if (signalStars === "3") {
        params.min_confidence = 70;
      }

      // Price range
      if (priceRange === "below200") {
        params.price_max = 200;
      } else if (priceRange === "200-500") {
        params.price_min = 200;
        params.price_max = 500;
      } else if (priceRange === "500-1000") {
        params.price_min = 500;
        params.price_max = 1000;
      } else if (priceRange === "1000+") {
        params.price_min = 1000;
      }

      const res = await screenerService.getLaunchPad(params);

      if (res.data?.success) {
        setStocks(res.data.data);
        setCacheEmpty(!!res.data.cache_empty);
      } else {
        setError(res.data?.error || "Failed to query signals");
      }
    } catch (err: any) {
      setError(err?.message || "FastAPI connection failed");
    } finally {
      setLoading(false);
    }
  }, [market, signalStars, priceRange, expectedReturn]);

  useEffect(() => {
    runScan();
  }, [runScan]);

  useEffect(() => {
    registerRefresh(() => { runScan(); });
  }, [registerRefresh, runScan]);

  const handleOpenWatchlist = (s: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedStock({
      symbol: s.symbol,
      company_name: s.company_name,
      price: s.entry
    });
    setIsModalOpen(true);
  };

  const filteredStocks = stocks.filter(s => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return s.symbol.toLowerCase().includes(q) || s.company_name.toLowerCase().includes(q);
  });

  const getConfidenceBadgeColor = (conf: number) => {
    if (conf >= 90) return "bg-purple-500/20 text-purple-300 border-purple-500/30";
    if (conf >= 80) return "bg-violet-500/20 text-violet-300 border-violet-500/30";
    return "bg-indigo-500/20 text-indigo-300 border-indigo-500/30";
  };

  return (
    <div className="space-y-8">
      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-purple-500/10 border border-purple-500/25 text-purple-400">
              <Rocket size={12} />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-purple-400">Proprietary Strategy</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">🚀 LaunchPad Swing Scanner</h1>
          <p className="text-sm text-gray-400">
            Scanning for high-probability momentum breakout setups using FVG overlaps with the 200 EMA support.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-purple-950/20 border border-purple-500/20 rounded-2xl px-5 py-2.5 text-center min-w-[100px]">
            <div className="text-2xl font-black text-purple-400 font-mono">
              {loading ? "..." : filteredStocks.length}
            </div>
            <div className="text-gray-500 text-[10px] uppercase font-bold tracking-wider">Setups Found</div>
          </div>
        </div>
      </div>

      {/* ── Scan-in-progress banner ─────────────────────────────────── */}
      {scanRunning && (
        <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl px-5 py-3 text-amber-300 text-sm">
          <Loader2 size={15} className="animate-spin flex-shrink-0" />
          <span>
            A full scan is currently running — these results are from the last completed scan and will
            refresh automatically once it finishes.
          </span>
          <Link href="/screener" className="ml-auto flex-shrink-0 text-amber-200 underline hover:text-white transition-colors">
            View progress
          </Link>
        </div>
      )}

      {/* ── Filters Panel ────────────────────────────────────────── */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-3xl p-6 backdrop-blur-xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          {/* Market Filter */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Market Index</label>
            <select
              value={market}
              onChange={(e) => setMarket(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-purple-500 transition-colors"
            >
              <option value="all">All NSE Stocks</option>
              <option value="nifty50">Nifty 50</option>
              <option value="nifty_next50">Nifty Next 50</option>
              <option value="nifty200">Nifty 200 Universe</option>
            </select>
          </div>

          {/* Signal Stars */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Signal Strength</label>
            <select
              value={signalStars}
              onChange={(e) => setSignalStars(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-purple-500 transition-colors"
            >
              <option value="all">All Strengths</option>
              <option value="5">★★★★★ (90%+ Confidence)</option>
              <option value="4">★★★★☆ (80%+ Confidence)</option>
              <option value="3">★★★☆☆ (70%+ Confidence)</option>
            </select>
          </div>

          {/* Price Range */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Price Range</label>
            <select
              value={priceRange}
              onChange={(e) => setPriceRange(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-purple-500 transition-colors"
            >
              <option value="all">All Prices</option>
              <option value="below200">Below ₹200</option>
              <option value="200-500">₹200 - ₹500</option>
              <option value="500-1000">₹500 - ₹1000</option>
              <option value="1000+">₹1000+</option>
            </select>
          </div>

          {/* Expected Return */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Expected Return</label>
            <select
              value={expectedReturn}
              onChange={(e) => setExpectedReturn(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-purple-500 transition-colors"
            >
              <option value="">Any Return</option>
              <option value="5">Min 5%</option>
              <option value="10">Min 10%</option>
              <option value="15">Min 15%</option>
              <option value="20">Min 20%+</option>
            </select>
          </div>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-800 pt-6">
          <div className="relative w-full sm:max-w-xs">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500">
              <Search size={15} />
            </span>
            <input
              type="text"
              placeholder="Search symbol or company..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-sm text-white placeholder-gray-550 focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>
          <button
            onClick={runScan}
            disabled={loading}
            className="w-full sm:w-auto bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm px-8 py-2.5 rounded-xl transition-all shadow-md active:scale-98"
          >
            {loading ? "Scanning Universe…" : "Re-Run Scanner"}
          </button>
        </div>
      </div>

      {/* ── Error state ───────────────────────────────────────────── */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-start gap-3 text-red-400 text-sm">
          <AlertCircle className="flex-shrink-0 mt-0.5" size={16} />
          <div>
            <h4 className="font-semibold">Scanner Error</h4>
            <p className="opacity-80 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* ── Results Cards ─────────────────────────────────────────── */}
      {loading && filteredStocks.length === 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-64 rounded-3xl bg-gray-900/30 border border-gray-800/40 animate-pulse p-6 space-y-4">
              <div className="flex justify-between items-center">
                <div className="h-5 w-20 bg-gray-800/80 rounded" />
                <div className="h-4 w-12 bg-gray-800/80 rounded" />
              </div>
              <div className="h-4 w-32 bg-gray-800/80 rounded" />
              <div className="h-10 bg-gray-800/40 rounded-xl" />
              <div className="grid grid-cols-3 gap-2">
                <div className="h-8 bg-gray-800/80 rounded" />
                <div className="h-8 bg-gray-800/80 rounded" />
                <div className="h-8 bg-gray-800/80 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredStocks.length === 0 && cacheEmpty ? (
        <div className="flex flex-col items-center py-20 text-center space-y-3 bg-gray-900/20 border border-gray-800/60 rounded-3xl">
          <Rocket size={40} className="text-gray-650" />
          <p className="text-gray-400 font-semibold text-base">No scan yet</p>
          <p className="text-gray-600 text-xs max-w-sm">
            LaunchPad setups are built by a full scan — run one to see results here.
          </p>
          <Link
            href="/screener"
            className="mt-2 inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-all"
          >
            Go to Overview &amp; Run Full Scan
          </Link>
        </div>
      ) : filteredStocks.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center space-y-3 bg-gray-900/20 border border-gray-800/60 rounded-3xl">
          <Rocket size={40} className="text-gray-650" />
          <p className="text-gray-400 font-semibold text-base">No LaunchPad setups found</p>
          <p className="text-gray-600 text-xs max-w-sm">
            Try adjusting your filters (e.g. select "All NSE Stocks" or reduce signal strength requirements).
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStocks.map((s) => (
            <div 
              key={s.symbol}
              className="group relative overflow-hidden rounded-3xl border border-gray-800 hover:border-purple-500/40 bg-gradient-to-b from-gray-900/40 to-gray-950/80 p-6 shadow-md transition-all duration-300 hover:scale-[1.01]"
            >
              <div className="absolute top-0 right-0 -z-10 h-24 w-24 rounded-full bg-purple-500/5 blur-2xl opacity-50" />
              
              {/* Header */}
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold text-white tracking-wide">{s.symbol}</h3>
                  <p className="text-xs text-gray-500 truncate max-w-[160px]">{s.company_name}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getConfidenceBadgeColor(s.confidence)}`}>
                    Conf. {s.confidence}%
                  </span>
                  <SignalBadge label={s.signal_strength} />
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="mt-5 grid grid-cols-3 gap-3 bg-gray-900/40 border border-gray-850 rounded-2xl p-4 text-xs">
                <div>
                  <span className="text-gray-500 text-[10px] block">Exp. Return</span>
                  <span className="font-bold text-purple-400 text-sm font-mono">+{s.expected_return}%</span>
                </div>
                <div>
                  <span className="text-gray-500 text-[10px] block">Hold</span>
                  <span className="font-semibold text-gray-250 text-sm">{s.holding_period}d</span>
                </div>
                <div>
                  <span className="text-gray-500 text-[10px] block">Risk</span>
                  <span className={`font-semibold text-sm ${s.risk === "Low" ? "text-emerald-400" : s.risk === "High" ? "text-red-400" : "text-amber-400"}`}>
                    {s.risk}
                  </span>
                </div>
              </div>

              {/* ATR-based trade plan */}
              <TradePlanStrip
                entry={s.entry}
                stop={s.stop_loss}
                target={s.target}
                riskReward={s.risk_reward}
                riskPct={s.risk_pct}
                atr={s.atr_14}
              />

              {/* Explainability panel */}
              <ExplainPanel
                rationale={buildRationale(s)}
                scores={s.confidence_breakdown}
                accent="purple"
                rows={[
                  { label: "FVG Zone", value: `₹${s.fvg_low}–₹${s.fvg_high}` },
                  { label: "Gap %", value: `${s.gap_pct}%` },
                  { label: "FVG Age", value: `${s.days_since_formation}d` },
                  { label: "vs EMA200", value: `${s.ema_200_dist_pct ?? s.ema_200_dist}%` },
                  { label: "Setup", value: s.setup ?? "continuation" },
                ]}
              />

              {/* Actions */}
              <div className="mt-5 grid grid-cols-3 gap-2">
                <button
                  onClick={() => window.open(`https://in.tradingview.com/chart/?symbol=NSE:${s.symbol}`, "_blank")}
                  className="flex items-center justify-center gap-1 text-[11px] font-medium bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:bg-gray-850 px-2 py-2 rounded-xl transition-all"
                  title="Open chart on TradingView"
                >
                  <ExternalLink size={11} /> Chart
                </button>
                
                <button
                  onClick={(e) => handleOpenWatchlist(s, e)}
                  className="flex items-center justify-center gap-1 text-[11px] font-medium bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:bg-gray-850 px-2 py-2 rounded-xl transition-all"
                >
                  <Bookmark size={11} /> +Watch
                </button>

                <Link
                  href={`/ai-copilot?prompt=Analyze+the+LaunchPad+momentum+setup+for+${s.symbol}+with+entry+at+${s.entry}+and+expected+return+of+${s.expected_return}%25.`}
                  className="flex items-center justify-center gap-1 text-[11px] font-bold bg-purple-600/10 border border-purple-500/20 text-purple-300 hover:bg-purple-600 hover:text-white px-2 py-2 rounded-xl transition-all text-center"
                >
                  <Sparkles size={11} /> AI Anal.
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Footer: glossary + FAQ ────────────────────────────────── */}
      <StrategyFooter terms={LAUNCHPAD_TERMS} faqs={LAUNCHPAD_FAQS} accent="purple" />

      {selectedStock && (
        <AddToWatchlistModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          symbol={selectedStock.symbol}
          companyName={selectedStock.company_name}
          sourceModule="LaunchPad Scanner"
          currentPrice={selectedStock.price}
        />
      )}
    </div>
  );
}
