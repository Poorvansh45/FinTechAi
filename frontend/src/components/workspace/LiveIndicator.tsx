'use client';

export function LiveIndicator({ label = 'Live' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-positive-400">
      <span className="relative flex h-2 w-2">
        <span className="relative inline-flex rounded-full h-2 w-2 bg-positive-500" />
      </span>
      {label}
    </span>
  );
}
