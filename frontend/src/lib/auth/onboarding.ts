import type { UserProfile } from './types';
import { isProfileComplete } from './types';

/** Only true when we are certain the user has never finished setup */
export function needsOnboarding(profile: UserProfile | null): boolean {
  if (!profile) return false;
  return !isProfileComplete(profile);
}

export function getPostAuthRedirect(): string {
  return '/';
}
