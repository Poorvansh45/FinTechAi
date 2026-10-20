import Link from 'next/link';
import { Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900 text-brand-400">
        <Compass className="h-6 w-6" aria-hidden />
      </span>
      <p className="mt-6 text-label font-medium text-brand-400">Error 404</p>
      <h1 className="mt-1 text-title text-foreground">Page not found</h1>
      <p className="mt-2 text-body text-neutral-400">
        The page you&apos;re looking for doesn&apos;t exist or has moved.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="inline-flex h-10 items-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700"
        >
          Back to home
        </Link>
        <Link
          href="/markets"
          className="inline-flex h-10 items-center rounded-md border border-neutral-700 px-4 text-sm font-medium text-foreground transition-colors hover:bg-foreground/5"
        >
          Open markets
        </Link>
      </div>
    </div>
  );
}
