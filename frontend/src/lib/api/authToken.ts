/**
 * In-memory cache for the Express-issued JWT, used to attach
 * "Authorization: Bearer <token>" when calling services that cannot see
 * Express's host-only httpOnly cookie (FastAPI, this app's own /api routes
 * in production). Never persisted to localStorage — cleared on logout and
 * on full page reload, same lifetime as the in-memory auth state it mirrors.
 */

import { apiGetToken } from './authApi';

let cachedToken: string | null = null;

/** Set by AuthProvider after login/register/session-restore, and on logout (null). */
export function setCachedAuthToken(token: string | null): void {
  cachedToken = token;
}

/** Returns the cached token, fetching it once from Express if not yet cached. */
export async function getAuthToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  const token = await apiGetToken();
  cachedToken = token;
  return token;
}

/** Convenience: `{ Authorization: 'Bearer ...' }` or `{}` if unauthenticated. */
export async function authHeader(): Promise<Record<string, string>> {
  const token = await getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
