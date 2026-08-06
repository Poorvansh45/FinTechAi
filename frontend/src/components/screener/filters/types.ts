/**
 * Shared filter primitives for every Screener page (LaunchPad, Alpha Zone,
 * Technical, Volume, and future scanners).
 *
 * Value model: `null` means "unset / no constraint" — an empty input box. That
 * maps 1:1 onto how every scanner API already works (a bound is simply not sent
 * when it's absent), so swapping these components in never changes filtering.
 */

export type RangeValue = {
  min: number | null;
  max: number | null;
};

export const EMPTY_RANGE: RangeValue = { min: null, max: null };

export type RangePreset = {
  label: string;
  min: number | null;
  max: number | null;
};

export type Accent =
  | "purple"
  | "blue"
  | "emerald"
  | "amber"
  | "orange"
  | "cyan";

/**
 * Static class maps — Tailwind can only see class names it can statically
 * analyse, so accents are looked up rather than interpolated.
 */
export const ACCENT: Record<
  Accent,
  {
    text: string;
    fill: string;
    thumb: string;
    ring: string;
    chipOn: string;
    cardOn: string;
    inputFocus: string;
  }
> = {
  purple: {
    text: "text-purple-300",
    fill: "bg-purple-500/70",
    thumb: "bg-purple-400 border-purple-200/40",
    ring: "focus-visible:ring-purple-500/60",
    chipOn: "bg-purple-500/15 border-purple-500/40 text-purple-200",
    cardOn: "border-purple-500/30 bg-purple-500/[0.04]",
    inputFocus: "focus:border-purple-500/70 focus:ring-purple-500/20",
  },
  blue: {
    text: "text-blue-300",
    fill: "bg-blue-500/70",
    thumb: "bg-blue-400 border-blue-200/40",
    ring: "focus-visible:ring-blue-500/60",
    chipOn: "bg-blue-500/15 border-blue-500/40 text-blue-200",
    cardOn: "border-blue-500/30 bg-blue-500/[0.04]",
    inputFocus: "focus:border-blue-500/70 focus:ring-blue-500/20",
  },
  emerald: {
    text: "text-emerald-300",
    fill: "bg-emerald-500/70",
    thumb: "bg-emerald-400 border-emerald-200/40",
    ring: "focus-visible:ring-emerald-500/60",
    chipOn: "bg-emerald-500/15 border-emerald-500/40 text-emerald-200",
    cardOn: "border-emerald-500/30 bg-emerald-500/[0.04]",
    inputFocus: "focus:border-emerald-500/70 focus:ring-emerald-500/20",
  },
  amber: {
    text: "text-amber-300",
    fill: "bg-amber-500/70",
    thumb: "bg-amber-400 border-amber-200/40",
    ring: "focus-visible:ring-amber-500/60",
    chipOn: "bg-amber-500/15 border-amber-500/40 text-amber-200",
    cardOn: "border-amber-500/30 bg-amber-500/[0.04]",
    inputFocus: "focus:border-amber-500/70 focus:ring-amber-500/20",
  },
  orange: {
    text: "text-orange-300",
    fill: "bg-orange-500/70",
    thumb: "bg-orange-400 border-orange-200/40",
    ring: "focus-visible:ring-orange-500/60",
    chipOn: "bg-orange-500/15 border-orange-500/40 text-orange-200",
    cardOn: "border-orange-500/30 bg-orange-500/[0.04]",
    inputFocus: "focus:border-orange-500/70 focus:ring-orange-500/20",
  },
  cyan: {
    text: "text-cyan-300",
    fill: "bg-cyan-500/70",
    thumb: "bg-cyan-400 border-cyan-200/40",
    ring: "focus-visible:ring-cyan-500/60",
    chipOn: "bg-cyan-500/15 border-cyan-500/40 text-cyan-200",
    cardOn: "border-cyan-500/30 bg-cyan-500/[0.04]",
    inputFocus: "focus:border-cyan-500/70 focus:ring-cyan-500/20",
  },
};

/** True when a range actually constrains anything. */
export const isRangeActive = (v: RangeValue) => v.min !== null || v.max !== null;

/** Round to the nearest step and strip float noise (0.30000000000000004). */
export function snapToStep(value: number, step: number, min: number): number {
  const snapped = Math.round((value - min) / step) * step + min;
  const decimals = (String(step).split(".")[1] || "").length;
  return Number(snapped.toFixed(decimals));
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

const trim = (n: number) => Number(n.toFixed(1)).toString();

/**
 * Compact K/M formatting for volume-style magnitudes (20000 → "20K",
 * 10000000 → "10M"). Deliberately K/M rather than the Indian L/Cr scale so
 * volume reads the same way it does on the charting tools traders use.
 */
export function formatCompact(v: number): string {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${trim(v / 1_000_000)}M`;
  if (a >= 1_000) return `${trim(v / 1_000)}K`;
  return String(Math.round(v));
}
