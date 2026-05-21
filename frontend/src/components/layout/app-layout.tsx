'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { BrainCircuit, Search, Bell, Menu, X, Home, LogOut } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { ModuleDropdown } from './ModuleDropdown';
import { UserMenu } from './UserMenu';
import { NAV_MODULES, MOBILE_TABS } from './nav-config';

// ── Mobile full-screen drawer ─────────────────────────────────
function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, username, logout } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const pathname = usePathname();
  const name = username || user?.displayName || 'Trader';

  if (!open) return null;

  const handleLogout = async () => {
    onClose();
    await logout();
    toast({ title: 'Session ended', description: 'See you next session 👋' });
    router.replace('/login');
  };

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-y-0 left-0 w-72 overflow-y-auto"
        style={{ background: 'rgba(8,12,20,0.99)', borderRight: '1px solid rgba(255,255,255,0.06)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-white/5">
          <Link href="/" onClick={onClose} className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
              <BrainCircuit className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-sm text-white">FinAI Edge</span>
          </Link>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User info */}
        {user && (
          <div className="px-4 py-3 border-b border-white/5 flex items-center gap-3">
            {user.photoURL
              ? <Image src={user.photoURL} alt="" width={32} height={32} className="w-8 h-8 rounded-lg" unoptimized />
              : <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>{name[0]?.toUpperCase()}</div>
            }
            <div>
              <div className="text-sm font-semibold text-white">{name}</div>
              <div className="text-[10px] text-slate-500">{user.email}</div>
            </div>
          </div>
        )}

        {/* Home */}
        <div className="px-3 pt-3">
          <Link href="/" onClick={onClose}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium mb-1 transition-all ${
              pathname === '/' ? 'bg-white/6 text-white' : 'text-slate-400 hover:text-white hover:bg-white/4'
            }`}>
            <Home className="w-4 h-4" /> Home
          </Link>
        </div>

        {/* Modules */}
        {NAV_MODULES.map(mod => (
          <div key={mod.id} className="px-3 mb-1">
            <div className={`text-[10px] font-bold uppercase tracking-widest px-3 py-2 opacity-40 ${mod.color}`}>{mod.label}</div>
            {mod.items?.map(({ href, label, icon: Icon, badge }) => {
              const active = pathname === href || pathname.startsWith(href + '/');
              return (
                <Link key={href} href={href} onClick={onClose}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all ${
                    active ? `${mod.color} bg-white/5` : 'text-slate-400 hover:text-white hover:bg-white/4'
                  }`}>
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1">{label}</span>
                  {badge && <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border border-current opacity-60">{badge}</span>}
                </Link>
              );
            })}
          </div>
        ))}

        {/* Sign out */}
        {user && (
          <div className="px-3 pb-6 pt-2">
            <div className="my-2 h-px bg-white/5" />
            <button onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-red-400 hover:bg-red-500/5 transition-all">
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Layout ───────────────────────────────────────────────
export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [scrolled, setScrolled] = useState(false);

  const isAuthPage = pathname === '/login' || pathname === '/onboarding';

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 4);
    window.addEventListener('scroll', h);
    return () => window.removeEventListener('scroll', h);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  if (isAuthPage) return <>{children}</>;

  return (
    <div className="flex flex-col min-h-screen">

      {/* ══ NAVBAR ══════════════════════════════════════════════ */}
      <header
        className={`sticky top-0 z-40 flex items-center transition-all duration-200 ${
          scrolled ? 'border-b border-black/5 dark:border-white/10 shadow-lg shadow-black/5 dark:shadow-black/40 bg-white/95 dark:bg-[#080C14]/95' : 'border-b border-transparent bg-white/70 dark:bg-[#080C14]/80'
        }`}
        style={{
          height: 52,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        } as React.CSSProperties}
      >
        <div className="w-full max-w-screen-2xl mx-auto px-4 md:px-5 flex items-center gap-2.5 h-full">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0 mr-1 group">
            <div className="relative w-8 h-8 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105"
              style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', boxShadow: '0 0 16px rgba(99,102,241,0.35)' }}>
              <BrainCircuit className="w-4 h-4 text-white" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-cyan-400 border-2 border-[#080C14]"
                style={{ boxShadow: '0 0 6px rgba(6,182,212,1)' }} />
            </div>
            <div className="hidden sm:block leading-none">
              <div className="font-bold text-[15px] tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400">
                FinAI Edge
              </div>
              <div className="text-[8px] font-semibold tracking-widest uppercase text-slate-500 dark:text-slate-600">Trading Intelligence</div>
            </div>
          </Link>

          {/* Separator */}
          <div className="hidden lg:block w-px h-4 bg-black/10 dark:bg-white/8 mx-1" />

          {/* Home link */}
          <Link href="/"
            className={`hidden lg:flex items-center px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
              pathname === '/' ? 'text-slate-900 bg-black/5 dark:text-white dark:bg-white/6' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 hover:bg-black/5 dark:hover:text-white dark:hover:bg-white/5'
            }`}>
            Home
          </Link>

          {/* Module dropdowns */}
          <nav className="hidden lg:flex items-center gap-0.5">
            {NAV_MODULES.map(mod => (
              <ModuleDropdown key={mod.id} mod={mod} />
            ))}
          </nav>

          <div className="flex-1" />

          {/* Search */}
          <div className="relative hidden md:flex items-center">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search stocks, setups, sectors…"
              className="h-8 pl-8 pr-3 w-48 xl:w-56 text-[13px] rounded-lg transition-all focus:w-64 xl:focus:w-72 focus:outline-none text-slate-900 dark:text-white/80 placeholder:text-slate-500 dark:placeholder:text-slate-600 bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 focus:border-violet-500/40"
            />
          </div>

          {/* Notifications */}
          <button className="relative p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-black/5 dark:hover:text-white dark:hover:bg-white/5 transition-colors">
            <Bell className="w-[17px] h-[17px]" />
            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-violet-500"
              style={{ boxShadow: '0 0 6px rgba(139,92,246,0.9)' }} />
          </button>

          <ThemeToggle />

          <div className="w-px h-4 bg-black/10 dark:bg-white/8 mx-0.5" />

          <UserMenu />

          {/* Mobile hamburger */}
          <button onClick={() => setMobileOpen(v => !v)}
            className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors ml-1">
            <Menu className="w-[18px] h-[18px]" />
          </button>
        </div>
      </header>

      <MobileDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} />

      {/* Main */}
      <main className="flex-1 w-full max-w-screen-2xl mx-auto px-4 md:px-5 py-5">
        {children}
      </main>

      {/* ══ MOBILE BOTTOM NAV ════════════════════════════════════ */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 flex items-center justify-around py-1.5 px-2"
        style={{ background: 'rgba(8,12,20,0.96)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(99,102,241,0.08)' }}>
        {MOBILE_TABS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <Link key={href} href={href}
              className={`relative flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl transition-all ${active ? 'text-violet-400' : 'text-slate-600'}`}>
              {active && <span className="absolute -top-1.5 w-8 h-0.5 rounded-full bg-violet-500"
                style={{ boxShadow: '0 0 8px rgba(139,92,246,0.8)' }} />}
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="lg:hidden h-16" />
    </div>
  );
}
