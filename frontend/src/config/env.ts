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
 * Read a NEXT_PUBLIC_* variable with a development-only fallback.
 *
 * In production a missing value logs a loud warning — a localhost fallback
 * must never silently reach production — but still returns the fallback so
 * the build / SSR does not crash. Always returns a string (type-safe).
 */
function readPublicEnv(key: string, devFallback: string): string {
  const value = process.env[key];
  if (value && value.length > 0) return value;

  if (IS_PROD) {
    console.warn(
      `[Nivro] Missing ${key} in production — falling back to "${devFallback}". ` +
      `Set ${key} in the frontend deployment environment (it is inlined at build time).`,
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
  apiUrl: readPublicEnv('NEXT_PUBLIC_API_URL', 'http://localhost:8000'),

  /**
   * FastAPI backend — portfolio analytics, AI generation, scanners.
   * Reads NEXT_PUBLIC_FASTAPI_URL.
   */
  fastapiUrl: readPublicEnv('NEXT_PUBLIC_FASTAPI_URL', 'http://localhost:8000'),

  /** Current deployment environment. */
  isDev: process.env.NODE_ENV === 'development',
  isProd: IS_PROD,
} as const;
