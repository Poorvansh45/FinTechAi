'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { Bell, ChevronDown, Home, LogOut, Menu } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useAuth } from '@/context/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ThemeSegmented, ThemeToggle } from '@/components/theme-toggle';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import {
  MOBILE_TABS,
  NAV_BADGE_FALLBACK,
  NAV_BADGE_TONE,
  NAV_MODULES,
  groupBySection,
  type NavModule,
} from './nav-config';
import { ProfileAvatar, UserMenu } from './UserMenu';
import { MarketSelector } from './MarketSelector';

// ── Navigation model ─────────────────────────────────────────────────────────

/** Which routes make each top-level module "active". */
const MODULE_MATCH: Record<string, (p: string) => boolean> = {
  markets: (p) => p.startsWith('/markets'),
  screener: (p) => p.startsWith('/screener'),
  'sector-xpert': (p) => p.startsWith('/sector'),
  portfolio: (p) => p.startsWith('/portfolio'),
  workspace: (p) => p.startsWith('/journal') || p.startsWith('/workspace') || p.startsWith('/analytics'),
  'ai-copilot': (p) => p.startsWith('/ai-'),
};

/** Modules that open a menu; every other module is a direct link. */
const MENU_MODULES = new Set(['markets', 'workspace']);

const LANDING_LINKS = [
  { href: '#product', label: 'Product' },
  { href: '#platform', label: 'Platform' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#roadmap', label: 'Roadmap' },
];

const isActivePath = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(href + '/');

// ── Small shared pieces ─────────────────────────────────────────────────────

function NavBadge({ children, className }: { children: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex flex-shrink-0 items-center rounded border px-1.5 py-px text-2xs font-medium leading-4',
        NAV_BADGE_TONE[children] ?? NAV_BADGE_FALLBACK,
        className
      )}
    >
      {children}
    </span>
  );
}

const ICON_BUTTON =
  'inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors ' +
  'hover:bg-foreground/[0.06] hover:text-foreground data-[state=open]:bg-foreground/[0.06] data-[state=open]:text-foreground';

// Top-bar items are full header height so the active underline sits on the
// bottom border — the same pattern as a tab strip, no filled pills.
const NAV_ITEM =
  'group relative inline-flex h-14 items-center gap-1.5 px-3 text-body font-medium transition-colors xl:px-4';
const NAV_INACTIVE = 'text-muted-foreground hover:text-foreground data-[state=open]:text-foreground';
const NAV_ACTIVE =
  'text-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brand-500 xl:after:inset-x-4';

