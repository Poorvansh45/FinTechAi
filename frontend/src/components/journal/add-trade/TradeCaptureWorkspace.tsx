"use client";

import { ArrowDown, ArrowUp, FileClock, Plus, Save, X } from "lucide-react";
import { useState } from "react";
import { useTradeCapture } from "@/hooks/use-trade-capture";
import { cn } from "@/lib/utils";
import type { Setup } from "@/lib/journal/types";
import type { HtfBias, TradeSetupTag } from "@/types/trade-capture";
import { OptionGroup } from "./OptionGroup";
import { RiskMetricGrid } from "./RiskMetricGrid";
import { SectionCard } from "./SectionCard";
import { TradeAssistantPanel } from "./TradeAssistantPanel";

const SETUP_OPTIONS: readonly TradeSetupTag[] = [
  "Liquidity Sweep",
  "FVG",
  "Order Block",
  "Break of Structure",
  "Demand Zone",
  "Supply Zone",
  "Breakout",
  "Reversal",
];

const HTF_BIAS: readonly HtfBias[] = ["Bullish", "Bearish", "Neutral", "Ranging"];
const SESSIONS = ["Asian", "London", "NY"] as const;
const QUICK_TAGS = ["FVG", "Liquidity", "NY Open", "Trend", "Countertrend", "News Risk"];

