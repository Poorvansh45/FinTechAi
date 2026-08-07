'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, LayoutDashboard, BookOpen, LineChart, Settings, LogOut, Home } from 'lucide-react';
import { useAuth } from '@/context/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { profileInitial } from '@/lib/auth/types';

const USER_LINKS = [
  { href: '/home',       icon: Home,            label: 'Home'     },
  { href: '/markets',    icon: LayoutDashboard, label: 'Markets'  },
  { href: '/journal',    icon: BookOpen,        label: 'Journal'  },
  { href: '/analytics',  icon: LineChart,       label: 'Analytics' },
  { href: '/settings',   icon: Settings,        label: 'Settings' },
];

function ProfileAvatar({ name }: { name: string }) {
  const letter = profileInitial(name);
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
      style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', border: '1px solid rgba(99,102,241,0.35)' }}
      aria-hidden
    >
      {letter}
    </div>
  );
}

export function UserMenu() {
  const { user, isAuthenticated, logout } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    toast({ title: 'Signed out', description: 'See you next time.' });
    router.replace('/');
  };

  if (!isAuthenticated || !user) {
    // Private beta: no "Get Started" — there is nothing to sign up for.
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/auth?mode=signin"
          className="px-3.5 py-1.5 rounded-lg text-[13px] font-semibold text-white hover:opacity-90 transition-opacity"
          style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}
        >
          Sign In
        </Link>
      </div>
    );
  }

  const name = user.username ?? 'Account';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 p-1 pl-1 pr-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        aria-label="User menu"
      >
        <ProfileAvatar name={name} />
        <span className="hidden xl:block text-[13px] font-medium text-slate-700 dark:text-white/80 max-w-[100px] truncate">
          {name}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="absolute top-full right-0 mt-2 w-56 rounded-2xl z-50 overflow-hidden bg-white/95 dark:bg-[#080C14]/95 shadow-xl dark:shadow-[0_24px_64px_rgba(0,0,0,0.6)] border border-black/5 dark:border-white/10"
          style={{ backdropFilter: 'blur(24px)' }}
        >
          <div className="px-4 py-3 border-b border-black/5 dark:border-white/10 flex items-center gap-3">
            <ProfileAvatar name={name} />
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-slate-900 dark:text-white truncate">@{name}</div>
              <div className="text-[11px] text-slate-500 truncate">{user.email}</div>
            </div>
          </div>
          <div className="p-2">
            {USER_LINKS.map(({ href, icon: Icon, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-black/5 dark:hover:text-white dark:hover:bg-white/5 transition-all group"
              >
                <Icon className="w-4 h-4 text-slate-400 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors" />
                {label}
              </Link>
            ))}
            <div className="my-1.5 h-px bg-black/5 dark:bg-white/5" />
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-red-600 dark:text-red-400 hover:text-red-700 hover:bg-red-500/10 dark:hover:text-red-300 dark:hover:bg-red-500/5 transition-all"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
