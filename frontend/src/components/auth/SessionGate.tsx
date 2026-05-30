'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthProvider';

/**
 * Global session gate:
 * - Redirects authenticated users away from auth pages → /home
 * - Redirects authenticated users from landing / → /home
 */
export function SessionGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isAuthRoute =
    pathname === '/auth' ||
    pathname === '/login' ||
    pathname === '/onboarding' ||
    pathname.startsWith('/auth');

  // Redirect authenticated users away from auth pages
  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) return;
    if (isAuthRoute) {
      router.replace('/');
    }
  }, [isAuthenticated, loading, isAuthRoute, router]);

  return <>{children}</>;
}
