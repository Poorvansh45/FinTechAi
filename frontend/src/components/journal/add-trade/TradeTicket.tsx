"use client";

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileClock,
  Gauge,
  Plus,
  Save,
  Search,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTradeCapture } from "@/hooks/use-trade-capture";
import { cn } from "@/lib/utils";
import {
  formatDuration,
  formatMoney,
} from "@/services/trade-capture-calculations";
import type { Setup } from "@/lib/journal/types";
import type {
  ExitMetrics,
  ExitStatus,
  HtfBias,
  TradeCaptureData,
  TradeCaptureValidation,
  TradeRiskSnapshot,
  TradeSetupTag,
  TradeTimeframe,
} from "@/types/trade-capture";

// ─── SYMBOL CATALOGUE ─────────────────────────────────────────────────────────
type SymbolEntry = { symbol: string; label: string; category: string };

const SYMBOL_CATALOGUE: SymbolEntry[] = [
  // Forex
  { symbol: "XAUUSD", label: "Gold", category: "Forex" },
  { symbol: "EURUSD", label: "EUR/USD", category: "Forex" },
  { symbol: "GBPUSD", label: "GBP/USD", category: "Forex" },
  { symbol: "USDJPY", label: "USD/JPY", category: "Forex" },
  { symbol: "AUDUSD", label: "AUD/USD", category: "Forex" },
  { symbol: "USDCHF", label: "USD/CHF", category: "Forex" },
  { symbol: "NZDUSD", label: "NZD/USD", category: "Forex" },
  { symbol: "XAGUSD", label: "Silver", category: "Forex" },
  // Crypto
  { symbol: "BTCUSD", label: "Bitcoin", category: "Crypto" },
  { symbol: "ETHUSD", label: "Ethereum", category: "Crypto" },
  { symbol: "SOLUSD", label: "Solana", category: "Crypto" },
  { symbol: "BNBUSD", label: "BNB", category: "Crypto" },
  // Indices
  { symbol: "NIFTY", label: "Nifty 50", category: "Indices" },
  { symbol: "BANKNIFTY", label: "Bank Nifty", category: "Indices" },
  { symbol: "SPX500", label: "S&P 500", category: "Indices" },
  { symbol: "NAS100", label: "Nasdaq 100", category: "Indices" },
  { symbol: "DJI30", label: "Dow Jones", category: "Indices" },
  // Stocks
  { symbol: "RELIANCE", label: "Reliance Ind.", category: "Stocks" },
  { symbol: "TCS", label: "TCS", category: "Stocks" },
  { symbol: "INFY", label: "Infosys", category: "Stocks" },
  { symbol: "AAPL", label: "Apple", category: "Stocks" },
  { symbol: "MSFT", label: "Microsoft", category: "Stocks" },
  { symbol: "TSLA", label: "Tesla", category: "Stocks" },
];

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const SETUP_OPTIONS: readonly TradeSetupTag[] = [
  "Liquidity Sweep", "FVG", "Order Block", "Break of Structure",
  "Demand Zone", "Supply Zone", "Breakout", "Reversal",
];
const HTF_BIAS: readonly HtfBias[] = ["Bullish", "Bearish", "Neutral", "Ranging"];
const SESSIONS = ["London", "NY", "Asian"] as const;
const TIMEFRAMES: readonly TradeTimeframe[] = ["1m", "3m", "5m", "15m", "30m", "1h", "4h", "1D"];
const QUICK_TAGS = ["FVG", "Liquidity", "NY Open", "Trend", "Countertrend", "News Risk", "Scalp", "Swing"];
const EXIT_STATUSES: readonly ExitStatus[] = ["Open", "Closed", "Breakeven"];

