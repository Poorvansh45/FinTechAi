'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { ElementType, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase, Plus, Trash2, TrendingUp, AlertTriangle,
  ChevronRight, ChevronLeft, Loader2, RefreshCw, Info, Target, Activity,
  BarChart3, Shield, Zap, PieChart as PieIcon, FlaskConical,
  Upload, FileText, Link2, Search, X, Check, Brain,
  Sparkles, Home, Star, DollarSign, Clock, Flame,
  ArrowRight, ArrowLeft, RotateCcw, TrendingDown,
  Globe, BarChart2, Gem, Coins, ArrowUpDown, CalendarDays,
  Gauge, Layers3, WalletCards, SlidersHorizontal
} from 'lucide-react';
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, PieChart, Pie, Cell, BarChart, Bar, Legend, AreaChart, Area
} from 'recharts';
import { backendApi } from '@/lib/api/client';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type AppScreen =
  | 'landing'
  | 'import-method'
  | 'portfolio-builder'
  | 'onboarding-questions'
  | 'ai-building'
  | 'beginner-results';

export interface Stock {
  ticker: string;
  name: string;
  allocation: number;
}

export interface PortfolioMetrics {
  expectedReturn: number;
  volatility: number;
  sharpeRatio: number;
  diversificationScore: number;
  correlationMatrix: Record<string, Record<string, number>>;
  individualMetrics: Record<string, { annualReturn: number; volatility: number }>;
  efficientFrontier: { risk: number; return: number }[];
  optimalPortfolio: { risk: number; return: number; weights: Record<string, number> };
  minVolPortfolio: { risk: number; return: number; weights: Record<string, number> };
  currentPortfolio: { risk: number; return: number };
  varStats: { var95: number; var99: number; maxDrawdown: number };
}

export interface OnboardingAnswers {
  goal: string;
  horizon: string;
  risk: string;
  monthly: number;
  assets: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
export const SUGGESTED_STOCKS = [
  { ticker: 'RELIANCE.NS', name: 'Reliance Industries', sector: 'Energy' },
  { ticker: 'TCS.NS', name: 'Tata Consultancy Services', sector: 'IT' },
  { ticker: 'INFY.NS', name: 'Infosys', sector: 'IT' },
  { ticker: 'HDFCBANK.NS', name: 'HDFC Bank', sector: 'Banking' },
  { ticker: 'ICICIBANK.NS', name: 'ICICI Bank', sector: 'Banking' },
  { ticker: 'WIPRO.NS', name: 'Wipro', sector: 'IT' },
  { ticker: 'TATAMOTORS.NS', name: 'Tata Motors', sector: 'Auto' },
  { ticker: 'BHARTIARTL.NS', name: 'Bharti Airtel', sector: 'Telecom' },
  { ticker: 'SBIN.NS', name: 'State Bank of India', sector: 'Banking' },
  { ticker: 'BAJFINANCE.NS', name: 'Bajaj Finance', sector: 'Finance' },
  { ticker: 'ADANIENT.NS', name: 'Adani Enterprises', sector: 'Conglomerate' },
  { ticker: 'HINDUNILVR.NS', name: 'Hindustan Unilever', sector: 'FMCG' },
  { ticker: 'ITC.NS', name: 'ITC Limited', sector: 'FMCG' },
  { ticker: 'MARUTI.NS', name: 'Maruti Suzuki', sector: 'Auto' },
  { ticker: 'HCLTECH.NS', name: 'HCL Technologies', sector: 'IT' },
  { ticker: 'ASIANPAINT.NS', name: 'Asian Paints', sector: 'Paints' },
  { ticker: 'KOTAKBANK.NS', name: 'Kotak Mahindra Bank', sector: 'Banking' },
  { ticker: 'LT.NS', name: 'Larsen & Toubro', sector: 'Infra' },
  { ticker: 'SUNPHARMA.NS', name: 'Sun Pharmaceutical', sector: 'Pharma' },
  { ticker: 'TITAN.NS', name: 'Titan Company', sector: 'Consumer' },
  { ticker: 'POWERGRID.NS', name: 'Power Grid Corporation', sector: 'Energy' },
  { ticker: 'NTPC.NS', name: 'NTPC Limited', sector: 'PSU' },
  { ticker: 'COALINDIA.NS', name: 'Coal India', sector: 'PSU' },
  { ticker: 'HDFCLIFE.NS', name: 'HDFC Life Insurance', sector: 'Insurance' },
  { ticker: 'SBILIFE.NS', name: 'SBI Life Insurance', sector: 'Insurance' },
  { ticker: 'TATASTEEL.NS', name: 'Tata Steel', sector: 'Metal' },
  { ticker: 'DLF.NS', name: 'DLF Limited', sector: 'Realty' },
  { ticker: 'PIDILITIND.NS', name: 'Pidilite Industries', sector: 'Chemicals' },
  { ticker: 'HAL.NS', name: 'Hindustan Aeronautics', sector: 'Defence' },
  { ticker: 'DMART.NS', name: 'Avenue Supermarts', sector: 'Retail' },
  { ticker: 'JIOFIN.NS', name: 'Jio Financial Services', sector: 'Finance' },
  { ticker: 'ZEEL.NS', name: 'Zee Entertainment', sector: 'Media' },
  { ticker: 'DELHIVERY.NS', name: 'Delhivery', sector: 'Logistics' },
];

export const PIE_COLORS = [
  '#6366f1', '#22c55e', '#3b82f6', '#f59e0b',
  '#ec4899', '#14b8a6', '#f97316', '#8b5cf6',
  '#06b6d4', '#a78bfa',
];

export const SECTOR_COLORS: Record<string, string> = {
  Banking: '#3b82f6',
  IT: '#6366f1',
  Pharma: '#ec4899',
  Energy: '#f59e0b',
  FMCG: '#22c55e',
  Auto: '#f97316',
  Telecom: '#14b8a6',
  Infra: '#06b6d4',
  Metal: '#94a3b8',
  Finance: '#818cf8',
  Insurance: '#38bdf8',
  Realty: '#f472b6',
  Chemicals: '#2dd4bf',
  Defence: '#ef4444',
  Consumer: '#4ade80',
  PSU: '#60a5fa',
  ETF: '#34d399',
  'Mutual Fund': '#22d3ee',
  NBFC: '#8b5cf6',
  Infrastructure: '#06b6d4',
  Conglomerate: '#a78bfa',
  Paints: '#fb923c',
  Retail: '#facc15',
  'Financial Services': '#818cf8',
  Media: '#c084fc',
  Power: '#fb7185',
  Logistics: '#10b981',
  'Real Estate': '#f472b6',
  Chemical: '#2dd4bf',
};

const SECTOR_GROUPS = [
  {
    label: 'Financial Core',
    sectors: ['Banking', 'Finance', 'Insurance', 'PSU'],
  },
  {
    label: 'Growth & Consumption',
    sectors: ['IT', 'FMCG', 'Consumer', 'Telecom'],
  },
  {
    label: 'Industrials & Cyclicals',
    sectors: ['Auto', 'Infra', 'Metal', 'Realty', 'Chemicals', 'Energy'],
  },
  {
    label: 'Strategic & Defensive',
    sectors: ['Pharma', 'Defence'],
  },
  {
    label: 'Funds & Baskets',
    sectors: ['ETF', 'Mutual Fund'],
  },
];

const SECTOR_META = SECTOR_GROUPS.flatMap((group) =>
  group.sectors.map((sector) => ({
    sector,
    group: group.label,
    color: SECTOR_COLORS[sector] ?? '#6366f1',
    icon: sector.slice(0, 2).toUpperCase(),
  }))
);

const AI_BUILDING_MESSAGES = [
  'Analyzing market conditions…',
  'Optimizing diversification…',
  'Building your investment roadmap…',
  'Calculating risk-adjusted allocation…',
  'Running Monte Carlo simulations…',
  'Evaluating sector correlations…',
  'Finalizing your personalized portfolio…',
];

// ─────────────────────────────────────────────────────────────────────────────
// Animation variants
// ─────────────────────────────────────────────────────────────────────────────
export const EASE_CURVE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const screenVariants = {
  enter: { opacity: 0, y: 20, scale: 0.98 },
  center: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.45, ease: EASE_CURVE } },
  exit: { opacity: 0, y: -12, scale: 0.98, transition: { duration: 0.25, ease: 'easeIn' as const } },
} as any;

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: EASE_CURVE },
  }),
} as any;

