import { AlertTriangle, CheckCircle2, Gauge, ShieldAlert } from "lucide-react";
import { formatMoney } from "@/services/trade-capture-calculations";
import type { TradeCaptureData, TradeCaptureValidation, TradeRiskSnapshot } from "@/types/trade-capture";

function Row({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-foreground/5 py-2 last:border-0">
      <span className="text-[11px] font-semibold text-muted-foreground">{label}</span>
      <span className={tone === "good" ? "font-mono text-xs font-bold text-positive-300" : tone === "warn" ? "font-mono text-xs font-bold text-warning-300" : "font-mono text-xs font-bold text-foreground"}>
        {value}
      </span>
    </div>
  );
}

export function TradeAssistantPanel({
  data,
  risk,
  validation,
}: {
  data: TradeCaptureData;
  risk: TradeRiskSnapshot;
  validation: TradeCaptureValidation;
}) {
  const quality = validation.qualityScore;

  return (
    <aside className="rounded-xl border border-foreground/10 bg-neutral-950/70">
      <div className="flex h-11 items-center justify-between border-b border-foreground/10 px-4">
        <h2 className="text-[11px] font-bold text-neutral-300">Live Trade Assistant</h2>
        <span className="rounded-md border border-positive-400/20 bg-positive-400/10 px-2 py-0.5 text-[11px] font-bold text-positive-300">
          Live
        </span>
      </div>

      <div className="space-y-3 p-4">
        <div className="grid grid-cols-[96px_1fr] gap-3">
          <div className="flex aspect-square items-center justify-center rounded-xl border border-brand-400/20 bg-brand-500/10">
            <div className="text-center">
              <div className="font-mono text-2xl font-bold text-brand-200">
                {quality == null ? "--" : quality}
              </div>
              <div className="text-[11px] font-bold text-muted-foreground">Quality</div>
            </div>
          </div>
          <div className="rounded-xl border border-foreground/10 bg-neutral-950/20 p-3">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-bold text-neutral-300">
              <Gauge className="h-3.5 w-3.5 text-brand-300" />
              Completion
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-foreground/10">
              <div
                className="h-full rounded-full bg-brand-500 transition-all duration-500"
                style={{ width: `${validation.completionPercent}%` }}
              />
            </div>
            <div className="mt-2 font-mono text-xs font-bold text-foreground">
              {validation.completionPercent}%
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-foreground/10 bg-neutral-950/20 p-3">
          <div className="mb-2 text-[11px] font-bold text-neutral-300">
            Trade Summary
          </div>
          <Row label="Symbol" value={data.symbol.trim().toUpperCase() || "-"} />
          <Row label="Direction" value={data.direction} tone={data.direction === "Buy" ? "good" : undefined} />
          <Row label="Risk Amount" value={formatMoney(risk.riskAmount)} tone="warn" />
          <Row label="Potential Reward" value={formatMoney(risk.rewardAmount)} tone="good" />
          <Row
            label="RR"
            value={risk.riskRewardRatio == null ? "-" : `${risk.riskRewardRatio.toFixed(2)}R`}
            tone={risk.riskRewardRatio != null && risk.riskRewardRatio >= 1.5 ? "good" : "warn"}
          />
          <Row label="Position Size" value={data.positionSize || "-"} />
          <Row label="Size Validation" value={validation.positionSizeValidation} />
        </div>

        <div className="rounded-xl border border-foreground/10 bg-neutral-950/20 p-3">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-bold text-neutral-300">
            <ShieldAlert className="h-3.5 w-3.5 text-warning-300" />
            Warnings
          </div>
          {validation.warnings.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-positive-400/20 bg-positive-400/10 p-2 text-[11px] font-bold text-positive-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
              No structural warnings
            </div>
          ) : (
            <div className="space-y-2">
              {validation.warnings.map((warning) => (
                <div key={warning} className="flex items-center gap-2 rounded-lg border border-warning-400/20 bg-warning-400/10 p-2 text-[11px] font-bold text-warning-200">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {warning}
                </div>
              ))}
            </div>
          )}
        </div>

        {validation.missingRequired.length > 0 ? (
          <div className="rounded-xl border border-foreground/10 bg-neutral-950/20 p-3">
            <div className="mb-2 text-[11px] font-bold text-neutral-300">
              Missing
            </div>
            <div className="flex flex-wrap gap-1.5">
              {validation.missingRequired.map((item) => (
                <span key={item} className="rounded-md border border-foreground/10 bg-foreground/[0.04] px-2 py-1 text-[11px] font-bold text-muted-foreground">
                  {item}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
