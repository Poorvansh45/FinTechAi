'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { type NavModule, type NavItem } from './nav-config';

const BADGE_COLORS: Record<string, string> = {
  Live: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  AI:   'bg-violet-500/15  text-violet-400  border-violet-500/20',
  Beta: 'bg-amber-500/15   text-amber-400   border-amber-500/20',
  New:  'bg-pink-500/15    text-pink-400    border-pink-500/20',
  'Coming soon': 'bg-slate-500/15 text-slate-400 border-slate-500/20',
};

/** Groups items by `section`, preserving first-seen order for both the
 * sections themselves and the items inside each. Items without a `section`
 * collect under a single unlabeled group, so a module with 1-2 flat items
 * (Portfolio, AI Copilot) renders exactly as it did before — grouping is
 * opt-in per item, not a mode you have to turn on for the whole module. */
export function groupBySection(items: NavItem[]): { section: string | null; items: NavItem[] }[] {
  const order: (string | null)[] = [];
  const buckets = new Map<string | null, NavItem[]>();
  for (const item of items) {
    const key = item.section ?? null;
    if (!buckets.has(key)) { buckets.set(key, []); order.push(key); }
    buckets.get(key)!.push(item);
  }
  return order.map((section) => ({ section, items: buckets.get(section)! }));
}

export function ModuleDropdown({ mod }: { mod: NavModule }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const isActive = pathname === mod.href || pathname.startsWith(mod.href + '/') ||
    mod.items?.some(i => pathname.startsWith(i.href));

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const groups = mod.items ? groupBySection(mod.items) : [];

  return (
    <div ref={ref} className="relative" onMouseLeave={() => setOpen(false)}>
      <button
        onMouseEnter={() => setOpen(true)}
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-150 ${
          isActive
            ? `${mod.color} bg-black/5 dark:bg-white/5`
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-black/5 dark:hover:text-white dark:hover:bg-white/5'
        }`}
      >
        {mod.label}
        <ChevronDown className={`w-3 h-3 opacity-60 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Solid, fully opaque panel — no backdrop-filter. The previous
          translucent-plus-blur combination read as "blurring the page behind
          it"; a plain flat card (Groww / TradingView's own pattern) reads as
          crisp instead, and a plain box-shadow still gives it elevation. */}
      {open && mod.items && (
        <div
          className="absolute top-full left-0 mt-1.5 rounded-2xl z-50 py-2 w-72 bg-white dark:bg-[#0A0E17] shadow-xl shadow-black/10 dark:shadow-black/50 border border-black/[0.06] dark:border-white/[0.07]"
        >
          {groups.map(({ section, items }, gi) => (
            <div key={section ?? '_flat'} className={gi > 0 ? 'mt-1' : ''}>
              {section && (
                <div className={`px-3.5 ${gi > 0 ? 'pt-3' : 'pt-1'} pb-1.5 text-[10px] font-bold uppercase tracking-widest ${mod.color} opacity-70`}>
                  {section}
                </div>
              )}
              {items.map(({ href, label, icon: Icon, desc, badge }) => {
                const active = pathname === href || pathname.startsWith(href + '/');
                return (
                  <Link key={href} href={href} onClick={() => setOpen(false)}
                    className={`group flex items-center gap-3 px-3.5 py-2.5 mx-1 rounded-xl transition-colors duration-150 ${
                      active ? 'bg-black/[0.04] dark:bg-white/[0.05]' : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      active ? 'bg-black/5 dark:bg-white/[0.08]' : 'bg-black/[0.03] dark:bg-white/[0.05]'
                    }`}>
                      <Icon className={`w-4 h-4 ${active ? mod.color : `${mod.color} opacity-70`}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[13px] font-medium ${active ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white'}`}>{label}</span>
                        {badge && (
                          <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${BADGE_COLORS[badge] ?? ''}`}>{badge}</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-500 truncate">{desc}</div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-700 group-hover:text-slate-400 dark:group-hover:text-slate-500 flex-shrink-0 transition-colors duration-150" />
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
