'use client';

/**
 * FinTechAI — AI Portfolio Onboarding
 * ======================================
 * Step-by-step AI wealth advisor flow.
 * Calls FastAPI /api/v2/ai/generate-portfolio (Gemini or rule-based fallback).
 *
 * COPY TO: frontend/src/app/onboarding/page.tsx
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Sparkles, Target, Clock, Shield, DollarSign,
  TrendingUp, ChevronRight, ChevronLeft, Check,
  Loader2, AlertTriangle, BarChart3, Zap, RefreshCw,
  ArrowRight, Briefcase, PieChart,
} from 'lucide-react';
import { aiApi } from '@/lib/api/fastapi';

// ── Types ──────────────────────────────────────────────────────────

interface Allocation {
  name: string;
  ticker: string;
  allocation_pct: number;
  asset_type: string;
  description: string;
  risk_level: string;
  monthly_sip: number;
}

interface SIPProjection {
  monthly_sip: number;
  horizon_years: number;
  expected_rate_low: number;
  expected_rate_high: number;
  projected_value_low: number;
  projected_value_high: number;
  total_invested: number;
}

interface GeneratedPortfolio {
  allocations: Allocation[];
  reasoning: string;
  risk_summary: string;
  expected_return_range: string;
  sip_projection: SIPProjection;
  warnings: string[];
  beginner_explanation: string;
  goal_alignment: string;
  generation_method: 'gemini' | 'rule_based';
}

// ── Constants ──────────────────────────────────────────────────────

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

const GOALS = [
  { id: 'wealth_creation', label: 'Wealth Creation', icon: TrendingUp, desc: 'Grow capital over the long term' },
  { id: 'retirement',      label: 'Retirement',      icon: Shield,     desc: 'Build a comfortable retirement corpus' },
  { id: 'passive_income',  label: 'Passive Income',  icon: DollarSign, desc: 'Generate regular cash flow' },
  { id: 'house_purchase',  label: 'House Purchase',  icon: Target,     desc: 'Save for a home down payment' },
  { id: 'emergency_fund',  label: 'Emergency Fund',  icon: Zap,        desc: 'Capital-safe liquid buffer' },
];

const HORIZONS = [
  { id: '1-3y', label: '1 – 3 Years',  sub: 'Short term' },
  { id: '3-7y', label: '3 – 7 Years',  sub: 'Medium term' },
  { id: '7y+',  label: '7 + Years',    sub: 'Long term' },
];

const RISK_LEVELS = [
  { id: 'conservative', label: 'Conservative', color: '#22c55e', desc: 'Capital preservation first. Mostly debt + gold.' },
  { id: 'balanced',     label: 'Balanced',     color: '#6366f1', desc: 'Growth + stability. Mix of equity and debt.' },
  { id: 'aggressive',   label: 'Aggressive',   color: '#f59e0b', desc: 'Maximum growth. Equity-heavy portfolio.' },
];

const ASSET_PREFS = [
  'Large Cap Equity', 'Mid Cap Equity', 'Small Cap Equity',
  'Index Funds', 'Debt / Bonds', 'Gold ETF',
  'International', 'REITs',
];

const ASSET_TYPE_COLORS: Record<string, string> = {
  equity:        '#6366f1',
  debt:          '#22c55e',
  gold:          '#f59e0b',
  international: '#3b82f6',
  etf:           '#ec4899',
};

// ── Formatters ─────────────────────────────────────────────────────
function formatINR(n: number): string {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

// ── Step Indicator ─────────────────────────────────────────────────
function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="h-1.5 rounded-full transition-all duration-300"
          style={{
            width: i === current ? 24 : 6,
            background: i <= current ? '#6366f1' : 'rgba(99,102,241,0.2)',
          }}
        />
      ))}
    </div>
  );
}

// ── Option Card ────────────────────────────────────────────────────
function OptionCard({
  selected, onClick, children, className = '',
}: {
  selected: boolean; onClick: () => void; children: React.ReactNode; className?: string;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.015 }}
      whileTap={{ scale: 0.985 }}
      className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 ${
        selected
          ? 'border-violet-500/60 bg-violet-500/10 shadow-[0_0_20px_rgba(99,102,241,0.15)]'
          : 'border-white/[0.08] bg-white/[0.03] hover:border-white/[0.15] hover:bg-white/[0.05]'
      } ${className}`}
    >
      {children}
    </motion.button>
  );
}

// ── AI Loading Sequence ────────────────────────────────────────────
const LOADING_STEPS = [
  'Analyzing your financial profile…',
  'Mapping goals to asset classes…',
  'Running portfolio optimization…',
  'Calculating SIP projections…',
  'Generating personalized insights…',
];

function AILoadingScreen() {
  const [stepIndex, setStepIndex] = useState(0);

  useState(() => {
    const interval = setInterval(() => {
      setStepIndex(i => Math.min(i + 1, LOADING_STEPS.length - 1));
    }, 900);
    return () => clearInterval(interval);
  });

  return (
    <div className="flex flex-col items-center justify-center min-h-[340px] gap-8">
      {/* Animated orb */}
      <div className="relative">
        <div className="w-20 h-20 rounded-full border-2 border-violet-500/30 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full border-2 border-t-violet-500 border-r-violet-400 border-b-transparent border-l-transparent animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="w-7 h-7 text-violet-400" />
          </div>
        </div>
        {/* Pulse rings */}
        <div className="absolute inset-0 rounded-full border border-violet-500/20 animate-ping" />
      </div>

      <div className="text-center space-y-3">
        <h3 className="text-base font-bold text-white">AI is building your portfolio</h3>
        <AnimatePresence mode="wait">
          <motion.p
            key={stepIndex}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="text-[13px] text-slate-400"
          >
            {LOADING_STEPS[stepIndex]}
          </motion.p>
        </AnimatePresence>
        <div className="flex items-center justify-center gap-1.5 mt-2">
          {LOADING_STEPS.map((_, i) => (
            <div
              key={i}
              className="h-1 rounded-full transition-all duration-500"
              style={{
                width: i === stepIndex ? 20 : 4,
                background: i <= stepIndex ? '#6366f1' : 'rgba(99,102,241,0.2)',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Portfolio Result ───────────────────────────────────────────────
function PortfolioResult({
  portfolio,
  onRestart,
  formData,
}: {
  portfolio: GeneratedPortfolio;
  onRestart: () => void;
  formData: { monthly_investment: number; horizon: string; risk: string; goal: string };
}) {
  const router = useRouter();
  const proj = portfolio.sip_projection;
  const isGemini = portfolio.generation_method === 'gemini';

  const assetTypeGroups = portfolio.allocations.reduce<Record<string, number>>((acc, a) => {
    acc[a.asset_type] = (acc[a.asset_type] || 0) + a.allocation_pct;
    return acc;
  }, {});

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="space-y-5"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            </div>
            <h2 className="text-[17px] font-black text-white">Your AI Portfolio</h2>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
              isGemini
                ? 'bg-violet-500/10 text-violet-400 border-violet-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            }`}>
              {isGemini ? 'Gemini AI' : 'Template'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            {formData.risk} · {formData.horizon} horizon · {formatINR(formData.monthly_investment)}/month SIP
          </p>
        </div>
        <button
          onClick={onRestart}
          className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-white transition-colors"
        >
          <RefreshCw className="w-3 h-3" /> Regenerate
        </button>
      </div>

      {/* Warnings */}
      {portfolio.warnings.length > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/8 border border-amber-500/15">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
          <span className="text-[11px] text-amber-300/80">{portfolio.warnings.join(' ')}</span>
        </div>
      )}

      {/* SIP Projection */}
      <div className="glass-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-bold text-white">SIP Projection</span>
          <span className="ml-auto text-[10px] text-slate-500">
            Expected {portfolio.expected_return_range}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Monthly SIP',    value: formatINR(proj.monthly_sip),         color: 'text-white' },
            { label: 'Total Invested', value: formatINR(proj.total_invested),       color: 'text-slate-300' },
            { label: 'Low Estimate',   value: formatINR(proj.projected_value_low),  color: 'text-amber-400' },
          ].map(m => (
            <div key={m.label} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] text-center">
              <div className={`text-[15px] font-black tabular-nums ${m.color}`}>{m.value}</div>
              <div className="text-[9px] text-slate-500 mt-0.5">{m.label}</div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-emerald-500/8 border border-emerald-500/15">
          <TrendingUp className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
          <div className="text-[11px] text-emerald-300">
            In {proj.horizon_years} years: <span className="font-bold">{formatINR(proj.projected_value_low)}</span>
            {' – '}
            <span className="font-bold">{formatINR(proj.projected_value_high)}</span>
            <span className="text-slate-500 ml-1">({proj.expected_rate_low}–{proj.expected_rate_high}% p.a.)</span>
          </div>
        </div>
      </div>

      {/* Asset type summary bar */}
      <div className="glass-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <PieChart className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-bold text-white">Asset Mix</span>
        </div>
        <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
          {Object.entries(assetTypeGroups).map(([type, pct]) => (
            <motion.div
              key={type}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: EASE }}
              className="h-full rounded-sm"
              style={{ background: ASSET_TYPE_COLORS[type] ?? '#64748b', minWidth: 4 }}
              title={`${type}: ${pct.toFixed(0)}%`}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          {Object.entries(assetTypeGroups).map(([type, pct]) => (
            <div key={type} className="flex items-center gap-1.5 text-[10px]">
              <span className="w-2 h-2 rounded-sm" style={{ background: ASSET_TYPE_COLORS[type] ?? '#64748b' }} />
              <span className="text-slate-400 capitalize">{type}</span>
              <span className="font-bold text-white">{pct.toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Allocations */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.05]">
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-bold text-white">Recommended Allocation</span>
            <span className="ml-auto text-[10px] text-slate-500">{portfolio.allocations.length} instruments</span>
          </div>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {portfolio.allocations.map((alloc, i) => (
            <motion.div
              key={alloc.ticker}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06, duration: 0.25 }}
              className="flex items-start gap-3 px-5 py-3.5 hover:bg-white/[0.02] transition-colors"
            >
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black flex-shrink-0 mt-0.5"
                style={{
                  background: `${ASSET_TYPE_COLORS[alloc.asset_type] ?? '#64748b'}20`,
                  color: ASSET_TYPE_COLORS[alloc.asset_type] ?? '#64748b',
                  border: `1px solid ${ASSET_TYPE_COLORS[alloc.asset_type] ?? '#64748b'}30`,
                }}
              >
                {alloc.allocation_pct.toFixed(0)}%
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[13px] font-bold text-white leading-tight">{alloc.name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] font-mono text-slate-500">{alloc.ticker}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-500 capitalize">
                        {alloc.asset_type}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded capitalize ${
                        alloc.risk_level === 'low' ? 'text-emerald-400 bg-emerald-500/10' :
                        alloc.risk_level === 'moderate' ? 'text-violet-400 bg-violet-500/10' :
                        'text-amber-400 bg-amber-500/10'
                      }`}>{alloc.risk_level}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-[12px] font-bold text-white">{formatINR(alloc.monthly_sip)}</div>
                    <div className="text-[9px] text-slate-500">per month</div>
                  </div>
                </div>
                {/* Allocation bar */}
                <div className="mt-2 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: ASSET_TYPE_COLORS[alloc.asset_type] ?? '#6366f1' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${alloc.allocation_pct}%` }}
                    transition={{ delay: i * 0.06 + 0.2, duration: 0.7, ease: EASE }}
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">{alloc.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* AI reasoning */}
      <div className="glass-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-bold text-white">AI Reasoning</span>
        </div>
        <p className="text-[12px] text-slate-400 leading-relaxed">{portfolio.reasoning}</p>
        {portfolio.beginner_explanation && (
          <div className="mt-3 p-3 rounded-xl bg-blue-500/6 border border-blue-500/15">
            <div className="text-[10px] font-bold text-blue-400 mb-1 uppercase tracking-wider">For Beginners</div>
            <p className="text-[11px] text-slate-400 leading-relaxed">{portfolio.beginner_explanation}</p>
          </div>
        )}
        {portfolio.goal_alignment && (
          <div className="p-3 rounded-xl bg-emerald-500/6 border border-emerald-500/15">
            <div className="text-[10px] font-bold text-emerald-400 mb-1 uppercase tracking-wider">Goal Alignment</div>
            <p className="text-[11px] text-slate-400 leading-relaxed">{portfolio.goal_alignment}</p>
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="flex gap-3">
        <button
          onClick={() => router.push('/portfolio')}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-[13px] font-bold text-white transition-all"
          style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
        >
          <Briefcase className="w-4 h-4" />
          Go to Portfolio Dashboard
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────
export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState('');
  const [horizon, setHorizon] = useState('');
  const [risk, setRisk] = useState('');
  const [monthlyInvestment, setMonthlyInvestment] = useState(10000);
  const [assetPrefs, setAssetPrefs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [portfolio, setPortfolio] = useState<GeneratedPortfolio | null>(null);

  const TOTAL_STEPS = 4;

  const canProceed = [
    !!goal,
    !!horizon,
    !!risk,
    monthlyInvestment >= 500,
  ][step] ?? false;

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await aiApi.generatePortfolio({
        goal,
        horizon,
        risk,
        monthly_investment: monthlyInvestment,
        asset_preferences: assetPrefs.length > 0 ? assetPrefs : undefined,
      });
      setPortfolio(result as unknown as GeneratedPortfolio);
      setStep(TOTAL_STEPS); // results step
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Portfolio generation failed. Check FastAPI backend.');
    } finally {
      setLoading(false);
    }
  }, [goal, horizon, risk, monthlyInvestment, assetPrefs]);

  const handleNext = () => {
    if (step === TOTAL_STEPS - 1) {
      handleGenerate();
    } else {
      setStep(s => s + 1);
    }
  };

  const handleRestart = () => {
    setStep(0);
    setGoal('');
    setHorizon('');
    setRisk('');
    setMonthlyInvestment(10000);
    setAssetPrefs([]);
    setPortfolio(null);
    setError(null);
  };

  const slideVariants = {
    enter: { opacity: 0, x: 24 },
    center: { opacity: 1, x: 0 },
    exit:  { opacity: 0, x: -24 },
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="w-full max-w-xl">

        {/* Header */}
        {step < TOTAL_STEPS && !loading && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 mb-4">
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-[11px] font-bold text-violet-400">AI Wealth Advisor</span>
            </div>
            <h1 className="text-2xl font-black text-white">Build Your Portfolio</h1>
            <p className="text-[13px] text-slate-500 mt-1">
              Answer 4 questions. Get an AI-powered investment plan in seconds.
            </p>
          </motion.div>
        )}

        {/* Progress */}
        {step < TOTAL_STEPS && !loading && (
          <div className="flex items-center justify-between mb-6 px-1">
            <StepDots current={step} total={TOTAL_STEPS} />
            <span className="text-[10px] text-slate-500">Step {step + 1} of {TOTAL_STEPS}</span>
          </div>
        )}

        {/* Card */}
        <div className="glass-card p-6 min-h-[360px] flex flex-col">
          {loading ? (
            <AILoadingScreen />
          ) : portfolio ? (
            <PortfolioResult
              portfolio={portfolio}
              onRestart={handleRestart}
              formData={{ monthly_investment: monthlyInvestment, horizon, risk, goal }}
            />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25, ease: EASE }}
                className="flex-1 flex flex-col gap-5"
              >

                {/* Step 0: Goal */}
                {step === 0 && (
                  <>
                    <div className="flex items-center gap-2">
                      <Target className="w-5 h-5 text-violet-400" />
                      <h2 className="text-base font-bold text-white">What's your primary goal?</h2>
                    </div>
                    <div className="grid grid-cols-1 gap-2.5">
                      {GOALS.map(g => {
                        const Icon = g.icon;
                        return (
                          <OptionCard key={g.id} selected={goal === g.id} onClick={() => setGoal(g.id)}>
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                goal === g.id ? 'bg-violet-500/20' : 'bg-white/[0.05]'
                              }`}>
                                <Icon className={`w-4 h-4 ${goal === g.id ? 'text-violet-400' : 'text-slate-500'}`} />
                              </div>
                              <div>
                                <div className={`text-[13px] font-bold ${goal === g.id ? 'text-white' : 'text-slate-300'}`}>
                                  {g.label}
                                </div>
                                <div className="text-[11px] text-slate-500">{g.desc}</div>
                              </div>
                              {goal === g.id && (
                                <div className="ml-auto w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center flex-shrink-0">
                                  <Check className="w-3 h-3 text-white" />
                                </div>
                              )}
                            </div>
                          </OptionCard>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* Step 1: Horizon */}
                {step === 1 && (
                  <>
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-violet-400" />
                      <h2 className="text-base font-bold text-white">What's your investment horizon?</h2>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {HORIZONS.map(h => (
                        <OptionCard key={h.id} selected={horizon === h.id} onClick={() => setHorizon(h.id)}>
                          <div className="text-center py-2">
                            <div className={`text-[14px] font-black ${horizon === h.id ? 'text-white' : 'text-slate-400'}`}>
                              {h.label}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">{h.sub}</div>
                            {horizon === h.id && (
                              <div className="mt-2 flex justify-center">
                                <div className="w-4 h-4 rounded-full bg-violet-500 flex items-center justify-center">
                                  <Check className="w-2.5 h-2.5 text-white" />
                                </div>
                              </div>
                            )}
                          </div>
                        </OptionCard>
                      ))}
                    </div>
                  </>
                )}

                {/* Step 2: Risk */}
                {step === 2 && (
                  <>
                    <div className="flex items-center gap-2">
                      <Shield className="w-5 h-5 text-violet-400" />
                      <h2 className="text-base font-bold text-white">What's your risk appetite?</h2>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {RISK_LEVELS.map(r => (
                        <OptionCard key={r.id} selected={risk === r.id} onClick={() => setRisk(r.id)}>
                          <div className="flex items-center gap-3">
                            <div
                              className="w-3 h-8 rounded-full flex-shrink-0"
                              style={{ background: r.color, opacity: risk === r.id ? 1 : 0.3 }}
                            />
                            <div className="flex-1">
                              <div className={`text-[14px] font-bold capitalize ${risk === r.id ? 'text-white' : 'text-slate-400'}`}>
                                {r.label}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">{r.desc}</div>
                            </div>
                            {risk === r.id && (
                              <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                                   style={{ background: r.color }}>
                                <Check className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </div>
                        </OptionCard>
                      ))}
                    </div>
                  </>
                )}

                {/* Step 3: Amount + Preferences */}
                {step === 3 && (
                  <>
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-violet-400" />
                      <h2 className="text-base font-bold text-white">Monthly SIP amount</h2>
                    </div>

                    {/* Amount input */}
                    <div className="space-y-2">
                      <div className="relative flex items-center">
                        <span className="absolute left-4 text-slate-400 font-bold text-sm pointer-events-none">₹</span>
                        <input
                          type="number"
                          value={monthlyInvestment}
                          onChange={e => setMonthlyInvestment(Math.max(500, Number(e.target.value)))}
                          className="w-full bg-white/[0.04] border border-white/[0.1] rounded-xl text-white text-lg font-bold
                            pl-8 pr-4 py-3 outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20
                            transition-all tabular-nums"
                          min={500}
                          step={500}
                        />
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {[5000, 10000, 25000, 50000].map(amt => (
                          <button
                            key={amt}
                            onClick={() => setMonthlyInvestment(amt)}
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border ${
                              monthlyInvestment === amt
                                ? 'bg-violet-500/15 text-violet-400 border-violet-500/30'
                                : 'bg-white/[0.03] text-slate-500 border-white/[0.06] hover:border-white/[0.12]'
                            }`}
                          >
                            ₹{(amt / 1000).toFixed(0)}K
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Asset preferences */}
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.1em]">
                        Asset Preferences <span className="text-slate-600 normal-case">(optional)</span>
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {ASSET_PREFS.map(pref => {
                          const active = assetPrefs.includes(pref);
                          return (
                            <button
                              key={pref}
                              onClick={() => setAssetPrefs(prev =>
                                active ? prev.filter(p => p !== pref) : [...prev, pref]
                              )}
                              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all border ${
                                active
                                  ? 'bg-violet-500/15 text-violet-400 border-violet-500/30'
                                  : 'bg-white/[0.02] text-slate-500 border-white/[0.06] hover:border-white/[0.12]'
                              }`}
                            >
                              {active && <Check className="w-2.5 h-2.5 inline mr-1" />}
                              {pref}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Summary */}
                    {goal && horizon && risk && (
                      <div className="p-3 rounded-xl bg-violet-500/6 border border-violet-500/15 text-[11px] text-slate-400 space-y-1">
                        <div className="font-bold text-white text-[12px] mb-1.5">Ready to generate your portfolio:</div>
                        <div>Goal: <span className="text-white capitalize">{goal.replace(/_/g, ' ')}</span></div>
                        <div>Horizon: <span className="text-white">{horizon}</span></div>
                        <div>Risk: <span className="text-white capitalize">{risk}</span></div>
                        <div>Monthly SIP: <span className="text-white">{formatINR(monthlyInvestment)}</span></div>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {/* Error */}
        {error && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20"
          >
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-[11px] text-red-300">{error}</div>
          </motion.div>
        )}

        {/* Navigation */}
        {!loading && !portfolio && (
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={() => step > 0 ? setStep(s => s - 1) : undefined}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[12px] font-semibold transition-all
                ${step > 0
                  ? 'text-slate-300 border border-white/[0.08] hover:bg-white/[0.05]'
                  : 'text-slate-600 cursor-not-allowed'
                }`}
              disabled={step === 0}
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>

            <motion.button
              onClick={handleNext}
              disabled={!canProceed}
              whileHover={{ scale: canProceed ? 1.02 : 1 }}
              whileTap={{ scale: canProceed ? 0.97 : 1 }}
              className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-[12px] font-bold text-white
                disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
            >
              {step === TOTAL_STEPS - 1 ? (
                <><Sparkles className="w-4 h-4" /> Generate Portfolio</>
              ) : (
                <>Next <ChevronRight className="w-4 h-4" /></>
              )}
            </motion.button>
          </div>
        )}

        {loading && (
          <p className="text-center text-[10px] text-slate-600 mt-3">
            This may take up to 30 seconds…
          </p>
        )}
      </div>
    </div>
  );
}
