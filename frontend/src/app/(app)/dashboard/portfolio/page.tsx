'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase, TrendingUp, TrendingDown, Shield, Target, Activity,
  PieChart as PieIcon, BarChart3, AlertTriangle, RefreshCw, Loader2,
  ChevronDown, ChevronUp, Info, Zap, ArrowUpDown, Plus,
  Trash2, Layers3, Gauge, Sparkles, X, Check,
  ArrowUp, ArrowDown, Minus, Eye, EyeOff, DollarSign, Percent,
} from 'lucide-react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';
import {
  portfolioApi,
  type HoldingInput,
  type HoldingsAnalysis,
  type HoldingStats,
  type SectorExposure,
  type RebalanceSuggestion,
} from '@/lib/api/fastapi';

// ── Constants ──────────────────────────────────────────────────────
const SECTOR_COLORS: Record<string, string> = {
  Banking: '#3b82f6', IT: '#6366f1', Pharma: '#ec4899', Energy: '#f59e0b',
  FMCG: '#22c55e', Auto: '#f97316', Telecom: '#14b8a6', Infrastructure: '#06b6d4',
  Metals: '#94a3b8', Finance: '#818cf8', Consumer: '#4ade80', Cement: '#a78bfa',
  Chemicals: '#2dd4bf', 'Real Estate': '#f472b6', 'Oil & Gas': '#fb923c',
  Media: '#c084fc', Other: '#64748b',
};

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

const DEMO_HOLDINGS: HoldingInput[] = [
  { ticker: 'RELIANCE.NS',  name: 'Reliance Industries', quantity: 15, avg_buy_price: 2450, current_price: 2920, sector: 'Energy'  },
  { ticker: 'TCS.NS',       name: 'Tata Consultancy',    quantity: 8,  avg_buy_price: 3500, current_price: 3780, sector: 'IT'      },
  { ticker: 'HDFCBANK.NS',  name: 'HDFC Bank',           quantity: 20, avg_buy_price: 1520, current_price: 1680, sector: 'Banking' },
  { ticker: 'INFY.NS',      name: 'Infosys',             quantity: 12, avg_buy_price: 1400, current_price: 1560, sector: 'IT'      },
  { ticker: 'ICICIBANK.NS', name: 'ICICI Bank',           quantity: 25, avg_buy_price: 980,  current_price: 1150, sector: 'Banking' },
  { ticker: 'SUNPHARMA.NS', name: 'Sun Pharma',           quantity: 10, avg_buy_price: 1100, current_price: 1280, sector: 'Pharma' },
];

const EMPTY_FORM: Omit<HoldingInput, 'sector'> & { sector: string } = {
  ticker: '', name: '', quantity: 0, avg_buy_price: 0, current_price: 0, sector: '',
};

