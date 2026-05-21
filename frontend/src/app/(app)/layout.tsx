import { AuthGuard } from '@/components/auth/AuthGuard';

/**
 * All routes inside (app)/ are protected.
 * AuthGuard redirects to /login if the user is not authenticated.
 */
export default function AppRouteLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
