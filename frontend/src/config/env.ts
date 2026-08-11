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
 * In production a missing value THROWS instead of falling back. This runs at
 * module load — which for a value imported by any page (directly or via
 * AuthProvider, which wraps the whole app) happens during `next build`'s
 * static-generation pass, in Node, before any bundle is ever shipped. So a
 * misconfigured Vercel environment (var scoped to Preview only, a build that
 * ran before the var was saved, a typo'd name) now fails the BUILD loudly —
 * it can no longer silently ship a bundle that talks to localhost from every
 * visitor's browser, which is what a warn-and-fallback allowed to happen
 * once already. Local dev is unaffected: IS_PROD is false there, so the
 * devFallback still applies exactly as before.
 */
function resolvePublicEnv(value: string | undefined, varName: string, devFallback: string): string {
  if (value && value.length > 0) return value;

  if (IS_PROD) {
    throw new Error(
      `[Nivro] ${varName} is not set in this production build environment. ` +
      `Set it in Vercel → Project Settings → Environment Variables, scoped to ` +
      `Production, then redeploy. Refusing to silently fall back to "${devFallback}" ` +
      `in production — that fallback is what caused login to call localhost from ` +
      `the live site.`,
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
