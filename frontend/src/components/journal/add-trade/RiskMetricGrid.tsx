import { formatMoney } from "@/services/trade-capture-calculations";
import type { TradeRiskSnapshot } from "@/types/trade-capture";

function MetricTile({ label, value, tone }: { label: string; value: string; tone?: "profit" | "warning" }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-2.5">
      <div className="text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{label}</div>
      <div
        className={
          tone === "profit"
            ? "mt-1 font-mono text-base font-black text-emerald-400"
            : tone === "warning"
              ? "mt-1 font-mono text-base font-black text-amber-400"
              : "mt-1 font-mono text-base font-black text-foreground"
        }
      >
        {value}
      </div>
    </div>
  );
}

export function RiskMetricGrid({ risk }: { risk: TradeRiskSnapshot }) {
  const rr =
    risk.riskRewardRatio == null ? "-" : `${risk.riskRewardRatio.toFixed(2)}R`;

  return (
    <div className="grid grid-cols-2 gap-2">
      <MetricTile label="Risk Amount" value={formatMoney(risk.riskAmount)} tone="warning" />
      <MetricTile label="Reward Amount" value={formatMoney(risk.rewardAmount)} tone="profit" />
      <MetricTile
        label="Risk Reward"
        value={rr}
        tone={risk.riskRewardRatio != null && risk.riskRewardRatio < 2 ? "warning" : "profit"}
      />
      <MetricTile label="Position Value" value={formatMoney(risk.positionValue)} />
    </div>
  );
}
