'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { type NavModule } from './nav-config';

const BADGE_COLORS: Record<string, string> = {
  Live: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  AI:   'bg-violet-500/15  text-violet-400  border-violet-500/20',
  Beta: 'bg-amber-500/15   text-amber-400   border-amber-500/20',
  New:  'bg-pink-500/15    text-pink-400    border-pink-500/20',
  'Coming soon': 'bg-slate-500/15 text-slate-400 border-slate-500/20',
};

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

      {open && mod.items && (
        <div
          className="absolute top-full left-0 mt-1.5 rounded-2xl z-50 p-2 w-72 bg-white/95 dark:bg-[#080C14]/95 shadow-xl dark:shadow-[0_24px_64px_rgba(0,0,0,0.6)] border border-black/5 dark:border-white/10"
          style={{ backdropFilter: 'blur(24px)' }}
        >
          {/* Module header */}
          <div className="px-3 py-2 mb-1 flex items-center justify-between">
            <span className={`text-[10px] font-bold uppercase tracking-widest opacity-60 ${mod.color}`}>{mod.label}</span>
            <Link href={mod.href} onClick={() => setOpen(false)}
              className={`text-[11px] font-medium ${mod.color} opacity-70 hover:opacity-100 transition-opacity`}>
              View all →
            </Link>
          </div>

          {mod.items.map(({ href, label, icon: Icon, desc, badge }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link key={href} href={href} onClick={() => setOpen(false)}
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                  active ? 'bg-black/5 dark:bg-white/6' : 'hover:bg-black/5 dark:hover:bg-white/4'
                }`}
                style={active ? { boxShadow: `inset 0 0 0 1px ${mod.glowColor}, 0 0 20px ${mod.glowColor}`, background: 'rgba(255,255,255,0.02)' } : undefined}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
                  active ? 'bg-black/5 dark:bg-white/8' : 'bg-black/5 dark:bg-white/4 group-hover:bg-black/10 dark:group-hover:bg-white/7'
                }`}>
                  <Icon className={`w-3.5 h-3.5 ${active ? mod.color : 'text-slate-500 group-hover:text-slate-800 dark:group-hover:text-slate-300'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-[13px] font-medium ${active ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white'}`}>{label}</span>
                    {badge && (
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${BADGE_COLORS[badge] ?? ''}`}>{badge}</span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-600 group-hover:text-slate-600 dark:group-hover:text-slate-500 truncate">{desc}</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
