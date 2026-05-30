'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Onboarding page is no longer needed — username is collected at signup.
 *  Redirects straight to home. */
export default function OnboardingPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/');
  }, [router]);
  return (
    <div className="fixed inset-0 bg-[#080C14] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
    </div>
  );
}
