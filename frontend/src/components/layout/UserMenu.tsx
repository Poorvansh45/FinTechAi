'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ChevronDown, LayoutDashboard, BookOpen, LineChart, Settings, LogOut } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';

const USER_LINKS = [
  { href: '/markets',   icon: LayoutDashboard, label: 'Market Dashboard' },
  { href: '/journal',   icon: BookOpen,        label: 'Journal'          },
  { href: '/analytics', icon: LineChart,        label: 'Analytics'        },
  { href: '/settings',  icon: Settings,         label: 'Settings'         },
];

export function UserMenu() {
  const { user, username, logout } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    toast({ title: 'Session ended', description: 'See you next session, Trader 👋' });
    router.replace('/login');
  };

  if (!user) {
    return (
      <Link href="/login"
        className="px-3.5 py-1.5 rounded-lg text-[13px] font-semibold text-white hover:opacity-90 transition-opacity active:scale-95"
        style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
        Sign In
      </Link>
    );
  }

  const name = username || user.displayName || 'Trader';
  const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 p-1 pl-1 pr-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        aria-label="User menu">
        {user.photoURL
          ? <Image src={user.photoURL} alt={name} width={28} height={28} className="w-7 h-7 rounded-lg ring-2 ring-violet-500/30" unoptimized />
          : <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>{initials}</div>
        }
        <span className="hidden xl:block text-[13px] font-medium text-slate-700 dark:text-white/80 max-w-[90px] truncate">{name}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-56 rounded-2xl z-50 overflow-hidden bg-white/95 dark:bg-[#080C14]/95 shadow-xl dark:shadow-[0_24px_64px_rgba(0,0,0,0.6)] border border-black/5 dark:border-white/10"
          style={{ backdropFilter: 'blur(24px)' }}>
          <div className="px-4 py-3 border-b border-black/5 dark:border-white/10 flex items-center gap-3">
            {user.photoURL
              ? <Image src={user.photoURL} alt={name} width={34} height={34} className="w-8 h-8 rounded-lg" unoptimized />
              : <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white"
                  style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>{initials}</div>
            }
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-slate-900 dark:text-white truncate">{name}</div>
              <div className="text-[11px] text-slate-500 truncate">{user.email}</div>
            </div>
          </div>
          <div className="p-2">
            {USER_LINKS.map(({ href, icon: Icon, label }) => (
              <Link key={href} href={href} onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-black/5 dark:hover:text-white dark:hover:bg-white/5 transition-all group">
                <Icon className="w-4 h-4 text-slate-400 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors" />
                {label}
              </Link>
            ))}
            <div className="my-1.5 h-px bg-black/5 dark:bg-white/5" />
            <button onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-red-600 dark:text-red-400 hover:text-red-700 hover:bg-red-500/10 dark:hover:text-red-300 dark:hover:bg-red-500/5 transition-all">
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
