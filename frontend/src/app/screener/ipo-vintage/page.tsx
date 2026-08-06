"use client";

import React, { useState, useEffect, useCallback, useContext, useMemo } from "react";
import Link from "next/link";
import {
  Landmark, Search, AlertCircle, Bookmark, Sparkles,
  ExternalLink, Plus, TrendingUp, ChevronDown,
} from "lucide-react";
import { screenerService } from "@/services/screenerService";
import AddToWatchlistModal from "@/components/watchlists/AddToWatchlistModal";
import { ScannerContext } from "../context";
import { SignalBadge, ExplainPanel, StrategyFooter } from "@/components/screener/QuantLab";
import {
  FilterPanel,
  FilterSelect,
  RangeFilter,
  EMPTY_RANGE,
  isRangeActive,
  CONFIDENCE_PRESETS,
  type RangeValue,
} from "@/components/screener/filters";
import { IPO_VINTAGE_TERMS, IPO_VINTAGE_FAQS } from "@/lib/screener/quantContent";

const CONF_BOUNDS: [number, number] = [0, 100];
const RETURN_BOUNDS: [number, number] = [-30, 60];
const RISK_BOUNDS: [number, number] = [0, 40];

const HORIZONS = [7, 15, 30, 60, 90] as const;
const HORIZON_OPTIONS = HORIZONS.map((h) => ({ value: String(h), label: `${h} sessions` }));

const RISK_PRESETS = [
  { label: "≤ 8%", min: null, max: 8 },
  { label: "≤ 12%", min: null, max: 12 },
  { label: "≤ 20%", min: null, max: 20 },
];

/** Two completely separate views. "Live" is the opportunity list — setups whose
 *  trigger is recent enough to still act on. "Track record" is history only:
 *  stopped-out trades and triggers too old to enter. They are deliberately NOT
 *  a dropdown on one list, because mixing them is what made a months-old
 *  trigger look like a fresh opportunity. */
type View = "live" | "history";

const FRESHNESS_OPTIONS = [
  { value: "", label: "Any (within 30d)" },
  { value: "1", label: "Triggered today/yesterday" },
  { value: "3", label: "Within 3 sessions" },
  { value: "5", label: "Within 5 sessions" },
  { value: "10", label: "Within 10 sessions" },
];

const fmtPct = (v?: number | null, sign = true) =>
  v == null ? "—" : `${sign && v > 0 ? "+" : ""}${v}%`;

/** Risk is the number most likely to hurt someone sizing a position, so it is
 *  colour-scaled rather than rendered as plain text. */
const riskTone = (r?: number | null) => {
  if (r == null) return "text-gray-500";
  if (r <= 10) return "text-emerald-400";
  if (r <= 20) return "text-amber-400";
  return "text-red-400 font-bold";
};

const statusTone = (s?: string) =>
  s === "stopped" ? "bg-red-500/15 text-red-300 border-red-500/30"
    : s === "expired" ? "bg-gray-700/40 text-gray-400 border-gray-600/40"
      : "bg-teal-500/15 text-teal-300 border-teal-500/30";

/** Freshness of a live trigger — today reads strongest, fading toward the edge
 *  of the 30-session window. */
const freshTone = (d?: number | null) => {
  if (d == null) return "text-gray-500";
  if (d <= 1) return "text-emerald-400 font-bold";
  if (d <= 5) return "text-teal-300";
  if (d <= 15) return "text-gray-300";
  return "text-amber-400/80";
};

const freshLabel = (d?: number | null) =>
  d == null ? "—" : d === 0 ? "today" : d === 1 ? "1d ago" : `${d}d ago`;

const returnTone = (v?: number | null) =>
  v == null ? "text-gray-600" : v >= 0 ? "text-emerald-400" : "text-red-400";

function buildRationale(s: any): string {
  return (
    `${s.symbol} first traded on ${s.listing_date} with an opening range of ₹${s.opening_low}–₹${s.opening_high}. ` +
    `On ${s.trigger_date} it closed at ₹${s.entry}, clearing that opening high by ${s.breakout_strength_pct}% — the entry trigger. ` +
    `The stop sits at the opening low of ₹${s.stop_loss}, which is ${s.risk_pct}% below entry. ` +
    `There is no price target: the position exits at the stop, or on the clock at 7/15/30/60/90 sessions.`
  );
}

