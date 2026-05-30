'use client';

import dynamic from 'next/dynamic';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/context/AuthProvider';
import { SessionGate } from '@/components/auth/SessionGate';
import { Toaster } from '@/components/ui/toaster';
import { OfflineBanner } from '@/components/common/OfflineBanner';

const AppLayout = dynamic(
  () => import('@/components/layout/app-layout').then((mod) => mod.AppLayout),
  { ssr: false }
);

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <AuthProvider>
        <SessionGate>
          <AppLayout>{children}</AppLayout>
        </SessionGate>
        <Toaster />
        <OfflineBanner />
      </AuthProvider>
    </ThemeProvider>
  );
}
