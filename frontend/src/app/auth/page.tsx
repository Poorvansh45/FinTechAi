'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthProvider';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import {
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  Mail,
  Lock,
  User,
  Brain,
  Target,
  FlaskConical,
  Shield,
} from 'lucide-react';
import { AuthApiError } from '@/lib/api/authApi';



// ─── Input field with inline icon support ──────────────────────────────────
function AuthInput({
  id,
  type = 'text',
  label,
  value,
  onChange,
  error,
  placeholder,
  autoFocus,
  showToggle,
  onToggle,
  isPasswordVisible,
  icon: Icon,
}: {
  id: string;
  type?: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
  autoFocus?: boolean;
  showToggle?: boolean;
  onToggle?: () => void;
  isPasswordVisible?: boolean;
  icon?: any;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-semibold text-slate-400 uppercase tracking-wide">
        {label}
      </label>
      <div className="relative">
        {Icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
            <Icon className="w-4 h-4" />
          </div>
        )}
        <input
          id={id}
          type={showToggle ? (isPasswordVisible ? 'text' : 'password') : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete={type === 'password' ? 'current-password' : type === 'email' ? 'email' : 'username'}
          className={`w-full ${
            Icon ? 'pl-11' : 'px-4'
          } py-3 rounded-xl text-sm font-medium text-white placeholder:text-white/20 focus:outline-none transition-all duration-200 pr-10 border ${
            error
              ? 'border-red-500/60 bg-red-500/5 focus:border-red-500'
              : 'border-white/8 bg-white/4 focus:border-indigo-500/60 focus:bg-white/6'
          }`}
          style={{
            background: error ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.04)',
            borderColor: error ? 'rgba(239,68,68,0.5)' : value ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)',
          }}
        />
        {showToggle && (
          <button
            type="button"
            onClick={onToggle}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
            tabIndex={-1}
          >
            {isPasswordVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="flex items-center gap-1.5 text-[11px] text-red-400 font-medium mt-1.5"
          >
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main split-screen auth page content ─────────────────────────────────────
function AuthPageContent() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  // Nivro is a closed private beta — accounts are seeded server-side and
  // there is no /api/auth/register route. Sign-in is the only mode; `isSignup`
  // stays for the sign-up-only JSX branches below, which now never render.
  const mode = 'signin' as const;
  const isSignup = false;

  // ── Form state ────────────────────────────────────────────────
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Validation errors ─────────────────────────────────────────
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      router.replace('/');
    }
  }, [user, loading, router]);

  // No switchMode: sign-in is the only mode during the private beta.

  // ── Client validation ─────────────────────────────────────────
  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (isSignup) {
      if (!username.trim()) newErrors.username = 'Username is required';
      else if (username.trim().length < 3) newErrors.username = 'At least 3 characters';
      else if (username.trim().length > 20) newErrors.username = 'At most 20 characters';
      else if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) newErrors.username = 'Letters, numbers, underscores only';
    }

    if (!email.trim()) newErrors.email = 'Email is required';
    else if (!/^\S+@\S+\.\S+$/.test(email)) newErrors.email = 'Enter a valid email';

    if (!password) newErrors.password = 'Password is required';
    else if (password.length < 6) newErrors.password = 'At least 6 characters';

    if (isSignup && password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  // ── Submit ─────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await login(email.trim().toLowerCase(), password);
      toast({ title: 'Welcome back!', description: 'Signed in successfully.' });
      router.replace('/');
    } catch (err) {
      // 403 means the account exists but is not on the beta — say so plainly
      // rather than leaving the user retrying a password that is actually fine.
      const isNotInvited = err instanceof AuthApiError && err.status === 403;
      const msg = isNotInvited
        ? 'Nivro is currently invite-only and this account is not active.'
        : err instanceof AuthApiError
          ? err.message
          : 'Something went wrong. Please try again.';
      toast({
        title: isNotInvited ? 'Invite required' : 'Error',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Google Sign-in Handler ──────────────────────────────────────
  const handleGoogleSignIn = () => {
    toast({
      title: 'Google Sign In',
      description: 'Google authentication is currently a visual placeholder and will be enabled soon.',
    });
  };

  return (
    <div className="w-full flex-grow flex flex-col justify-start select-none relative">
      
      {/* Main Wrapper Content Panel */}
      <div className="flex-grow w-full flex items-center justify-center py-6 md:py-8 lg:py-10">
        
        {/* Main Container: Centered, 65/35 visual weight ratio, max-width scaled */}
        <div className="w-full max-w-[1520px] mx-auto px-6 lg:px-8 flex flex-col lg:flex-row items-center justify-center gap-10 lg:gap-14 relative z-10 lg:max-h-[85vh] lg:h-fit">
          
          {/* ═══ LEFT PANEL: Premium Showcase (Hidden on Mobile) ════════════════ */}
          <div className="hidden lg:flex lg:w-[65%] flex-col justify-start gap-y-4 text-white relative z-10 py-1">
            
            {/* Core Product Story (Margins tightened and spacing optimized) */}
            <div className="space-y-3 max-w-[960px] text-left">
              <div className="space-y-1.5">
                {/* Product Badge to immediately communicate AI Trading OS */}
                <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full backdrop-blur-md bg-white/[0.02] border border-white/[0.08] text-[#94A3B8] shadow-[0_0_15px_rgba(139,92,246,0.05)] hover:border-[#8B5CF6]/30 transition-all duration-300 w-fit">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6] animate-pulse shadow-[0_0_8px_rgba(139,92,246,0.8)]" />
                  <span className="font-mono tracking-[0.25em] text-[9px] uppercase text-[#A78BFA]">AI TRADING OS</span>
                </div>
                <h1 className="text-5xl xl:text-6xl font-black text-white leading-[1.1] tracking-tight">
                  The AI Operating System <br />
                  for <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-indigo-400 to-cyan-400">Modern Traders.</span>
                </h1>
                <p className="text-xs text-slate-400 leading-relaxed font-sans max-w-xl">
                  Research markets. Detect smart money footprints. <br />
                  Optimize portfolio decisions. Trade with intelligence.
                </p>
              </div>
  
              {/* High-Fidelity Preview Casing (Scaled to occupy more horizontal space) */}
              <div className="relative pt-2 max-w-[940px] w-full">
              
              {/* Floating Glassmorphism Metric Chips */}
              <div className="absolute top-1 left-8 bg-[#0B1020]/90 border border-emerald-500/30 backdrop-blur-xl rounded-full px-3 py-1 text-[9px] font-bold text-emerald-400 flex items-center gap-1.5 shadow-[0_4px_20px_rgba(0,0,0,0.5)] z-20 hover:border-emerald-400/50 hover:scale-105 transition-all duration-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>+24.1% Backtest Return</span>
              </div>
              <div className="absolute top-1 right-8 bg-[#0B1020]/90 border border-indigo-500/30 backdrop-blur-xl rounded-full px-3 py-1 text-[9px] font-bold text-indigo-400 flex items-center gap-1.5 shadow-[0_4px_20px_rgba(0,0,0,0.5)] z-20 hover:border-indigo-400/50 hover:scale-105 transition-all duration-300">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                <span>92% Strategy Compliance</span>
              </div>
              <div className="absolute bottom-2 right-12 bg-[#0B1020]/90 border border-violet-500/30 backdrop-blur-xl rounded-full px-3 py-1 text-[9px] font-bold text-violet-400 flex items-center gap-1.5 shadow-[0_4px_20px_rgba(0,0,0,0.5)] z-20 hover:border-violet-400/50 hover:scale-105 transition-all duration-300">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-ping absolute" />
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 relative" />
                <span>14 Institutional Signals Today</span>
              </div>

              {/* Main Casing */}
              <div className="rounded-2xl border border-white/[0.06] bg-[#0A0D16]/90 shadow-2xl p-4 overflow-hidden">
                {/* Top header dots */}
                <div className="flex items-center justify-between pb-3 border-b border-white/[0.04]">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500/40" />
                    <span className="w-2 h-2 rounded-full bg-yellow-500/40" />
                    <span className="w-2 h-2 rounded-full bg-green-500/40" />
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[8px] font-semibold text-emerald-400 uppercase tracking-widest">
                    <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                    Live Workspace
                  </div>
                </div>

                {/* Simulated Live Feed Grid */}
                <div className="grid grid-cols-3 gap-3.5 pt-3.5 text-left">
                  
                  {/* Market Monitor (Col 1) */}
                  <div className="p-3 rounded-xl bg-white/[0.01] border border-white/[0.04]">
                    <div className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-2">Market Monitor</div>
                    <div className="space-y-2">
                      {[
                        { ticker: 'SPY', name: 'S&P 500 ETF', val: '542.18', pct: '+1.24%' },
                        { ticker: 'QQQ', name: 'Nasdaq 100 ETF', val: '478.42', pct: '+2.11%' },
                        { ticker: 'AAPL', name: 'Apple Inc.', val: '212.49', pct: '+0.85%' },
                        { ticker: 'NVDA', name: 'NVIDIA Corp.', val: '128.35', pct: '+1.68%' },
                      ].map((x) => (
                        <div key={x.ticker} className="flex items-center justify-between text-[10px]">
                          <div>
                            <div className="font-bold text-white leading-none">{x.ticker}</div>
                            <div className="text-[7px] text-slate-500 mt-0.5">{x.name}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-white font-mono">{x.val}</div>
                            <div className="text-[8px] font-bold text-emerald-400 font-mono mt-0.5">{x.pct}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* SMC Order Block Scanner (Col 2) */}
                  <div className="p-3 rounded-xl bg-white/[0.01] border border-white/[0.04] flex flex-col justify-between">
                    <div>
                      <div className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-2.5">SMC Order Block</div>
                      {/* Candlestick illustration */}
                      <div className="relative h-20 w-full flex items-end justify-between px-1 mt-1">
                        {/* Grid Background */}
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:10px_10px]" />
                        {/* Bullish OB Box */}
                        <div className="absolute bottom-[10px] left-[15px] right-[10px] h-[35px] bg-indigo-500/5 border border-dashed border-indigo-500/25 rounded flex items-center justify-center pointer-events-none">
                          <span className="text-[8px] font-bold text-indigo-400/90 tracking-wider">Bullish OB</span>
                        </div>

                        {/* Candles */}
                        {[
                          { wickH: 'h-12', bodyH: 'h-6', up: false },
                          { wickH: 'h-10', bodyH: 'h-4', up: false },
                          { wickH: 'h-14', bodyH: 'h-8', up: false },
                          { wickH: 'h-8', bodyH: 'h-3', up: true },
                          { wickH: 'h-16', bodyH: 'h-10', up: true },
                          { wickH: 'h-10', bodyH: 'h-5', up: false },
                          { wickH: 'h-12', bodyH: 'h-7', up: true },
                          { wickH: 'h-14', bodyH: 'h-9', up: true },
                        ].map((c, i) => (
                          <div key={i} className="flex flex-col items-center flex-1 h-full justify-end relative z-10">
                            <div className={`w-[1px] ${c.wickH} ${c.up ? 'bg-emerald-500/40' : 'bg-red-500/40'}`} />
                            <div className={`w-1 ${c.bodyH} rounded-sm ${c.up ? 'bg-emerald-500' : 'bg-red-500'}`} />
                            <div className={`w-[1px] h-2 ${c.up ? 'bg-emerald-500/40' : 'bg-red-500/40'}`} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* AI Copilot Feed (Col 3) */}
                  <div className="p-3 rounded-xl bg-white/[0.01] border border-white/[0.04]">
                    <div className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-2">AI Copilot Feed</div>
                    <div className="space-y-2 font-sans">
                      {[
                        { label: 'Setup Detected', desc: 'Bullish OB identified on EURUSD 15m.', color: 'text-violet-400 bg-violet-400/5 border-violet-400/10' },
                        { label: 'Risk Check', desc: 'R:R Optimized. Drawdown within limit.', color: 'text-emerald-400 bg-emerald-400/5 border-emerald-400/10' },
                        { label: 'Smart Money Act', desc: 'High volume accumulation detected.', color: 'text-indigo-400 bg-indigo-400/5 border-indigo-400/10' },
                      ].map((f) => (
                        <div key={f.label} className={`p-1.5 rounded-lg border text-[8px] ${f.color}`}>
                          <div className="font-bold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {f.label}
                          </div>
                          <div className="text-[7.5px] text-slate-400 mt-0.5 leading-relaxed">{f.desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Portfolio Optimizer (Bottom Row - Col 1) */}
                  <div className="p-3 rounded-xl bg-white/[0.01] border border-white/[0.04] flex items-center gap-2.5">
                    <div className="relative flex-shrink-0 flex items-center justify-center">
                      <svg viewBox="0 0 36 36" className="w-12 h-12 transform -rotate-90">
                        <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="rgba(255,255,255,0.02)" strokeWidth="3" />
                        <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#8B5CF6" strokeWidth="3" strokeDasharray="42 58" strokeDashoffset="0" />
                        <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#4F46E5" strokeWidth="3" strokeDasharray="28 72" strokeDashoffset="-42" />
                        <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#06B6D4" strokeWidth="3" strokeDasharray="18 82" strokeDashoffset="-70" />
                        <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#475569" strokeWidth="3" strokeDasharray="12 88" strokeDashoffset="-88" />
                      </svg>
                      <div className="absolute flex flex-col items-center justify-center">
                        <span className="text-[8px] font-bold text-white font-mono">+3.2%</span>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[8px] font-bold text-slate-500 uppercase tracking-wider leading-none">Portfolio Optimizer</div>
                      <div className="text-[10px] font-black text-white font-mono mt-1">$125,430.50</div>
                      <div className="grid grid-cols-2 gap-x-1.5 gap-y-0.5 mt-1 text-[7.5px] text-slate-400">
                        <div className="flex items-center gap-0.5"><span className="w-1 h-1 rounded-full bg-[#8B5CF6]" />NVDA 42%</div>
                        <div className="flex items-center gap-0.5"><span className="w-1 h-1 rounded-full bg-[#4F46E5]" />AAPL 28%</div>
                      </div>
                    </div>
                  </div>

                  {/* Quant Strategy Lab (Bottom Row - Col 2-3) */}
                  <div className="p-3 rounded-xl bg-white/[0.01] border border-white/[0.04] col-span-2 flex items-center justify-between">
                    <div>
                      <div className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Quant Strategy Lab</div>
                      <div className="flex items-baseline gap-3 mt-1.5">
                        <div>
                          <div className="text-[7.5px] text-slate-500 uppercase tracking-wider">Sharpe Ratio</div>
                          <div className="text-[12px] font-black text-white font-mono mt-0.5">1.78</div>
                        </div>
                        <div>
                          <div className="text-[7.5px] text-slate-500 uppercase tracking-wider">Live Backtest</div>
                          <div className="text-[12px] font-black text-emerald-400 font-mono mt-0.5">+24.11%</div>
                        </div>
                      </div>
                    </div>
                    {/* SVG wavy line graph */}
                    <div className="w-28 h-8 relative">
                      <svg className="w-full h-full" viewBox="0 0 100 30" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.25" />
                            <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        <path d="M0,25 Q15,10 30,22 T60,8 T90,15 T100,5" fill="none" stroke="#8B5CF6" strokeWidth="1.5" />
                        <path d="M0,25 Q15,10 30,22 T60,8 T90,15 T100,5 L100,30 L0,30 Z" fill="url(#chartGrad)" />
                      </svg>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>

          {/* Benefits Section */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 pt-4 border-t border-white/[0.04]">
            {[
              { icon: Brain, title: 'AI Market Intelligence', desc: 'Pattern recognition' },
              { icon: Target, title: 'Smart Money Scanner', desc: 'Detect footprints' },
              { icon: FlaskConical, title: 'Quant Research Lab', desc: 'Optimize strategies' },
              { icon: Shield, title: 'Local First Security', desc: 'Your data stays local' },
            ].map((b) => (
              <div key={b.title} className="space-y-1 text-left">
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-lg flex items-center justify-center bg-white/[0.03] border border-white/[0.06] text-violet-400">
                    <b.icon className="w-3 h-3" />
                  </span>
                  <span className="text-[10px] font-bold text-white">{b.title}</span>
                </div>
                <p className="text-[9px] text-slate-500 leading-normal font-sans">{b.desc}</p>
              </div>
            ))}
          </div>

        </div>

        {/* ═══ RIGHT PANEL: Authentication Form ═════ */}
        <div className="lg:w-[35%] w-full flex flex-col items-center justify-center relative z-10 py-1">
          
          {/* Mobile-only Branding Header */}
          <div className="lg:hidden flex items-center gap-2.5 mb-6">
            <img src="/logo.png" alt="Nivro Logo" className="w-7 h-7 object-contain" />
            <div className="leading-none">
              <div className="font-bold text-[14px] tracking-tight text-white">Nivro</div>
              <div className="text-[7px] font-bold tracking-widest uppercase text-slate-500 mt-0.5">TRADING INTELLIGENCE</div>
            </div>
          </div>

          {/* Premium Authentication Form Card (Size kept around 440px maximum) */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="w-full max-w-[440px] bg-[#0B0F19]/85 border border-white/[0.08] backdrop-blur-3xl rounded-3xl p-5 sm:p-8 lg:p-10 space-y-5 sm:space-y-6 shadow-2xl relative overflow-hidden"
          >
            {/* Top ambient glow */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="space-y-3.5 text-center relative z-10">
              {/* Private Beta Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.08] text-[11px] text-slate-300 font-medium shadow-inner">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse shadow-[0_0_8px_rgba(129,140,248,0.8)]" />
                <span className="text-slate-400 font-mono text-[10px] tracking-wider uppercase">Invite-Only Private Beta</span>
              </div>

              <div className="space-y-1">
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  {isSignup ? 'Create your account' : 'Welcome back'}
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {isSignup ? 'Sign up to get started' : 'Sign in to continue to your workspace'}
                </p>
              </div>
            </div>

            {/* Form */}
            <AnimatePresence mode="wait">
              <motion.form
                key={mode}
                onSubmit={handleSubmit}
                initial={{ opacity: 0, x: isSignup ? 8 : -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: isSignup ? -8 : 8 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="space-y-4"
              >
                {isSignup && (
                  <AuthInput
                    id="username"
                    label="Username"
                    value={username}
                    onChange={setUsername}
                    placeholder="e.g. AlphaTrader"
                    autoFocus={isSignup}
                    error={errors.username}
                    icon={User}
                  />
                )}

                <AuthInput
                  id="email"
                  type="email"
                  label="Email"
                  value={email}
                  onChange={setEmail}
                  placeholder="you@example.com"
                  autoFocus={!isSignup}
                  error={errors.email}
                  icon={Mail}
                />

                <AuthInput
                  id="password"
                  label="Password"
                  value={password}
                  onChange={setPassword}
                  placeholder={isSignup ? 'At least 6 characters' : '••••••••'}
                  error={errors.password}
                  showToggle
                  onToggle={() => setShowPw((v) => !v)}
                  isPasswordVisible={showPw}
                  icon={Lock}
                />

                {isSignup && (
                  <AuthInput
                    id="confirmPassword"
                    label="Confirm Password"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    placeholder="Repeat your password"
                    error={errors.confirmPassword}
                    showToggle
                    onToggle={() => setShowConfirmPw((v) => !v)}
                    isPasswordVisible={showConfirmPw}
                    icon={Lock}
                  />
                )}

                <div className="pt-2">
                  <motion.button
                    type="submit"
                    disabled={isSubmitting}
                    whileHover={{ scale: isSubmitting ? 1 : 1.01, y: isSubmitting ? 0 : -0.5 }}
                    whileTap={{ scale: 0.97 }}
                    className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-60 disabled:cursor-not-allowed transition-shadow"
                    style={{
                      background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                      boxShadow: isSubmitting ? 'none' : '0 0 20px rgba(99,102,241,0.3)',
                    }}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>{isSignup ? 'Creating account…' : 'Signing in…'}</span>
                      </>
                    ) : (
                      <>
                        <span>{isSignup ? 'Create Account' : 'Sign In'}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </motion.button>
                </div>

                {/* Social Divider */}
                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-white/[0.04]"></div>
                  <span className="flex-shrink mx-4 text-[10px] text-slate-500 uppercase tracking-widest font-mono">Or continue with</span>
                  <div className="flex-grow border-t border-white/[0.04]"></div>
                </div>

                {/* Google Sign In Button */}
                <motion.button
                  type="button"
                  onClick={handleGoogleSignIn}
                  whileTap={{ scale: 0.97 }}
                  className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl font-semibold text-sm text-slate-300 bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:text-white transition-all duration-200"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0">
                    <path
                      fill="#EA4335"
                      d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.47 15.01 0 12 0 7.37 0 3.44 2.67 1.56 6.56l3.87 3C6.39 6.84 9.01 5.04 12 5.04z"
                    />
                    <path
                      fill="#4285F4"
                      d="M23.49 12.27c0-.81-.07-1.59-.2-2.34H12v4.45h6.46c-.28 1.47-1.11 2.72-2.36 3.56l3.66 2.84c2.14-1.97 3.37-4.87 3.37-8.51z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.43 14.56c-.24-.72-.37-1.49-.37-2.28s.13-1.56.37-2.28l-3.87-3C.56 8.92 0 10.4 0 12s.56 3.08 1.56 4.72l3.87-3.16z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.66-2.84c-1.01.68-2.31 1.09-4.27 1.09-2.99 0-5.61-1.8-6.57-4.52l-3.87 3C3.44 21.33 7.37 24 12 24z"
                    />
                  </svg>
                  <span>Google</span>
                </motion.button>

                <p className="text-center text-[10px] text-slate-500 pt-1 leading-relaxed">
                  By continuing, you agree to our{' '}
                  <span className="text-indigo-400 hover:underline cursor-pointer">Terms of Service</span>{' '}
                  and{' '}
                  <span className="text-indigo-400 hover:underline cursor-pointer">Privacy Policy</span>.
                </p>
              </motion.form>
            </AnimatePresence>
          </motion.div>
        </div>

      </div>
    </div>
  </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 bg-[#080C14] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
        </div>
      }
    >
      <AuthPageContent />
    </Suspense>
  );
}