/** Sparkline-style equity curve rendered as an inline SVG polyline — no chart
 *  dependency, matching the codebase's no-new-UI-deps rule. */
function EquityCurve({ curve }: { curve: { equity: number }[] }) {
  const path = useMemo(() => {
    if (!curve || curve.length < 2) return null;
    const vals = curve.map((p) => p.equity);
    const min = Math.min(...vals), max = Math.max(...vals);
    const span = max - min || 1;
    const W = 100, H = 30;
    const pts = vals.map((v, i) => {
      const x = (i / (vals.length - 1)) * W;
      const y = H - ((v - min) / span) * H;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });
    return { d: pts.join(" "), min, max };
  }, [curve]);

  if (!path) return null;
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-24 w-full">
      <polyline points={path.d} fill="none" stroke="rgb(45 212 191)" strokeWidth="0.7" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function StudyPanel({ study }: { study: any }) {
  const [open, setOpen] = useState(false);
  if (!study) return null;
  const e = study.equity || {};
  const headline = study.by_horizon?.find((r: any) => r.horizon === study.headline_horizon);

  return (
    <div className="rounded-2xl border border-gray-800/80 bg-gray-900/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <TrendingUp size={14} className="text-teal-400 flex-shrink-0" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-300">
          Historical Study — {study.triggered} trades since {study.sample_start}
        </span>
        <ChevronDown size={14} className={`ml-auto text-gray-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-gray-800/60 p-4 space-y-5">
          {/* Headline row — every figure below is a historical outcome, not a forecast */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <span className="block text-[10px] uppercase text-gray-500">₹1,00,000 became</span>
              <span className="block font-mono text-lg font-bold text-white">
                ₹{Number(e.final_equity ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </span>
              <span className="block text-[10px] text-gray-600">
                {fmtPct(e.total_return_pct)} over the whole sample
              </span>
            </div>
            <div>
              <span className="block text-[10px] uppercase text-gray-500">Trades won</span>
              <span className="block font-mono text-lg font-bold text-white">{headline?.win_rate ?? "—"}%</span>
              <span className="block text-[10px] text-gray-600">{e.trades} trades @ {study.headline_horizon} sessions</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase text-gray-500">Median trade</span>
              <span className={`block font-mono text-lg font-bold ${returnTone(headline?.median_return_pct)}`}>
                {fmtPct(headline?.median_return_pct)}
              </span>
              <span className="block text-[10px] text-gray-600">mean {fmtPct(headline?.mean_return_pct)}</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase text-gray-500">Worst fall</span>
              <span className="block font-mono text-lg font-bold text-red-400">{e.max_drawdown_pct}%</span>
              <span className="block text-[10px] text-gray-600">from a previous high</span>
            </div>
          </div>

          {/* The single most important caveat — stated, not buried */}
          {headline && headline.median_return_pct != null && headline.median_return_pct < 0 && (
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 text-[11px] text-amber-200">
              The <strong>median trade loses money</strong> ({fmtPct(headline.median_return_pct)}) while the mean is
              positive ({fmtPct(headline.mean_return_pct)}) — the total above comes from a minority of large winners,
              not from the typical trade. Skipping signals would likely miss them.
            </div>
          )}

          <div>
            <span className="mb-1 block text-[10px] uppercase tracking-wider text-gray-500">
              Account value — ₹{Number(e.position_size ?? 0).toLocaleString("en-IN")} per trade, {e.slots} positions, no compounding
            </span>
            <EquityCurve curve={e.curve || []} />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-gray-500">
                  <th className="py-1 text-left font-medium">Hold</th>
                  <th className="py-1 text-right font-medium">Trades</th>
                  <th className="py-1 text-right font-medium">Won</th>
                  <th className="py-1 text-right font-medium">Median</th>
                  <th className="py-1 text-right font-medium">Mean</th>
                  <th className="py-1 text-right font-medium">Stopped</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {(study.by_horizon || []).map((r: any) => (
                  <tr key={r.horizon} className="border-t border-gray-850">
                    <td className="py-1 text-left text-gray-300">{r.horizon}d</td>
                    <td className="py-1 text-right text-gray-400">{r.trades}</td>
                    <td className="py-1 text-right text-gray-300">{r.win_rate}%</td>
                    <td className={`py-1 text-right ${returnTone(r.median_return_pct)}`}>{fmtPct(r.median_return_pct)}</td>
                    <td className={`py-1 text-right ${returnTone(r.mean_return_pct)}`}>{fmtPct(r.mean_return_pct)}</td>
                    <td className="py-1 text-right text-red-400/80">{r.stopped_pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Per-year rows ship WITH the headline on purpose — they are what show
              how much the aggregate moves depending on when you sample. */}
          <div>
            <span className="mb-1 block text-[10px] uppercase tracking-wider text-gray-500">
              By year (at {study.headline_horizon} sessions) — the aggregate is not stable
            </span>
            <div className="flex flex-wrap gap-2">
              {(study.per_year || []).map((y: any) => (
                <div key={y.year} className="rounded-lg border border-gray-800 bg-gray-950 px-2.5 py-1.5">
                  <span className="block text-[10px] text-gray-500">{y.year} · {y.trades}t</span>
                  <span className="block font-mono text-xs text-gray-300">
                    {y.win_rate}% won · <span className={returnTone(y.median_return_pct)}>{fmtPct(y.median_return_pct)}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <ul className="space-y-1 border-t border-gray-800/60 pt-3">
            {(study.caveats || []).map((c: string, i: number) => (
              <li key={i} className="text-[10px] leading-relaxed text-gray-500">• {c}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function IPOVintagePage() {
  const [stocks, setStocks] = useState<any[]>([]);
  const [study, setStudy] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheEmpty, setCacheEmpty] = useState(false);

  const [view, setView] = useState<View>("live");   // opportunity list by default
  const [historyStatus, setHistoryStatus] = useState("history");  // history | stopped | expired
  const [freshness, setFreshness] = useState("");   // max_days_since_trigger
  const [horizon, setHorizon] = useState("15");     // 15, not 7 — see the API docstring
  const [sortBy, setSortBy] = useState("days_since_trigger");
  const [conf, setConf] = useState<RangeValue>(EMPTY_RANGE);
  const [ret, setRet] = useState<RangeValue>(EMPTY_RANGE);
  const [risk, setRisk] = useState<RangeValue>(EMPTY_RANGE);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [liveCount, setLiveCount] = useState<number | null>(null);
  const [histCount, setHistCount] = useState<number | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState<any>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [addSymbol, setAddSymbol] = useState("");
  const [addCompany, setAddCompany] = useState("");
  const [addListingDate, setAddListingDate] = useState("");
  const [addIssuePrice, setAddIssuePrice] = useState("");
  const [adding, setAdding] = useState(false);
  const [addMsg, setAddMsg] = useState<string | null>(null);

  const { registerData, registerRefresh } = useContext(ScannerContext);

  useEffect(() => { registerData(stocks); }, [stocks, registerData]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await screenerService.getIpoVintageStudy();
        if (!cancelled && res.data?.success) setStudy(res.data.data);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  const runScan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, any> = {
        horizon: Number(horizon),
        // Status is driven by the view, never by a stray filter — the live list
        // must not be able to show a stale trigger.
        status: view === "live" ? "live" : historyStatus,
        sort_by: view === "live" ? sortBy : (sortBy === "days_since_trigger" ? "confidence" : sortBy),
      };
      if (view === "live" && freshness) params.max_days_since_trigger = Number(freshness);
      if (conf.min !== null) params.min_confidence = conf.min;
      if (conf.max !== null) params.max_confidence = conf.max;
      if (ret.min !== null) params.min_return = ret.min;
      if (ret.max !== null) params.max_return = ret.max;
      if (risk.max !== null) params.max_risk = risk.max;

      const res = await screenerService.getIpoVintage(params);
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
  }, [view, historyStatus, freshness, horizon, sortBy, conf, ret, risk]);

  // Bucket counts for the view toggle — one cheap call each on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [l, h] = await Promise.all([
          screenerService.getIpoVintage({ status: "live" }),
          screenerService.getIpoVintage({ status: "history" }),
        ]);
        if (cancelled) return;
        if (l.data?.success) setLiveCount(l.data.count);
        if (h.data?.success) setHistCount(h.data.count);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { runScan(); }, 350);
    return () => clearTimeout(t);
  }, [runScan]);

  useEffect(() => { registerRefresh(() => { runScan(); }); }, [registerRefresh, runScan]);

  const activeCount =
    (view === "live" && freshness ? 1 : 0) +
    (view === "history" && historyStatus !== "history" ? 1 : 0) +
    [conf, ret, risk].filter(isRangeActive).length;

  const resetFilters = () => {
    setFreshness(""); setHistoryStatus("history");
    setConf(EMPTY_RANGE); setRet(EMPTY_RANGE); setRisk(EMPTY_RANGE);
  };

  const handleOpenWatchlist = (s: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedStock({ symbol: s.symbol, company_name: s.company_name, price: s.cmp });
    setIsModalOpen(true);
  };

  const filtered = stocks.filter((s) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return s.symbol.toLowerCase().includes(q) || (s.company_name || "").toLowerCase().includes(q);
  });

  const handleAddListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addSymbol.trim() || !addListingDate) return;
    setAdding(true); setAddMsg(null);
    try {
      await screenerService.addIpoListing({
        symbol: addSymbol.trim().toUpperCase(),
        company_name: addCompany.trim() || undefined,
        listing_date: addListingDate,
        issue_price: addIssuePrice ? Number(addIssuePrice) : undefined,
      });
      setAddMsg(`Tracking ${addSymbol.trim().toUpperCase()} — it appears here after the next scan.`);
      setAddSymbol(""); setAddCompany(""); setAddListingDate(""); setAddIssuePrice("");
    } catch (err: any) {
      setAddMsg(err?.message || "Failed to add listing");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-teal-500/10 border border-teal-500/25 text-teal-400">
              <Landmark size={12} />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-teal-400">Proprietary Strategy</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">🏦 IPO Vintage</h1>
          <p className="text-sm text-gray-400 max-w-2xl">
            Opening-range breakout on recent listings. Entry is the first close above the opening candle's
            <strong className="text-gray-300"> high</strong>; the stop is that candle's
            <strong className="text-gray-300"> low</strong>; exits are fixed at 7/15/30/60/90 sessions.
          </p>
        </div>
        <div className="bg-teal-950/20 border border-teal-500/20 rounded-2xl px-5 py-2.5 text-center min-w-[100px]">
          <div className="text-2xl font-black text-teal-400 font-mono">{loading ? "..." : filtered.length}</div>
          <div className="text-gray-500 text-[10px] uppercase font-bold tracking-wider">
            {view === "live" ? "Live Setups" : "Past Trades"}
          </div>
        </div>
      </div>

      {/* ── View toggle: two ISOLATED lists, not a filter on one list ────── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="inline-flex rounded-xl border border-gray-800 bg-gray-900/60 p-1">
          <button
            type="button"
            onClick={() => { setView("live"); setSortBy("days_since_trigger"); setExpanded(null); }}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
              view === "live"
                ? "bg-teal-600 text-white shadow"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Live Setups{liveCount != null && ` (${liveCount})`}
          </button>
          <button
            type="button"
            onClick={() => { setView("history"); setSortBy("confidence"); setExpanded(null); }}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
              view === "history"
                ? "bg-gray-700 text-white shadow"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Track Record{histCount != null && ` (${histCount})`}
          </button>
        </div>
        <p className="text-[11px] text-gray-500 sm:ml-2">
          {view === "live"
            ? `Triggered within the last ${30} sessions and not stopped out — these are the only ones you could still act on.`
            : "Closed or stale trades kept strictly out of the live list: stopped out, or triggered too long ago to enter."}
        </p>
      </div>

      {/* ── Permanent honest framing — not dismissible. Figures come from the
          study itself so this note can never drift out of date. ─────────── */}
      <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.05] px-4 py-3 text-[11px] leading-relaxed text-amber-200/90">
        <strong className="text-amber-200">Historical breakout study, not a recommendation.</strong>{" "}
        Stops on this setup are wide — median risk to stop is
        {study?.median_risk_pct != null ? ` about ${study.median_risk_pct}%` : " typically over 10%"}.
        {study?.by_horizon?.length ? (
          <> Across {study.triggered} historical trades, win rate ran{" "}
            {Math.min(...study.by_horizon.map((r: any) => r.win_rate ?? 100))}–
            {Math.max(...study.by_horizon.map((r: any) => r.win_rate ?? 0))}% depending on holding period, and the
            median trade was negative at most horizons</>
        ) : (
          <> Backtested win rate ran roughly 29–50% depending on holding period</>
        )}
        {" "}— returns were concentrated in a small number of trades. Past IPO cycles were unusually strong;
        results may not persist.
      </div>

      {/* ── Historical study (the proof panel) ───────────────────── */}
      <StudyPanel study={study} />

      {/* ── Track a new listing (auto-discovery handles this normally) ── */}
      <div className="rounded-2xl border border-gray-800/80 bg-gray-900/40">
        <button
          type="button"
          onClick={() => setShowAddForm((v) => !v)}
          className="flex w-full items-center gap-2 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-300"
        >
          <Plus size={13} className="text-teal-400" /> Add / correct a listing
          <span className="ml-2 normal-case font-normal text-gray-600">
            listings are auto-detected from price history — use this only to override
          </span>
        </button>
        {showAddForm && (
          <form onSubmit={handleAddListing} className="border-t border-gray-800/60 p-3 flex flex-col sm:flex-row gap-2">
            <input type="text" placeholder="Symbol" value={addSymbol} onChange={(e) => setAddSymbol(e.target.value)}
              className="flex-1 rounded-lg border border-gray-800 bg-gray-950 py-2 px-3 text-sm text-white placeholder-gray-600 focus:border-teal-500 focus:outline-none" required />
            <input type="text" placeholder="Company (optional)" value={addCompany} onChange={(e) => setAddCompany(e.target.value)}
              className="flex-1 rounded-lg border border-gray-800 bg-gray-950 py-2 px-3 text-sm text-white placeholder-gray-600 focus:border-teal-500 focus:outline-none" />
            <input type="date" value={addListingDate} onChange={(e) => setAddListingDate(e.target.value)}
              className="rounded-lg border border-gray-800 bg-gray-950 py-2 px-3 text-sm text-white focus:border-teal-500 focus:outline-none" required />
            <input type="number" step="0.01" placeholder="Issue price" value={addIssuePrice} onChange={(e) => setAddIssuePrice(e.target.value)}
              className="w-full sm:w-36 rounded-lg border border-gray-800 bg-gray-950 py-2 px-3 text-sm text-white placeholder-gray-600 focus:border-teal-500 focus:outline-none" />
            <button type="submit" disabled={adding}
              className="rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-semibold text-sm px-5 py-2 transition-all disabled:opacity-50">
              {adding ? "Adding…" : "Save"}
            </button>
          </form>
        )}
        {addMsg && <p className="px-4 pb-3 text-xs text-teal-300">{addMsg}</p>}
      </div>

      {/* ── Filters ──────────────────────────────────────────────── */}
      <FilterPanel
        activeCount={activeCount}
        onReset={resetFilters}
        accent="cyan"
        columns={3}
        footer={
          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <div className="relative w-full sm:max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"><Search size={14} /></span>
              <input type="text" placeholder="Search symbol or company..." value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-800 bg-gray-950 py-2 pl-9 pr-3 text-sm text-white placeholder-gray-600 focus:border-teal-500 focus:outline-none" />
            </div>
            <button onClick={runScan} disabled={loading}
              className="w-full rounded-lg bg-teal-600 px-6 py-2 text-sm font-semibold text-white shadow-md transition-all hover:bg-teal-500 active:scale-98 sm:w-auto">
              {loading ? "Scanning…" : "Re-Run Scanner"}
            </button>
          </div>
        }
      >
        {view === "live" ? (
          <FilterSelect label="Triggered Within" value={freshness} onChange={setFreshness}
            defaultValue="" accent="cyan" options={FRESHNESS_OPTIONS} />
        ) : (
          <FilterSelect label="Outcome" value={historyStatus} onChange={setHistoryStatus}
            defaultValue="history" accent="cyan"
            options={[
              { value: "history", label: "All Past Trades" },
              { value: "stopped", label: "Stopped Out" },
              { value: "expired", label: "Ran Its Course" },
            ]} />
        )}

        <FilterSelect label="Hold Period" value={horizon} onChange={setHorizon} defaultValue="15"
          accent="cyan" options={HORIZON_OPTIONS} />

        <FilterSelect label="Sort By" value={sortBy} onChange={setSortBy}
          defaultValue={view === "live" ? "days_since_trigger" : "confidence"}
          accent="cyan"
          options={[
            ...(view === "live" ? [{ value: "days_since_trigger", label: "Freshest First" }] : []),
            { value: "confidence", label: "Confidence" },
            { value: "risk_pct", label: "Lowest Risk" },
            { value: "mfe_pct", label: "Best Run-Up" },
          ]} />

        <RangeFilter label="Max Risk to Stop" value={risk} onChange={setRisk}
          min={RISK_BOUNDS[0]} max={RISK_BOUNDS[1]} step={1} unit="%"
          presets={RISK_PRESETS} accent="cyan"
          description="Distance from entry to the opening-candle stop. Wide on new listings — the most useful filter here." />

        <RangeFilter label="Confidence" value={conf} onChange={setConf}
          min={CONF_BOUNDS[0]} max={CONF_BOUNDS[1]} step={1} unit="%"
          presets={CONFIDENCE_PRESETS} accent="cyan"
          description="Rule-based: risk quality 40%, breakout strength 35%, volume 25%. No ML." />

        <RangeFilter label={`Return @ ${horizon}d`} value={ret} onChange={setRet}
          min={RETURN_BOUNDS[0]} max={RETURN_BOUNDS[1]} step={1} unit="%"
          accent="cyan"
          description="Outcome at the selected hold period. Setups still pending at that horizon are excluded by this filter." />
      </FilterPanel>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-start gap-3 text-red-400 text-sm">
          <AlertCircle className="flex-shrink-0 mt-0.5" size={16} />
          <div><h4 className="font-semibold">Scanner Error</h4><p className="opacity-80 mt-0.5">{error}</p></div>
        </div>
      )}

      {/* ── Results table ─────────────────────────────────────────── */}
      {loading && filtered.length === 0 ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => <div key={i} className="h-11 rounded-lg bg-gray-900/40 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 && cacheEmpty ? (
        <div className="flex flex-col items-center py-20 text-center space-y-3 bg-gray-900/20 border border-gray-800/60 rounded-3xl">
          <Landmark size={40} className="text-gray-650" />
          <p className="text-gray-400 font-semibold text-base">No IPO Vintage setups yet</p>
          <p className="text-gray-600 text-xs max-w-sm">
            Listings are auto-detected from price history — run a full scan to populate this scanner.
          </p>
          <Link href="/screener" className="mt-2 inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-all">
            Go to Overview &amp; Run Full Scan
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center space-y-3 bg-gray-900/20 border border-gray-800/60 rounded-3xl">
          <Landmark size={40} className="text-gray-650" />
          {view === "live" ? (
            <>
              <p className="text-gray-400 font-semibold text-base">No live setups right now</p>
              <p className="text-gray-600 text-xs max-w-md">
                Nothing has broken above its opening-candle high in the last 30 sessions (or the ones that did
                have since stopped out). That is a normal state — new listings trigger in clusters. Past trades
                are in the Track Record tab.
              </p>
            </>
          ) : (
            <>
              <p className="text-gray-400 font-semibold text-base">No past trades match these filters</p>
              <p className="text-gray-600 text-xs max-w-sm">Try widening the risk or confidence range, or hit Reset.</p>
            </>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-800/80 bg-gray-900/30">
          <table className="w-full min-w-[900px] text-xs">
            <thead className="bg-gray-900/60 text-gray-500">
              <tr>
                <th className="px-3 py-2.5 text-left font-semibold">Symbol</th>
                <th className="px-3 py-2.5 text-left font-semibold">
                  {view === "live" ? "Triggered" : "Listed"}
                </th>
                <th className="px-3 py-2.5 text-right font-semibold">Entry</th>
                <th className="px-3 py-2.5 text-right font-semibold">Stop</th>
                <th className="px-3 py-2.5 text-right font-semibold">Risk %</th>
                <th className="px-3 py-2.5 text-right font-semibold">CMP</th>
                <th className="px-3 py-2.5 text-right font-semibold">
                  {view === "live" ? "Since Entry" : "Final"}
                </th>
                <th className="px-3 py-2.5 text-right font-semibold">@{horizon}d</th>
                <th className="px-3 py-2.5 text-right font-semibold">Max DD</th>
                <th className="px-3 py-2.5 text-right font-semibold">Conf.</th>
                <th className="px-3 py-2.5 text-center font-semibold">
                  {view === "live" ? "Window" : "Outcome"}
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <React.Fragment key={s.symbol}>
                  <tr
                    onClick={() => setExpanded(expanded === s.symbol ? null : s.symbol)}
                    className="cursor-pointer border-t border-gray-850 transition-colors hover:bg-gray-800/30"
                  >
                    <td className="px-3 py-2.5">
                      <span className="block font-bold text-white">{s.symbol}</span>
                      <span className="block max-w-[150px] truncate text-[10px] text-gray-500">{s.company_name}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      {view === "live" ? (
                        <>
                          <span className={`block font-mono ${freshTone(s.days_since_trigger)}`}>
                            {freshLabel(s.days_since_trigger)}
                          </span>
                          <span className="block text-[10px] text-gray-600">{s.trigger_date}</span>
                        </>
                      ) : (
                        <span className="text-gray-400">{s.listing_date}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-white">₹{s.entry}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-400">₹{s.stop_loss}</td>
                    <td className={`px-3 py-2.5 text-right font-mono ${riskTone(s.risk_pct)}`}>{s.risk_pct}%</td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-300">₹{s.cmp}</td>
                    <td className={`px-3 py-2.5 text-right font-mono ${returnTone(s.unrealized_return_pct)}`}>
                      {fmtPct(s.unrealized_return_pct)}
                    </td>
                    <td className={`px-3 py-2.5 text-right font-mono ${returnTone(s.selected_horizon_return_pct)}`}>
                      {s.selected_horizon_status === "pending"
                        ? <span className="text-gray-600">pending</span>
                        : fmtPct(s.selected_horizon_return_pct)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-red-400/80">{fmtPct(s.max_drawdown_pct, false)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-200">{s.confidence}</td>
                    <td className="px-3 py-2.5 text-center">
                      {view === "live" ? (
                        <span className="rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-[10px] font-semibold text-teal-300">
                          {s.sessions_left_in_window}d left
                        </span>
                      ) : (
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusTone(s.setup_status)}`}>
                          {s.setup_status === "expired" ? "ran its course" : s.setup_status}
                        </span>
                      )}
                    </td>
                  </tr>

                  {expanded === s.symbol && (
                    <tr className="border-t border-gray-850 bg-gray-950/60">
                      <td colSpan={11} className="px-4 py-4">
                        <div className="grid gap-4 lg:grid-cols-3">
                          <div className="lg:col-span-2 space-y-3">
                            <div>
                              <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-gray-600">
                                All Exit Horizons
                              </span>
                              <div className="grid grid-cols-5 gap-1.5">
                                {HORIZONS.map((h) => {
                                  const hz = s.horizons?.[`h${h}`];
                                  return (
                                    <div key={h} className="rounded-lg border border-gray-850 bg-gray-900/40 py-2 text-center">
                                      <span className="block text-[9px] uppercase text-gray-500">{h}d</span>
                                      {hz?.status === "pending" ? (
                                        <span className="block font-mono text-[11px] text-gray-600">{hz.days_remaining}d left</span>
                                      ) : (
                                        <span className={`block font-mono text-[11px] font-bold ${returnTone(hz?.return_pct)}`}>
                                          {fmtPct(hz?.return_pct)}
                                        </span>
                                      )}
                                      {hz?.status === "stopped" && (
                                        <span className="block text-[8px] uppercase text-red-400/70">stopped</span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-[11px]">
                              <div><span className="block text-gray-500">Opening High</span><span className="font-mono text-gray-200">₹{s.opening_high}</span></div>
                              <div><span className="block text-gray-500">Opening Low (stop)</span><span className="font-mono text-gray-200">₹{s.opening_low}</span></div>
                              <div><span className="block text-gray-500">Best run-up (MFE)</span><span className="font-mono text-emerald-400">{fmtPct(s.mfe_pct)}</span></div>
                              <div><span className="block text-gray-500">Worst dip (MAE)</span><span className="font-mono text-red-400">{fmtPct(s.mae_pct)}</span></div>
                              <div><span className="block text-gray-500">Trigger</span><span className="font-mono text-gray-200">{s.trigger_date}</span></div>
                              <div><span className="block text-gray-500">Sessions to entry</span><span className="font-mono text-gray-200">{s.entry_session}</span></div>
                              <div><span className="block text-gray-500">Breakout</span><span className="font-mono text-gray-200">{fmtPct(s.breakout_strength_pct)}</span></div>
                              <div><span className="block text-gray-500">Volume ratio</span><span className="font-mono text-gray-200">{s.volume_ratio != null ? `${s.volume_ratio}x` : "—"}</span></div>
                              {s.stop_hit && (
                                <div className="col-span-2"><span className="block text-gray-500">Stopped on</span>
                                  <span className="font-mono text-red-400">{s.stop_hit_date} (session {s.stop_hit_session})</span></div>
                              )}
                            </div>
                          </div>

                          <div className="space-y-3">
                            <ExplainPanel
                              rationale={buildRationale(s)}
                              scores={s.confidence_breakdown}
                              accent="blue"
                              rows={[
                                { label: "Signal", value: s.signal_strength },
                                { label: "Issue Price", value: s.issue_price != null ? `₹${s.issue_price}` : "—" },
                              ]}
                            />
                            <div className="grid grid-cols-3 gap-2">
                              <button onClick={(e) => { e.stopPropagation(); window.open(`https://in.tradingview.com/chart/?symbol=NSE:${s.symbol}`, "_blank"); }}
                                className="flex items-center justify-center gap-1 rounded-xl border border-gray-800 bg-gray-900 px-2 py-2 text-[11px] text-gray-400 transition-all hover:bg-gray-850 hover:text-white"
                                title="Open chart on TradingView">
                                <ExternalLink size={11} /> Chart
                              </button>
                              <button onClick={(e) => handleOpenWatchlist(s, e)}
                                className="flex items-center justify-center gap-1 rounded-xl border border-gray-800 bg-gray-900 px-2 py-2 text-[11px] text-gray-400 transition-all hover:bg-gray-850 hover:text-white">
                                <Bookmark size={11} /> +Watch
                              </button>
                              <Link href={`/ai-copilot?prompt=Analyze+the+IPO+Vintage+breakout+for+${s.symbol}%2C+entry+%E2%82%B9${s.entry}+stop+%E2%82%B9${s.stop_loss}+%28risk+${s.risk_pct}%25%29.`}
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center justify-center gap-1 rounded-xl border border-teal-500/20 bg-teal-600/10 px-2 py-2 text-[11px] font-bold text-teal-300 transition-all hover:bg-teal-600 hover:text-white">
                                <Sparkles size={11} /> AI
                              </Link>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <StrategyFooter terms={IPO_VINTAGE_TERMS} faqs={IPO_VINTAGE_FAQS} accent="blue" />

      {selectedStock && (
        <AddToWatchlistModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          symbol={selectedStock.symbol}
          companyName={selectedStock.company_name}
          sourceModule="IPO Vintage Scanner"
          currentPrice={selectedStock.price}
        />
      )}
    </div>
  );
}
