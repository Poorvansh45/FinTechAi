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
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#060A12] overflow-hidden select-none">

      {/* ── Subtle ambient glows ──────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0">
        {/* Top-center indigo glow */}
        <div className="absolute top-[-12%] left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-indigo-600/[0.07] blur-[120px]" />
        {/* Bottom-left violet */}
        <div className="absolute bottom-[-8%] left-[-6%] w-[400px] h-[350px] rounded-full bg-violet-700/[0.05] blur-[100px]" />
        {/* Bottom-right cyan hint */}
        <div className="absolute bottom-[-6%] right-[-4%] w-[300px] h-[250px] rounded-full bg-cyan-500/[0.04] blur-[90px]" />
      </div>

      {/* ── SVG candlestick background art ─────────────────────── */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 flex items-end justify-center opacity-[0.018]">
        <svg
          viewBox="0 0 800 260"
          className="w-full max-w-4xl max-h-[200px]"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ maskImage: 'linear-gradient(to top, white 30%, transparent 100%)' }}
        >
          {/* Candlestick wicks + bodies */}
          {[
            { x: 60, wt: 180, wb: 70, bt: 160, bb: 100, up: true },
            { x: 110, wt: 140, wb: 50, bt: 130, bb: 80, up: false },
            { x: 160, wt: 120, wb: 30, bt: 100, bb: 50, up: true },
            { x: 210, wt: 150, wb: 60, bt: 140, bb: 80, up: true },
            { x: 260, wt: 130, wb: 40, bt: 110, bb: 60, up: false },
            { x: 310, wt: 160, wb: 50, bt: 150, bb: 80, up: true },
            { x: 360, wt: 100, wb: 20, bt: 80, bb: 40, up: true },
            { x: 410, wt: 130, wb: 45, bt: 120, bb: 70, up: false },
            { x: 460, wt: 90, wb: 15, bt: 75, bb: 30, up: true },
            { x: 510, wt: 140, wb: 55, bt: 120, bb: 75, up: true },
            { x: 560, wt: 110, wb: 30, bt: 95, bb: 50, up: false },
            { x: 610, wt: 150, wb: 60, bt: 135, bb: 80, up: true },
            { x: 660, wt: 120, wb: 35, bt: 100, bb: 55, up: true },
            { x: 710, wt: 140, wb: 50, bt: 125, bb: 70, up: false },
          ].map((c, i) => (
            <g key={i}>
              {/* Wick */}
              <line
                x1={c.x} y1={c.wt} x2={c.x} y2={c.wb}
                stroke={c.up ? '#818cf8' : '#a78bfa'}
                strokeWidth="1.5"
              />
              {/* Body */}
              <rect
                x={c.x - 8} y={c.bt}
                width="16" height={Math.abs(c.bb - c.bt)}
                rx="1.5"
                fill={c.up ? '#818cf8' : '#a78bfa'}
              />
            </g>
          ))}
          {/* Smooth trend line */}
          <path
            d="M30 170 Q120 110 210 130 T400 70 T580 90 T770 50"
            stroke="url(#trendGrad)"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
          />
          <defs>
            <linearGradient id="trendGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.4" />
              <stop offset="50%" stopColor="#7c3aed" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.3" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* ── Main content ──────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col items-center">

        {/* Logo */}
        <div className="relative mb-6">
          <div className="w-[72px] h-[72px] rounded-2xl overflow-hidden shadow-lg shadow-indigo-500/20 ring-1 ring-white/10">
            <img src="/logo.png" alt="Nivro" className="w-full h-full object-contain" />
          </div>
          {/* Soft pulsing halo */}
          <div
            className="absolute -inset-3 rounded-3xl opacity-0"
            style={{
              background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
              animation: 'logoHalo 2.4s ease-in-out infinite',
            }}
          />
        </div>

        {/* Brand name */}
        <h1
          className="text-white font-bold tracking-tight"
          style={{ fontSize: '28px', letterSpacing: '-0.02em' }}
        >
          Nivro
        </h1>

        {/* Tagline */}
        <p
          className="mt-1.5 font-medium uppercase tracking-[0.25em] text-slate-500"
          style={{ fontSize: '10px' }}
        >
          Trading Intelligence
        </p>

        {/* Divider ornament */}
        <div className="mt-7 mb-5 flex items-center gap-3">
          <div className="w-8 h-px bg-gradient-to-r from-transparent to-indigo-500/40" />
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/50" />
          <div className="w-8 h-px bg-gradient-to-l from-transparent to-indigo-500/40" />
        </div>

        {/* Status text */}
        <p className="text-slate-400 text-[13px] font-medium tracking-wide">
          Preparing your workspace
        </p>

        {/* Progress bar — indeterminate, no fake % */}
        <div className="mt-5 w-52 h-[3px] rounded-full overflow-hidden bg-white/[0.06]">
          <div
            className="h-full rounded-full"
            style={{
              background: 'linear-gradient(90deg, #4f46e5, #7c3aed, #06b6d4)',
              animation: 'splashBar 1.6s cubic-bezier(0.4, 0, 0.2, 1) infinite',
            }}
          />
        </div>

        {/* Bottom tagline */}
        <p
          className="mt-10 text-slate-600 text-[11px] tracking-wide"
          style={{ letterSpacing: '0.06em' }}
        >
          See More. Know Better.
        </p>
      </div>

      {/* ── Keyframe animations ───────────────────────────────────── */}
      <style>{`
        @keyframes splashBar {
          0%   { width: 0%;  margin-left: 0%; }
          50%  { width: 60%; margin-left: 20%; }
          100% { width: 0%;  margin-left: 100%; }
        }
        @keyframes logoHalo {
          0%, 100% { opacity: 0; transform: scale(0.95); }
          50%      { opacity: 1; transform: scale(1.05); }
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
