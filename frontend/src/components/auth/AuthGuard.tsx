'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthProvider';

interface AuthGuardProps {
  children: React.ReactNode;
}

/** Protects routes — redirects unauthenticated users to sign in */
export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      router.replace('/auth?mode=signin');
    }
  }, [isAuthenticated, loading, router]);

  if (loading) return null;
  if (!isAuthenticated) return null;

  return <>{children}</>;
}
