'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, LineChart, BookOpen, Settings, LogOut, Home, LayoutDashboard } from 'lucide-react';
import { useAuth } from '@/context/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { profileInitial } from '@/lib/auth/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const USER_LINKS = [
  { href: '/home',       icon: Home,            label: 'Home'      },
  { href: '/markets',    icon: LayoutDashboard, label: 'Markets'   },
  { href: '/journal',    icon: BookOpen,        label: 'Journal'   },
  { href: '/analytics',  icon: LineChart,       label: 'Analytics' },
  { href: '/settings',   icon: Settings,        label: 'Settings'  },
];

export function ProfileAvatar({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className="inline-flex flex-shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white"
    >
      {profileInitial(name)}
    </span>
  );
}

export function UserMenu() {
  const { user, isAuthenticated, logout } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  if (!isAuthenticated || !user) {
    // Private beta: no "Get Started" — there is nothing to sign up for.
    return (
      <Link
        href="/auth?mode=signin"
        className="inline-flex h-9 items-center rounded-lg bg-brand-600 px-3.5 text-body font-medium text-white transition-colors hover:bg-brand-500"
      >
        Sign in
      </Link>
    );
  }

  const name = user.username ?? 'Account';

  const handleLogout = async () => {
    await logout();
    toast({ title: 'Signed out', description: 'See you next time.' });
    router.replace('/');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Account menu for ${name}`}
          className="group inline-flex h-9 items-center gap-2 rounded-lg pl-1 pr-2 transition-colors hover:bg-foreground/[0.06] data-[state=open]:bg-foreground/[0.06]"
        >
          <ProfileAvatar name={name} />
          <span className="hidden max-w-[110px] truncate text-body font-medium text-foreground xl:block">
            {name}
          </span>
          <ChevronDown
            aria-hidden
            className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60 p-1.5">
        <DropdownMenuLabel className="flex items-center gap-3 px-2 py-2">
          <ProfileAvatar name={name} size={32} />
          <span className="min-w-0">
            <span className="block truncate text-body font-semibold text-foreground">@{name}</span>
            <span className="block truncate text-caption font-normal text-muted-foreground">{user.email}</span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-border" />
        {USER_LINKS.map(({ href, icon: Icon, label }) => (
          <DropdownMenuItem key={href} asChild className="gap-2.5 rounded-md px-2 py-2 text-body">
            <Link href={href}>
              <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
              {label}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator className="bg-border" />
        <DropdownMenuItem
          onSelect={handleLogout}
          className="gap-2.5 rounded-md px-2 py-2 text-body text-negative-400 focus:bg-negative-500/10 focus:text-negative-400"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
