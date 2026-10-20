'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, LayoutDashboard } from 'lucide-react';
import { useAuth } from '@/context/AuthProvider';
import { ProfileAvatar } from '@/components/layout/UserMenu';
import { NAV_MODULES, NAV_BADGE_TONE, NAV_BADGE_FALLBACK, type NavItem } from '@/components/layout/nav-config';
import { cn } from '@/lib/utils';

/** Modules with several tools get their own section; single-tool modules share one. */
const SECTIONS = [
  ...NAV_MODULES.filter((m) => (m.items?.length ?? 0) > 1).map((m) => ({ id: m.id, label: m.label, items: m.items! })),
  {
    id: 'tools',
    label: 'Tools & AI',
    items: NAV_MODULES.filter((m) => m.items?.length === 1).flatMap((m) => m.items!),
  },
];

function ToolTile({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className="group flex items-start gap-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4 transition-colors hover:border-neutral-600"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-neutral-850 text-brand-400">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-body font-medium text-foreground">{item.label}</span>
          {item.badge && (
            <span className={cn('rounded border px-1.5 py-px text-2xs font-medium', NAV_BADGE_TONE[item.badge] ?? NAV_BADGE_FALLBACK)}>
              {item.badge}
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-caption text-neutral-400">{item.desc}</span>
      </span>
      <ArrowRight
        className="mt-1 h-4 w-4 shrink-0 text-neutral-500 transition-colors group-hover:text-foreground"
        aria-hidden
      />
    </Link>
  );
}

export default function AppHomePage() {
  const { user } = useAuth();
  const displayName = user?.username ?? 'there';

  // Rendered after mount so server and client markup agree.
  const [today, setToday] = useState('');
  useEffect(() => {
    setToday(
      new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    );
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-col gap-4 rounded-xl border border-neutral-800 bg-neutral-900 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-center gap-4">
          <ProfileAvatar name={displayName} size={48} />
          <div>
            <h1 className="text-title text-foreground">Welcome back, {displayName}</h1>
            <p className="mt-1 text-body text-neutral-400">
              Scan the market, review your journal, or ask the copilot.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {today && <span className="text-caption text-neutral-400">{today}</span>}
          <Link
            href="/dashboard"
            className="inline-flex h-9 items-center gap-2 rounded-md bg-brand-600 px-4 text-label font-medium text-white transition-colors hover:bg-brand-700"
          >
            <LayoutDashboard className="h-4 w-4" aria-hidden />
            Open dashboard
          </Link>
        </div>
      </header>

      {SECTIONS.map((section) => (
        <section key={section.id} aria-labelledby={`home-${section.id}`} className="space-y-3">
          <h2 id={`home-${section.id}`} className="text-subheading text-foreground">
            {section.label}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {section.items.map((item) => (
              <ToolTile key={item.href} item={item} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
