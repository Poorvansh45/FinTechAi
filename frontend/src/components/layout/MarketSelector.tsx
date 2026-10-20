'use client';

import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * Header market selector.
 *
 * Presentation only: India is the single supported market and is always the
 * selected one. US Markets is listed as planned and cannot be selected, so
 * nothing here touches routes, data fetching or any application state.
 */

// Windows has no flag emoji (they render as "IN"/"US" letters), so the flags
// are drawn as small inline SVGs.
function IndiaFlag({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 14" className={cn('h-3.5 w-5 shrink-0 rounded-[3px]', className)} aria-hidden>
      <rect width="20" height="14" fill="#fff" />
      <rect width="20" height="4.67" fill="#FF9933" />
      <rect y="9.33" width="20" height="4.67" fill="#138808" />
      <circle cx="10" cy="7" r="1.6" fill="none" stroke="#000080" strokeWidth="0.6" />
      <rect x="0.25" y="0.25" width="19.5" height="13.5" rx="2.5" fill="none" stroke="rgb(0 0 0 / 0.15)" strokeWidth="0.5" />
    </svg>
  );
}

function UsFlag({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 14" className={cn('h-3.5 w-5 shrink-0 rounded-[3px]', className)} aria-hidden>
      <rect width="20" height="14" fill="#fff" />
      {[0, 2, 4, 6, 8, 10, 12].map((y) => (
        <rect key={y} y={y} width="20" height="1" fill="#B22234" />
      ))}
      <rect width="9" height="7" fill="#3C3B6E" />
      <rect x="0.25" y="0.25" width="19.5" height="13.5" rx="2.5" fill="none" stroke="rgb(0 0 0 / 0.15)" strokeWidth="0.5" />
    </svg>
  );
}

export function MarketSelector({ className }: { className?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Market: Indian Markets"
          className={cn(
            'group inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 text-body font-medium text-foreground transition-colors',
            'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-accent',
            className
          )}
        >
          <IndiaFlag />
          <span className="hidden whitespace-nowrap xl:inline">Indian Markets</span>
          <ChevronDown
            aria-hidden
            className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={6} className="w-64 p-1.5">
        <DropdownMenuLabel className="px-2 pb-1 pt-1.5 text-label text-muted-foreground">Market</DropdownMenuLabel>

        <DropdownMenuItem className="gap-2.5 rounded-md px-2 py-2 bg-accent" aria-current="true">
          <IndiaFlag />
          <span className="flex-1 text-body font-medium text-foreground">Indian Markets</span>
          <Check className="h-4 w-4 text-brand-400" aria-hidden />
        </DropdownMenuItem>

        <DropdownMenuItem
          disabled
          onSelect={(e) => e.preventDefault()}
          className="gap-2.5 rounded-md px-2 py-2 data-[disabled]:opacity-100"
        >
          <UsFlag className="opacity-60" />
          <span className="flex-1 text-body text-muted-foreground">US Markets</span>
          <span className="rounded border border-border px-1.5 py-0.5 text-caption text-muted-foreground">
            Coming Soon
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
