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
    text: "text-brand-300",
    fill: "bg-brand-500/70",
    thumb: "bg-brand-400 border-brand-200/40",
    ring: "focus-visible:ring-brand-500/60",
    chipOn: "bg-brand-500/15 border-brand-500/40 text-brand-200",
    cardOn: "border-brand-500/30 bg-brand-500/[0.04]",
    inputFocus: "focus:border-brand-500/70 focus:ring-brand-500/20",
  },
  blue: {
    text: "text-brand-300",
    fill: "bg-brand-500/70",
    thumb: "bg-brand-400 border-brand-200/40",
    ring: "focus-visible:ring-brand-500/60",
    chipOn: "bg-brand-500/15 border-brand-500/40 text-brand-200",
    cardOn: "border-brand-500/30 bg-brand-500/[0.04]",
    inputFocus: "focus:border-brand-500/70 focus:ring-brand-500/20",
  },
  emerald: {
    text: "text-positive-300",
    fill: "bg-positive-500/70",
    thumb: "bg-positive-400 border-positive-200/40",
    ring: "focus-visible:ring-positive-500/60",
    chipOn: "bg-positive-500/15 border-positive-500/40 text-positive-200",
    cardOn: "border-positive-500/30 bg-positive-500/[0.04]",
    inputFocus: "focus:border-positive-500/70 focus:ring-positive-500/20",
  },
  amber: {
    text: "text-warning-300",
    fill: "bg-warning-500/70",
    thumb: "bg-warning-400 border-warning-200/40",
    ring: "focus-visible:ring-warning-500/60",
    chipOn: "bg-warning-500/15 border-warning-500/40 text-warning-200",
    cardOn: "border-warning-500/30 bg-warning-500/[0.04]",
    inputFocus: "focus:border-warning-500/70 focus:ring-warning-500/20",
  },
  orange: {
    text: "text-warning-300",
    fill: "bg-warning-500/70",
    thumb: "bg-warning-400 border-warning-200/40",
    ring: "focus-visible:ring-warning-500/60",
    chipOn: "bg-warning-500/15 border-warning-500/40 text-warning-200",
    cardOn: "border-warning-500/30 bg-warning-500/[0.04]",
    inputFocus: "focus:border-warning-500/70 focus:ring-warning-500/20",
  },
  cyan: {
    text: "text-brand-300",
    fill: "bg-brand-500/70",
    thumb: "bg-brand-400 border-brand-200/40",
    ring: "focus-visible:ring-brand-500/60",
    chipOn: "bg-brand-500/15 border-brand-500/40 text-brand-200",
    cardOn: "border-brand-500/30 bg-brand-500/[0.04]",
    inputFocus: "focus:border-brand-500/70 focus:ring-brand-500/20",
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
