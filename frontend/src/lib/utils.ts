import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// Teach tailwind-merge about the semantic type scale (tailwind.config.ts →
// fontSize). Without this, `text-title` would be treated as a colour and be
// silently dropped when merged with `text-foreground`.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "2xs",
            "display",
            "title",
            "heading",
            "subheading",
            "body",
            "label",
            "caption",
          ],
        },
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Status colours that some API payloads carry as fixed hex values (dark-theme tuned).
const API_HEX_TOKENS: Record<string, string> = {
  "#22c55e": "positive-400", "#4ade80": "positive-400", "#10b981": "positive-400", "#34d399": "positive-400",
  "#ef4444": "negative-400", "#f87171": "negative-400",
  "#f59e0b": "warning-400", "#fbbf24": "warning-400",
  "#94a3b8": "neutral-400",
  "#818cf8": "brand-400", "#8b5cf6": "brand-400", "#a78bfa": "brand-400",
}

/**
 * Maps the fixed hex status colours inside an API payload onto theme tokens, so
 * values the UI paints as text stay legible in both themes. Everything else in
 * the payload is returned unchanged.
 */
export function themeColors<T>(payload: T): T {
  if (typeof payload === "string") {
    const token = API_HEX_TOKENS[payload.toLowerCase()]
    return (token ? `rgb(var(--${token}))` : payload) as unknown as T
  }
  if (Array.isArray(payload)) return payload.map(themeColors) as unknown as T
  if (payload && typeof payload === "object") {
    return Object.fromEntries(
      Object.entries(payload as Record<string, unknown>).map(([k, v]) => [k, themeColors(v)])
    ) as T
  }
  return payload
}

/**
 * Applies an alpha to a theme colour, for inline styles that tint a status
 * colour (`withAlpha('rgb(var(--positive-500))', 0.12)`). Plain string
 * concatenation (`${color}20`) only works for hex colours, so this accepts
 * token colours, hex, or any other CSS colour.
 */
export function withAlpha(color: string, alpha: number): string {
  const a = Math.min(1, Math.max(0, alpha))
  const token = color.match(/^rgb\((var\(--[\w-]+\))(?:\s*\/\s*[\d.]+%?)?\)$/)
  if (token) return `rgb(${token[1]} / ${+a.toFixed(3)})`
  if (/^#[0-9a-f]{6}$/i.test(color)) return color + Math.round(a * 255).toString(16).padStart(2, "0")
  return `color-mix(in srgb, ${color} ${+(a * 100).toFixed(1)}%, transparent)`
}
