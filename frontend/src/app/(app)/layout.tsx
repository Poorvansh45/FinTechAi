import { AuthGuard } from '@/components/auth/AuthGuard';

/**
 * All routes inside (app)/ are protected.
 * AuthGuard: session required. Onboarding handled globally in SessionGate.
 */
export default function AppRouteLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
