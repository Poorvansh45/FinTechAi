/**
 * Shared guard for the Gemini-backed Next.js API routes (/api/copilot/chat,
 * /api/journal/analyze). These call out to Gemini with our API key, so an
 * unauthenticated, unlimited endpoint is a direct quota/cost-abuse vector.
 *
 * Auth is verified by forwarding the caller's Authorization header to
 * Express's existing GET /api/auth/me — Express remains the single source of
 * truth for JWT verification; this file never sees JWT_SECRET.
 *
 * Rate limiting is a simple in-memory sliding window (no Redis, per the
 * "lightweight, no external services" constraint). Known limitation: state is
 * per server instance/process and resets on redeploy or cold start — this is
 * a basic abuse deterrent, not a distributed rate limiter.
 */

const EXPRESS_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;

const requestLog = new Map<string, number[]>();

function pruneOld(timestamps: number[], now: number): number[] {
  return timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
}

/** Returns true if this key is currently rate-limited. */
export function isRateLimited(key: string): boolean {
  const now = Date.now();
  const recent = pruneOld(requestLog.get(key) ?? [], now);
  recent.push(now);
  requestLog.set(key, recent);
  return recent.length > RATE_LIMIT_MAX_REQUESTS;
}

/**
 * Verifies the request is authenticated by asking Express. Returns the
 * user id on success, or null if unauthenticated/invalid.
 */
export async function verifyAuth(req: Request): Promise<string | null> {
  const authorization = req.headers.get('authorization');
  const cookie = req.headers.get('cookie');

  if (!authorization && !cookie) return null;

  try {
    const res = await fetch(`${EXPRESS_URL}/api/auth/me`, {
      headers: {
        ...(authorization ? { Authorization: authorization } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}

/** Identify the caller for rate limiting: prefer user id, fall back to IP. */
export function rateLimitKey(req: Request, userId: string | null): string {
  if (userId) return `user:${userId}`;
  const forwardedFor = req.headers.get('x-forwarded-for');
  return `ip:${forwardedFor?.split(',')[0]?.trim() ?? 'unknown'}`;
}
