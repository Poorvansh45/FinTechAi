'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react';
import type { AuthUser } from '@/lib/api/authApi';
import {
  apiGetMe,
  apiGetToken,
  apiLogin,
  apiLogout,
  apiUpdateUsername,
  AuthApiError,
} from '@/lib/api/authApi';
import { setCachedAuthToken } from '@/lib/api/authToken';
import { useToast } from '@/hooks/use-toast';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type AuthStatus = 'initializing' | 'unauthenticated' | 'authenticated';

interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUsername: (username: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─────────────────────────────────────────────────────────────────────────────
// Loading Screen
// ─────────────────────────────────────────────────────────────────────────────

function AuthLoadingScreen() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background select-none"
    >
      <div className="flex flex-col items-center">
        <div className="h-[64px] w-[64px] overflow-hidden rounded-xl ring-1 ring-foreground/10">
          <img src="/logo.png" alt="" className="h-full w-full object-contain" />
        </div>

        <h1 className="mt-5 text-title font-semibold tracking-tight text-foreground">Nivro</h1>
        <p className="mt-1 text-caption text-neutral-400">A setup is not a decision.</p>

        <p className="mt-8 text-label text-neutral-300">Preparing your workspace</p>

        {/* Indeterminate progress, no fake percentage */}
        <div className="mt-3 h-[3px] w-48 overflow-hidden rounded-full bg-foreground/10">
          <div
            className="h-full rounded-full bg-brand-500"
            style={{ animation: 'splashBar 1.6s cubic-bezier(0.4, 0, 0.2, 1) infinite' }}
          />
        </div>
      </div>

      <style>{`
        @keyframes splashBar {
          0%   { width: 0%;  margin-left: 0%; }
          50%  { width: 60%; margin-left: 20%; }
          100% { width: 0%;  margin-left: 100%; }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('initializing');
  const [bootstrapped, setBootstrapped] = useState(false);

  // ── Session restore on mount ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function restoreSession() {
      try {
        const me = await apiGetMe();
        setCachedAuthToken(me ? await apiGetToken() : null);
        if (!cancelled) {
          setUser(me);
          setStatus(me ? 'authenticated' : 'unauthenticated');
        }
      } catch {
        setCachedAuthToken(null);
        if (!cancelled) {
          setUser(null);
          setStatus('unauthenticated');
        }
      } finally {
        if (!cancelled) setBootstrapped(true);
      }
    }
    restoreSession();
    return () => { cancelled = true; };
  }, []);

  // ── Actions ───────────────────────────────────────────────────

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiLogin(email, password);
    setCachedAuthToken(await apiGetToken());
    setUser(data.user);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // Even if server fails, clear local state
    }
    setCachedAuthToken(null);
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const updateUsername = useCallback(async (username: string) => {
    const data = await apiUpdateUsername(username);
    setUser(data.user);
    toast({ title: 'Username updated!', description: `You are now @${data.user.username}` });
  }, [toast]);

  const refreshUser = useCallback(async () => {
    try {
      const me = await apiGetMe();
      setCachedAuthToken(me ? await apiGetToken() : null);
      setUser(me);
      setStatus(me ? 'authenticated' : 'unauthenticated');
    } catch {
      setCachedAuthToken(null);
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  // ── Context value ─────────────────────────────────────────────

  const isAuthenticated = status === 'authenticated';
  const loading = !bootstrapped;

  const value = useMemo(
    () => ({
      user,
      status,
      loading,
      isAuthenticated,
      login,
      logout,
      updateUsername,
      refreshUser,
    }),
    [user, status, loading, isAuthenticated, login, logout, updateUsername, refreshUser]
  );

  if (!bootstrapped) {
    return <AuthLoadingScreen />;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
