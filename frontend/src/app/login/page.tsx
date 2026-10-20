'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const qs = searchParams.toString();
    router.replace(qs ? `/auth?${qs}` : '/auth?intent=signin');
  }, [router, searchParams]);

  return (
    <div className="fixed inset-0 bg-neutral-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-neutral-950" />}>
      <LoginRedirect />
    </Suspense>
  );
}
