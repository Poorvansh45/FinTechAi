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
import { portfolioApi, marketApi, aiApi, type HoldingsAnalysis } from '@/lib/api/fastapi';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type AppScreen =
    | 'landing'
    | 'import-method'
    | 'portfolio-builder'
    | 'onboarding-questions'
    | 'ai-building'
    | 'beginner-results';

interface Stock {
    ticker: string;
    name: string;
    allocation: number;
}

interface PortfolioMetrics {
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
    // FastAPI unified response fields (when using analyzeHoldings)
    health?: HoldingsAnalysis['health'];
    insights?: HoldingsAnalysis['insights'];
    sector_exposure?: HoldingsAnalysis['sector_exposure'];
    sector_bias?: HoldingsAnalysis['sector_bias'];
    concentration?: HoldingsAnalysis['concentration'];
    diversification_score?: number;
    rebalance_suggestions?: HoldingsAnalysis['rebalance_suggestions'];
    totals?: HoldingsAnalysis['totals'];
    risk?: HoldingsAnalysis['risk'];
}

interface OnboardingAnswers {
    goal: string;
    horizon: string;
    risk: string;
    monthly: number;
    assets: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const SUGGESTED_STOCKS = [
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

const PIE_COLORS = [
    '#6366f1', '#22c55e', '#3b82f6', '#f59e0b',
    '#ec4899', '#14b8a6', '#f97316', '#8b5cf6',
    '#06b6d4', '#a78bfa',
];

const SECTOR_COLORS: Record<string, string> = {
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
    { label: 'Financial Core', sectors: ['Banking', 'Finance', 'Insurance', 'PSU'] },
    { label: 'Growth & Consumption', sectors: ['IT', 'FMCG', 'Consumer', 'Telecom'] },
    { label: 'Industrials & Cyclicals', sectors: ['Auto', 'Infra', 'Metal', 'Realty', 'Chemicals', 'Energy'] },
    { label: 'Strategic & Defensive', sectors: ['Pharma', 'Defence'] },
    { label: 'Funds & Baskets', sectors: ['ETF', 'Mutual Fund'] },
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

const MANUAL_AI_MESSAGES = [
    'Analyzing diversification...',
    'Calculating portfolio health...',
    'Building AI insights...',
    'Generating allocation analytics...',
];

// ─────────────────────────────────────────────────────────────────────────────
// Animation variants
// ─────────────────────────────────────────────────────────────────────────────
const EASE_CURVE: [number, number, number, number] = [0.22, 1, 0.36, 1];

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
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const cleanTicker = (ticker: string) => ticker.replace('.NS', '').toUpperCase();
const money = (value: number) => `Rs. ${Math.round(value).toLocaleString('en-IN')}`;
const pct = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

// ─────────────────────────────────────────────────────────────────────────────
// Small reusable atoms
// ─────────────────────────────────────────────────────────────────────────────
function FeaturePill({ label, color = 'violet' }: { label: string; color?: string }) {
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

function MetricPill({ label, value, color }: { label: string; value: string; color?: string }) {
    return (
        <div className="glass-card p-3 flex flex-col gap-0.5">
            <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</span>
            <span className={`text-[17px] font-bold tabular-nums ${color ?? 'text-white'}`}>{value}</span>
        </div>
    );
}

function DashboardPanel({
    title, eyebrow, children, className = '', icon: Icon,
}: {
    title: string; eyebrow?: string; children: ReactNode; className?: string; icon?: ElementType;
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

function PremiumTooltip({ active, payload, label }: any) {
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

function HealthGauge({ score, color, label }: { score: number; color: string; label: string }) {
    const radius = 62;
    const circumference = 2 * Math.PI * radius;
    const dash = (Math.max(0, Math.min(score, 100)) / 100) * circumference;
    return (
        <div className="relative flex h-44 w-44 items-center justify-center">
            <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 160 160">
                <circle cx="80" cy="80" r={radius} fill="none" stroke="rgba(148,163,184,0.16)" strokeWidth="14" />
                <motion.circle
                    cx="80" cy="80" r={radius}
                    fill="none" stroke={color} strokeWidth="14" strokeLinecap="round"
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

function SectionDivider({ title, accent = '#6366f1' }: { title: string; accent?: string }) {
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
function LandingScreen({ onAnalyze, onBuild }: { onAnalyze: () => void; onBuild: () => void }) {
    return (
        <motion.div
            key="landing" variants={screenVariants} initial="enter" animate="center" exit="exit"
            className="relative min-h-[calc(100vh-120px)] flex flex-col items-center justify-center px-4 py-12 overflow-hidden"
        >
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-[0.06]"
                    style={{ background: 'radial-gradient(circle, #6366f1, transparent)', filter: 'blur(80px)' }} />
                <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-[0.05]"
                    style={{ background: 'radial-gradient(circle, #8b5cf6, transparent)', filter: 'blur(60px)' }} />
                <div className="absolute inset-0 opacity-[0.018]"
                    style={{ backgroundImage: 'linear-gradient(rgba(99,102,241,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.8) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
            </div>

            <motion.div className="text-center mb-14 relative z-10"
                initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-violet-500/25 bg-violet-500/8 mb-6">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                    <span className="text-[11px] font-semibold text-violet-300 tracking-wide">AI-Powered Portfolio Intelligence</span>
                </div>
                <h1 className="text-4xl md:text-5xl font-black text-white leading-tight mb-4">
                    How would you like to{' '}<span className="gradient-text">start?</span>
                </h1>
                <p className="text-slate-400 text-base max-w-lg mx-auto leading-relaxed">
                    Whether you already have investments or you&apos;re starting from scratch,
                    Nivro helps you build, analyze and improve your portfolio.
                </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl relative z-10">
                <motion.button custom={0} variants={cardVariants} initial="hidden" animate="visible"
                    onClick={onAnalyze}
                    className="group relative text-left p-8 rounded-2xl border border-white/[0.06] overflow-hidden transition-all duration-300 cursor-pointer"
                    style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.8) 0%, rgba(30,27,75,0.6) 100%)', backdropFilter: 'blur(20px)' }}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.99 }}>
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                        style={{ background: 'radial-gradient(ellipse at top left, rgba(99,102,241,0.12) 0%, transparent 60%)' }} />
                    <div className="relative z-10">
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
                        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white w-fit"
                            style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
                            Analyze Portfolio <ArrowRight className="w-4 h-4" />
                        </div>
                    </div>
                </motion.button>

                <motion.button custom={1} variants={cardVariants} initial="hidden" animate="visible"
                    onClick={onBuild}
                    className="group relative text-left p-8 rounded-2xl border border-white/[0.06] overflow-hidden transition-all duration-300 cursor-pointer"
                    style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.8) 0%, rgba(5,46,22,0.4) 100%)', backdropFilter: 'blur(20px)' }}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.99 }}>
                    <div className="relative z-10">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6"
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
                        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white w-fit"
                            style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}>
                            Start Planning <ArrowRight className="w-4 h-4" />
                        </div>
                    </div>
                </motion.button>
            </div>

            <motion.div className="mt-12 flex items-center gap-6 text-[11px] text-slate-600 relative z-10"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
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
// Screen 2 — Import Method
// ─────────────────────────────────────────────────────────────────────────────
function ImportMethodScreen({ onBack, onManual }: { onBack: () => void; onManual: () => void }) {
    const methods = [
        { icon: Plus, title: 'Manual Entry', desc: 'Search and add stocks manually.', badge: null, active: true, color: '#6366f1' },
        { icon: FileText, title: 'Upload Portfolio Statement', desc: 'Import from CDSL/NSDL CAS statement.', badge: 'Coming Soon', active: false, color: '#3b82f6' },
        { icon: Upload, title: 'Import CSV', desc: 'Upload a CSV with ticker and allocation.', badge: 'Coming Soon', active: false, color: '#f59e0b' },
        { icon: Link2, title: 'Connect Broker', desc: 'Link your Zerodha, Groww, or Upstox account.', badge: 'Coming Soon', active: false, color: '#22c55e' },
    ];

    return (
        <motion.div key="import-method" variants={screenVariants} initial="enter" animate="center" exit="exit"
            className="max-w-2xl mx-auto py-10 px-4">
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
                    <motion.button key={m.title} custom={i} variants={cardVariants} initial="hidden" animate="visible"
                        onClick={m.active ? onManual : undefined}
                        className={`group relative text-left p-5 rounded-2xl border transition-all duration-300 ${m.active ? 'border-white/[0.08] hover:border-violet-500/30 cursor-pointer' : 'border-white/[0.04] opacity-60 cursor-not-allowed'}`}
                        style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(16px)' }}
                        whileHover={m.active ? { scale: 1.02 } : {}}>
                        {m.badge && (
                            <div className="absolute top-3 right-3 text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/5 text-slate-500">{m.badge}</div>
                        )}
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
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
// Screen 3 — Portfolio Builder (MPT Option A)
// RESTORED: Full dashboard layout matching reference image (INDmoney-style)
// ALL panels visible simultaneously after analysis — no tabs.
// ALL analytics driven exclusively from FastAPI /api/v2/portfolio/analyze-holdings
// Configuration panel removed when holdings are present (per requirements).
// ─────────────────────────────────────────────────────────────────────────────
function PortfolioBuilderScreen({ onBack, onRestart }: { onBack: () => void; onRestart: () => void }) {
    const [stocks, setStocks] = useState<Stock[]>([
        { ticker: 'RELIANCE.NS', name: 'Reliance Industries', allocation: 25 },
        { ticker: 'TCS.NS', name: 'Tata Consultancy Services', allocation: 25 },
        { ticker: 'INFY.NS', name: 'Infosys', allocation: 25 },
        { ticker: 'HDFCBANK.NS', name: 'HDFC Bank', allocation: 25 },
    ]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    // FIX: analyzeHoldings replaces analyzePortfolio — richer response
    const [analysis, setAnalysis] = useState<HoldingsAnalysis | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [warnings, setWarnings] = useState<string[]>([]);
    const [syncedAt, setSyncedAt] = useState<string | null>(null);
    const searchRef = useRef<HTMLDivElement>(null);

    const totalAllocation = stocks.reduce((s, st) => s + st.allocation, 0);
    const isValid = stocks.length >= 2 && totalAllocation === 100;

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDropdown(false);
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
        setAnalysis(null); // invalidate analysis when holdings change
    };

    const removeStock = (ticker: string) => {
        const remaining = stocks.filter(s => s.ticker !== ticker);
        if (remaining.length === 0) { setStocks([]); return; }
        const share = Math.floor(100 / remaining.length);
        const norm = remaining.map(s => ({ ...s, allocation: share }));
        norm[0].allocation += 100 - norm.reduce((a, s) => a + s.allocation, 0);
        setStocks(norm);
        setAnalysis(null);
    };

    const updateAllocation = (ticker: string, val: number) => {
        setStocks(prev => prev.map(s => s.ticker === ticker ? { ...s, allocation: val } : s));
        setAnalysis(null);
    };

    const normalizeAllocations = () => {
        const total = stocks.reduce((s, st) => s + st.allocation, 0);
        if (!total) return;
        setStocks(prev => prev.map(s => ({ ...s, allocation: Math.round((s.allocation / total) * 100) })));
    };

    // ── Core API call: analyzeHoldings ────────────────────────────────────────
    // Uses /api/v2/portfolio/analyze-holdings — returns full dashboard payload:
    // health, risk, sector_exposure, insights, rebalance_suggestions, concentration, diversification_score
    const runAnalysis = useCallback(async () => {
        if (!isValid) return;
        setLoading(true); setError(null); setWarnings([]);
        try {
            // Build holdings payload from ticker+allocation input
            // We send synthetic holdings: quantity=1, avg_buy_price=allocation*1000, current_price=allocation*1000
            // This lets us get full analytics based on weight distribution.
            // The analyzeHoldings endpoint returns all dashboard metrics.
            const holdingsPayload = stocks.map(s => ({
                ticker: s.ticker,
                name: s.name,
                quantity: 1,
                avg_buy_price: s.allocation * 1000,
                current_price: s.allocation * 1000,
                sector: SUGGESTED_STOCKS.find(sg => sg.ticker === s.ticker)?.sector,
            }));

            console.log('[OptionA] Calling analyzeHoldings with payload:', holdingsPayload);
            const result = await portfolioApi.analyzeHoldings(holdingsPayload);

            console.log('[OptionA] FastAPI analyzeHoldings response:', {
                health_score: result.health?.score,
                health_label: result.health?.label,
                risk_level: result.risk?.risk_level?.level,
                volatility_pct: result.risk?.volatility_pct,
                sharpe_ratio: result.risk?.sharpe_ratio,
                sortino_ratio: result.risk?.sortino_ratio,
                beta: result.risk?.beta,
                var_95: result.risk?.var_95,
                max_drawdown_pct: result.risk?.max_drawdown_pct,
                cagr: result.risk?.cagr,
                diversification_score: result.diversification_score,
                sector_count: result.sector_exposure?.length,
                insight_count: result.insights?.length,
                rebalance_count: result.rebalance_suggestions?.length,
                data_source: result.risk?.data_source,
                health_breakdown: result.health?.breakdown,
                concentration: result.concentration,
            });

            if ((result as any).warnings) setWarnings((result as any).warnings);
            setAnalysis(result);
            setSyncedAt(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
        } catch (e: any) {
            console.error('[OptionA] analyzeHoldings error:', e);
            setError(e.message || 'Analysis failed. Ensure FastAPI is running on port 8000.');
        } finally {
            setLoading(false);
        }
    }, [stocks, isValid]);

    // ── Derived API values ────────────────────────────────────────────────────
    const apiHealth = analysis?.health;
    const apiRisk = analysis?.risk;
    const apiSectors = analysis?.sector_exposure ?? [];
    const apiInsights = analysis?.insights ?? [];
    const apiRebalance = analysis?.rebalance_suggestions ?? [];
    const apiConc = analysis?.concentration;
    const apiDivScore = analysis?.diversification_score ?? 0;
    const apiSectorBias = analysis?.sector_bias;
    const apiTotals = analysis?.totals;

    const healthScore = apiHealth?.score ?? 0;
    const healthLabel = apiHealth?.label ?? (analysis ? 'Loading' : '—');
    const healthColor = apiHealth?.color ?? '#64748b';
    const riskLvl = apiRisk?.risk_level?.level ?? '—';
    const riskColor = riskLvl === 'Low' ? '#22c55e' : riskLvl === 'Moderate' ? '#f59e0b' : riskLvl === 'Elevated' ? '#f97316' : '#ef4444';
    const totalValue = apiTotals?.total_value ?? stocks.reduce((s, st) => s + st.allocation * 1000, 0);
    const totalInvested = apiTotals?.total_invested ?? totalValue;
    const totalPnl = apiTotals?.total_pnl ?? 0;
    const totalPnlPct = apiTotals?.total_pnl_pct ?? 0;

    const sectorPieData = useMemo(() =>
        apiSectors.map((s, i) => ({
            name: s.sector, value: s.weight_pct,
            color: SECTOR_COLORS[s.sector] ?? PIE_COLORS[i % PIE_COLORS.length],
        })), [apiSectors]);

    // Stock allocation pie (from user input — always visible)
    const allocationPieData = stocks.map((s, i) => ({
        name: s.ticker.replace('.NS', ''), value: s.allocation,
        color: PIE_COLORS[i % PIE_COLORS.length],
    }));

    const filteredSuggestions = SUGGESTED_STOCKS.filter(
        s => !stocks.find(st => st.ticker === s.ticker) &&
            (s.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
                s.name.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    // Health breakdown colours
    const bdColor = (v: number) => v >= 65 ? '#22c55e' : v >= 42 ? '#f59e0b' : '#ef4444';

    // Tone styles for insights
    const toneStyle = (tone: string) => ({
        warn: { bg: '#f59e0b15', border: '#f59e0b30', dot: '#f59e0b', label: 'text-amber-400' },
        good: { bg: '#22c55e15', border: '#22c55e30', dot: '#22c55e', label: 'text-emerald-400' },
        info: { bg: '#3b82f615', border: '#3b82f630', dot: '#3b82f6', label: 'text-blue-400' },
        strong: { bg: '#6366f115', border: '#6366f130', dot: '#6366f1', label: 'text-violet-400' },
    }[tone] ?? { bg: 'rgba(255,255,255,0.02)', border: 'rgba(255,255,255,0.08)', dot: '#64748b', label: 'text-slate-400' });

    return (
        <motion.div key="portfolio-builder" variants={screenVariants} initial="enter" animate="center" exit="exit"
            className="min-h-screen pb-8">

            {/* ── Top header bar (mirrors reference image) ── */}
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.05] transition-all">
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div>
                        <h1 className="text-[17px] font-black text-white flex items-center gap-2">
                            Portfolio Analyzer
                            <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded border bg-violet-500/10 text-violet-400 border-violet-500/20">
                                MPT Engine
                            </span>
                            {analysis && (
                                <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded border bg-emerald-500/10 text-emerald-400 border-emerald-500/20 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    Live
                                </span>
                            )}
                        </h1>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                            {analysis
                                ? `Portfolio synced · Last updated: Today, ${syncedAt}`
                                : 'Add stocks and run analysis to see the full dashboard'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Allocation status pill */}
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-semibold border ${totalAllocation === 100 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${totalAllocation === 100 ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
                        {totalAllocation}% allocated
                        {totalAllocation !== 100 && (
                            <button onClick={normalizeAllocations} className="ml-1.5 underline hover:no-underline">Auto-fix</button>
                        )}
                    </div>

                    <motion.button onClick={runAnalysis} disabled={!isValid || loading}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${isValid && !loading ? 'text-white shadow-lg shadow-violet-500/25' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
                        style={isValid && !loading ? { background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' } : {}}
                        whileHover={isValid && !loading ? { scale: 1.03 } : {}} whileTap={isValid && !loading ? { scale: 0.97 } : {}}>
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        {loading ? 'Analyzing…' : analysis ? 'Sync Portfolio' : 'Run Analysis'}
                    </motion.button>
                </div>
            </div>

            {/* Sync success banner */}
            <AnimatePresence>
                {analysis && syncedAt && (
                    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 mb-4 text-[11px] text-emerald-400 font-semibold">
                        <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                            <Check className="w-2.5 h-2.5 text-emerald-400" />
                        </div>
                        Portfolio synced successfully
                        <span className="text-emerald-500/60 font-normal ml-1">Last updated: Today, {syncedAt}</span>
                        <span className="ml-auto text-emerald-500/70 font-normal">
                            Health: {healthScore}/100 · Risk: {riskLvl} · Sharpe: {(apiRisk?.sharpe_ratio ?? 0).toFixed(2)} · Vol: {(apiRisk?.volatility_pct ?? 0).toFixed(1)}%
                        </span>
                    </motion.div>
                )}
                {error && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="mb-4 flex items-start gap-2.5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <div>
                            {error}
                            <div className="text-[10px] text-red-400/60 mt-0.5">Make sure FastAPI is running: uvicorn main:app --port 8000 --reload</div>
                        </div>
                    </motion.div>
                )}
                {warnings.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="mb-4 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                        <div className="flex items-center gap-2 font-semibold text-amber-400 text-sm mb-2">
                            <AlertTriangle className="w-4 h-4" /> Warnings
                        </div>
                        <ul className="space-y-1">
                            {warnings.map((w, i) => <li key={i} className="text-[11px] text-amber-500/80">• {w}</li>)}
                        </ul>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── KPI Strip (top row of cards — reference image style) ── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
                {[
                    {
                        label: 'Portfolio Value',
                        value: `₹${(totalValue / 1000).toFixed(0)}K`,
                        sub: analysis ? `${totalPnl >= 0 ? '+' : ''}${totalPnlPct.toFixed(2)}% All Time` : `${stocks.length} stocks · ${totalAllocation}% weighted`,
                        icon: WalletCards, color: '#8b5cf6', tone: 'text-violet-400',
                    },
                    {
                        label: 'Overall Return',
                        value: analysis ? `${totalPnl >= 0 ? '+' : ''}₹${Math.abs(totalPnl / 1000).toFixed(1)}K` : '—',
                        sub: analysis ? `${totalPnlPct >= 0 ? '+' : ''}${totalPnlPct.toFixed(2)}% (All Time)` : 'Run analysis',
                        icon: TrendingUp, color: analysis ? (totalPnl >= 0 ? '#22c55e' : '#ef4444') : '#64748b',
                        tone: analysis ? (totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-slate-500',
                    },
                    {
                        label: 'XIRR / CAGR',
                        value: analysis ? `${(apiRisk?.cagr ?? 0).toFixed(1)}%` : '—',
                        sub: apiRisk?.data_source === 'historical' ? 'from price history' : 'estimated',
                        icon: Activity, color: '#3b82f6', tone: 'text-blue-400',
                    },
                    {
                        label: 'Sharpe Ratio',
                        value: analysis ? (apiRisk?.sharpe_ratio ?? 0).toFixed(2) : '—',
                        sub: analysis ? ((apiRisk?.sharpe_ratio ?? 0) >= 1 ? '↑ Above benchmark' : '↓ Below 1.0') : 'Run analysis',
                        icon: BarChart3, color: analysis ? ((apiRisk?.sharpe_ratio ?? 0) >= 1 ? '#22c55e' : '#f59e0b') : '#64748b',
                        tone: analysis ? ((apiRisk?.sharpe_ratio ?? 0) >= 1 ? 'text-emerald-400' : 'text-amber-400') : 'text-slate-500',
                    },
                    {
                        label: 'Health Score',
                        value: analysis ? `${healthScore}/100` : '—',
                        sub: analysis ? healthLabel : 'Run analysis',
                        icon: Shield, color: healthColor, tone: 'text-violet-400',
                    },
                ].map((card, i) => (
                    <motion.div key={card.label} custom={i} variants={cardVariants} initial="hidden" animate="visible"
                        className="relative overflow-hidden rounded-2xl border border-white/[0.06] p-4 group"
                        style={{ background: 'rgba(15,23,42,0.75)', backdropFilter: 'blur(20px)' }}>
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ background: `linear-gradient(90deg, transparent, ${card.color}, transparent)` }} />
                        <div className="flex items-start justify-between mb-2">
                            <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">{card.label}</span>
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                                style={{ background: `${card.color}18`, color: card.color }}>
                                <card.icon className="h-3.5 w-3.5" />
                            </span>
                        </div>
                        <div className={`text-xl font-black tabular-nums ${card.tone}`}>{card.value}</div>
                        <div className="mt-1 text-[10px] font-semibold text-slate-500">{card.sub}</div>
                    </motion.div>
                ))}
            </div>

            {/* ── Main 2-column dashboard layout ── */}
            <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-5">

                {/* ── LEFT COLUMN: Stock builder + Holdings list ── */}
                <div className="space-y-4">

                    {/* Stock Search */}
                    <div className="rounded-2xl border border-white/[0.06] overflow-visible"
                        style={{ background: 'rgba(15,23,42,0.75)', backdropFilter: 'blur(20px)' }}>
                        <div className="p-4">
                            <SectionDivider title="Add Stocks to Portfolio" />
                            <div ref={searchRef} className="relative">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                    <input
                                        value={searchQuery}
                                        onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true); }}
                                        onFocus={() => setShowDropdown(true)}
                                        placeholder="Search NSE ticker or company…"
                                        className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-white/[0.06] bg-white/[0.03] text-white placeholder:text-slate-600 outline-none focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/10 transition-all"
                                    />
                                    {searchQuery && (
                                        <button onClick={() => { setSearchQuery(''); setShowDropdown(false); }}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                                <AnimatePresence>
                                    {showDropdown && filteredSuggestions.length > 0 && (
                                        <motion.div initial={{ opacity: 0, y: -4, scaleY: 0.95 }} animate={{ opacity: 1, y: 0, scaleY: 1 }}
                                            exit={{ opacity: 0, y: -4, scaleY: 0.95 }} transition={{ duration: 0.15 }}
                                            className="absolute top-full left-0 right-0 mt-2 z-50 rounded-xl border border-white/[0.08] overflow-hidden shadow-2xl shadow-black/60"
                                            style={{ background: 'rgba(10,13,25,0.97)', backdropFilter: 'blur(24px)' }}>
                                            <div className="p-1 max-h-52 overflow-y-auto">
                                                {filteredSuggestions.slice(0, 8).map(s => {
                                                    const sc = SECTOR_COLORS[s.sector] ?? '#6366f1';
                                                    return (
                                                        <button key={s.ticker} onMouseDown={() => addStock(s.ticker, s.name)}
                                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-violet-500/10 transition-colors text-left">
                                                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black flex-shrink-0"
                                                                style={{ background: `${sc}20`, color: sc, border: `1px solid ${sc}30` }}>
                                                                {s.ticker.replace('.NS', '').slice(0, 3)}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-[12px] font-bold text-white">{s.ticker.replace('.NS', '')}</div>
                                                                <div className="text-[10px] text-slate-500 truncate">{s.name}</div>
                                                            </div>
                                                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0"
                                                                style={{ background: `${sc}18`, color: sc }}>{s.sector}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Allocation sliders */}
                            {stocks.length > 0 && (
                                <div className="mt-4 space-y-2.5">
                                    <div className="flex items-center justify-between text-[9px] text-slate-600">
                                        <span>{stocks.length} stocks</span>
                                        <span className={totalAllocation === 100 ? 'text-emerald-500' : 'text-amber-500'}>{totalAllocation}% allocated</span>
                                    </div>
                                    <AnimatePresence mode="popLayout">
                                        {stocks.map((stock, i) => {
                                            const color = PIE_COLORS[i % PIE_COLORS.length];
                                            return (
                                                <motion.div key={stock.ticker} layout
                                                    initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12, height: 0 }}
                                                    className="group relative p-3 rounded-xl border border-white/[0.05] hover:border-white/[0.09] transition-all"
                                                    style={{ background: 'rgba(255,255,255,0.02)' }}>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <div className="w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-black flex-shrink-0"
                                                            style={{ background: `${color}20`, color, border: `1px solid ${color}30` }}>
                                                            {stock.ticker.replace('.NS', '').slice(0, 3)}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-[11px] font-bold text-white leading-tight">{stock.ticker.replace('.NS', '')}</div>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <input type="number" min={1} max={90} value={stock.allocation}
                                                                onChange={e => updateAllocation(stock.ticker, parseInt(e.target.value || '0'))}
                                                                className="w-10 text-right text-[11px] font-bold bg-white/[0.04] border border-white/[0.06] rounded-md px-1 py-0.5 text-white outline-none focus:border-violet-500/40" />
                                                            <span className="text-slate-500 text-[10px]">%</span>
                                                            <button onClick={() => removeStock(stock.ticker)}
                                                                className="text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 ml-0.5">
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="relative h-1 rounded-full bg-white/[0.05] overflow-hidden">
                                                        <div className="h-full rounded-full transition-all duration-200"
                                                            style={{ width: `${stock.allocation}%`, background: `linear-gradient(90deg, ${color}90, ${color})` }} />
                                                        <input type="range" min={1} max={80} value={stock.allocation}
                                                            onChange={e => updateAllocation(stock.ticker, parseInt(e.target.value))}
                                                            className="absolute inset-0 w-full opacity-0 cursor-pointer" />
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </AnimatePresence>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Portfolio Health Score (left column, reference image right panel) ── */}
                    <div className="rounded-2xl border border-white/[0.06] p-4"
                        style={{ background: 'rgba(15,23,42,0.75)', backdropFilter: 'blur(20px)' }}>
                        <div className="flex items-center justify-between mb-3">
                            <SectionDivider title="Portfolio Health Score" />
                            {apiRisk?.data_source && (
                                <span className="text-[9px] text-slate-600 ml-2 flex-shrink-0">
                                    {apiRisk.data_source === 'historical' ? `${apiRisk.data_points ?? ''} days` : 'estimated'}
                                </span>
                            )}
                        </div>

                        {analysis ? (
                            <>
                                <div className="flex items-center gap-4">
                                    {/* Gauge */}
                                    <div className="relative w-28 h-28 flex-shrink-0">
                                        <svg className="w-full h-full -rotate-90" viewBox="0 0 112 112">
                                            <circle cx="56" cy="56" r="44" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
                                            <motion.circle cx="56" cy="56" r="44" fill="none"
                                                stroke={healthColor} strokeWidth="10" strokeLinecap="round"
                                                strokeDasharray={`${(healthScore / 100) * 276} 276`}
                                                initial={{ strokeDasharray: '0 276' }}
                                                animate={{ strokeDasharray: `${(healthScore / 100) * 276} 276` }}
                                                transition={{ duration: 1.1, ease: EASE_CURVE }}
                                                style={{ filter: `drop-shadow(0 0 10px ${healthColor}66)` }}
                                            />
                                        </svg>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <span className="text-2xl font-black tabular-nums" style={{ color: healthColor }}>{healthScore}</span>
                                            <span className="text-[9px] font-bold text-slate-500">/100</span>
                                            <span className="text-[10px] font-bold mt-0.5" style={{ color: healthColor }}>{healthLabel}</span>
                                        </div>
                                    </div>

                                    {/* Breakdown */}
                                    <div className="flex-1 space-y-1.5">
                                        {apiHealth?.breakdown && Object.entries(apiHealth.breakdown).map(([key, val]) => {
                                            const v = val as number;
                                            const bc = bdColor(v);
                                            return (
                                                <div key={key} className="flex items-center gap-2 text-[10px]">
                                                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: bc }} />
                                                    <span className="text-slate-400 capitalize flex-1">{key.replace(/_/g, ' ')}</span>
                                                    <span className="font-bold tabular-nums" style={{ color: bc }}>{Math.round(v)}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Summary */}
                                {apiHealth?.summary && (
                                    <div className="mt-3 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                                        <p className="text-[10px] text-slate-400 leading-relaxed">
                                            <span className="font-semibold" style={{ color: healthColor }}>
                                                {healthScore >= 75 ? '★' : healthScore >= 58 ? '!' : '⚠'} {healthLabel}
                                            </span>
                                            {' '}{apiHealth.summary}
                                        </p>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-8 text-slate-600">
                                <Shield className="w-8 h-8 mb-2 opacity-30" />
                                <p className="text-[11px]">Run analysis to compute health score</p>
                            </div>
                        )}
                    </div>

                    {/* ── AI Insights (reference image right column) ── */}
                    <div className="rounded-2xl border border-white/[0.06] p-4"
                        style={{ background: 'rgba(15,23,42,0.75)', backdropFilter: 'blur(20px)' }}>
                        <div className="flex items-center justify-between mb-3">
                            <SectionDivider title="AI Insights" />
                            {apiInsights.length > 0 && (
                                <span className="text-[9px] text-violet-400 font-bold ml-2 flex-shrink-0">View All</span>
                            )}
                        </div>
                        {apiInsights.length > 0 ? (
                            <div className="space-y-2.5">
                                {apiInsights.map((insight, idx) => {
                                    const ts = toneStyle(insight.tone);
                                    return (
                                        <motion.div key={idx}
                                            initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: idx * 0.08 }}
                                            className="flex gap-3 p-3 rounded-xl border"
                                            style={{ background: ts.bg, borderColor: ts.border }}>
                                            <div className="w-5 h-5 rounded-full flex-shrink-0 mt-0.5 flex items-center justify-center"
                                                style={{ background: `${ts.dot}20` }}>
                                                <div className="w-2 h-2 rounded-full" style={{ background: ts.dot }} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className={`text-[11px] font-bold mb-0.5 ${ts.label}`}>{insight.title}</div>
                                                <p className="text-[10px] text-slate-400 leading-relaxed">{insight.body}</p>
                                                <button className={`mt-1 text-[9px] font-semibold ${ts.label}`}>
                                                    View Recommendation →
                                                </button>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-6 text-slate-600">
                                <Sparkles className="w-7 h-7 mb-2 opacity-30" />
                                <p className="text-[11px]">Run analysis to generate AI insights</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── RIGHT COLUMN: Full dashboard panels ── */}
                <div className="space-y-5">

                    {/* ── Row 1: Portfolio Performance Chart + Health Breakdown ── */}
                    <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-4">

                        {/* Portfolio Performance / Allocation Chart */}
                        <div className="rounded-2xl border border-white/[0.06] p-5"
                            style={{ background: 'rgba(15,23,42,0.75)', backdropFilter: 'blur(20px)' }}>
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <div className="text-sm font-black text-white flex items-center gap-2">
                                        Portfolio Performance
                                        <Info className="w-3.5 h-3.5 text-slate-600" />
                                    </div>
                                    <div className="mt-0.5 flex items-center gap-2">
                                        <span className="text-lg font-black text-white tabular-nums">
                                            ₹{(totalValue / 100000).toFixed(2)}L
                                        </span>
                                        {analysis && (
                                            <span className={`text-[11px] font-bold flex items-center gap-0.5 ${totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {totalPnl >= 0 ? '▲' : '▼'} {Math.abs(totalPnlPct).toFixed(2)}% (All Time)
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 text-[9px]">
                                    {['1D', '1W', '1M', '3M', '6M', '1Y', 'All'].map(r => (
                                        <span key={r} className={`px-2 py-1 rounded-lg font-bold ${r === 'All' ? 'bg-violet-600 text-white' : 'text-slate-500 hover:text-slate-300 cursor-pointer'}`}>
                                            {r}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Allocation donut + sector bars */}
                            <div className="flex gap-6 items-center">
                                <div className="relative h-[200px] w-[200px] flex-shrink-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={analysis ? sectorPieData : allocationPieData}
                                                dataKey="value" cx="50%" cy="50%"
                                                outerRadius={88} innerRadius={48} paddingAngle={2} strokeWidth={0}>
                                                {(analysis ? sectorPieData : allocationPieData).map((entry, i) => (
                                                    <Cell key={i} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip contentStyle={{ background: 'rgba(10,13,25,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, fontSize: 11 }}
                                                formatter={(v: any) => [`${Number(v).toFixed(1)}%`, analysis ? 'Sector' : 'Allocation']} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                        <div className="text-xs font-black text-white">₹{(totalValue / 100000).toFixed(1)}L</div>
                                        <div className="text-[9px] text-slate-500">Total</div>
                                    </div>
                                </div>

                                {/* Legend */}
                                <div className="flex-1 space-y-1.5">
                                    {(analysis ? sectorPieData : allocationPieData).map((entry, i) => (
                                        <div key={i} className="flex items-center justify-between text-[11px]">
                                            <div className="flex items-center gap-2">
                                                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: entry.color }} />
                                                <span className="text-slate-300">{entry.name}</span>
                                            </div>
                                            <span className="font-bold tabular-nums text-white">{entry.value.toFixed(1)}%</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {analysis && (
                                <div className="mt-3 px-3 py-2 rounded-lg bg-emerald-500/8 border border-emerald-500/15 text-[10px] text-emerald-300 font-semibold">
                                    {analysis.sector_bias
                                        ? `${String((analysis.sector_bias as any).bias ?? 'balanced')} portfolio tilt · ${String((analysis.sector_bias as any).recommendation ?? '')}`
                                        : 'Portfolio analysis complete — all metrics from FastAPI engine.'}
                                </div>
                            )}
                        </div>

                        {/* Sector + Risk analysis mini cards */}
                        <div className="space-y-4">

                            {/* Sector Allocation */}
                            <div className="rounded-2xl border border-white/[0.06] p-4"
                                style={{ background: 'rgba(15,23,42,0.75)', backdropFilter: 'blur(20px)' }}>
                                <div className="flex items-center justify-between mb-3">
                                    <div className="text-[11px] font-black text-white flex items-center gap-1.5">
                                        Sector Allocation <Info className="w-3 h-3 text-slate-600" />
                                    </div>
                                    <span className="text-[9px] text-violet-400 font-bold">View All</span>
                                </div>
                                {apiSectors.length > 0 ? (
                                    <div className="space-y-2">
                                        {apiSectors.slice(0, 5).map((s, i) => (
                                            <div key={s.sector} className="flex items-center gap-2">
                                                <span className="text-[10px] text-slate-400 w-20 flex-shrink-0 truncate">{s.sector}</span>
                                                <div className="flex-1 h-2 rounded-full bg-white/[0.05] overflow-hidden">
                                                    <motion.div className="h-full rounded-full"
                                                        style={{ background: SECTOR_COLORS[s.sector] ?? PIE_COLORS[i % PIE_COLORS.length] }}
                                                        initial={{ width: 0 }} animate={{ width: `${s.weight_pct}%` }}
                                                        transition={{ duration: 0.8, delay: i * 0.05, ease: EASE_CURVE }} />
                                                </div>
                                                <span className="text-[10px] font-bold text-white tabular-nums w-9 text-right">{s.weight_pct.toFixed(1)}%</span>
                                            </div>
                                        ))}
                                        {apiSectors.length > 5 && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-slate-600 w-20">Others</span>
                                                <div className="flex-1 h-2 rounded-full bg-white/[0.05] overflow-hidden">
                                                    <div className="h-full rounded-full bg-slate-600"
                                                        style={{ width: `${apiSectors.slice(5).reduce((s, x) => s + x.weight_pct, 0).toFixed(1)}%` }} />
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-500 tabular-nums w-9 text-right">
                                                    {apiSectors.slice(5).reduce((s, x) => s + x.weight_pct, 0).toFixed(1)}%
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    // Pre-analysis: show allocation weights
                                    <div className="space-y-2">
                                        {stocks.slice(0, 5).map((s, i) => (
                                            <div key={s.ticker} className="flex items-center gap-2">
                                                <span className="text-[10px] text-slate-400 w-20 flex-shrink-0 truncate">{s.ticker.replace('.NS', '')}</span>
                                                <div className="flex-1 h-2 rounded-full bg-white/[0.05] overflow-hidden">
                                                    <div className="h-full rounded-full transition-all duration-300"
                                                        style={{ width: `${s.allocation}%`, background: PIE_COLORS[i % PIE_COLORS.length] }} />
                                                </div>
                                                <span className="text-[10px] font-bold text-white tabular-nums w-9 text-right">{s.allocation}%</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Risk Analysis */}
                            <div className="rounded-2xl border border-white/[0.06] p-4"
                                style={{ background: 'rgba(15,23,42,0.75)', backdropFilter: 'blur(20px)' }}>
                                <div className="flex items-center gap-1.5 mb-3">
                                    <span className="text-[11px] font-black text-white">Risk Analysis</span>
                                    <Info className="w-3 h-3 text-slate-600" />
                                </div>
                                {analysis ? (
                                    <>
                                        <div className="flex items-center gap-4 mb-3">
                                            {/* Mini risk gauge */}
                                            <div className="relative w-20 h-20 flex-shrink-0">
                                                <svg className="w-full h-full" viewBox="0 0 80 80">
                                                    {/* Background arc */}
                                                    <path d="M 10 60 A 30 30 0 0 1 70 60" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" strokeLinecap="round" />
                                                    {/* Colored arc based on risk */}
                                                    <motion.path d="M 10 60 A 30 30 0 0 1 70 60" fill="none"
                                                        stroke={riskColor} strokeWidth="8" strokeLinecap="round"
                                                        strokeDasharray={`${Math.min((apiRisk?.volatility_pct ?? 0) / 40, 1) * 94} 94`}
                                                        initial={{ strokeDasharray: '0 94' }}
                                                        animate={{ strokeDasharray: `${Math.min((apiRisk?.volatility_pct ?? 0) / 40, 1) * 94} 94` }}
                                                        transition={{ duration: 0.9, ease: EASE_CURVE }}
                                                        style={{ filter: `drop-shadow(0 0 6px ${riskColor}66)` }}
                                                    />
                                                </svg>
                                                <div className="absolute inset-0 flex items-end justify-center pb-2">
                                                    <div className="text-center">
                                                        <div className="text-[11px] font-black" style={{ color: riskColor }}>{riskLvl}</div>
                                                        <div className="text-[8px] text-slate-500">Risk Level</div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex-1 space-y-1.5">
                                                {[
                                                    { label: 'Volatility (1Y)', value: `${(apiRisk?.volatility_pct ?? 0).toFixed(2)}%` },
                                                    { label: 'Sharpe Ratio', value: (apiRisk?.sharpe_ratio ?? 0).toFixed(2) },
                                                    { label: 'Max Drawdown', value: `${(apiRisk?.max_drawdown_pct ?? 0).toFixed(2)}%` },
                                                    { label: 'Beta', value: (apiRisk?.beta ?? 1).toFixed(2) },
                                                ].map(m => (
                                                    <div key={m.label} className="flex justify-between text-[10px]">
                                                        <span className="text-slate-500">{m.label}</span>
                                                        <span className="font-bold text-white tabular-nums">{m.value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-6 text-slate-600">
                                        <Activity className="w-7 h-7 mb-2 opacity-30" />
                                        <p className="text-[10px]">Run analysis</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── Row 2: Top Holdings table + right sidebar ── */}
                    <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-4">

                        {/* Top Holdings Table */}
                        <div className="rounded-2xl border border-white/[0.06] overflow-hidden"
                            style={{ background: 'rgba(15,23,42,0.75)', backdropFilter: 'blur(20px)' }}>
                            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05]">
                                <div className="text-sm font-black text-white flex items-center gap-2">
                                    Top Holdings <Info className="w-3.5 h-3.5 text-slate-600" />
                                </div>
                                <button className="text-[11px] text-violet-400 font-bold hover:text-violet-300 transition-colors">View All Holdings</button>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-[11px] min-w-[560px]">
                                    <thead>
                                        <tr className="border-b border-white/[0.04] bg-white/[0.01]">
                                            {['Stock', 'Sector', 'Qty.', 'Avg. Price', 'Current Price', 'Value', 'P/L (₹)', 'P/L (%)', 'Allocation'].map(h => (
                                                <th key={h} className="px-4 py-2.5 text-left text-[9px] font-bold uppercase tracking-[0.1em] text-slate-500">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/[0.03]">
                                        {(analysis ? analysis.holdings : stocks.map((s, i) => ({
                                            ticker: s.ticker,
                                            name: s.name,
                                            sector: SUGGESTED_STOCKS.find(sg => sg.ticker === s.ticker)?.sector ?? 'Other',
                                            quantity: 1,
                                            avg_buy_price: s.allocation * 1000,
                                            current_price: s.allocation * 1000,
                                            invested: s.allocation * 1000,
                                            value: s.allocation * 1000,
                                            pnl: 0,
                                            pnl_pct: 0,
                                            allocation: s.allocation,
                                        }))).map((h, i) => {
                                            const sc = SECTOR_COLORS[h.sector] ?? PIE_COLORS[i % PIE_COLORS.length];
                                            const pnlPos = h.pnl >= 0;
                                            return (
                                                <motion.tr key={h.ticker}
                                                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                                    transition={{ delay: i * 0.04 }}
                                                    className="hover:bg-white/[0.02] transition-colors">
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[9px] font-black flex-shrink-0"
                                                                style={{ background: `${sc}18`, color: sc, border: `1px solid ${sc}30` }}>
                                                                {h.ticker.replace('.NS', '').slice(0, 3)}
                                                            </div>
                                                            <div>
                                                                <div className="font-bold text-white">{h.name}</div>
                                                                <div className="text-[9px] text-slate-500">{h.ticker.replace('.NS', '')}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-400">{h.sector}</td>
                                                    <td className="px-4 py-3 font-semibold text-white tabular-nums">{h.quantity}</td>
                                                    <td className="px-4 py-3 font-semibold text-white tabular-nums">₹{(h.avg_buy_price).toLocaleString('en-IN')}</td>
                                                    <td className="px-4 py-3 font-semibold text-white tabular-nums">₹{(h.current_price).toLocaleString('en-IN')}</td>
                                                    <td className="px-4 py-3 font-bold text-white tabular-nums">₹{Math.round(h.value / 1000)}K</td>
                                                    <td className={`px-4 py-3 font-bold tabular-nums ${pnlPos ? 'text-emerald-400' : 'text-red-400'}`}>
                                                        {pnlPos ? '+' : ''}₹{Math.abs(Math.round(h.pnl)).toLocaleString('en-IN')}
                                                    </td>
                                                    <td className={`px-4 py-3 font-bold tabular-nums ${pnlPos ? 'text-emerald-400' : 'text-red-400'}`}>
                                                        {pnlPos ? '+' : ''}{h.pnl_pct.toFixed(2)}%
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-12 h-1 rounded-full bg-white/[0.06] overflow-hidden flex-shrink-0">
                                                                <motion.div className="h-full rounded-full bg-violet-500"
                                                                    initial={{ width: 0 }} animate={{ width: `${Math.min(h.allocation, 100)}%` }}
                                                                    transition={{ duration: 0.7, ease: EASE_CURVE }} />
                                                            </div>
                                                            <span className="text-white font-bold tabular-nums">{h.allocation.toFixed(1)}%</span>
                                                        </div>
                                                    </td>
                                                </motion.tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {!analysis && (
                                <div className="px-4 py-2 border-t border-white/[0.04]">
                                    <p className="text-[9px] text-slate-600">Prices delayed 15 mins · Run analysis for real analytics</p>
                                </div>
                            )}
                        </div>

                        {/* Right mini panels: Upcoming Events + Rebalancing */}
                        <div className="space-y-4">

                            {/* Upcoming Events */}
                            <div className="rounded-2xl border border-white/[0.06] p-4"
                                style={{ background: 'rgba(15,23,42,0.75)', backdropFilter: 'blur(20px)' }}>
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-[11px] font-black text-white">Upcoming Events</span>
                                    <span className="text-[9px] text-violet-400 font-bold">View All</span>
                                </div>
                                <div className="space-y-2.5">
                                    {stocks.slice(0, 3).map((s, i) => {
                                        const sc = SECTOR_COLORS[SUGGESTED_STOCKS.find(sg => sg.ticker === s.ticker)?.sector ?? ''] ?? PIE_COLORS[i];
                                        const events = ['Earnings', 'Dividend', 'Board Meeting'];
                                        const dates = ['Jul 19, 2026', 'Jul 24, 2026', 'Jul 31, 2026'];
                                        return (
                                            <div key={s.ticker} className="flex items-center gap-3 p-2.5 rounded-xl border border-white/[0.04]"
                                                style={{ background: 'rgba(255,255,255,0.02)' }}>
                                                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[9px] font-black flex-shrink-0 text-white"
                                                    style={{ background: sc }}>
                                                    {s.ticker.replace('.NS', '').slice(0, 3)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-[11px] font-bold text-white">{s.name.split(' ')[0]}</div>
                                                    <div className="text-[9px] text-slate-500">{events[i]}</div>
                                                </div>
                                                <div className="text-[9px] font-semibold text-slate-500 text-right">{dates[i]}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Rebalancing Suggestion */}
                            <div className="rounded-2xl border border-white/[0.06] p-4"
                                style={{ background: 'rgba(15,23,42,0.75)', backdropFilter: 'blur(20px)' }}>
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-[11px] font-black text-white">Rebalancing Suggestion</span>
                                    <button className="text-[9px] text-violet-400 font-bold">View Details</button>
                                </div>
                                {analysis && apiRebalance.length > 0 ? (
                                    <>
                                        <p className="text-[10px] text-slate-400 mb-2">Your portfolio can be better balanced.</p>
                                        <div className="space-y-2 mb-3">
                                            {apiRebalance.slice(0, 2).map((r, i) => {
                                                const actionColor = r.action === 'trim' ? '#ef4444' : r.action === 'add' ? '#22c55e' : '#6366f1';
                                                return (
                                                    <div key={i} className="flex items-start gap-2 text-[10px]">
                                                        <span className="font-bold mt-0.5 flex-shrink-0" style={{ color: actionColor }}>
                                                            {r.action === 'trim' ? '↓' : r.action === 'add' ? '↑' : '→'}
                                                        </span>
                                                        <span className="text-slate-400 leading-relaxed">{r.reason}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="flex items-center gap-1 mb-3 text-[10px]">
                                            <span className="text-emerald-400 font-bold">▲ Potential Improvement</span>
                                        </div>
                                        <button className="w-full py-2 rounded-xl text-[11px] font-bold text-white"
                                            style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
                                            View Rebalance Plan
                                        </button>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-5 text-slate-600">
                                        <Target className="w-7 h-7 mb-2 opacity-30" />
                                        <p className="text-[10px] text-center">
                                            {analysis ? 'Portfolio is well balanced' : 'Run analysis for rebalancing suggestions'}
                                        </p>
                                        {analysis && apiRebalance.length === 0 && (
                                            <div className="mt-2 flex items-center gap-1.5 text-emerald-400 text-[10px] font-semibold">
                                                <Check className="w-3 h-3" /> No rebalancing needed
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── Row 3: Full Risk Metrics + Diversification ── */}
                    {analysis && (
                        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, ease: EASE_CURVE }}
                            className="grid grid-cols-1 xl:grid-cols-3 gap-4">

                            {/* VaR + Risk Metrics */}
                            <div className="rounded-2xl border border-white/[0.06] p-4"
                                style={{ background: 'rgba(15,23,42,0.75)', backdropFilter: 'blur(20px)' }}>
                                <SectionDivider title="Risk Analytics" accent="#ef4444" />
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { label: 'Volatility', value: `${(apiRisk?.volatility_pct ?? 0).toFixed(1)}%`, color: '#f59e0b' },
                                        { label: 'Sharpe', value: (apiRisk?.sharpe_ratio ?? 0).toFixed(2), color: (apiRisk?.sharpe_ratio ?? 0) >= 1 ? '#22c55e' : '#f59e0b' },
                                        { label: 'Sortino', value: (apiRisk?.sortino_ratio ?? 0).toFixed(2), color: '#6366f1' },
                                        { label: 'Beta', value: (apiRisk?.beta ?? 1).toFixed(2), color: '#94a3b8' },
                                        { label: 'VaR 95%', value: `${Math.abs((apiRisk?.var_95 ?? 0) * 100).toFixed(2)}%`, color: '#ef4444' },
                                        { label: 'VaR 99%', value: `${Math.abs((apiRisk?.var_99 ?? 0) * 100).toFixed(2)}%`, color: '#f97316' },
                                        { label: 'Max Drawdown', value: `${Math.abs(apiRisk?.max_drawdown_pct ?? 0).toFixed(1)}%`, color: '#ef4444' },
                                        { label: 'CAGR', value: `${(apiRisk?.cagr ?? 0).toFixed(1)}%`, color: (apiRisk?.cagr ?? 0) >= 0 ? '#22c55e' : '#ef4444' },
                                    ].map(m => (
                                        <div key={m.label} className="p-2.5 rounded-xl border border-white/[0.04]"
                                            style={{ background: 'rgba(255,255,255,0.02)' }}>
                                            <div className="text-[9px] text-slate-500 mb-0.5">{m.label}</div>
                                            <div className="text-[14px] font-black tabular-nums" style={{ color: m.color }}>{m.value}</div>
                                        </div>
                                    ))}
                                </div>
                                {(apiRisk?.risk_level?.factors?.length ?? 0) > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1">
                                        {apiRisk!.risk_level.factors.slice(0, 3).map((f, i) => (
                                            <span key={i} className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                                {f}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Diversification + Concentration */}
                            <div className="rounded-2xl border border-white/[0.06] p-4"
                                style={{ background: 'rgba(15,23,42,0.75)', backdropFilter: 'blur(20px)' }}>
                                <SectionDivider title="Diversification" accent="#6366f1" />
                                <div className="space-y-3">
                                    <div>
                                        <div className="flex justify-between text-[10px] font-bold mb-1">
                                            <span className="text-slate-400">Diversification Score</span>
                                            <span className="text-violet-400">{Math.round(apiDivScore)}/100</span>
                                        </div>
                                        <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
                                            <motion.div className="h-full rounded-full"
                                                style={{ background: apiDivScore >= 60 ? '#22c55e' : apiDivScore >= 35 ? '#f59e0b' : '#ef4444' }}
                                                initial={{ width: 0 }} animate={{ width: `${apiDivScore}%` }}
                                                transition={{ duration: 1, ease: EASE_CURVE }} />
                                        </div>
                                    </div>
                                    {apiConc && (
                                        <div className="space-y-2 text-[10px]">
                                            {[
                                                { label: 'HHI Score', value: String((apiConc as any).hhi ?? '—') },
                                                { label: 'Effective Stocks', value: String((apiConc as any).effective_stocks ?? '—') },
                                                { label: 'Top Holding', value: `${String((apiConc as any).top_holding_pct ?? '—')}%` },
                                                { label: 'Top 3 Holdings', value: `${String((apiConc as any).top3_holding_pct ?? '—')}%` },
                                                { label: 'Concentration', value: String((apiConc as any).concentration_level ?? '—') },
                                            ].map(m => (
                                                <div key={m.label} className="flex justify-between">
                                                    <span className="text-slate-500">{m.label}</span>
                                                    <span className="font-bold text-white tabular-nums">{m.value}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {apiSectorBias && (
                                        <div className="pt-2 border-t border-white/[0.05]">
                                            <div className="text-[9px] text-slate-600 mb-1.5">Exposure Breakdown</div>
                                            {[
                                                { label: 'Aggressive', val: Number((apiSectorBias as any).aggressive_weight ?? 0), color: '#ef4444' },
                                                { label: 'Defensive', val: Number((apiSectorBias as any).defensive_weight ?? 0), color: '#22c55e' },
                                                { label: 'Neutral', val: Number((apiSectorBias as any).neutral_weight ?? 0), color: '#6366f1' },
                                            ].map(item => (
                                                <div key={item.label} className="mb-1.5">
                                                    <div className="flex justify-between text-[9px] mb-0.5">
                                                        <span className="text-slate-500">{item.label}</span>
                                                        <span style={{ color: item.color }} className="font-bold">{item.val.toFixed(1)}%</span>
                                                    </div>
                                                    <div className="h-1 rounded-full bg-white/[0.05] overflow-hidden">
                                                        <motion.div className="h-full rounded-full" style={{ background: item.color }}
                                                            initial={{ width: 0 }} animate={{ width: `${item.val}%` }}
                                                            transition={{ duration: 0.8, ease: EASE_CURVE }} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Rebalancing full list */}
                            <div className="rounded-2xl border border-white/[0.06] p-4"
                                style={{ background: 'rgba(15,23,42,0.75)', backdropFilter: 'blur(20px)' }}>
                                <SectionDivider title="Rebalance Actions" accent="#22c55e" />
                                {apiRebalance.length > 0 ? (
                                    <div className="space-y-2">
                                        {apiRebalance.slice(0, 5).map((r, i) => {
                                            const actionStyle = {
                                                trim: { icon: '↓', bg: '#ef444415', text: '#ef4444', border: '#ef444430' },
                                                add: { icon: '↑', bg: '#22c55e15', text: '#22c55e', border: '#22c55e30' },
                                                introduce: { icon: '+', bg: '#3b82f615', text: '#3b82f6', border: '#3b82f630' },
                                                remove: { icon: '×', bg: '#f59e0b15', text: '#f59e0b', border: '#f59e0b30' },
                                            }[r.action] ?? { icon: '→', bg: 'rgba(255,255,255,0.02)', text: '#64748b', border: 'rgba(255,255,255,0.06)' };
                                            return (
                                                <motion.div key={i}
                                                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: i * 0.06 }}
                                                    className="flex gap-2.5 p-2.5 rounded-xl border"
                                                    style={{ background: actionStyle.bg, borderColor: actionStyle.border }}>
                                                    <div className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black flex-shrink-0"
                                                        style={{ color: actionStyle.text }}>{actionStyle.icon}</div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span className="text-[11px] font-bold text-white">{r.ticker}</span>
                                                            <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold border ${r.priority === 'high' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                                                r.priority === 'medium' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                                                    'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                                                                {r.priority}
                                                            </span>
                                                            {r.current_pct > 0 && (
                                                                <span className="text-[8px] text-slate-500 ml-auto tabular-nums">
                                                                    {r.current_pct.toFixed(0)}% → {r.target_pct.toFixed(0)}%
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-[9px] text-slate-500 leading-relaxed mt-0.5 line-clamp-2">{r.reason}</p>
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/8 border border-emerald-500/15">
                                        <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                                        <div>
                                            <div className="text-[11px] font-bold text-emerald-400">Well Balanced</div>
                                            <div className="text-[9px] text-slate-500">No rebalancing needed right now.</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* Pre-analysis placeholder */}
                    {!analysis && !loading && stocks.length >= 2 && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className="rounded-2xl border border-dashed border-violet-500/20 p-8 text-center"
                            style={{ background: 'rgba(99,102,241,0.03)' }}>
                            <Zap className="w-10 h-10 mx-auto mb-3 text-violet-400 opacity-50" />
                            <h3 className="text-sm font-bold text-white mb-1">Ready to analyze</h3>
                            <p className="text-[12px] text-slate-500 max-w-sm mx-auto mb-4">
                                {stocks.length} stocks added with {totalAllocation}% allocation.
                                {totalAllocation === 100 ? ' Click "Run Analysis" to generate the full dashboard.' : ` Adjust to reach 100% then click "Run Analysis".`}
                            </p>
                            {totalAllocation === 100 && (
                                <motion.button onClick={runAnalysis}
                                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                    className="px-6 py-2.5 rounded-xl text-sm font-bold text-white"
                                    style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
                                    <Zap className="w-4 h-4 inline mr-1.5" /> Run Analysis Now
                                </motion.button>
                            )}
                        </motion.div>
                    )}
                </div>
            </div>
        </motion.div>
    );
}


// ─────────────────────────────────────────────────────────────────────────────
// ManualHolding type (local form data only — not the FastAPI response)
// ─────────────────────────────────────────────────────────────────────────────
type ManualHolding = {
    id: string;
    ticker: string;
    name: string;
    quantity: number;
    avgBuyPrice: number;
    currentPrice: number;
    sector: string;
};

// Local P&L stats (used only for form-side display before API response)
type LocalHoldingStats = ManualHolding & {
    invested: number;
    value: number;
    pnl: number;
    pnlPct: number;
    allocation: number;
};

const DEFAULT_HOLDINGS: ManualHolding[] = [];

// ─────────────────────────────────────────────────────────────────────────────
// Screen 4 — Manual Portfolio Builder (Holdings Analysis)
// BUG FIXES:
//  1. apiResponse state stores FastAPI HoldingsAnalysis — no longer discarded
//  2. health/insights/sectorData all read from apiResponse, not local math
//  3. Removed fake dailyPnl drift array — now shows actual total P&L only
//  4. chartData removed (was entirely fabricated) — replaced with real data
//  5. Added console.log for response tracing
// ─────────────────────────────────────────────────────────────────────────────
function ManualPortfolioBuilderScreen({ onBack, onRestart }: { onBack: () => void; onRestart: () => void }) {
    const [holdings, setHoldings] = useState<ManualHolding[]>(DEFAULT_HOLDINGS);
    const [apiResponse, setApiResponse] = useState<HoldingsAnalysis | null>(null);  // FIX: store response
    const [form, setForm] = useState({ ticker: '', name: '', quantity: '', avgBuyPrice: '', currentPrice: '', sector: '' });
    const [editingId, setEditingId] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [activeStockIndex, setActiveStockIndex] = useState(0);
    const [stockSearchLoading, setStockSearchLoading] = useState(false);
    const [fetchingQuote, setFetchingQuote] = useState(false);
    const [sectorQuery, setSectorQuery] = useState('');
    const [sectorDropdownOpen, setSectorDropdownOpen] = useState(false);
    const [activeSectorIndex, setActiveSectorIndex] = useState(0);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [messageIndex, setMessageIndex] = useState(0);
    const [sortBy, setSortBy] = useState<'value' | 'pnl' | 'allocation' | 'ticker'>('value');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [apiError, setApiError] = useState<string | null>(null);
    const searchRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) setDropdownOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => {
        if (!isAnalyzing) return;
        const id = window.setInterval(() => setMessageIndex(c => (c + 1) % MANUAL_AI_MESSAGES.length), 750);
        return () => window.clearInterval(id);
    }, [isAnalyzing]);

    useEffect(() => {
        if (!dropdownOpen) return;
        setStockSearchLoading(true);
        const id = window.setTimeout(() => setStockSearchLoading(false), 180);
        return () => window.clearTimeout(id);
    }, [query, dropdownOpen]);

    const curatedStocks = useMemo(
        () => SUGGESTED_STOCKS.map(s => ({ ...s, ticker: cleanTicker(s.ticker) })),
        []
    );
    const filteredStocks = curatedStocks.filter(s => {
        const n = query.trim().toLowerCase();
        if (!n) return true;
        return s.ticker.toLowerCase().includes(n) || s.name.toLowerCase().includes(n);
    });
    const visibleStocks = filteredStocks.slice(0, 10);
    const filteredSectors = SECTOR_META.filter(item => {
        const n = sectorQuery.trim().toLowerCase();
        if (!n) return true;
        return item.sector.toLowerCase().includes(n) || item.group.toLowerCase().includes(n);
    });

    const highlightedMatch = (value: string, needle: string) => {
        const cn = needle.trim();
        if (!cn) return value;
        const idx = value.toLowerCase().indexOf(cn.toLowerCase());
        if (idx < 0) return value;
        return <>{value.slice(0, idx)}<mark className="rounded bg-violet-500/15 px-0.5 text-violet-700 dark:text-violet-200">{value.slice(idx, idx + cn.length)}</mark>{value.slice(idx + cn.length)}</>;
    };

    const selectStock = async (stock: { ticker: string; name: string; sector: string }) => {
        setForm(c => ({ ...c, ticker: stock.ticker, name: stock.name, sector: stock.sector, currentPrice: '' }));
        setQuery(`${stock.name} (${stock.ticker})`);
        setSectorQuery(stock.sector);
        setDropdownOpen(false);

        // Auto-fetch current price from FastAPI
        setFetchingQuote(true);
        try {
            const symbol = stock.ticker.includes('.NS') ? stock.ticker : `${stock.ticker}.NS`;
            console.log('[ManualBuilder] Fetching quote for:', symbol);
            const quoteRes = await marketApi.getQuote(symbol);
            console.log('[ManualBuilder] Quote response:', quoteRes);
            if (quoteRes.data?.price) {
                setForm(c => ({ ...c, currentPrice: String(Math.round(quoteRes.data.price! * 100) / 100) }));
            }
            // If API returns sector info, prefer it over local lookup
            if (quoteRes.data?.sector) {
                setForm(c => ({ ...c, sector: quoteRes.data.sector! }));
                setSectorQuery(quoteRes.data.sector!);
            }
        } catch (err) {
            console.warn('[ManualBuilder] Quote fetch failed, user can enter manually:', err);
        } finally {
            setFetchingQuote(false);
        }
    };
    const chooseActiveStock = () => {
        const s = visibleStocks[Math.min(activeStockIndex, visibleStocks.length - 1)];
        if (s) selectStock(s);
    };
    const chooseSector = (sector: string) => {
        setForm(c => ({ ...c, sector }));
        setSectorQuery(sector);
        setSectorDropdownOpen(false);
    };

    // Local stats — used ONLY for the left-side holding cards (form display)
    // NOT used for analytics. Analytics come exclusively from apiResponse.
    const localStats = useMemo<LocalHoldingStats[]>(() => {
        const raw = holdings.map(h => {
            const invested = h.quantity * h.avgBuyPrice;
            const value = h.quantity * h.currentPrice;
            const pnl = value - invested;
            return { ...h, invested, value, pnl, pnlPct: invested ? (pnl / invested) * 100 : 0, allocation: 0 };
        });
        const total = raw.reduce((s, h) => s + h.value, 0);
        return raw.map(h => ({ ...h, allocation: total ? (h.value / total) * 100 : 0 }));
    }, [holdings]);

    // Simple P&L totals for left-side display (no fake dailyPnl)
    const localTotals = useMemo(() => {
        const invested = localStats.reduce((s, h) => s + h.invested, 0);
        const value = localStats.reduce((s, h) => s + h.value, 0);
        const pnl = value - invested;
        return { invested, value, pnl, pnlPct: invested ? (pnl / invested) * 100 : 0 };
    }, [localStats]);

    // ── ALL ANALYTICS FROM FASTAPI RESPONSE ──────────────────────────────────
    // BUG FIX: these no longer use local math — they read exclusively from apiResponse

    const apiHealth = apiResponse?.health;
    const apiInsights = apiResponse?.insights ?? [];
    const apiRisk = apiResponse?.risk;
    const apiSectors = apiResponse?.sector_exposure ?? [];
    const apiSectorBias = apiResponse?.sector_bias;
    const apiConc = apiResponse?.concentration;
    const apiDivScore = apiResponse?.diversification_score ?? 0;
    const apiRebalance = apiResponse?.rebalance_suggestions ?? [];
    const apiHoldings = apiResponse?.holdings ?? [];  // enriched from FastAPI
    const apiTotals = apiResponse?.totals;

    // Derived display values from API — with safe fallbacks for pre-analysis state
    const healthScore = apiHealth?.score ?? 0;
    const healthLabel = apiHealth?.label ?? '—';
    const healthColor = apiHealth?.color ?? '#64748b';
    const riskLevel = apiRisk?.risk_level?.level ?? '—';
    const riskColor = riskLevel === 'Low' ? '#22c55e' : riskLevel === 'Moderate' ? '#f59e0b' : riskLevel === 'Elevated' ? '#f97316' : '#ef4444';

    // Sector pie data from API
    const sectorPieData = useMemo(() =>
        apiSectors.map((s, idx) => ({
            name: s.sector, value: s.weight_pct,
            color: SECTOR_COLORS[s.sector] ?? PIE_COLORS[idx % PIE_COLORS.length],
        })), [apiSectors]);

    // Holdings table — use API enriched holdings if available, else local
    const displayStats = apiResponse
        ? apiHoldings.map(h => ({
            id: h.ticker,
            ticker: h.ticker,
            name: h.name,
            sector: h.sector,
            quantity: h.quantity,
            avgBuyPrice: h.avg_buy_price,
            currentPrice: h.current_price,
            invested: h.invested,
            value: h.value,
            pnl: h.pnl,
            pnlPct: h.pnl_pct,
            allocation: h.allocation,
        }))
        : localStats;

    const sortedDisplayStats = useMemo(() => {
        const sign = sortDir === 'asc' ? 1 : -1;
        return [...displayStats].sort((a, b) => {
            if (sortBy === 'ticker') return a.ticker.localeCompare(b.ticker) * sign;
            return ((a as any)[sortBy] - (b as any)[sortBy]) * sign;
        });
    }, [displayStats, sortBy, sortDir]);

    const setSort = (key: typeof sortBy) => {
        if (sortBy === key) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); return; }
        setSortBy(key);
        setSortDir(key === 'ticker' ? 'asc' : 'desc');
    };

    // KPI cards derived from API totals (with fallback to local totals)
    const displayTotals = apiTotals ?? {
        total_value: localTotals.value,
        total_invested: localTotals.invested,
        total_pnl: localTotals.pnl,
        total_pnl_pct: localTotals.pnlPct,
        holding_count: holdings.length,
    };

    const topPerformer = displayStats.reduce<typeof displayStats[0] | null>((b, h) => (!b || h.pnlPct > b.pnlPct ? h : b), null);
    const worstPerformer = displayStats.reduce<typeof displayStats[0] | null>((b, h) => (!b || h.pnlPct < b.pnlPct ? h : b), null);
    const topHolding = displayStats.reduce<typeof displayStats[0] | null>((b, h) => (!b || h.allocation > b.allocation ? h : b), null);

    const diversificationStatus = apiDivScore >= 65 ? 'Well diversified' : apiDivScore >= 40 ? 'Moderate' : 'Needs work';
    const concentrationWarning = apiConc
        ? String(apiConc.concentration_level) === 'high'
            ? `${topHolding?.ticker ?? '?'} is above the 35% concentration guardrail.`
            : 'No single stock is dominating the book.'
        : 'Run analysis to check concentration.';
    const stabilityLabel = apiRisk
        ? (apiRisk.volatility_pct ?? 0) < 15 ? 'Stable' : (apiRisk.volatility_pct ?? 0) < 25 ? 'Watch' : 'Fragile'
        : '—';
    const riskMeterValue = apiHealth ? Math.max(8, Math.min(96, 100 - healthScore)) : 50;

    const rebalanceNotes: string[] = apiRebalance.length > 0
        ? apiRebalance.slice(0, 3).map(r => r.reason)
        : ['Run analysis to get rebalance suggestions.'];

    const exposureSummary = apiSectorBias ? [
        { label: 'Aggressive', value: Number((apiSectorBias as any).aggressive_weight ?? 0), color: '#ef4444' },
        { label: 'Defensive', value: Number((apiSectorBias as any).defensive_weight ?? 0), color: '#22c55e' },
        { label: 'Largest Stock', value: Number((apiConc as any)?.top_holding_pct ?? 0), color: '#8b5cf6' },
        { label: 'Largest Sector', value: Number((apiResponse?.sector_concentration as any)?.top_sector_pct ?? 0), color: '#f59e0b' },
    ] : [];

    const upcomingEvents = localStats.slice(0, 3).map((h, i) => ({
        stock: h.ticker,
        event: i === 0 ? 'Earnings' : i === 1 ? 'Dividend' : 'Board update',
        date: ['Jul 19, 2026', 'Jul 24, 2026', 'Jul 31, 2026'][i],
        color: SECTOR_COLORS[h.sector] ?? PIE_COLORS[i],
    }));

    // ── Run Analysis — FIX: store API response ───────────────────────────────
    const runAnalysis = async () => {
        console.log('[ManualBuilder] runAnalysis triggered, holdings:', holdings.length);
        if (!holdings.length || isAnalyzing) return;

        setMessageIndex(0);
        setIsAnalyzing(true);
        setApiResponse(null);  // FIX: clear old response
        setApiError(null);

        try {
            const apiHoldingsPayload = holdings.map(h => ({
                ticker: h.ticker.includes('.NS') ? h.ticker : `${h.ticker}.NS`,
                name: h.name,
                quantity: h.quantity,
                avg_buy_price: h.avgBuyPrice,
                current_price: h.currentPrice,
                sector: h.sector,
            }));

            console.log('[ManualBuilder] Sending to FastAPI:', apiHoldingsPayload);
            const res = await portfolioApi.analyzeHoldings(apiHoldingsPayload);

            // FIX: Log and STORE the response (previously it was discarded after logging)
            console.log('[ManualBuilder] FastAPI response received:', {
                success: res.success,
                health_score: res.health?.score,
                health_label: res.health?.label,
                risk_level: res.risk?.risk_level?.level,
                volatility_pct: res.risk?.volatility_pct,
                sharpe_ratio: res.risk?.sharpe_ratio,
                diversification_score: res.diversification_score,
                sector_count: res.sector_exposure?.length,
                rebalance_count: res.rebalance_suggestions?.length,
                insight_count: res.insights?.length,
                data_source: res.risk?.data_source,
            });

            setApiResponse(res);  // FIX: actually save the response to state
        } catch (err: any) {
            console.error('[ManualBuilder] FastAPI error:', err);
            setApiError(err.message || 'Failed to connect to FastAPI');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const dashboardVisible = apiResponse !== null && holdings.length > 0;

    // Form handlers
    const resetForm = () => {
        setForm({ ticker: '', name: '', quantity: '', avgBuyPrice: '', currentPrice: '', sector: '' });
        setQuery(''); setSectorQuery(''); setEditingId(null);
    };
    const submitHolding = (e: React.FormEvent) => {
        e.preventDefault();
        const quantity = Number(form.quantity);
        const avgBuyPrice = Number(form.avgBuyPrice);
        const currentPrice = Number(form.currentPrice);
        const ticker = cleanTicker(form.ticker || query);
        const name = form.name.trim() || ticker;
        const sector = form.sector.trim() || 'Other';
        if (!ticker || !quantity || !avgBuyPrice || !currentPrice) return;
        const next: ManualHolding = { id: editingId ?? `${ticker}-${Date.now()}`, ticker, name, quantity, avgBuyPrice, currentPrice, sector };
        setHoldings(c => editingId ? c.map(h => h.id === editingId ? next : h) : [...c, next]);
        setApiResponse(null);  // Invalidate API response when holdings change
        resetForm();
    };
    const editHolding = (h: ManualHolding) => {
        setEditingId(h.id);
        setForm({ ticker: h.ticker, name: h.name, quantity: String(h.quantity), avgBuyPrice: String(h.avgBuyPrice), currentPrice: String(h.currentPrice), sector: h.sector });
        setQuery(`${h.name} (${h.ticker})`);
        setSectorQuery(h.sector);
        setDropdownOpen(false);
    };
    const deleteHolding = (id: string) => {
        setHoldings(c => c.filter(h => h.id !== id));
        setApiResponse(null);  // Invalidate when holdings change
    };

    // ── Loading Screen ────────────────────────────────────────────────────────
    if (isAnalyzing) {
        return (
            <motion.div key="manual-ai-loading" variants={screenVariants} initial="enter" animate="center" exit="exit"
                className="relative min-h-[calc(100vh-120px)] overflow-hidden rounded-[28px] border border-slate-200/70 bg-slate-950 text-white shadow-2xl">
                <motion.div className="absolute inset-0"
                    style={{ background: 'linear-gradient(135deg, rgba(15,23,42,1), rgba(30,27,75,0.96) 45%, rgba(8,13,28,1))' }}
                    animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }} transition={{ duration: 6, repeat: Infinity, ease: 'linear' }} />
                <div className="absolute inset-0 opacity-50"
                    style={{ backgroundImage: 'linear-gradient(rgba(99,102,241,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.12) 1px, transparent 1px)', backgroundSize: '54px 54px' }} />
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
                        <motion.div className="h-full rounded-full bg-gradient-to-r from-violet-500 via-cyan-400 to-fuchsia-400"
                            initial={{ width: '8%' }} animate={{ width: '100%' }} transition={{ duration: 3.1, ease: EASE_CURVE }} />
                    </div>
                </div>
            </motion.div>
        );
    }

    // ── Main Screen ───────────────────────────────────────────────────────────
    return (
        <motion.div key="manual-builder-v2" variants={screenVariants} initial="enter" animate="center" exit="exit"
            className="space-y-6 pb-8 text-slate-950 dark:text-white">

            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                    <button onClick={onBack}
                        className="mt-1 rounded-xl border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:border-violet-300 hover:text-violet-600 dark:border-white/[0.06] dark:bg-white/[0.03] dark:text-slate-400 dark:hover:text-white">
                        <ArrowLeft className="h-4 w-4" />
                    </button>
                    <div>
                        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-violet-700 dark:text-violet-300">
                            <Briefcase className="h-3.5 w-3.5" /> Manual Portfolio Entry
                        </div>
                        <h1 className="text-2xl font-black tracking-tight">Portfolio Analyzer</h1>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Add holdings one-by-one, then generate investor-grade AI analytics via FastAPI.</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button onClick={onRestart}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 dark:border-white/[0.07] dark:bg-white/[0.03] dark:text-slate-300">
                        Restart
                    </button>
                    <motion.button onClick={runAnalysis} disabled={!holdings.length}
                        whileHover={holdings.length ? { scale: 1.02 } : {}} whileTap={holdings.length ? { scale: 0.98 } : {}}
                        className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-violet-500/25 transition disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-800"
                        style={holdings.length ? { background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' } : {}}>
                        <Zap className="h-4 w-4" /> Run AI Analysis
                    </motion.button>
                </div>
            </div>

            {/* API status banner */}
            {apiResponse && (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-400 font-semibold">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                    FastAPI analysis complete — Health: {healthScore}/100 ({healthLabel}) ·
                    Risk: {riskLevel} · Sharpe: {(apiRisk?.sharpe_ratio ?? 0).toFixed(2)} ·
                    Vol: {(apiRisk?.volatility_pct ?? 0).toFixed(1)}% ·
                    Source: {apiRisk?.data_source ?? 'estimated'}
                </motion.div>
            )}

            {apiError && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm font-medium text-red-600 dark:text-red-400">
                    <AlertTriangle className="mr-2 inline-block h-4 w-4" /> {apiError}
                    <p className="text-[10px] mt-1 text-red-400/70">Make sure FastAPI is running: uvicorn main:app --port 8000 --reload</p>
                </motion.div>
            )}

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[380px_1fr]">

                {/* LEFT — Add Holding Form */}
                <div className="space-y-5">
                    <form onSubmit={submitHolding}
                        className="relative rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-xl shadow-slate-200/60 backdrop-blur dark:border-white/[0.07] dark:bg-slate-950/70 dark:shadow-black/30">
                        <div className="mb-4 flex items-center justify-between">
                            <div>
                                <h2 className="text-sm font-black">Add Holding</h2>
                                <p className="text-[11px] text-slate-500">Select stock — price auto-fills from market data.</p>
                            </div>
                            {editingId && <button type="button" onClick={resetForm} className="text-[11px] font-semibold text-violet-600 dark:text-violet-300">Cancel edit</button>}
                        </div>

                        {/* Stock search */}
                        <div ref={searchRef} className="relative z-40 mb-3">
                            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Stock Name / Ticker</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input value={query}
                                    onChange={e => { setQuery(e.target.value); setForm(c => ({ ...c, ticker: e.target.value, name: e.target.value })); setDropdownOpen(true); setActiveStockIndex(0); }}
                                    onKeyDown={e => {
                                        if (!dropdownOpen && ['ArrowDown', 'ArrowUp'].includes(e.key)) setDropdownOpen(true);
                                        if (!dropdownOpen) return;
                                        if (e.key === 'ArrowDown') { e.preventDefault(); setActiveStockIndex(i => Math.min(i + 1, Math.max(visibleStocks.length - 1, 0))); }
                                        if (e.key === 'ArrowUp') { e.preventDefault(); setActiveStockIndex(i => Math.max(i - 1, 0)); }
                                        if (e.key === 'Enter') { e.preventDefault(); chooseActiveStock(); }
                                        if (e.key === 'Escape') setDropdownOpen(false);
                                    }}
                                    onFocus={() => setDropdownOpen(true)}
                                    placeholder="Search RELIANCE, TCS, INFY..."
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10 text-sm font-semibold text-slate-900 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-500/10 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white dark:placeholder:text-slate-600"
                                />
                                {query && (
                                    <button type="button" onClick={() => { setQuery(''); setForm(c => ({ ...c, ticker: '', name: '' })); setDropdownOpen(false); }}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white">
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                            <AnimatePresence>
                                {dropdownOpen && (
                                    <motion.div initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -6, scale: 0.98 }} transition={{ duration: 0.16, ease: EASE_CURVE }}
                                        className="absolute left-0 right-0 top-full z-[140] mt-2 max-h-80 overflow-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl dark:border-white/[0.09] dark:bg-[#070b14]">
                                        {stockSearchLoading && (
                                            <div className="space-y-2 p-3">
                                                {[0, 1, 2].map(i => <div key={i} className="h-10 animate-pulse rounded-xl bg-slate-100 dark:bg-white/[0.06]" />)}
                                            </div>
                                        )}
                                        {!stockSearchLoading && visibleStocks.length === 0 && (
                                            <div className="px-4 py-8 text-center">
                                                <Search className="mx-auto mb-2 h-6 w-6 text-slate-400" />
                                                <div className="text-sm font-bold text-slate-700 dark:text-slate-200">No stock found</div>
                                                <p className="mt-1 text-xs text-slate-500">Type a custom ticker and sector manually.</p>
                                            </div>
                                        )}
                                        {!stockSearchLoading && visibleStocks.map((stock, index) => {
                                            const color = SECTOR_COLORS[stock.sector] ?? '#6366f1';
                                            const active = index === activeStockIndex;
                                            return (
                                                <button type="button" key={stock.ticker} onMouseEnter={() => setActiveStockIndex(index)} onMouseDown={() => selectStock(stock)}
                                                    className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left outline-none transition-all ${active ? 'bg-slate-950 text-white ring-1 ring-violet-400/30 dark:bg-violet-500/16' : 'hover:bg-slate-100 dark:hover:bg-white/[0.055]'}`}>
                                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[10px] font-black shadow-inner"
                                                        style={{ background: `${color}18`, color: active ? '#fff' : color, border: `1px solid ${color}45` }}>
                                                        {stock.ticker.slice(0, 3)}
                                                    </span>
                                                    <span className="min-w-0 flex-1">
                                                        <span className={`block text-sm font-black ${active ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{highlightedMatch(stock.ticker, query)}</span>
                                                        <span className={`block truncate text-[11px] font-semibold ${active ? 'text-slate-300' : 'text-slate-500'}`}>{highlightedMatch(stock.name, query)}</span>
                                                    </span>
                                                    <span className="rounded-full border px-2 py-1 text-[10px] font-bold"
                                                        style={{ background: `${color}18`, color: active ? '#fff' : color, borderColor: `${color}35` }}>
                                                        {stock.sector}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Numeric fields */}
                        <div className="grid grid-cols-2 gap-3">
                            {/* Quantity — user enters manually */}
                            <label className="block">
                                <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Quantity</span>
                                <input type="number" value={form.quantity}
                                    onChange={e => setForm(c => ({ ...c, quantity: e.target.value }))}
                                    placeholder="e.g. 10"
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-500/10 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white" />
                            </label>

                            {/* Avg Buy Price — user enters manually */}
                            <label className="block">
                                <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Avg Buy Price (₹)</span>
                                <input type="number" value={form.avgBuyPrice}
                                    onChange={e => setForm(c => ({ ...c, avgBuyPrice: e.target.value }))}
                                    placeholder="e.g. 2450"
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-500/10 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white" />
                            </label>

                            {/* Current Price — auto-filled from FastAPI, editable as fallback */}
                            <label className="block col-span-2">
                                <span className="mb-1.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                                    Current Price (₹)
                                    {fetchingQuote && <span className="normal-case tracking-normal text-violet-600 dark:text-violet-300 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Fetching live price…</span>}
                                    {!fetchingQuote && form.currentPrice && <span className="normal-case tracking-normal text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><Check className="h-3 w-3" /> Auto-filled from market data</span>}
                                </span>
                                <input type="number" value={form.currentPrice}
                                    onChange={e => setForm(c => ({ ...c, currentPrice: e.target.value }))}
                                    placeholder={fetchingQuote ? 'Loading…' : 'Auto-fills on stock select'}
                                    className={`h-11 w-full rounded-xl border px-3 text-sm font-semibold outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-500/10 dark:text-white ${
                                        form.currentPrice && !fetchingQuote
                                            ? 'border-emerald-300 bg-emerald-50/50 text-slate-900 dark:border-emerald-500/30 dark:bg-emerald-500/[0.06]'
                                            : 'border-slate-200 bg-slate-50 text-slate-900 dark:border-white/[0.08] dark:bg-white/[0.04]'
                                    }`} />
                            </label>

                            {/* Sector */}
                            <label className="relative col-span-2 block" onBlur={() => window.setTimeout(() => setSectorDropdownOpen(false), 120)}>
                                <span className="mb-1.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                                    Sector
                                    {form.sector && <span className="normal-case tracking-normal text-violet-600 dark:text-violet-300">Auto-suggested</span>}
                                </span>
                                <input value={sectorQuery || form.sector}
                                    onFocus={() => setSectorDropdownOpen(true)}
                                    onChange={e => { setSectorQuery(e.target.value); setForm(c => ({ ...c, sector: e.target.value })); setSectorDropdownOpen(true); setActiveSectorIndex(0); }}
                                    onKeyDown={e => {
                                        if (!sectorDropdownOpen && ['ArrowDown', 'ArrowUp'].includes(e.key)) setSectorDropdownOpen(true);
                                        if (!sectorDropdownOpen) return;
                                        if (e.key === 'ArrowDown') { e.preventDefault(); setActiveSectorIndex(i => Math.min(i + 1, Math.max(filteredSectors.length - 1, 0))); }
                                        if (e.key === 'ArrowUp') { e.preventDefault(); setActiveSectorIndex(i => Math.max(i - 1, 0)); }
                                        if (e.key === 'Enter') { e.preventDefault(); const item = filteredSectors[Math.min(activeSectorIndex, filteredSectors.length - 1)]; if (item) chooseSector(item.sector); }
                                        if (e.key === 'Escape') setSectorDropdownOpen(false);
                                    }}
                                    placeholder="Search sector..."
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-violet-400 focus:bg-white dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
                                />
                                <AnimatePresence>
                                    {sectorDropdownOpen && (
                                        <motion.div initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: -6, scale: 0.98 }} transition={{ duration: 0.16, ease: EASE_CURVE }}
                                            className="absolute left-0 right-0 top-full z-[130] mt-2 max-h-80 overflow-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-white/[0.09] dark:bg-[#070b14]">
                                            {SECTOR_GROUPS.map(group => {
                                                const items = filteredSectors.filter(item => item.group === group.label);
                                                if (!items.length) return null;
                                                return (
                                                    <div key={group.label} className="mb-2 last:mb-0">
                                                        <div className="px-2 pb-1 text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">{group.label}</div>
                                                        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                                                            {items.map(item => {
                                                                const flatIdx = filteredSectors.findIndex(s => s.sector === item.sector);
                                                                const active = flatIdx === activeSectorIndex;
                                                                return (
                                                                    <button key={item.sector} type="button" onMouseEnter={() => setActiveSectorIndex(flatIdx)} onMouseDown={() => chooseSector(item.sector)}
                                                                        className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-all ${active ? 'border-violet-400/35 bg-slate-950 text-white dark:bg-violet-500/16' : 'border-transparent hover:border-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.05]'}`}>
                                                                        <span className="flex h-7 w-7 items-center justify-center rounded-lg text-[9px] font-black"
                                                                            style={{ background: `${item.color}18`, color: active ? '#fff' : item.color, border: `1px solid ${item.color}35` }}>
                                                                            {item.icon}
                                                                        </span>
                                                                        <span className={`text-xs font-bold ${active ? 'text-white' : 'text-slate-800 dark:text-slate-100'}`}>{item.sector}</span>
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

                        <button type="submit"
                            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-violet-700 dark:bg-white dark:text-slate-950 dark:hover:bg-violet-100">
                            <Plus className="h-4 w-4" /> {editingId ? 'Update Holding' : 'Add Stock'}
                        </button>
                    </form>

                    {/* Holdings cards (left sidebar) */}
                    <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-xl shadow-slate-200/60 backdrop-blur dark:border-white/[0.07] dark:bg-slate-950/70 dark:shadow-black/30">
                        <div className="mb-3 flex items-center justify-between">
                            <h2 className="text-sm font-black">Portfolio Holdings</h2>
                            <span className="rounded-full bg-violet-500/10 px-2 py-1 text-[10px] font-bold text-violet-700 dark:text-violet-300">{holdings.length} stocks</span>
                        </div>
                        <div className="space-y-3">
                            <AnimatePresence mode="popLayout">
                                {localStats.map((h, index) => {
                                    const color = SECTOR_COLORS[h.sector] ?? PIE_COLORS[index % PIE_COLORS.length];
                                    const positive = h.pnl >= 0;
                                    return (
                                        <motion.div key={h.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}
                                            className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-xl dark:border-white/[0.06] dark:bg-white/[0.03] dark:hover:border-violet-500/30">
                                            <div className="absolute inset-x-0 top-0 h-px opacity-0 transition group-hover:opacity-100"
                                                style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
                                            <div className="flex items-start gap-3">
                                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[11px] font-black"
                                                    style={{ background: `${color}18`, color, border: `1px solid ${color}35` }}>
                                                    {h.ticker.slice(0, 3)}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="truncate text-sm font-black">{h.name}</h3>
                                                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">{h.ticker}</span>
                                                    </div>
                                                    <p className="mt-0.5 text-[11px] font-semibold text-slate-500">{h.sector} · {h.quantity} qty · Avg {money(h.avgBuyPrice)}</p>
                                                </div>
                                                <div className="flex gap-1 opacity-100 md:opacity-0 md:transition md:group-hover:opacity-100">
                                                    <button onClick={() => editHolding(h)}
                                                        className="rounded-lg p-1.5 text-slate-500 hover:bg-violet-50 hover:text-violet-700 dark:hover:bg-violet-500/10 dark:hover:text-violet-300">
                                                        <FileText className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button onClick={() => deleteHolding(h.id)}
                                                        className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-300">
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                                                <div><span className="block text-slate-500">Value</span><strong>{money(h.value)}</strong></div>
                                                <div><span className="block text-slate-500">Invested</span><strong>{money(h.invested)}</strong></div>
                                                <div className="text-right">
                                                    <span className="block text-slate-500">P&L</span>
                                                    <strong className={positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                                                        {money(h.pnl)} ({pct(h.pnlPct)})
                                                    </strong>
                                                </div>
                                            </div>
                                            <div className="mt-3">
                                                <div className="mb-1 flex justify-between text-[10px] font-bold text-slate-500">
                                                    <span>Allocation</span><span>{h.allocation.toFixed(1)}%</span>
                                                </div>
                                                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.06]">
                                                    <motion.div className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${color}88, ${color})` }}
                                                        initial={{ width: 0 }} animate={{ width: `${h.allocation}%` }} />
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>

                {/* RIGHT — Dashboard (API-driven) */}
                <div className="space-y-5">
                    {/* KPI strip — from API totals */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                        {[
                            { label: 'Portfolio Value', value: money(displayTotals.total_value), sub: `${pct(displayTotals.total_pnl_pct)} all time`, tone: 'text-violet-700 dark:text-violet-300', icon: WalletCards, color: '#8b5cf6' },
                            { label: 'Overall Return', value: money(displayTotals.total_pnl), sub: `${pct(displayTotals.total_pnl_pct)} all time`, tone: displayTotals.total_pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400', icon: TrendingUp, color: displayTotals.total_pnl >= 0 ? '#22c55e' : '#ef4444' },
                            { label: 'Invested Amount', value: money(displayTotals.total_invested), sub: `${displayTotals.holding_count} holdings`, tone: 'text-slate-900 dark:text-white', icon: Coins, color: '#3b82f6' },
                            { label: 'Risk Level', value: apiResponse ? riskLevel : '—', sub: `${Math.round(riskMeterValue)}/100 risk meter`, tone: riskLevel === 'Low' ? 'text-emerald-600 dark:text-emerald-400' : riskLevel === 'Moderate' ? 'text-amber-600 dark:text-amber-300' : 'text-red-600 dark:text-red-400', icon: Gauge, color: riskColor },
                            { label: 'Health Score', value: apiResponse ? `${healthScore}/100` : '—', sub: apiResponse ? healthLabel : 'run analysis', tone: 'text-violet-700 dark:text-violet-300', icon: Shield, color: healthColor },
                        ].map((item, index) => (
                            <motion.div key={item.label} custom={index} variants={cardVariants} initial="hidden" animate="visible"
                                className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-lg shadow-slate-200/60 transition hover:-translate-y-0.5 dark:border-white/[0.07] dark:bg-slate-950/75 dark:shadow-black/30">
                                <div className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-0 transition group-hover:opacity-100"
                                    style={{ background: `linear-gradient(90deg, transparent, ${item.color}, transparent)` }} />
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{item.label}</div>
                                        <div className={`mt-2 truncate text-lg font-black tabular-nums ${item.tone}`}>{item.value}</div>
                                        <div className="mt-1 text-[11px] font-semibold text-slate-500">{item.sub}</div>
                                    </div>
                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                                        style={{ background: `${item.color}18`, color: item.color }}>
                                        <item.icon className="h-4 w-4" />
                                    </span>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    {/* Pre-analysis placeholder */}
                    {!dashboardVisible && (
                        <div className="relative min-h-[520px] overflow-hidden rounded-3xl border border-dashed border-slate-300 bg-white/75 p-6 text-center shadow-inner dark:border-white/[0.08] dark:bg-slate-950/45">
                            <div className="absolute inset-0 opacity-60"
                                style={{ backgroundImage: 'linear-gradient(rgba(99,102,241,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.06) 1px, transparent 1px)', backgroundSize: '42px 42px' }} />
                            <div className="relative z-10 flex min-h-[468px] flex-col items-center justify-center">
                                <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10 text-violet-500">
                                    <Brain className="h-7 w-7" />
                                </span>
                                <h2 className="text-xl font-black">Ready for AI analysis</h2>
                                <p className="mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">
                                    Your holdings are entered. Click <strong>Run AI Analysis</strong> to unlock investor-grade analytics, health score, sector breakdown, and AI recommendations — all computed by the FastAPI backend.
                                </p>
                                <div className="mt-7 grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
                                    {['Risk model', 'Allocation map', 'AI recommendations'].map(label => (
                                        <div key={label} className="h-20 rounded-2xl border border-slate-200 bg-white/70 p-3 text-left shadow-sm dark:border-white/[0.06] dark:bg-white/[0.03]">
                                            <div className="mb-3 h-2 w-16 animate-pulse rounded-full bg-slate-200 dark:bg-white/[0.08]" />
                                            <div className="h-2 w-full animate-pulse rounded-full bg-slate-100 dark:bg-white/[0.05]" />
                                            <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Post-analysis Dashboard — ALL DATA FROM FASTAPI RESPONSE ── */}
                    {dashboardVisible && (
                        <div className="space-y-5">
                            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.45fr_0.9fr]">

                                {/* Sector allocation from API */}
                                <DashboardPanel title="Sector Allocation" eyebrow="Computed by FastAPI sector engine" icon={BarChart3}>
                                    <ResponsiveContainer width="100%" height={252}>
                                        <BarChart data={sectorPieData} layout="vertical" margin={{ left: 8, right: 28, top: 4, bottom: 4 }}>
                                            <CartesianGrid horizontal={false} stroke="rgba(148,163,184,0.1)" />
                                            <XAxis type="number" domain={[0, 100]} hide />
                                            <YAxis dataKey="name" type="category" width={82} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
                                            <Tooltip content={<PremiumTooltip />} cursor={{ fill: 'rgba(99,102,241,0.06)' }} />
                                            <Bar dataKey="value" name="Weight" radius={[0, 9, 9, 0]} barSize={14}
                                                label={{ position: 'right', fill: '#94a3b8', fontSize: 11, fontWeight: 800, formatter: (v: any) => `${Number(v).toFixed(1)}%` }}>
                                                {sectorPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                    {/* Sector bias from API */}
                                    {apiSectorBias && (
                                        <div className="mt-3 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] text-[10px] text-slate-400">
                                            <span className="font-bold text-white capitalize">{String((apiSectorBias as any).bias ?? 'balanced')}</span> tilt ·{' '}
                                            {String((apiSectorBias as any).recommendation ?? '')}
                                        </div>
                                    )}
                                </DashboardPanel>

                                {/* Health Score from API */}
                                <DashboardPanel title="Portfolio Health Score" eyebrow="FastAPI composite score — not local math" icon={Shield}>
                                    <div className="flex justify-center mb-4">
                                        <HealthGauge score={healthScore} color={healthColor} label={healthLabel} />
                                    </div>
                                    {/* Breakdown bars from API */}
                                    {apiHealth?.breakdown && (
                                        <div className="space-y-2.5">
                                            {Object.entries(apiHealth.breakdown).map(([key, val]) => {
                                                const v = val as number;
                                                const barColor = v >= 65 ? '#22c55e' : v >= 42 ? '#f59e0b' : '#ef4444';
                                                return (
                                                    <div key={key}>
                                                        <div className="mb-1 flex items-center justify-between text-[11px] font-bold">
                                                            <span className="text-slate-500 capitalize">{key.replace(/_/g, ' ')}</span>
                                                            <span style={{ color: barColor }}>{Math.round(v)}</span>
                                                        </div>
                                                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.06]">
                                                            <motion.div className="h-full rounded-full" style={{ background: barColor }}
                                                                initial={{ width: 0 }} animate={{ width: `${v}%` }} transition={{ duration: 0.9, ease: EASE_CURVE }} />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {apiHealth?.summary && (
                                        <p className="mt-3 text-[10px] text-slate-500 leading-relaxed">{apiHealth.summary}</p>
                                    )}
                                </DashboardPanel>
                            </div>

                            {/* Quick stats row from API */}
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
                                {[
                                    { title: 'Top Performing Stock', primary: topPerformer?.ticker ?? '-', value: topPerformer ? pct(topPerformer.pnlPct) : '-', tone: 'text-emerald-600 dark:text-emerald-400', icon: TrendingUp },
                                    { title: 'Worst Performing Stock', primary: worstPerformer?.ticker ?? '-', value: worstPerformer ? pct(worstPerformer.pnlPct) : '-', tone: 'text-red-600 dark:text-red-400', icon: TrendingDown },
                                    { title: 'Concentration Warning', primary: topHolding?.ticker ?? '-', value: topHolding ? `${topHolding.allocation.toFixed(1)}%` : '-', tone: (apiConc as any)?.concentration_level === 'high' ? 'text-amber-600 dark:text-amber-300' : 'text-emerald-600 dark:text-emerald-400', icon: AlertTriangle },
                                    { title: 'Diversification Status', primary: diversificationStatus, value: `${apiSectors.length} sectors`, tone: diversificationStatus === 'Well diversified' ? 'text-emerald-600 dark:text-emerald-400' : 'text-violet-600 dark:text-violet-300', icon: Layers3 },
                                    { title: 'Sharpe Ratio', primary: (apiRisk?.sharpe_ratio ?? 0) >= 1 ? 'Good' : 'Low', value: (apiRisk?.sharpe_ratio ?? 0).toFixed(2), tone: (apiRisk?.sharpe_ratio ?? 0) >= 1 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-300', icon: Gauge },
                                    { title: 'Stability / Volatility', primary: stabilityLabel, value: `${(apiRisk?.volatility_pct ?? 0).toFixed(1)}% vol`, tone: (apiRisk?.volatility_pct ?? 0) < 20 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-300', icon: SlidersHorizontal },
                                ].map(card => (
                                    <motion.div key={card.title} whileHover={{ y: -3 }}
                                        className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-lg shadow-slate-200/50 transition dark:border-white/[0.07] dark:bg-slate-950/75 dark:shadow-black/30">
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
                                {/* Asset allocation donut — from API holdings */}
                                <DashboardPanel title="Asset Allocation" eyebrow="FastAPI enriched holdings" icon={PieIcon}>
                                    <div className="relative h-[248px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={displayStats} dataKey="allocation" nameKey="ticker"
                                                    innerRadius="58%" outerRadius="82%" paddingAngle={4}
                                                    stroke="rgba(15,23,42,0.55)" strokeWidth={3}>
                                                    {displayStats.map((entry, index) => (
                                                        <Cell key={entry.id ?? entry.ticker} fill={SECTOR_COLORS[entry.sector] ?? PIE_COLORS[index % PIE_COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip content={<PremiumTooltip />} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                            <div className="text-center">
                                                <div className="text-sm font-black tabular-nums text-slate-950 dark:text-white">{money(displayTotals.total_value)}</div>
                                                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Total</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-1 grid grid-cols-1 gap-2">
                                        {displayStats.slice(0, 4).map((h, index) => {
                                            const color = SECTOR_COLORS[h.sector] ?? PIE_COLORS[index % PIE_COLORS.length];
                                            return (
                                                <div key={h.ticker} className="flex items-center justify-between gap-3 text-[11px] font-bold">
                                                    <span className="flex min-w-0 items-center gap-2 text-slate-500">
                                                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
                                                        <span className="truncate">{h.ticker}</span>
                                                    </span>
                                                    <span className="tabular-nums text-slate-800 dark:text-slate-200">{h.allocation.toFixed(1)}%</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </DashboardPanel>

                                {/* AI Insights from FastAPI */}
                                <DashboardPanel title="AI Recommendations" eyebrow="From FastAPI insights engine" icon={Brain}>
                                    <div className="space-y-3">
                                        {apiInsights.length > 0 ? apiInsights.map((insight, i) => {
                                            const toneStyle = {
                                                warn: { title: 'text-amber-600 dark:text-amber-300', card: 'border-amber-500/20 bg-amber-500/5' },
                                                good: { title: 'text-emerald-600 dark:text-emerald-300', card: 'border-emerald-500/20 bg-emerald-500/5' },
                                                info: { title: 'text-violet-600 dark:text-violet-300', card: 'border-violet-500/20 bg-violet-500/5' },
                                                strong: { title: 'text-blue-600 dark:text-blue-300', card: 'border-blue-500/20 bg-blue-500/5' },
                                            }[insight.tone] ?? { title: 'text-slate-500', card: 'border-slate-200 bg-slate-50 dark:border-white/[0.06] dark:bg-white/[0.03]' };
                                            return (
                                                <div key={i} className={`rounded-2xl border p-3 ${toneStyle.card}`}>
                                                    <div className={`mb-1 text-xs font-black ${toneStyle.title}`}>{insight.title}</div>
                                                    <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">{insight.body}</p>
                                                </div>
                                            );
                                        }) : (
                                            <div className="rounded-2xl border border-violet-500/15 bg-violet-500/10 p-3 text-[11px] font-semibold text-violet-700 dark:text-violet-300">
                                                {concentrationWarning}
                                            </div>
                                        )}
                                    </div>
                                </DashboardPanel>

                                {/* Rebalance suggestions from FastAPI */}
                                <DashboardPanel title="Rebalancing Suggestions" eyebrow="FastAPI rebalancer engine" icon={Target}>
                                    <div className="space-y-3">
                                        {rebalanceNotes.map((note, index) => (
                                            <div key={index} className="flex gap-3 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                                                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-[10px] font-black text-violet-600 dark:text-violet-300">
                                                    {index + 1}
                                                </span>
                                                {note}
                                            </div>
                                        ))}
                                    </div>
                                    {/* Diversification score bar from API */}
                                    <div className="mt-4">
                                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-1">
                                            <span>Diversification Score</span>
                                            <span>{Math.round(apiDivScore)}/100</span>
                                        </div>
                                        <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.06]">
                                            <motion.div className="h-full rounded-full"
                                                style={{ background: apiDivScore >= 60 ? '#22c55e' : apiDivScore >= 35 ? '#f59e0b' : '#ef4444' }}
                                                initial={{ width: 0 }} animate={{ width: `${apiDivScore}%` }} transition={{ duration: 1, ease: EASE_CURVE }} />
                                        </div>
                                    </div>
                                </DashboardPanel>
                            </div>

                            {/* Portfolio Exposure Summary from API */}
                            {exposureSummary.length > 0 && (
                                <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
                                    <DashboardPanel title="Upcoming Events" eyebrow="Placeholder — SEBI filing calendar" icon={CalendarDays}>
                                        <div className="space-y-2">
                                            {upcomingEvents.map(event => (
                                                <div key={`${event.stock}-${event.event}`}
                                                    className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 transition hover:border-violet-300/60 dark:border-white/[0.06] dark:bg-white/[0.03]">
                                                    <span className="flex h-8 w-8 items-center justify-center rounded-xl text-[10px] font-black text-white"
                                                        style={{ background: event.color }}>{event.stock.slice(0, 3)}</span>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-xs font-black">{event.stock}</div>
                                                        <div className="text-[11px] text-slate-500">{event.event}</div>
                                                    </div>
                                                    <div className="text-[11px] font-bold text-slate-500">{event.date}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </DashboardPanel>

                                    <DashboardPanel title="Risk Analytics" eyebrow="From FastAPI risk engine" icon={Gauge}>
                                        <div className="mb-4">
                                            <div className="mb-1 flex items-center justify-between text-[11px] font-bold text-slate-500">
                                                <span>Portfolio Risk Meter</span>
                                                <span style={{ color: riskColor }}>{Math.round(riskMeterValue)}/100</span>
                                            </div>
                                            <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.06]">
                                                <motion.div initial={{ width: 0 }} animate={{ width: `${riskMeterValue}%` }} transition={{ duration: 0.9, ease: EASE_CURVE }}
                                                    className="h-full rounded-full" style={{ background: `linear-gradient(90deg, #22c55e, #f59e0b, ${riskColor})` }} />
                                            </div>
                                        </div>
                                        <div className="space-y-2.5">
                                            {[
                                                { label: 'Volatility', value: `${(apiRisk?.volatility_pct ?? 0).toFixed(1)}%`, color: '#f59e0b' },
                                                { label: 'Sharpe Ratio', value: (apiRisk?.sharpe_ratio ?? 0).toFixed(2), color: (apiRisk?.sharpe_ratio ?? 0) >= 1 ? '#22c55e' : '#f59e0b' },
                                                { label: 'VaR 95%', value: `${Math.abs((apiRisk?.var_95 ?? 0) * 100).toFixed(2)}%`, color: '#ef4444' },
                                                { label: 'Max Drawdown', value: `${Math.abs(apiRisk?.max_drawdown_pct ?? 0).toFixed(1)}%`, color: '#f97316' },
                                            ].map(item => (
                                                <div key={item.label}>
                                                    <div className="mb-1 flex justify-between text-[11px] font-bold text-slate-500">
                                                        <span>{item.label}</span>
                                                        <span style={{ color: item.color }}>{item.value}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </DashboardPanel>

                                    <DashboardPanel title="Exposure Summary" eyebrow={`${riskLevel} risk · FastAPI sector bias`} icon={Gauge}>
                                        <div className="space-y-3">
                                            {exposureSummary.map(item => (
                                                <div key={item.label}>
                                                    <div className="mb-1 flex justify-between text-[11px] font-bold text-slate-500">
                                                        <span>{item.label}</span><span>{item.value.toFixed(1)}%</span>
                                                    </div>
                                                    <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.06]">
                                                        <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(item.value, 100)}%` }} transition={{ duration: 0.8, ease: EASE_CURVE }}
                                                            className="h-full rounded-full" style={{ background: item.color }} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </DashboardPanel>
                                </div>
                            )}

                            {/* Holdings Table — from API enriched holdings */}
                            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-xl shadow-slate-200/60 dark:border-white/[0.07] dark:bg-slate-950/75 dark:shadow-black/30">
                                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-white/[0.06]">
                                    <div>
                                        <h2 className="flex items-center gap-2 text-sm font-black">
                                            <ArrowUpDown className="h-4 w-4 text-violet-500" /> Holdings Table
                                        </h2>
                                        <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                                            {apiResponse ? 'FastAPI enriched holdings' : 'Local — run analysis for FastAPI data'}
                                        </p>
                                    </div>
                                    <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-violet-700 dark:text-violet-300">
                                        {sortedDisplayStats.length} rows
                                    </span>
                                </div>
                                <div className="max-h-[520px] overflow-auto overscroll-contain">
                                    <table className="w-full min-w-[860px] text-sm">
                                        <thead className="sticky top-0 z-20 bg-slate-50/95 text-[10px] uppercase tracking-[0.14em] text-slate-500 shadow-sm backdrop-blur dark:bg-[#070b14]/95">
                                            <tr>
                                                {[['Stock', 'ticker'], ['Qty', null], ['Avg Price', null], ['Current', null], ['Value', 'value'], ['P&L', 'pnl'], ['Weight', 'allocation']].map(([head, key]) => (
                                                    <th key={head} className="px-4 py-3 text-left font-black">
                                                        {key ? (
                                                            <button onClick={() => setSort(key as typeof sortBy)}
                                                                className="inline-flex items-center gap-1.5 rounded-lg px-1 py-0.5 transition hover:bg-violet-500/10 hover:text-violet-600 dark:hover:text-violet-300">
                                                                {head}{sortBy === key && <span>{sortDir === 'asc' ? '↑' : '↓'}</span>}
                                                            </button>
                                                        ) : head}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                                            {sortedDisplayStats.map(h => (
                                                <tr key={h.ticker} className="transition hover:bg-violet-50/70 dark:hover:bg-violet-500/[0.045]">
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-3">
                                                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-black"
                                                                style={{ background: `${(SECTOR_COLORS[h.sector] ?? '#6366f1')}18`, color: SECTOR_COLORS[h.sector] ?? '#6366f1', border: `1px solid ${(SECTOR_COLORS[h.sector] ?? '#6366f1')}35` }}>
                                                                {h.ticker.replace('.NS', '').slice(0, 3)}
                                                            </span>
                                                            <div className="min-w-0">
                                                                <div className="truncate font-black">{h.name}</div>
                                                                <div className="truncate text-[11px] font-semibold text-slate-500">{h.ticker} · {h.sector}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 font-semibold tabular-nums">{h.quantity}</td>
                                                    <td className="px-4 py-3 font-semibold tabular-nums">{money(h.avgBuyPrice)}</td>
                                                    <td className="px-4 py-3 font-semibold tabular-nums">{money(h.currentPrice)}</td>
                                                    <td className="px-4 py-3 font-black tabular-nums">{money(h.value)}</td>
                                                    <td className={`px-4 py-3 font-black tabular-nums ${h.pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                                        {money(h.pnl)} ({pct(h.pnlPct)})
                                                    </td>
                                                    <td className="px-4 py-3 font-black tabular-nums">
                                                        <div className="flex items-center gap-2">
                                                            <span>{h.allocation.toFixed(1)}%</span>
                                                            <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.06]">
                                                                <span className="block h-full rounded-full bg-violet-500" style={{ width: `${Math.min(h.allocation, 100)}%` }} />
                                                            </span>
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

// ─────────────────────────────────────────────────────────────────────────────
// Onboarding Questions Screen (unchanged UI)
// ─────────────────────────────────────────────────────────────────────────────
const ONBOARDING_QUESTIONS = [
    {
        id: 'goal', question: 'What is your primary investment goal?', subtitle: "This helps us understand what you're investing for.",
        options: [
            { id: 'wealth_creation', label: 'Wealth Creation', desc: 'Grow your money over time', icon: TrendingUp, color: '#6366f1' },
            { id: 'retirement', label: 'Retirement', desc: 'Build a comfortable retirement corpus', icon: Shield, color: '#22c55e' },
            { id: 'passive_income', label: 'Passive Income', desc: 'Generate regular dividend income', icon: DollarSign, color: '#f59e0b' },
            { id: 'house_purchase', label: 'Buying a House', desc: 'Save for a major purchase', icon: Home, color: '#3b82f6' },
            { id: 'emergency_fund', label: 'Emergency Fund', desc: 'Build a financial safety net', icon: Star, color: '#ec4899' },
        ],
    },
    {
        id: 'horizon', question: 'What is your investment time horizon?', subtitle: 'Longer horizons allow for more growth-oriented allocations.',
        options: [
            { id: '1-3y', label: '1–3 Years', desc: 'Short-term goals', icon: Clock, color: '#f59e0b' },
            { id: '3-7y', label: '3–7 Years', desc: 'Medium-term planning', icon: BarChart3, color: '#6366f1' },
            { id: '7y+', label: '7+ Years', desc: 'Long-term wealth building', icon: Flame, color: '#22c55e' },
        ],
    },
    {
        id: 'risk', question: 'How would you describe your risk appetite?', subtitle: "There is no wrong answer — be honest with yourself.",
        options: [
            { id: 'conservative', label: 'Conservative', desc: 'I prefer safety over high returns.', icon: Shield, color: '#22c55e' },
            { id: 'balanced', label: 'Balanced', desc: 'I can tolerate some volatility.', icon: BarChart2, color: '#6366f1' },
            { id: 'aggressive', label: 'Aggressive', desc: "I'm comfortable with high risk.", icon: Flame, color: '#ef4444' },
        ],
    },
    {
        id: 'assets', question: 'What asset classes interest you?', subtitle: 'Select all that apply.', multi: true,
        options: [
            { id: 'indian-stocks', label: 'Indian Stocks', desc: 'NSE/BSE listed equities', icon: BarChart3, color: '#6366f1' },
            { id: 'etfs', label: 'Index ETFs', desc: 'Nifty 50, Nifty Next 50', icon: Globe, color: '#3b82f6' },
            { id: 'international', label: 'International', desc: 'US & global markets', icon: Globe, color: '#f59e0b' },
            { id: 'gold', label: 'Gold & Silver', desc: 'Commodity hedge', icon: Gem, color: '#fbbf24' },
        ],
    },
];

function OnboardingScreen({ onBack, onComplete }: { onBack: () => void; onComplete: (answers: OnboardingAnswers) => void }) {
    const [step, setStep] = useState(0);
    const [answers, setAnswers] = useState<Partial<OnboardingAnswers>>({ assets: [] });
    const [monthly, setMonthly] = useState(5000);

    const q = ONBOARDING_QUESTIONS[step];
    const totalSteps = ONBOARDING_QUESTIONS.length + 1;
    const isMonthlyStep = step === ONBOARDING_QUESTIONS.length;

    const canNext = isMonthlyStep ? true :
        q?.multi ? (answers.assets?.length ?? 0) > 0 :
            !!(answers as any)[q?.id ?? ''];

    const handleOption = (id: string) => {
        if (q?.multi) {
            setAnswers(prev => ({ ...prev, assets: prev.assets?.includes(id) ? prev.assets.filter(a => a !== id) : [...(prev.assets ?? []), id] }));
        } else {
            setAnswers(prev => ({ ...prev, [q.id]: id }));
        }
    };

    const handleNext = () => {
        if (isMonthlyStep) onComplete({ ...answers, monthly } as OnboardingAnswers);
        else setStep(s => s + 1);
    };

    return (
        <motion.div key="onboarding" variants={screenVariants} initial="enter" animate="center" exit="exit" className="max-w-xl mx-auto py-8 px-4">
            <button onClick={onBack} className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-sm mb-6 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <div className="mb-8">
                <div className="flex items-center justify-between text-[10px] text-slate-500 mb-2">
                    <span>Step {step + 1} of {totalSteps}</span>
                    <span>{Math.round(((step + 1) / totalSteps) * 100)}% complete</span>
                </div>
                <div className="h-0.5 rounded-full bg-white/[0.06]">
                    <motion.div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg, #4f46e5, #7c3aed)' }}
                        animate={{ width: `${((step + 1) / totalSteps) * 100}%` }} transition={{ duration: 0.4 }} />
                </div>
            </div>

            <AnimatePresence mode="wait">
                <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
                    {isMonthlyStep ? (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-2xl font-bold text-white mb-2">How much can you invest monthly?</h2>
                                <p className="text-slate-400 text-sm">This helps us suggest a realistic SIP (Systematic Investment Plan).</p>
                            </div>
                            <div className="p-6 rounded-2xl border border-white/[0.06]" style={{ background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(20px)' }}>
                                <div className="text-4xl font-black text-white mb-1 tabular-nums">₹{monthly.toLocaleString('en-IN')}</div>
                                <div className="text-sm text-slate-500 mb-6">per month</div>
                                <input type="range" min={500} max={100000} step={500} value={monthly}
                                    onChange={e => setMonthly(parseInt(e.target.value))} className="w-full" />
                                <div className="flex justify-between text-[10px] text-slate-600 mt-2"><span>₹500</span><span>₹1,00,000</span></div>
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                                {[1000, 5000, 10000, 25000].map(v => (
                                    <button key={v} onClick={() => setMonthly(v)}
                                        className={`py-2 rounded-xl text-[11px] font-semibold border transition-all ${monthly === v ? 'bg-violet-500/15 border-violet-500/40 text-violet-300' : 'border-white/[0.06] text-slate-500 hover:border-white/[0.1]'}`}>
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
                                    const isSelected = q.multi ? answers.assets?.includes(opt.id) : (answers as any)[q.id] === opt.id;
                                    return (
                                        <motion.button key={opt.id} whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.99 }}
                                            onClick={() => handleOption(opt.id)}
                                            className="relative text-left p-4 rounded-2xl border transition-all duration-200"
                                            style={isSelected ? { background: `${opt.color}12`, borderColor: `${opt.color}40` } : { background: 'rgba(15,23,42,0.6)', borderColor: 'rgba(255,255,255,0.06)' }}>
                                            {isSelected && (
                                                <div className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: opt.color }}>
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

            <div className="flex items-center justify-between mt-8">
                <button onClick={() => step > 0 ? setStep(s => s - 1) : onBack()}
                    className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-sm transition-colors">
                    <ArrowLeft className="w-4 h-4" />{step === 0 ? 'Back' : 'Previous'}
                </button>
                <motion.button onClick={handleNext} disabled={!canNext}
                    whileHover={canNext ? { scale: 1.03 } : {}} whileTap={canNext ? { scale: 0.97 } : {}}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${canNext ? 'text-white' : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}
                    style={canNext ? { background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' } : {}}>
                    {isMonthlyStep ? <><Sparkles className="w-4 h-4" /> Build My Portfolio</> : <>Continue <ArrowRight className="w-4 h-4" /></>}
                </motion.button>
            </div>
        </motion.div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Building Screen — now calls FastAPI /ai/generate-portfolio
// BUG FIX: previously had NO API call at all (just a 8s setTimeout)
// ─────────────────────────────────────────────────────────────────────────────

function AIBuildingScreen({ answers, onDone }: { answers: OnboardingAnswers; onDone: (data: any) => void }) {
    const [msgIdx, setMsgIdx] = useState(0);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const msgInterval = setInterval(() => setMsgIdx(i => (i + 1) % AI_BUILDING_MESSAGES.length), 1800);

        // FIX: actually call FastAPI instead of a fake setTimeout
        const callAPI = async () => {
            console.log('[AIBuilding] Calling FastAPI /ai/generate-portfolio with:', answers);
            try {
                const result = await aiApi.generatePortfolio({
                    goal: answers.goal,
                    horizon: answers.horizon,
                    risk: answers.risk,
                    monthly_investment: answers.monthly,
                    asset_preferences: answers.assets?.length > 0 ? answers.assets : undefined,
                });
                console.log('[AIBuilding] FastAPI AI response received:', {
                    method: (result as any).generation_method,
                    allocations: (result as any).allocations?.length,
                    expected_return: (result as any).expected_return_range,
                });
                setProgress(100);
                setTimeout(() => onDone(result), 600);
            } catch (err: any) {
                console.error('[AIBuilding] FastAPI AI error:', err);
                setError(err.message);
                // On error, still proceed with rule-based fallback after 2s
                setTimeout(() => onDone(null), 2000);
            }
        };

        // Animate progress bar while API call runs
        const progInterval = setInterval(() => {
            setProgress(p => {
                if (p >= 85) { clearInterval(progInterval); return 85; }  // Hold at 85% until API responds
                return p + 1.5;
            });
        }, 60);

        callAPI();
        return () => { clearInterval(msgInterval); clearInterval(progInterval); };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <motion.div key="ai-building" variants={screenVariants} initial="enter" animate="center" exit="exit"
            className="min-h-[calc(100vh-140px)] flex flex-col items-center justify-center px-4">
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.06, 0.1, 0.06] }} transition={{ duration: 4, repeat: Infinity }}
                    className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full"
                    style={{ background: 'radial-gradient(circle, #6366f1, transparent)', filter: 'blur(80px)' }} />
            </div>

            <div className="relative z-10 flex flex-col items-center text-center max-w-sm">
                <div className="relative w-32 h-32 mb-8">
                    {[0, 1, 2].map(i => (
                        <motion.div key={i} className="absolute inset-0 rounded-full border"
                            style={{ borderColor: `rgba(99,102,241,${0.4 - i * 0.12})` }}
                            animate={{ rotate: i % 2 === 0 ? 360 : -360 }} transition={{ duration: 3 + i * 1.5, repeat: Infinity, ease: 'linear' }} />
                    ))}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.15))', border: '1px solid rgba(99,102,241,0.3)' }}>
                            <Brain className="w-8 h-8 text-violet-400" />
                        </div>
                    </div>
                </div>

                <h2 className="text-2xl font-bold text-white mb-3">Building Your Portfolio</h2>
                <AnimatePresence mode="wait">
                    <motion.p key={msgIdx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                        className="text-slate-400 text-sm mb-8">
                        {error ? `API error — using rule-based fallback… (${error.slice(0, 50)})` : AI_BUILDING_MESSAGES[msgIdx]}
                    </motion.p>
                </AnimatePresence>

                <div className="w-64 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <motion.div className="h-full rounded-full"
                        style={{ background: 'linear-gradient(90deg, #4f46e5, #7c3aed, #06b6d4)' }}
                        animate={{ width: `${Math.min(progress, 100)}%` }} transition={{ duration: 0.3 }} />
                </div>
                <div className="text-[10px] text-slate-600 mt-2">{Math.min(Math.round(progress), 100)}% complete</div>

                <div className="mt-8 space-y-2 w-full">
                    {['Calling Gemini AI', 'Building allocation model', 'Computing SIP projections', 'Generating recommendations'].map((step, i) => {
                        const done = progress > (i + 1) * 22;
                        return (
                            <motion.div key={step} initial={{ opacity: 0 }} animate={{ opacity: progress > i * 22 ? 1 : 0.3 }}
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
// Beginner Results Screen — driven by FastAPI response
// BUG FIX: previously computed everything locally with hardcoded assumptions
// ─────────────────────────────────────────────────────────────────────────────
function BeginnerResultsScreen({ answers, apiData, onBack, onRestart }: {
    answers: OnboardingAnswers;
    apiData: any | null;  // FastAPI AIPortfolioResponse or null
    onBack: () => void;
    onRestart: () => void;
}) {
    // FIX: Use API data when available; fall back to rule-based local template only when null
    const hasApiData = apiData !== null && apiData?.allocations?.length > 0;

    console.log('[BeginnerResults] Rendering with apiData:', {
        hasApiData,
        generation_method: apiData?.generation_method,
        allocation_count: apiData?.allocations?.length,
        expected_return: apiData?.expected_return_range,
    });

    // When FastAPI responded — render from API fields
    if (hasApiData) {
        const proj = apiData.sip_projection;
        const allocs = apiData.allocations as Array<{
            name: string; ticker: string; allocation_pct: number; asset_type: string;
            description: string; risk_level: string; monthly_sip: number;
        }>;

        const ASSET_TYPE_COLORS: Record<string, string> = {
            equity: '#6366f1', debt: '#22c55e', gold: '#f59e0b', international: '#3b82f6', etf: '#ec4899',
        };

        const assetTypeGroups = allocs.reduce<Record<string, number>>((acc, a) => {
            acc[a.asset_type] = (acc[a.asset_type] || 0) + a.allocation_pct;
            return acc;
        }, {});

        return (
            <motion.div key="beginner-results-api" variants={screenVariants} initial="enter" animate="center" exit="exit" className="space-y-6 pb-8">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-violet-500/25 bg-violet-500/8 mb-3">
                            <Sparkles className="w-3 h-3 text-violet-400" />
                            <span className="text-[10px] font-semibold text-violet-300">
                                {apiData.generation_method === 'gemini' ? 'Gemini AI Portfolio' : 'Rule-Based Portfolio'}
                            </span>
                        </div>
                        <h1 className="text-2xl font-bold text-white">Your Recommended Portfolio</h1>
                        <p className="text-slate-400 text-sm mt-1">
                            {answers.risk} risk · {answers.horizon} horizon · ₹{answers.monthly.toLocaleString('en-IN')}/month SIP
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={onBack} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/[0.06] text-slate-500 hover:text-slate-300 text-sm">
                            <ArrowLeft className="w-4 h-4" /> Edit
                        </button>
                        <button onClick={onRestart} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/[0.06] text-slate-500 hover:text-slate-300 text-sm">
                            <RotateCcw className="w-3.5 h-3.5" /> Restart
                        </button>
                    </div>
                </div>

                {/* Key stats from API */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        { label: 'Monthly SIP', value: `₹${proj.monthly_sip.toLocaleString('en-IN')}`, color: '#6366f1' },
                        { label: 'Total Invested', value: `₹${(proj.total_invested / 1e5).toFixed(1)}L`, color: '#3b82f6' },
                        { label: 'Expected Returns', value: apiData.expected_return_range + ' p.a.', color: '#22c55e' },
                        { label: `Value in ${answers.horizon}`, value: `₹${(proj.projected_value_high / 1e5).toFixed(1)}L`, color: '#f59e0b' },
                    ].map((s, i) => (
                        <motion.div key={s.label} custom={i} variants={cardVariants} initial="hidden" animate="visible"
                            className="p-4 rounded-2xl border border-white/[0.06]"
                            style={{ background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(20px)' }}>
                            <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500 mb-1">{s.label}</div>
                            <div className="text-xl font-black tabular-nums" style={{ color: s.color }}>{s.value}</div>
                        </motion.div>
                    ))}
                </div>

                {/* Asset type bar */}
                <div className="p-4 rounded-2xl border border-white/[0.06]" style={{ background: 'rgba(15,23,42,0.7)' }}>
                    <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500 mb-2">Asset Mix</div>
                    <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                        {Object.entries(assetTypeGroups).map(([type, pct]) => (
                            <motion.div key={type} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: EASE_CURVE }}
                                className="h-full rounded-sm" style={{ background: ASSET_TYPE_COLORS[type] ?? '#64748b', minWidth: 4 }}
                                title={`${type}: ${pct.toFixed(0)}%`} />
                        ))}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-2">
                        {Object.entries(assetTypeGroups).map(([type, pct]) => (
                            <div key={type} className="flex items-center gap-1.5 text-[10px]">
                                <span className="w-2 h-2 rounded-sm" style={{ background: ASSET_TYPE_COLORS[type] ?? '#64748b' }} />
                                <span className="text-slate-400 capitalize">{type}</span>
                                <span className="font-bold text-white">{pct.toFixed(0)}%</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Allocations from API */}
                <div className="space-y-3">
                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Asset Allocation — from {apiData.generation_method === 'gemini' ? 'Gemini AI' : 'rule-based engine'}</div>
                    {allocs.map((asset, i) => {
                        const color = ASSET_TYPE_COLORS[asset.asset_type] ?? PIE_COLORS[i % PIE_COLORS.length];
                        return (
                            <motion.div key={asset.ticker} custom={i} variants={cardVariants} initial="hidden" animate="visible"
                                className="group relative p-4 rounded-2xl border border-white/[0.06] overflow-hidden hover:border-white/[0.1]"
                                style={{ background: 'rgba(15,23,42,0.6)' }}>
                                <div className="relative z-10 flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                                        style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
                                        <span className="text-[11px] font-black" style={{ color }}>{asset.asset_type.slice(0, 2).toUpperCase()}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <h3 className="text-sm font-bold text-white">{asset.name}</h3>
                                            <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold" style={{ background: `${color}18`, color }}>{asset.ticker}</span>
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded capitalize ${asset.risk_level === 'low' ? 'text-emerald-400 bg-emerald-500/10' : asset.risk_level === 'moderate' ? 'text-violet-400 bg-violet-500/10' : 'text-amber-400 bg-amber-500/10'}`}>{asset.risk_level}</span>
                                        </div>
                                        <p className="text-[11px] text-slate-500">{asset.description}</p>
                                        <div className="mt-2 h-1 rounded-full bg-white/[0.05] overflow-hidden">
                                            <motion.div className="h-full rounded-full" style={{ background: color }}
                                                initial={{ width: 0 }} animate={{ width: `${asset.allocation_pct}%` }}
                                                transition={{ duration: 0.8, delay: i * 0.1, ease: EASE_CURVE }} />
                                        </div>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <div className="text-2xl font-black tabular-nums" style={{ color }}>{asset.allocation_pct.toFixed(0)}%</div>
                                        <div className="text-[10px] text-slate-500">₹{Math.round(asset.monthly_sip).toLocaleString('en-IN')}/mo</div>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>

                {/* AI reasoning from API */}
                <div className="rounded-2xl border border-violet-500/15 p-5" style={{ background: 'rgba(99,102,241,0.05)' }}>
                    <div className="flex items-center gap-2 mb-3">
                        <Brain className="w-4 h-4 text-violet-400" />
                        <span className="text-[11px] font-bold text-violet-300">AI Reasoning</span>
                    </div>
                    <p className="text-[12px] text-slate-400 leading-relaxed">{apiData.reasoning}</p>
                    {apiData.goal_alignment && (
                        <div className="mt-3 p-3 rounded-xl bg-emerald-500/6 border border-emerald-500/15">
                            <div className="text-[10px] font-bold text-emerald-400 mb-1">Goal Alignment</div>
                            <p className="text-[11px] text-slate-400">{apiData.goal_alignment}</p>
                        </div>
                    )}
                    {apiData.beginner_explanation && (
                        <div className="mt-2 p-3 rounded-xl bg-blue-500/6 border border-blue-500/15">
                            <div className="text-[10px] font-bold text-blue-400 mb-1">For Beginners</div>
                            <p className="text-[11px] text-slate-400">{apiData.beginner_explanation}</p>
                        </div>
                    )}
                    {apiData.warnings?.length > 0 && (
                        <div className="mt-2 p-3 rounded-xl bg-amber-500/8 border border-amber-500/15">
                            <p className="text-[11px] text-amber-400">{apiData.warnings[0]}</p>
                        </div>
                    )}
                </div>

                <button onClick={onRestart} className="w-full p-4 rounded-2xl border border-violet-500/20 text-sm font-semibold"
                    style={{ background: 'rgba(99,102,241,0.06)' }}>
                    <div className="flex items-center justify-center gap-2 text-violet-300">
                        <BarChart3 className="w-4 h-4" /> Analyze with MPT Engine <ArrowRight className="w-4 h-4" />
                    </div>
                </button>
            </motion.div>
        );
    }

    // Fallback when API completely failed — minimal rule-based UI
    const riskLabel = answers.risk === 'conservative' ? 'Low' : answers.risk === 'aggressive' ? 'High' : 'Moderate';
    const returnRange = answers.risk === 'conservative' ? '8–11%' : answers.risk === 'aggressive' ? '14–20%' : '11–16%';
    const fallbackNote = 'FastAPI AI service unavailable — showing a basic template. Start FastAPI and try again for the full AI experience.';

    return (
        <motion.div key="beginner-results-fallback" variants={screenVariants} initial="enter" animate="center" exit="exit" className="space-y-6 pb-8">
            <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-500/25 bg-amber-500/8 mb-3">
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                    <span className="text-[10px] font-semibold text-amber-300">Rule-Based Fallback</span>
                </div>
                <h1 className="text-2xl font-bold text-white">Your Portfolio Template</h1>
                <p className="text-slate-400 text-sm mt-1">{answers.risk} risk · {answers.horizon} horizon</p>
                <div className="mt-3 p-3 rounded-xl bg-amber-500/8 border border-amber-500/15">
                    <p className="text-[11px] text-amber-400">{fallbackNote}</p>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl border border-white/[0.06]" style={{ background: 'rgba(15,23,42,0.7)' }}>
                    <div className="text-[9px] font-bold uppercase text-slate-500 mb-1">Monthly SIP</div>
                    <div className="text-xl font-black text-violet-400">₹{answers.monthly.toLocaleString('en-IN')}</div>
                </div>
                <div className="p-4 rounded-2xl border border-white/[0.06]" style={{ background: 'rgba(15,23,42,0.7)' }}>
                    <div className="text-[9px] font-bold uppercase text-slate-500 mb-1">Expected Returns</div>
                    <div className="text-xl font-black text-emerald-400">{returnRange} p.a.</div>
                </div>
            </div>
            <button onClick={onRestart} className="w-full p-4 rounded-2xl border border-violet-500/20 text-sm font-semibold" style={{ background: 'rgba(99,102,241,0.06)' }}>
                <div className="flex items-center justify-center gap-2 text-violet-300">
                    <RotateCcw className="w-4 h-4" /> Try Again
                </div>
            </button>
        </motion.div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root Page — State Machine
// ─────────────────────────────────────────────────────────────────────────────
export default function PortfolioOptimizerPage() {
    const [screen, setScreen] = useState<AppScreen>('landing');
    const [onboardingAnswers, setOnboardingAnswers] = useState<OnboardingAnswers | null>(null);
    const [aiApiData, setAiApiData] = useState<any | null>(null);  // FastAPI AI response

    const go = (s: AppScreen) => setScreen(s);

    return (
        <div className="min-h-screen px-4 md:px-6 py-4">
            <AnimatePresence mode="wait">
                {screen === 'landing' && (
                    <LandingScreen key="landing" onAnalyze={() => go('import-method')} onBuild={() => go('onboarding-questions')} />
                )}
                {screen === 'import-method' && (
                    <ImportMethodScreen key="import-method" onBack={() => go('landing')} onManual={() => go('portfolio-builder')} />
                )}
                {screen === 'portfolio-builder' && (
                    <ManualPortfolioBuilderScreen key="portfolio-builder" onBack={() => go('import-method')} onRestart={() => go('landing')} />
                )}
                {screen === 'onboarding-questions' && (
                    <OnboardingScreen key="onboarding-questions" onBack={() => go('landing')}
                        onComplete={(answers) => { setOnboardingAnswers(answers); go('ai-building'); }} />
                )}
                {/* FIX: AIBuildingScreen now receives answers and calls FastAPI */}
                {screen === 'ai-building' && onboardingAnswers && (
                    <AIBuildingScreen key="ai-building" answers={onboardingAnswers}
                        onDone={(data) => { setAiApiData(data); go('beginner-results'); }} />
                )}
                {/* FIX: BeginnerResultsScreen now receives the FastAPI response */}
                {screen === 'beginner-results' && onboardingAnswers && (
                    <BeginnerResultsScreen key="beginner-results" answers={onboardingAnswers} apiData={aiApiData}
                        onBack={() => go('onboarding-questions')}
                        onRestart={() => { setOnboardingAnswers(null); setAiApiData(null); go('landing'); }} />
                )}
            </AnimatePresence>
        </div>
    );
}
