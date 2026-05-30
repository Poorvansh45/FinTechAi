'use client';

import { useState, useEffect, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthProvider';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, ArrowRight, LogIn, UserPlus, AlertCircle } from 'lucide-react';
import { AuthApiError } from '@/lib/api/authApi';

// ─── Animated particles ────────────────────────────────────────────────────
function Particle({ x, y, delay, size }: { x: number; y: number; delay: number; size: number }) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        left: `${x}%`, top: `${y}%`, width: size, height: size,
        background: 'radial-gradient(circle, rgba(99,102,241,0.6) 0%, transparent 70%)',
      }}
      animate={{ y: [0, -30, 0], opacity: [0.1, 0.6, 0.1] }}
      transition={{ duration: 4 + delay, repeat: Infinity, delay, ease: 'easeInOut' }}
    />
  );
}

const PARTICLES = [
  { x: 8, y: 18, delay: 0, size: 6 }, { x: 85, y: 12, delay: 0.5, size: 8 },
  { x: 50, y: 80, delay: 1, size: 5 }, { x: 18, y: 68, delay: 1.5, size: 10 },
  { x: 74, y: 58, delay: 0.8, size: 7 }, { x: 33, y: 38, delay: 2, size: 4 },
  { x: 62, y: 8, delay: 1.2, size: 9 }, { x: 91, y: 88, delay: 0.3, size: 6 },
];

// ─── Input field ───────────────────────────────────────────────────────────
function AuthInput({
  id, type = 'text', label, value, onChange, error, placeholder, autoFocus,
  showToggle, onToggle, isPasswordVisible,
}: {
  id: string; type?: string; label: string; value: string;
  onChange: (v: string) => void; error?: string; placeholder?: string;
  autoFocus?: boolean; showToggle?: boolean; onToggle?: () => void; isPasswordVisible?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-semibold text-slate-400 uppercase tracking-wide">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={showToggle ? (isPasswordVisible ? 'text' : 'password') : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete={type === 'password' ? 'current-password' : type === 'email' ? 'email' : 'username'}
          className={`w-full px-4 py-3 rounded-xl text-sm font-medium text-white placeholder:text-white/20 focus:outline-none transition-all duration-200 pr-10 ${
            error
              ? 'border border-red-500/60 bg-red-500/5 focus:border-red-500'
              : 'border border-white/8 bg-white/4 focus:border-indigo-500/60 focus:bg-white/6'
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
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            className="flex items-center gap-1.5 text-[11px] text-red-400 font-medium"
          >
            <AlertCircle className="w-3 h-3 flex-shrink-0" /> {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main auth page content ────────────────────────────────────────────────
function AuthPageContent() {
  const { user, loading, login, register } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const modeParam = searchParams.get('mode') ?? searchParams.get('intent');
  const [mode, setMode] = useState<'signin' | 'signup'>(
    modeParam === 'signup' || modeParam === 'register' ? 'signup' : 'signin'
  );
  const isSignup = mode === 'signup';

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

  // Reset form on mode switch
  const switchMode = (m: 'signin' | 'signup') => {
    setMode(m);
    setErrors({});
    setUsername('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
  };

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
      if (isSignup) {
        await register(username.trim(), email.trim().toLowerCase(), password);
        toast({ title: `Welcome, ${username.trim()}! 🎉`, description: 'Your account is ready.' });
      } else {
        await login(email.trim().toLowerCase(), password);
        toast({ title: 'Welcome back!', description: 'Signed in successfully.' });
      }
      router.replace('/');
    } catch (err) {
      const msg = err instanceof AuthApiError
        ? err.message
        : 'Something went wrong. Please try again.';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const BG = (
    <div className="absolute inset-0 overflow-hidden">
      <div
        className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-25"
        style={{ background: 'radial-gradient(circle, rgba(79,70,229,0.5) 0%, transparent 70%)', filter: 'blur(80px)' }}
      />
      <div
        className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-20"
        style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.5) 0%, transparent 70%)', filter: 'blur(80px)' }}
      />
      {PARTICLES.map((p, i) => <Particle key={i} {...p} />)}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: 'linear-gradient(rgba(99,102,241,1) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] overflow-auto flex items-center justify-center bg-[#080C14] py-8">
      {BG}

      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        {/* Animated border */}
        <motion.div
          className="absolute -inset-[1px] rounded-3xl"
          style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed,#06b6d4,#4f46e5)', backgroundSize: '300% 300%' }}
          animate={{ backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        />

        <div className="relative rounded-3xl overflow-hidden" style={{ background: 'rgba(8,12,20,0.95)', backdropFilter: 'blur(32px)' }}>
          {/* Header */}
          <div className="px-8 pt-8 pb-0">
            <div className="flex items-center gap-3 mb-7">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-white fill-none stroke-current stroke-2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23-.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                </svg>
              </div>
              <div>
                <div className="text-xs font-semibold text-indigo-400 tracking-widest uppercase">FinAI Edge</div>
                <div className="text-lg font-bold text-white leading-tight">
                  {isSignup ? 'Create your account' : 'Welcome back'}
                </div>
              </div>
            </div>

            {/* Mode toggle tabs */}
            <div className="flex p-1 rounded-xl mb-7" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              {(['signin', 'signup'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => switchMode(m)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
                    mode === m
                      ? 'text-white shadow-lg'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                  style={mode === m ? { background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' } : {}}
                >
                  {m === 'signin' ? <LogIn className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                  {m === 'signin' ? 'Sign In' : 'Create Account'}
                </button>
              ))}
            </div>
          </div>

          {/* Form */}
          <AnimatePresence mode="wait">
            <motion.form
              key={mode}
              onSubmit={handleSubmit}
              initial={{ opacity: 0, x: isSignup ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isSignup ? -20 : 20 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="px-8 pb-8 space-y-4"
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
              />

              <AuthInput
                id="password"
                label="Password"
                value={password}
                onChange={setPassword}
                placeholder={isSignup ? 'At least 6 characters' : '••••••••'}
                error={errors.password}
                showToggle
                onToggle={() => setShowPw(v => !v)}
                isPasswordVisible={showPw}
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
                  onToggle={() => setShowConfirmPw(v => !v)}
                  isPasswordVisible={showConfirmPw}
                />
              )}

              <div className="pt-2">
                <motion.button
                  type="submit"
                  disabled={isSubmitting}
                  whileHover={{ scale: isSubmitting ? 1 : 1.02, y: isSubmitting ? 0 : -1 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl font-semibold text-sm text-white disabled:opacity-60 disabled:cursor-not-allowed transition-shadow"
                  style={{
                    background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                    boxShadow: isSubmitting ? 'none' : '0 0 24px rgba(99,102,241,0.4)',
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

              <p className="text-center text-[10px] text-slate-600 pt-1">
                By continuing, you agree to our{' '}
                <span className="text-indigo-500 hover:text-indigo-400 cursor-pointer">Terms</span>{' '}
                and{' '}
                <span className="text-indigo-500 hover:text-indigo-400 cursor-pointer">Privacy Policy</span>.
              </p>
            </motion.form>
          </AnimatePresence>
        </div>
      </motion.div>
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
