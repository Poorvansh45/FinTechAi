// token-service.ts — stub
// Firebase getIdToken() is no longer used.
// JWT is stored in an HTTP-only cookie set by the backend.
// The cookie is automatically sent with all fetch() calls using credentials:'include'.
// This stub keeps client.ts from breaking compilation.

/** @deprecated JWT is now cookie-based. Always returns null. */
export async function getAccessToken(_forceRefresh = false): Promise<string | null> {
  return null;
}
