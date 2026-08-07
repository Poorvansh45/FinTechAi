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
import {
  FilterPanel,
  FilterSelect,
  RangeFilter,
  EMPTY_RANGE,
  isRangeActive,
  formatCompact,
  PRICE_PRESETS,
  RETURN_PRESETS,
  VOLUME_PRESETS,
  type RangeValue,
} from "@/components/screener/filters";
import { LAUNCHPAD_TERMS, LAUNCHPAD_FAQS } from "@/lib/screener/quantContent";

// Slider bounds. A bound is only sent to the API when the user actually sets
// it — an empty box (null) means "no constraint", exactly as before.
const PRICE_BOUNDS: [number, number] = [100, 5000];
const RETURN_BOUNDS: [number, number] = [0, 50];
const VOLUME_BOUNDS: [number, number] = [0, 10_000_000];
const GAP_BOUNDS: [number, number] = [0, 10];

const FVG_PRESETS = [
  { label: "2–3%", min: 2, max: 3 },
  { label: "3–5%", min: 3, max: 5 },
  { label: "5–7%", min: 5, max: 7 },
];

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

const formatVolume = (v?: number | null): string =>
  v == null || !isFinite(v) ? "—" : formatCompact(v);

export default function LaunchPadPage() {
  const [stocks, setStocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheEmpty, setCacheEmpty] = useState(false);

  // Filters state
  const [market, setMarket] = useState("all");
  // Range filters — `null` on either side means that bound isn't sent.
  const [price, setPrice] = useState<RangeValue>(EMPTY_RANGE);
  const [ret, setRet] = useState<RangeValue>(EMPTY_RANGE);
  const [vol, setVol] = useState<RangeValue>(EMPTY_RANGE);
  const [gap, setGap] = useState<RangeValue>(EMPTY_RANGE);
  // Risk is a derived label on each result (not a query param), so it filters
  // client-side — safe now that the endpoint returns the full result set.
  const [risk, setRisk] = useState("all");
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
      // No limit — show every setup the backend actually returns. Each band
      // only sends a bound when the user has actually moved that thumb off its
      // extreme, so an untouched slider means "no constraint".
      const params: Record<string, any> = {};
      if (market !== "all") params.market = market;

      if (price.min !== null) params.price_min = price.min;
      if (price.max !== null) params.price_max = price.max;

      if (ret.min !== null) params.min_return = ret.min;
      if (ret.max !== null) params.max_return = ret.max;

      if (vol.min !== null) params.min_avg_volume = vol.min;
      if (vol.max !== null) params.max_avg_volume = vol.max;

      if (gap.min !== null) params.gap_min = gap.min;
      if (gap.max !== null) params.gap_max = gap.max;

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
  }, [market, price, ret, vol, gap]);

  // Debounced apply: dragging a range meter updates the readout instantly, but
  // the API is only queried once the user pauses — otherwise every pixel of a
  // drag would fire a request.
  useEffect(() => {
    const t = setTimeout(() => { runScan(); }, 350);
    return () => clearTimeout(t);
  }, [runScan]);

  useEffect(() => {
    registerRefresh(() => { runScan(); });
  }, [registerRefresh, runScan]);

  const activeCount =
    (market !== "all" ? 1 : 0) +
    (risk !== "all" ? 1 : 0) +
    [price, ret, vol, gap].filter(isRangeActive).length;

  const resetFilters = () => {
    setMarket("all");
    setRisk("all");
    setPrice(EMPTY_RANGE);
    setRet(EMPTY_RANGE);
    setVol(EMPTY_RANGE);
    setGap(EMPTY_RANGE);
  };

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
    if (risk !== "all" && s.risk !== risk) return false;
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return s.symbol.toLowerCase().includes(q) || s.company_name.toLowerCase().includes(q);
  });

  const getConfidenceBadgeColor = (conf: number) => {
    if (conf >= 90) return "bg-blue-500/20 text-blue-300 border-blue-500/30";
    if (conf >= 80) return "bg-sky-500/20 text-sky-300 border-sky-500/30";
    return "bg-cyan-500/20 text-cyan-300 border-cyan-500/30";
  };

  return (
    <div className="space-y-8">
      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/25 text-blue-400">
              <Rocket size={12} />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Proprietary Strategy</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">🚀 LaunchPad Swing Scanner</h1>
          <p className="text-sm text-gray-400">
            Scanning for high-probability momentum breakout setups using FVG overlaps with the 200 EMA support.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-blue-950/20 border border-blue-500/20 rounded-2xl px-5 py-2.5 text-center min-w-[100px]">
            <div className="text-2xl font-black text-blue-400 font-mono">
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
        accent="blue"
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
                className="w-full rounded-lg border border-gray-800 bg-gray-950 py-2 pl-9 pr-3 text-sm text-white placeholder-gray-600 transition-colors focus:border-blue-500 focus:outline-none"
              />
            </div>
            <button
              onClick={runScan}
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow-md transition-all hover:bg-blue-500 active:scale-98 sm:w-auto"
            >
              {loading ? "Scanning Universe…" : "Re-Run Scanner"}
            </button>
          </div>
        }
      >
        <FilterSelect
          label="Market Index"
          value={market}
          onChange={setMarket}
          accent="blue"
          options={[
            { value: "all", label: "All NSE Stocks" },
            { value: "nifty50", label: "Nifty 50" },
            { value: "nifty_next50", label: "Nifty Next 50" },
            { value: "nifty200", label: "Nifty 200 Universe" },
          ]}
        />

        <FilterSelect
          label="Risk"
          value={risk}
          onChange={setRisk}
          accent="blue"
          options={[
            { value: "all", label: "Any Risk" },
            { value: "Low", label: "Low" },
            { value: "Medium", label: "Medium" },
            { value: "High", label: "High" },
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
          accent="blue"
          description="Current market price."
        />

        <RangeFilter
          label="Expected Return"
          value={ret}
          onChange={setRet}
          min={RETURN_BOUNDS[0]}
          max={RETURN_BOUNDS[1]}
          step={1}
          unit="%"
          presets={RETURN_PRESETS}
          accent="blue"
          description="Target return implied by the trade plan."
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
          accent="blue"
          description="20-day average traded volume (liquidity)."
        />

        <RangeFilter
          label="FVG Zone Size"
          value={gap}
          onChange={setGap}
          min={GAP_BOUNDS[0]}
          max={GAP_BOUNDS[1]}
          step={0.5}
          unit="%"
          presets={FVG_PRESETS}
          accent="blue"
          description="Gap height as % of the FVG floor. LaunchPad caps gaps at 10%."
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
          <Rocket size={40} className="text-gray-650" />
          <p className="text-gray-400 font-semibold text-base">No scan yet</p>
          <p className="text-gray-600 text-xs max-w-sm">
            LaunchPad setups are built by a full scan — run one to see results here.
          </p>
          <Link
            href="/screener"
            className="mt-2 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-all"
          >
            Go to Overview &amp; Run Full Scan
          </Link>
        </div>
      ) : filteredStocks.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center space-y-3 bg-gray-900/20 border border-gray-800/60 rounded-3xl">
          <Rocket size={40} className="text-gray-650" />
          <p className="text-gray-400 font-semibold text-base">No LaunchPad setups found</p>
          <p className="text-gray-600 text-xs max-w-sm">
            No setups fall inside these ranges — try widening a slider (or hit Reset to clear them all).
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
                  <span className="font-bold text-blue-400 text-sm font-mono">+{s.expected_return}%</span>
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

              {/* Historical bullish-FVG track record for THIS stock: how often
                  its past FVGs continued up, and the avg win vs avg loss. */}
              {s.fvg_sample > 0 && (
                <div className="mt-4 rounded-2xl border border-blue-500/15 bg-blue-500/[0.04] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300">
                      FVG Track Record
                    </span>
                    <span className="text-[10px] text-gray-500" title="Historical bullish FVGs tested">
                      {s.fvg_sample} past gap{s.fvg_sample === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <span className="block font-mono text-sm font-bold text-white">
                        {s.fvg_win_rate ?? "—"}%
                      </span>
                      <span className="text-[9px] uppercase text-gray-500">Win Rate</span>
                    </div>
                    <div>
                      <span className="block font-mono text-sm font-bold text-emerald-400">
                        {s.fvg_avg_win != null ? `+${s.fvg_avg_win}%` : "—"}
                      </span>
                      <span className="text-[9px] uppercase text-gray-500">Avg Win</span>
                    </div>
                    <div>
                      <span className="block font-mono text-sm font-bold text-red-400">
                        {s.fvg_avg_loss != null ? `${s.fvg_avg_loss}%` : "—"}
                      </span>
                      <span className="text-[9px] uppercase text-gray-500">Avg Loss</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Explainability panel */}
              <ExplainPanel
                rationale={buildRationale(s)}
                scores={s.confidence_breakdown}
                accent="blue"
                rows={[
                  { label: "FVG Zone", value: `₹${s.fvg_low}–₹${s.fvg_high}` },
                  { label: "Gap %", value: `${s.gap_pct}%` },
                  { label: "FVG Age", value: `${s.days_since_formation}d` },
                  { label: "vs EMA200", value: `${s.ema_200_dist_pct ?? s.ema_200_dist}%` },
                  { label: "Avg Vol", value: formatVolume(s.avg_volume) },
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
      <StrategyFooter terms={LAUNCHPAD_TERMS} faqs={LAUNCHPAD_FAQS} accent="blue" />

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