function NavMenu({ mod, active }: { mod: NavModule; active: boolean }) {
  const pathname = usePathname();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={cn(NAV_ITEM, active ? NAV_ACTIVE : NAV_INACTIVE)}>
          {mod.label}
          <ChevronDown
            aria-hidden
            className="h-3.5 w-3.5 opacity-60 transition-transform group-data-[state=open]:rotate-180"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={4} className="w-[340px] p-1.5">
        {groupBySection(mod.items ?? []).map(({ section, items }, gi) => (
          <div key={section ?? '_flat'}>
            {gi > 0 && <DropdownMenuSeparator className="bg-border" />}
            {section && (
              <DropdownMenuLabel className="px-2 pb-1 pt-1.5 text-label text-muted-foreground">
                {section}
              </DropdownMenuLabel>
            )}
            {items.map((item) => {
              const selected = isActivePath(pathname, item.href);
              return (
                <DropdownMenuItem key={item.href} asChild className="rounded-md p-0">
                  <Link
                    href={item.href}
                    aria-current={selected ? 'page' : undefined}
                    className={cn('flex items-start gap-3 rounded-md px-2 py-2', selected && 'bg-accent')}
                  >
                    <span
                      className={cn(
                        'mt-px flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-border bg-muted',
                        selected ? 'text-brand-400' : 'text-muted-foreground'
                      )}
                    >
                      <item.icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-body font-medium text-foreground">{item.label}</span>
                        {item.badge && <NavBadge>{item.badge}</NavBadge>}
                      </span>
                      <span className="block truncate text-caption text-muted-foreground">{item.desc}</span>
                    </span>
                  </Link>
                </DropdownMenuItem>
              );
            })}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationsButton() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label="Notifications" className={ICON_BUTTON}>
          <Bell className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="border-b border-border px-4 py-3 text-subheading text-foreground">Notifications</div>
        <p className="px-4 py-6 text-center text-body text-muted-foreground">You&apos;re all caught up.</p>
      </PopoverContent>
    </Popover>
  );
}

// ── Mobile drawer ────────────────────────────────────────────────────────────

function MobileNav({
  open,
  onOpenChange,
  returnFocusRef,
  isLandingPage,
  onAuthNavigate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The button that opened the drawer; focus goes back to it on close (the Sheet has no Trigger of its own). */
  returnFocusRef: React.RefObject<HTMLButtonElement>;
  isLandingPage: boolean;
  onAuthNavigate: (url: string) => (e: React.MouseEvent) => void;
}) {
  const { user, isAuthenticated, logout } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const pathname = usePathname();
  const name = user?.username ?? 'Account';
  const close = () => onOpenChange(false);

  const handleLogout = async () => {
    close();
    await logout();
    toast({ title: 'Signed out', description: 'See you next time.' });
    router.replace('/');
  };

  const row =
    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-body font-medium transition-colors';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="flex w-[300px] flex-col gap-0 overflow-y-auto p-0 sm:max-w-[300px]"
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          returnFocusRef.current?.focus();
        }}
      >
        <div className="flex h-14 flex-shrink-0 items-center gap-2.5 border-b border-border px-4">
          <img src="/logo.png" alt="" className="h-7 w-7 rounded-md" />
          <SheetTitle className="text-subheading font-semibold text-foreground">Nivro</SheetTitle>
          <SheetDescription className="sr-only">Site navigation</SheetDescription>
        </div>

        <div className="flex-1 space-y-1 px-3 py-3">
          {isLandingPage ? (
            <>
              {LANDING_LINKS.map((l) => (
                <Link key={l.href} href={l.href} onClick={close} className={cn(row, 'text-muted-foreground hover:bg-accent hover:text-foreground')}>
                  {l.label}
                </Link>
              ))}
              <div className="my-3 h-px bg-border" />
              {isAuthenticated ? (
                <Link href="/home" onClick={close} className={cn(row, 'border border-border text-foreground')}>
                  Dashboard
                </Link>
              ) : (
                <div className="space-y-2">
                  <Link
                    href="/auth?mode=signin"
                    onClick={(e) => { close(); onAuthNavigate('/auth?mode=signin')(e); }}
                    className={cn(row, 'justify-center text-muted-foreground hover:bg-accent hover:text-foreground')}
                  >
                    Log in
                  </Link>
                  <Link
                    href="/auth?mode=signin"
                    onClick={(e) => { close(); onAuthNavigate('/auth?mode=signin')(e); }}
                    className={cn(row, 'justify-center bg-brand-600 text-white hover:bg-brand-500')}
                  >
                    Sign in
                  </Link>
                </div>
              )}
            </>
          ) : (
            <>
              {isAuthenticated && user && (
                <div className="mb-2 flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-3">
                  <ProfileAvatar name={name} size={32} />
                  <div className="min-w-0">
                    <div className="truncate text-body font-semibold text-foreground">@{name}</div>
                    <div className="truncate text-caption text-muted-foreground">{user.email}</div>
                  </div>
                </div>
              )}

              <Link
                href={isAuthenticated ? '/home' : '/'}
                onClick={close}
                aria-current={pathname === '/home' || pathname === '/' ? 'page' : undefined}
                className={cn(row, pathname === '/home' || pathname === '/' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground')}
              >
                <Home className="h-4 w-4" aria-hidden /> Home
              </Link>

              {NAV_MODULES.map((mod) => (
                <div key={mod.id} className="pt-3">
                  <div className="px-3 pb-1 text-label text-muted-foreground">{mod.label}</div>
                  {mod.items?.map(({ href, label, icon: Icon, badge }) => {
                    const active = isActivePath(pathname, href);
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={close}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          row,
                          'py-2',
                          active ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                        )}
                      >
                        <Icon className={cn('h-4 w-4 flex-shrink-0', active && 'text-brand-400')} aria-hidden />
                        <span className="flex-1">{label}</span>
                        {badge && <NavBadge>{badge}</NavBadge>}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </>
          )}
        </div>

        <div className="flex-shrink-0 space-y-3 border-t border-border px-3 py-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-label text-muted-foreground">Theme</span>
            <ThemeSegmented />
          </div>
          {isAuthenticated && !isLandingPage && (
            <button
              type="button"
              onClick={handleLogout}
              className={cn(row, 'w-full text-negative-400 hover:bg-negative-500/10')}
            >
              <LogOut className="h-4 w-4" aria-hidden /> Sign out
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Main layout ──────────────────────────────────────────────────────────────

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const reduceMotion = useReducedMotion();
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [scrolled, setScrolled] = useState(false);

  const isAuthPage = pathname === '/auth' || pathname === '/login' || pathname === '/onboarding';
  const isLandingPage = pathname === '/';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Sign-in navigation plays the landing page's exit animation first.
  const handleAuthNavigation = (targetUrl: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setTimeout(() => {
      if (isLandingPage) window.dispatchEvent(new Event('premium-auth-exit'));
      setTimeout(() => router.push(targetUrl), 150);
    }, 120);
  };

  const solidHeader = scrolled || !isLandingPage;

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only fixed left-3 top-3 z-[100] rounded-md bg-brand-600 px-3 py-2 text-body font-medium text-white focus:not-sr-only"
      >
        Skip to content
      </a>

      {/* ══ HEADER ═════════════════════════════════════════════════════════ */}
      <header
        className={cn(
          'sticky top-0 z-40 w-full border-b transition-colors duration-200',
          solidHeader ? 'border-border bg-background/90 backdrop-blur' : 'border-transparent bg-transparent'
        )}
      >
        <div
          className={cn(
            'mx-auto flex w-full items-center gap-4 px-4 sm:px-6',
            isLandingPage ? 'h-16 max-w-7xl' : 'h-14 max-w-[1600px] gap-6'
          )}
        >
          {/* Brand */}
          <Link href="/" aria-label="Nivro home" className="flex flex-shrink-0 items-center gap-2.5 rounded-md">
            <img src="/logo.png" alt="" className="h-8 w-8 rounded-lg" />
            <span className="hidden flex-col sm:flex">
              <span className="text-subheading font-semibold leading-5 tracking-tight text-foreground">Nivro</span>
              <span className="mt-0.5 text-2xs font-medium leading-4 text-muted-foreground">Markets &amp; Wealth</span>
            </span>
          </Link>

          {/* Primary navigation */}
          {!isAuthPage && isLandingPage && (
            <nav aria-label="Primary" className="ml-6 hidden items-center gap-8 lg:flex">
              {LANDING_LINKS.map((l) => (
                <Link key={l.href} href={l.href} className="text-body font-medium text-muted-foreground transition-colors hover:text-foreground">
                  {l.label}
                </Link>
              ))}
            </nav>
          )}

          {!isAuthPage && !isLandingPage && (
            <nav aria-label="Primary" className="ml-6 hidden items-center lg:flex xl:ml-10">
              {NAV_MODULES.map((mod) => {
                const active = MODULE_MATCH[mod.id]?.(pathname) ?? false;
                if (MENU_MODULES.has(mod.id)) return <NavMenu key={mod.id} mod={mod} active={active} />;
                return (
                  <Link
                    key={mod.id}
                    href={mod.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(NAV_ITEM, active ? NAV_ACTIVE : NAV_INACTIVE)}
                  >
                    {mod.label}
                    {mod.badge && <NavBadge>{mod.badge}</NavBadge>}
                  </Link>
                );
              })}
            </nav>
          )}

          <div className="flex-1" />

          {/* Right cluster */}
          <div className="flex items-center gap-1">
            {!isAuthPage && !isLandingPage && <MarketSelector className="mr-1" />}
            <ThemeToggle />

            {!isAuthPage && isLandingPage && (
              <div className="ml-3 flex items-center gap-2">
                {isAuthenticated ? (
                  <Link
                    href="/home"
                    className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-3.5 text-body font-medium text-foreground transition-colors hover:bg-accent"
                  >
                    Dashboard
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/auth?mode=signin"
                      onClick={handleAuthNavigation('/auth?mode=signin')}
                      className="hidden h-9 items-center rounded-lg px-3 text-body font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
                    >
                      Log in
                    </Link>
                    <Link
                      href="/auth?mode=signin"
                      onClick={handleAuthNavigation('/auth?mode=signin')}
                      className="inline-flex h-9 items-center rounded-lg bg-brand-600 px-3.5 text-body font-medium text-white transition-colors hover:bg-brand-500"
                    >
                      Sign in
                    </Link>
                  </>
                )}
              </div>
            )}

            {!isAuthPage && !isLandingPage && (
              <>
                <NotificationsButton />
                <span aria-hidden className="mx-1 hidden h-5 w-px bg-border sm:block" />
                <UserMenu />
              </>
            )}

            {!isAuthPage && (
              <button
                ref={menuButtonRef}
                type="button"
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation menu"
                className={cn(ICON_BUTTON, 'ml-0.5 lg:hidden')}
              >
                <Menu className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
              </button>
            )}
          </div>
        </div>
      </header>

      {!isAuthPage && (
        <MobileNav
          open={mobileOpen}
          onOpenChange={setMobileOpen}
          returnFocusRef={menuButtonRef}
          isLandingPage={isLandingPage}
          onAuthNavigate={handleAuthNavigation}
        />
      )}

      {/* ══ CONTENT ════════════════════════════════════════════════════════ */}
      <main id="main-content" tabIndex={-1} className="relative flex flex-1 flex-col outline-none">
        <motion.div
          key={pathname}
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="flex flex-1 flex-col"
        >
          {children}
        </motion.div>
      </main>

      {/* ══ MOBILE TAB BAR ═════════════════════════════════════════════════ */}
      {!isLandingPage && !isAuthPage && (
        <>
          <nav
            aria-label="Primary mobile"
            className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-border bg-background/95 px-2 pt-1.5 backdrop-blur lg:hidden"
          >
            {MOBILE_TABS.map(({ href, icon: Icon, label }) => {
              const active = pathname === href || (href !== '/' && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative flex min-w-[48px] flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 transition-colors',
                    active ? 'text-brand-400' : 'text-muted-foreground'
                  )}
                >
                  {active && <span aria-hidden className="absolute -top-1.5 h-0.5 w-8 rounded-full bg-brand-500" />}
                  <Icon className="h-5 w-5" strokeWidth={active ? 2 : 1.75} aria-hidden />
                  <span className="text-[11px] font-medium leading-none">{label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="mobile-bottom-spacer lg:hidden" />
        </>
      )}
    </div>
  );
}
