/**
 * Nivro — Frontend Environment Configuration
 * ================================================
 * Single source of truth for all frontend configuration.
 *
 * Import `env` from here — never read `process.env` directly in app code:
 *
 *   import { env } from "@/config/env";
 *   fetch(`${env.fastapiUrl}/api/v2/...`);
 *
 * Note: NEXT_PUBLIC_* variables are inlined at build time by Next.js, so
 * this module is safe to import from both Server and Client Components.
 */

const IS_PROD = process.env.NODE_ENV === 'production';

/**
 * Resolve an already-read NEXT_PUBLIC_* value, with a development-only fallback.
 *
 * Takes the VALUE, not the variable name — the caller must pass a literal
 * `process.env.NEXT_PUBLIC_X` expression. Next.js inlines `NEXT_PUBLIC_*`
 * variables into the client bundle via static text replacement of that exact
 * literal expression at build time; it cannot see through a dynamic
 * `process.env[key]` lookup, which silently evaluates to `undefined` in the
 * browser regardless of what's set in the deployment environment.
 *
 * In production a missing value logs a loud warning — a localhost fallback
 * must never silently reach production — but still returns the fallback so
 * the build / SSR does not crash. Always returns a string (type-safe).
 */
function resolvePublicEnv(value: string | undefined, varName: string, devFallback: string): string {
  if (value && value.length > 0) return value;

  if (IS_PROD) {
    console.warn(
      `[Nivro] Missing ${varName} in production — falling back to "${devFallback}". ` +
      `Set ${varName} in the frontend deployment environment (it is inlined at build time).`,
    );
  }
  return devFallback;
}

export const env = {
  /**
   * FastAPI backend — auth, JWT. Historically a separate Express service on
   * port 8080; auth was migrated into FastAPI (api/auth.py) so this now
   * points at the same origin as fastapiUrl below. Kept as its own var
   * because authApi.ts/aiRouteGuard.ts are still written against Express's
   * old path shapes (/api/auth/*), which FastAPI now also serves.
   * Reads NEXT_PUBLIC_API_URL (NEXT_PUBLIC_ prefix required for the browser bundle).
   */
  apiUrl: resolvePublicEnv(process.env.NEXT_PUBLIC_API_URL, 'NEXT_PUBLIC_API_URL', 'http://localhost:8000'),

  /**
   * FastAPI backend — portfolio analytics, AI generation, scanners.
   * Reads NEXT_PUBLIC_FASTAPI_URL.
   */
  fastapiUrl: resolvePublicEnv(process.env.NEXT_PUBLIC_FASTAPI_URL, 'NEXT_PUBLIC_FASTAPI_URL', 'http://localhost:8000'),

  /** Current deployment environment. */
  isDev: process.env.NODE_ENV === 'development',
  isProd: IS_PROD,
} as const;
