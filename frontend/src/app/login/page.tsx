'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, ChevronRight } from 'lucide-react';

// ── Google Icon ───────────────────────────────────────────────
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

// ── Floating particle ─────────────────────────────────────────
function Particle({ x, y, delay, size }: { x: number; y: number; delay: number; size: number }) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        left: `${x}%`, top: `${y}%`, width: size, height: size,
        background: 'radial-gradient(circle, rgba(99,102,241,0.55) 0%, transparent 70%)',
      }}
      animate={{ y: [0, -28, 0], opacity: [0.15, 0.65, 0.15] }}
      transition={{ duration: 4 + delay, repeat: Infinity, delay, ease: 'easeInOut' }}
    />
  );
}

const PARTICLES = [
  { x: 8,  y: 18, delay: 0,   size: 6  },
  { x: 85, y: 12, delay: 0.5, size: 8  },
  { x: 50, y: 80, delay: 1,   size: 5  },
  { x: 18, y: 68, delay: 1.5, size: 10 },
  { x: 74, y: 58, delay: 0.8, size: 7  },
  { x: 33, y: 38, delay: 2,   size: 4  },
  { x: 62, y: 8,  delay: 1.2, size: 9  },
  { x: 91, y: 88, delay: 0.3, size: 6  },
];

type Step = 'signin' | 'username';