// ─── SEARCHABLE SYMBOL COMBOBOX ───────────────────────────────────────────────
function SymbolCombobox({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter catalogue
  const filtered = useMemo(() => {
    if (!query.trim()) return SYMBOL_CATALOGUE;
    const q = query.trim().toUpperCase();
    return SYMBOL_CATALOGUE.filter(
      (s) => s.symbol.includes(q) || s.label.toUpperCase().includes(q) || s.category.toUpperCase().includes(q)
    );
  }, [query]);

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, SymbolEntry[]>();
    for (const entry of filtered) {
      const group = map.get(entry.category) ?? [];
      group.push(entry);
      map.set(entry.category, group);
    }
    return map;
  }, [filtered]);

  // Flat list for keyboard nav
  const flatList = useMemo(() => filtered, [filtered]);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selectSymbol = (symbol: string) => {
    onChange(symbol);
    setQuery(symbol);
    setOpen(false);
    setHighlightIdx(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open && e.key === "ArrowDown") {
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, flatList.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightIdx >= 0 && highlightIdx < flatList.length) {
        selectSymbol(flatList[highlightIdx].symbol);
      } else if (query.trim()) {
        selectSymbol(query.trim().toUpperCase());
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="symbol-combobox">
      <div className="symbol-input-wrap">
        <Search className="symbol-search-icon" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value.toUpperCase());
            onChange(e.target.value.toUpperCase());
            setOpen(true);
            setHighlightIdx(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search XAUUSD, BTCUSD, NIFTY…"
          className="symbol-input"
          autoComplete="off"
          spellCheck={false}
          autoFocus
        />
      </div>

      {open && flatList.length > 0 && (
        <div className="symbol-dropdown">
          {Array.from(grouped.entries()).map(([category, items]) => (
            <div key={category}>
              <div className="symbol-cat-header">{category}</div>
              {items.map((item) => {
                const idx = flatList.indexOf(item);
                return (
                  <button
                    key={item.symbol}
                    type="button"
                    onClick={() => selectSymbol(item.symbol)}
                    className={cn(
                      "symbol-option",
                      idx === highlightIdx && "symbol-option-hl",
                      value === item.symbol && "symbol-option-active"
                    )}
                  >
                    <span className="symbol-option-ticker">{item.symbol}</span>
                    <span className="symbol-option-label">{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── CONFIDENCE SLIDER ────────────────────────────────────────────────────────
function ConfidenceSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const label =
    value <= 3 ? "Low Confidence" :
    value <= 6 ? "Medium Confidence" :
    value <= 8 ? "High Confidence" :
    "High Conviction";
  const color =
    value <= 3 ? "#ef4444" :
    value <= 6 ? "#f59e0b" :
    value <= 8 ? "#22c55e" :
    "#818cf8";
  const pct = ((value - 1) / 9) * 100;

  return (
    <div className="confidence-wrap">
      <div className="confidence-top">
        <span className="confidence-label" style={{ color }}>{label}</span>
        <span className="confidence-value" style={{ color }}>{value}/10</span>
      </div>
      <div className="confidence-track-wrap">
        <div className="confidence-track">
          <div className="confidence-fill" style={{ width: `${pct}%`, background: color }} />
        </div>
        <input
          type="range"
          min={1}
          max={10}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="confidence-range"
        />
      </div>
    </div>
  );
}

// ─── FIELD PRIMITIVES ─────────────────────────────────────────────────────────
function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <span className="tt-field-label">
      {label}
      {required && <span className="tt-required">*</span>}
    </span>
  );
}

function Field({
  label,
  required,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("tt-field", className)}>
      <FieldLabel label={label} required={required} />
      {children}
    </div>
  );
}

function NumInput({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <input
      type="number" min="0" step="any" inputMode="decimal"
      value={value} onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? "0.00"} className="tt-input tt-mono"
    />
  );
}

function PillGroup<T extends string>({ options, value, onChange }: {
  options: readonly T[]; value: T | ""; onChange: (v: T) => void;
}) {
  return (
    <div className="tt-pill-row">
      {options.map((opt) => (
        <button key={opt} type="button" onClick={() => onChange(opt)}
          className={cn("tt-pill", value === opt ? "tt-pill-on" : "tt-pill-off")}>
          {opt}
        </button>
      ))}
    </div>
  );
}

function SelectField<T extends string>({ value, onChange, options, placeholder }: {
  value: T | ""; onChange: (v: T) => void;
  options: readonly { label: string; value: T }[]; placeholder?: string;
}) {
  return (
    <div className="tt-select-wrap">
      <select value={value} onChange={(e) => onChange(e.target.value as T)} className="tt-select">
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="tt-select-chevron" />
    </div>
  );
}

// ─── KPI METRIC CARD ──────────────────────────────────────────────────────────
function KpiMetric({
  label,
  value,
  icon: Icon,
  color,
  subtext,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
  subtext?: string;
}) {
  return (
    <div className="kpi-card px-3 py-2.5 flex flex-col gap-0.5 group relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: `linear-gradient(90deg, transparent, ${color}88, transparent)` }} />
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</span>
        <Icon className="w-3 h-3" style={{ color }} />
      </div>
      <span className="text-base font-black tabular-nums leading-none font-mono" style={{ color }}>
        {value}
      </span>
      {subtext && <span className="text-[9px] text-slate-600">{subtext}</span>}
    </div>
  );
}

// ─── WARNING STRIP ────────────────────────────────────────────────────────────
function WarningStrip({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <div className="tt-warning-strip">
      <ShieldAlert className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {warnings.map((w) => (
          <span key={w} className="tt-warning-text">
            <AlertTriangle className="w-2.5 h-2.5" /> {w}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── SECTION 1: TRADE DETAILS ─────────────────────────────────────────────────
function TradeDetailsSection({
  data,
  updateField,
}: {
  data: TradeCaptureData;
  updateField: <K extends keyof TradeCaptureData>(key: K, value: TradeCaptureData[K]) => void;
}) {
  return (
    <div className="glass-card tt-section">
      <div className="tt-section-header">
        <h2 className="tt-section-title">
          <Zap className="w-3.5 h-3.5 text-indigo-400" />
          Trade Details
        </h2>
      </div>
      <div className="tt-section-body">
        {/* Symbol */}
        <Field label="Symbol" required>
          <SymbolCombobox value={data.symbol} onChange={(v) => updateField("symbol", v)} />
        </Field>

        {/* Direction */}
        <Field label="Direction" required>
          <div className="grid grid-cols-2 gap-1.5">
            <button type="button" onClick={() => updateField("direction", "Buy")}
              className={cn("tt-dir-btn", data.direction === "Buy" ? "tt-dir-buy" : "tt-dir-off")}>
              <ArrowUp className="w-3.5 h-3.5" /> BUY / LONG
            </button>
            <button type="button" onClick={() => updateField("direction", "Sell")}
              className={cn("tt-dir-btn", data.direction === "Sell" ? "tt-dir-sell" : "tt-dir-off")}>
              <ArrowDown className="w-3.5 h-3.5" /> SELL / SHORT
            </button>
          </div>
        </Field>

        {/* Price grid */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <Field label="Entry Price" required>
            <NumInput value={data.entryPrice} onChange={(v) => updateField("entryPrice", v)} />
          </Field>
          <Field label="Stop Loss" required>
            <NumInput value={data.stopLoss} onChange={(v) => updateField("stopLoss", v)} />
          </Field>
          <Field label="Take Profit" required>
            <NumInput value={data.takeProfit} onChange={(v) => updateField("takeProfit", v)} />
          </Field>
          <Field label="Position Size" required>
            <NumInput value={data.positionSize} onChange={(v) => updateField("positionSize", v)} />
          </Field>
        </div>

        {/* Confidence */}
        <Field label="Confidence">
          <ConfidenceSlider value={data.confidence} onChange={(v) => updateField("confidence", v)} />
        </Field>
      </div>
    </div>
  );
}

// ─── SECTION 2: EXIT DETAILS ──────────────────────────────────────────────────
function ExitDetailsSection({
  data,
  exitMetrics,
  risk,
  updateField,
}: {
  data: TradeCaptureData;
  exitMetrics: ExitMetrics;
  risk: TradeRiskSnapshot;
  updateField: <K extends keyof TradeCaptureData>(key: K, value: TradeCaptureData[K]) => void;
}) {
  const pnl = exitMetrics.pnl;
  const pnlPositive = pnl != null && pnl >= 0;

  return (
    <div className="glass-card tt-section">
      <div className="tt-section-header">
        <h2 className="tt-section-title">
          <Clock className="w-3.5 h-3.5 text-violet-400" />
          Exit Details
        </h2>
        <span className={cn(
          "tt-status-badge",
          data.exitStatus === "Closed" ? "tt-status-closed" :
          data.exitStatus === "Breakeven" ? "tt-status-be" :
          "tt-status-open"
        )}>
          {data.exitStatus}
        </span>
      </div>
      <div className="tt-section-body">
        {/* Exit Price */}
        <Field label="Exit Price">
          <NumInput value={data.exitPrice} onChange={(v) => updateField("exitPrice", v)} />
        </Field>

        {/* Date + Time */}
        <div className="grid grid-cols-2 gap-x-3">
          <Field label="Exit Date">
            <input type="date" value={data.exitDate}
              onChange={(e) => updateField("exitDate", e.target.value)}
              className="tt-input" />
          </Field>
          <Field label="Exit Time">
            <input type="time" value={data.exitTime}
              onChange={(e) => updateField("exitTime", e.target.value)}
              className="tt-input" />
          </Field>
        </div>

        {/* Trade Status */}
        <Field label="Trade Status">
          <SelectField
            value={data.exitStatus}
            onChange={(v) => updateField("exitStatus", v)}
            options={EXIT_STATUSES.map((s) => ({ label: s, value: s }))}
          />
        </Field>

        {/* Live exit calculations */}
        <div className="tt-exit-metrics">
          <div className="tt-exit-metric">
            <span className="tt-exit-metric-label">P&L</span>
            <span className={cn("tt-exit-metric-value", pnl != null ? (pnlPositive ? "text-emerald-400" : "text-red-400") : "text-slate-500")}>
              {pnl != null ? `${pnlPositive ? "+" : ""}${formatMoney(pnl)}` : "-"}
            </span>
          </div>
          <div className="tt-exit-metric">
            <span className="tt-exit-metric-label">RR Achieved</span>
            <span className={cn("tt-exit-metric-value",
              exitMetrics.rrAchieved != null
                ? (exitMetrics.rrAchieved >= 0 ? "text-emerald-400" : "text-red-400")
                : "text-slate-500"
            )}>
              {exitMetrics.rrAchieved != null ? `${exitMetrics.rrAchieved.toFixed(2)}R` : "-"}
            </span>
          </div>
          <div className="tt-exit-metric">
            <span className="tt-exit-metric-label">Duration</span>
            <span className="tt-exit-metric-value text-slate-300">
              {formatDuration(exitMetrics.durationMinutes)}
            </span>
          </div>
          <div className="tt-exit-metric">
            <span className="tt-exit-metric-label">Profit %</span>
            <span className={cn("tt-exit-metric-value",
              exitMetrics.profitPercent != null
                ? (exitMetrics.profitPercent >= 0 ? "text-emerald-400" : "text-red-400")
                : "text-slate-500"
            )}>
              {exitMetrics.profitPercent != null
                ? `${exitMetrics.profitPercent >= 0 ? "+" : ""}${exitMetrics.profitPercent.toFixed(2)}%`
                : "-"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SECTION 3: TRADE CONTEXT ─────────────────────────────────────────────────
function TradeContextSection({
  setups,
  data,
  updateField,
  addTag,
  removeTag,
}: {
  setups: Setup[];
  data: TradeCaptureData;
  updateField: <K extends keyof TradeCaptureData>(key: K, value: TradeCaptureData[K]) => void;
  addTag: (tag: string) => void;
  removeTag: (tag: string) => void;
}) {
  const [tagInput, setTagInput] = useState("");
  const [showNewSetup, setShowNewSetup] = useState(false);

  const submitTag = () => { addTag(tagInput); setTagInput(""); };

  return (
    <div className="glass-card tt-section">
      <div className="tt-section-header">
        <h2 className="tt-section-title">
          <Gauge className="w-3.5 h-3.5 text-cyan-400" />
          Trade Context
        </h2>
        <button type="button" onClick={() => setShowNewSetup((v) => !v)}
          className="tt-create-setup-btn">
          <Plus className="w-2.5 h-2.5" /> Create Setup
        </button>
      </div>
      <div className="tt-section-body">
        {/* Row 1: Playbook, Setup, Session, HTF, Timeframe */}
        <div className="tt-context-grid">
          <Field label="Playbook">
            <SelectField
              value={data.setupId}
              onChange={(v) => updateField("setupId", v)}
              options={setups.map((s) => ({ label: s.name, value: s.id }))}
              placeholder="None"
            />
          </Field>

          <Field label="Session" required>
            <SelectField
              value={data.session}
              onChange={(v) => updateField("session", v)}
              options={SESSIONS.map((s) => ({ label: s, value: s }))}
            />
          </Field>

          <Field label="HTF Bias" required>
            <SelectField
              value={data.htfBias}
              onChange={(v) => updateField("htfBias", v)}
              options={HTF_BIAS.map((b) => ({ label: b, value: b }))}
              placeholder="Select"
            />
          </Field>
        </div>

        {/* New Setup inline */}
        {showNewSetup && (
          <Field label="New Setup Name" required>
            <input type="text" value={data.customSetupName}
              onChange={(e) => updateField("customSetupName", e.target.value)}
              placeholder="Opening Drive Breakout"
              className="tt-input" />
          </Field>
        )}

        {/* Setup pills */}
        <Field label="Setup">
          <PillGroup options={SETUP_OPTIONS} value={data.setup}
            onChange={(v) => updateField("setup", v)} />
        </Field>

        {/* Timeframe pills */}
        <Field label="Timeframe">
          <PillGroup options={TIMEFRAMES} value={data.timeframe}
            onChange={(v) => updateField("timeframe", v)} />
        </Field>

        {/* Tags */}
        <div className="tt-tags-section">
          <Field label="Tags">
            <div className="flex gap-1.5">
              <input className="tt-input flex-1" value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitTag(); } }}
                placeholder="Type tag + Enter" />
              <button type="button" onClick={submitTag} className="tt-tag-add-btn">Add</button>
            </div>
          </Field>

          <div className="tt-pill-row">
            {QUICK_TAGS.map((tag) => (
              <button key={tag} type="button" onClick={() => addTag(tag)}
                className={cn("tt-qtag", data.tags.includes(tag) ? "tt-qtag-on" : "tt-qtag-off")}>
                {tag}
              </button>
            ))}
          </div>

          {data.tags.length > 0 && (
            <div className="tt-pill-row">
              {data.tags.map((tag) => (
                <button key={tag} type="button" onClick={() => removeTag(tag)}
                  className="tt-sel-tag" title="Click to remove">
                  {tag} <X className="w-2.5 h-2.5 opacity-60" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── SECTION 4: LIVE TRADE INTELLIGENCE ───────────────────────────────────────
function LiveIntelligenceStrip({
  data,
  risk,
  validation,
}: {
  data: TradeCaptureData;
  risk: TradeRiskSnapshot;
  validation: TradeCaptureValidation;
}) {
  const rr = risk.riskRewardRatio;
  const rrStr = rr == null ? "-" : `${rr.toFixed(2)}R`;
  const rrColor = rr == null ? "#64748b" : rr >= 2 ? "#22c55e" : rr >= 1.5 ? "#f59e0b" : "#ef4444";
  const score = validation.qualityScore;
  const scoreColor = score == null ? "#64748b" : score >= 75 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444";
  const confColor =
    data.confidence <= 3 ? "#ef4444" :
    data.confidence <= 6 ? "#f59e0b" :
    data.confidence <= 8 ? "#22c55e" : "#818cf8";

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-2">
      <KpiMetric label="Risk Amount" value={formatMoney(risk.riskAmount)} icon={TrendingDown} color="#ef4444" />
      <KpiMetric label="Reward Amount" value={formatMoney(risk.rewardAmount)} icon={TrendingUp} color="#22c55e" />
      <KpiMetric label="Risk:Reward" value={rrStr} icon={ArrowUp} color={rrColor} />
      <KpiMetric label="Position Value" value={formatMoney(risk.positionValue)} icon={Gauge} color="#60a5fa" />
      <KpiMetric label="Trade Score" value={score == null ? "-" : `${score}`} icon={Zap} color={scoreColor}
        subtext={score != null ? `${score >= 75 ? "Good" : score >= 50 ? "Fair" : "Needs work"}` : undefined} />
      <KpiMetric label="Confidence" value={`${data.confidence}/10`} icon={ShieldAlert} color={confColor} />
      <KpiMetric label="Completion" value={`${validation.completionPercent}%`} icon={CheckCircle2}
        color={validation.completionPercent >= 80 ? "#22c55e" : validation.completionPercent >= 50 ? "#f59e0b" : "#ef4444"} />
    </div>
  );
}

// ─── ROOT: TRADE TICKET ───────────────────────────────────────────────────────
export function TradeTicket({
  setups,
  onClose,
  onSaved,
}: {
  setups: Setup[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const {
    data, risk, exitMetrics, validation, draftSavedAt,
    updateField, addTag, removeTag, saveDraft, saveTrade, createTrade,
  } = useTradeCapture(setups, onSaved);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => { if (e.key === "Escape") onClose(); },
    [onClose]
  );

  if (!mounted) return null;

  return createPortal(
    <>
      <style>{scopedCSS}</style>
      <div className="tt-overlay" onKeyDown={handleKeyDown} tabIndex={-1}>

        {/* ── TOPBAR ── */}
        <div className="tt-topbar">
          <div className="tt-topbar-left">
            <div className="tt-topbar-icon"><Zap className="w-3.5 h-3.5 text-white" /></div>
            <div>
              <div className="tt-topbar-title">Add Trade</div>
              <div className="tt-topbar-sub">Journal entry · execution ticket</div>
            </div>
          </div>
          <div className="tt-topbar-right">
            <button type="button" className="tt-btn-draft" onClick={saveDraft} id="btn-save-draft">
              <FileClock className="w-3 h-3" /> Save Draft
            </button>
            <button type="button" className="tt-btn-save" onClick={saveTrade}
              disabled={!validation.canSaveTrade} id="btn-save-trade">
              <Save className="w-3 h-3" /> Save Trade
            </button>
            <button type="button" className="tt-btn-create" onClick={createTrade}
              disabled={!validation.canSaveTrade} id="btn-create-trade">
              <Plus className="w-3 h-3" /> Create Trade
            </button>
            <button type="button" className="tt-close-btn" onClick={onClose} aria-label="Close">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ── SCROLLABLE CONTENT ── */}
        <div className="tt-scroll">
          <div className="tt-content">

            {/* Section 4: Live Intelligence KPI Strip (top) */}
            <LiveIntelligenceStrip data={data} risk={risk} validation={validation} />

            {/* Warning strip */}
            <WarningStrip warnings={validation.warnings} />

            {/* Missing fields strip */}
            {validation.missingRequired.length > 0 && (
              <div className="tt-missing-strip">
                <span className="tt-missing-label">Missing:</span>
                {validation.missingRequired.map((f) => (
                  <span key={f} className="tt-missing-badge">{f}</span>
                ))}
              </div>
            )}

            {/* Sections 1 + 2: Side by side */}
            <div className="tt-two-col">
              <TradeDetailsSection data={data} updateField={updateField} />
              <ExitDetailsSection data={data} exitMetrics={exitMetrics} risk={risk} updateField={updateField} />
            </div>

            {/* Section 3: Trade Context (full width) */}
            <TradeContextSection
              setups={setups} data={data}
              updateField={updateField} addTag={addTag} removeTag={removeTag}
            />
          </div>
        </div>

        {/* ── BOTTOM STATUS BAR ── */}
        <div className="tt-bottom-bar">
          <span className="tt-bottom-status">
            {draftSavedAt ? `Draft saved ${draftSavedAt}` : "Press Esc to close · Tab to advance fields"}
          </span>
          <span className="tt-bottom-completion">
            {validation.completionPercent}% complete · {validation.missingRequired.length === 0 ? "Ready to save" : `${validation.missingRequired.length} fields missing`}
          </span>
        </div>
      </div>
    </>,
    document.body
  );
}

// ─── SCOPED CSS ───────────────────────────────────────────────────────────────
const scopedCSS = `
/* ── Overlay ── */
.tt-overlay {
  position: fixed; inset: 0; z-index: 60;
  background: rgba(4,7,18,0.97);
  backdrop-filter: blur(24px);
  display: flex; flex-direction: column;
  overflow: hidden;
}

/* ── Topbar ── */
.tt-topbar {
  flex-shrink: 0; height: 48px;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  background: rgba(8,12,28,0.9);
}
.tt-topbar-left { display: flex; align-items: center; gap: 10px; }
.tt-topbar-icon {
  width: 28px; height: 28px; border-radius: 8px;
  background: linear-gradient(135deg,#4f46e5,#7c3aed);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 0 14px rgba(99,102,241,0.3);
}
.tt-topbar-title { font-size: 13px; font-weight: 800; color: #f1f5f9; }
.tt-topbar-sub { font-size: 10px; color: #475569; font-weight: 500; }
.tt-topbar-right { display: flex; align-items: center; gap: 6px; }
.tt-close-btn {
  width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;
  border-radius: 8px; border: 1px solid rgba(255,255,255,0.07);
  background: rgba(255,255,255,0.03); color: #64748b;
  cursor: pointer; transition: all 0.15s;
}
.tt-close-btn:hover { background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.25); color: #f87171; }

/* ── Buttons ── */
.tt-btn-draft, .tt-btn-save, .tt-btn-create {
  height: 30px; padding: 0 12px; display: inline-flex; align-items: center; gap: 5px;
  border-radius: 7px; font-size: 11px; font-weight: 700; cursor: pointer;
  transition: all 0.15s; white-space: nowrap;
}
.tt-btn-draft {
  border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.04); color: #64748b;
}
.tt-btn-draft:hover { border-color: rgba(99,102,241,0.3); color: #94a3b8; }
.tt-btn-save {
  border: 1px solid rgba(99,102,241,0.25); background: rgba(99,102,241,0.08); color: #a5b4fc;
}
.tt-btn-save:hover:not(:disabled) { background: rgba(99,102,241,0.14); }
.tt-btn-save:disabled, .tt-btn-create:disabled { opacity: 0.4; cursor: not-allowed; }
.tt-btn-create {
  border: none; background: linear-gradient(135deg,#4f46e5,#7c3aed);
  color: #fff; font-weight: 800; box-shadow: 0 0 20px rgba(99,102,241,0.3);
}
.tt-btn-create:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 20px rgba(99,102,241,0.4); }
.tt-btn-create:disabled { box-shadow: none; }

/* ── Scrollable area ── */
.tt-scroll { flex: 1; overflow-y: auto; }
.tt-content {
  max-width: 1400px; margin: 0 auto;
  padding: 12px 16px 16px;
  display: flex; flex-direction: column; gap: 10px;
}

/* ── Two column layout ── */
.tt-two-col {
  display: grid; grid-template-columns: 1fr; gap: 10px;
}
@media (min-width: 900px) {
  .tt-two-col { grid-template-columns: 55fr 45fr; }
}

/* ── Section card ── */
.tt-section { overflow: hidden; }
.tt-section-header {
  padding: 8px 14px; display: flex; align-items: center; justify-content: space-between;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.tt-section-title {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 800; text-transform: uppercase;
  letter-spacing: 0.08em; color: #94a3b8;
}
.tt-section-body { padding: 10px 14px 14px; display: flex; flex-direction: column; gap: 8px; }

/* ── Field ── */
.tt-field { display: flex; flex-direction: column; gap: 3px; }
.tt-field-label {
  font-size: 9px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.09em; color: #475569;
}
.tt-required { color: #818cf8; margin-left: 2px; }

/* ── Inputs ── */
.tt-input {
  height: 32px; width: 100%; border-radius: 7px;
  border: 1px solid rgba(255,255,255,0.07);
  background: rgba(255,255,255,0.03); padding: 0 10px;
  font-size: 12px; font-weight: 600; color: #e2e8f0;
  outline: none; transition: all 0.15s;
}
.tt-input::placeholder { color: #334155; font-weight: 400; }
.tt-input:focus { border-color: rgba(99,102,241,0.5); background: rgba(99,102,241,0.05); box-shadow: 0 0 0 2px rgba(99,102,241,0.1); }
.tt-mono { font-family: 'JetBrains Mono','Fira Code',monospace; font-variant-numeric: tabular-nums; }

/* ── Select ── */
.tt-select-wrap { position: relative; }
.tt-select {
  height: 32px; width: 100%; border-radius: 7px;
  border: 1px solid rgba(255,255,255,0.07);
  background: rgba(255,255,255,0.03); padding: 0 28px 0 10px;
  font-size: 12px; font-weight: 600; color: #e2e8f0;
  outline: none; cursor: pointer; -webkit-appearance: none; appearance: none;
}
.tt-select:focus { border-color: rgba(99,102,241,0.5); box-shadow: 0 0 0 2px rgba(99,102,241,0.1); }
.tt-select-chevron { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); width: 14px; height: 14px; color: #475569; pointer-events: none; }

/* ── Direction ── */
.tt-dir-btn {
  height: 34px; display: flex; align-items: center; justify-content: center; gap: 6px;
  border-radius: 8px; border: 1px solid; font-size: 10px; font-weight: 800;
  letter-spacing: 0.05em; cursor: pointer; transition: all 0.2s;
}
.tt-dir-buy { border-color: rgba(34,197,94,0.4); background: rgba(34,197,94,0.12); color: #4ade80; box-shadow: 0 0 16px rgba(34,197,94,0.12); }
.tt-dir-sell { border-color: rgba(239,68,68,0.4); background: rgba(239,68,68,0.12); color: #f87171; box-shadow: 0 0 16px rgba(239,68,68,0.12); }
.tt-dir-off { border-color: rgba(255,255,255,0.06); background: rgba(255,255,255,0.02); color: #475569; }
.tt-dir-off:hover { border-color: rgba(255,255,255,0.12); color: #94a3b8; }

/* ── Pills ── */
.tt-pill-row { display: flex; flex-wrap: wrap; gap: 4px; }
.tt-pill {
  padding: 3px 8px; border-radius: 5px; border: 1px solid;
  font-size: 10px; font-weight: 700; cursor: pointer; transition: all 0.15s; line-height: 1.4;
}
.tt-pill-on { border-color: rgba(99,102,241,0.5); background: rgba(99,102,241,0.15); color: #a5b4fc; }
.tt-pill-off { border-color: rgba(255,255,255,0.06); background: transparent; color: #475569; }
.tt-pill-off:hover { border-color: rgba(99,102,241,0.3); color: #94a3b8; }

/* ── Quick tags ── */
.tt-qtag {
  padding: 2px 7px; border-radius: 4px; border: 1px solid;
  font-size: 10px; font-weight: 600; cursor: pointer; transition: all 0.12s;
}
.tt-qtag-off { border-color: rgba(255,255,255,0.06); color: #475569; }
.tt-qtag-off:hover { border-color: rgba(255,255,255,0.12); color: #64748b; }
.tt-qtag-on { border-color: rgba(99,102,241,0.4); color: #818cf8; background: rgba(99,102,241,0.1); }
.tt-sel-tag {
  display: inline-flex; align-items: center; gap: 3px;
  padding: 2px 7px; border-radius: 4px;
  border: 1px solid rgba(99,102,241,0.3); background: rgba(99,102,241,0.1);
  color: #a5b4fc; font-size: 10px; font-weight: 700; cursor: pointer; transition: all 0.12s;
}
.tt-sel-tag:hover { border-color: rgba(239,68,68,0.35); background: rgba(239,68,68,0.08); color: #f87171; }
.tt-tag-add-btn {
  height: 32px; padding: 0 10px; border-radius: 7px;
  border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.04);
  font-size: 11px; font-weight: 700; color: #64748b; cursor: pointer; transition: all 0.15s;
}
.tt-tag-add-btn:hover { border-color: rgba(99,102,241,0.3); color: #94a3b8; }
.tt-tags-section { display: flex; flex-direction: column; gap: 6px; }

/* ── Context grid ── */
.tt-context-grid {
  display: grid; grid-template-columns: 1fr; gap: 8px;
}
@media (min-width: 640px) { .tt-context-grid { grid-template-columns: 1fr 1fr 1fr; } }

/* ── Create Setup button ── */
.tt-create-setup-btn {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 8px; border-radius: 5px;
  border: 1px solid rgba(99,102,241,0.25); background: rgba(99,102,241,0.08);
  font-size: 10px; font-weight: 700; color: #a5b4fc; cursor: pointer; transition: all 0.15s;
}
.tt-create-setup-btn:hover { background: rgba(99,102,241,0.15); }

/* ── Status badge ── */
.tt-status-badge {
  padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700;
  border: 1px solid; text-transform: uppercase; letter-spacing: 0.06em;
}
.tt-status-open { border-color: rgba(34,197,94,0.3); background: rgba(34,197,94,0.1); color: #4ade80; }
.tt-status-closed { border-color: rgba(99,102,241,0.3); background: rgba(99,102,241,0.1); color: #a5b4fc; }
.tt-status-be { border-color: rgba(245,158,11,0.3); background: rgba(245,158,11,0.1); color: #fbbf24; }

/* ── Exit metrics ── */
.tt-exit-metrics {
  display: grid; grid-template-columns: 1fr 1fr; gap: 6px;
  margin-top: 4px;
}
.tt-exit-metric {
  padding: 8px 10px; border-radius: 8px;
  background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.05);
  display: flex; flex-direction: column; gap: 3px;
}
.tt-exit-metric-label {
  font-size: 9px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.08em; color: #475569;
}
.tt-exit-metric-value {
  font-family: 'JetBrains Mono','Fira Code',monospace;
  font-size: 14px; font-weight: 800; font-variant-numeric: tabular-nums;
}

/* ── Symbol Combobox ── */
.symbol-combobox { position: relative; }
.symbol-input-wrap {
  position: relative; display: flex; align-items: center;
}
.symbol-search-icon {
  position: absolute; left: 10px; width: 14px; height: 14px; color: #475569; pointer-events: none;
}
.symbol-input {
  height: 32px; width: 100%; border-radius: 7px;
  border: 1px solid rgba(255,255,255,0.07);
  background: rgba(255,255,255,0.03); padding: 0 10px 0 30px;
  font-size: 12px; font-weight: 700; color: #e2e8f0;
  outline: none; transition: all 0.15s;
  font-family: 'JetBrains Mono','Fira Code',monospace;
  letter-spacing: 0.03em;
}
.symbol-input::placeholder { color: #334155; font-weight: 400; letter-spacing: 0; font-family: 'Inter',sans-serif; }
.symbol-input:focus { border-color: rgba(99,102,241,0.5); background: rgba(99,102,241,0.05); box-shadow: 0 0 0 2px rgba(99,102,241,0.1); }
.symbol-dropdown {
  position: absolute; z-index: 100; top: calc(100% + 4px); left: 0; right: 0;
  max-height: 280px; overflow-y: auto;
  border-radius: 10px; border: 1px solid rgba(255,255,255,0.08);
  background: rgba(10,13,20,0.97); backdrop-filter: blur(20px);
  box-shadow: 0 20px 60px rgba(0,0,0,0.6);
  padding: 4px;
}
.symbol-cat-header {
  padding: 6px 10px 3px; font-size: 9px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.1em; color: #475569;
}
.symbol-option {
  display: flex; align-items: center; justify-content: space-between;
  width: 100%; padding: 6px 10px; border-radius: 6px;
  font-size: 12px; cursor: pointer; transition: background 0.1s;
  border: none; background: transparent; text-align: left;
}
.symbol-option:hover, .symbol-option-hl { background: rgba(99,102,241,0.1); }
.symbol-option-active { background: rgba(99,102,241,0.15); }
.symbol-option-ticker {
  font-family: 'JetBrains Mono','Fira Code',monospace;
  font-weight: 800; color: #e2e8f0; letter-spacing: 0.03em;
}
.symbol-option-label { font-size: 10px; color: #64748b; font-weight: 500; }

/* ── Confidence Slider ── */
.confidence-wrap { display: flex; flex-direction: column; gap: 4px; }
.confidence-top { display: flex; align-items: center; justify-content: space-between; }
.confidence-label { font-size: 10px; font-weight: 700; }
.confidence-value { font-family: 'JetBrains Mono','Fira Code',monospace; font-size: 13px; font-weight: 800; }
.confidence-track-wrap { position: relative; height: 20px; display: flex; align-items: center; }
.confidence-track {
  position: absolute; left: 0; right: 0; height: 4px;
  border-radius: 99px; background: rgba(255,255,255,0.08);
  overflow: hidden; pointer-events: none;
}
.confidence-fill {
  height: 100%; border-radius: 99px; transition: width 0.2s ease, background 0.3s ease;
}
.confidence-range {
  position: relative; z-index: 1; width: 100%; height: 20px;
  -webkit-appearance: none; appearance: none;
  background: transparent; cursor: pointer;
}
.confidence-range::-webkit-slider-thumb {
  -webkit-appearance: none; width: 16px; height: 16px;
  border-radius: 50%; background: linear-gradient(135deg,#4f46e5,#7c3aed);
  box-shadow: 0 0 8px rgba(99,102,241,0.5);
  cursor: pointer; border: 2px solid rgba(255,255,255,0.2);
}

/* ── Warning strip ── */
.tt-warning-strip {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 12px; border-radius: 8px;
  border: 1px solid rgba(245,158,11,0.2); background: rgba(245,158,11,0.06);
}
.tt-warning-text {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 11px; font-weight: 600; color: #fbbf24;
}

/* ── Missing strip ── */
.tt-missing-strip {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  padding: 6px 12px; border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.06); background: rgba(255,255,255,0.02);
}
.tt-missing-label { font-size: 10px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.08em; }
.tt-missing-badge {
  padding: 2px 8px; border-radius: 4px;
  border: 1px solid rgba(255,255,255,0.07); background: rgba(255,255,255,0.03);
  font-size: 10px; font-weight: 600; color: #64748b;
}

/* ── Bottom bar ── */
.tt-bottom-bar {
  flex-shrink: 0; height: 36px;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 16px;
  border-top: 1px solid rgba(255,255,255,0.05);
  background: rgba(6,9,22,0.95);
}
.tt-bottom-status { font-size: 10px; font-weight: 600; color: #334155; }
.tt-bottom-completion { font-size: 10px; font-weight: 600; color: #475569; }
`;
