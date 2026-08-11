'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion';
import {
  Activity, TrendingUp, TrendingDown, RefreshCw, Brain, BarChart3,
  Zap, AlertTriangle, Clock, Radio, Flame, Snowflake, Scale,
  ArrowUpRight, ArrowDownRight, ChevronRight, Target, Shield,
  WifiOff, Eye, Layers3, Gauge, Globe2, DollarSign, Cpu,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { authHeader } from "@/lib/api/authToken";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface Quote {
  symbol: string; name: string; sector: string;
  price: number; change: number; changePct: number;
  volume: number; avgVolume: number; volRatio: number;
  sparkline: number[]; high52w: number; low52w: number;
}

interface SectorData extends Quote {
  rsi: number; bias: 'bullish' | 'bearish' | 'neutral';
  momentum: 'strong' | 'moderate' | 'neutral' | 'weak';
  moneyFlow: { value: number; direction: 'in' | 'out' };
  strengthScore: number;
}

interface MomentumLeader extends Quote {
  rsi: number; breakoutScore: number; trendScore: number;
}

interface Breakout extends MomentumLeader {
  status: 'EARLY' | 'CONFIRMED' | 'EXTENDED';
  pattern: string; aiReason: string;
}

interface VolInstrument extends Quote { riskScore: number; }

interface PulseData {
  timestamp: string; marketOpen: boolean;
  fearGreed: { value: number; label: string };
  vix: { price: number; changePct: number } | null;
  aiSentiment: 'Bullish' | 'Neutral' | 'Bearish';
  regime: {
    regime: string; color: string; confidence: number;
    drivers: { text: string; positive: boolean }[];
  };
  gainers: Quote[]; losers: Quote[];
  sectors: SectorData[];
  momentumLeaders: MomentumLeader[];
  volMonitor: VolInstrument[];
  breakouts: Breakout[];
  moneyFlow: { sector: string; flow: number; direction: 'in' | 'out'; pct: number }[];
  internals: {
    advancing: number; declining: number; adPct: number;
    newHighs: number; newLows: number;
    trin: number; tickIdx: number; volBreadth: number;
  };
  narrative: {
    bias: string; biasColor: string; confidence: number;
    bullets: string[]; topSector: string;
    riskArea: string; tomorrow: string; institutionalFlow: string;
  };
  indices: Quote[];
}

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const BG      = '#050816';
const CARD    = 'rgba(9,17,31,0.85)';
const BORDER  = 'rgba(255,255,255,0.06)';
const PURPLE  = '#7c3aed';
const EMERALD = '#22c55e';
const RED     = '#ef4444';
const AMBER   = '#f59e0b';
const BLUE    = '#3b82f6';

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATION PRESETS
// ─────────────────────────────────────────────────────────────────────────────
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const fadeUp = (i = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.45, delay: i * 0.03, ease: EASE } },
});

const stagger = {
  animate: { transition: { staggerChildren: 0.04 } },
};

const cardIn = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.32, ease: EASE } },
};

// ─────────────────────────────────────────────────────────────────────────────
// SHARED PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────
function TerminalCard({
  children, className = '', glow, noPad = false,
}: {
  children: React.ReactNode; className?: string; glow?: string; noPad?: boolean;
}) {
  return (
    <div
      className={cn(
        'relative rounded-2xl border transition-all duration-300',
        'hover:border-violet-500/20 hover:shadow-[0_8px_40px_rgba(124,58,237,0.08)]',
        !noPad && 'p-4',
        className,
      )}
      style={{ background: CARD, borderColor: glow ? `${glow}20` : BORDER }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-2xl"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.25), transparent)' }} />
      {children}
    </div>
  );
}

function SectionLabel({
  title, icon: Icon, color = PURPLE, live = false, sub,
}: {
  title: string; icon: any; color?: string; live?: boolean; sub?: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-0.5 h-4 rounded-full flex-shrink-0"
        style={{ background: `linear-gradient(to bottom, ${color}, transparent)` }} />
      <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color }} />
      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{title}</span>
      {sub && <span className="text-[9px] text-slate-600 ml-1">· {sub}</span>}
      <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.04), transparent)' }} />
      {live && (
        <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider flex-shrink-0" style={{ color: EMERALD }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: EMERALD }} />
          Live
        </span>
      )}
    </div>
  );
}

function Spark({
  data, pos, h = 32, w = 64,
}: {
  data: number[]; pos: boolean; h?: number; w?: number;
}) {
  if (!data || data.length < 2) return <div style={{ width: w, height: h }} />;
  const min = Math.min(...data), max = Math.max(...data), rng = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / rng) * (h - 3)}`).join(' ');
  const col = pos ? EMERALD : RED;
  const id  = `sp${Math.random().toString(36).slice(2, 6)}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="flex-shrink-0 overflow-visible">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={col} stopOpacity="0.4" />
          <stop offset="100%" stopColor={col} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#${id})`} />
      <polyline points={pts} fill="none" stroke={col} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LiveDot({ color = EMERALD }: { color?: string }) {
  return (
    <span className="relative flex h-2 w-2 flex-shrink-0">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
        style={{ background: color }} />
      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: color }} />
    </span>
  );
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-white/[0.04]', className)} />;
}

function PctBadge({ v, small }: { v: number; small?: boolean }) {
  const pos = v >= 0;
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 font-bold tabular-nums rounded-md px-1.5 py-0.5',
      small ? 'text-[9px]' : 'text-[11px]',
      pos ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10',
    )}>
      {pos ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
      {pos ? '+' : ''}{v.toFixed(2)}%
    </span>
  );
}