// ── Formatters ─────────────────────────────────────────────────────
function formatINR(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}
function pnlColor(v: number) { return v >= 0 ? 'text-emerald-400' : 'text-red-400'; }
function pnlBg(v: number) {
  return v >= 0
    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    : 'bg-red-500/10 text-red-400 border-red-500/20';
}
function riskColor(level?: string) {
  switch (level) {
    case 'Low':      return { text: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' };
    case 'Moderate': return { text: 'text-violet-400',  bg: 'bg-violet-500/10 border-violet-500/20' };
    case 'Elevated': return { text: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20' };
    default:         return { text: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20' };
  }
}

// ── Skeleton ───────────────────────────────────────────────────────
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded-lg ${className}`} />;
}
function CardSkeleton() {
  return (
    <div className="glass-card p-4 space-y-2.5">
      <Skeleton className="h-2.5 w-16" />
      <Skeleton className="h-6 w-28" />
      <Skeleton className="h-2 w-20" />
    </div>
  );
}
function DashboardSkeleton() {
  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="glass-card p-6 flex flex-col items-center gap-3">
          <Skeleton className="h-2.5 w-28" />
          <Skeleton className="h-36 w-36 rounded-full" />
          <Skeleton className="h-2.5 w-full" />
          <Skeleton className="h-2 w-4/5" />
        </div>
        <div className="glass-card p-6 lg:col-span-2 space-y-3">
          <Skeleton className="h-2.5 w-24" />
          <div className="flex gap-4">
            <Skeleton className="h-44 w-44 rounded-full flex-shrink-0" />
            <div className="flex-1 grid grid-cols-2 gap-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-5" />)}
            </div>
          </div>
        </div>
      </div>
      <div className="glass-card p-5 space-y-3">
        <Skeleton className="h-2.5 w-24" />
        <div className="grid grid-cols-4 lg:grid-cols-8 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
        </div>
      </div>
      <div className="glass-card overflow-hidden">
        <div className="p-4 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
        </div>
      </div>
    </div>
  );
}

// ── Health Gauge ───────────────────────────────────────────────────
function HealthGauge({ score, color, label }: { score: number; color: string; label: string }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(score, 100));
  const dash = (pct / 100) * circumference;
  return (
    <div className="relative flex h-40 w-40 items-center justify-center">
      <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 144 144">
        {/* Track */}
        <circle cx="72" cy="72" r={radius} fill="none" stroke="rgba(148,163,184,0.1)" strokeWidth="10" />
        {/* Glow ring */}
        <circle cx="72" cy="72" r={radius} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`} opacity="0.15" />
        {/* Main arc */}
        <motion.circle
          cx="72" cy="72" r={radius}
          fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          initial={{ strokeDasharray: `0 ${circumference}` }}
          animate={{ strokeDasharray: `${dash} ${circumference}` }}
          transition={{ duration: 1.4, ease: EASE }}
          style={{ filter: `drop-shadow(0 0 8px ${color}88)` }}
        />
      </svg>
      <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full border border-white/[0.06] bg-slate-950/80 backdrop-blur">
        <motion.span
          className="text-4xl font-black tabular-nums leading-none"
          style={{ color }}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          {score}
        </motion.span>
        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mt-0.5">/100</span>
        <span className="mt-1 text-[11px] font-bold" style={{ color }}>{label}</span>
      </div>
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────
function KPICard({
  label, value, sub, color, icon: Icon, trend, highlight,
}: {
  label: string; value: string; sub?: string; color?: string;
  icon?: React.ElementType; trend?: 'up' | 'down' | 'neutral'; highlight?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
      className={`kpi-card p-4 group cursor-default ${highlight ? 'border-violet-500/25' : ''}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</span>
        {Icon && (
          <div className="w-6 h-6 rounded-lg bg-white/[0.04] flex items-center justify-center transition-colors group-hover:bg-violet-500/10">
            <Icon className="w-3 h-3 text-slate-500 group-hover:text-violet-400 transition-colors" />
          </div>
        )}
      </div>
      <div className={`text-[22px] font-black tabular-nums leading-none ${color ?? 'text-slate-900 dark:text-white'}`}>
        {value}
      </div>
      {sub && (
        <div className="flex items-center gap-1 mt-1.5">
          {trend === 'up' && <ArrowUp className="w-2.5 h-2.5 text-emerald-400" />}
          {trend === 'down' && <ArrowDown className="w-2.5 h-2.5 text-red-400" />}
          {trend === 'neutral' && <Minus className="w-2.5 h-2.5 text-slate-500" />}
          <span className="text-[10px] text-slate-500">{sub}</span>
        </div>
      )}
    </motion.div>
  );
}

// ── Metric Tile ───────────────────────────────────────────────────
function MetricTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col gap-1 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] transition-all">
      <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</span>
      <span className={`text-[17px] font-black tabular-nums ${color}`}>{value}</span>
    </div>
  );
}

// ── Custom Tooltip ─────────────────────────────────────────────────
function PremiumTooltip({ active, payload }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload?: { tickers?: string[] } }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="rounded-xl border border-white/[0.12] bg-slate-900/95 px-3.5 py-2.5 text-xs shadow-2xl backdrop-blur ring-1 ring-black/10">
      <div className="font-bold text-white mb-0.5">{d.name}</div>
      <div className="text-slate-300 tabular-nums">{typeof d.value === 'number' ? `${d.value.toFixed(1)}%` : d.value}</div>
      {d.payload?.tickers?.length && (
        <div className="text-slate-500 text-[10px] mt-1">{d.payload.tickers.join(', ')}</div>
      )}
    </div>
  );
}

// ── Add Holding Form ───────────────────────────────────────────────
function AddHoldingForm({ onAdd, onClose }: {
  onAdd: (h: HoldingInput) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const tickerRef = useRef<HTMLInputElement>(null);

  useEffect(() => { tickerRef.current?.focus(); }, []);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.ticker.trim()) e.ticker = 'Required';
    if (!form.name.trim()) e.name = 'Required';
    if (!form.quantity || form.quantity <= 0) e.quantity = 'Must be > 0';
    if (!form.avg_buy_price || form.avg_buy_price <= 0) e.avg_buy_price = 'Must be > 0';
    if (!form.current_price || form.current_price <= 0) e.current_price = 'Must be > 0';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onAdd({
      ticker: form.ticker.trim().toUpperCase().endsWith('.NS')
        ? form.ticker.trim().toUpperCase()
        : `${form.ticker.trim().toUpperCase()}.NS`,
      name: form.name.trim(),
      quantity: Number(form.quantity),
      avg_buy_price: Number(form.avg_buy_price),
      current_price: Number(form.current_price),
      sector: form.sector || undefined,
    });
    onClose();
  };

  const Field = ({ id, label, type = 'text', prefix }: { id: keyof typeof form; label: string; type?: string; prefix?: string }) => (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">{label}</label>
      <div className="relative flex items-center">
        {prefix && <span className="absolute left-3 text-slate-400 text-xs font-semibold pointer-events-none">{prefix}</span>}
        <input
          ref={id === 'ticker' ? tickerRef : undefined}
          type={type}
          value={String(form[id])}
          onChange={e => setForm(f => ({ ...f, [id]: type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value }))}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          className={`w-full bg-white/[0.04] border rounded-lg text-sm text-white placeholder-slate-600
            px-3 py-2 outline-none transition-all
            ${prefix ? 'pl-6' : ''}
            ${errors[id] ? 'border-red-500/50 focus:border-red-500' : 'border-white/[0.08] focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20'}`}
          placeholder={id === 'ticker' ? 'RELIANCE' : id === 'name' ? 'Reliance Industries' : ''}
        />
      </div>
      {errors[id] && <span className="text-[10px] text-red-400">{errors[id]}</span>}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.98 }}
      transition={{ duration: 0.2, ease: EASE }}
      className="glass-card p-5 border-violet-500/20 space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-violet-500/15 flex items-center justify-center">
            <Plus className="w-3.5 h-3.5 text-violet-400" />
          </div>
          <span className="text-sm font-bold text-white">Add Holding</span>
        </div>
        <button onClick={onClose} className="w-6 h-6 rounded-lg hover:bg-white/[0.06] flex items-center justify-center transition-colors">
          <X className="w-3.5 h-3.5 text-slate-400" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field id="ticker" label="Ticker" />
        <Field id="name" label="Company Name" />
        <Field id="quantity" label="Quantity" type="number" />
        <Field id="avg_buy_price" label="Avg Buy Price" type="number" prefix="₹" />
        <Field id="current_price" label="Current Price" type="number" prefix="₹" />
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">Sector <span className="text-slate-600">(optional)</span></label>
          <select
            value={form.sector}
            onChange={e => setForm(f => ({ ...f, sector: e.target.value }))}
            className="bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white px-3 py-2 outline-none focus:border-violet-500/50 transition-all"
          >
            <option value="">Auto-detect</option>
            {Object.keys(SECTOR_COLORS).filter(s => s !== 'Other').map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Live P&L Preview */}
      {form.avg_buy_price > 0 && form.current_price > 0 && form.quantity > 0 && (() => {
        const invested = form.quantity * form.avg_buy_price;
        const value = form.quantity * form.current_price;
        const pnl = value - invested;
        const pnlPct = (pnl / invested) * 100;
        return (
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] text-[11px]">
            <span className="text-slate-500">Preview:</span>
            <span className="text-slate-300">Invested {formatINR(invested)}</span>
            <span className="text-slate-500">→</span>
            <span className="text-white font-semibold">{formatINR(value)}</span>
            <span className={`ml-auto font-bold ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {pnl >= 0 ? '+' : ''}{formatINR(pnl)} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%)
            </span>
          </div>
        );
      })()}

      <div className="flex gap-2 pt-1">
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2 rounded-xl text-[12px] font-semibold border border-white/[0.08] text-slate-400 hover:bg-white/[0.04] transition-all"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          className="flex-1 px-4 py-2 rounded-xl text-[12px] font-bold text-white transition-all"
          style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
        >
          Add to Portfolio
        </button>
      </div>
    </motion.div>
  );
}

