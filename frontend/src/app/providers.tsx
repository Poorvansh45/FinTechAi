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
  // Light and dark are both first-class. First visit follows the operating
  // system; an explicit choice is persisted under `nivro-theme`. next-themes
  // injects a blocking script that sets the class before first paint, so there
  // is no flash of the wrong theme. (The storage key is new on purpose — the
  // previous build forced dark, and a stale `theme` value must not override
  // the OS preference.)
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="nivro-theme"
      disableTransitionOnChange
    >
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
