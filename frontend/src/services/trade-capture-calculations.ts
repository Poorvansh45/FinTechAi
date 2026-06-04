import type {
  TradeAssistantInsight,
  TradeCaptureData,
  TradeCaptureValidation,
  TradeRiskSnapshot,
} from "@/types/trade-capture";

function toNumber(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function calculateTradeRisk(data: TradeCaptureData): TradeRiskSnapshot {
  const entry = toNumber(data.entryPrice);
  const stop = toNumber(data.stopLoss);
  const target = toNumber(data.takeProfit);
  const size = toNumber(data.positionSize);

  const riskPerUnit = entry != null && stop != null ? Math.abs(entry - stop) : null;
  const rewardPerUnit = entry != null && target != null ? Math.abs(target - entry) : null;
  const riskAmount = riskPerUnit != null && size != null ? riskPerUnit * size : null;
  const rewardAmount = rewardPerUnit != null && size != null ? rewardPerUnit * size : null;
  const positionValue = entry != null && size != null ? entry * size : null;
  const riskRewardRatio =
    riskPerUnit != null && rewardPerUnit != null && riskPerUnit > 0
      ? rewardPerUnit / riskPerUnit
      : null;
  const stopDistancePercent =
    entry != null && riskPerUnit != null && entry > 0 ? (riskPerUnit / entry) * 100 : null;

  return {
    riskAmount,
    rewardAmount,
    riskRewardRatio,
    positionValue,
    riskPerUnit,
    rewardPerUnit,
    stopDistancePercent,
  };
}

export function validateTradeCapture(
  data: TradeCaptureData,
  risk: TradeRiskSnapshot
): TradeCaptureValidation {
  const missingRequired: string[] = [];
  const warnings: string[] = [];
  const requiredChecks = [
    ["Symbol", Boolean(data.symbol.trim())],
    ["Entry Price", Boolean(toNumber(data.entryPrice))],
    ["Stop Loss", Boolean(toNumber(data.stopLoss))],
    ["Take Profit", Boolean(toNumber(data.takeProfit))],
    ["Position Size", Boolean(toNumber(data.positionSize))],
    ["Setup", Boolean(data.setup || data.customSetupName.trim())],
    ["Session", Boolean(data.session)],
    ["HTF Bias", Boolean(data.htfBias)],
  ] as const;

  for (const [label, complete] of requiredChecks) {
    if (!complete) missingRequired.push(label);
  }

  const entry = toNumber(data.entryPrice);
  const stop = toNumber(data.stopLoss);
  const target = toNumber(data.takeProfit);

  if (entry != null && stop != null) {
    if (data.direction === "Buy" && stop >= entry) {
      warnings.push("Stop loss should be below entry for a long trade.");
    }
    if (data.direction === "Sell" && stop <= entry) {
      warnings.push("Stop loss should be above entry for a short trade.");
    }
  }

  if (entry != null && target != null) {
    if (data.direction === "Buy" && target <= entry) {
      warnings.push("Take profit should be above entry for a long trade.");
    }
    if (data.direction === "Sell" && target >= entry) {
      warnings.push("Take profit should be below entry for a short trade.");
    }
  }

  if (risk.riskRewardRatio != null && risk.riskRewardRatio < 1.5) {
    warnings.push("RR below 1.5");
  }

  if (risk.stopDistancePercent != null && risk.stopDistancePercent < 0.1) {
    warnings.push("SL appears too tight");
  }

  const completedFields = requiredChecks.filter(([, complete]) => complete).length;
  const completionPercent = Math.round((completedFields / requiredChecks.length) * 100);
  const qualityScore = calculateQualityScore(risk, warnings, completionPercent);

  return {
    canSaveTrade: missingRequired.length === 0,
    missingRequired,
    warnings,
    completionPercent,
    qualityScore,
    positionSizeValidation:
      risk.riskAmount == null
        ? "Enter prices and size"
        : "Captured; connect account risk limit to enforce max risk",
  };
}

function calculateQualityScore(
  risk: TradeRiskSnapshot,
  warnings: string[],
  completionPercent: number
): number | null {
  if (risk.riskRewardRatio == null) return null;
  let score = Math.min(100, Math.round(completionPercent * 0.45 + Math.min(risk.riskRewardRatio, 4) * 13.75));
  score -= warnings.length * 12;
  return Math.max(0, Math.min(100, score));
}

export function buildAssistantInsights(
  risk: TradeRiskSnapshot,
  validation: TradeCaptureValidation
): TradeAssistantInsight[] {
  const insights: TradeAssistantInsight[] = [];

  if (risk.riskRewardRatio != null) {
    insights.push({
      label: "Expected RR",
      value: risk.riskRewardRatio.toFixed(2),
      tone: risk.riskRewardRatio >= 2 ? "healthy" : "warning",
    });
  }

  if (risk.riskAmount != null) {
    insights.push({
      label: "Risk Assessment",
      value: validation.warnings.length === 0 ? "Clean ticket" : "Needs review",
      tone: validation.warnings.length === 0 ? "healthy" : "warning",
    });
  }

  if (risk.positionValue != null) {
    insights.push({
      label: "Position Size",
      value: validation.positionSizeValidation,
      tone: "neutral",
    });
  }

  if (validation.qualityScore != null) {
    insights.push({
      label: "Trade Quality",
      value: `${validation.qualityScore}/100`,
      tone: validation.qualityScore >= 75 ? "healthy" : validation.qualityScore < 55 ? "warning" : "neutral",
    });
  }

  return insights;
}

export function formatMoney(value: number | null): string {
  if (value == null) return "-";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: value < 100 ? 2 : 0,
  }).format(value);
}
