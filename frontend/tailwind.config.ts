import type {Config} from 'tailwindcss';

/**
 * Nivro design tokens
 * ───────────────────
 * Every colour below resolves to a CSS variable defined in `src/app/globals.css`
 * (`:root` = light, `.dark` = dark), so one class — `bg-neutral-900`,
 * `text-brand-400`, `border-border` — renders correctly in BOTH themes.
 *
 *   neutral   surfaces, borders and the text hierarchy
 *             950 page · 900 card · 850 inset/raised · 800 hairline & subtle fill
 *             700 strong border · 600 faint text · 500 subtle · 400 muted
 *             300 body · 200–50 primary text
 *   brand     the single interactive accent (links, primary actions, focus)
 *   positive  gains / success      negative  losses / errors / destructive
 *   warning   caution
 *
 * The semantic shadcn tokens (background, card, muted, border …) are aliases of
 * these same scales, so there is exactly one palette to tune.
 */

const rgb = (variable: string) => `rgb(var(--${variable}) / <alpha-value>)`;

const scale = (name: string, shades: Array<number | string>) =>
  Object.fromEntries(shades.map((s) => [String(s), rgb(`${name}-${s}`)]));

const NEUTRAL_SHADES = [50, 100, 200, 250, 300, 400, 500, 600, 650, 700, 800, 850, 900, 950];
const ACCENT_SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

const neutral = scale('neutral', NEUTRAL_SHADES);
const brand = scale('brand', ACCENT_SHADES);
const positive = scale('positive', ACCENT_SHADES);
const negative = scale('negative', ACCENT_SHADES);
const warning = scale('warning', ACCENT_SHADES);

const sans = [
  'var(--font-sans)',
  'ui-sans-serif',
  'system-ui',
  '-apple-system',
  'Segoe UI',
  'Roboto',
  'Helvetica Neue',
  'Arial',
  'sans-serif',
];
const mono = [
  'var(--font-mono)',
  'ui-monospace',
  'SFMono-Regular',
  'Menlo',
  'Consolas',
  'monospace',
];

export default {
  darkMode: ['class'],
  // Scan all of src: AuthProvider (src/context) renders the app-wide loading screen
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: {
        '2xl': '1200px',
      },
    },
    extend: {
      fontFamily: {
        sans,
        mono,
        // Legacy keys kept so any existing `font-body` / `font-code` still resolve.
        body: sans,
        headline: sans,
        code: mono,
      },
      fontSize: {
        // 11px floor for captions / badges — nothing in the UI should be smaller.
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],

        // Semantic type scale (use these in new / rewritten components).
        //   display    landing hero only
        //   title      page title (one per page)
        //   heading    section heading
        //   subheading card / panel title
        //   body       default UI text
        //   label      form labels, table headers, KPI captions (sentence case)
        //   caption    helper text, timestamps, legal / informational copy
        display: [
          'clamp(2.25rem, 1.4rem + 3vw, 3.5rem)',
          { lineHeight: '1.06', letterSpacing: '-0.03em', fontWeight: '600' },
        ],
        title: ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.02em', fontWeight: '600' }],
        heading: ['1.0625rem', { lineHeight: '1.5rem', letterSpacing: '-0.01em', fontWeight: '600' }],
        subheading: ['0.9375rem', { lineHeight: '1.375rem', letterSpacing: '-0.005em', fontWeight: '600' }],
        body: ['0.875rem', { lineHeight: '1.375rem' }],
        label: ['0.75rem', { lineHeight: '1rem', fontWeight: '500' }],
        caption: ['0.75rem', { lineHeight: '1.0625rem' }],
      },
      colors: {
        // ── Semantic scales (theme-aware) ─────────────────────────────────
        neutral,
        brand,
        positive,
        negative,
        warning,

        // ── Legacy hue names → semantic scales ────────────────────────────
        // Source has been migrated to the names above; these aliases only
        // protect classes assembled dynamically or pasted from elsewhere.
        gray: neutral,
        slate: neutral,
        zinc: neutral,
        indigo: brand,
        violet: brand,
        purple: brand,
        fuchsia: brand,
        pink: brand,
        blue: brand,
        sky: brand,
        cyan: brand,
        teal: brand,
        emerald: positive,
        green: positive,
        red: negative,
        rose: negative,
        amber: warning,
        yellow: warning,
        orange: warning,

        // ── shadcn semantic tokens ────────────────────────────────────────
        background: rgb('background'),
        foreground: rgb('foreground'),
        card: {
          DEFAULT: rgb('card'),
          foreground: rgb('card-foreground'),
        },
        popover: {
          DEFAULT: rgb('popover'),
          foreground: rgb('popover-foreground'),
        },
        primary: {
          DEFAULT: rgb('primary'),
          foreground: rgb('primary-foreground'),
        },
        secondary: {
          DEFAULT: rgb('secondary'),
          foreground: rgb('secondary-foreground'),
        },
        muted: {
          DEFAULT: rgb('muted'),
          foreground: rgb('muted-foreground'),
        },
        accent: {
          DEFAULT: rgb('accent'),
          foreground: rgb('accent-foreground'),
        },
        destructive: {
          DEFAULT: rgb('destructive'),
          foreground: rgb('destructive-foreground'),
        },
        border: rgb('border'),
        input: rgb('input'),
        ring: rgb('ring'),
        chart: {
          '1': rgb('chart-1'),
          '2': rgb('chart-2'),
          '3': rgb('chart-3'),
          '4': rgb('chart-4'),
          '5': rgb('chart-5'),
        },
        sidebar: {
          DEFAULT: rgb('sidebar-background'),
          foreground: rgb('sidebar-foreground'),
          primary: rgb('sidebar-primary'),
          'primary-foreground': rgb('sidebar-primary-foreground'),
          accent: rgb('sidebar-accent'),
          'accent-foreground': rgb('sidebar-accent-foreground'),
          border: rgb('sidebar-border'),
          ring: rgb('sidebar-ring'),
        },
      },
      borderRadius: {
        // 8px base. Cards use `xl` (12px); controls use `lg`/`md`. Pills are
        // reserved for avatars, dots and switches.
        xl: 'calc(var(--radius) + 4px)',
        '2xl': 'calc(var(--radius) + 8px)',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        // Elevation is expressed with borders first; shadows are deliberately
        // soft, neutral and rare — no coloured glows.
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        md: '0 4px 10px -2px rgb(0 0 0 / 0.10), 0 2px 4px -2px rgb(0 0 0 / 0.06)',
        lg: '0 10px 24px -6px rgb(0 0 0 / 0.16), 0 4px 8px -4px rgb(0 0 0 / 0.08)',
        xl: '0 16px 36px -8px rgb(0 0 0 / 0.20), 0 6px 12px -6px rgb(0 0 0 / 0.10)',
        '2xl': '0 24px 56px -12px rgb(0 0 0 / 0.28)',
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0',
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
          },
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: '0',
          },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
