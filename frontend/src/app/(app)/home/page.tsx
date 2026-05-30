'use client';

import Link from 'next/link';
import {
  LayoutDashboard, BookOpen, LineChart, Sparkles, Briefcase,
  TrendingUp, ArrowRight, Globe, FlaskConical,
} from 'lucide-react';
import { useAuth } from '@/context/AuthProvider';
import { profileInitial } from '@/lib/auth/types';

const QUICK_LINKS = [
  { href: '/markets', label: 'Markets', desc: 'Live intelligence & sector pulse', icon: Globe, color: 'text-blue-400' },
  { href: '/journal', label: 'Trading Journal', desc: 'Log, review, and improve trades', icon: BookOpen, color: 'text-amber-400' },
  { href: '/analytics', label: 'Performance Analytics', desc: 'PnL, win rate, behavior insights', icon: LineChart, color: 'text-emerald-400' },
  { href: '/quant-lab/optimizer', label: 'Quant Lab', desc: 'Portfolio optimization & risk', icon: FlaskConical, color: 'text-violet-400' },
];

const ECOSYSTEM = [
  { title: 'Market Intelligence', body: 'Breadth, movers, and AI signals in one terminal.', href: '/markets', icon: TrendingUp },
  { title: 'AI Coaching', body: 'Pattern-aware insights from your journal history.', href: '/ai-insights', icon: Sparkles },
  { title: 'Workspace', body: 'Dense analytics and trade review workstation.', href: '/journal', icon: Briefcase },
];

export default function AppHomePage() {
  const { user } = useAuth();
  const displayName = user?.username ?? 'there';
  const initial = user?.username ? profileInitial(user.username) : '?';

  return (
    <div className="space-y-8 animate-fadeIn pb-8">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="flex items-start gap-4">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', border: '1px solid rgba(99,102,241,0.35)' }}
          >
            {initial}
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500 font-semibold">Platform Home</p>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mt-0.5">
              Welcome back, <span className="gradient-text">{displayName}</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-lg">
              Your entry point to markets, journaling, analytics, and quant tools — built for focused trading workflows.
            </p>
          </div>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity self-start"
          style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}
        >
          <LayoutDashboard className="w-4 h-4" />
          Open Dashboard
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {QUICK_LINKS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="glass-card p-4 group hover:border-violet-500/25 transition-all terminal-row-hover"
          >
            <item.icon className={`w-5 h-5 ${item.color} mb-3`} />
            <div className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-violet-300 transition-colors">
              {item.label}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{item.desc}</p>
            <ArrowRight className="w-3.5 h-3.5 text-slate-500 mt-3 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        ))}
      </div>

      <div>
        <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-slate-500 mb-3">Ecosystem Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {ECOSYSTEM.map((card) => (
            <Link key={card.title} href={card.href} className="glass-card p-5 group terminal-row-hover">
              <card.icon className="w-5 h-5 text-violet-400 mb-2" />
              <h3 className="font-semibold text-slate-900 dark:text-white">{card.title}</h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{card.body}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
