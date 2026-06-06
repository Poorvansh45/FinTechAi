import type {
  ExitMetrics,
  TradeAssistantInsight,
  TradeCaptureData,
  TradeCaptureValidation,
  TradeRiskSnapshot,
} from "@/types/trade-capture";

function toNumber(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function toNumberAllowZero(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

export function calculateExitMetrics(
  data: TradeCaptureData,
  risk: TradeRiskSnapshot
): ExitMetrics {
  const entry = toNumber(data.entryPrice);
  const exit = toNumberAllowZero(data.exitPrice);
  const size = toNumber(data.positionSize);

  if (entry == null || exit == null) {
    return { pnl: null, profitPercent: null, rrAchieved: null, durationMinutes: null };
  }

  const dir = data.direction === "Buy" ? 1 : -1;
  const priceDiff = (exit - entry) * dir;
  const pnl = size != null ? priceDiff * size : priceDiff;
  const profitPercent = entry > 0 ? (priceDiff / entry) * 100 : null;

  const rrAchieved =
    risk.riskPerUnit != null && risk.riskPerUnit > 0
      ? Math.abs(exit - entry) / risk.riskPerUnit * (priceDiff >= 0 ? 1 : -1)
      : null;

  // Duration
  let durationMinutes: number | null = null;
  if (data.exitDate && data.exitTime && data.entryAt) {
    try {
      const exitDT = new Date(`${data.exitDate}T${data.exitTime}`);
      const entryDT = new Date(data.entryAt);
      if (!isNaN(exitDT.getTime()) && !isNaN(entryDT.getTime())) {
        durationMinutes = Math.max(0, Math.round((exitDT.getTime() - entryDT.getTime()) / 60000));
      }
    } catch {
      // ignore parse errors
    }
  }

  return { pnl, profitPercent, rrAchieved, durationMinutes };
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

  // Completion includes optional fields for better journal quality tracking
  const optionalChecks = [
    Boolean(data.confidence > 0),
    Boolean(toNumberAllowZero(data.exitPrice) !== null && data.exitPrice !== ""),
    Boolean(data.timeframe),
  ];
  const totalChecks = requiredChecks.length + optionalChecks.length;
  const completedFields =
    requiredChecks.filter(([, complete]) => complete).length +
    optionalChecks.filter(Boolean).length;
  const completionPercent = Math.round((completedFields / totalChecks) * 100);
  const qualityScore = calculateQualityScore(risk, warnings, completionPercent, data.confidence);

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
  completionPercent: number,
  confidence: number
): number | null {
  if (risk.riskRewardRatio == null) return null;
  let score = Math.min(100, Math.round(
    completionPercent * 0.35 +
    Math.min(risk.riskRewardRatio, 4) * 11 +
    Math.min(confidence, 10) * 2
  ));
  score -= warnings.length * 10;
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

export function formatDuration(minutes: number | null): string {
  if (minutes == null) return "-";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}
