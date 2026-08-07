"use client";

import React, { useState, useEffect, useCallback, useContext } from "react";
import Link from "next/link";
import {
  Shield, Search, AlertCircle, Bookmark, Sparkles,
  ExternalLink, Layers, Award, Target, Loader2
} from "lucide-react";
import { screenerService } from "@/services/screenerService";
import AddToWatchlistModal from "@/components/watchlists/AddToWatchlistModal";
import { ScannerContext } from "../context";
import { SignalBadge, TradePlanStrip, ExplainPanel, StrategyFooter } from "@/components/screener/QuantLab";
import {
  FilterPanel,
  FilterSelect,
  RangeFilter,
  EMPTY_RANGE,
  isRangeActive,
  formatCompact,
  PRICE_PRESETS,
  VOLUME_PRESETS,
  type RangeValue,
} from "@/components/screener/filters";
import { ALPHAZONE_TERMS, ALPHAZONE_FAQS } from "@/lib/screener/quantContent";

// Slider bounds. A bound is only sent to the API when the user actually sets it
// — an empty box (null) means "no constraint", matching every scanner endpoint.
const PRICE_BOUNDS: [number, number] = [100, 5000];
const VOLUME_BOUNDS: [number, number] = [0, 10_000_000];

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
  const [cacheEmpty, setCacheEmpty] = useState(false);

  // Filters state
  const [freshness, setFreshness] = useState("all");
  const [distance, setDistance] = useState("all");
  const [minReturn, setMinReturn] = useState("");
  const [holdingPeriod, setHoldingPeriod] = useState("all");
  // Range filters — `null` on either side means that bound isn't sent.
  const [price, setPrice] = useState<RangeValue>(EMPTY_RANGE);
  const [vol, setVol] = useState<RangeValue>(EMPTY_RANGE);
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
      // No limit — show every setup the backend actually returns.
      const params: Record<string, any> = {};
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

      if (price.min !== null) params.price_min = price.min;
      if (price.max !== null) params.price_max = price.max;

      if (vol.min !== null) params.min_avg_volume = vol.min;
      if (vol.max !== null) params.max_avg_volume = vol.max;

      const res = await screenerService.getAlphaZone(params);

      if (res.data?.success) {
        setStocks(res.data.data);
        setCacheEmpty(!!res.data.cache_empty);
      } else {
        setError(res.data?.error || "Failed to query SMC signals");
      }
    } catch (err: any) {
      setError(err?.message || "FastAPI connection failed");
    } finally {
      setLoading(false);
    }
  }, [freshness, distance, minReturn, holdingPeriod, price, vol]);

  // Debounced apply: dragging a range slider updates the readout instantly, but
  // the API is only queried once the user pauses. Before this page had sliders a
  // bare runScan() was fine — a select fires once — but a drag would otherwise
  // issue a request per pixel.
  useEffect(() => {
    const t = setTimeout(() => { runScan(); }, 350);
    return () => clearTimeout(t);
  }, [runScan]);

  useEffect(() => {
    registerRefresh(() => { runScan(); });
  }, [registerRefresh, runScan]);

  const activeCount =
    (freshness !== "all" ? 1 : 0) +
    (distance !== "all" ? 1 : 0) +
    (minReturn !== "" ? 1 : 0) +
    (holdingPeriod !== "all" ? 1 : 0) +
    [price, vol].filter(isRangeActive).length;

  const resetFilters = () => {
    setFreshness("all");
    setDistance("all");
    setMinReturn("");
    setHoldingPeriod("all");
    setPrice(EMPTY_RANGE);
    setVol(EMPTY_RANGE);
  };

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
    if (score >= 85) return "bg-cyan-500/20 text-cyan-300 border-cyan-500/30";
    if (score >= 75) return "bg-sky-500/20 text-sky-300 border-sky-500/30";
    return "bg-teal-500/20 text-teal-300 border-teal-500/30";
  };

  return (
    <div className="space-y-8">
      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/25 text-cyan-400">
              <Shield size={12} />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">Proprietary Strategy</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">🔷 Alpha Zone Institutional Scanner</h1>
          <p className="text-sm text-gray-400">
            Identifying institutional demand zones in fresh order blocks for premium medium-term swing investing.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-cyan-950/20 border border-cyan-500/20 rounded-2xl px-5 py-2.5 text-center min-w-[100px]">
            <div className="text-2xl font-black text-cyan-400 font-mono">
              {loading ? "..." : filteredStocks.length}
            </div>
            <div className="text-gray-500 text-[10px] uppercase font-bold tracking-wider">Stocks Found</div>
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

      {/* ── Filters ──────────────────────────────────────────────── */}
      <FilterPanel
        activeCount={activeCount}
        onReset={resetFilters}
        accent="cyan"
        columns={3}
        footer={
          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <div className="relative w-full sm:max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                <Search size={14} />
              </span>
              <input
                type="text"
                placeholder="Search symbol or company..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-800 bg-gray-950 py-2 pl-9 pr-3 text-sm text-white placeholder-gray-600 transition-colors focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <button
              onClick={runScan}
              disabled={loading}
              className="w-full rounded-lg bg-cyan-600 px-6 py-2 text-sm font-semibold text-white shadow-md transition-all hover:bg-cyan-500 active:scale-98 sm:w-auto"
            >
              {loading ? "Scanning Institutional Blocks…" : "Apply Filters"}
            </button>
          </div>
        }
      >
        <FilterSelect
          label="Zone Freshness"
          value={freshness}
          onChange={setFreshness}
          accent="cyan"
          options={[
            { value: "all", label: "All Freshness" },
            { value: "fresh", label: "Fresh (Unmitigated)" },
            { value: "retested", label: "Retested Once" },
          ]}
        />

        <FilterSelect
          label="Distance from Zone"
          value={distance}
          onChange={setDistance}
          accent="cyan"
          options={[
            { value: "all", label: "All Distances" },
            { value: "inside", label: "Inside Zone (0%)" },
            { value: "within_2", label: "Within 2%" },
            { value: "within_5", label: "Within 5%" },
          ]}
        />

        {/* Projected return is a floor only — this endpoint exposes min_return
            with no upper bound, so the filter stays single-ended. */}
        <RangeFilter
          label="Projected Return"
          description="Minimum projected return for the setup."
          value={{ min: minReturn === "" ? null : Number(minReturn), max: null }}
          onChange={(n) => setMinReturn(n.min === null ? "" : String(n.min))}
          min={0}
          max={100}
          step={1}
          unit="%"
          singleEnded
          accent="cyan"
          presets={[
            { label: "10%+", min: 10, max: null },
            { label: "20%+", min: 20, max: null },
            { label: "30%+", min: 30, max: null },
          ]}
        />

        <FilterSelect
          label="Expected Holding"
          value={holdingPeriod}
          onChange={setHoldingPeriod}
          accent="cyan"
          options={[
            { value: "all", label: "Any Holding" },
            { value: "30", label: "30 Days Target" },
            { value: "60", label: "60 Days Target" },
            { value: "90", label: "90 Days Target" },
          ]}
        />

        <RangeFilter
          label="Price"
          value={price}
          onChange={setPrice}
          min={PRICE_BOUNDS[0]}
          max={PRICE_BOUNDS[1]}
          step={10}
          unit="₹"
          unitPosition="prefix"
          format={(v) => `₹${v.toLocaleString("en-IN")}`}
          presets={PRICE_PRESETS}
          accent="cyan"
          description="Last traded price of the stock."
        />

        <RangeFilter
          label="Avg Volume"
          value={vol}
          onChange={setVol}
          min={VOLUME_BOUNDS[0]}
          max={VOLUME_BOUNDS[1]}
          step={10_000}
          format={formatCompact}
          presets={VOLUME_PRESETS}
          accent="cyan"
          description="20-day average traded volume (liquidity)."
        />
      </FilterPanel>

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
          <Shield size={40} className="text-gray-650" />
          <p className="text-gray-400 font-semibold text-base">No scan yet</p>
          <p className="text-gray-600 text-xs max-w-sm">
            Alpha Zone setups are built by a full scan — run one to see results here.
          </p>
          <Link
            href="/screener"
            className="mt-2 inline-flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-all"
          >
            Go to Overview &amp; Run Full Scan
          </Link>
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
              className="group relative overflow-hidden rounded-3xl border border-gray-800 hover:border-cyan-500/40 bg-gradient-to-b from-gray-900/40 to-gray-950/80 p-6 shadow-md transition-all duration-300 hover:scale-[1.01]"
            >
              <div className="absolute top-0 right-0 -z-10 h-24 w-24 rounded-full bg-cyan-500/5 blur-2xl opacity-50" />
              
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
                  <span className="font-bold text-cyan-400 text-sm font-mono">+{s.projected_return}%</span>
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
                accent="cyan"
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
                  className="flex items-center justify-center gap-1 text-[11px] font-bold bg-cyan-600/10 border border-cyan-500/20 text-cyan-300 hover:bg-cyan-600 hover:text-white px-2 py-2 rounded-xl transition-all text-center"
                >
                  <Sparkles size={11} /> AI Anal.
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Footer: glossary + FAQ ────────────────────────────────── */}
      <StrategyFooter terms={ALPHAZONE_TERMS} faqs={ALPHAZONE_FAQS} accent="cyan" />

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
