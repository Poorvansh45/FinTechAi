'use client';

import type { LucideIcon } from 'lucide-react';

export function SectionHeader({ icon: Icon, title, live }: { icon?: LucideIcon; title: string; live?: boolean }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      {Icon && <Icon className="w-3.5 h-3.5 text-brand-400" />}
      <h2 className="text-[11px] font-bold text-neutral-500">{title}</h2>
      {live && (
        <span className="w-1.5 h-1.5 rounded-full bg-positive-400" />
      )}
      <div className="flex-1 h-px bg-gradient-to-r from-foreground/[0.06] to-transparent" />
    </div>
  );
}