// ── Empty State ────────────────────────────────────────────────────
function EmptyState({ onAddDemo, onAdd }: { onAddDemo: () => void; onAdd: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-12 flex flex-col items-center text-center gap-4"
    >
      <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
        <Briefcase className="w-8 h-8 text-violet-400" />
      </div>
      <div>
        <h3 className="text-base font-bold text-white mb-1">No Holdings Yet</h3>
        <p className="text-[12px] text-slate-500 max-w-xs leading-relaxed">
          Add your first stock holding to get AI-powered portfolio analytics, risk metrics, and rebalancing suggestions.
        </p>
      </div>
      <div className="flex gap-2 mt-2">
        <button
          onClick={onAddDemo}
          className="px-4 py-2 rounded-xl text-[12px] font-semibold border border-white/[0.1] text-slate-300 hover:bg-white/[0.05] transition-all"
        >
          Load Demo Portfolio
        </button>
        <button
          onClick={onAdd}
          className="px-4 py-2 rounded-xl text-[12px] font-bold text-white transition-all"
          style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
        >
          <Plus className="w-3.5 h-3.5 inline mr-1" />
          Add Holding
        </button>
      </div>
    </motion.div>
  );
}

// ── API Error State ───────────────────────────────────────────────
function APIErrorState({ error, onRetry, onLoadDemo }: { error: string; onRetry: () => void; onLoadDemo: () => void }) {
  const isNetworkErr = error.toLowerCase().includes('fetch') || error.toLowerCase().includes('network') || error.toLowerCase().includes('timeout');
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="glass-card p-6 border-red-500/20"
    >
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-5 h-5 text-red-400" />
        </div>
        <div className="flex-1">
          <div className="font-bold text-red-400 mb-0.5">Analysis Failed</div>
          <div className="text-[12px] text-slate-400 mb-3">{error}</div>
          {isNetworkErr && (
            <div className="text-[11px] text-slate-500 mb-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.05]">
              <strong className="text-slate-400">FastAPI not reachable.</strong> Start it with:
              <code className="block mt-1 text-emerald-400 font-mono">cd backend/fastapi_app &amp;&amp; uvicorn main:app --port 8000 --reload</code>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={onRetry}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-white/[0.1] text-slate-300 hover:bg-white/[0.05] transition-all"
            >
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
            <button
              onClick={onLoadDemo}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-violet-500/10 border border-violet-500/20 text-violet-400 hover:bg-violet-500/15 transition-all"
            >
              <Eye className="w-3 h-3" /> View Demo Data
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────
export default function PortfolioDashboardPage() {
  const [holdings, setHoldings] = useState<HoldingInput[]>(DEMO_HOLDINGS);
  const [analysis, setAnalysis] = useState<HoldingsAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<'allocation' | 'pnl' | 'value' | 'pnl_pct'>('allocation');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [sectorFilter, setSectorFilter] = useState<string>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [activePieIndex, setActivePieIndex] = useState<number | null>(null);
  const [showValues, setShowValues] = useState(true);
  const [isDemoData, setIsDemoData] = useState(false);

  useEffect(() => { runAnalysis(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const runAnalysis = useCallback(async () => {
    if (holdings.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const result = await portfolioApi.analyzeHoldings(holdings);
      setAnalysis(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Analysis failed. Check FastAPI backend.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [holdings]);

  const loadDemo = useCallback(() => {
    setHoldings(DEMO_HOLDINGS);
    setIsDemoData(true);
    // Trigger re-analysis with demo data
    setLoading(true);
    setError(null);
    portfolioApi.analyzeHoldings(DEMO_HOLDINGS)
      .then(r => setAnalysis(r))
      .catch(e => setError(e instanceof Error ? e.message : 'Analysis failed'))
      .finally(() => setLoading(false));
  }, []);

  const addHolding = useCallback((h: HoldingInput) => {
    setHoldings(prev => [...prev.filter(p => p.ticker !== h.ticker), h]);
    setIsDemoData(false);
  }, []);

  const removeHolding = useCallback((ticker: string) => {
    setHoldings(prev => prev.filter(p => p.ticker !== ticker));
    setAnalysis(null);
  }, []);

  const displayHoldings = useMemo(() => {
    if (!analysis) return [];
    let items = [...analysis.holdings];
    if (sectorFilter !== 'all') items = items.filter(h => h.sector === sectorFilter);
    items.sort((a, b) => {
      const va = (a[sortKey] as number) ?? 0;
      const vb = (b[sortKey] as number) ?? 0;
      return sortDir === 'desc' ? vb - va : va - vb;
    });
    return items;
  }, [analysis, sortKey, sortDir, sectorFilter]);

  const sectors = useMemo(() =>
    analysis ? [...new Set(analysis.holdings.map(h => h.sector))] : [], [analysis]);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sectorPieData = useMemo(() =>
    analysis?.sector_exposure.map((s: SectorExposure) => ({
      name: s.sector, value: s.weight_pct,
      color: SECTOR_COLORS[s.sector] ?? '#64748b',
      tickers: s.tickers,
    })) ?? [], [analysis]);

  const rc = riskColor(analysis?.risk?.risk_level?.level);

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 pb-10 animate-fadeIn max-w-[1400px]">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[17px] font-black flex items-center gap-2 text-white">
            <div className="w-7 h-7 rounded-lg bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
              <Briefcase className="w-3.5 h-3.5 text-violet-400" />
            </div>
            Portfolio Analytics
            {isDemoData && (
              <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded border bg-amber-500/10 text-amber-400 border-amber-500/20">
                Demo
              </span>
            )}
            {analysis && !isDemoData && (
              <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded border bg-emerald-500/10 text-emerald-400 border-emerald-500/20 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            )}
          </h1>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {analysis
              ? `${analysis.totals.holding_count} holdings · ₹${(analysis.totals.total_value / 1e5).toFixed(2)}L portfolio · investor-grade analytics`
              : holdings.length > 0 ? `${holdings.length} holdings ready to analyze` : 'Add holdings to get started'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowValues(v => !v)}
            className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/[0.04] border border-white/[0.08] text-slate-400 hover:text-white hover:bg-white/[0.07] transition-all"
            title={showValues ? 'Hide values' : 'Show values'}
          >
            {showValues ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => setShowAddForm(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold bg-white/[0.04] border border-white/[0.08] text-slate-300 hover:bg-white/[0.07] hover:border-violet-500/30 transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> Add Holding
          </button>
          <motion.button
            onClick={runAnalysis}
            disabled={loading || holdings.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
            whileHover={{ scale: loading ? 1 : 1.02 }}
            whileTap={{ scale: loading ? 1 : 0.97 }}
          >
            {loading
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing…</>
              : <><RefreshCw className="w-3.5 h-3.5" /> Re-analyze</>}
          </motion.button>
        </div>
      </div>

      {/* ── Add Holding Form ──────────────────────────────────── */}
      <AnimatePresence>
        {showAddForm && (
          <AddHoldingForm
            onAdd={h => { addHolding(h); }}
            onClose={() => setShowAddForm(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Empty State ───────────────────────────────────────── */}
      {holdings.length === 0 && !loading && (
        <EmptyState onAddDemo={loadDemo} onAdd={() => setShowAddForm(true)} />
      )}

      {/* ── Error State ───────────────────────────────────────── */}
      {error && !loading && (
        <APIErrorState error={error} onRetry={runAnalysis} onLoadDemo={loadDemo} />
      )}

      {/* ── Loading Skeleton ──────────────────────────────────── */}
      {loading && !analysis && <DashboardSkeleton />}

      {/* ── Main Dashboard ────────────────────────────────────── */}
      {analysis && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="space-y-4"
        >
          {/* KPI Row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KPICard
              label="Portfolio Value"
              value={showValues ? formatINR(analysis.totals.total_value) : '₹ ••••••'}
              icon={DollarSign}
              highlight
            />
            <KPICard
              label="Total Invested"
              value={showValues ? formatINR(analysis.totals.total_invested) : '₹ ••••••'}
              icon={Target}
            />
            <KPICard
              label="Total P&L"
              value={showValues
                ? `${analysis.totals.total_pnl >= 0 ? '+' : ''}${formatINR(analysis.totals.total_pnl)}`
                : '₹ ••••••'}
              sub={`${analysis.totals.total_pnl_pct >= 0 ? '+' : ''}${analysis.totals.total_pnl_pct.toFixed(2)}%`}
              color={pnlColor(analysis.totals.total_pnl)}
              icon={analysis.totals.total_pnl >= 0 ? TrendingUp : TrendingDown}
              trend={analysis.totals.total_pnl >= 0 ? 'up' : 'down'}
            />
            <KPICard
              label="CAGR"
              value={`${(analysis.risk?.cagr ?? 0).toFixed(1)}%`}
              sub={analysis.risk?.data_source === 'historical' ? 'from price history' : 'estimated 1y'}
              color={(analysis.risk?.cagr ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}
              icon={Activity}
              trend={(analysis.risk?.cagr ?? 0) >= 0 ? 'up' : 'down'}
            />
            <KPICard
              label="Sharpe Ratio"
              value={(analysis.risk?.sharpe_ratio ?? 0).toFixed(2)}
              sub={(analysis.risk?.sharpe_ratio ?? 0) >= 1 ? '↑ Above benchmark' : '↓ Below 1.0'}
              color={(analysis.risk?.sharpe_ratio ?? 0) >= 1 ? 'text-emerald-400' : 'text-amber-400'}
              icon={BarChart3}
              trend={(analysis.risk?.sharpe_ratio ?? 0) >= 1 ? 'up' : 'neutral'}
            />
            <KPICard
              label="Volatility"
              value={`${(analysis.risk?.volatility_pct ?? 0).toFixed(1)}%`}
              sub="annualized"
              color={(analysis.risk?.volatility_pct ?? 0) > 25 ? 'text-amber-400' : 'text-cyan-400'}
              icon={Gauge}
            />
          </div>

          {/* Health + Sector Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Health Gauge */}
            <div className="glass-card p-5 flex flex-col items-center gap-4">
              <div className="flex items-center gap-2 w-full">
                <Shield className="w-4 h-4 text-violet-400" />
                <span className="text-sm font-bold text-white">Portfolio Health</span>
                <span className={`ml-auto text-[9px] font-bold px-2 py-0.5 rounded border ${analysis.health.score >= 75 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : analysis.health.score >= 58 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                  {analysis.health.label}
                </span>
              </div>
              <HealthGauge
                score={analysis.health.score}
                color={analysis.health.color}
                label={analysis.health.label}
              />
              <p className="text-[10px] text-slate-400 text-center leading-relaxed max-w-[240px]">
                {analysis.health.summary}
              </p>
              {/* Score breakdown bars */}
              <div className="w-full space-y-2">
                {Object.entries(analysis.health.breakdown).map(([key, val]) => {
                  const v = val as number;
                  const barColor = v >= 65 ? '#22c55e' : v >= 42 ? '#f59e0b' : '#ef4444';
                  return (
                    <div key={key} className="flex items-center gap-2 text-[10px]">
                      <span className="text-slate-500 capitalize w-28 flex-shrink-0">{key.replace(/_/g, ' ')}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: barColor }}
                          initial={{ width: 0 }}
                          animate={{ width: `${v}%` }}
                          transition={{ duration: 0.9, ease: EASE, delay: 0.1 }}
                        />
                      </div>
                      <span className="text-slate-300 tabular-nums w-7 text-right font-semibold">{v.toFixed(0)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sector Allocation Donut */}
            <div className="glass-card p-5 lg:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <PieIcon className="w-4 h-4 text-violet-400" />
                <span className="text-sm font-bold text-white">Sector Allocation</span>
                <span className="ml-auto text-[10px] text-slate-500">{sectorPieData.length} sectors</span>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-5">
                {/* Donut */}
                <div className="relative h-48 w-48 flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sectorPieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={52}
                        outerRadius={86}
                        paddingAngle={1.5}
                        strokeWidth={0}
                        onMouseEnter={(_, idx) => setActivePieIndex(idx)}
                        onMouseLeave={() => setActivePieIndex(null)}
                      >
                        {sectorPieData.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={entry.color}
                            opacity={activePieIndex === null || activePieIndex === i ? 1 : 0.4}
                            style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<PremiumTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center label */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center">
                      {activePieIndex !== null ? (
                        <>
                          <div className="text-[11px] font-bold text-white">{sectorPieData[activePieIndex]?.name}</div>
                          <div className="text-[13px] font-black tabular-nums" style={{ color: sectorPieData[activePieIndex]?.color }}>
                            {sectorPieData[activePieIndex]?.value.toFixed(1)}%
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-[9px] text-slate-500 uppercase tracking-widest">Total</div>
                          <div className="text-[14px] font-black text-white">
                            {showValues ? formatINR(analysis.totals.total_value) : '••••'}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6 w-full">
                  {analysis.sector_exposure.map((s: SectorExposure, i: number) => (
                    <motion.div
                      key={s.sector}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.25 }}
                      className="flex items-center gap-2 text-[11px] cursor-pointer"
                      onMouseEnter={() => setActivePieIndex(i)}
                      onMouseLeave={() => setActivePieIndex(null)}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-sm flex-shrink-0 transition-transform"
                        style={{
                          background: SECTOR_COLORS[s.sector] ?? '#64748b',
                          transform: activePieIndex === i ? 'scale(1.3)' : 'scale(1)',
                        }}
                      />
                      <span className="text-slate-400 flex-1 truncate">{s.sector}</span>
                      <span className="font-bold tabular-nums text-white">{s.weight_pct.toFixed(1)}%</span>
                      <span className="text-slate-600 tabular-nums text-[10px]">({s.stock_count})</span>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Sector bar chart */}
              <div className="mt-4 h-24">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sectorPieData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#64748b' }} interval={0} />
                    <YAxis tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={v => `${v}%`} />
                    <Tooltip content={<PremiumTooltip />} />
                    <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                      {sectorPieData.map((e, i) => (
                        <Cell key={i} fill={e.color} fillOpacity={activePieIndex === i ? 1 : 0.7} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Sector bias pill */}
              {analysis.sector_bias && (
                <div className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                  <Layers3 className="w-3.5 h-3.5 text-violet-400 mt-0.5 flex-shrink-0" />
                  <span className="text-[10px] text-slate-400 leading-relaxed">
                    <span className="font-bold text-white capitalize">{String(analysis.sector_bias.bias ?? 'balanced')}</span> tilt
                    {' · '}
                    {String(analysis.sector_bias.recommendation ?? '')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Risk Analytics */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <Activity className="w-4 h-4 text-violet-400" />
              <span className="text-sm font-bold text-white">Risk Analytics</span>
              {analysis.risk?.data_source && (
                <span className="text-[9px] text-slate-500 px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06]">
                  {analysis.risk.data_source === 'historical' ? `${analysis.risk.data_points ?? ''} days of data` : 'estimated — no price history'}
                </span>
              )}
              <span className={`ml-auto text-[10px] font-bold px-2.5 py-1 rounded-lg border ${rc.bg}`}>
                {analysis.risk?.risk_level?.level ?? 'N/A'} Risk
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
              {[
                { label: 'Volatility',    value: `${(analysis.risk?.volatility_pct ?? 0).toFixed(1)}%`,    color: (analysis.risk?.volatility_pct ?? 0) > 25 ? 'text-amber-400' : 'text-cyan-400' },
                { label: 'Sharpe',        value: (analysis.risk?.sharpe_ratio ?? 0).toFixed(2),             color: (analysis.risk?.sharpe_ratio ?? 0) >= 1 ? 'text-emerald-400' : 'text-amber-400' },
                { label: 'Sortino',       value: (analysis.risk?.sortino_ratio ?? 0).toFixed(2),            color: (analysis.risk?.sortino_ratio ?? 0) >= 1 ? 'text-emerald-400' : 'text-amber-400' },
                { label: 'Beta',          value: (analysis.risk?.beta ?? 1).toFixed(2),                     color: 'text-white' },
                { label: 'VaR 95%',       value: `${((analysis.risk?.var_95 ?? 0) * 100).toFixed(2)}%`,     color: 'text-red-400' },
                { label: 'Max Drawdown',  value: `${(analysis.risk?.max_drawdown_pct ?? 0).toFixed(1)}%`,   color: 'text-red-400' },
                { label: 'CAGR',          value: `${(analysis.risk?.cagr ?? 0).toFixed(1)}%`,              color: (analysis.risk?.cagr ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400' },
                { label: 'Treynor',       value: (analysis.risk?.treynor_ratio ?? 0).toFixed(3),            color: 'text-violet-400' },
              ].map(m => <MetricTile key={m.label} {...m} />)}
            </div>

            {/* Risk factors */}
            {(analysis.risk?.risk_level?.factors?.length ?? 0) > 0 && (
              <div className="mt-3.5 flex flex-wrap gap-1.5">
                {analysis.risk!.risk_level.factors.map((f: string, i: number) => (
                  <span key={i} className="text-[10px] px-2.5 py-1 rounded-full bg-amber-500/6 text-amber-400 border border-amber-500/15 flex items-center gap-1">
                    <AlertTriangle className="w-2.5 h-2.5" /> {f}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Holdings Table */}
          <div className="glass-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-violet-400" />
                <span className="text-sm font-bold text-white">Holdings</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.05] text-slate-400">
                  {displayHoldings.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={sectorFilter}
                  onChange={e => setSectorFilter(e.target.value)}
                  className="text-[11px] bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-slate-300 outline-none focus:border-violet-500/40 transition-colors cursor-pointer"
                >
                  <option value="all">All Sectors</option>
                  {sectors.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-[12px] min-w-[600px]">
                <thead>
                  <tr className="border-t border-b border-white/[0.05] bg-white/[0.01]">
                    {[
                      { key: 'name', label: 'Stock', sortable: false, cls: 'pl-5' },
                      { key: 'sector', label: 'Sector', sortable: false },
                      { key: 'value', label: 'Value', sortable: true },
                      { key: 'pnl', label: 'P&L', sortable: true },
                      { key: 'pnl_pct', label: 'Return', sortable: true },
                      { key: 'allocation', label: 'Weight', sortable: true },
                      { key: 'actions', label: '', sortable: false, cls: 'pr-4' },
                    ].map(col => (
                      <th
                        key={col.key}
                        onClick={() => col.sortable && toggleSort(col.key as typeof sortKey)}
                        className={`px-3 py-2.5 text-left font-bold text-[9px] uppercase tracking-[0.12em] text-slate-500
                          ${col.sortable ? 'cursor-pointer select-none hover:text-slate-300 transition-colors' : ''}
                          ${col.cls ?? ''}`}
                      >
                        <span className="flex items-center gap-1">
                          {col.label}
                          {col.sortable && sortKey === col.key && (
                            sortDir === 'desc'
                              ? <ChevronDown className="w-2.5 h-2.5 text-violet-400" />
                              : <ChevronUp className="w-2.5 h-2.5 text-violet-400" />
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {displayHoldings.map((h: HoldingStats, idx: number) => (
                      <motion.tr
                        key={h.ticker}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ delay: idx * 0.03, duration: 0.2 }}
                        className="border-b border-white/[0.03] hover:bg-white/[0.025] transition-colors group"
                      >
                        <td className="px-3 py-3 pl-5">
                          <div className="font-bold text-white leading-tight">{h.name}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[9px] font-mono text-slate-500">{h.ticker.replace('.NS', '')}</span>
                            <span className="text-[9px] text-slate-600">·</span>
                            <span className="text-[9px] text-slate-500">{h.quantity} shares</span>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: SECTOR_COLORS[h.sector] ?? '#64748b' }} />
                            <span className="text-slate-400 text-[11px]">{h.sector}</span>
                          </span>
                        </td>
                        <td className="px-3 py-3 font-bold text-white tabular-nums">
                          {showValues ? formatINR(h.value) : '••••'}
                        </td>
                        <td className={`px-3 py-3 font-bold tabular-nums ${pnlColor(h.pnl)}`}>
                          {showValues ? `${h.pnl >= 0 ? '+' : ''}${formatINR(h.pnl)}` : '••••'}
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${pnlBg(h.pnl_pct)}`}>
                            {h.pnl_pct >= 0 ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
                            {Math.abs(h.pnl_pct).toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-20 h-1.5 rounded-full bg-white/[0.06] overflow-hidden flex-shrink-0">
                              <motion.div
                                className="h-full rounded-full bg-violet-500"
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(h.allocation, 100)}%` }}
                                transition={{ duration: 0.7, ease: EASE }}
                              />
                            </div>
                            <span className="text-slate-300 tabular-nums text-[11px] font-semibold">
                              {h.allocation.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3 pr-4">
                          <button
                            onClick={() => removeHolding(h.ticker)}
                            className="w-6 h-6 rounded-lg opacity-0 group-hover:opacity-100 flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
              {displayHoldings.length === 0 && (
                <div className="py-8 text-center text-[12px] text-slate-500">
                  No holdings match the selected sector filter.
                </div>
              )}
            </div>
          </div>

          {/* Rebalance + Insights Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Rebalance Suggestions */}
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <ArrowUpDown className="w-4 h-4 text-violet-400" />
                <span className="text-sm font-bold text-white">Rebalance Suggestions</span>
                {analysis.rebalance_suggestions.length > 0 && (
                  <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    {analysis.rebalance_suggestions.length} action{analysis.rebalance_suggestions.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {analysis.rebalance_suggestions.length === 0 ? (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                    <Check className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-[12px] font-bold text-emerald-400">Well Balanced</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Portfolio is well-diversified. No rebalancing needed right now.</div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {analysis.rebalance_suggestions.slice(0, 6).map((s: RebalanceSuggestion, i: number) => {
                    const actionStyle = {
                      trim:      { icon: '↓', bg: 'bg-red-500/10',     text: 'text-red-400',     border: 'border-red-500/15' },
                      add:       { icon: '↑', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/15' },
                      introduce: { icon: '+', bg: 'bg-blue-500/10',    text: 'text-blue-400',    border: 'border-blue-500/15' },
                      remove:    { icon: '×', bg: 'bg-amber-500/10',   text: 'text-amber-400',   border: 'border-amber-500/15' },
                    }[s.action] ?? { icon: '→', bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/15' };

                    return (
                      <motion.div
                        key={`${s.ticker}-${i}`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.07, duration: 0.25 }}
                        className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] transition-all"
                      >
                        <div className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center text-[12px] font-black flex-shrink-0 border ${actionStyle.bg} ${actionStyle.text} ${actionStyle.border}`}>
                          {actionStyle.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[12px] font-bold text-white">{s.ticker}</span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                              s.priority === 'high' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                              s.priority === 'medium' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                              'bg-slate-500/10 text-slate-400 border-slate-500/20'
                            }`}>
                              {s.priority}
                            </span>
                            {s.current_pct > 0 && (
                              <span className="text-[9px] text-slate-500 tabular-nums ml-auto">
                                {s.current_pct.toFixed(1)}% → {s.target_pct.toFixed(1)}%
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 leading-relaxed mt-0.5">{s.reason}</p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* AI Insights */}
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-violet-400" />
                <span className="text-sm font-bold text-white">AI Insights</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20 ml-auto">
                  {analysis.insights.length} insights
                </span>
              </div>
              <div className="space-y-2">
                {analysis.insights.map((insight, i) => {
                  const toneStyle = {
                    warn:   { bg: 'bg-amber-500/8',   icon: <AlertTriangle className="w-3 h-3 text-amber-400" />,   iconBg: 'bg-amber-500/12' },
                    good:   { bg: 'bg-emerald-500/8',  icon: <TrendingUp className="w-3 h-3 text-emerald-400" />,    iconBg: 'bg-emerald-500/12' },
                    info:   { bg: 'bg-blue-500/8',     icon: <Info className="w-3 h-3 text-blue-400" />,             iconBg: 'bg-blue-500/12' },
                    strong: { bg: 'bg-violet-500/8',   icon: <Zap className="w-3 h-3 text-violet-400" />,            iconBg: 'bg-violet-500/12' },
                  }[insight.tone] ?? { bg: 'bg-white/[0.02]', icon: <Info className="w-3 h-3 text-slate-400" />, iconBg: 'bg-white/[0.06]' };

                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.09, duration: 0.25 }}
                      className={`flex items-start gap-3 p-3 rounded-xl ${toneStyle.bg} border border-white/[0.04]`}
                    >
                      <div className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${toneStyle.iconBg}`}>
                        {toneStyle.icon}
                      </div>
                      <div>
                        <div className="text-[12px] font-bold text-white">{insight.title}</div>
                        <p className="text-[10px] text-slate-500 leading-relaxed mt-0.5">{insight.body}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Concentration Panel */}
          {analysis.concentration && Object.keys(analysis.concentration).length > 0 && (
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-4 h-4 text-violet-400" />
                <span className="text-sm font-bold text-white">Concentration Risk</span>
                <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded border ${
                  String(analysis.concentration.concentration_level) === 'low' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                  String(analysis.concentration.concentration_level) === 'moderate' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                  'bg-red-500/10 text-red-400 border-red-500/20'
                }`}>
                  {String(analysis.concentration.concentration_level ?? 'n/a')} concentration
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'HHI Score',         value: String(analysis.concentration.hhi ?? '—'),                 sub: 'lower = better' },
                  { label: 'Effective Stocks',   value: String(analysis.concentration.effective_stocks ?? '—'),    sub: 'diversification units' },
                  { label: 'Top Holding',        value: `${String(analysis.concentration.top_holding_pct ?? '—')}%`, sub: '>35% is high' },
                  { label: 'Top 3 Holdings',     value: `${String(analysis.concentration.top3_holding_pct ?? '—')}%`, sub: 'combined weight' },
                ].map(m => (
                  <div key={m.label} className="flex flex-col gap-1 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <span className="text-[9px] font-bold uppercase text-slate-500">{m.label}</span>
                    <span className="text-xl font-black tabular-nums text-white">{m.value}</span>
                    <span className="text-[9px] text-slate-600">{m.sub}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-3 text-[11px]">
                <span className="text-slate-500 flex-shrink-0">Diversification Score</span>
                <div className="flex-1 h-2 rounded-full bg-white/[0.05] overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      background: analysis.diversification_score >= 60 ? '#22c55e' :
                                  analysis.diversification_score >= 35 ? '#f59e0b' : '#ef4444',
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${analysis.diversification_score}%` }}
                    transition={{ duration: 1, ease: EASE }}
                  />
                </div>
                <span className="text-white font-bold tabular-nums flex-shrink-0">
                  {analysis.diversification_score.toFixed(0)}/100
                </span>
              </div>
            </div>
          )}

        </motion.div>
      )}
    </div>
  );
}
