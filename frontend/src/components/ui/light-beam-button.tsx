import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface LightBeamButtonProps {
  href?: string;
  onClick?: (e: React.MouseEvent) => void;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Primary call-to-action. (Name kept for existing imports; it is now a plain
 * solid button: no sheen, glow or scale animation.)
 */
export function LightBeamButton({ href, onClick, children, className, style }: LightBeamButtonProps) {
  const classes = cn(
    'inline-flex h-11 items-center justify-center gap-2 rounded-md bg-brand-600 px-6 text-sm font-medium text-white',
    'transition-colors hover:bg-brand-700',
    className,
  );

  if (href) {
    return (
      <Link href={href} onClick={onClick} className={classes} style={style}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={classes} style={style}>
      {children}
    </button>
  );
}
