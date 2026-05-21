'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Briefcase, Plus, Trash2, TrendingUp, AlertTriangle,
  ChevronRight, Loader2, RefreshCw, Info, Target, Activity,
  BarChart3, Shield, Zap, PieChart as PieIcon, FlaskConical
} from 'lucide-react';
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, PieChart, Pie, Cell, BarChart, Bar, Legend, ReferenceDot
} from 'recharts';

// ──────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────
interface Stock {
  ticker: string;
  name: string;
  allocation: number; // percentage
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
}

// ──────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────
const SUGGESTED_STOCKS = [
  { ticker: 'RELIANCE.NS', name: 'Reliance Industries' },
  { ticker: 'TCS.NS',      name: 'Tata Consultancy Services' },
  { ticker: 'INFY.NS',     name: 'Infosys' },
  { ticker: 'HDFCBANK.NS', name: 'HDFC Bank' },
  { ticker: 'ICICIBANK.NS',name: 'ICICI Bank' },
  { ticker: 'WIPRO.NS',    name: 'Wipro' },
  { ticker: 'TATAMOTORS.NS', name: 'Tata Motors' },
  { ticker: 'BHARTIARTL.NS', name: 'Bharti Airtel' },
  { ticker: 'SBIN.NS',     name: 'State Bank of India' },
  { ticker: 'BAJFINANCE.NS', name: 'Bajaj Finance' },
];

const RISK_PROFILES = [
  { id: 'conservative', label: 'Conservative', desc: 'Capital preservation, low volatility', color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/5' },
  { id: 'balanced',     label: 'Balanced',     desc: 'Moderate growth with managed risk',   color: 'text-blue-400',    border: 'border-blue-500/30',    bg: 'bg-blue-500/5'    },
  { id: 'aggressive',   label: 'Aggressive',   desc: 'High growth, higher risk tolerance',  color: 'text-violet-400',  border: 'border-violet-500/30',  bg: 'bg-violet-500/5'  },
];

const PIE_COLORS = [
  '#6366f1', '#22c55e', '#3b82f6', '#f59e0b',
  '#ec4899', '#14b8a6', '#f97316', '#8b5cf6',
];

// ──────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, accent = 'violet' }: { icon: any; title: string; accent?: string }) {
  const colors: Record<string, string> = {
    violet: 'from-violet-500 to-indigo-500',
    blue: 'from-blue-500 to-cyan-500',
    emerald: 'from-emerald-500 to-teal-500',
    amber: 'from-amber-500 to-orange-500',
    red: 'from-red-500 to-pink-500',
  };
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className={`w-0.5 h-4 rounded-full bg-gradient-to-b ${colors[accent] ?? colors.violet}`} />
      <Icon className="w-3.5 h-3.5 text-violet-400" />
      <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
        {title}
      </h2>
      <div className="flex-1 h-px bg-gradient-to-r from-slate-200/60 dark:from-white/[0.04] to-transparent" />
    </div>
  );
}

function MetricCard({ label, value, sub, color, tooltip }: {
  label: string; value: string; sub?: string; color?: string; tooltip?: string;
}) {
  return (
    <div className="glass-card p-3 flex flex-col gap-0.5 group relative">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-500">{label}</span>
        {tooltip && (
          <div className="relative">
            <Info className="w-2.5 h-2.5 text-slate-600 cursor-help" />
          </div>
        )}
      </div>
      <span className={`text-[18px] font-bold tabular-nums leading-tight ${color ?? 'text-slate-900 dark:text-white'}`}>
        {value}
      </span>
      {sub && <span className="text-[10px] text-slate-500 font-medium">{sub}</span>}
    </div>
  );
}

function EmptyFrontierState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 py-12">
      <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
        <FlaskConical className="w-7 h-7 text-violet-400" />
      </div>
      <div className="text-center">
        <div className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">Efficient Frontier</div>
        <div className="text-[11px] text-slate-500 mt-0.5">Add stocks and run analysis to generate frontier</div>
      </div>
    </div>
  );
}

