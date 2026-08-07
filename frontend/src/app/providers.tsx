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
  // Dark is the only theme now that the toggle is gone. `forcedTheme` rather
  // than `defaultTheme` + `enableSystem={false}`: next-themes persists the last
  // choice to localStorage, so anyone who had already switched to light would
  // otherwise stay stuck there with no control left to switch back.
  return (
    <ThemeProvider attribute="class" forcedTheme="dark" disableTransitionOnChange>
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
