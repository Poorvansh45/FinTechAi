'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, ArrowRight } from 'lucide-react';

export default function OnboardingPage() {
  const { user, username, loading, saveUsername } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [alias, setAlias] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/login');
      } else if (username) {
        router.replace('/dashboard');
      }
    }
  }, [user, username, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = alias.trim();
    if (!trimmed) {
      toast({ title: 'Error', description: 'Alias cannot be empty.', variant: 'destructive' });
      return;
    }
    if (trimmed.length < 3) {
      toast({ title: 'Error', description: 'Alias must be at least 3 characters.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      await saveUsername(trimmed);
      toast({
        title: 'Identity Confirmed',
        description: `Welcome aboard, ${trimmed}! 🚀`,
        duration: 4000,
      });
      router.replace('/dashboard');
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to save your alias.', variant: 'destructive' });
      setIsSubmitting(false);
    }
  };

  if (loading || !user || username) {
    return <div className="min-h-screen bg-[#080C14]" />;
  }

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden flex items-center justify-center bg-[#080C14]">
      {/* ── Animated background ── */}
      <div className="absolute inset-0">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-30"
          style={{ background: 'radial-gradient(circle, rgba(79,70,229,0.4) 0%, transparent 70%)', filter: 'blur(80px)' }} />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-25"
          style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.4) 0%, transparent 70%)', filter: 'blur(80px)' }} />
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(rgba(99,102,241,1) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,1) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        <div className="relative rounded-3xl p-8 sm:p-10 border border-white/10 shadow-2xl"
          style={{
            background: 'rgba(10,13,22,0.92)',
            backdropFilter: 'blur(32px)',
            WebkitBackdropFilter: 'blur(32px)',
          }}>

          <div className="flex flex-col items-center mb-8 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 bg-indigo-500/10 border border-indigo-500/20">
              <Sparkles className="w-7 h-7 text-indigo-400" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Choose Your Trader Alias</h1>
            <p className="text-sm mt-2 text-muted-foreground">
              This is how you will be identified within FinAI Edge.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <input
                type="text"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                placeholder="e.g. AlgoTrader99"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                autoFocus
                maxLength={20}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || alias.trim().length < 3}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
              style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}
            >
              {isSubmitting ? 'Saving...' : 'Enter Platform'}
              {!isSubmitting && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
