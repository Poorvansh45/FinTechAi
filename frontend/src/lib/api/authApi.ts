// ─────────────────────────────────────────────────────────────────────────────
// Auth API — typed fetch wrappers for /api/auth/* endpoints
// All requests include credentials so the HTTP-only JWT cookie is sent.
// ─────────────────────────────────────────────────────────────────────────────

import { env } from '@/config/env';

const API_BASE = env.apiUrl;

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  createdAt: string;
}

export interface AuthResponse {
  success: boolean;
  user: AuthUser;
}

class AuthApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'AuthApiError';
  }
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include', // Always send/receive the HTTP-only cookie
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message =
      (data as { message?: string; error?: string }).message ||
      (data as { error?: string }).error ||
      `Request failed (${res.status})`;
    throw new AuthApiError(res.status, message);
  }

  return data as T;
}

// No apiRegister: Nivro is a closed private beta. The server has no
// /api/auth/register route — accounts are seeded by backend/scripts/seedUsers.js.
// See docs/PRIVATE-BETA.md.

/** Login an existing user */
export async function apiLogin(email: string, password: string): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

/** Logout (clears server-side cookie) */
export async function apiLogout(): Promise<void> {
  await apiFetch<{ success: boolean }>('/api/auth/logout', {
    method: 'POST',
  });
}

/** Get current session user (returns null if not authenticated) */
export async function apiGetMe(): Promise<AuthUser | null> {
  try {
    const data = await apiFetch<AuthResponse>('/api/auth/me');
    return data.user;
  } catch (err) {
    if (err instanceof AuthApiError && err.status === 401) {
      return null; // Not authenticated — not an error
    }
    throw err;
  }
}

/** Update the authenticated user's username */
export async function apiUpdateUsername(username: string): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/api/auth/username', {
    method: 'PUT',
    body: JSON.stringify({ username }),
  });
}

/**
 * Fetch the raw JWT for the current session (same token as the httpOnly
 * cookie). Needed because that cookie is host-only to this Express origin —
 * FastAPI and this app's own /api routes run on different origins in
 * production and never see it. Returns null if not authenticated.
 */
export async function apiGetToken(): Promise<string | null> {
  try {
    const data = await apiFetch<{ success: boolean; token: string }>('/api/auth/token');
    return data.token;
  } catch (err) {
    if (err instanceof AuthApiError && err.status === 401) {
      return null;
    }
    throw err;
  }
}

export { AuthApiError };
