// firebase.ts — REMOVED
// Firebase has been replaced with MongoDB + JWT authentication.
// This file is intentionally left as a shim to catch any forgotten imports.
// If you see this error, update the importing file to use @/lib/api/authApi instead.

export {};

if (typeof window !== 'undefined') {
  console.warn('[FinTechAI] firebase.ts is a removed stub. Update any imports to use @/lib/api/authApi.');
}