// ─────────────────────────────────────────────────────────────────────────────
// Small reusable atoms
// ─────────────────────────────────────────────────────────────────────────────
export function FeaturePill({ label, color = 'violet' }: { label: string; color?: string }) {
  const styles: Record<string, string> = {
    violet: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
    blue: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${styles[color] ?? styles.violet}`}>
      <span className="w-1 h-1 rounded-full bg-current opacity-70" />
      {label}
    </span>
  );
}

export function MetricPill({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="glass-card p-3 flex flex-col gap-0.5">
      <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</span>
      <span className={`text-[17px] font-bold tabular-nums ${color ?? 'text-white'}`}>{value}</span>
    </div>
  );
}

export function DashboardPanel({
  title,
  eyebrow,
  children,
  className = '',
  icon: Icon,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  className?: string;
  icon?: ElementType;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-xl shadow-slate-200/60 backdrop-blur dark:border-white/[0.07] dark:bg-slate-950/75 dark:shadow-black/30 ${className}`}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/45 to-transparent" />
      <div className="relative z-10 p-4 md:p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-black text-slate-950 dark:text-white">{title}</h2>
            {eyebrow && <p className="mt-0.5 text-[11px] font-semibold text-slate-500">{eyebrow}</p>}
          </div>
          {Icon && (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-300">
              <Icon className="h-4 w-4" />
            </span>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

export function PremiumTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/[0.08] bg-slate-950/95 px-3 py-2 text-xs shadow-2xl shadow-black/40 backdrop-blur">
      {label && <div className="mb-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</div>}
      <div className="space-y-1">
        {payload.map((entry: any) => (
          <div key={`${entry.name}-${entry.dataKey}`} className="flex items-center gap-2 text-slate-200">
            <span className="h-2 w-2 rounded-full" style={{ background: entry.color || entry.fill || '#8b5cf6' }} />
            <span className="min-w-[78px] text-slate-400">{entry.name}</span>
            <span className="font-black tabular-nums text-white">
              {entry.name === 'Portfolio' || entry.name === 'Benchmark' ? money(Number(entry.value)) : `${Number(entry.value).toFixed(1)}%`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HealthGauge({ score, color, label }: { score: number; color: string; label: string }) {
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  const dash = (Math.max(0, Math.min(score, 100)) / 100) * circumference;
  return (
    <div className="relative flex h-44 w-44 items-center justify-center">
      <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 160 160">
        <circle cx="80" cy="80" r={radius} fill="none" stroke="rgba(148,163,184,0.16)" strokeWidth="14" />
        <motion.circle
          cx="80"
          cy="80"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          initial={{ strokeDasharray: `0 ${circumference}` }}
          animate={{ strokeDasharray: `${dash} ${circumference}` }}
          transition={{ duration: 1.1, ease: EASE_CURVE }}
          style={{ filter: `drop-shadow(0 0 12px ${color}66)` }}
        />
      </svg>
      <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full border border-slate-200 bg-white shadow-inner dark:border-white/[0.06] dark:bg-[#080d18]">
        <span className="text-4xl font-black tabular-nums" style={{ color }}>{score}</span>
        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">/100</span>
        <span className="mt-0.5 text-[11px] font-bold" style={{ color }}>{label}</span>
      </div>
    </div>
  );
}

export function SectionDivider({ title, accent = '#6366f1' }: { title: string; accent?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-0.5 h-4 rounded-full" style={{ background: accent }} />
      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">{title}</span>
      <div className="flex-1 h-px bg-white/[0.04]" />
    </div>
  );
}

const CUSTOM_SCATTER_DOT = (props: any) => {
  const { cx, cy, payload } = props;
  if (payload.label === 'current') return <circle cx={cx} cy={cy} r={7} fill="#6366f1" stroke="#a5b4fc" strokeWidth={2} />;
  if (payload.label === 'max_sharpe') return <circle cx={cx} cy={cy} r={7} fill="#22c55e" stroke="#86efac" strokeWidth={2} />;
  if (payload.label === 'min_vol') return <circle cx={cx} cy={cy} r={7} fill="#f59e0b" stroke="#fcd34d" strokeWidth={2} />;
  return <circle cx={cx} cy={cy} r={2.5} fill="rgba(99,102,241,0.35)" stroke="transparent" />;
};

// ─────────────────────────────────────────────────────────────────────────────
// Screen 1 — Premium Landing
// ─────────────────────────────────────────────────────────────────────────────
export function LandingScreen({ onAnalyze, onBuild }: { onAnalyze: () => void; onBuild: () => void }) {
  return (
    <motion.div
      key="landing"
      variants={screenVariants}
      initial="enter"
      animate="center"
      exit="exit"
      className="relative min-h-[calc(100vh-120px)] flex flex-col items-center justify-center px-4 py-12 overflow-hidden"
    >
      {/* Ambient background glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-[0.06]"
          style={{ background: 'radial-gradient(circle, #6366f1, transparent)', filter: 'blur(80px)' }} />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-[0.05]"
          style={{ background: 'radial-gradient(circle, #8b5cf6, transparent)', filter: 'blur(60px)' }} />
        <div className="absolute top-1/2 right-1/3 w-64 h-64 rounded-full opacity-[0.04]"
          style={{ background: 'radial-gradient(circle, #3b82f6, transparent)', filter: 'blur(70px)' }} />
        {/* Subtle grid */}
        <div className="absolute inset-0 opacity-[0.018]"
          style={{
            backgroundImage: 'linear-gradient(rgba(99,102,241,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.8) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }} />
      </div>

      {/* Hero Text */}
      <motion.div
        className="text-center mb-14 relative z-10"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-violet-500/25 bg-violet-500/8 mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
          <span className="text-[11px] font-semibold text-violet-300 tracking-wide">AI-Powered Portfolio Intelligence</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-white leading-tight mb-4">
          How would you like to{' '}
          <span className="gradient-text">start?</span>
        </h1>
        <p className="text-slate-400 text-base max-w-lg mx-auto leading-relaxed">
          Analyze your current investments or let FinAI Edge build a personalized portfolio for you.
        </p>
      </motion.div>

      {/* Two Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl relative z-10">
        {/* Card A — Analyze */}
        <motion.button
          custom={0}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          onClick={onAnalyze}
          className="group relative text-left p-8 rounded-2xl border border-white/[0.06] overflow-hidden transition-all duration-300 cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, rgba(15,23,42,0.8) 0%, rgba(30,27,75,0.6) 100%)',
            backdropFilter: 'blur(20px)',
          }}
          whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
          whileTap={{ scale: 0.99 }}
        >
          {/* Hover glow */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at top left, rgba(99,102,241,0.12) 0%, transparent 60%)' }} />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          <div className="relative z-10">
            {/* Icon */}
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-transform duration-300 group-hover:scale-110"
              style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.15))', border: '1px solid rgba(99,102,241,0.3)' }}>
              <BarChart3 className="w-7 h-7 text-violet-400" />
            </div>

            <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-violet-400 mb-2">Option A</div>
            <h2 className="text-xl font-bold text-white mb-3">Analyze Existing Portfolio</h2>
            <p className="text-sm text-slate-400 leading-relaxed mb-6">
              Upload or enter your investments and get AI-powered risk, diversification, and portfolio health analysis.
            </p>

            <div className="flex flex-wrap gap-2 mb-6">
              {['Risk Analysis', 'Diversification Score', 'AI Insights', 'Rebalancing'].map(p => (
                <FeaturePill key={p} label={p} color="violet" />
              ))}
            </div>

            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white w-fit transition-all duration-200 group-hover:gap-3"
              style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
              Analyze Portfolio
              <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </div>
          </div>
        </motion.button>

        {/* Card B — Build */}
        <motion.button
          custom={1}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          onClick={onBuild}
          className="group relative text-left p-8 rounded-2xl border border-white/[0.06] overflow-hidden transition-all duration-300 cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, rgba(15,23,42,0.8) 0%, rgba(5,46,22,0.4) 100%)',
            backdropFilter: 'blur(20px)',
          }}
          whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
          whileTap={{ scale: 0.99 }}
        >
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at top left, rgba(34,197,94,0.08) 0%, transparent 60%)' }} />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          <div className="relative z-10">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-transform duration-300 group-hover:scale-110"
              style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(16,185,129,0.1))', border: '1px solid rgba(34,197,94,0.25)' }}>
              <Brain className="w-7 h-7 text-emerald-400" />
            </div>

            <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-400 mb-2">Option B</div>
            <h2 className="text-xl font-bold text-white mb-3">Build My Portfolio</h2>
            <p className="text-sm text-slate-400 leading-relaxed mb-6">
              Answer a few simple questions and get a beginner-friendly investment portfolio powered by AI.
            </p>

            <div className="flex flex-wrap gap-2 mb-6">
              {['Goal-Based Investing', 'SIP Recommendations', 'Smart Allocation', 'Risk Profiling'].map(p => (
                <FeaturePill key={p} label={p} color="emerald" />
              ))}
            </div>

            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white w-fit transition-all duration-200 group-hover:gap-3"
              style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}>
              Start Planning
              <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </div>
          </div>
        </motion.button>
      </div>

      {/* Trust indicators */}
      <motion.div
        className="mt-12 flex items-center gap-6 text-[11px] text-slate-600 relative z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.4 }}
      >
        <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-slate-500" /> MPT Engine</span>
        <span className="w-px h-3 bg-slate-700" />
        <span className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-slate-500" /> Gemini AI</span>
        <span className="w-px h-3 bg-slate-700" />
        <span className="flex items-center gap-1.5"><Activity className="w-3.5 h-3.5 text-slate-500" /> Live Market Data</span>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen 2 — Import Method Selection
// ─────────────────────────────────────────────────────────────────────────────
export function ImportMethodScreen({ onBack, onManual }: { onBack: () => void; onManual: () => void }) {
  const methods = [
    {
      icon: Plus,
      title: 'Manual Entry',
      desc: 'Search and add stocks manually with custom allocation weights.',
      badge: null,
      active: true,
      color: '#6366f1',
    },
    {
      icon: FileText,
      title: 'Upload Portfolio Statement',
      desc: 'Import from CDSL/NSDL CAS statement or broker PDF.',
      badge: 'Coming Soon',
      active: false,
      color: '#3b82f6',
    },
    {
      icon: Upload,
      title: 'Import CSV',
      desc: 'Upload a CSV file with ticker and allocation columns.',
      badge: 'Coming Soon',
      active: false,
      color: '#f59e0b',
    },
    {
      icon: Link2,
      title: 'Connect Broker',
      desc: 'Link your Zerodha, Groww, or Upstox account directly.',
      badge: 'Coming Soon',
      active: false,
      color: '#22c55e',
    },
  ];

  return (
    <motion.div
      key="import-method"
      variants={screenVariants}
      initial="enter"
      animate="center"
      exit="exit"
      className="max-w-2xl mx-auto py-10 px-4"
    >
      <button onClick={onBack} className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-sm mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="mb-8">
        <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-violet-400 mb-2">Step 1 of 2</div>
        <h1 className="text-2xl font-bold text-white mb-2">How would you like to import your portfolio?</h1>
        <p className="text-slate-400 text-sm">Choose your preferred method to get started.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {methods.map((m, i) => (
          <motion.button
            key={m.title}
            custom={i}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            onClick={m.active ? onManual : undefined}
            className={`group relative text-left p-5 rounded-2xl border transition-all duration-300 ${m.active
                ? 'border-white/[0.08] hover:border-violet-500/30 cursor-pointer'
                : 'border-white/[0.04] opacity-60 cursor-not-allowed'
              }`}
            style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(16px)' }}
            whileHover={m.active ? { scale: 1.02 } : {}}
          >
            {m.badge && (
              <div className="absolute top-3 right-3 text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/5 border border-white/8 text-slate-500">
                {m.badge}
              </div>
            )}
            {m.active && (
              <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                style={{ background: `radial-gradient(ellipse at top left, ${m.color}10, transparent 60%)` }} />
            )}
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
              style={{ background: `${m.color}18`, border: `1px solid ${m.color}30` }}>
              <m.icon className="w-5 h-5" style={{ color: m.color }} />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">{m.title}</h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">{m.desc}</p>
            {m.active && (
              <div className="flex items-center gap-1 mt-3 text-[11px] font-semibold text-violet-400">
                Get Started <ArrowRight className="w-3 h-3" />
              </div>
            )}
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen 3 — Portfolio Builder (Main Analysis Tool)
// ─────────────────────────────────────────────────────────────────────────────
export function PortfolioBuilderScreen({
  onBack,
  onRestart,
}: {
  onBack: () => void;
  onRestart: () => void;
}) {
  const [stocks, setStocks] = useState<Stock[]>([
    { ticker: 'RELIANCE.NS', name: 'Reliance Industries', allocation: 25 },
    { ticker: 'TCS.NS', name: 'Tata Consultancy Services', allocation: 25 },
    { ticker: 'INFY.NS', name: 'Infosys', allocation: 25 },
    { ticker: 'HDFCBANK.NS', name: 'HDFC Bank', allocation: 25 },
  ]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [riskProfile, setRiskProfile] = useState<'conservative' | 'balanced' | 'aggressive'>('balanced');
  const [capital, setCapital] = useState(1000000);
  const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'optimization' | 'risk' | 'frontier'>('overview');
  const searchRef = useRef<HTMLDivElement>(null);

  const totalAllocation = stocks.reduce((s, st) => s + st.allocation, 0);
  const isValid = stocks.length >= 2 && totalAllocation === 100;

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const addStock = (ticker: string, name: string) => {
    if (stocks.find(s => s.ticker === ticker)) return;
    const n = stocks.length + 1;
    const share = Math.floor(100 / n);
    const newStocks = [...stocks.map(s => ({ ...s, allocation: share })), { ticker, name, allocation: share }];
    const diff = 100 - newStocks.reduce((a, s) => a + s.allocation, 0);
    newStocks[0].allocation += diff;
    setStocks(newStocks);
    setSearchQuery('');
    setShowDropdown(false);
  };

  const removeStock = (ticker: string) => {
    const remaining = stocks.filter(s => s.ticker !== ticker);
    if (remaining.length === 0) { setStocks([]); return; }
    const share = Math.floor(100 / remaining.length);
    const norm = remaining.map(s => ({ ...s, allocation: share }));
    norm[0].allocation += 100 - norm.reduce((a, s) => a + s.allocation, 0);
    setStocks(norm);
  };

  const updateAllocation = (ticker: string, val: number) =>
    setStocks(prev => prev.map(s => s.ticker === ticker ? { ...s, allocation: val } : s));

  const normalizeAllocations = () => {
    const total = stocks.reduce((s, st) => s + st.allocation, 0);
    if (!total) return;
    setStocks(prev => prev.map(s => ({ ...s, allocation: Math.round((s.allocation / total) * 100) })));
  };

  const runAnalysis = useCallback(async () => {
    if (!isValid) return;
    setLoading(true);
    setError(null);
    setWarnings([]);
    try {
      const weights: Record<string, number> = {};
      stocks.forEach(s => { weights[s.ticker] = s.allocation / 100; });

      // Try FastAPI first (Python analytics engine), fallback to Express
      let data: PortfolioMetrics & { warnings?: string[]; failedTickers?: string[] };
      try {
        const { portfolioApi } = await import('@/lib/api/fastapi');
        const result = await portfolioApi.analyzePortfolio(
          stocks.map(s => s.ticker),
          weights,
          riskProfile,
        );
        data = result as unknown as PortfolioMetrics & { warnings?: string[]; failedTickers?: string[] };
      } catch {
        // Fallback to Express backend
        data = await backendApi.post<PortfolioMetrics & { warnings?: string[]; failedTickers?: string[] }>(
          '/api/portfolio/analyze',
          { tickers: stocks.map(s => s.ticker), weights, riskProfile },
          { auth: true }
        );
      }

      if (data.warnings) setWarnings(data.warnings);
      setMetrics(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [stocks, isValid, riskProfile]);

  const filteredSuggestions = SUGGESTED_STOCKS.filter(
    s => !stocks.find(st => st.ticker === s.ticker) &&
      (s.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const pieData = stocks.map((s, i) => ({
    name: s.ticker.replace('.NS', ''),
    value: s.allocation,
    color: PIE_COLORS[i % PIE_COLORS.length],
  }));

  const frontierData = metrics ? [
    ...metrics.efficientFrontier.map(p => ({ x: +(p.risk * 100).toFixed(2), y: +(p.return * 100).toFixed(2), label: 'frontier' })),
    { x: +(metrics.currentPortfolio.risk * 100).toFixed(2), y: +(metrics.currentPortfolio.return * 100).toFixed(2), label: 'current' },
    { x: +(metrics.optimalPortfolio.risk * 100).toFixed(2), y: +(metrics.optimalPortfolio.return * 100).toFixed(2), label: 'max_sharpe' },
    { x: +(metrics.minVolPortfolio.risk * 100).toFixed(2), y: +(metrics.minVolPortfolio.return * 100).toFixed(2), label: 'min_vol' },
  ] : [];

  const health = useMemo(() => {
    const diversification = metrics?.diversificationScore ?? Math.min(92, stocks.length * 18);
    const concentrationRisk = Math.max(...stocks.map(s => s.allocation), 0);
    const concentrationScore = Math.max(0, 100 - (concentrationRisk - 25) * 2.2);
    const stabilityScore = metrics ? Math.max(0, 100 - metrics.volatility * 200) : 58;
    const portfolioHealthScore = Math.max(0, Math.min(100, Math.round(
      (diversification * 0.3) + (concentrationScore * 0.3) + (stabilityScore * 0.25) + (stocks.length >= 5 ? 15 : stocks.length * 3)
    )));
    return { diversification, concentrationScore, stabilityScore, concentrationRisk, portfolioHealthScore };
  }, [metrics, stocks]);

  const insights = useMemo(() => {
    const out: string[] = [];
    if (health.concentrationRisk >= 40)
      out.push(`⚠️ ${stocks.find(s => s.allocation === health.concentrationRisk)?.name ?? 'A stock'} holds ${health.concentrationRisk}% of your portfolio. Consider reducing concentration.`);
    if (metrics && metrics.volatility > 0.22)
      out.push('📉 Portfolio volatility is elevated. Diversifying into defensive sectors (FMCG, Pharma) can smooth returns.');
    if ((metrics?.diversificationScore ?? health.diversification) < 60)
      out.push('🔀 Diversification score is low. Adding stocks from different sectors will reduce correlated risk.');
    const techWeight = stocks.filter(s => ['TCS.NS', 'INFY.NS', 'WIPRO.NS', 'HCLTECH.NS'].includes(s.ticker)).reduce((sum, s) => sum + s.allocation, 0);
    if (techWeight >= 35)
      out.push(`💻 IT sector makes up ${techWeight}% of your portfolio. Add non-tech names to reduce sector concentration.`);
    if (metrics && metrics.sharpeRatio > 1)
      out.push(`✅ Sharpe ratio of ${metrics.sharpeRatio.toFixed(2)} is strong — your returns are well-compensated for risk.`);
    if (out.length === 0)
      out.push('✅ Portfolio looks reasonably balanced. Review allocations periodically and rebalance quarterly.');
    return out.slice(0, 4);
  }, [health, metrics, stocks]);

  const RISK_OPTIONS = [
    { id: 'conservative', label: 'Conservative', emoji: '🛡️', color: '#22c55e' },
    { id: 'balanced', label: 'Balanced', emoji: '⚖️', color: '#6366f1' },
    { id: 'aggressive', label: 'Aggressive', emoji: '🚀', color: '#f59e0b' },
  ] as const;

  return (
    <motion.div
      key="portfolio-builder"
      variants={screenVariants}
      initial="enter"
      animate="center"
      exit="exit"
      className="min-h-screen"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
                <Briefcase className="w-3.5 h-3.5 text-violet-400" />
              </div>
              <h1 className="text-lg font-bold text-white">Portfolio Analyzer</h1>
              <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded border bg-violet-500/10 text-violet-400 border-violet-500/20">MPT Engine</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Build your portfolio and run AI-powered analysis</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Status chip */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-semibold border ${totalAllocation === 100 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
            }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${totalAllocation === 100 ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
            {totalAllocation}% allocated
            {totalAllocation !== 100 && (
              <button onClick={normalizeAllocations} className="ml-1.5 underline hover:no-underline">
                Auto-balance
              </button>
            )}
          </div>

          {/* Analyze button */}
          <motion.button
            onClick={runAnalysis}
            disabled={!isValid || loading}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${isValid && !loading
                ? 'text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            style={isValid && !loading ? { background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' } : {}}
            whileHover={isValid && !loading ? { scale: 1.03 } : {}}
            whileTap={isValid && !loading ? { scale: 0.97 } : {}}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {loading ? 'Analyzing…' : 'Run Analysis'}
          </motion.button>
        </div>
      </div>

      {/* Error / Warnings */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mb-4 flex items-center gap-2.5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
          </motion.div>
        )}
        {warnings.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mb-4 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-center gap-2 font-semibold text-amber-400 text-sm mb-2">
              <AlertTriangle className="w-4 h-4" /> Analysis Warnings
            </div>
            <ul className="space-y-1">
              {warnings.map((w, i) => <li key={i} className="text-[11px] text-amber-500/80">• {w}</li>)}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main 3-column grid */}
      <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr_290px] gap-5">

        {/* ── LEFT: Portfolio Editor ── */}
        <div className="space-y-4">

          {/* Stock Search — Command Palette Style */}
          <div className="rounded-2xl border border-white/[0.06] overflow-visible"
            style={{ background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(20px)' }}>
            <div className="p-4">
              <SectionDivider title="Add Stocks" />
              <div ref={searchRef} className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true); }}
                    onFocus={() => setShowDropdown(true)}
                    placeholder="Search ticker or company…"
                    className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-white/[0.06] bg-white/[0.03] text-white placeholder:text-slate-600 outline-none focus:border-violet-500/40 focus:bg-violet-500/[0.03] transition-all"
                  />
                  {searchQuery && (
                    <button onClick={() => { setSearchQuery(''); setShowDropdown(false); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Floating dropdown */}
                <AnimatePresence>
                  {showDropdown && filteredSuggestions.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -4, scaleY: 0.95 }}
                      animate={{ opacity: 1, y: 0, scaleY: 1 }}
                      exit={{ opacity: 0, y: -4, scaleY: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full left-0 right-0 mt-2 z-50 rounded-xl border border-white/[0.08] overflow-hidden shadow-2xl shadow-black/50"
                      style={{ background: 'rgba(10,13,25,0.97)', backdropFilter: 'blur(24px)' }}
                    >
                      <div className="p-1">
                        {filteredSuggestions.slice(0, 8).map(s => {
                          const sectorColor = SECTOR_COLORS[s.sector] ?? '#6366f1';
                          return (
                            <button
                              key={s.ticker}
                              onMouseDown={() => addStock(s.ticker, s.name)}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-violet-500/10 transition-colors text-left group"
                            >
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black flex-shrink-0"
                                style={{ background: `${sectorColor}20`, color: sectorColor, border: `1px solid ${sectorColor}30` }}>
                                {s.ticker.replace('.NS', '').slice(0, 3)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-[12px] font-bold text-white">{s.ticker.replace('.NS', '')}</div>
                                <div className="text-[10px] text-slate-500 truncate">{s.name}</div>
                              </div>
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0"
                                style={{ background: `${sectorColor}18`, color: sectorColor }}>
                                {s.sector}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Allocation cards */}
            {stocks.length > 0 && (
              <div className="px-4 pb-4 space-y-2.5">
                <SectionDivider title={`${stocks.length} assets · ₹${(capital * totalAllocation / 100).toLocaleString('en-IN')} invested`} />
                <AnimatePresence mode="popLayout">
                  {stocks.map((stock, i) => {
                    const color = PIE_COLORS[i % PIE_COLORS.length];
                    return (
                      <motion.div
                        key={stock.ticker}
                        layout
                        initial={{ opacity: 0, x: -16 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 16, height: 0 }}
                        className="group relative p-3.5 rounded-xl border border-white/[0.05] hover:border-white/[0.09] transition-all"
                        style={{ background: 'rgba(255,255,255,0.02)' }}
                      >
                        <div className="flex items-center gap-2.5 mb-2.5">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[9px] font-black flex-shrink-0"
                            style={{ background: `${color}20`, color: color, border: `1px solid ${color}30` }}>
                            {stock.ticker.replace('.NS', '').slice(0, 3)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[11px] font-bold text-white leading-tight">{stock.ticker.replace('.NS', '')}</div>
                            <div className="text-[9px] text-slate-600 truncate">{stock.name}</div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={1} max={90}
                              value={stock.allocation}
                              onChange={e => updateAllocation(stock.ticker, parseInt(e.target.value || '0'))}
                              className="w-12 text-right text-[12px] font-bold bg-white/[0.04] border border-white/[0.06] rounded-lg px-1.5 py-1 text-white tabular-nums outline-none focus:border-violet-500/40"
                            />
                            <span className="text-slate-500 text-[11px]">%</span>
                            <button onClick={() => removeStock(stock.ticker)}
                              className="text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 ml-1">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        {/* Premium slider */}
                        <div className="relative">
                          <div className="h-1 rounded-full bg-white/[0.05] overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-200"
                              style={{ width: `${stock.allocation}%`, background: `linear-gradient(90deg, ${color}90, ${color})` }} />
                          </div>
                          <input
                            type="range" min={1} max={80}
                            value={stock.allocation}
                            onChange={e => updateAllocation(stock.ticker, parseInt(e.target.value))}
                            className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
                          />
                        </div>
                        <div className="flex justify-between mt-1">
                          <span className="text-[9px] text-slate-600">₹{Math.round((capital * stock.allocation) / 100).toLocaleString('en-IN')}</span>
                          <span className="text-[9px]" style={{ color }}>{stock.allocation}% weight</span>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Settings card */}
          <div className="rounded-2xl border border-white/[0.06] p-4"
            style={{ background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(20px)' }}>
            <SectionDivider title="Configuration" />
            <div className="space-y-3">
              <div>
                <label className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500 block mb-1.5">Capital (₹)</label>
                <input
                  type="number"
                  value={capital}
                  onChange={e => setCapital(parseInt(e.target.value) || 0)}
                  className="w-full text-sm bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2.5 text-white outline-none focus:border-violet-500/40 transition-colors tabular-nums"
                />
              </div>
              <div>
                <label className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500 block mb-1.5">Risk Profile</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {RISK_OPTIONS.map(r => (
                    <button
                      key={r.id}
                      onClick={() => setRiskProfile(r.id)}
                      className="py-2 px-2 rounded-xl border text-center text-[10px] font-bold transition-all duration-200"
                      style={riskProfile === r.id ? {
                        background: `${r.color}18`,
                        borderColor: `${r.color}40`,
                        color: r.color,
                      } : {
                        background: 'rgba(255,255,255,0.02)',
                        borderColor: 'rgba(255,255,255,0.06)',
                        color: '#64748b',
                      }}
                    >
                      <div className="text-sm mb-0.5">{r.emoji}</div>
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── CENTER: Analytics Dashboard ── */}
        <div className="space-y-4">
          {/* Tab bar */}
          <div className="flex gap-1 p-1 rounded-xl border border-white/[0.05]"
            style={{ background: 'rgba(15,23,42,0.6)' }}>
            {([
              ['overview', 'Health Score', '❤️'],
              ['optimization', 'Allocation', '🍩'],
              ['risk', 'Risk', '⚡'],
              ['frontier', 'Frontier', '📈'],
            ] as const).map(([id, label, emoji]) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex-1 py-2 px-3 text-[11px] font-semibold rounded-lg transition-all duration-200 ${activeTab === id ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/20' : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'
                  }`}
              >
                <span className="mr-1 text-xs">{emoji}</span>{label}
              </button>
            ))}
          </div>

          {/* Chart / Content Area */}
          <div className="rounded-2xl border border-white/[0.06] p-5"
            style={{ background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(20px)', minHeight: 400 }}>
            <AnimatePresence mode="wait">
              {activeTab === 'overview' && (
                <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="space-y-5">
                  {/* Health Score — Large Gauge */}
                  <div>
                    <h3 className="text-sm font-bold text-white mb-1">Portfolio Health Score</h3>
                    <p className="text-[10px] text-slate-500">Composite assessment across spread, concentration, stability, and balance.</p>
                  </div>
                  <div className="flex gap-4">
                    {/* Score ring */}
                    <div className="flex-shrink-0 flex flex-col items-center justify-center">
                      <div className="relative w-32 h-32">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                          <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
                          <circle cx="60" cy="60" r="50" fill="none"
                            stroke={health.portfolioHealthScore >= 75 ? '#22c55e' : health.portfolioHealthScore >= 55 ? '#f59e0b' : '#ef4444'}
                            strokeWidth="10"
                            strokeLinecap="round"
                            strokeDasharray={`${(health.portfolioHealthScore / 100) * 314} 314`}
                            style={{ transition: 'stroke-dasharray 1s ease', filter: 'drop-shadow(0 0 6px currentColor)' }}
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className={`text-3xl font-black tabular-nums ${health.portfolioHealthScore >= 75 ? 'text-emerald-400' :
                              health.portfolioHealthScore >= 55 ? 'text-amber-400' : 'text-red-400'
                            }`}>
                            {health.portfolioHealthScore}
                          </span>
                          <span className="text-[9px] text-slate-500 font-semibold">/ 100</span>
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1 text-center">
                        {health.portfolioHealthScore >= 75 ? '✅ Strong' : health.portfolioHealthScore >= 55 ? '⚠️ Moderate' : '🔴 Needs Work'}
                      </div>
                    </div>
                    {/* Sub-scores */}
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      {[
                        { label: 'Diversification', val: health.diversification, color: '#6366f1' },
                        { label: 'Concentration', val: health.concentrationScore, color: '#22c55e' },
                        { label: 'Stability', val: health.stabilityScore, color: '#f59e0b' },
                        { label: 'Balance', val: Math.min(100, stocks.length * 20), color: '#3b82f6' },
                      ].map(item => (
                        <div key={item.label} className="p-3 rounded-xl border border-white/[0.04]" style={{ background: 'rgba(255,255,255,0.02)' }}>
                          <div className="text-[9px] text-slate-500 font-semibold mb-1">{item.label}</div>
                          <div className="text-[15px] font-bold tabular-nums" style={{ color: item.color }}>{Math.round(item.val)}%</div>
                          <div className="h-0.5 rounded-full bg-white/[0.05] mt-1.5 overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${Math.round(item.val)}%`, background: item.color }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* AI Insights */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 rounded-lg bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
                        <Brain className="w-3.5 h-3.5 text-violet-400" />
                      </div>
                      <span className="text-[11px] font-bold text-white">AI Insights</span>
                    </div>
                    <div className="space-y-2.5">
                      {insights.map((insight, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.08 }}
                          className="flex gap-3 p-3 rounded-xl border border-white/[0.04]"
                          style={{ background: 'rgba(99,102,241,0.04)' }}
                        >
                          <div className="text-[11px] text-slate-300 leading-relaxed">{insight}</div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'optimization' && (
                <motion.div key="optimization" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-white mb-1">Portfolio Allocation</h3>
                    <p className="text-[10px] text-slate-500">Visual distribution of asset weights in your portfolio.</p>
                  </div>
                  {stocks.length >= 2 ? (
                    <div className="flex flex-col md:flex-row items-center gap-6">
                      <ResponsiveContainer width="100%" height={240}>
                        <PieChart>
                          <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                            outerRadius={100} innerRadius={55} paddingAngle={3}
                            label={({ name, value }) => `${name} ${value}%`}
                            labelLine={{ stroke: 'rgba(100,116,139,0.4)' }}>
                            {pieData.map((entry, i) => (
                              <Cell key={i} fill={entry.color} stroke="rgba(0,0,0,0.3)" strokeWidth={1} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ background: 'rgba(10,13,25,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, fontSize: 11 }}
                            formatter={(v: any) => [`${v}%`, 'Allocation']} />
                        </PieChart>
                      </ResponsiveContainer>
                      {/* Legend */}
                      <div className="grid grid-cols-1 gap-1.5 w-full max-w-xs">
                        {stocks.map((s, i) => (
                          <div key={s.ticker} className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                              <span className="text-[11px] text-slate-300">{s.ticker.replace('.NS', '')}</span>
                            </div>
                            <span className="text-[11px] font-bold tabular-nums"
                              style={{ color: PIE_COLORS[i % PIE_COLORS.length] }}>
                              {s.allocation}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-600">
                      <PieIcon className="w-10 h-10 mb-3 opacity-30" />
                      <p className="text-sm">Add at least 2 stocks to see allocation</p>
                    </div>
                  )}

                  {/* Optimal weights if metrics available */}
                  {metrics && (
                    <div>
                      <SectionDivider title="Suggested Rebalancing (Max Sharpe)" accent="#22c55e" />
                      <div className="space-y-2">
                        {Object.entries(metrics.optimalPortfolio.weights).map(([ticker, weight]) => {
                          const current = stocks.find(s => s.ticker === ticker)?.allocation ?? 0;
                          const suggested = Math.round(weight * 100);
                          const diff = suggested - current;
                          return (
                            <div key={ticker} className="flex items-center gap-3 p-2.5 rounded-xl border border-white/[0.04]"
                              style={{ background: 'rgba(255,255,255,0.02)' }}>
                              <span className="text-[11px] font-semibold text-white w-20 flex-shrink-0">{ticker.replace('.NS', '')}</span>
                              <div className="flex-1 h-1 rounded-full bg-white/[0.05] overflow-hidden">
                                <div className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                                  style={{ width: `${suggested}%` }} />
                              </div>
                              <span className="text-[11px] font-bold text-emerald-400 w-12 text-right">{suggested}%</span>
                              <span className={`text-[9px] font-semibold w-12 text-right ${diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                                {diff > 0 ? `+${diff}%` : diff < 0 ? `${diff}%` : 'OK'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'risk' && (
                <motion.div key="risk" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="space-y-5">
                  <div>
                    <h3 className="text-sm font-bold text-white mb-1">Risk Snapshot</h3>
                    <p className="text-[10px] text-slate-500">Understand your portfolio's downside exposure and volatility profile.</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <MetricPill label="Annualized Risk" value={metrics ? `${(metrics.volatility * 100).toFixed(1)}%` : '—'} color="text-amber-400" />
                    <MetricPill label="VaR (95%)" value={metrics ? `${(metrics.varStats.var95 * 100).toFixed(2)}%` : '—'} color="text-red-400" />
                    <MetricPill label="Max Drawdown" value={metrics ? `${(metrics.varStats.maxDrawdown * 100).toFixed(1)}%` : '—'} color="text-orange-400" />
                  </div>

                  {/* Risk Meter */}
                  {metrics && (
                    <div className="p-4 rounded-xl border border-white/[0.05]" style={{ background: 'rgba(255,255,255,0.02)' }}>
                      <div className="text-[10px] text-slate-500 mb-2 font-semibold uppercase tracking-wide">Risk Level</div>
                      <div className="flex items-center gap-3">
                        {(['Low', 'Medium', 'High', 'Very High'] as const).map((level, i) => {
                          const vol = metrics.volatility * 100;
                          const active = i === 0 ? vol < 12 : i === 1 ? vol < 20 : i === 2 ? vol < 30 : vol >= 30;
                          const colors = ['#22c55e', '#f59e0b', '#f97316', '#ef4444'];
                          return (
                            <div key={level} className="flex-1">
                              <div className="h-2 rounded-full transition-all duration-500"
                                style={{ background: active ? colors[i] : 'rgba(255,255,255,0.06)' }} />
                              <div className={`text-[9px] font-semibold mt-1 text-center ${active ? 'text-white' : 'text-slate-600'}`}>{level}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Correlation risk */}
                  {metrics && (
                    <div>
                      <SectionDivider title="Correlation Heatmap" />
                      <div className="overflow-auto rounded-xl border border-white/[0.04]">
                        <table className="w-full text-[10px]">
                          <thead>
                            <tr>
                              <th className="p-2 text-slate-600" />
                              {stocks.map(s => (
                                <th key={s.ticker} className="p-2 font-semibold text-slate-400 text-center">
                                  {s.ticker.replace('.NS', '')}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {stocks.map(row => (
                              <tr key={row.ticker}>
                                <td className="p-2 font-semibold text-slate-400 text-right pr-3">{row.ticker.replace('.NS', '')}</td>
                                {stocks.map(col => {
                                  const val = metrics.correlationMatrix[row.ticker]?.[col.ticker] ?? 0;
                                  const bg = val >= 0 ? `rgba(99,102,241,${Math.abs(val) * 0.5})` : `rgba(239,68,68,${Math.abs(val) * 0.5})`;
                                  return (
                                    <td key={col.ticker} className="p-2 text-center rounded" style={{ background: bg }}>
                                      <span className={`font-mono font-bold text-[10px] ${Math.abs(val) > 0.5 ? 'text-white' : 'text-slate-400'}`}>
                                        {val.toFixed(2)}
                                      </span>
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {!metrics && (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-600">
                      <Shield className="w-10 h-10 mb-3 opacity-30" />
                      <p className="text-sm">Run analysis to see risk metrics</p>
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'frontier' && (
                <motion.div key="frontier" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white">Efficient Frontier</h3>
                      <p className="text-[10px] text-slate-500 mt-0.5">Risk vs. Expected Return — Monte Carlo sampled across 3000+ portfolios</p>
                    </div>
                    {metrics && (
                      <div className="flex items-center gap-4 text-[9px]">
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-violet-500" /><span className="text-slate-500">Current</span></div>
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /><span className="text-slate-500">Max Sharpe</span></div>
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-amber-500" /><span className="text-slate-500">Min Vol</span></div>
                      </div>
                    )}
                  </div>
                  {metrics ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="x" name="Risk" unit="%" tick={{ fill: '#64748b', fontSize: 10 }}
                          label={{ value: 'Volatility (%)', position: 'insideBottom', offset: -10, fill: '#64748b', fontSize: 10 }} />
                        <YAxis dataKey="y" name="Return" unit="%" tick={{ fill: '#64748b', fontSize: 10 }}
                          label={{ value: 'Expected Return (%)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }} />
                        <Tooltip cursor={{ stroke: 'rgba(99,102,241,0.3)' }}
                          contentStyle={{ background: 'rgba(10,13,25,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, fontSize: 11 }}
                          formatter={(v: any) => [`${v}%`]} />
                        <Scatter data={frontierData.filter(d => d.label === 'frontier')} fill="rgba(99,102,241,0.35)" shape={CUSTOM_SCATTER_DOT} />
                        <Scatter data={frontierData.filter(d => d.label !== 'frontier')} fill="#6366f1" shape={CUSTOM_SCATTER_DOT} />
                      </ScatterChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-600">
                      <FlaskConical className="w-10 h-10 mb-3 opacity-30" />
                      <p className="text-sm">Add stocks and run analysis to generate frontier</p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── RIGHT: Metrics Sidebar ── */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/[0.06] p-4 space-y-3"
            style={{ background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(20px)' }}>
            <SectionDivider title="Portfolio Metrics" />
            <div className="grid grid-cols-2 gap-2">
              <MetricPill
                label="Expected Return"
                value={metrics ? `${(metrics.expectedReturn * 100).toFixed(2)}%` : '—'}
                color={metrics ? (metrics.expectedReturn > 0 ? 'text-emerald-400' : 'text-red-400') : 'text-slate-500'}
              />
              <MetricPill
                label="Volatility"
                value={metrics ? `${(metrics.volatility * 100).toFixed(2)}%` : '—'}
                color="text-amber-400"
              />
              <MetricPill
                label="Sharpe Ratio"
                value={metrics ? metrics.sharpeRatio.toFixed(2) : '—'}
                color={metrics ? (metrics.sharpeRatio > 1 ? 'text-emerald-400' : metrics.sharpeRatio > 0 ? 'text-amber-400' : 'text-red-400') : 'text-slate-500'}
              />
              <MetricPill
                label="Diversification"
                value={metrics ? `${metrics.diversificationScore.toFixed(0)}%` : '—'}
                color="text-violet-400"
              />
            </div>
          </div>

          {/* VaR */}
          <div className="rounded-2xl border border-white/[0.06] p-4 space-y-3"
            style={{ background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(20px)' }}>
            <SectionDivider title="Risk Analytics" accent="#ef4444" />
            <div className="space-y-2">
              <MetricPill label="VaR (95%)" value={metrics ? `${(metrics.varStats.var95 * 100).toFixed(2)}%` : '—'} color="text-red-400" />
              <MetricPill label="VaR (99%)" value={metrics ? `${(metrics.varStats.var99 * 100).toFixed(2)}%` : '—'} color="text-red-500" />
              <MetricPill label="Max Drawdown" value={metrics ? `${(metrics.varStats.maxDrawdown * 100).toFixed(2)}%` : '—'} color="text-orange-400" />
            </div>
          </div>

          {/* Per-asset metrics */}
          {metrics && (
            <div className="rounded-2xl border border-white/[0.06] p-4"
              style={{ background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(20px)' }}>
              <SectionDivider title="Per Asset" accent="#3b82f6" />
              <div className="space-y-2">
                {stocks.map(stock => {
                  const m = metrics.individualMetrics[stock.ticker];
                  if (!m) return null;
                  const pos = m.annualReturn > 0;
                  return (
                    <div key={stock.ticker} className="flex items-center gap-2.5 p-2.5 rounded-xl border border-white/[0.04]"
                      style={{ background: 'rgba(255,255,255,0.02)' }}>
                      <div className={`w-1 h-7 rounded-full flex-shrink-0 ${pos ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-bold text-white">{stock.ticker.replace('.NS', '')}</div>
                        <div className="text-[9px] text-slate-600">{(m.volatility * 100).toFixed(1)}% vol</div>
                      </div>
                      <div className={`text-[12px] font-bold tabular-nums ${pos ? 'text-emerald-400' : 'text-red-400'}`}>
                        {pos ? '+' : ''}{(m.annualReturn * 100).toFixed(1)}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Prompt when no analysis */}
          {!metrics && !loading && (
            <div className="rounded-2xl border border-violet-500/15 p-4"
              style={{ background: 'rgba(99,102,241,0.04)' }}>
              <div className="flex gap-2.5">
                <Info className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Add at least 2 stocks with 100% total allocation, then click{' '}
                  <strong className="text-violet-400">Run Analysis</strong> to see deep portfolio metrics and AI insights.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen 4 — Onboarding Questions (Build My Portfolio)
// ─────────────────────────────────────────────────────────────────────────────
export type ManualHolding = {
  id: string;
  ticker: string;
  name: string;
  quantity: number;
  avgBuyPrice: number;
  currentPrice: number;
  sector: string;
};

export type HoldingStats = ManualHolding & {
  invested: number;
  value: number;
  pnl: number;
  pnlPct: number;
  allocation: number;
};

const MANUAL_AI_MESSAGES = [
  'Analyzing diversification...',
  'Calculating portfolio health...',
  'Building AI insights...',
  'Generating allocation analytics...',
];

const DEFAULT_HOLDINGS: ManualHolding[] = [
  { id: 'reliance', ticker: 'RELIANCE', name: 'Reliance Industries', quantity: 8, avgBuyPrice: 2450, currentPrice: 2860, sector: 'Energy' },
  { id: 'tcs', ticker: 'TCS', name: 'Tata Consultancy Services', quantity: 5, avgBuyPrice: 3480, currentPrice: 3865, sector: 'IT' },
  { id: 'hdfcbank', ticker: 'HDFCBANK', name: 'HDFC Bank', quantity: 12, avgBuyPrice: 1490, currentPrice: 1645, sector: 'Banking' },
];

const cleanTicker = (ticker: string) => ticker.replace('.NS', '').toUpperCase();
const money = (value: number) => `Rs. ${Math.round(value).toLocaleString('en-IN')}`;
const pct = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

export function ManualPortfolioBuilderScreen({
  onBack,
  onRestart,
}: {
  onBack: () => void;
  onRestart: () => void;
}) {
  const [holdings, setHoldings] = useState<ManualHolding[]>(DEFAULT_HOLDINGS);
  const [form, setForm] = useState({
    ticker: '',
    name: '',
    quantity: '',
    avgBuyPrice: '',
    currentPrice: '',
    sector: '',
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeStockIndex, setActiveStockIndex] = useState(0);
  const [stockSearchLoading, setStockSearchLoading] = useState(false);
  const [sectorQuery, setSectorQuery] = useState('');
  const [sectorDropdownOpen, setSectorDropdownOpen] = useState(false);
  const [activeSectorIndex, setActiveSectorIndex] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisReady, setAnalysisReady] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);
  const [sortBy, setSortBy] = useState<'value' | 'pnl' | 'allocation' | 'ticker'>('value');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!isAnalyzing) return;
    const id = window.setInterval(() => {
      setMessageIndex((current) => (current + 1) % MANUAL_AI_MESSAGES.length);
    }, 750);
    return () => window.clearInterval(id);
  }, [isAnalyzing]);

  useEffect(() => {
    if (!dropdownOpen) return;
    setStockSearchLoading(true);
    const id = window.setTimeout(() => setStockSearchLoading(false), 180);
    return () => window.clearTimeout(id);
  }, [query, dropdownOpen]);

  const curatedStocks = useMemo(
    () => SUGGESTED_STOCKS.map((stock) => ({ ...stock, ticker: cleanTicker(stock.ticker) })),
    []
  );

  const filteredStocks = curatedStocks.filter((stock) => {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return stock.ticker.toLowerCase().includes(needle) || stock.name.toLowerCase().includes(needle);
  });

  const visibleStocks = filteredStocks.slice(0, 10);
  const filteredSectors = SECTOR_META.filter((item) => {
    const needle = sectorQuery.trim().toLowerCase();
    if (!needle) return true;
    return item.sector.toLowerCase().includes(needle) || item.group.toLowerCase().includes(needle);
  });

  const highlightedMatch = (value: string, needle: string) => {
    const cleanNeedle = needle.trim();
    if (!cleanNeedle) return value;
    const index = value.toLowerCase().indexOf(cleanNeedle.toLowerCase());
    if (index < 0) return value;
    return (
      <>
        {value.slice(0, index)}
        <mark className="rounded bg-violet-500/15 px-0.5 text-violet-700 dark:text-violet-200">{value.slice(index, index + cleanNeedle.length)}</mark>
        {value.slice(index + cleanNeedle.length)}
      </>
    );
  };

  const chooseActiveStock = () => {
    const stock = visibleStocks[Math.min(activeStockIndex, visibleStocks.length - 1)];
    if (stock) selectStock(stock);
  };

  const chooseSector = (sector: string) => {
    setForm((current) => ({ ...current, sector }));
    setSectorQuery(sector);
    setSectorDropdownOpen(false);
  };

  const stats = useMemo<HoldingStats[]>(() => {
    const raw = holdings.map((holding) => {
      const invested = holding.quantity * holding.avgBuyPrice;
      const value = holding.quantity * holding.currentPrice;
      const pnl = value - invested;
      return { ...holding, invested, value, pnl, pnlPct: invested ? (pnl / invested) * 100 : 0, allocation: 0 };
    });
    const totalValue = raw.reduce((sum, holding) => sum + holding.value, 0);
    return raw.map((holding) => ({ ...holding, allocation: totalValue ? (holding.value / totalValue) * 100 : 0 }));
  }, [holdings]);

  const totals = useMemo(() => {
    const invested = stats.reduce((sum, holding) => sum + holding.invested, 0);
    const value = stats.reduce((sum, holding) => sum + holding.value, 0);
    const pnl = value - invested;
    const dailyPnl = stats.reduce((sum, holding, index) => {
      const drift = [0.004, -0.0015, 0.0025, 0.001, -0.002][index % 5];
      return sum + holding.value * drift;
    }, 0);
    return { invested, value, pnl, pnlPct: invested ? (pnl / invested) * 100 : 0, dailyPnl, dailyPnlPct: value ? (dailyPnl / value) * 100 : 0 };
  }, [stats]);

  const sectorData = useMemo(() => {
    const sectors = new Map<string, number>();
    stats.forEach((holding) => sectors.set(holding.sector, (sectors.get(holding.sector) ?? 0) + holding.value));
    return Array.from(sectors.entries()).map(([name, value], index) => ({
      name,
      value: totals.value ? +(value / totals.value * 100).toFixed(2) : 0,
      amount: value,
      color: SECTOR_COLORS[name] ?? PIE_COLORS[index % PIE_COLORS.length],
    }));
  }, [stats, totals.value]);

  const chartData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
    const base = totals.invested || 1;
    const end = totals.value || base;
    return months.map((month, index) => {
      const progress = index / (months.length - 1);
      const curve = Math.sin(index * 0.9) * base * 0.018;
      const benchmark = base * (1 + progress * 0.082 + Math.sin(index * 0.7) * 0.006);
      return {
        month,
        value: Math.max(0, Math.round(base + (end - base) * progress + curve)),
        benchmark: Math.max(0, Math.round(benchmark)),
      };
    });
  }, [totals.invested, totals.value]);

  const health = useMemo(() => {
    const sectorCount = sectorData.length;
    const topAllocation = Math.max(...stats.map((holding) => holding.allocation), 0);
    const sectorMax = Math.max(...sectorData.map((sector) => sector.value), 0);
    const defensiveWeight = sectorData
      .filter((sector) => ['FMCG', 'Pharma', 'Insurance', 'Power'].includes(sector.name))
      .reduce((sum, sector) => sum + sector.value, 0);
    const aggressiveWeight = sectorData
      .filter((sector) => ['IT', 'Auto', 'Metal', 'Real Estate', 'Defence'].includes(sector.name))
      .reduce((sum, sector) => sum + sector.value, 0);
    const holdingScore = Math.min(100, stats.length * 15);
    const sectorBalanceScore = Math.max(10, 100 - Math.max(0, sectorMax - 28) * 1.8);
    const concentrationScore = Math.max(5, 100 - Math.max(0, topAllocation - 22) * 2.1);
    const riskDistributionScore = Math.max(10, 100 - Math.abs(aggressiveWeight - defensiveWeight) * 0.55);
    const diversificationScore = Math.round((holdingScore * 0.35) + (sectorBalanceScore * 0.4) + (concentrationScore * 0.25));
    const stabilityScore = Math.round(Math.max(28, Math.min(96, riskDistributionScore - Math.abs(totals.pnlPct) * 0.25)));
    const portfolioHealth = Math.round(
      diversificationScore * 0.36 +
      sectorBalanceScore * 0.24 +
      concentrationScore * 0.22 +
      stabilityScore * 0.18
    );
    const healthColor = portfolioHealth >= 75 ? '#22c55e' : portfolioHealth >= 58 ? '#f59e0b' : '#ef4444';
    return {
      diversificationScore,
      stabilityScore,
      portfolioHealth,
      concentrationScore,
      sectorBalanceScore,
      riskDistributionScore,
      topAllocation,
      sectorMax,
      defensiveWeight,
      aggressiveWeight,
      healthColor,
    };
  }, [sectorData, stats, totals.pnlPct]);

  const insights = useMemo(() => {
    const notes: { title: string; body: string; tone: 'warn' | 'good' | 'info' }[] = [];
    const topHolding = stats.reduce<HoldingStats | null>((best, holding) => (!best || holding.allocation > best.allocation ? holding : best), null);
    const topSector = sectorData.reduce<{ name: string; value: number } | null>((best, sector) => (!best || sector.value > best.value ? sector : best), null);

    if (topHolding && topHolding.allocation > 35) {
      notes.push({ title: 'Single-stock concentration', body: `${topHolding.name} is ${topHolding.allocation.toFixed(1)}% of portfolio value. Institutional risk desks usually flag anything above 30-35% unless it is a deliberate core position.`, tone: 'warn' });
    }
    if (sectorData.length < 4) {
      notes.push({ title: 'Diversification depth is thin', body: `You currently have ${sectorData.length} active sector${sectorData.length === 1 ? '' : 's'}. Add 1-2 defensive or low-correlation sectors to reduce drawdown clustering.`, tone: 'info' });
    }
    if (topSector && topSector.value > 48) {
      notes.push({ title: 'Sector imbalance', body: `${topSector.name} contributes ${topSector.value.toFixed(1)}% of value. That can amplify earnings-cycle and regulatory shocks. Consider pairing it with FMCG, Pharma, Insurance, or Power.`, tone: 'warn' });
    }
    if (health.aggressiveWeight > 58 && health.defensiveWeight < 20) {
      notes.push({ title: 'Aggressive tilt detected', body: `Growth/cyclical exposure is ${health.aggressiveWeight.toFixed(1)}% while defensive exposure is only ${health.defensiveWeight.toFixed(1)}%. Add stabilizers if your horizon is below 5 years.`, tone: 'warn' });
    }
    if (health.defensiveWeight > 45 && totals.pnlPct < 8) {
      notes.push({ title: 'Defensive mix', body: 'The portfolio is relatively defensive. That can protect capital, but may cap upside unless you add selective growth exposure.', tone: 'info' });
    }
    if (health.diversificationScore < 60) {
      notes.push({ title: 'Low diversification score', body: `Diversification score is ${health.diversificationScore}/100 because of sector and holding concentration. Add more independent earnings drivers.`, tone: 'warn' });
    }
    if (notes.length < 3) {
      notes.push({ title: 'AI portfolio read', body: `Health score is ${health.portfolioHealth}/100. Position sizing looks workable; rebalance when a holding drifts 5%+ from target allocation.`, tone: 'good' });
    }
    return notes.slice(0, 3);
  }, [health, sectorData, stats, totals.pnlPct]);

  const sortedStats = useMemo(() => {
    const sign = sortDir === 'asc' ? 1 : -1;
    return [...stats].sort((a, b) => {
      if (sortBy === 'ticker') return a.ticker.localeCompare(b.ticker) * sign;
      return (a[sortBy] - b[sortBy]) * sign;
    });
  }, [sortBy, sortDir, stats]);

  const setSort = (key: typeof sortBy) => {
    if (sortBy === key) {
      setSortDir((dir) => dir === 'asc' ? 'desc' : 'asc');
      return;
    }
    setSortBy(key);
    setSortDir(key === 'ticker' ? 'asc' : 'desc');
  };

  const topPerformer = stats.reduce<HoldingStats | null>((best, holding) => (!best || holding.pnlPct > best.pnlPct ? holding : best), null);
  const worstPerformer = stats.reduce<HoldingStats | null>((worst, holding) => (!worst || holding.pnlPct < worst.pnlPct ? holding : worst), null);
  const topHolding = stats.reduce<HoldingStats | null>((best, holding) => (!best || holding.allocation > best.allocation ? holding : best), null);
  const riskLevel = health.portfolioHealth >= 74 ? 'Low' : health.portfolioHealth >= 58 ? 'Moderate' : 'Elevated';
  const riskColor = riskLevel === 'Low' ? '#22c55e' : riskLevel === 'Moderate' ? '#f59e0b' : '#ef4444';
  const healthLabel = health.portfolioHealth >= 75 ? 'Strong' : health.portfolioHealth >= 58 ? 'Moderate' : 'Review';
  const riskMeterValue = Math.max(8, Math.min(96, 100 - health.portfolioHealth + health.topAllocation * 0.45 + health.sectorMax * 0.25));
  const diversificationStatus = sectorData.length >= 5 && health.topAllocation < 30 ? 'Well diversified' : sectorData.length >= 3 ? 'Moderate' : 'Needs work';
  const concentrationWarning = topHolding && topHolding.allocation > 35
    ? `${topHolding.ticker} is above the 35% concentration guardrail.`
    : topHolding && topHolding.allocation > 25
      ? `${topHolding.ticker} is the main position to monitor.`
      : 'No single stock is dominating the book.';
  const stabilityLabel = health.stabilityScore >= 76 ? 'Stable' : health.stabilityScore >= 58 ? 'Watch' : 'Fragile';

  const upcomingEvents = stats.slice(0, 3).map((holding, index) => ({
    stock: holding.ticker,
    event: index === 0 ? 'Earnings' : index === 1 ? 'Dividend' : 'Board update',
    date: ['Jul 19, 2026', 'Jul 24, 2026', 'Jul 31, 2026'][index],
    color: SECTOR_COLORS[holding.sector] ?? PIE_COLORS[index],
  }));

  const rebalanceNotes = [
    topHolding && topHolding.allocation > 35
      ? `Trim ${topHolding.ticker} by ${(topHolding.allocation - 30).toFixed(1)}% to reduce single-stock risk.`
      : 'No urgent single-stock trim required.',
    health.defensiveWeight < 18
      ? 'Add defensive exposure through Pharma, FMCG, Insurance, or Power.'
      : 'Defensive allocation is within a workable range.',
    sectorData.length < 4
      ? 'Add one more sector to improve earnings-driver diversity.'
      : 'Sector spread is acceptable for an MVP portfolio.',
  ];

  const exposureSummary = [
    { label: 'Aggressive', value: health.aggressiveWeight, color: '#ef4444' },
    { label: 'Defensive', value: health.defensiveWeight, color: '#22c55e' },
    { label: 'Largest Stock', value: health.topAllocation, color: '#8b5cf6' },
    { label: 'Largest Sector', value: health.sectorMax, color: '#f59e0b' },
  ];

  const resetForm = () => {
    setForm({ ticker: '', name: '', quantity: '', avgBuyPrice: '', currentPrice: '', sector: '' });
    setQuery('');
    setSectorQuery('');
    setEditingId(null);
  };

  const selectStock = (stock: { ticker: string; name: string; sector: string }) => {
    setForm((current) => ({ ...current, ticker: stock.ticker, name: stock.name, sector: stock.sector }));
    setQuery(`${stock.name} (${stock.ticker})`);
    setSectorQuery(stock.sector);
    setDropdownOpen(false);
  };

  const submitHolding = (event: React.FormEvent) => {
    event.preventDefault();
    const quantity = Number(form.quantity);
    const avgBuyPrice = Number(form.avgBuyPrice);
    const currentPrice = Number(form.currentPrice);
    const ticker = cleanTicker(form.ticker || query);
    const name = form.name.trim() || ticker;
    const sector = form.sector.trim() || 'Other';
    if (!ticker || !quantity || !avgBuyPrice || !currentPrice) return;
    const nextHolding: ManualHolding = { id: editingId ?? `${ticker}-${Date.now()}`, ticker, name, quantity, avgBuyPrice, currentPrice, sector };
    setHoldings((current) => editingId ? current.map((holding) => holding.id === editingId ? nextHolding : holding) : [...current, nextHolding]);
    setAnalysisReady(false);
    resetForm();
  };

  const editHolding = (holding: ManualHolding) => {
    setEditingId(holding.id);
    setForm({ ticker: holding.ticker, name: holding.name, quantity: String(holding.quantity), avgBuyPrice: String(holding.avgBuyPrice), currentPrice: String(holding.currentPrice), sector: holding.sector });
    setQuery(`${holding.name} (${holding.ticker})`);
    setSectorQuery(holding.sector);
    setDropdownOpen(false);
  };

  const deleteHolding = (id: string) => {
    setHoldings((current) => current.filter((holding) => holding.id !== id));
    setAnalysisReady(false);
  };

  const [apiError, setApiError] = useState<string | null>(null);

  const runAnalysis = async () => {
    console.log('>>> runAnalysis triggered in components.tsx');
    if (!holdings.length) {
      console.log('>>> no holdings');
      return;
    }
    if (isAnalyzing) {
      console.log('>>> already analyzing');
      return;
    }
    console.log('>>> Proceeding to analyze', holdings.length, 'holdings');
    setMessageIndex(0);
    setIsAnalyzing(true);
    setAnalysisReady(false);
    setApiError(null);
    try {
      const { portfolioApi } = await import('@/lib/api/fastapi');
      const apiHoldings = holdings.map(h => ({
        ticker: h.ticker,
        name: h.name,
        quantity: h.quantity,
        avg_buy_price: h.avgBuyPrice,
        current_price: h.currentPrice,
        sector: h.sector
      }));
      console.log('>>> sending payload to portfolioApi.analyzeHoldings', apiHoldings);
      const res = await portfolioApi.analyzeHoldings(apiHoldings);
      console.log('>>> got response', res);
      setAnalysisReady(true);
    } catch (error: any) {
      console.error('>>> catch block error:', error);
      setApiError(error.message || 'Failed to connect to FastAPI');
    } finally {
      setIsAnalyzing(false);
      console.log('>>> runAnalysis complete');
    }
  };

  const dashboardVisible = analysisReady && holdings.length > 0;

  if (isAnalyzing) {
    return (
      <motion.div key="manual-ai-loading" variants={screenVariants} initial="enter" animate="center" exit="exit"
        className="relative min-h-[calc(100vh-120px)] overflow-hidden rounded-[28px] border border-slate-200/70 bg-slate-950 text-white shadow-2xl shadow-violet-950/20 dark:border-white/[0.06]">
        <motion.div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(15,23,42,1), rgba(30,27,75,0.96) 45%, rgba(8,13,28,1))' }}
          animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }} transition={{ duration: 6, repeat: Infinity, ease: 'linear' }} />
        <div className="absolute inset-0 opacity-50" style={{ backgroundImage: 'linear-gradient(rgba(99,102,241,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.12) 1px, transparent 1px)', backgroundSize: '54px 54px' }} />
        <motion.div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-r from-violet-500/30 via-cyan-400/20 to-fuchsia-500/25 blur-3xl"
          animate={{ x: ['-20%', '20%', '-20%'], opacity: [0.35, 0.75, 0.35] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }} />
        <div className="relative z-10 flex min-h-[calc(100vh-120px)] flex-col items-center justify-center px-6 text-center">
          <div className="relative mb-8 h-36 w-36">
            <motion.div className="absolute inset-0 rounded-full border border-violet-400/30" animate={{ rotate: 360 }} transition={{ duration: 8, repeat: Infinity, ease: 'linear' }} />
            <motion.div className="absolute inset-5 rounded-full border border-cyan-300/20 border-t-cyan-300" animate={{ rotate: -360 }} transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }} />
            <div className="absolute inset-10 rounded-3xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-[0_0_48px_rgba(99,102,241,0.45)] flex items-center justify-center">
              <Brain className="h-9 w-9 text-white" />
            </div>
          </div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-violet-200">
            <Sparkles className="h-3.5 w-3.5" /> AI Portfolio Engine
          </div>
          <h2 className="text-3xl font-black tracking-tight md:text-4xl">Running portfolio intelligence</h2>
          <AnimatePresence mode="wait">
            <motion.p key={messageIndex} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mt-4 text-sm text-slate-300">
              {MANUAL_AI_MESSAGES[messageIndex]}
            </motion.p>
          </AnimatePresence>
          <div className="mt-8 h-1.5 w-full max-w-md overflow-hidden rounded-full bg-white/10">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-violet-500 via-cyan-400 to-fuchsia-400" initial={{ width: '8%' }} animate={{ width: '100%' }} transition={{ duration: 3.1, ease: EASE_CURVE }} />
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div key="manual-builder-v2" variants={screenVariants} initial="enter" animate="center" exit="exit" className="space-y-6 pb-8 text-slate-950 dark:text-white">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <button onClick={onBack} className="mt-1 rounded-xl border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:border-violet-300 hover:text-violet-600 dark:border-white/[0.06] dark:bg-white/[0.03] dark:text-slate-400 dark:hover:text-white">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-violet-700 dark:text-violet-300">
              <Briefcase className="h-3.5 w-3.5" /> Manual Portfolio Entry
            </div>
            <h1 className="text-2xl font-black tracking-tight">Portfolio Analyzer</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Add holdings one-by-one, then generate investor-grade AI analytics.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={onRestart} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 dark:border-white/[0.07] dark:bg-white/[0.03] dark:text-slate-300">Restart</button>
          <motion.button onClick={runAnalysis} disabled={!holdings.length} whileHover={holdings.length ? { scale: 1.02 } : {}} whileTap={holdings.length ? { scale: 0.98 } : {}}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-violet-500/25 transition disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none dark:disabled:bg-slate-800"
            style={holdings.length ? { background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' } : {}}>
            <Zap className="h-4 w-4" /> Run AI Analysis
          </motion.button>
        </div>
      </div>

      {apiError && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm font-medium text-red-600 dark:text-red-400">
          <AlertTriangle className="mr-2 inline-block h-4 w-4" />
          {apiError}
        </motion.div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[380px_1fr]">
        <div className="space-y-5">
          <form onSubmit={submitHolding} className="relative rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-xl shadow-slate-200/60 backdrop-blur dark:border-white/[0.07] dark:bg-slate-950/70 dark:shadow-black/30">
            <div className="mb-4 flex items-center justify-between">
              <div><h2 className="text-sm font-black">Add Holding</h2><p className="text-[11px] text-slate-500">Current price is manual for MVP.</p></div>
              {editingId && <button type="button" onClick={resetForm} className="text-[11px] font-semibold text-violet-600 dark:text-violet-300">Cancel edit</button>}
            </div>
            <div ref={searchRef} className="relative z-40 mb-3">
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Stock Name / Ticker</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={query} onChange={(event) => { setQuery(event.target.value); setForm((current) => ({ ...current, ticker: event.target.value, name: event.target.value })); setDropdownOpen(true); setActiveStockIndex(0); }}
                  onKeyDown={(event) => {
                    if (!dropdownOpen && ['ArrowDown', 'ArrowUp'].includes(event.key)) setDropdownOpen(true);
                    if (!dropdownOpen) return;
                    if (event.key === 'ArrowDown') { event.preventDefault(); setActiveStockIndex((i) => Math.min(i + 1, Math.max(visibleStocks.length - 1, 0))); }
                    if (event.key === 'ArrowUp') { event.preventDefault(); setActiveStockIndex((i) => Math.max(i - 1, 0)); }
                    if (event.key === 'Home') { event.preventDefault(); setActiveStockIndex(0); }
                    if (event.key === 'End') { event.preventDefault(); setActiveStockIndex(Math.max(visibleStocks.length - 1, 0)); }
                    if (event.key === 'Enter') { event.preventDefault(); chooseActiveStock(); }
                    if (event.key === 'Escape') setDropdownOpen(false);
                  }}
                  role="combobox" aria-expanded={dropdownOpen} aria-controls="stock-search-results"
                  onFocus={() => setDropdownOpen(true)} placeholder="Search RELIANCE, TCS, INFY..."
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10 text-sm font-semibold text-slate-900 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-500/10 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white dark:placeholder:text-slate-600" />
                {query && <button type="button" onClick={() => { setQuery(''); setForm((current) => ({ ...current, ticker: '', name: '' })); setDropdownOpen(false); }} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 transition hover:bg-slate-200/70 hover:text-slate-700 dark:hover:bg-white/[0.08] dark:hover:text-white"><X className="h-4 w-4" /></button>}
              </div>
              <AnimatePresence>
                {dropdownOpen && (
                  <motion.div initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.16, ease: EASE_CURVE }}
                    id="stock-search-results"
                    className="absolute left-0 right-0 top-full z-[140] mt-2 max-h-80 overflow-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl shadow-slate-900/20 ring-1 ring-slate-900/5 dark:border-white/[0.09] dark:bg-[#070b14] dark:shadow-black/70 dark:ring-violet-500/10">
                    {stockSearchLoading && (
                      <div className="space-y-2 p-3">
                        {[0, 1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded-xl bg-slate-100 dark:bg-white/[0.06]" />)}
                      </div>
                    )}
                    {!stockSearchLoading && visibleStocks.length === 0 && (
                      <div className="px-4 py-8 text-center">
                        <Search className="mx-auto mb-2 h-6 w-6 text-slate-400" />
                        <div className="text-sm font-bold text-slate-700 dark:text-slate-200">No stock found</div>
                        <p className="mt-1 text-xs text-slate-500">You can still type a custom ticker and sector manually.</p>
                      </div>
                    )}
                    {!stockSearchLoading && visibleStocks.map((stock, index) => {
                      const color = SECTOR_COLORS[stock.sector] ?? '#6366f1';
                      const active = index === activeStockIndex;
                      return (
                        <button type="button" key={stock.ticker} role="option" aria-selected={active} onMouseEnter={() => setActiveStockIndex(index)} onMouseDown={() => selectStock(stock)}
                          className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left outline-none transition-all duration-150 ${active ? 'bg-slate-950 text-white shadow-lg shadow-violet-500/15 ring-1 ring-violet-400/30 dark:bg-violet-500/16' : 'hover:bg-slate-100 dark:hover:bg-white/[0.055]'}`}>
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[10px] font-black shadow-inner" style={{ background: active ? `${color}28` : `${color}18`, color: active ? '#fff' : color, border: `1px solid ${color}45` }}>{stock.ticker.slice(0, 3)}</span>
                          <span className="min-w-0 flex-1">
                            <span className={`block text-sm font-black ${active ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{highlightedMatch(stock.ticker, query)}</span>
                            <span className={`block truncate text-[11px] font-semibold ${active ? 'text-slate-300' : 'text-slate-500'}`}>{highlightedMatch(stock.name, query)}</span>
                          </span>
                          <span className="rounded-full border px-2 py-1 text-[10px] font-bold" style={{ background: `${color}18`, color: active ? '#fff' : color, borderColor: `${color}35` }}>{stock.sector}</span>
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Quantity', 'quantity', 'number'],
                ['Avg Buy Price', 'avgBuyPrice', 'number'],
                ['Current Price', 'currentPrice', 'number'],
              ].map(([label, key, type]) => (
                <label key={key} className="block">
                  <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</span>
                  <input type={type} value={form[key as keyof typeof form]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-500/10 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white" />
                </label>
              ))}
              <label className="relative col-span-2 block" onBlur={() => window.setTimeout(() => setSectorDropdownOpen(false), 120)}>
                <span className="mb-1.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                  Sector
                  {form.sector && <span className="normal-case tracking-normal text-violet-600 dark:text-violet-300">Auto-suggested, editable</span>}
                </span>
                <input
                  value={sectorQuery || form.sector}
                  onFocus={() => setSectorDropdownOpen(true)}
                  onChange={(event) => {
                    setSectorQuery(event.target.value);
                    setForm((current) => ({ ...current, sector: event.target.value }));
                    setSectorDropdownOpen(true);
                    setActiveSectorIndex(0);
                  }}
                  onKeyDown={(event) => {
                    if (!sectorDropdownOpen && ['ArrowDown', 'ArrowUp'].includes(event.key)) setSectorDropdownOpen(true);
                    if (!sectorDropdownOpen) return;
                    if (event.key === 'ArrowDown') { event.preventDefault(); setActiveSectorIndex((i) => Math.min(i + 1, Math.max(filteredSectors.length - 1, 0))); }
                    if (event.key === 'ArrowUp') { event.preventDefault(); setActiveSectorIndex((i) => Math.max(i - 1, 0)); }
                    if (event.key === 'Home') { event.preventDefault(); setActiveSectorIndex(0); }
                    if (event.key === 'End') { event.preventDefault(); setActiveSectorIndex(Math.max(filteredSectors.length - 1, 0)); }
                    if (event.key === 'Enter') { event.preventDefault(); const item = filteredSectors[Math.min(activeSectorIndex, filteredSectors.length - 1)]; if (item) chooseSector(item.sector); }
                    if (event.key === 'Escape') setSectorDropdownOpen(false);
                  }}
                  role="combobox" aria-expanded={sectorDropdownOpen} aria-controls="sector-search-results"
                  placeholder="Search sector..."
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-500/10 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
                />
                <AnimatePresence>
                  {sectorDropdownOpen && (
                    <motion.div initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.98 }}
                      transition={{ duration: 0.16, ease: EASE_CURVE }}
                      id="sector-search-results"
                      className="absolute left-0 right-0 top-full z-[130] mt-2 max-h-80 overflow-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-900/20 ring-1 ring-slate-900/5 dark:border-white/[0.09] dark:bg-[#070b14] dark:shadow-black/70 dark:ring-violet-500/10">
                      {!filteredSectors.length && (
                        <div className="px-4 py-7 text-center text-xs font-semibold text-slate-500">No matching sector. You can keep your custom value.</div>
                      )}
                      {SECTOR_GROUPS.map((group) => {
                        const items = filteredSectors.filter((item) => item.group === group.label);
                        if (!items.length) return null;
                        return (
                          <div key={group.label} className="mb-2 last:mb-0">
                            <div className="px-2 pb-1 text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">{group.label}</div>
                            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                              {items.map((item) => {
                                const flatIndex = filteredSectors.findIndex((s) => s.sector === item.sector);
                                const active = flatIndex === activeSectorIndex;
                                return (
                                  <button key={item.sector} type="button" role="option" aria-selected={active} onMouseEnter={() => setActiveSectorIndex(flatIndex)} onMouseDown={() => chooseSector(item.sector)}
                                    className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-all duration-150 ${active ? 'border-violet-400/35 bg-slate-950 text-white shadow-lg shadow-violet-500/10 dark:bg-violet-500/16' : 'border-transparent hover:border-slate-200 hover:bg-slate-50 dark:hover:border-white/[0.08] dark:hover:bg-white/[0.05]'}`}>
                                    <span className="flex h-7 w-7 items-center justify-center rounded-lg text-[9px] font-black" style={{ background: `${item.color}18`, color: active ? '#fff' : item.color, border: `1px solid ${item.color}35` }}>{item.icon}</span>
                                    <span className={`text-xs font-bold ${active ? 'text-white' : 'text-slate-800 dark:text-slate-100'}`}>{highlightedMatch(item.sector, sectorQuery)}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </label>
            </div>
            <button type="submit" className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-violet-700 dark:bg-white dark:text-slate-950 dark:hover:bg-violet-100">
              <Plus className="h-4 w-4" /> {editingId ? 'Update Holding' : 'Add Stock'}
            </button>
          </form>

          <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-xl shadow-slate-200/60 backdrop-blur dark:border-white/[0.07] dark:bg-slate-950/70 dark:shadow-black/30">
            <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-black">Portfolio Holdings</h2><span className="rounded-full bg-violet-500/10 px-2 py-1 text-[10px] font-bold text-violet-700 dark:text-violet-300">{holdings.length} stocks</span></div>
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {stats.map((holding, index) => {
                  const color = SECTOR_COLORS[holding.sector] ?? PIE_COLORS[index % PIE_COLORS.length];
                  const positive = holding.pnl >= 0;
                  return (
                    <motion.div key={holding.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}
                      className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-xl hover:shadow-violet-500/10 dark:border-white/[0.06] dark:bg-white/[0.03] dark:hover:border-violet-500/30">
                      <div className="absolute inset-x-0 top-0 h-px opacity-0 transition group-hover:opacity-100" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[11px] font-black" style={{ background: `${color}18`, color, border: `1px solid ${color}35` }}>{holding.ticker.slice(0, 3)}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2"><h3 className="truncate text-sm font-black">{holding.name}</h3><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">{holding.ticker}</span></div>
                          <p className="mt-0.5 text-[11px] font-semibold text-slate-500">{holding.sector} - {holding.quantity} qty - Avg {money(holding.avgBuyPrice)}</p>
                        </div>
                        <div className="flex gap-1 opacity-100 md:opacity-0 md:transition md:group-hover:opacity-100">
                          <button onClick={() => editHolding(holding)} className="rounded-lg p-1.5 text-slate-500 hover:bg-violet-50 hover:text-violet-700 dark:hover:bg-violet-500/10 dark:hover:text-violet-300"><FileText className="h-3.5 w-3.5" /></button>
                          <button onClick={() => deleteHolding(holding.id)} className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-300"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                        <div><span className="block text-slate-500">Value</span><strong>{money(holding.value)}</strong></div>
                        <div><span className="block text-slate-500">Invested</span><strong>{money(holding.invested)}</strong></div>
                        <div className="text-right"><span className="block text-slate-500">P&L</span><strong className={positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>{money(holding.pnl)} ({pct(holding.pnlPct)})</strong></div>
                      </div>
                      <div className="mt-3"><div className="mb-1 flex justify-between text-[10px] font-bold text-slate-500"><span>Allocation</span><span>{holding.allocation.toFixed(1)}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.06]"><motion.div className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${color}88, ${color})` }} initial={{ width: 0 }} animate={{ width: `${holding.allocation}%` }} /></div></div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              { label: 'Portfolio Value', value: money(totals.value), sub: `${pct(totals.dailyPnlPct)} today`, tone: 'text-violet-700 dark:text-violet-300', icon: WalletCards, color: '#8b5cf6' },
              { label: 'Overall Return', value: `${money(totals.pnl)}`, sub: `${pct(totals.pnlPct)} all time`, tone: totals.pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400', icon: TrendingUp, color: totals.pnl >= 0 ? '#22c55e' : '#ef4444' },
              { label: 'Invested Amount', value: money(totals.invested), sub: `${holdings.length} holdings`, tone: 'text-slate-900 dark:text-white', icon: Coins, color: '#3b82f6' },
              { label: 'Risk Level', value: riskLevel, sub: `${Math.round(riskMeterValue)}/100 risk meter`, tone: riskLevel === 'Low' ? 'text-emerald-600 dark:text-emerald-400' : riskLevel === 'Moderate' ? 'text-amber-600 dark:text-amber-300' : 'text-red-600 dark:text-red-400', icon: Gauge, color: riskColor },
              { label: 'Health Score', value: `${health.portfolioHealth}/100`, sub: healthLabel, tone: 'text-violet-700 dark:text-violet-300', icon: Shield, color: health.healthColor },
            ].map((item, index) => (
              <motion.div key={item.label} custom={index} variants={cardVariants} initial="hidden" animate="visible" className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-lg shadow-slate-200/60 transition hover:-translate-y-0.5 hover:border-violet-400/30 dark:border-white/[0.07] dark:bg-slate-950/75 dark:shadow-black/30">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-0 transition group-hover:opacity-100" style={{ background: `linear-gradient(90deg, transparent, ${item.color}, transparent)` }} />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{item.label}</div>
                    <div className={`mt-2 truncate text-lg font-black tabular-nums ${item.tone}`}>{item.value}</div>
                    <div className="mt-1 text-[11px] font-semibold text-slate-500">{item.sub}</div>
                  </div>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: `${item.color}18`, color: item.color }}>
                    <item.icon className="h-4 w-4" />
                  </span>
                </div>
              </motion.div>
            ))}
          </div>

          {!dashboardVisible ? (
            <div className="relative min-h-[520px] overflow-hidden rounded-3xl border border-dashed border-slate-300 bg-white/75 p-6 text-center shadow-inner dark:border-white/[0.08] dark:bg-slate-950/45">
              <div className="absolute inset-0 opacity-60 dark:opacity-100" style={{ backgroundImage: 'linear-gradient(rgba(99,102,241,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.06) 1px, transparent 1px)', backgroundSize: '42px 42px' }} />
              <div className="relative z-10 flex min-h-[468px] flex-col items-center justify-center">
                <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10 text-violet-500 shadow-[0_0_28px_rgba(124,58,237,0.18)]">
                  <Brain className="h-7 w-7" />
                </span>
                <h2 className="text-xl font-black">Ready for AI analysis</h2>
                <p className="mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">Your holding cards are live. Run the engine to unlock the investor-grade dashboard, allocation visuals, health scores, and AI recommendations.</p>
                <div className="mt-7 grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
                  {['Risk model', 'Allocation map', 'AI recommendations'].map((label) => (
                    <div key={label} className="h-20 rounded-2xl border border-slate-200 bg-white/70 p-3 text-left shadow-sm dark:border-white/[0.06] dark:bg-white/[0.03]">
                      <div className="mb-3 h-2 w-16 animate-pulse rounded-full bg-slate-200 dark:bg-white/[0.08]" />
                      <div className="h-2 w-full animate-pulse rounded-full bg-slate-100 dark:bg-white/[0.05]" />
                      <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.45fr_0.9fr]">
                <DashboardPanel title="Portfolio Performance" eyebrow="Manual mark-to-market trend vs benchmark" icon={Activity}>
                  <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <div className="text-2xl font-black tabular-nums text-slate-950 dark:text-white">{money(totals.value)}</div>
                      <div className={`mt-1 text-xs font-bold ${totals.pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{pct(totals.pnlPct)} all time</div>
                    </div>
                    <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 text-[10px] font-black dark:border-white/[0.07] dark:bg-white/[0.03]">
                      {['1M', '3M', '6M', '1Y', 'All'].map((range) => (
                        <span key={range} className={`rounded-lg px-2.5 py-1 ${range === 'All' ? 'bg-violet-600 text-white shadow-sm shadow-violet-500/30' : 'text-slate-500'}`}>{range}</span>
                      ))}
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={292}>
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -12, bottom: 0 }}>
                      <defs>
                        <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.5} />
                          <stop offset="62%" stopColor="#6366f1" stopOpacity={0.12} />
                          <stop offset="100%" stopColor="#0f172a" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="benchmarkGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22c55e" stopOpacity={0.16} />
                          <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.14)" />
                      <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} dy={8} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} width={58} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                      <Tooltip content={<PremiumTooltip />} cursor={{ stroke: 'rgba(139,92,246,0.45)', strokeWidth: 1 }} />
                      <Area type="monotone" name="Benchmark" dataKey="benchmark" stroke="#22c55e" strokeWidth={2} fill="url(#benchmarkGradient)" dot={false} activeDot={{ r: 4, strokeWidth: 2 }} />
                      <Area type="monotone" name="Portfolio" dataKey="value" stroke="#8b5cf6" strokeWidth={3} fill="url(#portfolioGradient)" dot={false} activeDot={{ r: 5, stroke: '#c4b5fd', strokeWidth: 2 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                  <div className="mt-2 rounded-xl border border-emerald-500/15 bg-emerald-500/10 px-3 py-2 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                    Portfolio is {totals.pnlPct >= 8 ? 'ahead of' : 'tracking near'} a benchmark path by {Math.abs(totals.pnlPct - 8.2).toFixed(2)}%.
                  </div>
                </DashboardPanel>
                <DashboardPanel title="Portfolio Health Score" eyebrow="Weighted quality, balance, risk, and stability" icon={Shield}>
                  <div className="grid gap-5 sm:grid-cols-[190px_1fr] xl:grid-cols-1">
                    <div className="flex justify-center">
                      <HealthGauge score={health.portfolioHealth} color={health.healthColor} label={healthLabel} />
                    </div>
                    <div className="space-y-3">
                      {[
                        { label: 'Diversification', value: health.diversificationScore, status: diversificationStatus, color: '#8b5cf6' },
                        { label: 'Risk Management', value: 100 - riskMeterValue, status: riskLevel, color: riskColor },
                        { label: 'Asset Allocation', value: health.sectorBalanceScore, status: health.sectorBalanceScore > 70 ? 'Good' : 'Moderate', color: '#3b82f6' },
                        { label: 'Performance', value: Math.max(35, Math.min(96, 60 + totals.pnlPct * 1.7)), status: totals.pnl >= 0 ? 'Positive' : 'Needs work', color: totals.pnl >= 0 ? '#22c55e' : '#ef4444' },
                      ].map((item) => (
                        <div key={item.label}>
                          <div className="mb-1 flex items-center justify-between gap-3 text-[11px] font-bold">
                            <span className="text-slate-500">{item.label}</span>
                            <span style={{ color: item.color }}>{item.status}</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.06]">
                            <motion.div className="h-full rounded-full" style={{ background: item.color }} initial={{ width: 0 }} animate={{ width: `${Math.max(0, Math.min(item.value, 100))}%` }} transition={{ duration: 0.9, ease: EASE_CURVE }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </DashboardPanel>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
                {[
                  { title: 'Top Performing Stock', primary: topPerformer?.ticker ?? '-', value: topPerformer ? pct(topPerformer.pnlPct) : '-', tone: 'text-emerald-600 dark:text-emerald-400', icon: TrendingUp },
                  { title: 'Worst Performing Stock', primary: worstPerformer?.ticker ?? '-', value: worstPerformer ? pct(worstPerformer.pnlPct) : '-', tone: 'text-red-600 dark:text-red-400', icon: TrendingDown },
                  { title: 'Concentration Warning', primary: topHolding?.ticker ?? '-', value: topHolding ? `${topHolding.allocation.toFixed(1)}%` : '-', tone: health.topAllocation > 35 ? 'text-amber-600 dark:text-amber-300' : 'text-emerald-600 dark:text-emerald-400', icon: AlertTriangle },
                  { title: 'Diversification Status', primary: diversificationStatus, value: `${sectorData.length} sectors`, tone: diversificationStatus === 'Well diversified' ? 'text-emerald-600 dark:text-emerald-400' : 'text-violet-600 dark:text-violet-300', icon: Layers3 },
                  { title: 'Portfolio Risk Meter', primary: riskLevel, value: `${Math.round(riskMeterValue)}/100`, tone: riskLevel === 'Low' ? 'text-emerald-600 dark:text-emerald-400' : riskLevel === 'Moderate' ? 'text-amber-600 dark:text-amber-300' : 'text-red-600 dark:text-red-400', icon: Gauge },
                  { title: 'Stability Score', primary: stabilityLabel, value: `${Math.round(health.stabilityScore)}/100`, tone: health.stabilityScore >= 76 ? 'text-emerald-600 dark:text-emerald-400' : 'text-violet-600 dark:text-violet-300', icon: SlidersHorizontal },
                ].map((card) => (
                  <motion.div key={card.title} whileHover={{ y: -3 }} className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-lg shadow-slate-200/50 transition dark:border-white/[0.07] dark:bg-slate-950/75 dark:shadow-black/30">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{card.title}</span>
                      <card.icon className="h-4 w-4 text-slate-400" />
                    </div>
                    <div className="mt-3 text-sm font-black">{card.primary}</div>
                    <div className={`mt-1 text-lg font-black tabular-nums ${card.tone}`}>{card.value}</div>
                  </motion.div>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
                <DashboardPanel title="Asset Allocation" eyebrow="Position-weighted donut" icon={PieIcon}>
                  <div className="relative h-[248px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={stats} dataKey="allocation" nameKey="ticker" innerRadius="58%" outerRadius="82%" paddingAngle={4} stroke="rgba(15,23,42,0.55)" strokeWidth={3}>
                          {stats.map((entry, index) => <Cell key={entry.id} fill={SECTOR_COLORS[entry.sector] ?? PIE_COLORS[index % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip content={<PremiumTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-sm font-black tabular-nums text-slate-950 dark:text-white">{money(totals.value)}</div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Total</div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-1 grid grid-cols-1 gap-2">
                    {stats.slice(0, 4).map((holding, index) => {
                      const color = SECTOR_COLORS[holding.sector] ?? PIE_COLORS[index % PIE_COLORS.length];
                      return (
                        <div key={holding.id} className="flex items-center justify-between gap-3 text-[11px] font-bold">
                          <span className="flex min-w-0 items-center gap-2 text-slate-500"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} /><span className="truncate">{holding.ticker}</span></span>
                          <span className="tabular-nums text-slate-800 dark:text-slate-200">{holding.allocation.toFixed(1)}%</span>
                        </div>
                      );
                    })}
                  </div>
                </DashboardPanel>
                <DashboardPanel title="Sector Allocation" eyebrow="Color-coded exposure bars" icon={BarChart3}>
                  <ResponsiveContainer width="100%" height={252}>
                    <BarChart data={sectorData} layout="vertical" margin={{ left: 8, right: 28, top: 4, bottom: 4 }}>
                      <CartesianGrid horizontal={false} stroke="rgba(148,163,184,0.1)" />
                      <XAxis type="number" domain={[0, 100]} hide />
                      <YAxis dataKey="name" type="category" width={82} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<PremiumTooltip />} cursor={{ fill: 'rgba(99,102,241,0.06)' }} />
                      <Bar dataKey="value" name="Weight" radius={[0, 9, 9, 0]} barSize={14} label={{ position: 'right', fill: '#94a3b8', fontSize: 11, fontWeight: 800, formatter: (value: any) => `${Number(value).toFixed(1)}%` }}>
                        {sectorData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </DashboardPanel>
                <DashboardPanel title="AI Recommendations Panel" eyebrow="Actionable portfolio read" icon={Brain}>
                  <div className="space-y-3">
                    {insights.map((insight) => (
                      <div key={insight.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/[0.06] dark:bg-white/[0.03]">
                        <div className={`mb-1 text-xs font-black ${insight.tone === 'warn' ? 'text-amber-600 dark:text-amber-300' : insight.tone === 'good' ? 'text-emerald-600 dark:text-emerald-300' : 'text-violet-600 dark:text-violet-300'}`}>{insight.title}</div>
                        <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">{insight.body}</p>
                      </div>
                    ))}
                    <div className="rounded-2xl border border-violet-500/15 bg-violet-500/10 p-3 text-[11px] font-semibold text-violet-700 dark:text-violet-300">{concentrationWarning}</div>
                  </div>
                </DashboardPanel>
              </div>

              <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
                <DashboardPanel title="Upcoming Events" eyebrow="Earnings and dividend placeholders" icon={CalendarDays}>
                  <div className="space-y-2">
                    {upcomingEvents.map((event) => (
                      <div key={`${event.stock}-${event.event}`} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 transition hover:border-violet-300/60 hover:bg-violet-50/40 dark:border-white/[0.06] dark:bg-white/[0.03] dark:hover:border-violet-500/20 dark:hover:bg-violet-500/[0.05]">
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl text-[10px] font-black text-white" style={{ background: event.color }}>{event.stock.slice(0, 3)}</span>
                        <div className="min-w-0 flex-1"><div className="text-xs font-black">{event.stock}</div><div className="text-[11px] text-slate-500">{event.event}</div></div>
                        <div className="text-[11px] font-bold text-slate-500">{event.date}</div>
                      </div>
                    ))}
                  </div>
                </DashboardPanel>

                <DashboardPanel title="Rebalancing Suggestions" eyebrow="AI Plan" icon={Target}>
                  <div className="space-y-3">
                    {rebalanceNotes.map((note, index) => (
                      <div key={note} className="flex gap-3 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-[10px] font-black text-violet-600 dark:text-violet-300">{index + 1}</span>
                        {note}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 rounded-2xl bg-emerald-500/10 p-3 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                    Potential improvement: +{Math.max(6, Math.round((100 - health.portfolioHealth) / 3))}% risk-adjusted balance
                  </div>
                </DashboardPanel>

                <DashboardPanel title="Portfolio Exposure Summary" eyebrow={`${riskLevel} risk`} icon={Gauge}>
                  <div className="mb-4">
                    <div className="mb-1 flex items-center justify-between text-[11px] font-bold text-slate-500"><span>Portfolio Risk Meter</span><span style={{ color: riskColor }}>{Math.round(riskMeterValue)}/100</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.06]"><motion.div initial={{ width: 0 }} animate={{ width: `${riskMeterValue}%` }} transition={{ duration: 0.9, ease: EASE_CURVE }} className="h-full rounded-full" style={{ background: `linear-gradient(90deg, #22c55e, #f59e0b, ${riskColor})` }} /></div>
                  </div>
                  <div className="space-y-3">
                    {exposureSummary.map((item) => (
                      <div key={item.label}>
                        <div className="mb-1 flex justify-between text-[11px] font-bold text-slate-500"><span>{item.label}</span><span>{item.value.toFixed(1)}%</span></div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.06]"><motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(item.value, 100)}%` }} transition={{ duration: 0.8, ease: EASE_CURVE }} className="h-full rounded-full" style={{ background: item.color }} /></div>
                      </div>
                    ))}
                  </div>
                </DashboardPanel>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-xl shadow-slate-200/60 dark:border-white/[0.07] dark:bg-slate-950/75 dark:shadow-black/30">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-white/[0.06]">
                  <div><h2 className="flex items-center gap-2 text-sm font-black"><ArrowUpDown className="h-4 w-4 text-violet-500" /> Holdings Table</h2><p className="mt-0.5 text-[11px] font-semibold text-slate-500">Sortable, compact, sticky-header view</p></div>
                  <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-violet-700 dark:text-violet-300">{sortedStats.length} rows</span>
                </div>
                <div className="max-h-[520px] overflow-auto overscroll-contain">
                  <table className="w-full min-w-[860px] text-sm">
                    <thead className="sticky top-0 z-20 bg-slate-50/95 text-[10px] uppercase tracking-[0.14em] text-slate-500 shadow-sm backdrop-blur dark:bg-[#070b14]/95">
                      <tr>
                        {[
                          ['Stock', 'ticker'],
                          ['Quantity', null],
                          ['Avg Price', null],
                          ['Current Price', null],
                          ['Value', 'value'],
                          ['P&L', 'pnl'],
                          ['Allocation', 'allocation'],
                        ].map(([head, key]) => (
                          <th key={head} className="px-4 py-3 text-left font-black">
                            {key ? (
                              <button onClick={() => setSort(key as typeof sortBy)} className="inline-flex items-center gap-1.5 rounded-lg px-1 py-0.5 transition hover:bg-violet-500/10 hover:text-violet-600 dark:hover:text-violet-300">
                                {head}{sortBy === key && <span>{sortDir === 'asc' ? '↑' : '↓'}</span>}
                              </button>
                            ) : head}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                      {sortedStats.map((holding) => (
                        <tr key={holding.id} className="transition hover:bg-violet-50/70 dark:hover:bg-violet-500/[0.045]">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-black" style={{ background: `${(SECTOR_COLORS[holding.sector] ?? '#6366f1')}18`, color: SECTOR_COLORS[holding.sector] ?? '#6366f1', border: `1px solid ${(SECTOR_COLORS[holding.sector] ?? '#6366f1')}35` }}>{holding.ticker.slice(0, 3)}</span>
                              <div className="min-w-0"><div className="truncate font-black">{holding.name}</div><div className="truncate text-[11px] font-semibold text-slate-500">{holding.ticker} - {holding.sector}</div></div>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-semibold tabular-nums">{holding.quantity}</td>
                          <td className="px-4 py-3 font-semibold tabular-nums">{money(holding.avgBuyPrice)}</td>
                          <td className="px-4 py-3 font-semibold tabular-nums">{money(holding.currentPrice)}</td>
                          <td className="px-4 py-3 font-black tabular-nums">{money(holding.value)}</td>
                          <td className={`px-4 py-3 font-black tabular-nums ${holding.pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{money(holding.pnl)} ({pct(holding.pnlPct)})</td>
                          <td className="px-4 py-3 font-black tabular-nums">
                            <div className="flex items-center gap-2">
                              <span>{holding.allocation.toFixed(1)}%</span>
                              <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.06]"><span className="block h-full rounded-full bg-violet-500" style={{ width: `${Math.min(holding.allocation, 100)}%` }} /></span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export const ONBOARDING_QUESTIONS = [
  {
    id: 'goal',
    question: 'What is your primary investment goal?',
    subtitle: 'This helps us understand what you\'re investing for.',
    options: [
      { id: 'wealth', label: 'Wealth Creation', desc: 'Grow your money over time', icon: TrendingUp, color: '#6366f1' },
      { id: 'retirement', label: 'Retirement', desc: 'Build a comfortable retirement corpus', icon: Shield, color: '#22c55e' },
      { id: 'income', label: 'Passive Income', desc: 'Generate regular dividend income', icon: DollarSign, color: '#f59e0b' },
      { id: 'house', label: 'Buying a House', desc: 'Save for a major purchase', icon: Home, color: '#3b82f6' },
      { id: 'emergency', label: 'Emergency Fund', desc: 'Build a financial safety net', icon: Star, color: '#ec4899' },
    ],
  },
  {
    id: 'horizon',
    question: 'What is your investment time horizon?',
    subtitle: 'Longer horizons allow for more growth-oriented allocations.',
    options: [
      { id: '1-3y', label: '1–3 Years', desc: 'Short-term goals', icon: Clock, color: '#f59e0b' },
      { id: '3-7y', label: '3–7 Years', desc: 'Medium-term planning', icon: BarChart3, color: '#6366f1' },
      { id: '7y+', label: '7+ Years', desc: 'Long-term wealth building', icon: Flame, color: '#22c55e' },
    ],
  },
  {
    id: 'risk',
    question: 'How would you describe your risk appetite?',
    subtitle: 'There is no wrong answer — be honest with yourself.',
    options: [
      { id: 'conservative', label: 'Conservative', desc: 'I prefer safety over high returns. Capital protection first.', icon: Shield, color: '#22c55e' },
      { id: 'balanced', label: 'Balanced', desc: 'I can tolerate some volatility for reasonable growth.', icon: BarChart2, color: '#6366f1' },
      { id: 'aggressive', label: 'Aggressive', desc: 'I\'m comfortable with high risk for high reward potential.', icon: Flame, color: '#ef4444' },
    ],
  },
  {
    id: 'assets',
    question: 'What asset classes interest you?',
    subtitle: 'Select all that apply.',
    multi: true,
    options: [
      { id: 'indian-stocks', label: 'Indian Stocks', desc: 'NSE/BSE listed equities', icon: BarChart3, color: '#6366f1' },
      { id: 'etfs', label: 'Index ETFs', desc: 'Nifty 50, Nifty Next 50, etc.', icon: Globe, color: '#3b82f6' },
      { id: 'international', label: 'International', desc: 'US & global markets', icon: Globe, color: '#f59e0b' },
      { id: 'gold', label: 'Gold & Silver', desc: 'Commodity hedge', icon: Gem, color: '#fbbf24' },
    ],
  },
];

export function OnboardingScreen({ onBack, onComplete }: { onBack: () => void; onComplete: (answers: OnboardingAnswers) => void }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<OnboardingAnswers>>({ assets: [] });
  const [monthly, setMonthly] = useState(5000);

  const q = ONBOARDING_QUESTIONS[step];
  const totalSteps = ONBOARDING_QUESTIONS.length + 1; // +1 for monthly slider

  const isMonthlyStep = step === ONBOARDING_QUESTIONS.length;

  const canNext = isMonthlyStep ? true :
    q.multi ? (answers.assets?.length ?? 0) > 0 :
      !!(answers as any)[q.id];

  const handleOption = (optionId: string) => {
    if (q.multi) {
      setAnswers(prev => ({
        ...prev,
        assets: prev.assets?.includes(optionId)
          ? prev.assets.filter(a => a !== optionId)
          : [...(prev.assets ?? []), optionId],
      }));
    } else {
      setAnswers(prev => ({ ...prev, [q.id]: optionId }));
    }
  };

  const handleNext = () => {
    if (isMonthlyStep) {
      onComplete({ ...answers, monthly } as OnboardingAnswers);
    } else {
      setStep(s => s + 1);
    }
  };

  return (
    <motion.div
      key="onboarding"
      variants={screenVariants}
      initial="enter"
      animate="center"
      exit="exit"
      className="max-w-xl mx-auto py-8 px-4"
    >
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-sm mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-[10px] text-slate-500 mb-2">
          <span>Step {step + 1} of {totalSteps}</span>
          <span>{Math.round(((step + 1) / totalSteps) * 100)}% complete</span>
        </div>
        <div className="h-0.5 rounded-full bg-white/[0.06]">
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'linear-gradient(90deg, #4f46e5, #7c3aed)' }}
            animate={{ width: `${((step + 1) / totalSteps) * 100}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          {isMonthlyStep ? (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">How much can you invest monthly?</h2>
                <p className="text-slate-400 text-sm">This helps us suggest a realistic SIP (Systematic Investment Plan).</p>
              </div>
              <div className="p-6 rounded-2xl border border-white/[0.06]"
                style={{ background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(20px)' }}>
                <div className="text-4xl font-black text-white mb-1 tabular-nums">
                  ₹{monthly.toLocaleString('en-IN')}
                </div>
                <div className="text-sm text-slate-500 mb-6">per month</div>
                <input
                  type="range"
                  min={500}
                  max={100000}
                  step={500}
                  value={monthly}
                  onChange={e => setMonthly(parseInt(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-slate-600 mt-2">
                  <span>₹500</span>
                  <span>₹1,00,000</span>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[1000, 5000, 10000, 25000].map(v => (
                  <button key={v}
                    onClick={() => setMonthly(v)}
                    className={`py-2 rounded-xl text-[11px] font-semibold border transition-all ${monthly === v ? 'bg-violet-500/15 border-violet-500/40 text-violet-300' : 'border-white/[0.06] text-slate-500 hover:border-white/[0.1]'
                      }`}>
                    ₹{v >= 1000 ? `${v / 1000}K` : v}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">{q.question}</h2>
                <p className="text-slate-400 text-sm">{q.subtitle}</p>
              </div>
              <div className={`grid gap-3 ${q.options.length <= 3 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
                {q.options.map(opt => {
                  const isSelected = q.multi
                    ? answers.assets?.includes(opt.id)
                    : (answers as any)[q.id] === opt.id;
                  return (
                    <motion.button
                      key={opt.id}
                      whileHover={{ scale: 1.015 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => handleOption(opt.id)}
                      className="relative text-left p-4 rounded-2xl border transition-all duration-200"
                      style={isSelected ? {
                        background: `${opt.color}12`,
                        borderColor: `${opt.color}40`,
                      } : {
                        background: 'rgba(15,23,42,0.6)',
                        borderColor: 'rgba(255,255,255,0.06)',
                      }}
                    >
                      {isSelected && (
                        <div className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ background: opt.color }}>
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: `${opt.color}18`, border: `1px solid ${opt.color}30` }}>
                          <opt.icon className="w-5 h-5" style={{ color: opt.color }} />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white">{opt.label}</div>
                          <div className="text-[11px] text-slate-500 leading-snug mt-0.5">{opt.desc}</div>
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8">
        <button onClick={() => step > 0 ? setStep(s => s - 1) : onBack()}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" />
          {step === 0 ? 'Back' : 'Previous'}
        </button>
        <motion.button
          onClick={handleNext}
          disabled={!canNext}
          whileHover={canNext ? { scale: 1.03 } : {}}
          whileTap={canNext ? { scale: 0.97 } : {}}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${canNext ? 'text-white' : 'bg-slate-800 text-slate-600 cursor-not-allowed'
            }`}
          style={canNext ? { background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' } : {}}
        >
          {isMonthlyStep ? (
            <><Sparkles className="w-4 h-4" /> Build My Portfolio</>
          ) : (
            <>Continue <ArrowRight className="w-4 h-4" /></>
          )}
        </motion.button>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen 5 — AI Building Loading
// ─────────────────────────────────────────────────────────────────────────────
export function AIBuildingScreen({ onDone }: { onDone: () => void }) {
  const [msgIdx, setMsgIdx] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const msgInterval = setInterval(() => {
      setMsgIdx(i => (i + 1) % AI_BUILDING_MESSAGES.length);
    }, 1800);
    const progInterval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { clearInterval(progInterval); return 100; }
        return p + 1.2;
      });
    }, 60);
    const done = setTimeout(onDone, 8000);
    return () => { clearInterval(msgInterval); clearInterval(progInterval); clearTimeout(done); };
  }, [onDone]);

  return (
    <motion.div
      key="ai-building"
      variants={screenVariants}
      initial="enter"
      animate="center"
      exit="exit"
      className="min-h-[calc(100vh-140px)] flex flex-col items-center justify-center px-4"
    >
      {/* Ambient glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.06, 0.1, 0.06] }}
          transition={{ duration: 4, repeat: Infinity }}
          className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full"
          style={{ background: 'radial-gradient(circle, #6366f1, transparent)', filter: 'blur(80px)' }}
        />
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.04, 0.08, 0.04] }}
          transition={{ duration: 5, repeat: Infinity, delay: 1.5 }}
          className="absolute bottom-1/3 right-1/3 w-72 h-72 rounded-full"
          style={{ background: 'radial-gradient(circle, #7c3aed, transparent)', filter: 'blur(60px)' }}
        />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center max-w-sm">
        {/* Orbiting rings */}
        <div className="relative w-32 h-32 mb-8">
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              className="absolute inset-0 rounded-full border"
              style={{ borderColor: `rgba(99,102,241,${0.4 - i * 0.12})` }}
              animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
              transition={{ duration: 3 + i * 1.5, repeat: Infinity, ease: 'linear' }}
            />
          ))}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.15))', border: '1px solid rgba(99,102,241,0.3)' }}>
              <Brain className="w-8 h-8 text-violet-400" />
            </div>
          </div>
          {/* Orbiting dot */}
          <motion.div
            className="absolute w-3 h-3 rounded-full bg-violet-400 top-1/2 -translate-y-1/2"
            style={{ left: -6, boxShadow: '0 0 10px #6366f1' }}
            animate={{ rotate: 360 }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
            transformTemplate={({ rotate }) => `rotate(${rotate}) translateX(68px)`}
          />
        </div>

        <h2 className="text-2xl font-bold text-white mb-3">Building Your Portfolio</h2>

        {/* Rotating message */}
        <AnimatePresence mode="wait">
          <motion.p
            key={msgIdx}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="text-slate-400 text-sm mb-8"
          >
            {AI_BUILDING_MESSAGES[msgIdx]}
          </motion.p>
        </AnimatePresence>

        {/* Progress bar */}
        <div className="w-64 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'linear-gradient(90deg, #4f46e5, #7c3aed, #06b6d4)' }}
            animate={{ width: `${Math.min(progress, 100)}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <div className="text-[10px] text-slate-600 mt-2">{Math.min(Math.round(progress), 100)}% complete</div>

        {/* Steps */}
        <div className="mt-8 space-y-2 w-full">
          {['Analyzing your risk profile', 'Selecting optimal assets', 'Computing allocations', 'Generating AI recommendations'].map((step, i) => {
            const done = progress > (i + 1) * 25;
            return (
              <motion.div key={step}
                initial={{ opacity: 0 }}
                animate={{ opacity: progress > i * 25 ? 1 : 0.3 }}
                className="flex items-center gap-2.5 text-[11px]">
                <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${done ? 'bg-emerald-500/20' : 'bg-white/[0.05]'}`}>
                  {done ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />}
                </div>
                <span className={done ? 'text-emerald-400' : 'text-slate-500'}>{step}</span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen 6 — Beginner Results
// ─────────────────────────────────────────────────────────────────────────────
export function BeginnerResultsScreen({ answers, onBack, onRestart }: {
  answers: OnboardingAnswers;
  onBack: () => void;
  onRestart: () => void;
}) {
  const portfolio = useMemo(() => {
    const isAggressive = answers.risk === 'aggressive';
    const isConservative = answers.risk === 'conservative';
    const isLong = answers.horizon === '7y+';
    const wantsGold = answers.assets?.includes('gold');
    const wantsIntl = answers.assets?.includes('international');

    if (isAggressive && isLong) {
      return [
        { name: 'Nifty 50 ETF', ticker: 'NIFTYBEES', pct: wantsIntl ? 30 : 35, color: '#6366f1', desc: 'Core large-cap India exposure', icon: BarChart3 },
        { name: 'Nifty Next 50 ETF', ticker: 'JUNIORBEES', pct: 20, color: '#8b5cf6', desc: 'Mid-cap growth accelerator', icon: TrendingUp },
        { name: 'Small Cap Index', ticker: 'SMALLCAP250', pct: 20, color: '#f59e0b', desc: 'High-growth small cap basket', icon: Flame },
        ...(wantsIntl ? [{ name: 'Nasdaq 100 ETF', ticker: 'MAFANG', pct: 15, color: '#3b82f6', desc: 'US tech mega-cap exposure', icon: Globe }] : []),
        ...(wantsGold ? [{ name: 'Gold ETF', ticker: 'GOLDBEES', pct: 5, color: '#fbbf24', desc: 'Inflation hedge', icon: Gem }] : []),
        { name: 'Liquid Fund', ticker: 'LIQUIDCASE', pct: wantsIntl ? 5 : (wantsGold ? 5 : 10), color: '#22c55e', desc: 'Emergency liquidity buffer', icon: Shield },
      ].map(a => ({ ...a, pct: a.pct }));
    }
    if (isConservative) {
      return [
        { name: 'Nifty 50 ETF', ticker: 'NIFTYBEES', pct: 30, color: '#6366f1', desc: 'Blue-chip stability anchor', icon: Shield },
        { name: 'Debt Mutual Fund', ticker: 'DEBT', pct: 30, color: '#3b82f6', desc: 'Capital preservation instrument', icon: DollarSign },
        ...(wantsGold ? [{ name: 'Gold ETF', ticker: 'GOLDBEES', pct: 15, color: '#fbbf24', desc: 'Inflation hedge', icon: Gem }] : []),
        { name: 'Arbitrage Fund', ticker: 'ARBITRAGE', pct: wantsGold ? 15 : 25, color: '#22c55e', desc: 'Low-risk arbitrage returns', icon: BarChart2 },
        { name: 'Liquid Fund', ticker: 'LIQUIDCASE', pct: wantsGold ? 10 : 15, color: '#14b8a6', desc: 'Emergency liquidity buffer', icon: Coins },
      ];
    }
    // Balanced
    return [
      { name: 'Nifty 50 ETF', ticker: 'NIFTYBEES', pct: 35, color: '#6366f1', desc: 'Stable large-cap core', icon: BarChart3 },
      { name: 'Nifty Next 50 ETF', ticker: 'JUNIORBEES', pct: 20, color: '#8b5cf6', desc: 'Mid-cap growth exposure', icon: TrendingUp },
      ...(wantsIntl ? [{ name: 'Nasdaq 100 ETF', ticker: 'MAFANG', pct: 15, color: '#3b82f6', desc: 'Global diversification', icon: Globe }] : []),
      ...(wantsGold ? [{ name: 'Gold ETF', ticker: 'GOLDBEES', pct: 10, color: '#fbbf24', desc: 'Hedge against inflation', icon: Gem }] : []),
      { name: 'Liquid / Debt Fund', ticker: 'DEBT', pct: wantsIntl ? (wantsGold ? 10 : 15) : (wantsGold ? 15 : 25), color: '#22c55e', desc: 'Capital safety cushion', icon: Shield },
    ];
  }, [answers]);

  const totalPct = portfolio.reduce((s, a) => s + a.pct, 0);
  const normalizedPortfolio = portfolio.map(a => ({ ...a, pct: Math.round((a.pct / totalPct) * 100) }));

  const sipMonthly = answers.monthly;
  const riskLabel = answers.risk === 'conservative' ? 'Low' : answers.risk === 'aggressive' ? 'High' : 'Moderate';
  const riskColor = answers.risk === 'conservative' ? '#22c55e' : answers.risk === 'aggressive' ? '#ef4444' : '#6366f1';
  const returnRange = answers.risk === 'conservative' ? '8–11%' : answers.risk === 'aggressive' ? '14–20%' : '11–16%';
  const horizonLabel = answers.horizon === '1-3y' ? '1–3 years' : answers.horizon === '3-7y' ? '3–7 years' : '7+ years';

  const pieData = normalizedPortfolio.map(a => ({ name: a.name, value: a.pct, color: a.color }));

  const projectedValue = useMemo(() => {
    const years = answers.horizon === '1-3y' ? 3 : answers.horizon === '3-7y' ? 5 : 10;
    const rate = answers.risk === 'conservative' ? 0.09 : answers.risk === 'aggressive' ? 0.16 : 0.13;
    const monthly = sipMonthly;
    const n = years * 12;
    const r = rate / 12;
    const fv = monthly * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
    return Math.round(fv);
  }, [answers, sipMonthly]);

  return (
    <motion.div
      key="beginner-results"
      variants={screenVariants}
      initial="enter"
      animate="center"
      exit="exit"
      className="space-y-6 pb-8"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/25 bg-emerald-500/8 mb-3">
            <Sparkles className="w-3 h-3 text-emerald-400" />
            <span className="text-[10px] font-semibold text-emerald-300">AI-Generated Portfolio</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Your Recommended Portfolio</h1>
          <p className="text-slate-400 text-sm mt-1">Personalized for your goals · {horizonLabel} horizon · {riskLabel} risk</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onBack} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/[0.06] text-slate-500 hover:text-slate-300 text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" /> Edit
          </button>
          <button onClick={onRestart} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/[0.06] text-slate-500 hover:text-slate-300 text-sm transition-colors">
            <RotateCcw className="w-3.5 h-3.5" /> Restart
          </button>
        </div>
      </div>

      {/* Key stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Monthly SIP', value: `₹${sipMonthly.toLocaleString('en-IN')}`, color: '#6366f1' },
          { label: 'Risk Level', value: riskLabel, color: riskColor },
          { label: 'Expected Returns', value: returnRange + ' p.a.', color: '#22c55e' },
          { label: `Projected Value (${answers.horizon})`, value: `₹${(projectedValue / 100000).toFixed(1)}L`, color: '#f59e0b' },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            custom={i}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            className="p-4 rounded-2xl border border-white/[0.06]"
            style={{ background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(20px)' }}
          >
            <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500 mb-1">{s.label}</div>
            <div className="text-xl font-black tabular-nums" style={{ color: s.color }}>{s.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Main portfolio grid */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-5">

        {/* Allocation cards */}
        <div className="space-y-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Asset Allocation</div>
          {normalizedPortfolio.map((asset, i) => (
            <motion.div
              key={asset.ticker}
              custom={i}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              className="group relative p-4 rounded-2xl border border-white/[0.06] overflow-hidden transition-all duration-300 hover:border-white/[0.1]"
              style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(20px)' }}
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: `radial-gradient(ellipse at left, ${asset.color}08, transparent 60%)` }} />
              <div className="relative z-10 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${asset.color}18`, border: `1px solid ${asset.color}30` }}>
                  <asset.icon className="w-6 h-6" style={{ color: asset.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-sm font-bold text-white">{asset.name}</h3>
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold"
                      style={{ background: `${asset.color}18`, color: asset.color }}>
                      {asset.ticker}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">{asset.desc}</p>
                  <div className="mt-2 h-1 rounded-full bg-white/[0.05] overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: asset.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${asset.pct}%` }}
                      transition={{ duration: 0.8, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-2xl font-black tabular-nums" style={{ color: asset.color }}>{asset.pct}%</div>
                  <div className="text-[10px] text-slate-500">₹{Math.round(sipMonthly * asset.pct / 100).toLocaleString('en-IN')}/mo</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Right: Pie + AI note */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/[0.06] p-4"
            style={{ background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(20px)' }}>
            <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500 mb-3">Distribution</div>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={3}>
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} stroke="rgba(0,0,0,0.3)" strokeWidth={1} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: 'rgba(10,13,25,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, fontSize: 11 }}
                  formatter={(v: any) => [`${v}%`]} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* AI explanation */}
          <div className="rounded-2xl border border-violet-500/15 p-4"
            style={{ background: 'rgba(99,102,241,0.05)' }}>
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-4 h-4 text-violet-400" />
              <span className="text-[11px] font-bold text-violet-300">Why this portfolio?</span>
            </div>
            <div className="space-y-2 text-[11px] text-slate-400 leading-relaxed">
              {answers.risk === 'aggressive'
                ? <p>Your aggressive risk appetite and long horizon call for maximum equity allocation. Small and mid-cap exposure accelerates compounding but demands patience through volatility.</p>
                : answers.risk === 'conservative'
                  ? <p>Capital safety is the priority. A mix of Nifty 50 ETF, debt instruments, and arbitrage funds gives you steady, inflation-beating returns with minimal drawdowns.</p>
                  : <p>A balanced approach captures growth through large and mid-cap ETFs while maintaining stability via debt/liquid funds. Suitable for most long-term goals.</p>
              }
              <p className="mt-2 text-slate-500">
                ⚠️ Expected returns of <strong className="text-slate-400">{returnRange} p.a.</strong> are illustrative and not guaranteed. Past performance is not indicative of future results.
              </p>
            </div>
          </div>

          {/* Upgrade CTA */}
          <button
            className="w-full p-4 rounded-2xl border border-violet-500/20 text-sm font-semibold transition-all hover:border-violet-500/40 group"
            style={{ background: 'rgba(99,102,241,0.06)' }}
            onClick={onRestart}
          >
            <div className="flex items-center justify-center gap-2 text-violet-300 group-hover:text-violet-200">
              <BarChart3 className="w-4 h-4" />
              Analyze with MPT Engine
              <ArrowRight className="w-4 h-4" />
            </div>
            <p className="text-[10px] text-slate-600 mt-1">Switch to detailed portfolio analysis</p>
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root Page — State Machine
// ─────────────────────────────────────────────────────────────────────────────
