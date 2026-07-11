"use client";

import React, { useState, useEffect, useCallback, useContext } from "react";
import Link from "next/link";
import {
  Shield, Search, AlertCircle, Bookmark, Sparkles,
  ExternalLink, Layers, Award, Target
} from "lucide-react";
import { screenerService } from "@/services/screenerService";
import AddToWatchlistModal from "@/components/watchlists/AddToWatchlistModal";
import { ScannerContext } from "../context";
import { SignalBadge, TradePlanStrip, ExplainPanel, StrategyFooter } from "@/components/screener/QuantLab";
import { ALPHAZONE_TERMS, ALPHAZONE_FAQS } from "@/lib/screener/quantContent";

function buildAZRationale(s: any): string {
  const distTxt = s.distance_pct === 0 ? "inside" : `${s.distance_pct}% away from`;
  return (
    `Price ₹${s.ltp} is ${distTxt} a ${s.zone_type} institutional demand zone ` +
    `(₹${s.zone_low}–₹${s.zone_high}) — an area where large buyers previously stepped in. ` +
    `SMC structure scores ${s.institutional_score}/100. Entry is set at the top of the zone with ` +
    `the stop below it; the target is derived at a ${s.risk_reward} reward from the real zone size.`
  );
}

export default function AlphaZonePage() {
  const [stocks, setStocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [freshness, setFreshness] = useState("all");
  const [distance, setDistance] = useState("all");
  const [minReturn, setMinReturn] = useState("");
  const [holdingPeriod, setHoldingPeriod] = useState("all");
  const [search, setSearch] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState<any>(null);

  const { scanMeta, registerData, registerRefresh } = useContext(ScannerContext);

  useEffect(() => {
    registerData(stocks);
  }, [stocks, registerData]);

  const runScan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, any> = { limit: 100 };
      if (freshness !== "all") params.freshness = freshness;
      if (distance !== "all") params.distance = distance;
      
      // Expected return filter
      if (minReturn !== "") {
        params.min_return = Number(minReturn);
      }

      // Holding period filter
      if (holdingPeriod !== "all") {
        params.holding_period = Number(holdingPeriod);
      }

      const res = await screenerService.getAlphaZone(params);
      if (res.data?.success) {
        setStocks(res.data.data);
      } else {
        setError(res.data?.error || "Failed to query SMC signals");
      }
    } catch (err: any) {
      setError(err?.message || "FastAPI connection failed");
    } finally {
      setLoading(false);
    }
  }, [freshness, distance, minReturn, holdingPeriod]);

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
      price: s.ltp
    });
    setIsModalOpen(true);
  };

  const filteredStocks = stocks.filter(s => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return s.symbol.toLowerCase().includes(q) || s.company_name.toLowerCase().includes(q);
  });

  const getScoreBadgeColor = (score: number) => {
    if (score >= 85) return "bg-blue-500/20 text-blue-300 border-blue-500/30";
    if (score >= 75) return "bg-sky-500/20 text-sky-300 border-sky-500/30";
    return "bg-cyan-500/20 text-cyan-300 border-cyan-500/30";
  };

  return (
    <div className="space-y-8">
      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/25 text-blue-400">
              <Shield size={12} />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Proprietary Strategy</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">🔷 Alpha Zone Institutional Scanner</h1>
          <p className="text-sm text-gray-400">
            Identifying institutional demand zones in fresh order blocks for premium medium-term swing investing.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-blue-950/20 border border-blue-500/20 rounded-2xl px-5 py-2.5 text-center min-w-[100px]">
            <div className="text-2xl font-black text-blue-400 font-mono">
              {loading ? "..." : filteredStocks.length}
            </div>
            <div className="text-gray-500 text-[10px] uppercase font-bold tracking-wider">Setups Found</div>
          </div>
        </div>
      </div>

      {/* ── Filters Panel ────────────────────────────────────────── */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-3xl p-6 backdrop-blur-xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          {/* Zone Freshness */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Zone Freshness</label>
            <select
              value={freshness}
              onChange={(e) => setFreshness(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-blue-500 transition-colors"
            >
              <option value="all">All Freshness</option>
              <option value="fresh">Fresh (Unmitigated)</option>
              <option value="retested">Retested Once</option>
            </select>
          </div>

          {/* Distance from Zone */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Distance from Zone</label>
            <select
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-blue-500 transition-colors"
            >
              <option value="all">All Distances</option>
              <option value="inside">Inside Zone (0%)</option>
              <option value="within_2">Within 2%</option>
              <option value="within_5">Within 5%</option>
            </select>
          </div>

          {/* Projected Return */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Projected Return</label>
            <select
              value={minReturn}
              onChange={(e) => setMinReturn(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-blue-500 transition-colors"
            >
              <option value="">Any Return</option>
              <option value="10">Min 10%</option>
              <option value="20">Min 20%</option>
              <option value="30">Min 30%</option>
              <option value="40">Min 40%+</option>
            </select>
          </div>

          {/* Holding Period */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Expected Holding</label>
            <select
              value={holdingPeriod}
              onChange={(e) => setHoldingPeriod(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-blue-500 transition-colors"
            >
              <option value="all">Any Holding</option>
              <option value="30">30 Days Target</option>
              <option value="60">60 Days Target</option>
              <option value="90">90 Days Target</option>
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
              className="w-full pl-10 pr-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-sm text-white placeholder-gray-550 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <button
            onClick={runScan}
            disabled={loading}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm px-8 py-2.5 rounded-xl transition-all shadow-md active:scale-98"
          >
            {loading ? "Scanning Institutional Blocks…" : "Apply Filters"}
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
      ) : filteredStocks.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center space-y-3 bg-gray-900/20 border border-gray-800/60 rounded-3xl">
          <Shield size={40} className="text-gray-650" />
          <p className="text-gray-400 font-semibold text-base">No Alpha Zone setups found</p>
          <p className="text-gray-600 text-xs max-w-sm">
            Try adjusting your zone distance or freshness filters to broaden your search parameters.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStocks.map((s) => (
            <div 
              key={s.symbol}
              className="group relative overflow-hidden rounded-3xl border border-gray-800 hover:border-blue-500/40 bg-gradient-to-b from-gray-900/40 to-gray-950/80 p-6 shadow-md transition-all duration-300 hover:scale-[1.01]"
            >
              <div className="absolute top-0 right-0 -z-10 h-24 w-24 rounded-full bg-blue-500/5 blur-2xl opacity-50" />
              
              {/* Header */}
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold text-white tracking-wide">{s.symbol}</h3>
                  <p className="text-xs text-gray-500 truncate max-w-[160px]">{s.company_name}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getScoreBadgeColor(s.institutional_score)}`}>
                    Score: {s.institutional_score}
                  </span>
                  <SignalBadge label={s.zone_strength} />
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="mt-5 grid grid-cols-3 gap-3 bg-gray-900/40 border border-gray-850 rounded-2xl p-4 text-xs">
                <div>
                  <span className="text-gray-500 text-[10px] block">Proj. Return</span>
                  <span className="font-bold text-blue-400 text-sm font-mono">+{s.projected_return}%</span>
                </div>
                <div>
                  <span className="text-gray-500 text-[10px] block">Hold ≈</span>
                  <span className="font-semibold text-gray-250 text-sm">{s.expected_holding}d</span>
                </div>
                <div>
                  <span className="text-gray-500 text-[10px] block">Zone</span>
                  <span className={`font-semibold text-sm ${s.zone_type === "Fresh" ? "text-emerald-400" : "text-sky-400"}`}>
                    {s.zone_type}
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
              />

              {/* Explainability panel */}
              <ExplainPanel
                rationale={buildAZRationale(s)}
                scores={s.score_breakdown}
                accent="blue"
                rows={[
                  { label: "Demand Zone", value: `₹${s.zone_low}–₹${s.zone_high}` },
                  { label: "Distance", value: s.distance_pct === 0 ? "Inside" : `${s.distance_pct}%` },
                  { label: "Zone Type", value: s.zone_type },
                  { label: "Strength", value: s.zone_strength },
                  { label: "Holding", value: s.holding_period },
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
                  href={`/ai-copilot?prompt=Analyze+the+Alpha+Zone+demand+setup+for+${s.symbol}+with+entry+trigger+at+${s.entry}+and+projected+return+of+${s.projected_return}%25.`}
                  className="flex items-center justify-center gap-1 text-[11px] font-bold bg-blue-600/10 border border-blue-500/20 text-blue-300 hover:bg-blue-600 hover:text-white px-2 py-2 rounded-xl transition-all text-center"
                >
                  <Sparkles size={11} /> AI Anal.
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Footer: glossary + FAQ ────────────────────────────────── */}
      <StrategyFooter terms={ALPHAZONE_TERMS} faqs={ALPHAZONE_FAQS} accent="blue" />

      {selectedStock && (
        <AddToWatchlistModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          symbol={selectedStock.symbol}
          companyName={selectedStock.company_name}
          sourceModule="Alpha Zone Scanner"
          currentPrice={selectedStock.price}
        />
      )}
    </div>
  );
}