// Animated number counter
function CountUp({ value, decimals = 0, prefix = '', suffix = '' }: {
  value: number; decimals?: number; prefix?: string; suffix?: string;
}) {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    let raf: number;
    const start = display;
    const end   = value;
    const dur   = 600;
    const t0    = performance.now();
    const step  = (t: number) => {
      const prog = Math.min((t - t0) / dur, 1);
      const ease = 1 - Math.pow(1 - prog, 3);
      setDisplay(start + (end - start) * ease);
      if (prog < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]); // eslint-disable-line
  return <>{prefix}{display.toFixed(decimals)}{suffix}</>;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — HERO BAR
// ─────────────────────────────────────────────────────────────────────────────
function HeroBar({ data, loading, lastRefresh, onRefresh }: {
  data: PulseData | null; loading: boolean; lastRefresh: Date | null; onRefresh: () => void;
}) {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);

  const isOpen   = data?.marketOpen ?? false;
  const fg       = data?.fearGreed;
  const fgVal    = fg?.value ?? 50;
  const fgColor  = fgVal >= 70 ? EMERALD : fgVal >= 55 ? '#84cc16' : fgVal >= 45 ? AMBER : fgVal >= 25 ? '#f97316' : RED;
  const FGIcon   = fgVal >= 60 ? Flame : fgVal >= 40 ? Scale : Snowflake;
  const vix      = data?.vix;
  const sentiment = data?.aiSentiment ?? '—';
  const sentColor = sentiment === 'Bullish' ? EMERALD : sentiment === 'Bearish' ? RED : AMBER;

  return (
    <motion.div {...fadeUp(0)}>
      <div className="rounded-2xl border p-4 md:p-5 flex flex-wrap items-center gap-5 lg:gap-8"
        style={{ background: 'rgba(9,17,31,0.95)', borderColor: 'rgba(124,58,237,0.15)', backdropFilter: 'blur(20px)' }}>

        {/* Title + live */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="relative w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border"
            style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(59,130,246,0.2))', borderColor: 'rgba(124,58,237,0.3)' }}>
            <Activity className="w-5 h-5 text-violet-300" />
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-[#050816] bg-emerald-400 animate-pulse" />
          </div>
          <div>
            <h1 className="text-[16px] font-black text-white tracking-tight leading-none">Market Pulse</h1>
            <p className="text-[9px] text-slate-600 uppercase tracking-widest mt-0.5">Real-Time Intelligence Engine</p>
          </div>
        </div>

        <div className="h-8 w-px bg-white/[0.05] hidden sm:block flex-shrink-0" />

        {/* Time + market status */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center border flex-shrink-0',
            isOpen ? 'border-emerald-500/20 bg-emerald-500/10' : 'border-slate-600/20 bg-slate-600/10')}>
            {isOpen
              ? <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
              : <WifiOff className="w-4 h-4 text-slate-500" />}
          </div>
          <div>
            <div className={cn('text-[13px] font-bold', isOpen ? 'text-emerald-400' : 'text-slate-500')}>
              {isOpen ? 'MARKET OPEN' : 'MARKET CLOSED'}
            </div>
            <div className="text-[10px] text-slate-600 tabular-nums flex items-center gap-1 mt-px">
              <Clock className="w-2.5 h-2.5" />
              {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              &nbsp;·&nbsp;
              {time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
          </div>
        </div>

        <div className="h-8 w-px bg-white/[0.05] hidden md:block flex-shrink-0" />

        {/* Fear & Greed */}
        {fg && (
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center border flex-shrink-0"
              style={{ background: `${fgColor}14`, borderColor: `${fgColor}25` }}>
              <FGIcon className="w-4 h-4" style={{ color: fgColor }} />
            </div>
            <div>
              <div className="text-[9px] text-slate-500 font-medium">Fear & Greed</div>
              <div className="text-[15px] font-black tabular-nums leading-tight" style={{ color: fgColor }}>
                {fg.value}<span className="text-[10px] font-semibold ml-1">{fg.label}</span>
              </div>
            </div>
          </div>
        )}

        {/* VIX */}
        {vix && (
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-orange-500/10 border border-orange-500/18 flex-shrink-0">
              <Gauge className="w-4 h-4 text-orange-400" />
            </div>
            <div>
              <div className="text-[9px] text-slate-500 font-medium">VIX</div>
              <div className={cn('text-[15px] font-black tabular-nums leading-tight flex items-center gap-1',
                vix.changePct < 0 ? 'text-emerald-400' : 'text-red-400')}>
                {vix.price.toFixed(2)}
                <span className="text-[10px]">{vix.changePct >= 0 ? '+' : ''}{vix.changePct.toFixed(2)}%</span>
              </div>
            </div>
          </div>
        )}

        {/* AI Sentiment */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center border flex-shrink-0"
            style={{ background: `${sentColor}14`, borderColor: `${sentColor}25` }}>
            <Brain className="w-4 h-4" style={{ color: sentColor }} />
          </div>
          <div>
            <div className="text-[9px] text-slate-500 font-medium">AI Sentiment</div>
            <div className="text-[13px] font-black" style={{ color: sentColor }}>{sentiment}</div>
          </div>
        </div>

        <div className="flex-1" />

        {/* Refresh */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {lastRefresh && (
            <span className="text-[9px] text-slate-600 tabular-nums hidden lg:block">
              Updated {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button onClick={onRefresh} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold text-slate-400 hover:text-white hover:border-violet-500/30 hover:bg-violet-500/8 transition-all disabled:opacity-40"
            style={{ borderColor: BORDER }}>
            <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — MARKET REGIME
// ─────────────────────────────────────────────────────────────────────────────
function RegimeCard({ data, loading }: { data: PulseData | null; loading: boolean }) {
  const regime    = data?.regime;
  const color     = regime?.color ?? PURPLE;
  const label     = regime?.regime ?? '—';
  const conf      = regime?.confidence ?? 0;
  const drivers   = regime?.drivers ?? [];
  const dash      = (conf / 100) * 276;

  return (
    <motion.div {...fadeUp(1)}>
      <TerminalCard className="relative overflow-hidden" glow={color}>
        {/* Background ambient */}
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none opacity-20"
          style={{ background: `radial-gradient(circle, ${color}, transparent)` }} />

        <SectionLabel title="Market Regime" icon={Target} color={color} live />

        {loading || !regime ? (
          <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-6">
            <Skeleton className="h-[200px]" />
            <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6 items-center">
            {/* Gauge */}
            <div className="flex flex-col items-center">
              <div className="relative w-44 h-44">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
                  <circle cx="80" cy="80" r="44" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
                  <circle cx="80" cy="80" r="44" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
                    strokeDasharray={`${dash} 276`}
                    style={{ filter: `drop-shadow(0 0 16px ${color}88)` }} />
                  {/* Tick marks */}
                  {[0, 25, 50, 75, 100].map((v) => {
                    const angle = (v / 100) * 360 - 90;
                    const rad   = (angle * Math.PI) / 180;
                    const r1 = 57; const r2 = 63;
                    return (
                      <line key={v}
                        x1={80 + r1 * Math.cos(rad)} y1={80 + r1 * Math.sin(rad)}
                        x2={80 + r2 * Math.cos(rad)} y2={80 + r2 * Math.sin(rad)}
                        stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
                    );
                  })}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <motion.div className="text-[28px] font-black tabular-nums" style={{ color }}
                    initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.3, duration: 0.5, ease: EASE }}>
                    {conf}%
                  </motion.div>
                  <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Confidence</div>
                </div>
              </div>
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                className="mt-2 text-center">
                <div className="text-[22px] font-black tracking-tight" style={{ color }}>{label}</div>
                <div className="text-[9px] text-slate-600 uppercase tracking-widest mt-0.5">Current Regime</div>
              </motion.div>
            </div>

            {/* Drivers */}
            <div className="space-y-2.5">
              {drivers.map((d, i) => (
                <motion.div key={i}
                  initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + i * 0.08, ease: EASE }}
                  className="flex items-start gap-3 p-3 rounded-xl border"
                  style={{
                    background: d.positive ? 'rgba(34,197,94,0.05)' : d.positive === false ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.02)',
                    borderColor: d.positive ? 'rgba(34,197,94,0.15)' : d.positive === false ? 'rgba(239,68,68,0.12)' : BORDER,
                  }}>
                  <span className="text-[14px] flex-shrink-0 mt-0.5">
                    {d.positive ? '↑' : d.positive === false ? '↓' : '→'}
                  </span>
                  <span className="text-[12px] text-slate-300 leading-relaxed">{d.text}</span>
                  <div className="ml-auto flex-shrink-0">
                    {d.positive
                      ? <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">POSITIVE</span>
                      : d.positive === false
                      ? <span className="text-[9px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-full">RISK</span>
                      : <span className="text-[9px] font-bold text-slate-500 bg-slate-500/10 border border-slate-500/20 px-1.5 py-0.5 rounded-full">NEUTRAL</span>}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </TerminalCard>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — LEADERS VS LAGGARDS
// ─────────────────────────────────────────────────────────────────────────────
function MoverCard({ q, rank }: { q: Quote; rank: number }) {
  const pos = q.changePct >= 0;
  const [expanded, setExpanded] = useState(false);
  return (
    <motion.div variants={cardIn}
      className="group relative rounded-xl border overflow-hidden cursor-pointer transition-all duration-250 hover:scale-[1.015] hover:-translate-y-0.5"
      style={{
        background: pos ? 'rgba(34,197,94,0.04)' : 'rgba(239,68,68,0.04)',
        borderColor: pos ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
        boxShadow: expanded ? `0 0 28px ${pos ? EMERALD : RED}18` : 'none',
      }}
      onClick={() => setExpanded(v => !v)}>
      <div className="absolute left-0 inset-y-0 w-[2.5px] rounded-r"
        style={{ background: pos ? EMERALD : RED }} />

      <div className="ml-3 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[9px] font-black text-slate-600 w-4 flex-shrink-0">#{rank}</span>
            <div className="min-w-0">
              <div className="text-[13px] font-black text-white truncate">{q.symbol}</div>
              <div className="text-[9px] text-slate-600 truncate">{q.sector}</div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <PctBadge v={q.changePct} />
            <span className="text-[9px] text-slate-600 tabular-nums">
              Vol {q.volRatio?.toFixed(1)}×
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between mt-2">
          <span className="text-[12px] font-bold text-white tabular-nums">
            {q.price >= 1000
              ? q.price.toLocaleString('en-US', { maximumFractionDigits: 0 })
              : q.price.toFixed(2)}
          </span>
          <Spark data={q.sparkline} pos={pos} h={28} w={60} />
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }}
              className="overflow-hidden">
              <div className="pt-2.5 mt-2.5 border-t border-white/[0.05] grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                {[
                  ['Volume', q.volume ? `${(q.volume / 1e6).toFixed(1)}M` : '—'],
                  ['Avg Vol', q.avgVolume ? `${(q.avgVolume / 1e6).toFixed(1)}M` : '—'],
                  ['Vol Ratio', q.volRatio ? `${q.volRatio.toFixed(2)}×` : '—'],
                  ['52W High', q.high52w ? q.high52w.toFixed(1) : '—'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-slate-600">{k}</span>
                    <span className="font-bold text-white">{v}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function LeadersLaggards({ data, loading }: { data: PulseData | null; loading: boolean }) {
  return (
    <motion.div {...fadeUp(2)}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Gainers */}
        <TerminalCard>
          <SectionLabel title="Top Gainers" icon={TrendingUp} color={EMERALD} live />
          {loading || !data ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-[72px]" />)}</div>
          ) : (
            <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-2">
              {data.gainers.slice(0, 5).map((q, i) => <MoverCard key={q.symbol} q={q} rank={i + 1} />)}
            </motion.div>
          )}
        </TerminalCard>

        {/* Losers */}
        <TerminalCard>
          <SectionLabel title="Top Losers" icon={TrendingDown} color={RED} live />
          {loading || !data ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-[72px]" />)}</div>
          ) : (
            <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-2">
              {data.losers.slice(0, 5).map((q, i) => <MoverCard key={q.symbol} q={q} rank={i + 1} />)}
            </motion.div>
          )}
        </TerminalCard>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — SECTOR ROTATION MATRIX
// ─────────────────────────────────────────────────────────────────────────────
const SECTOR_ICON: Record<string, string> = {
  Technology: '💻', Financials: '🏦', Healthcare: '🏥', Energy: '⚡',
  Industrials: '🏭', 'Consumer Disc': '🛍', 'Consumer Stap': '🛒',
  Utilities: '💡', 'Real Estate': '🏠', Materials: '⛏', 'Comm Svcs': '📡',
};

function SectorCell({ s }: { s: SectorData }) {
  const pos      = s.changePct >= 0;
  const intensity = Math.min(Math.abs(s.changePct) / 3, 1);
  const cellBg   = pos
    ? `rgba(34,197,94,${0.04 + intensity * 0.14})`
    : `rgba(239,68,68,${0.04 + intensity * 0.14})`;
  const border   = pos
    ? `rgba(34,197,94,${0.12 + intensity * 0.2})`
    : `rgba(239,68,68,${0.12 + intensity * 0.2})`;
  const color    = pos ? EMERALD : RED;

  return (
    <motion.div variants={cardIn}
      className="relative rounded-xl border p-3 overflow-hidden transition-all duration-300 cursor-default group"
      style={{ background: cellBg, borderColor: border }}
      whileHover={{ scale: 1.03, y: -3, boxShadow: `0 12px 40px ${color}20` }}>

      {/* Intensity bar at bottom */}
      <div className="absolute inset-x-0 bottom-0 h-0.5 rounded-b-xl"
        style={{ background: color, opacity: 0.3 + intensity * 0.5 }} />

      <div className="flex items-start justify-between mb-2">
        <span className="text-[14px]">{SECTOR_ICON[s.name] ?? '📊'}</span>
        <span className={cn(
          'text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full border',
          s.bias === 'bullish' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
            : s.bias === 'bearish' ? 'text-red-400 bg-red-500/10 border-red-500/20'
            : 'text-slate-400 bg-slate-500/10 border-slate-500/20',
        )}>{s.bias}</span>
      </div>
      <div className="text-[10px] font-bold text-white truncate mb-1">{s.name}</div>
      <div className="text-[16px] font-black tabular-nums" style={{ color }}>
        {s.changePct >= 0 ? '+' : ''}{s.changePct.toFixed(2)}%
      </div>
      <div className="flex items-center justify-between mt-2 text-[9px]">
        <span className="text-slate-600">RSI {s.rsi}</span>
        <span style={{ color, opacity: 0.8 }}>
          {s.moneyFlow.direction === 'in' ? '↑' : '↓'} {s.moneyFlow.value.toFixed(1)}B
        </span>
      </div>
      {/* Strength bar */}
      <div className="mt-2 h-0.5 rounded-full bg-white/[0.05] overflow-hidden">
        <motion.div className="h-full rounded-full" style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(s.strengthScore, 100)}%` }}
          transition={{ duration: 0.9, ease: EASE }} />
      </div>
    </motion.div>
  );
}

function SectorMatrix({ data, loading }: { data: PulseData | null; loading: boolean }) {
  const sorted = data?.sectors
    ? [...data.sectors].sort((a, b) => b.changePct - a.changePct)
    : [];
  return (
    <motion.div {...fadeUp(3)}>
      <TerminalCard>
        <SectionLabel title="Sector Rotation Matrix" icon={Layers3} color={BLUE} live />
        {loading || !data ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
            {[...Array(11)].map((_, i) => <Skeleton key={i} className="h-[110px]" />)}
          </div>
        ) : (
          <motion.div variants={stagger} initial="initial" animate="animate"
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2.5">
            {sorted.map(s => <SectorCell key={s.symbol} s={s} />)}
          </motion.div>
        )}
      </TerminalCard>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — MOMENTUM LEADERS
// ─────────────────────────────────────────────────────────────────────────────
function MomentumCard({ q }: { q: MomentumLeader }) {
  const pos = q.changePct >= 0;
  const rsiColor = q.rsi > 70 ? RED : q.rsi < 30 ? EMERALD : '#94a3b8';
  return (
    <motion.div variants={cardIn}
      className="flex-shrink-0 rounded-xl border p-4 w-52 transition-all duration-300 cursor-default"
      style={{ background: CARD, borderColor: BORDER }}
      whileHover={{ scale: 1.04, y: -4, borderColor: 'rgba(124,58,237,0.4)', boxShadow: `0 16px 40px rgba(124,58,237,0.15)` }}>

      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="text-[14px] font-black text-white">{q.symbol}</div>
          <div className="text-[9px] text-slate-600 truncate max-w-[120px]">{q.sector}</div>
        </div>
        <PctBadge v={q.changePct} small />
      </div>

      <div className="text-[20px] font-black text-white tabular-nums mb-1">
        {q.price >= 10000
          ? q.price.toLocaleString('en-IN', { maximumFractionDigits: 0 })
          : q.price >= 100 ? q.price.toFixed(1) : q.price.toFixed(2)}
      </div>

      <Spark data={q.sparkline} pos={pos} h={36} w={176} />

      <div className="grid grid-cols-3 gap-1.5 mt-3 text-[9px]">
        <div className="text-center">
          <div className="font-bold tabular-nums" style={{ color: rsiColor }}>{q.rsi}</div>
          <div className="text-slate-600">RSI</div>
        </div>
        <div className="text-center">
          <div className="font-bold text-violet-400 tabular-nums">{q.volRatio.toFixed(1)}×</div>
          <div className="text-slate-600">Vol</div>
        </div>
        <div className="text-center">
          <div className="font-bold text-amber-400 tabular-nums">{q.trendScore}</div>
          <div className="text-slate-600">Trend</div>
        </div>
      </div>
    </motion.div>
  );
}

function MomentumLeaders({ data, loading }: { data: PulseData | null; loading: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  return (
    <motion.div {...fadeUp(4)}>
      <TerminalCard noPad>
        <div className="p-4 pb-0">
          <SectionLabel title="Momentum Leaders" icon={Flame} color={AMBER} live />
        </div>
        {loading || !data ? (
          <div className="flex gap-3 px-4 pb-4 overflow-hidden">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-[180px] w-52 flex-shrink-0" />)}
          </div>
        ) : (
          <div ref={scrollRef} className="flex gap-3 px-4 pb-4 overflow-x-auto scroll-smooth"
            style={{ scrollbarWidth: 'thin', scrollbarColor: `${PURPLE}30 transparent` }}>
            <motion.div variants={stagger} initial="initial" animate="animate" className="flex gap-3">
              {data.momentumLeaders.map(q => <MomentumCard key={q.symbol} q={q} />)}
            </motion.div>
          </div>
        )}
      </TerminalCard>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6 — VOLATILITY MONITOR
// ─────────────────────────────────────────────────────────────────────────────
function VolCard({ q }: { q: VolInstrument }) {
  const pos   = q.changePct >= 0;
  const rs    = q.riskScore;
  const rsCol = rs >= 70 ? RED : rs >= 45 ? AMBER : EMERALD;
  const flip  = ['VIX', 'VVIX', 'US10Y'].includes(q.symbol); // higher = more risk
  return (
    <motion.div variants={cardIn}
      className="p-3 rounded-xl border transition-all duration-250 hover:scale-[1.02]"
      style={{ background: CARD, borderColor: BORDER }}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="text-[11px] font-black text-white">{q.symbol}</div>
          <div className="text-[9px] text-slate-600 truncate max-w-[90px]">{q.name}</div>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
            style={{ color: rsCol, background: `${rsCol}12` }}>
            {rs >= 70 ? 'HIGH RISK' : rs >= 45 ? 'MOD RISK' : 'LOW RISK'}
          </span>
        </div>
      </div>
      <div className="text-[18px] font-black text-white tabular-nums">
        {q.price >= 1000 ? q.price.toLocaleString('en-US', { maximumFractionDigits: 0 }) : q.price.toFixed(2)}
      </div>
      <PctBadge v={flip ? -q.changePct : q.changePct} small />
      {/* Risk bar */}
      <div className="mt-2.5 h-1 rounded-full bg-white/[0.04] overflow-hidden">
        <motion.div className="h-full rounded-full" style={{ background: rsCol }}
          initial={{ width: 0 }} animate={{ width: `${rs}%` }}
          transition={{ duration: 0.8, ease: EASE }} />
      </div>
      <div className="flex justify-between mt-1 text-[8px] text-slate-700">
        <span>Low</span><span>Risk {rs}/100</span><span>High</span>
      </div>
    </motion.div>
  );
}

function VolatilityMonitor({ data, loading }: { data: PulseData | null; loading: boolean }) {
  return (
    <motion.div {...fadeUp(5)}>
      <TerminalCard>
        <SectionLabel title="Volatility Monitor" icon={Activity} color="#f97316" live />
        {loading || !data ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-[120px]" />)}
          </div>
        ) : (
          <motion.div variants={stagger} initial="initial" animate="animate"
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
            {data.volMonitor.map(q => <VolCard key={q.symbol} q={q} />)}
          </motion.div>
        )}
      </TerminalCard>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7 — AI NARRATIVE FEED
// ─────────────────────────────────────────────────────────────────────────────
const FEED_TYPES = {
  bullish:     { color: EMERALD,   label: 'BULLISH',     icon: TrendingUp,   bg: 'rgba(34,197,94,0.04)',   border: 'rgba(34,197,94,0.15)'   },
  bearish:     { color: RED,       label: 'BEARISH',     icon: TrendingDown, bg: 'rgba(239,68,68,0.04)',   border: 'rgba(239,68,68,0.15)'   },
  macro:       { color: AMBER,     label: 'MACRO',       icon: Globe2,       bg: 'rgba(245,158,11,0.04)',  border: 'rgba(245,158,11,0.15)'  },
  fed:         { color: PURPLE,    label: 'FED',         icon: Brain,        bg: 'rgba(124,58,237,0.06)',  border: 'rgba(124,58,237,0.2)'   },
  institutional:{ color: BLUE,    label: 'INSTITUTIONAL',icon: Layers3,     bg: 'rgba(59,130,246,0.04)',  border: 'rgba(59,130,246,0.15)'  },
  breaking:    { color: '#ef4444', label: 'BREAKING',    icon: Zap,          bg: 'rgba(239,68,68,0.06)',   border: 'rgba(239,68,68,0.25)'   },
};

const LIVE_FEED = [
  { type: 'breaking',     impact: 'HIGH',   conf: 88, time: 'Just now',
    text: 'NASDAQ futures surge — AI infrastructure demand driving institutional rotation into mega-cap tech.' },
  { type: 'fed',          impact: 'HIGH',   conf: 92, time: '5m ago',
    text: 'FOMC minutes: data-dependent approach confirmed — two rate cuts priced by Q4 2025. Markets react positively.' },
  { type: 'institutional',impact: 'HIGH',   conf: 85, time: '12m ago',
    text: 'Goldman Sachs upgrades US equities to Overweight — raises S&P 500 target to 6,200.' },
  { type: 'bearish',      impact: 'HIGH',   conf: 79, time: '21m ago',
    text: 'Crude oil slides on OPEC+ output expansion signals. Energy sector faces rotation pressure.' },
  { type: 'macro',        impact: 'MEDIUM', conf: 73, time: '33m ago',
    text: 'China PMI misses at 49.1 vs 50.3 expected — Hang Seng retreats on growth concerns.' },
  { type: 'bullish',      impact: 'MEDIUM', conf: 70, time: '47m ago',
    text: 'Gold consolidates near $3,230 on weaker dollar — safe-haven demand intact ahead of CPI print.' },
  { type: 'macro',        impact: 'LOW',    conf: 65, time: '1h ago',
    text: 'Emerging market currencies soften against yen. Carry trade unwind risk remains elevated.' },
  { type: 'institutional',impact: 'MEDIUM', conf: 77, time: '1h 15m ago',
    text: 'Semiconductor stocks outperform — AI capex cycle accelerating. NVDA options flow heavily call-biased.' },
] as const;

function NarrativeFeed() {
  const [items, setItems] = useState(LIVE_FEED.slice(0, 6));
  const [ticking, setTicking] = useState(0);

  // Simulate live updates every 45s
  useEffect(() => {
    const t = setInterval(() => {
      setTicking(v => v + 1);
      setItems(prev => {
        const rotated = [...prev];
        rotated[Math.floor(Math.random() * rotated.length)] = {
          ...LIVE_FEED[Math.floor(Math.random() * LIVE_FEED.length)],
          time: 'Just now',
        } as any;
        return rotated;
      });
    }, 45_000);
    return () => clearInterval(t);
  }, []);

  return (
    <motion.div {...fadeUp(6)}>
      <TerminalCard className="h-full">
        <SectionLabel title="AI Narrative Feed" icon={Brain} color={PURPLE} live />
        <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-2.5">
          {items.map((item, i) => {
            const cfg = FEED_TYPES[item.type as keyof typeof FEED_TYPES] ?? FEED_TYPES.macro;
            const Icon = cfg.icon;
            const isLarge = item.type === 'breaking' || item.type === 'fed';
            return (
              <motion.div key={`${i}-${ticking}`} variants={cardIn}
                className="group relative rounded-xl border overflow-hidden transition-all duration-250 hover:border-violet-500/25"
                style={{ background: cfg.bg, borderColor: cfg.border }}>
                <div className="absolute left-0 inset-y-0 w-[2.5px]" style={{ background: cfg.color, opacity: 0.7 }} />
                <div className={cn('ml-3', isLarge ? 'p-3.5' : 'p-3')}>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded border"
                        style={{ color: cfg.color, background: `${cfg.color}12`, borderColor: `${cfg.color}25` }}>
                        {cfg.label}
                      </span>
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded border"
                        style={{
                          color: item.impact === 'HIGH' ? RED : item.impact === 'MEDIUM' ? AMBER : '#94a3b8',
                          background: item.impact === 'HIGH' ? 'rgba(239,68,68,0.08)' : item.impact === 'MEDIUM' ? 'rgba(245,158,11,0.08)' : 'rgba(148,163,184,0.08)',
                          borderColor: item.impact === 'HIGH' ? 'rgba(239,68,68,0.2)' : item.impact === 'MEDIUM' ? 'rgba(245,158,11,0.2)' : 'rgba(148,163,184,0.2)',
                        }}>
                        {item.impact} IMPACT
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-[10px] font-black" style={{ color: cfg.color }}>{item.conf}%</span>
                      <Icon className="w-3 h-3 flex-shrink-0" style={{ color: cfg.color }} />
                    </div>
                  </div>
                  <p className={cn('text-slate-200 leading-relaxed font-medium', isLarge ? 'text-[12px]' : 'text-[11px]')}>
                    {item.text}
                  </p>
                  <div className="flex items-center gap-1 mt-1.5">
                    <Clock className="w-2.5 h-2.5 text-slate-700" />
                    <span className="text-[9px] text-slate-700">{item.time}</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </TerminalCard>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 8 — MONEY FLOW
// ─────────────────────────────────────────────────────────────────────────────
function MoneyFlowCard({ d, max }: { d: { sector: string; flow: number; direction: 'in' | 'out'; pct: number }; max: number }) {
  const isIn  = d.direction === 'in';
  const color = isIn ? EMERALD : RED;
  const pct   = max > 0 ? (d.flow / max) * 100 : 0;
  return (
    <motion.div variants={cardIn}
      className="relative rounded-xl border overflow-hidden p-4 transition-all duration-300"
      style={{ background: `${color}06`, borderColor: `${color}18` }}
      whileHover={{ scale: 1.025, y: -3, boxShadow: `0 12px 40px ${color}18` }}>
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none rounded-xl opacity-0 hover:opacity-100 transition-opacity duration-500"
        style={{ background: `radial-gradient(circle at 50% 0%, ${color}08, transparent)` }} />
      <div className="relative">
        <div className="flex items-start justify-between mb-2">
          <span className="text-[11px] font-bold text-slate-400">{d.sector}</span>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border"
            style={{ color, background: `${color}10`, borderColor: `${color}20` }}>
            {isIn ? 'INFLOW' : 'OUTFLOW'}
          </span>
        </div>
        <div className="text-[22px] font-black tabular-nums flex items-center gap-1.5" style={{ color }}>
          {isIn ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
          {isIn ? '+' : '-'}${d.flow.toFixed(1)}B
        </div>
        <div className="text-[10px] mt-0.5 font-semibold tabular-nums" style={{ color, opacity: 0.7 }}>
          {d.pct >= 0 ? '+' : ''}{d.pct.toFixed(2)}%
        </div>
        {/* Flow bar */}
        <div className="mt-3 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
          <motion.div className="h-full rounded-full" style={{ background: color }}
            initial={{ width: 0 }} animate={{ width: `${pct}%` }}
            transition={{ duration: 0.9, ease: EASE }} />
        </div>
      </div>
    </motion.div>
  );
}

function MoneyFlow({ data, loading }: { data: PulseData | null; loading: boolean }) {
  const max = data ? Math.max(...data.moneyFlow.map(d => d.flow)) : 1;
  return (
    <motion.div {...fadeUp(7)}>
      <TerminalCard>
        <SectionLabel title="Money Flow" icon={DollarSign} color={EMERALD} live />
        {loading || !data ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-[110px]" />)}
          </div>
        ) : (
          <motion.div variants={stagger} initial="initial" animate="animate"
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {data.moneyFlow.map(d => <MoneyFlowCard key={d.sector} d={d} max={max} />)}
          </motion.div>
        )}
        <p className="mt-3 text-[9px] text-slate-700 pt-2.5 border-t border-white/[0.04]">
          Flow estimated from sector ETF volume × price action · {data?.timestamp ? new Date(data.timestamp).toLocaleTimeString() : '—'}
        </p>
      </TerminalCard>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 9 — MARKET INTERNALS
// ─────────────────────────────────────────────────────────────────────────────
function GaugeMini({ value, max = 100, color, label, sub }: {
  value: number; max?: number; color: string; label: string; sub?: string;
}) {
  const pct = Math.min((value / max) * 100, 100);
  const arc = (pct / 100) * 251;
  return (
    <div className="flex flex-col items-center gap-2 p-3 rounded-xl border" style={{ borderColor: `${color}18`, background: `${color}05` }}>
      <div className="relative w-20 h-20">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="30" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
          <motion.circle cx="40" cy="40" r="30" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={`${arc} 251`}
            initial={{ strokeDasharray: '0 251' }} animate={{ strokeDasharray: `${arc} 251` }}
            transition={{ duration: 0.9, ease: EASE }}
            style={{ filter: `drop-shadow(0 0 6px ${color}66)` }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[16px] font-black tabular-nums" style={{ color }}>
            {value.toLocaleString()}
          </span>
        </div>
      </div>
      <div className="text-center">
        <div className="text-[10px] font-bold text-slate-300">{label}</div>
        {sub && <div className="text-[9px] text-slate-600 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

function MarketInternals({ data, loading }: { data: PulseData | null; loading: boolean }) {
  const int = data?.internals;
  return (
    <motion.div {...fadeUp(8)}>
      <TerminalCard>
        <SectionLabel title="Market Internals · Advanced Breadth" icon={BarChart3} color={BLUE} />
        {loading || !int ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-[148px]" />)}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Gauges row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <GaugeMini value={int.adPct} max={100} color={int.adPct >= 50 ? EMERALD : RED}
                label="A/D Ratio" sub={`${int.advancing}A / ${int.declining}D`} />
              <GaugeMini value={int.newHighs} max={200} color={EMERALD}
                label="New Highs" sub={`${int.newLows} new lows`} />
              <GaugeMini value={int.volBreadth} max={100} color={BLUE}
                label="Vol Breadth" sub="Above avg vol" />
              <GaugeMini value={Math.abs(int.tickIdx)} max={1000} color={AMBER}
                label="TICK Index" sub={int.tickIdx >= 0 ? 'Positive' : 'Negative'} />
            </div>

            {/* Progress bars */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {[
                { label: 'Advance / Decline', value: int.adPct, color: int.adPct >= 50 ? EMERALD : RED, sub: `${int.adPct}% advancing` },
                { label: 'High / Low Ratio', value: Math.round((int.newHighs / (int.newHighs + int.newLows)) * 100), color: EMERALD, sub: `${int.newHighs} highs vs ${int.newLows} lows` },
                { label: 'Volume Breadth', value: int.volBreadth, color: BLUE, sub: 'Above average volume' },
                { label: 'TRIN (Arms Index)', value: Math.min(int.trin * 50, 100), color: int.trin < 1 ? EMERALD : RED, sub: `TRIN ${int.trin.toFixed(2)} — ${int.trin < 0.8 ? 'Bullish' : int.trin > 1.2 ? 'Bearish' : 'Neutral'}` },
              ].map(m => (
                <div key={m.label} className="p-3 rounded-xl border border-white/[0.04] bg-white/[0.02]">
                  <div className="flex justify-between text-[10px] font-bold mb-2">
                    <span className="text-slate-400">{m.label}</span>
                    <span style={{ color: m.color }}>{m.value.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                    <motion.div className="h-full rounded-full" style={{ background: m.color }}
                      initial={{ width: 0 }} animate={{ width: `${m.value}%` }}
                      transition={{ duration: 0.9, ease: EASE }} />
                  </div>
                  <div className="text-[9px] text-slate-600 mt-1">{m.sub}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </TerminalCard>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 10 — BREAKOUT DETECTOR
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_CFG = {
  EARLY:     { color: AMBER,  label: 'EARLY',     bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.2)'  },
  CONFIRMED: { color: EMERALD,label: 'CONFIRMED', bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.2)'   },
  EXTENDED:  { color: '#94a3b8', label: 'EXTENDED', bg: 'rgba(148,163,184,0.06)', border: 'rgba(148,163,184,0.15)' },
};

function BreakoutCard({ b }: { b: Breakout }) {
  const sc  = STATUS_CFG[b.status];
  const pos = b.changePct >= 0;
  return (
    <motion.div variants={cardIn}
      className="group relative rounded-xl border overflow-hidden transition-all duration-300"
      style={{ background: sc.bg, borderColor: sc.border }}
      whileHover={{ scale: 1.015, y: -3, boxShadow: `0 12px 40px ${sc.color}18` }}>
      <div className="absolute left-0 inset-y-0 w-[3px]" style={{ background: sc.color, boxShadow: `0 0 8px ${sc.color}` }} />

      <div className="ml-3 p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[15px] font-black text-white">{b.symbol}</span>
              <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full border"
                style={{ color: sc.color, background: sc.bg, borderColor: sc.border }}>
                {b.status}
              </span>
            </div>
            <div className="text-[9px] text-slate-600 mt-0.5">{b.sector} · {b.pattern}</div>
          </div>
          <div className="text-right">
            <div className="text-[22px] font-black tabular-nums" style={{ color: sc.color }}>{b.breakoutScore}</div>
            <div className="text-[8px] text-slate-600">Score/100</div>
          </div>
        </div>

        {/* Score bar */}
        <div className="relative h-1.5 rounded-full bg-white/[0.05] overflow-hidden mb-3">
          <motion.div className="h-full rounded-full" style={{ background: sc.color }}
            initial={{ width: 0 }} animate={{ width: `${b.breakoutScore}%` }}
            transition={{ duration: 0.9, ease: EASE }} />
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="text-center p-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
            <div className="text-[12px] font-black tabular-nums" style={{ color: pos ? EMERALD : RED }}>
              {pos ? '+' : ''}{b.changePct.toFixed(2)}%
            </div>
            <div className="text-[8px] text-slate-600">Daily</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
            <div className="text-[12px] font-black text-violet-400 tabular-nums">{b.volRatio.toFixed(1)}×</div>
            <div className="text-[8px] text-slate-600">Vol Ratio</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
            <div className="text-[12px] font-black text-blue-400 tabular-nums">{b.rsi.toFixed(0)}</div>
            <div className="text-[8px] text-slate-600">RSI</div>
          </div>
        </div>

        <p className="text-[10px] text-slate-400 leading-relaxed">{b.aiReason}</p>
      </div>
    </motion.div>
  );
}

function BreakoutDetector({ data, loading }: { data: PulseData | null; loading: boolean }) {
  return (
    <motion.div {...fadeUp(9)}>
      <TerminalCard>
        <SectionLabel title="Breakout Detector" icon={Zap} color={AMBER} live />
        {loading || !data ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-[210px]" />)}
          </div>
        ) : data.breakouts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-600">
            <Shield className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-[12px]">No active breakouts detected — market is in consolidation</p>
          </div>
        ) : (
          <motion.div variants={stagger} initial="initial" animate="animate"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.breakouts.map(b => <BreakoutCard key={b.symbol} b={b} />)}
          </motion.div>
        )}
      </TerminalCard>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 11 — AI MARKET STORY (hero card)
// ─────────────────────────────────────────────────────────────────────────────
function AIMarketStory({ data, loading }: { data: PulseData | null; loading: boolean }) {
  const [brainPulse, setBrainPulse] = useState(false);
  useEffect(() => { const t = setInterval(() => setBrainPulse(v => !v), 2500); return () => clearInterval(t); }, []);

  const n = data?.narrative;
  const conf = n?.confidence ?? 0;
  const biasColor = n?.biasColor ?? PURPLE;

  return (
    <motion.div {...fadeUp(10)}>
      <TerminalCard className="relative overflow-hidden" glow={biasColor}>
        {/* Background glows */}
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl pointer-events-none opacity-15"
          style={{ background: `radial-gradient(circle, ${biasColor}, transparent)` }} />
        <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full blur-2xl pointer-events-none opacity-10"
          style={{ background: `radial-gradient(circle, #3b82f6, transparent)` }} />

        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none"
          style={{ backgroundImage: 'linear-gradient(rgba(124,58,237,1) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,1) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <motion.div
                className="w-12 h-12 rounded-xl flex items-center justify-center border flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(59,130,246,0.2))', borderColor: 'rgba(124,58,237,0.35)' }}
                animate={{ boxShadow: brainPulse ? `0 0 32px ${PURPLE}66` : `0 0 12px ${PURPLE}22` }}
                transition={{ duration: 0.8 }}>
                <Brain className="w-6 h-6 text-violet-300" />
              </motion.div>
              <div>
                <div className="text-[16px] font-black text-white flex items-center gap-2">
                  AI Market Story
                  <LiveDot />
                </div>
                <div className="text-[9px] text-slate-500 mt-0.5">
                  Generated from live Yahoo Finance data · Updated every 90s
                </div>
              </div>
            </div>

            {/* Confidence meter */}
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
              <span className="text-[9px] text-slate-500 uppercase tracking-wider">AI Confidence</span>
              <div className="flex items-center gap-1.5">
                {[...Array(5)].map((_, i) => (
                  <motion.div key={i} className="w-5 h-2 rounded-full transition-all"
                    animate={{ background: i < Math.round(conf / 20) ? PURPLE : 'rgba(255,255,255,0.06)' }}
                    transition={{ delay: i * 0.05 }} />
                ))}
                <span className="text-[11px] font-black" style={{ color: PURPLE }}>{conf}%</span>
              </div>
            </div>
          </div>

          {/* Stat cards */}
          {loading || !n ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-[60px]" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
              {[
                { label: 'Market Mood',        value: n.bias,       color: biasColor    },
                { label: 'Top Sector',         value: n.topSector,  color: EMERALD      },
                { label: 'Inst. Flow',         value: n.institutionalFlow.split('→')[0]?.trim() ?? '—', color: BLUE },
                { label: 'Tomorrow Outlook',   value: n.tomorrow,   color: AMBER        },
              ].map(({ label, value, color }) => (
                <div key={label} className="p-3 rounded-xl border text-center"
                  style={{ borderColor: `${color}20`, background: `${color}08` }}>
                  <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">{label}</div>
                  <div className="text-[12px] font-black leading-tight" style={{ color }}>{value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Institutional flow banner */}
          {n && (
            <div className="flex items-center gap-2.5 mb-4 px-4 py-2.5 rounded-xl border"
              style={{ background: 'rgba(124,58,237,0.06)', borderColor: 'rgba(124,58,237,0.15)' }}>
              <Layers3 className="w-4 h-4 text-violet-400 flex-shrink-0" />
              <span className="text-[11px] text-slate-400 font-medium">Institutional Flow:</span>
              <span className="text-[11px] font-bold text-violet-300">{n.institutionalFlow}</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400 ml-auto" />
            </div>
          )}

          {/* Narrative bullets */}
          {loading || !n ? (
            <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-5" />)}</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 mb-4">
              {n.bullets.map((b, i) => (
                <motion.div key={i} className="flex items-start gap-2.5"
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.07, ease: EASE }}>
                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: biasColor }} />
                  <p className="text-[12px] text-slate-300 leading-relaxed">{b}</p>
                </motion.div>
              ))}
            </div>
          )}

          {/* Risk area */}
          {n && (
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border"
              style={{ background: 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.15)' }}>
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
              <span className="text-[10px] text-slate-400"><span className="font-bold text-red-400">Risk Area:</span> {n.riskArea}</span>
            </div>
          )}

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/[0.05]">
            <span className="text-[9px] text-slate-700">
              Data: Yahoo Finance · Refresh: 90s · {data?.timestamp ? new Date(data.timestamp).toLocaleTimeString() : 'Loading…'}
            </span>
            <span className="text-[9px] font-bold" style={{ color: PURPLE }}>
              Tomorrow: {n?.tomorrow ?? '—'}
            </span>
          </div>
        </div>
      </TerminalCard>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RIGHT FLOATING PANEL — Economic Calendar
// ─────────────────────────────────────────────────────────────────────────────
const CALENDAR = [
  { event: 'FOMC Meeting',     day: 'Tue', date: '22', time: '14:00 ET', impact: 'high'   as const },
  { event: 'CPI — Core YoY',  day: 'Wed', date: '23', time: '08:30 ET', impact: 'high'   as const },
  { event: 'GDP Estimate Q1',  day: 'Thu', date: '24', time: '08:30 ET', impact: 'high'   as const },
  { event: 'Jobs Report',      day: 'Thu', date: '24', time: '08:30 ET', impact: 'high'   as const },
  { event: 'PCE Price Index',  day: 'Fri', date: '25', time: '08:30 ET', impact: 'medium' as const },
  { event: 'NVDA Earnings',    day: 'Wed', date: '23', time: 'After Close', impact: 'high' as const },
  { event: 'Consumer Conf.',   day: 'Tue', date: '22', time: '10:00 ET', impact: 'medium' as const },
];

const IMP = {
  high:   { color: RED,    label: 'HIGH', dot: 'bg-red-400'    },
  medium: { color: AMBER,  label: 'MED',  dot: 'bg-amber-400'  },
  low:    { color: EMERALD,label: 'LOW',  dot: 'bg-emerald-400'},
};

function EconomicCalendar() {
  return (
    <TerminalCard>
      <SectionLabel title="Economic Calendar" icon={Clock} color={BLUE} />
      <div className="space-y-2">
        {CALENDAR.map((ev, i) => {
          const imp = IMP[ev.impact];
          return (
            <motion.div key={i}
              initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05, ease: EASE }}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-white/[0.04] bg-white/[0.02] hover:border-violet-500/12 transition-all">
              <div className="flex flex-col items-center w-8 flex-shrink-0">
                <span className="text-[8px] font-bold text-slate-600 uppercase">{ev.day}</span>
                <span className="text-[14px] font-black text-white leading-tight">{ev.date}</span>
              </div>
              <div className="w-px h-7 bg-white/[0.05] flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold text-slate-200 truncate">{ev.event}</div>
                <div className="text-[9px] text-slate-600 flex items-center gap-1 mt-px">
                  <Clock className="w-2 h-2" />{ev.time}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className={cn('w-1.5 h-1.5 rounded-full', imp.dot)} />
                <span className="text-[8px] font-bold" style={{ color: imp.color }}>{imp.label}</span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </TerminalCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function MarketPulsePage() {
  const [data,        setData]        = useState<PulseData | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/markets/pulse', { headers: await authHeader() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
      setLastRefresh(new Date());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 90_000);
    return () => clearInterval(t);
  }, [fetchData]);

  return (
    <div className="relative min-h-screen" style={{ background: BG }}>
      {/* Grid background */}
      <div className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(124,58,237,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.03) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }} />
      {/* Ambient orbs */}
      <div className="fixed top-0 left-1/3 w-[700px] h-[300px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(124,58,237,0.06), transparent)', filter: 'blur(80px)' }} />
      <div className="fixed bottom-0 right-1/4 w-[400px] h-[300px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(59,130,246,0.05), transparent)', filter: 'blur(80px)' }} />

      <div className="relative max-w-screen-2xl mx-auto px-4 md:px-6 py-5">

        {/* Error banner */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mb-4 flex items-center gap-2.5 px-4 py-3 rounded-xl text-[12px]"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: RED }}>
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              Live data unavailable ({error}) — showing cached reference data. Market data resumes on next refresh.
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main grid */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-5">

          {/* LEFT: Main content */}
          <div className="space-y-5 min-w-0">
            <HeroBar data={data} loading={loading} lastRefresh={lastRefresh} onRefresh={fetchData} />
            <RegimeCard data={data} loading={loading} />
            <LeadersLaggards data={data} loading={loading} />
            <SectorMatrix data={data} loading={loading} />
            <MomentumLeaders data={data} loading={loading} />
            <VolatilityMonitor data={data} loading={loading} />

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
              <NarrativeFeed />
              <MoneyFlow data={data} loading={loading} />
            </div>

            <MarketInternals data={data} loading={loading} />
            <BreakoutDetector data={data} loading={loading} />
            <AIMarketStory data={data} loading={loading} />
          </div>

          {/* RIGHT: Sticky calendar */}
          <div className="hidden xl:block">
            <div className="sticky top-5">
              <EconomicCalendar />
            </div>
          </div>
        </div>

        {/* Footer */}
        <motion.div {...fadeUp(11)} className="text-center py-6 mt-2">
          <p className="text-[9px] text-slate-700 uppercase tracking-widest">
            Nivro Market Pulse · Yahoo Finance API · RSI + Regime AI · {loading ? 'Refreshing…' : '90s auto-refresh'} · Prices delayed 15min
          </p>
        </motion.div>
      </div>
    </div>
  );
}