const CUSTOM_SCATTER_DOT = (props: any) => {
  const { cx, cy, payload } = props;
  if (payload.label === 'current') {
    return <circle cx={cx} cy={cy} r={7} fill="#6366f1" stroke="#a5b4fc" strokeWidth={2} />;
  }
  if (payload.label === 'max_sharpe') {
    return <circle cx={cx} cy={cy} r={7} fill="#22c55e" stroke="#86efac" strokeWidth={2} />;
  }
  if (payload.label === 'min_vol') {
    return <circle cx={cx} cy={cy} r={7} fill="#f59e0b" stroke="#fcd34d" strokeWidth={2} />;
  }
  return <circle cx={cx} cy={cy} r={3} fill="rgba(99,102,241,0.4)" stroke="transparent" />;
};

// ──────────────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────────────
export default function PortfolioOptimizerPage() {
  const [portfolioName, setPortfolioName] = useState('My Portfolio');
  const [capital, setCapital] = useState(1000000);
  const [riskProfile, setRiskProfile] = useState<'conservative' | 'balanced' | 'aggressive'>('balanced');
  const [stocks, setStocks] = useState<Stock[]>([
    { ticker: 'RELIANCE.NS', name: 'Reliance Industries', allocation: 25 },
    { ticker: 'TCS.NS', name: 'Tata Consultancy Services', allocation: 25 },
    { ticker: 'INFY.NS', name: 'Infosys', allocation: 25 },
    { ticker: 'HDFCBANK.NS', name: 'HDFC Bank', allocation: 25 },
  ]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [experienceMode, setExperienceMode] = useState<'simple' | 'advanced'>('simple');
  const [activeTab, setActiveTab] = useState<'overview' | 'optimization' | 'risk' | 'advancedQuant'>('overview');
  const [advancedTab, setAdvancedTab] = useState<'frontier' | 'correlation' | 'montecarlo' | 'var'>('frontier');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [failedTickers, setFailedTickers] = useState<string[]>([]);

  const totalAllocation = stocks.reduce((s, st) => s + st.allocation, 0);
  const isValid = stocks.length >= 2 && totalAllocation === 100;

  const addStock = (ticker: string, name: string) => {
    if (stocks.find(s => s.ticker === ticker)) return;
    const share = Math.floor(100 / (stocks.length + 1));
    const newStocks = [...stocks.map(s => ({ ...s, allocation: share })), { ticker, name, allocation: share }];
    // normalize to 100
    const diff = 100 - newStocks.reduce((a, s) => a + s.allocation, 0);
    newStocks[0].allocation += diff;
    setStocks(newStocks);
    setSearchQuery('');
    setShowSuggestions(false);
  };

  const removeStock = (ticker: string) => {
    const remaining = stocks.filter(s => s.ticker !== ticker);
    if (remaining.length === 0) { setStocks([]); return; }
    const share = Math.floor(100 / remaining.length);
    const normalized = remaining.map(s => ({ ...s, allocation: share }));
    const diff = 100 - normalized.reduce((a, s) => a + s.allocation, 0);
    normalized[0].allocation += diff;
    setStocks(normalized);
  };

  const updateAllocation = (ticker: string, val: number) => {
    setStocks(prev => prev.map(s => s.ticker === ticker ? { ...s, allocation: val } : s));
  };

  const normalizeAllocations = () => {
    const total = stocks.reduce((s, st) => s + st.allocation, 0);
    if (total === 0) return;
    setStocks(prev => prev.map(s => ({ ...s, allocation: Math.round((s.allocation / total) * 100) })));
  };

  const runAnalysis = useCallback(async () => {
    if (!isValid) return;
    setLoading(true);
    setError(null);
    setWarnings([]);
    setFailedTickers([]);
    try {
      const weights: Record<string, number> = {};
      stocks.forEach(s => { weights[s.ticker] = s.allocation / 100; });

      const res = await fetch('http://localhost:8080/api/portfolio/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers: stocks.map(s => s.ticker), weights, riskProfile }),
      });

      const data = await res.json();
      
      if (data.warnings) setWarnings(data.warnings);
      if (data.failedTickers) setFailedTickers(data.failedTickers);

      if (!res.ok) {
        throw new Error(data.error || 'Analysis failed');
      }
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

  // Chart data
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

  const frontierLine = frontierData.filter(d => d.label === 'frontier');
  const keyPoints = frontierData.filter(d => d.label !== 'frontier');
  const isAdvancedView = experienceMode === 'advanced';

  const health = useMemo(() => {
    const diversification = metrics?.diversificationScore ?? Math.min(95, stocks.length * 18);
    const concentrationRisk = Math.max(...stocks.map(s => s.allocation));
    const concentrationScore = Math.max(0, 100 - (concentrationRisk - 25) * 2.2);
    const stabilityScore = metrics ? Math.max(0, 100 - metrics.volatility * 200) : 55;
    const sectorBalance = Math.max(45, 100 - Math.max(0, stocks.length < 4 ? 28 : 0));
    const portfolioHealthScore = Math.max(
      0,
      Math.min(100, Math.round((diversification * 0.3) + (concentrationScore * 0.25) + (stabilityScore * 0.25) + (sectorBalance * 0.2)))
    );
    return { diversification, concentrationScore, stabilityScore, sectorBalance, concentrationRisk, portfolioHealthScore };
  }, [metrics, stocks]);

  const beginnerInsights = useMemo(() => {
    const insights: string[] = [];
    if (health.concentrationRisk >= 38) {
      insights.push('Your portfolio is heavily concentrated in a few stocks. Consider reducing the biggest weights.');
    }
    if (metrics && metrics.volatility > 0.22) {
      insights.push('Portfolio risk is on the higher side. A little more spread can improve stability.');
    } else {
      insights.push('Portfolio risk is moderate for current allocation.');
    }
    if ((metrics?.diversificationScore ?? health.diversification) < 62) {
      insights.push('Diversification can be improved by adding stocks from different sectors.');
    }
    const techExposure = stocks
      .filter(s => ['TCS.NS', 'INFY.NS', 'WIPRO.NS'].includes(s.ticker))
      .reduce((sum, s) => sum + s.allocation, 0);
    if (techExposure >= 35) {
      insights.push('Technology sector exposure is high. Add non-tech names to balance risk.');
    }
    if (insights.length === 0) {
      insights.push('Your portfolio looks reasonably balanced. Review allocations monthly.');
    }
    return insights.slice(0, 4);
  }, [health.concentrationRisk, health.diversification, metrics, stocks]);

  return (
    <div className="min-h-screen p-4 md:p-6">
      {/* ── Page Header ── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-violet-400" />
            </div>
            <h1 className="text-[22px] font-bold text-slate-900 dark:text-white">Portfolio Optimizer</h1>
            <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded border bg-violet-500/10 text-violet-400 border-violet-500/20">
              MPT Engine
            </span>
          </div>
          <p className="text-[12px] text-slate-500 ml-10">
            Start simple, then expand into deep quant analytics when you need them.
          </p>
        </div>
        <button
          onClick={runAnalysis}
          disabled={!isValid || loading}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-semibold transition-all duration-200 ${
            isValid && !loading
              ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/25'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          }`}
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
          {loading ? 'Computing...' : 'Run Optimization'}
        </button>
      </div>

      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="glass-card p-1 flex gap-1">
          {([
            ['simple', 'Simple View'],
            ['advanced', 'Advanced Quant View'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setExperienceMode(id)}
              className={`px-4 py-2 text-[11px] font-semibold rounded-lg transition-all ${
                experienceMode === id
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/20'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="text-[11px] text-slate-500">
          {isAdvancedView ? 'All analytics unlocked' : 'Beginner mode with progressive detail'}
        </div>
      </div>

      {/* ── Status Bar ── */}
      <div className="flex items-center gap-3 mb-5 text-[10px]">
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
          totalAllocation === 100 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${totalAllocation === 100 ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
          Allocation: {totalAllocation}% {totalAllocation !== 100 && '— must be 100%'}
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-slate-500/5 border-slate-500/15 text-slate-500">
          <Activity className="w-3 h-3" />
          {stocks.length} assets · ₹{capital.toLocaleString('en-IN')} capital
        </div>
        {totalAllocation !== 100 && stocks.length > 0 && (
          <button onClick={normalizeAllocations} className="flex items-center gap-1 text-violet-400 hover:text-violet-300 transition-colors">
            <RefreshCw className="w-3 h-3" /> Auto-balance
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-[12px] text-red-400">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="mb-4 flex flex-col gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[12px] text-amber-400">
          <div className="flex items-center gap-2.5 font-bold">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            Analysis Warnings
          </div>
          <ul className="list-disc pl-8 space-y-1 text-[11px] text-amber-500/90">
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      {/* ── Main Grid ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr_300px] gap-4">

        {/* ── LEFT: Portfolio Builder ── */}
        <div className="space-y-4">
          {/* Portfolio Settings */}
          <div className="glass-card p-4">
            <SectionHeader icon={Briefcase} title="Portfolio Config" />
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">Portfolio Name</label>
                <input
                  value={portfolioName}
                  onChange={e => setPortfolioName(e.target.value)}
                  className="w-full text-[12px] bg-black/10 dark:bg-white/5 border border-black/10 dark:border-white/8 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none focus:border-violet-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">Capital (₹)</label>
                <input
                  type="number"
                  value={capital}
                  onChange={e => setCapital(parseInt(e.target.value))}
                  className="w-full text-[12px] bg-black/10 dark:bg-white/5 border border-black/10 dark:border-white/8 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none focus:border-violet-500/50 transition-colors tabular-nums"
                />
              </div>
            </div>
          </div>

          {/* Risk Profile */}
          <div className="glass-card p-4">
            <SectionHeader icon={Shield} title="Risk Profile" />
            <div className="space-y-2">
              {RISK_PROFILES.map(p => (
                <button
                  key={p.id}
                  onClick={() => setRiskProfile(p.id as any)}
                  className={`w-full text-left p-2.5 rounded-xl border transition-all duration-150 ${
                    riskProfile === p.id ? `${p.bg} ${p.border}` : 'border-transparent hover:border-white/8 hover:bg-white/3'
                  }`}
                >
                  <div className={`text-[12px] font-semibold ${riskProfile === p.id ? p.color : 'text-slate-400'}`}>{p.label}</div>
                  <div className="text-[10px] text-slate-600 mt-0.5">{p.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Stock Search */}
          <div className="glass-card p-4">
            <SectionHeader icon={Plus} title="Add Stocks" />
            <div className="relative">
              <input
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Search ticker or company..."
                className="w-full text-[12px] bg-black/10 dark:bg-white/5 border border-black/10 dark:border-white/8 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none focus:border-violet-500/50 transition-colors"
              />
              {showSuggestions && filteredSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 z-20 glass-card border border-white/8 overflow-hidden">
                  {filteredSuggestions.slice(0, 6).map(s => (
                    <button
                      key={s.ticker}
                      onClick={() => addStock(s.ticker, s.name)}
                      className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-violet-500/10 transition-colors border-b border-white/4 last:border-0"
                    >
                      <ChevronRight className="w-3 h-3 text-violet-400 flex-shrink-0" />
                      <div>
                        <div className="text-[11px] font-bold text-slate-900 dark:text-white">{s.ticker.replace('.NS', '')}</div>
                        <div className="text-[9px] text-slate-500">{s.name}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Allocation Table */}
          {stocks.length > 0 && (
            <div>
              <SectionHeader icon={BarChart3} title="Portfolio Allocation" />
              <div className="glass-card overflow-hidden">
                <table className="w-full text-[10px]">
                  <thead className="bg-white/5">
                    <tr className="text-slate-500 uppercase tracking-wide">
                      <th className="px-2 py-2 text-left">Stock</th>
                      <th className="px-2 py-2 text-right">Weight</th>
                      <th className="px-2 py-2 text-left">Allocation</th>
                      <th className="px-2 py-2 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {stocks.map(stock => (
                      <tr key={stock.ticker}>
                        <td className="px-2 py-2">
                          <div className="text-[11px] font-semibold text-slate-900 dark:text-white">{stock.ticker.replace('.NS', '')}</div>
                          <div className="text-[9px] text-slate-500 truncate max-w-[110px]">{stock.name}</div>
                        </td>
                        <td className="px-2 py-2 text-right">
                          <input
                            type="number"
                            min={1}
                            max={95}
                            value={stock.allocation}
                            onChange={e => updateAllocation(stock.ticker, parseInt(e.target.value || '0'))}
                            className="w-14 text-right text-[11px] bg-black/10 dark:bg-white/5 border border-black/10 dark:border-white/8 rounded px-1.5 py-1 text-slate-900 dark:text-white"
                          />
                          <span className="ml-1 text-slate-500">%</span>
                        </td>
                        <td className="px-2 py-2 min-w-[110px]">
                          <input
                            type="range"
                            min={1}
                            max={80}
                            value={stock.allocation}
                            onChange={e => updateAllocation(stock.ticker, parseInt(e.target.value))}
                            className="w-full h-1 rounded-full appearance-none cursor-pointer accent-violet-500"
                          />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <button onClick={() => removeStock(stock.ticker)} className="text-slate-500 hover:text-red-400 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ── CENTER: Charts ── */}
        <div className="space-y-4">
          {/* Tab Bar */}
          <div className="glass-card p-1 flex gap-1">
            {([
              ['overview', 'Overview'],
              ['optimization', 'Optimization'],
              ['risk', 'Risk'],
              ['advancedQuant', 'Advanced Quant'],
            ] as const)
              .filter(([id]) => isAdvancedView || id !== 'advancedQuant')
              .map(([id, label]) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex-1 py-2 text-[11px] font-semibold rounded-lg transition-all duration-150 ${
                  activeTab === id
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/20'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {activeTab === 'advancedQuant' && isAdvancedView && (
            <div className="glass-card p-1 flex gap-1">
              {([
                ['frontier', 'Efficient Frontier'],
                ['correlation', 'Correlation Matrix'],
                ['montecarlo', 'Monte Carlo'],
                ['var', 'VaR Analytics'],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setAdvancedTab(id)}
                  className={`flex-1 py-2 text-[10px] font-semibold rounded-lg transition-all duration-150 ${
                    advancedTab === id
                      ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/20'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Chart Area */}
          <div className="glass-card p-5" style={{ minHeight: 380 }}>
            {activeTab === 'overview' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-[13px] font-bold text-slate-900 dark:text-white">Portfolio Health Score</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">A quick quality check across spread, concentration, stability, and balance.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="glass-card p-4">
                    <div className="text-[11px] text-slate-500 mb-2">Health Score (0-100)</div>
                    <div className={`text-[34px] font-bold ${health.portfolioHealthScore >= 75 ? 'text-emerald-400' : health.portfolioHealthScore >= 55 ? 'text-amber-400' : 'text-red-400'}`}>
                      {health.portfolioHealthScore}
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-500" style={{ width: `${health.portfolioHealthScore}%` }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <MetricCard label="Portfolio Spread" value={`${health.diversification.toFixed(0)}%`} />
                    <MetricCard label="Concentration Risk" value={`${Math.round(100 - health.concentrationScore)}%`} color="text-red-400" />
                    <MetricCard label="Stability Score" value={`${health.stabilityScore.toFixed(0)}%`} color="text-amber-400" />
                    <MetricCard label="Sector Balance" value={`${health.sectorBalance.toFixed(0)}%`} color="text-violet-400" />
                  </div>
                </div>
                <div className="glass-card p-4">
                  <h4 className="text-[12px] font-semibold text-slate-900 dark:text-white mb-2">AI Insights</h4>
                  <div className="space-y-2">
                    {beginnerInsights.map((insight, idx) => (
                      <div key={idx} className="text-[11px] text-slate-400 leading-relaxed border-l-2 border-violet-500/40 pl-2">
                        {insight}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'optimization' && (
              <div className="flex flex-col items-center">
                <h3 className="text-[13px] font-bold text-slate-900 dark:text-white mb-1">Allocation Quality</h3>
                <p className="text-[10px] text-slate-500 mb-4">Visual distribution of current portfolio weights</p>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110} innerRadius={60} paddingAngle={3}
                      label={({ name, value }) => `${name} ${value}%`} labelLine={{ stroke: 'rgba(100,116,139,0.5)' }}>
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} stroke="transparent" />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 11 }}
                      formatter={(v: any) => [`${v}%`, 'Allocation']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {activeTab === 'risk' && (
              <div className="space-y-3">
                <div>
                  <h3 className="text-[13px] font-bold text-slate-900 dark:text-white">Risk Snapshot</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">Understand downside and stability at a glance.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <MetricCard label="Portfolio Risk" value={metrics ? `${(metrics.volatility * 100).toFixed(2)}%` : '—'} sub="Annualized range" color="text-amber-400" />
                  <MetricCard label="Potential Daily Loss" value={metrics ? `${(metrics.varStats.var95 * 100).toFixed(2)}%` : '—'} sub="95% confidence" color="text-red-400" />
                  <MetricCard label="Worst Historical Fall" value={metrics ? `${(metrics.varStats.maxDrawdown * 100).toFixed(2)}%` : '—'} sub="Peak-to-trough" color="text-orange-400" />
                </div>
              </div>
            )}

            {activeTab === 'advancedQuant' && advancedTab === 'frontier' && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-[13px] font-bold text-slate-900 dark:text-white">Efficient Frontier</h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">Risk vs. Expected Return — {metrics ? 'Monte Carlo sampled' : 'Run analysis to compute'}</p>
                  </div>
                  {metrics && (
                    <div className="flex items-center gap-3 text-[9px]">
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
                      <XAxis dataKey="x" name="Risk" unit="%" tick={{ fill: '#64748b', fontSize: 10 }} label={{ value: 'Volatility (%)', position: 'insideBottom', offset: -10, fill: '#64748b', fontSize: 10 }} />
                      <YAxis dataKey="y" name="Return" unit="%" tick={{ fill: '#64748b', fontSize: 10 }} label={{ value: 'Expected Return (%)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }} />
                      <Tooltip cursor={{ stroke: 'rgba(99,102,241,0.3)' }} contentStyle={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 11 }} formatter={(v: any) => [`${v}%`]} />
                      <Scatter data={frontierLine} fill="rgba(99,102,241,0.35)" shape={CUSTOM_SCATTER_DOT} />
                      <Scatter data={keyPoints} fill="#6366f1" shape={CUSTOM_SCATTER_DOT} />
                    </ScatterChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyFrontierState />
                )}
              </>
            )}

            {activeTab === 'advancedQuant' && advancedTab === 'montecarlo' && (
              <div className="space-y-3">
                <h3 className="text-[13px] font-bold text-slate-900 dark:text-white">Monte Carlo Projection</h3>
                <p className="text-[10px] text-slate-500">Probabilistic return envelope derived from expected return and volatility.</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <MetricCard label="Expected Path" value={metrics ? `${(metrics.expectedReturn * 100).toFixed(2)}%` : '—'} sub="Mean annual return" color="text-emerald-400" />
                  <MetricCard label="1 Sigma Band" value={metrics ? `+/- ${(metrics.volatility * 100).toFixed(2)}%` : '—'} sub="68% probability" color="text-amber-400" />
                  <MetricCard label="Downside Tail" value={metrics ? `${(metrics.varStats.var99 * 100).toFixed(2)}%` : '—'} sub="99% VaR loss point" color="text-red-400" />
                </div>
              </div>
            )}

            {activeTab === 'advancedQuant' && advancedTab === 'correlation' && metrics && (
              <div>
                <h3 className="text-[13px] font-bold text-slate-900 dark:text-white mb-1">Correlation Matrix</h3>
                <p className="text-[10px] text-slate-500 mb-4">Asset-to-asset linear correlation (1 = perfect, 0 = none, -1 = inverse)</p>
                <div className="overflow-auto">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr>
                        <th className="p-1 text-slate-600" />
                        {stocks.map(s => (
                          <th key={s.ticker} className="p-1 font-semibold text-slate-400 text-center">{s.ticker.replace('.NS', '')}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {stocks.map(row => (
                        <tr key={row.ticker}>
                          <td className="p-1 font-semibold text-slate-400 text-right pr-2">{row.ticker.replace('.NS', '')}</td>
                          {stocks.map(col => {
                            const val = metrics.correlationMatrix[row.ticker]?.[col.ticker] ?? 0;
                            const intensity = Math.abs(val);
                            const bg = val >= 0
                              ? `rgba(99,102,241,${intensity * 0.5})`
                              : `rgba(239,68,68,${intensity * 0.5})`;
                            return (
                              <td key={col.ticker} className="p-1 text-center" style={{ background: bg }}>
                                <span className={`font-mono font-bold ${Math.abs(val) > 0.5 ? 'text-white' : 'text-slate-400'}`}>
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

            {activeTab === 'advancedQuant' && advancedTab === 'var' && (
              <div className="space-y-2">
                <h3 className="text-[13px] font-bold text-slate-900 dark:text-white mb-1">VaR Analytics</h3>
                <p className="text-[10px] text-slate-500 mb-2">Tail-risk view for short-term capital protection planning.</p>
                <MetricCard label="VaR (95%)" value={metrics ? `${(metrics.varStats.var95 * 100).toFixed(2)}%` : '—'} sub="1-day loss threshold" color="text-red-400" />
                <MetricCard label="VaR (99%)" value={metrics ? `${(metrics.varStats.var99 * 100).toFixed(2)}%` : '—'} sub="Extreme loss threshold" color="text-red-500" />
                <MetricCard label="Max Drawdown" value={metrics ? `${(metrics.varStats.maxDrawdown * 100).toFixed(2)}%` : '—'} sub="Historical peak-to-trough" color="text-orange-400" />
              </div>
            )}

            {activeTab === 'advancedQuant' && ((advancedTab === 'correlation' && !metrics) || (advancedTab === 'frontier' && !metrics)) && (
              <EmptyFrontierState />
            )}
          </div>

          {/* Optimization Comparison */}
          {metrics && isAdvancedView && (
            <div className="glass-card p-4">
              <SectionHeader icon={Target} title="Optimization Comparison" accent="emerald" />
              <div className="overflow-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-slate-500 text-[9px] uppercase tracking-wider">
                      <th className="pb-2 text-left font-semibold">Portfolio</th>
                      <th className="pb-2 text-right font-semibold">Return</th>
                      <th className="pb-2 text-right font-semibold">Risk</th>
                      <th className="pb-2 text-right font-semibold">Sharpe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    <tr>
                      <td className="py-2 flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-violet-500" /> Current</td>
                      <td className="py-2 text-right tabular-nums text-slate-300">{(metrics.currentPortfolio.return * 100).toFixed(2)}%</td>
                      <td className="py-2 text-right tabular-nums text-slate-300">{(metrics.currentPortfolio.risk * 100).toFixed(2)}%</td>
                      <td className="py-2 text-right tabular-nums text-slate-300">{metrics.sharpeRatio.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Max Sharpe</td>
                      <td className="py-2 text-right tabular-nums text-emerald-400">{(metrics.optimalPortfolio.return * 100).toFixed(2)}%</td>
                      <td className="py-2 text-right tabular-nums text-emerald-400">{(metrics.optimalPortfolio.risk * 100).toFixed(2)}%</td>
                      <td className="py-2 text-right tabular-nums text-emerald-400">
                        {metrics.optimalPortfolio.risk > 0 ? (metrics.optimalPortfolio.return / metrics.optimalPortfolio.risk).toFixed(2) : '—'}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500" /> Min Volatility</td>
                      <td className="py-2 text-right tabular-nums text-amber-400">{(metrics.minVolPortfolio.return * 100).toFixed(2)}%</td>
                      <td className="py-2 text-right tabular-nums text-amber-400">{(metrics.minVolPortfolio.risk * 100).toFixed(2)}%</td>
                      <td className="py-2 text-right tabular-nums text-amber-400">
                        {metrics.minVolPortfolio.risk > 0 ? (metrics.minVolPortfolio.return / metrics.minVolPortfolio.risk).toFixed(2) : '—'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Analytics Sidebar ── */}
        <div className="space-y-4">
          {/* KPI Cards */}
          <div>
            <SectionHeader icon={TrendingUp} title="Portfolio Metrics" />
            <div className="grid grid-cols-2 gap-2">
              <MetricCard
                label="Expected Return"
                value={metrics ? `${(metrics.expectedReturn * 100).toFixed(2)}%` : '—'}
                sub="Annualized"
                color={metrics && metrics.expectedReturn > 0 ? 'text-emerald-400' : 'text-red-400'}
              />
              <MetricCard
                label={isAdvancedView ? 'Volatility' : 'Price Stability'}
                value={metrics ? `${(metrics.volatility * 100).toFixed(2)}%` : '—'}
                sub={isAdvancedView ? 'Annual Std Dev' : 'How much prices swing'}
                color="text-amber-400"
              />
              <MetricCard
                label={isAdvancedView ? 'Sharpe Ratio' : 'Risk-Adjusted Return'}
                value={metrics ? metrics.sharpeRatio.toFixed(2) : '—'}
                sub={isAdvancedView ? 'Risk-adj return' : 'Return for each unit of risk'}
                color={metrics && metrics.sharpeRatio > 1 ? 'text-emerald-400' : metrics && metrics.sharpeRatio > 0 ? 'text-amber-400' : 'text-red-400'}
                tooltip="Sharpe > 1 is good. > 2 is excellent."
              />
              <MetricCard
                label={isAdvancedView ? 'Diversification' : 'Portfolio Spread'}
                value={metrics ? `${metrics.diversificationScore.toFixed(0)}%` : '—'}
                sub="Portfolio spread"
                color="text-violet-400"
              />
            </div>
          </div>

          {/* Risk Analytics */}
          {isAdvancedView && (
            <div>
              <SectionHeader icon={Shield} title="Risk Analytics" accent="red" />
              <div className="space-y-2">
                <MetricCard
                  label="VaR (95%)"
                  value={metrics ? `${(metrics.varStats.var95 * 100).toFixed(2)}%` : '—'}
                  sub="1-day loss threshold"
                  color="text-red-400"
                />
                <MetricCard
                  label="VaR (99%)"
                  value={metrics ? `${(metrics.varStats.var99 * 100).toFixed(2)}%` : '—'}
                  sub="Extreme loss threshold"
                  color="text-red-500"
                />
                <MetricCard
                  label="Max Drawdown"
                  value={metrics ? `${(metrics.varStats.maxDrawdown * 100).toFixed(2)}%` : '—'}
                  sub="Historical peak-to-trough"
                  color="text-orange-400"
                />
              </div>
            </div>
          )}

          {/* Per-Stock Performance */}
          {metrics && isAdvancedView && (
            <div>
              <SectionHeader icon={Activity} title="Individual Assets" accent="blue" />
              <div className="glass-card overflow-hidden divide-y divide-white/5">
                {stocks.map(stock => {
                  const m = metrics.individualMetrics[stock.ticker];
                  if (!m) return null;
                  const pos = m.annualReturn > 0;
                  return (
                    <div key={stock.ticker} className="flex items-center gap-2 px-3 py-2.5">
                      <div className={`w-1 h-6 rounded-full ${pos ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-bold text-slate-900 dark:text-white">{stock.ticker.replace('.NS', '')}</div>
                        <div className="text-[9px] text-slate-500">{(m.volatility * 100).toFixed(1)}% vol</div>
                      </div>
                      <div className="text-right">
                        <div className={`text-[11px] font-bold tabular-nums ${pos ? 'text-emerald-400' : 'text-red-400'}`}>
                          {pos ? '+' : ''}{(m.annualReturn * 100).toFixed(1)}%
                        </div>
                        <div className="text-[9px] text-slate-600">{stock.allocation}% wt</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Optimal Weights Suggestion */}
          {metrics && isAdvancedView && (
            <div>
              <SectionHeader icon={Target} title="Optimal Weights (Max Sharpe)" accent="emerald" />
              <div className="glass-card overflow-hidden divide-y divide-white/5">
                {Object.entries(metrics.optimalPortfolio.weights).map(([ticker, weight]) => (
                  <div key={ticker} className="flex items-center gap-2 px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-semibold text-slate-300">{ticker.replace('.NS', '')}</div>
                      <div className="h-1 rounded-full bg-white/5 mt-1 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-700"
                          style={{ width: `${(weight * 100).toFixed(0)}%` }} />
                      </div>
                    </div>
                    <span className="text-[11px] font-bold tabular-nums text-emerald-400 ml-2 flex-shrink-0">
                      {(weight * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Helper box when no analysis yet */}
          {!metrics && !loading && (
            <div className="glass-card p-4 border border-violet-500/10 bg-violet-500/5">
              <div className="flex gap-2.5">
                <Info className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
                <div className="text-[11px] text-slate-500 leading-relaxed">
                  Configure your portfolio and click <strong className="text-violet-400">Run Optimization</strong>. You will first see a simple health summary and guidance, while deep quant analytics stay available in <strong className="text-violet-400">Advanced Quant View</strong>.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
