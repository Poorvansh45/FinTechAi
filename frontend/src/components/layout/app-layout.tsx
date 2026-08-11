'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { profileInitial } from '@/lib/auth/types';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Bell, Menu, X, Home, LogOut, ChevronDown, ChevronRight } from 'lucide-react';
import { useAuth } from '@/context/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { groupBySection } from './ModuleDropdown';
import { UserMenu } from './UserMenu';
import { NAV_MODULES, MOBILE_TABS } from './nav-config';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

// Single flat width for every dropdown panel. The old per-module 640-780px
// values matched a 2-column card grid; the compact list layout below doesn't
// need that much room, and a shared width keeps every panel visually
// consistent (Groww/TradingView's own menus are a fixed slim width too).
const PANEL_WIDTH = 320;

// Every nav trigger resolves to the same blue — blue is the app's navigation
// accent (violet/purple stays reserved for AI + CTA surfaces), so the top bar
// reads as one control strip instead of five competing hues. Defined once and
// shared by both trigger shapes below (plain <Link> and dropdown <button>),
// which previously carried two copies of the same class list.
const TRIGGER_BASE =
  'group relative h-9 px-3.5 rounded-full text-[13px] font-medium select-none ' +
  'inline-flex items-center gap-1.5 transition-colors duration-200 ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40';
const TRIGGER_ON  = 'bg-blue-500/[0.12] text-blue-300 ring-1 ring-inset ring-blue-400/20';
const TRIGGER_OFF = 'text-slate-400 hover:text-white hover:bg-white/[0.05]';

// Panel accent per module. Literal class strings — Tailwind's JIT can't see
// `bg-${color}-500/10`, and an opacity modifier on `current` needs currentColor
// to resolve to an RGB triplet at build time, which a dynamic text class can't
// guarantee. Same explicit-lookup pattern as the scanner nav's CATEGORY_STYLES.
const PANEL_ACCENT: Record<string, { tile: string; rowActive: string }> = {
  'text-blue-400':    { tile: 'bg-blue-500/10 text-blue-300',       rowActive: 'bg-blue-500/[0.10]'    },
  'text-emerald-400': { tile: 'bg-emerald-500/10 text-emerald-300', rowActive: 'bg-emerald-500/[0.10]' },
  'text-violet-400':  { tile: 'bg-violet-500/10 text-violet-300',   rowActive: 'bg-violet-500/[0.10]'  },
  'text-amber-400':   { tile: 'bg-amber-500/10 text-amber-300',     rowActive: 'bg-amber-500/[0.10]'   },
  'text-pink-400':    { tile: 'bg-pink-500/10 text-pink-300',       rowActive: 'bg-pink-500/[0.10]'    },
};

// Badges are keyed by what they MEAN, not by which module they sit in — "Live"
// is green everywhere, "AI" is violet everywhere. Keying them off the module
// colour made the same word change colour between panels, which reads as noise.
const BADGE_TONE: Record<string, string> = {
  Live:    'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
  New:     'border-blue-500/25    bg-blue-500/10    text-blue-300',
  AI:      'border-violet-500/25  bg-violet-500/10  text-violet-300',
  Beta:    'border-amber-500/25   bg-amber-500/10   text-amber-300',
  Popular: 'border-amber-500/25   bg-amber-500/10   text-amber-300',
};
const BADGE_FALLBACK = 'border-slate-500/25 bg-slate-500/10 text-slate-300';

// ── Module panel data ─────────────────────────────────────────
const MODULE_INFOS_DATA = [
  {
    id: 'markets',
    label: 'Markets',
    subtitle: 'Real-time global market intelligence and analytics',
    moduleIndex: 0,
  },
  {
    id: 'screener',
    label: 'Screener',
    subtitle: 'Discover institutional tools and technical scans',
    moduleIndex: 1,
  },
  {
    id: 'portfolio',
    label: 'Portfolio',
    subtitle: "Whether you already have investments or you're starting from scratch, Nivro helps you build, analyze and improve your portfolio.",
    moduleIndex: 2,
  },
  {
    id: 'workspace',
    label: 'Workspace',
    subtitle: 'Manage your trading journal, history and performance',
    moduleIndex: 3,
  },
  {
    id: 'copilot',
    label: 'AI Copilot',
    subtitle: 'Your personal intelligent AI trading assistant',
    moduleIndex: 4,
  },
];

