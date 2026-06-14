// ── Shared screener types ────────────────────────────────────────────────────

export interface Indicators {
  rsi_14?: number | null;
  ema_9?: number | null;
  ema_50?: number | null;
  ema_200?: number | null;
  ema_50_dist_pct?: number | null;
  ema_200_dist_pct?: number | null;
  macd?: number | null;
  macd_signal?: number | null;
  macd_hist?: number | null;
}

export interface FVGZone {
  gap_low: number;
  gap_high: number;
  gap_mid: number;
  gap_size: number;
  gap_size_pct: number;
  displacement: number;
  fvg_score: number;
  strength: "Strong" | "Medium" | "Weak";
  status: "Untouched" | "Touched" | "PartiallyFilled" | "MostlyFilled";
  mitigation_pct: number;
  touch_count: number;
  distance_pct: number;
  age_days: number;
  start_date: string;
  end_date: string;
}

export interface SurgeEvent {
  surge_date: string;
  surge_price: number;
  volume_ratio: number;
  day_return_pct: number | null;
  return_1d: number | null;
  return_2d: number | null;
  return_3d: number | null;
  return_5d: number | null;
  return_10d: number | null;
  return_20d: number | null;
  max_gain_pct: number | null;
  max_drawdown_pct: number | null;
}

export interface SurgeStats {
  total_surges: number;
  avg_1d_return: number | null;
  avg_2d_return: number | null;
  avg_3d_return: number | null;
  avg_5d_return: number | null;
  avg_10d_return: number | null;
  avg_20d_return: number | null;
  win_rate_1d: number | null;
  win_rate_2d: number | null;
  win_rate_5d: number | null;
  win_rate_10d: number | null;
  win_rate_20d: number | null;
  max_gain_ever: number | null;
  max_drawdown_ever: number | null;
}

export interface SMCStructure {
  last_bullish_event?: "BOS" | "CHoCH" | null;
  last_bullish_date?: string | null;
  total_bos?: number;
  total_choch?: number;
}

export interface SMCZone {
  zone_high: number;
  zone_low: number;
  zone_mid: number;
  created_date: string;
  status: "Active" | "Invalidated";
  touch_count: number;
  distance_pct: number;
  zone_width_pct: number;
  zone_age_days: number;
  event?: "BOS" | "CHoCH";
  direction?: "bullish" | "bearish";
}

// Universal stock row — covers all scanner modes
export interface StockData {
  symbol: string;
  company_name?: string;
  price?: number | null;
  ltp?: number | null;
  volume?: number | null;
  avg_volume_20d?: number | null;
  indicators?: Indicators;

  // FVG fields
  best_fvg_score?: number | null;
  top_bullish_fvgs?: FVGZone[];
  top_bearish_fvgs?: FVGZone[];
  nearest_bullish_fvg?: FVGZone | null;
  total_fvgs_bullish?: number;
  has_fvg_bullish?: boolean;

  // Volume surge fields
  has_current_surge?: boolean;
  current_volume_ratio?: number | null;
  surge_history?: SurgeEvent[];
  surge_stats?: SurgeStats;

  // Momentum fields
  momentum_score?: number | null;
  category?: string;
  rsi?: number | null;
  ema_50_dist_pct?: number | null;
  ema_200_dist_pct?: number | null;
  volume_ratio?: number | null;
  week52_high?: number | null;
  week52_low?: number | null;
  week52_high_dist_pct?: number | null;
  relative_strength?: number | null;
  above_ema50?: boolean | null;
  above_ema200?: boolean | null;

  // SMC fields
  smc_score?: number | null;
  structure?: SMCStructure;
  demand_zones?: SMCZone[];
  supply_zones?: SMCZone[];
  nearest_demand?: SMCZone | null;
  current_zone?: "Premium" | "Equilibrium" | "Discount" | string;
  premium_discount?: Record<string, any>;
}

// Legacy alias
export type ScreenerResult = StockData;
