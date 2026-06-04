import type {
  MarketType,
  SessionTag,
  Side,
  TradeStatus,
} from "@/lib/journal/types";

export type TradeSetupTag =
  | "Liquidity Sweep"
  | "FVG"
  | "Order Block"
  | "Break of Structure"
  | "Demand Zone"
  | "Supply Zone"
  | "Breakout"
  | "Reversal";

export type TradeTimeframe = "1m" | "3m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1D";
export type HtfBias = "Bullish" | "Bearish" | "Neutral" | "Ranging";

export type TradeCaptureData = {
  marketType: MarketType;
  symbol: string;
  direction: Side;
  entryPrice: string;
  stopLoss: string;
  takeProfit: string;
  positionSize: string;
  entryAt: string;
  setupId: string;
  setup: TradeSetupTag | "";
  timeframe: TradeTimeframe | "";
  htfBias: HtfBias | "";
  session: SessionTag;
  tags: string[];
  customSetupName: string;
  status: TradeStatus;
};

export type TradeRiskSnapshot = {
  riskAmount: number | null;
  rewardAmount: number | null;
  riskRewardRatio: number | null;
  positionValue: number | null;
  riskPerUnit: number | null;
  rewardPerUnit: number | null;
  stopDistancePercent: number | null;
};

export type TradeAssistantInsight = {
  label: string;
  value: string;
  tone: "neutral" | "healthy" | "warning";
};

export type TradeCaptureValidation = {
  canSaveTrade: boolean;
  missingRequired: string[];
  warnings: string[];
  completionPercent: number;
  qualityScore: number | null;
  positionSizeValidation: string;
};