// ── Framer Motion variants ─────────────────────────────────────
const panelVariants = {
  initial: { opacity: 0, y: 10, scale: 0.98, filter: 'blur(0px)' },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: {
      type: 'spring' as const,
      stiffness: 320,
      damping: 28,
      duration: 0.22,
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.985,
    filter: 'blur(4px)',
    transition: { duration: 0.18, ease: 'easeIn' as const },
  },
};

// ── Mobile full-screen drawer ─────────────────────────────────
function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, isAuthenticated, logout } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const pathname = usePathname();
  const name = user?.username ?? 'Account';
  const initial = user?.username ? profileInitial(user.username) : '?';
  const isLandingPage = pathname === '/';

  if (!open) return null;

  const handleLogout = async () => {
    onClose();
    await logout();
    toast({ title: 'Signed out', description: 'See you next time.' });
    router.replace('/');
  };

  const handleAuthNavigation = (targetUrl: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    onClose();
    setTimeout(() => {
      if (isLandingPage) {
        window.dispatchEvent(new Event('premium-auth-exit'));
      }
      setTimeout(() => {
        router.push(targetUrl);
      }, 150);
    }, 120);
  };

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-y-0 left-0 w-72 overflow-y-auto"
        style={{ background: 'rgba(8,12,20,0.99)', borderRight: '1px solid rgba(255,255,255,0.06)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-white/5">
          <Link href="/" onClick={onClose} className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center">
              <img src="/logo.png" alt="Nivro Logo" className="w-full h-full object-contain" />
            </div>
            <span className="font-bold text-sm text-white">Nivro</span>
          </Link>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLandingPage ? (
          <div className="px-3 pt-4 space-y-1">
            <Link href="#product" onClick={onClose} className="flex items-center px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all">
              Product
            </Link>
            <Link href="#platform" onClick={onClose} className="flex items-center px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all">
              Platform
            </Link>
            <Link href="#pricing" onClick={onClose} className="flex items-center px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all">
              Pricing
            </Link>
            <Link href="#roadmap" onClick={onClose} className="flex items-center px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all">
              Roadmap
            </Link>
            <Link href="#testimonials" onClick={onClose} className="flex items-center px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all">
              Testimonials
            </Link>
            <div className="my-3 h-px bg-white/5" />
            {isAuthenticated ? (
              <Link href="/home" onClick={onClose} className="flex items-center px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-white/5 border border-white/10 transition-all">
                Dashboard
              </Link>
            ) : (
              <div className="space-y-2 pt-2">
                <motion.div whileTap={{ scale: 0.97 }} transition={{ duration: 0.12, ease: 'easeOut' }}>
                  <Link href="/auth?mode=signin" onClick={handleAuthNavigation('/auth?mode=signin')} className="flex items-center justify-center w-full px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all">
                    Login
                  </Link>
                </motion.div>
                <motion.div whileTap={{ scale: 0.97 }} transition={{ duration: 0.12, ease: 'easeOut' }}>
                  <Link href="/auth?mode=signin" onClick={handleAuthNavigation('/auth?mode=signin')} className="flex items-center justify-center w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all text-center"
                    style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                    Sign In
                  </Link>
                </motion.div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* User info */}
            {isAuthenticated && user && (
              <div className="px-4 py-3 border-b border-white/5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', border: '1px solid rgba(99,102,241,0.35)' }}>
                  {initial}
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">@{name}</div>
                  <div className="text-[10px] text-slate-500">{user.email}</div>
                </div>
              </div>
            )}

            {/* Home */}
            <div className="px-3 pt-3">
              <Link href={isAuthenticated ? '/home' : '/'} onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium mb-1 transition-all ${
                  pathname === '/home' || pathname === '/' ? 'bg-white/6 text-white' : 'text-slate-400 hover:text-white hover:bg-white/4'
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
            {isAuthenticated && (
              <div className="px-3 pb-6 pt-2">
                <div className="my-2 h-px bg-white/5" />
                <button onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-red-400 hover:bg-red-500/5 transition-all">
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}


// ─── Animated particles for Landing & Auth Pages ──────────────────────────────
function Particle({ x, y, delay, size }: { x: number; y: number; delay: number; size: number }) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        background: 'radial-gradient(circle, rgba(99,102,241,0.5) 0%, transparent 70%)',
      }}
      animate={{ y: [0, -30, 0], opacity: [0.1, 0.5, 0.1] }}
      transition={{ duration: 5 + delay, repeat: Infinity, delay, ease: 'easeInOut' }}
    />
  );
}

const PARTICLES = [
  { x: 8, y: 18, delay: 0, size: 4 },
  { x: 85, y: 12, delay: 0.5, size: 6 },
  { x: 50, y: 80, delay: 1, size: 4 },
  { x: 18, y: 68, delay: 1.5, size: 8 },
  { x: 74, y: 58, delay: 0.8, size: 5 },
  { x: 33, y: 38, delay: 2, size: 3 },
  { x: 62, y: 8, delay: 1.2, size: 7 },
  { x: 91, y: 88, delay: 0.3, size: 4 },
];

// ── Main Layout ───────────────────────────────────────────────
export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const isAuthPage = pathname === '/auth' || pathname === '/login' || pathname === '/onboarding';
  const isLandingPage = pathname === '/';

  const marketsActive = pathname.startsWith('/markets');
  const screenerActive = pathname.startsWith('/screener');
  const portfolioActive = pathname.startsWith('/portfolio');
  const workspaceActive = pathname.startsWith('/journal') || pathname.startsWith('/workspace') || pathname.startsWith('/analytics');
  const copilotActive = pathname.startsWith('/ai-');

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 4);
    window.addEventListener('scroll', h);
    return () => window.removeEventListener('scroll', h);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // ── Auth navigation ────────────────────────────────────────
  const handleAuthNavigation = (targetUrl: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setTimeout(() => {
      if (isLandingPage) {
        window.dispatchEvent(new Event('premium-auth-exit'));
      }
      setTimeout(() => {
        router.push(targetUrl);
      }, 150);
    }, 120);
  };

  // ── Mega Menu State ─────────────────────────────────────────
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [menuLeft, setMenuLeft] = useState<number>(0);

  // Refs for each trigger button (for centering the panel)
  const triggerRefs = useRef<Record<string, HTMLButtonElement | HTMLAnchorElement | null>>({
    markets: null,
    screener: null,
    portfolio: null,
    workspace: null,
    copilot: null,
  });

  // Close-delay timer — used only for mouse-leave detection (not for opening)
  const closeTimer = useRef<NodeJS.Timeout | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  /**
   * Calculate the left offset for the panel so it centers under its trigger button.
   * Clamps to viewport edges with 20px margin.
   */
  const calcMenuLeft = useCallback((menuId: string) => {
    const triggerEl = triggerRefs.current[menuId];
    if (!triggerEl) return;
    const rect = triggerEl.getBoundingClientRect();
    const triggerCenter = rect.left + rect.width / 2;
    let left = triggerCenter - PANEL_WIDTH / 2;
    const margin = 20;
    left = Math.max(margin, Math.min(left, window.innerWidth - PANEL_WIDTH - margin));
    setMenuLeft(left);
  }, []);

  /** Open a menu — always on CLICK only. Clears any pending close. */
  const openMenu = useCallback((menuId: string) => {
    clearCloseTimer();
    setActiveMenu(menuId);
    calcMenuLeft(menuId);
  }, [clearCloseTimer, calcMenuLeft]);

  /** Schedule menu close with 250ms delay (can be cancelled). */
  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => {
      setActiveMenu(null);
    }, 250);
  }, [clearCloseTimer]);

  /** Immediately close — used for click-outside and ESC. */
  const closeNow = useCallback(() => {
    clearCloseTimer();
    setActiveMenu(null);
  }, [clearCloseTimer]);

  /**
   * Handle click on a nav trigger:
   *  - If same menu is open → close it (toggle)
   *  - If different menu is open → switch to new (instant panel swap via AnimatePresence mode="wait")
   *  - If no menu open → open it
   */
  const handleTriggerClick = useCallback((menuId: string) => {
    if (activeMenu === menuId) {
      closeNow();
    } else {
      // Switching or opening fresh
      clearCloseTimer();
      setActiveMenu(menuId);
      calcMenuLeft(menuId);
    }
  }, [activeMenu, closeNow, clearCloseTimer, calcMenuLeft]);

  // Close on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeNow();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeNow]);

  // Recalculate panel position on window resize
  useEffect(() => {
    if (!activeMenu) return;
    const onResize = () => calcMenuLeft(activeMenu);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [activeMenu, calcMenuLeft]);

  // Build MODULE_INFOS lookup from NAV_MODULES
  const MODULE_INFOS = Object.fromEntries(
    MODULE_INFOS_DATA.map(({ id, label, subtitle, moduleIndex }) => [
      id,
      {
        label, subtitle,
        items: NAV_MODULES[moduleIndex]?.items ?? [],
        color: NAV_MODULES[moduleIndex]?.color ?? 'text-blue-400',
      },
    ])
  );

  // Nav trigger data
  const NAV_TRIGGERS = [
    { id: 'markets',   label: 'Markets',    isActive: marketsActive   },
    { id: 'screener',  label: 'Screener',   isActive: screenerActive  },
    { id: 'portfolio', label: 'Portfolio',  isActive: portfolioActive },
    { id: 'workspace', label: 'Workspace',  isActive: workspaceActive },
    { id: 'copilot',   label: 'Nivro Copilot', isActive: copilotActive   },
  ];

  const activeModule = activeMenu ? MODULE_INFOS[activeMenu] : null;
  const accent = PANEL_ACCENT[activeModule?.color ?? ''] ?? PANEL_ACCENT['text-blue-400'];

  return (
    <div className="flex flex-col min-h-screen bg-[#050816] text-white relative">

      {/* Global Background elements for Landing & Auth Pages to ensure continuity */}
      {(isLandingPage || isAuthPage) && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10 bg-[#050816]">
          {/* Radial Glows */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 w-[600px] h-[350px] rounded-full bg-gradient-to-r from-violet-600/10 to-indigo-600/5 blur-[120px] pointer-events-none animate-pulse" />
          <div className="absolute top-[300px] left-1/2 -translate-x-1/2 w-[900px] h-[450px] rounded-full bg-[#8B5CF6]/4 blur-[140px] pointer-events-none" />
          
          {/* Grid pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
          
          {/* Particles */}
          {PARTICLES.map((p, i) => <Particle key={i} {...p} />)}
        </div>
      )}

      {/* ══ NAVBAR ══════════════════════════════════════════════ */}
      <header
        className={`sticky top-0 w-full flex items-center transition-all duration-200 border-b ${
          scrolled || !isLandingPage
            ? 'border-white/[0.08] bg-[#070B14]/90 backdrop-blur-xl'
            : 'border-transparent bg-transparent'
        }`}
        style={{ height: 64, zIndex: 1001 }}
      >
        <div className="w-full max-w-screen-2xl mx-auto px-4 md:px-5 flex items-center gap-2.5 h-full">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 flex-shrink-0 mr-2 group">
            <div
              className="relative h-10 w-10 rounded-xl overflow-hidden flex items-center justify-center transition-transform group-hover:scale-105"
              style={{ boxShadow: '0 0 16px rgba(99,102,241,0.2)' }}
            >
              <img src="/logo.png" alt="Nivro Logo" className="w-full h-full object-contain" />
            </div>
            <div className="hidden sm:block leading-none">
              <div className="font-bold text-[16px] tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400">
                Nivro
              </div>
              <div className="text-[8px] font-bold tracking-widest uppercase text-slate-500 dark:text-slate-600 mt-0.5">
                TRADING INTELLIGENCE
              </div>
            </div>
          </Link>

          {!isAuthPage && (
            <>
              {isLandingPage ? (
                <nav className="hidden lg:flex items-center gap-6 ml-6">
                  <Link href="#product" className="text-[13px] font-medium text-slate-400 hover:text-white transition-colors">Product</Link>
                  <Link href="#platform" className="text-[13px] font-medium text-slate-400 hover:text-white transition-colors">Platform</Link>
                  <Link href="#pricing" className="text-[13px] font-medium text-slate-400 hover:text-white transition-colors">Pricing</Link>
                  <Link href="#roadmap" className="text-[13px] font-medium text-slate-400 hover:text-white transition-colors">Roadmap</Link>
                  <Link href="#testimonials" className="text-[13px] font-medium text-slate-400 hover:text-white transition-colors">Testimonials</Link>
                </nav>
              ) : (
                <>
                  {/* Separator */}
                  <div className="hidden lg:block w-px h-4 bg-black/10 dark:bg-white/8 mx-1" />

                  {/* ── Premium Mega Menu Triggers ── */}
                  <div className="hidden lg:flex items-center gap-1 ml-3">
                    {NAV_TRIGGERS.map(({ id, label, isActive }) => {
                      if (id === 'portfolio' || id === 'copilot' || id === 'screener') {
                        const href = id === 'portfolio' ? '/portfolio' : id === 'screener' ? '/screener' : '/ai-copilot';
                        return (
                          <Link
                            key={id}
                            href={href}
                            ref={(el) => { triggerRefs.current[id] = el; }}
                            className={cn(TRIGGER_BASE, isActive ? TRIGGER_ON : TRIGGER_OFF)}
                          >
                            {label}
                          </Link>
                        );
                      }
                      const isOpen = activeMenu === id;
                      const highlighted = isOpen || (!activeMenu && isActive);
                      return (
                        <button
                          key={id}
                          ref={(el) => { triggerRefs.current[id] = el; }}
                          onClick={() => handleTriggerClick(id)}
                          // Mouse-leave on trigger itself schedules close
                          // but only when the panel is already open (not on hover-to-open)
                          onMouseLeave={() => { if (isOpen) scheduleClose(); }}
                          // If cursor re-enters a trigger while panel is still closing → cancel
                          onMouseEnter={() => { if (activeMenu) clearCloseTimer(); }}
                          className={cn(TRIGGER_BASE, highlighted ? TRIGGER_ON : TRIGGER_OFF)}
                        >
                          {label}
                          <ChevronDown
                            className={cn(
                              'size-3 transition-transform duration-200',
                              isOpen ? 'rotate-180 text-blue-300' : 'text-slate-500 group-hover:text-slate-300'
                            )}
                          />
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              <div className="flex-1" />

              {isLandingPage ? (
                <div className="flex items-center gap-4">
                  {isAuthenticated ? (
                    <Link
                      href="/home"
                      className="text-xs font-medium text-[#F8FAFC] px-4 rounded-full transition-all bg-white/[0.02] border border-white/[0.08] hover:bg-white/[0.06] hover:border-[#8B5CF6]/30 inline-flex items-center justify-center shadow-sm"
                      style={{ height: '32px' }}
                    >
                      Dashboard
                    </Link>
                  ) : (
                    <>
                      <motion.div whileTap={{ scale: 0.97 }} transition={{ duration: 0.12, ease: 'easeOut' }} className="inline-flex">
                        <Link
                          href="/auth?mode=signin"
                          onClick={handleAuthNavigation('/auth?mode=signin')}
                          className="text-[13px] font-medium text-slate-400 hover:text-white transition-colors"
                        >
                          Login
                        </Link>
                      </motion.div>
                      <motion.div whileTap={{ scale: 0.97 }} transition={{ duration: 0.12, ease: 'easeOut' }} className="inline-flex">
                        <Link
                          href="/auth?mode=signin"
                          onClick={handleAuthNavigation('/auth?mode=signin')}
                          className="text-xs font-bold text-[#080C14] px-4 rounded-full transition-all bg-[#F8FAFC] hover:bg-[#F8FAFC]/90 inline-flex items-center justify-center shadow-sm"
                          style={{ height: '32px' }}
                        >
                          Sign In
                        </Link>
                      </motion.div>
                    </>
                  )}
                </div>
              ) : (
                <>


                  {/* Notifications */}
                  <button className="relative p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-black/5 dark:hover:text-white dark:hover:bg-white/5 transition-colors">
                    <Bell className="w-[17px] h-[17px]" />
                    <span
                      className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-violet-500"
                      style={{ boxShadow: '0 0 6px rgba(139,92,246,0.9)' }}
                    />
                  </button>

                  <div className="w-px h-4 bg-black/10 dark:bg-white/8 mx-0.5" />

                  <UserMenu />
                </>
              )}

              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileOpen(v => !v)}
                className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors ml-1"
              >
                <Menu className="w-[18px] h-[18px]" />
              </button>
            </>
          )}
        </div>
      </header>

      {/* ── Menu Panel (outside <header> so it can overflow freely) ──
          Solid, fully opaque — no backdrop-filter. The previous translucent
          32px blur (plus the page-behind blur below) was what read as "the
          whole page blurs when this opens"; a plain flat card, same as
          Groww/TradingView's own dropdowns, reads as crisp instead. */}
      <AnimatePresence mode="wait">
        {activeMenu && activeModule && (
          <motion.div
            key={activeMenu}
            variants={panelVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="fixed rounded-2xl border border-white/[0.08] ring-1 ring-inset ring-white/[0.04] shadow-2xl shadow-black/60 select-none overflow-hidden p-1.5"
            style={{
              width: PANEL_WIDTH,
              left: menuLeft,
              top: 76,          // 64px navbar + 12px gap
              zIndex: 1000,
              background: '#0A0E17',
            }}
            // Keep panel open while cursor is inside
            onMouseEnter={clearCloseTimer}
            onMouseLeave={scheduleClose}
          >
            {groupBySection(activeModule.items).map(({ section, items }, gi) => (
              // Groups after the first get a hairline rule as well as the
              // heading — the heading alone left the sections floating.
              <div key={section ?? '_flat'} className={gi > 0 ? 'mt-1.5 pt-1.5 border-t border-white/[0.06]' : ''}>
                {section && (
                  // Neutral, not module-coloured: the heading is a structural
                  // label, and letting the icons carry the one accent keeps a
                  // single colour per panel.
                  <div className="px-3 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {section}
                  </div>
                )}
                {items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(item.href + '/');
                  return (
                    <Link
                      href={item.href}
                      key={item.href}
                      onClick={closeNow}
                      className={cn(
                        'group flex items-center gap-3 px-2.5 py-2 rounded-xl transition-colors duration-150',
                        active ? accent.rowActive : 'hover:bg-white/[0.05]'
                      )}
                    >
                      <div className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors duration-150',
                        active ? accent.tile : cn(accent.tile, 'opacity-60 group-hover:opacity-100')
                      )}>
                        {item.icon && <item.icon className="w-[15px] h-[15px]" strokeWidth={1.75} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={cn(
                            'text-[13px] font-medium truncate',
                            active ? 'text-white' : 'text-slate-200 group-hover:text-white'
                          )}>
                            {item.label}
                          </span>
                          {item.badge && (
                            <span className={cn(
                              'inline-flex items-center gap-1 flex-shrink-0 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-px rounded-full border',
                              BADGE_TONE[item.badge] ?? BADGE_FALLBACK
                            )}>
                              {item.badge === 'Live' && (
                                <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                              )}
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] leading-snug text-slate-500 truncate mt-px">{item.desc}</div>
                      </div>
                      {/* Affordance on demand: a permanently-visible chevron on
                          every row added five arrows of visual noise. */}
                      <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-slate-500 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150" />
                    </Link>
                  );
                })}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Transparent backdrop — click outside to close ── */}
      {activeMenu && (
        <div
          className="fixed inset-0 z-[999]"
          style={{ background: 'transparent' }}
          onClick={closeNow}
        />
      )}

      {/* The mega panel must sit above the backdrop — re-raise its z-index is done via zIndex:1000 above */}

      <MobileDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} />

      {/* ── Main Content ──
          Page stays fully crisp while a menu is open — Groww/TradingView
          don't blur or dim their own page behind a dropdown, and there's
          already a transparent click-outside catcher below handling the
          "click away to close" interaction, so nothing is lost by not
          visually degrading the content underneath. `pointerEvents: none`
          is kept purely to stop stray clicks reaching page content the menu
          is covering — it has no visual effect on its own. */}
      <main
        className="flex-grow flex flex-col relative"
        style={{
          zIndex: 1,
          pointerEvents: activeMenu ? 'none' : 'auto',
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={pathname}
            initial={{ opacity: 0, filter: 'blur(8px)', scale: 0.985 }}
            animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
            exit={{ opacity: 0, filter: 'blur(8px)', scale: 0.985 }}
            transition={{
              duration: pathname === '/auth' ? 0.5 : 0.4,
              ease: 'easeInOut',
            }}
            className="flex-grow flex flex-col"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ══ MOBILE BOTTOM NAV ════════════════════════════════════ */}
      {!isLandingPage && !isAuthPage && (
        <>
          <nav
            className="lg:hidden fixed bottom-0 inset-x-0 z-40 flex items-center justify-around py-1.5 px-2"
            style={{
              background: 'rgba(8,12,20,0.96)',
              backdropFilter: 'blur(20px)',
              borderTop: '1px solid rgba(99,102,241,0.08)',
            }}
          >
            {MOBILE_TABS.map(({ href, icon: Icon, label }) => {
              const active = pathname === href || (href !== '/' && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className={`relative flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl transition-all ${active ? 'text-violet-400' : 'text-slate-600'}`}
                >
                  {active && (
                    <span
                      className="absolute -top-1.5 w-8 h-0.5 rounded-full bg-violet-500"
                      style={{ boxShadow: '0 0 8px rgba(139,92,246,0.8)' }}
                    />
                  )}
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="lg:hidden h-16" />
        </>
      )}
    </div>
  );
}
