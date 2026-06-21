/**
 * FinTechAI — Environment Configuration
 * ========================================
 * Centralised, type-safe env access with safe defaults.
 *
 * COPY TO: frontend/src/config/env.ts
 */

function requireEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (!value) {
    if (typeof window !== 'undefined') {
      // Client-side: warn but don't throw so build still works
      console.warn(
        `[FinTechAI] Missing environment variable: ${key}. ` +
        `Add it to frontend/.env`,
      );
    }
    return '';
  }
  return value;
}

export const env = {
  /**
   * Express backend — auth, markets proxy.
   * Reads NEXT_PUBLIC_API_URL (must have NEXT_PUBLIC_ prefix to be
   * available in the browser bundle).
   */
  backendApiUrl: requireEnv('NEXT_PUBLIC_API_URL', 'http://localhost:8080'),

  /**
   * FastAPI backend — portfolio analytics, AI generation.
   * Reads NEXT_PUBLIC_FASTAPI_URL.
   */
  fastapiUrl: requireEnv('NEXT_PUBLIC_FASTAPI_URL', 'http://localhost:8000'),

  /**
   * Firebase — optional, app works without it.
   */
  firebase: {
    apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
    authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
    projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
    storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
    measurementId:     process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? '',
  },

  /** Current deployment environment. */
  isDev: process.env.NODE_ENV === 'development',
  isProd: process.env.NODE_ENV === 'production',
} as const;
