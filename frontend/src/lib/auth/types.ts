// Auth types for MongoDB+JWT auth system

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  createdAt: string;
}

export type AuthStatus = 'initializing' | 'unauthenticated' | 'authenticated';

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;

export function validateUsername(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length < USERNAME_MIN) return `Username must be at least ${USERNAME_MIN} characters`;
  if (trimmed.length > USERNAME_MAX) return `Username must be at most ${USERNAME_MAX} characters`;
  if (!USERNAME_PATTERN.test(trimmed)) return 'Use letters, numbers, and underscores only';
  return null;
}

export function profileInitial(username: string): string {
  return username.trim().charAt(0).toUpperCase() || '?';
}

export function isProfileComplete(profile: UserProfile | null): boolean {
  return !!profile?.username;
}