// ── Main Login Page ───────────────────────────────────────────
export default function LoginPage() {
  const { user, username, signInWithGoogle, saveUsername, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('signin');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [alias, setAlias] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // If already signed in and has username → go to dashboard
  useEffect(() => {
    if (!loading && user && username) {
      router.replace('/dashboard');
    }
    // If signed in but no username → show username step
    if (!loading && user && !username) {
      setStep('username');
    }
  }, [user, username, loading, router]);

  const handleGoogleSignIn = async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
      // useEffect above will handle routing to username step or dashboard
    } catch (err: any) {
      const msg = err?.code === 'auth/popup-closed-by-user'
        ? 'Sign-in cancelled.'
        : 'Sign-in failed. Please try again.';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSaveUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = alias.trim();
    if (trimmed.length < 3) {
      toast({ title: 'Invalid Alias', description: 'Alias must be at least 3 characters.', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      await saveUsername(trimmed);
      toast({ title: `Welcome, ${trimmed}! 🚀`, description: 'Your trading terminal is ready.', duration: 4000 });
      router.replace('/dashboard');
    } catch {
      toast({ title: 'Error', description: 'Failed to save alias. Please try again.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // Background
  const BG = (
    <div className="absolute inset-0">
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-30"
        style={{ background: 'radial-gradient(circle, rgba(79,70,229,0.4) 0%, transparent 70%)', filter: 'blur(80px)' }} />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-25"
        style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.4) 0%, transparent 70%)', filter: 'blur(80px)' }} />
      <div className="absolute top-[30%] right-[20%] w-[300px] h-[300px] rounded-full opacity-20"
        style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.35) 0%, transparent 70%)', filter: 'blur(60px)' }} />
      {PARTICLES.map((p, i) => <Particle key={i} {...p} />)}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: 'linear-gradient(rgba(99,102,241,1) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,1) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden flex items-center justify-center bg-[#080C14]">
      {BG}

      <AnimatePresence mode="wait">

        {/* ── STEP 1: Google Sign In ── */}
        {step === 'signin' && (
          <motion.div
            key="signin"
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.96 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 w-full max-w-md mx-4"
          >
            {/* Animated neon border */}
            <motion.div
              className="absolute -inset-[1px] rounded-3xl"
              style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed,#06b6d4,#4f46e5)', backgroundSize: '300% 300%' }}
              animate={{ backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
            />
            <div className="relative rounded-3xl p-8 sm:p-10"
              style={{ background: 'rgba(10,13,22,0.93)', backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)' }}>

              {/* Logo */}
              <div className="flex flex-col items-center mb-8">
                <motion.div
                  animate={{ boxShadow: ['0 0 18px rgba(99,102,241,0.35)', '0 0 48px rgba(99,102,241,0.75)', '0 0 18px rgba(99,102,241,0.35)'] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}
                >
                  <svg viewBox="0 0 24 24" className="w-7 h-7 text-white fill-none stroke-current stroke-2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23-.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                  </svg>
                </motion.div>
                <h1 className="text-2xl font-bold text-white tracking-tight">FinAI Edge</h1>
                <p className="text-sm mt-1" style={{ color: 'rgba(148,163,184,0.85)' }}>AI-Powered Trading Intelligence Terminal</p>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3 mb-6">
                <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
                <span className="text-[11px] font-semibold tracking-widest" style={{ color: 'rgba(148,163,184,0.5)' }}>SECURE ACCESS</span>
                <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
              </div>

              {/* Google Button */}
              <motion.button
                onClick={handleGoogleSignIn}
                disabled={isSigningIn}
                whileHover={{ scale: isSigningIn ? 1 : 1.02, y: isSigningIn ? 0 : -2 }}
                whileTap={{ scale: 0.98 }}
                className="relative w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl font-semibold text-sm transition-all overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'white' }}
              >
                <motion.div className="absolute inset-0 rounded-2xl"
                  style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(124,58,237,0.15))' }}
                  initial={{ opacity: 0 }} whileHover={{ opacity: 1 }} />
                {isSigningIn ? (
                  <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span className="relative">Connecting…</span></>
                ) : (
                  <><GoogleIcon className="w-5 h-5 relative" /><span className="relative">Continue with Google</span></>
                )}
              </motion.button>

              {/* Features */}
              <div className="mt-7 grid grid-cols-2 gap-2">
                {[
                  { icon: '⚡', text: 'Live Market Intelligence' },
                  { icon: '🤖', text: 'AI Signals & Analysis' },
                  { icon: '📊', text: 'Quant Analytics Engine' },
                  { icon: '🛡️', text: 'Institutional-Grade Data' },
                ].map((f) => (
                  <div key={f.text} className="flex items-center gap-2 px-2.5 py-2 rounded-xl" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.1)' }}>
                    <span className="text-sm">{f.icon}</span>
                    <span className="text-[11px] font-medium" style={{ color: 'rgba(148,163,184,0.75)' }}>{f.text}</span>
                  </div>
                ))}
              </div>

              <p className="text-center text-[10px] mt-7" style={{ color: 'rgba(148,163,184,0.3)' }}>
                By signing in you agree to our Terms of Service &amp; Privacy Policy.
              </p>
            </div>
          </motion.div>
        )}

        {/* ── STEP 2: Trader Alias ── */}
        {step === 'username' && (
          <motion.div
            key="username"
            initial={{ opacity: 0, x: 40, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -40, scale: 0.96 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 w-full max-w-md mx-4"
          >
            {/* Subtle border */}
            <div className="absolute -inset-[1px] rounded-3xl" style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed,#06b6d4)', opacity: 0.6 }} />
            <div className="relative rounded-3xl p-8 sm:p-10"
              style={{ background: 'rgba(10,13,22,0.94)', backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)' }}>

              {/* Step indicator */}
              <div className="flex items-center gap-2 mb-6">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: 'rgba(99,102,241,0.4)' }}>✓</div>
                  <span className="text-[11px]" style={{ color: 'rgba(99,102,241,0.8)' }}>Authenticated</span>
                </div>
                <ChevronRight className="w-3 h-3" style={{ color: 'rgba(148,163,184,0.3)' }} />
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>2</div>
                  <span className="text-[11px] font-semibold" style={{ color: 'rgba(148,163,184,0.9)' }}>Set Trader Alias</span>
                </div>
              </div>

              <div className="mb-7">
                <h2 className="text-xl font-bold text-white tracking-tight">Choose your Trader Alias</h2>
                <p className="text-sm mt-1.5" style={{ color: 'rgba(148,163,184,0.7)' }}>
                  This is your identity on the FinAI Edge terminal. It will be displayed across the platform.
                </p>
              </div>

              <form onSubmit={handleSaveUsername} className="space-y-4">
                <div className="relative">
                  <input
                    type="text"
                    value={alias}
                    onChange={(e) => setAlias(e.target.value)}
                    placeholder="e.g. AlgoTrader99, QuantEdge, ProHedger"
                    className="w-full px-4 py-3.5 rounded-xl text-sm font-medium text-white placeholder:text-white/20 focus:outline-none transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: alias.length >= 3 ? '1px solid rgba(99,102,241,0.6)' : '1px solid rgba(255,255,255,0.08)',
                    }}
                    autoFocus
                    maxLength={20}
                  />
                  {alias.length > 0 && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px]" style={{ color: alias.length >= 3 ? 'rgba(99,102,241,0.8)' : 'rgba(148,163,184,0.4)' }}>
                      {alias.length}/20
                    </span>
                  )}
                </div>

                <motion.button
                  type="submit"
                  disabled={isSaving || alias.trim().length < 3}
                  whileHover={{ scale: isSaving || alias.trim().length < 3 ? 1 : 1.02, y: isSaving || alias.trim().length < 3 ? 0 : -1 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
                  style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}
                >
                  {isSaving ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Setting up…</span></>
                  ) : (
                    <><span>Enter the Terminal</span><ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></>
                  )}
                </motion.button>
              </form>

              <p className="text-center text-[10px] mt-6" style={{ color: 'rgba(148,163,184,0.3)' }}>
                You can change your alias later in Settings.
              </p>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
