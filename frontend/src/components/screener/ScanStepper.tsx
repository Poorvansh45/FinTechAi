"use client";

import { Check, Loader2, AlertCircle, Circle } from "lucide-react";

type StageKey = "download" | "indicators" | "technical" | "launchpad" | "alpha_zone" | "ipo_vintage";

const STAGES: { key: StageKey; label: string; hint: string }[] = [
  { key: "download",     label: "OHLCV Download",     hint: "Syncing fresh candles" },
  { key: "indicators",   label: "Indicators",          hint: "EMA / RSI / MACD / ATR — computed once, reused by every stage below" },
  { key: "technical",    label: "Technical Analysis",  hint: "FVG, SMC, momentum, volume surge" },
  { key: "launchpad",    label: "LaunchPad",           hint: "Fair Value Gap continuation setups" },
  { key: "alpha_zone",   label: "Alpha Zone",          hint: "Institutional order block setups" },
  { key: "ipo_vintage",  label: "IPO Vintage",         hint: "Recent IPO listings and post-listing performance" },
];

type StepStatus = "done" | "active" | "pending" | "failed";

function stepStatus(stageDoc: any): StepStatus {
  const s = stageDoc?.status;
  if (s === "COMPLETED") return "done";
  if (s === "RUNNING") return "active";
  if (s === "FAILED") return "failed";
  return "pending";
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "done") {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-positive-500/15 border border-positive-500/30 text-positive-400">
        <Check size={13} strokeWidth={3} />
      </span>
    );
  }
  if (status === "active") {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500/15 border border-brand-500/30 text-brand-300">
        <Loader2 size={13} className="animate-spin" />
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-negative-500/15 border border-negative-500/30 text-negative-400">
        <AlertCircle size={13} />
      </span>
    );
  }
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-800/60 border border-neutral-700 text-neutral-500">
      <Circle size={9} fill="currentColor" />
    </span>
  );
}

/** Live, stage-by-stage progress for a Run Full Scan in flight. Purely
 * presentational — the parent page owns polling `GET /scan-status` and
 * passes the resulting `meta` down. Each stage carries its own
 * status/processed/total/failed_symbols (see engines/orchestration), so this
 * component just renders what it's given — no derived state. Renders
 * nothing while `meta` is absent or the scan isn't RUNNING. */
export function ScanStepper({ meta }: { meta: any }) {
  if (!meta || (meta.overall_status ?? meta.status)?.toUpperCase() !== "RUNNING") return null;

  const stages = meta.stages ?? {};

  return (
    <div className="mt-6 rounded-xl border border-neutral-800/80 bg-neutral-950/40 p-5">
      <div className="mb-4 flex items-center gap-2">
        <Loader2 size={14} className="animate-spin text-brand-400" />
        <span className="text-xs font-semibold text-brand-400">
          Run Full Scan in progress
        </span>
      </div>
      <div className="space-y-4">
        {STAGES.map((stage, i) => {
          const stageDoc = stages[stage.key];
          const status = stepStatus(stageDoc);
          const done = stageDoc?.processed;
          const total = stageDoc?.total;
          const failedCount = stageDoc?.failed_symbols?.length ?? 0;
          return (
            <div key={stage.key} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <StepIcon status={status} />
                {i < STAGES.length - 1 && (
                  <span
                    className={`mt-1 h-6 w-px ${
                      status === "done" ? "bg-positive-500/30" : "bg-neutral-800"
                    }`}
                  />
                )}
              </div>
              <div className="flex-1 pb-1">
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={`text-sm font-semibold ${
                      status === "pending" ? "text-neutral-500" : "text-neutral-200"
                    }`}
                  >
                    {stage.label}
                  </span>
                  {typeof done === "number" && typeof total === "number" && total > 0 && (
                    <span className="font-mono text-xs text-neutral-400">
                      {done.toLocaleString()} / {total.toLocaleString()}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-neutral-500">
                  {stage.hint}
                  {failedCount > 0 && (
                    <span className="text-warning-400"> · {failedCount} symbol{failedCount === 1 ? "" : "s"} failed (scan continues)</span>
                  )}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
