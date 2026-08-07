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
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#080C14]">
      <div className="relative mb-8">
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center animate-pulse"
          style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}
        >
          <svg viewBox="0 0 24 24" className="w-10 h-10 text-white fill-none stroke-current stroke-2">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23-.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"
            />
          </svg>
        </div>
        <div
          className="absolute inset-0 rounded-2xl animate-ping"
          style={{ background: 'rgba(99,102,241,0.2)', animationDuration: '1.5s' }}
        />
      </div>
      <h2 className="text-white font-bold text-lg tracking-wide">FinTechAI</h2>
      <p className="text-violet-400 text-sm animate-pulse mt-2">Loading your workspace…</p>
      <div className="mt-8 w-48 h-0.5 rounded-full overflow-hidden bg-white/10">
        <div
          className="h-full rounded-full"
          style={{
            background: 'linear-gradient(90deg,#4f46e5,#7c3aed,#06b6d4)',
            animation: 'loadBar 1.4s ease-in-out infinite',
          }}
        />
      </div>
      <style>{`
        @keyframes loadBar {
          0%   { width: 0%; margin-left: 0%; }
          50%  { width: 70%; margin-left: 15%; }
          100% { width: 0%; margin-left: 100%; }
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
