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
  Globe,
  Shield,
} from 'lucide-react';
import { AuthApiError } from '@/lib/api/authApi';
import { cn } from '@/lib/utils';



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
  const errorId = `${id}-error`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-label font-medium text-neutral-300">
        {label}
      </label>
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none">
            <Icon className="w-4 h-4" aria-hidden />
          </div>
        )}
        <input
          id={id}
          type={showToggle ? (isPasswordVisible ? 'text' : 'password') : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          autoComplete={type === 'password' ? 'current-password' : type === 'email' ? 'email' : 'username'}
          className={cn(
            'w-full rounded-md border bg-background py-2.5 pr-10 text-sm text-foreground placeholder:text-neutral-500 transition-colors',
            Icon ? 'pl-10' : 'px-3',
            error ? 'border-negative-500' : 'border-neutral-700 hover:border-neutral-600',
          )}
        />
        {showToggle && (
          <button
            type="button"
            onClick={onToggle}
            aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-neutral-500 hover:text-foreground transition-colors"
          >
            {isPasswordVisible ? <EyeOff className="w-4 h-4" aria-hidden /> : <Eye className="w-4 h-4" aria-hidden />}
          </button>
        )}
      </div>
      <AnimatePresence>
        {error && (
          <motion.p
            id={errorId}
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="flex items-center gap-1.5 text-caption text-negative-400 font-medium mt-1.5"
          >
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden /> {error}
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
        <div className="w-full max-w-6xl mx-auto px-6 lg:px-8 flex flex-col lg:flex-row items-center justify-center gap-10 lg:gap-24 relative z-10">
          
          {/* ═══ LEFT PANEL: product statement (hidden on mobile) ═══ */}
          <div className="hidden lg:flex lg:flex-1 flex-col gap-10 text-left">
            <div className="max-w-xl space-y-4">
              <p className="font-mono text-label uppercase tracking-wide text-brand-400">A setup is not a decision.</p>
              <h1 className="text-display text-foreground">
                Find the setup.
                <br />
                Examine the <span className="text-brand-400">context.</span>
              </h1>
              <p className="text-body text-neutral-400 leading-relaxed">
                Monitor markets, screen for SMC zones, and review portfolio risk in one workspace, with AI-assisted analysis when useful.
              </p>
            </div>

            <ul className="grid max-w-xl grid-cols-1 gap-5 sm:grid-cols-2">
              {[
                { icon: Globe, title: 'Market Monitor', desc: 'Pulse, sectors and movers' },
                { icon: Target, title: 'SMC Zone Screener', desc: 'Zones and fair value gaps' },
                { icon: FlaskConical, title: 'Portfolio Analysis', desc: 'Holdings and risk metrics' },
                { icon: Brain, title: 'AI Copilot', desc: 'Assistive, not advice' },
              ].map((b) => (
                <li key={b.title} className="flex gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-800 bg-neutral-900 text-brand-400">
                    <b.icon className="h-4 w-4" aria-hidden />
                  </span>
                  <div>
                    <p className="text-label font-medium text-foreground">{b.title}</p>
                    <p className="text-caption text-neutral-400">{b.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

        {/* ═══ RIGHT PANEL: Authentication Form ═════ */}
        <div className="w-full lg:w-[440px] lg:shrink-0 flex flex-col items-center justify-center relative z-10 py-1">
          
          {/* Mobile-only Branding Header */}
          <div className="lg:hidden flex items-center gap-2.5 mb-6">
            <img src="/logo.png" alt="Nivro Logo" className="w-7 h-7 object-contain" />
            <div className="leading-none">
              <div className="text-body font-semibold tracking-tight text-foreground">Nivro</div>
              <div className="text-caption text-neutral-400 mt-0.5">Markets &amp; Wealth</div>
            </div>
          </div>

          {/* Premium Authentication Form Card (Size kept around 440px maximum) */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="w-full max-w-[440px] bg-neutral-900 border border-neutral-800 rounded-xl p-5 sm:p-8 space-y-5 sm:space-y-6 shadow-sm"
          >

            {/* Header */}
            <div className="space-y-3.5 text-center relative z-10">
              <p className="text-caption text-neutral-400">Invite-only private beta</p>

              <div className="space-y-1">
                <h2 className="text-title text-foreground">
                  {isSignup ? 'Create your account' : 'Welcome back'}
                </h2>
                <p className="text-body text-neutral-400 leading-relaxed">
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
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-md font-medium text-sm text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>{isSignup ? 'Creating account…' : 'Signing in…'}</span>
                      </>
                    ) : (
                      <>
                        <span>{isSignup ? 'Create Account' : 'Sign In'}</span>
                        <ArrowRight className="w-4 h-4" aria-hidden />
                      </>
                    )}
                  </button>
                </div>

                {/* Social Divider */}
                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-neutral-800"></div>
                  <span className="flex-shrink mx-4 text-caption text-neutral-500">Or continue with</span>
                  <div className="flex-grow border-t border-neutral-800"></div>
                </div>

                {/* Google Sign In Button */}
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-md font-medium text-sm text-neutral-300 border border-neutral-700 hover:bg-foreground/5 hover:text-foreground transition-colors"
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
                  <span className="text-caption text-neutral-500">Soon</span>
                </button>

                <p className="text-center text-caption text-neutral-500 pt-1 leading-relaxed">
                  By continuing, you agree to our{' '}
                  <span className="font-medium text-neutral-300">Terms of Service</span>{' '}
                  and{' '}
                  <span className="font-medium text-neutral-300">Privacy Policy</span>.
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
        <div className="fixed inset-0 bg-background flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
        </div>
      }
    >
      <AuthPageContent />
    </Suspense>
  );
}
