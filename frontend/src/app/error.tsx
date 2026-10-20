'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';

/** Route-level error boundary: keeps the app shell and theme instead of the framework's blank fallback. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900 text-warning-400">
        <TriangleAlert className="h-6 w-6" aria-hidden />
      </span>
      <h1 className="mt-6 text-title text-foreground">Something went wrong</h1>
      <p className="mt-2 text-body text-neutral-400">
        This page hit an unexpected error. You can try again, or head back to the start page.
      </p>
      {error.digest && <p className="mt-2 text-caption text-neutral-500">Reference: {error.digest}</p>}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-10 items-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700"
        >
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex h-10 items-center rounded-md border border-neutral-700 px-4 text-sm font-medium text-foreground transition-colors hover:bg-foreground/5"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