const inputClass =
  "h-9 w-full rounded-lg border border-white/10 bg-black/25 px-3 text-xs font-bold text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-indigo-400/60 focus:bg-black/35";

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.08em] text-muted-foreground">
        {label}
        {required ? <span className="text-indigo-300"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

export function TradeCaptureWorkspace({
  setups,
  onClose,
  onSaved,
}: {
  setups: Setup[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tagInput, setTagInput] = useState("");
  const {
    data,
    risk,
    validation,
    draftSavedAt,
    updateField,
    addTag,
    removeTag,
    saveDraft,
    saveTrade,
    createTrade,
  } = useTradeCapture(setups, onSaved);

  const addTypedTag = () => {
    addTag(tagInput);
    setTagInput("");
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#070b12]/96 p-3 text-foreground backdrop-blur-xl">
      <div className="mx-auto flex min-h-[calc(100dvh-24px)] w-full max-w-[1180px] flex-col gap-3">
        <header className="rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-black tracking-tight">Add Trade</h1>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Fast execution ticket for journal analytics and future review.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-muted-foreground transition-all hover:text-foreground"
              aria-label="Close Add Trade"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="grid flex-1 gap-3 lg:grid-cols-[360px_360px_360px] lg:items-start lg:justify-center">
          <SectionCard title="Trade Entry">
            <div className="space-y-3">
              <Field label="Symbol" required>
                <input
                  autoFocus
                  className={inputClass}
                  value={data.symbol}
                  onChange={(event) => updateField("symbol", event.target.value)}
                  placeholder="NIFTY, XAUUSD, AAPL"
                />
              </Field>

              <div className="grid grid-cols-2 gap-2">
                {(["Buy", "Sell"] as const).map((direction) => {
                  const active = data.direction === direction;
                  return (
                    <button
                      key={direction}
                      type="button"
                      onClick={() => updateField("direction", direction)}
                      className={cn(
                        "flex h-10 items-center justify-center gap-2 rounded-lg border text-xs font-black transition-all duration-300 ease-[cubic-bezier(0.22,_1,_0.36,_1)]",
                        active && direction === "Buy"
                          ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-300"
                          : active
                            ? "border-red-400/40 bg-red-400/15 text-red-300"
                            : "border-white/10 bg-black/20 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {direction === "Buy" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
                      {direction}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Field label="Entry Price" required>
                  <input
                    className={`${inputClass} font-mono`}
                    type="number"
                    min="0"
                    inputMode="decimal"
                    value={data.entryPrice}
                    onChange={(event) => updateField("entryPrice", event.target.value)}
                  />
                </Field>
                <Field label="Stop Loss" required>
                  <input
                    className={`${inputClass} font-mono`}
                    type="number"
                    min="0"
                    inputMode="decimal"
                    value={data.stopLoss}
                    onChange={(event) => updateField("stopLoss", event.target.value)}
                  />
                </Field>
                <Field label="Take Profit" required>
                  <input
                    className={`${inputClass} font-mono`}
                    type="number"
                    min="0"
                    inputMode="decimal"
                    value={data.takeProfit}
                    onChange={(event) => updateField("takeProfit", event.target.value)}
                  />
                </Field>
                <Field label="Position Size" required>
                  <input
                    className={`${inputClass} font-mono`}
                    type="number"
                    min="0"
                    inputMode="decimal"
                    value={data.positionSize}
                    onChange={(event) => updateField("positionSize", event.target.value)}
                  />
                </Field>
              </div>

              <RiskMetricGrid risk={risk} />
            </div>
          </SectionCard>

          <SectionCard
            title="Context"
            action={
              <button
                type="button"
                onClick={() => updateField("customSetupName", data.customSetupName ? "" : data.setup || "New Setup")}
                className="inline-flex items-center gap-1 rounded-md border border-indigo-400/20 bg-indigo-500/10 px-2 py-1 text-[10px] font-black text-indigo-300 transition-all hover:bg-indigo-500/15"
              >
                <Plus className="h-3 w-3" />
                Create Setup
              </button>
            }
          >
            <div className="space-y-3">
              <Field label="Playbook">
                <select
                  className={inputClass}
                  value={data.setupId}
                  onChange={(event) => updateField("setupId", event.target.value)}
                >
                  <option value="">None</option>
                  {setups.map((setup) => (
                    <option key={setup.id} value={setup.id}>
                      {setup.name}
                    </option>
                  ))}
                </select>
              </Field>

              {data.customSetupName ? (
                <Field label="Custom Setup" required>
                  <input
                    className={inputClass}
                    value={data.customSetupName}
                    onChange={(event) => updateField("customSetupName", event.target.value)}
                    placeholder="Opening Drive Breakout"
                  />
                </Field>
              ) : (
                <Field label="Setup" required>
                  <OptionGroup
                    options={SETUP_OPTIONS}
                    value={data.setup}
                    onChange={(value) => updateField("setup", value)}
                  />
                </Field>
              )}

              <div className="grid grid-cols-2 gap-2">
                <Field label="Session" required>
                  <select
                    className={inputClass}
                    value={data.session}
                    onChange={(event) => updateField("session", event.target.value as typeof data.session)}
                  >
                    {SESSIONS.map((session) => (
                      <option key={session} value={session}>
                        {session}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="HTF Bias" required>
                  <select
                    className={inputClass}
                    value={data.htfBias}
                    onChange={(event) => updateField("htfBias", event.target.value as HtfBias)}
                  >
                    <option value="">Select</option>
                    {HTF_BIAS.map((bias) => (
                      <option key={bias} value={bias}>
                        {bias}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Tags">
                <div className="flex gap-2">
                  <input
                    className={inputClass}
                    value={tagInput}
                    onChange={(event) => setTagInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addTypedTag();
                      }
                    }}
                    placeholder="Add tag"
                  />
                  <button
                    type="button"
                    onClick={addTypedTag}
                    className="h-9 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-[11px] font-black transition-all hover:border-indigo-400/40"
                  >
                    Add
                  </button>
                </div>
              </Field>

              <div className="flex flex-wrap gap-1.5">
                {QUICK_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => addTag(tag)}
                    className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-[10px] font-bold text-muted-foreground transition-all hover:text-foreground"
                  >
                    {tag}
                  </button>
                ))}
              </div>

              {data.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {data.tags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="rounded-md border border-indigo-400/20 bg-indigo-500/10 px-2 py-1 text-[10px] font-bold text-indigo-200 transition-all hover:border-red-400/30 hover:text-red-200"
                    >
                      {tag} x
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </SectionCard>

          <TradeAssistantPanel data={data} risk={risk} validation={validation} />
        </main>

        <footer className="sticky bottom-3 rounded-xl border border-white/10 bg-slate-950/90 p-3 shadow-[0_-18px_48px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-h-5 text-[11px] font-bold text-muted-foreground">
              {draftSavedAt ? `Draft saved ${draftSavedAt}` : "Ready for fast ticket capture"}
            </div>
            <div className="grid grid-cols-3 gap-2 sm:flex">
              <button
                type="button"
                onClick={saveDraft}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 text-xs font-black text-foreground transition-all hover:border-indigo-400/40"
              >
                <FileClock className="h-3.5 w-3.5" />
                Save Draft
              </button>
              <button
                type="button"
                onClick={saveTrade}
                disabled={!validation.canSaveTrade}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-indigo-400/30 bg-indigo-500/12 px-4 text-xs font-black text-indigo-200 transition-all hover:bg-indigo-500/18 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                Save Trade
              </button>
              <button
                type="button"
                onClick={createTrade}
                disabled={!validation.canSaveTrade}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 text-xs font-black text-white shadow-[0_0_24px_rgba(99,102,241,0.28)] transition-all hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Create Trade
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

