/**
 * Reusable quick-preset sets. Kept here (not inline per page) so the same
 * "90+ / 80+ / 70+" language means the same thing on every scanner.
 */

import { RangePreset } from "./types";

/** Confidence / score thresholds, mirroring the ★ tiers traders already use. */
export const CONFIDENCE_PRESETS: RangePreset[] = [
  { label: "★★★★★ 90+", min: 90, max: null },
  { label: "★★★★ 80+", min: 80, max: null },
  { label: "★★★ 70+", min: 70, max: null },
];

/** Price bands in ₹. */
export const PRICE_PRESETS: RangePreset[] = [
  { label: "< ₹500", min: null, max: 500 },
  { label: "₹500–1K", min: 500, max: 1000 },
  { label: "₹1K–3K", min: 1000, max: 3000 },
];

/** Expected/projected return thresholds in %. */
export const RETURN_PRESETS: RangePreset[] = [
  { label: "10%+", min: 10, max: null },
  { label: "15%+", min: 15, max: null },
  { label: "20%+", min: 20, max: null },
];

/** Average-volume liquidity floors (shares/day), in K/M. */
export const VOLUME_PRESETS: RangePreset[] = [
  { label: "20K+", min: 20_000, max: null },
  { label: "100K+", min: 100_000, max: null },
  { label: "1M+", min: 1_000_000, max: null },
];

/** RSI regions. */
export const RSI_PRESETS: RangePreset[] = [
  { label: "Oversold <30", min: null, max: 30 },
  { label: "Neutral 30–70", min: 30, max: 70 },
  { label: "Overbought 70+", min: 70, max: null },
];

/** Above/below an EMA, in % distance. */
export const EMA_DIST_PRESETS: RangePreset[] = [
  { label: "Above", min: 0, max: null },
  { label: "Below", min: null, max: 0 },
  { label: "±5%", min: -5, max: 5 },
];
