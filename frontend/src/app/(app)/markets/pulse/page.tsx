'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion';
import {
  Activity, TrendingUp, TrendingDown, RefreshCw, Brain, BarChart3,
  Zap, AlertTriangle, Clock, Radio, Flame, Snowflake, Scale,
  ArrowUpRight, ArrowDownRight, ChevronRight, Target, Shield,
  WifiOff, Eye, Layers3, Gauge, Globe2, DollarSign, Cpu, Landmark, HeartPulse, Factory, ShoppingBag, ShoppingCart, Lightbulb, Home, Pickaxe, type LucideIcon } from 'lucide-react';
import { cn, withAlpha, themeColors } from '@/lib/utils';
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
const BG      = 'rgb(var(--background))';
const CARD    = 'rgb(var(--card) / 0.85)';
const BORDER  = 'rgb(var(--foreground) / 0.06)';
const PURPLE  = 'rgb(var(--brand-400))';
const EMERALD = 'rgb(var(--positive-400))';
const RED     = 'rgb(var(--negative-400))';
const AMBER   = 'rgb(var(--warning-400))';
const BLUE    = 'rgb(var(--brand-400))';

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
        'relative rounded-xl border transition-all duration-300',
        'hover:border-brand-500/20',
        !noPad && 'p-4',
        className,
      )}
      style={{ background: CARD, borderColor: glow ? `${withAlpha(glow, 0.13)}` : BORDER }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-xl"
        style={{ background: 'linear-gradient(90deg, transparent, rgb(var(--brand-600) / 0.25), transparent)' }} />
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
      <span className="text-[11px] font-bold text-neutral-400">{title}</span>
      {sub && <span className="text-[11px] text-neutral-500 ml-1">· {sub}</span>}
      <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgb(var(--foreground) / 0.04), transparent)' }} />
      {live && (
        <span className="flex items-center gap-1 text-[11px] font-bold flex-shrink-0" style={{ color: EMERALD }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: EMERALD }} />
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
      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: color }} />
    </span>
  );
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-foreground/[0.04]', className)} />;
}

function PctBadge({ v, small }: { v: number; small?: boolean }) {
  const pos = v >= 0;
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 font-bold tabular-nums rounded-md px-1.5 py-0.5',
      small ? 'text-[11px]' : 'text-[11px]',
      pos ? 'text-positive-400 bg-positive-500/10' : 'text-negative-400 bg-negative-500/10',
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
  const fgColor  = fgVal >= 70 ? EMERALD : fgVal >= 55 ? 'rgb(var(--positive-400))' : fgVal >= 45 ? AMBER : fgVal >= 25 ? 'rgb(var(--warning-400))' : RED;
  const FGIcon   = fgVal >= 60 ? Flame : fgVal >= 40 ? Scale : Snowflake;
  const vix      = data?.vix;
  const sentiment = data?.aiSentiment ?? '—';
  const sentColor = sentiment === 'Bullish' ? EMERALD : sentiment === 'Bearish' ? RED : AMBER;

  return (
    <motion.div {...fadeUp(0)}>
      <div className="rounded-xl border p-4 md:p-5 flex flex-wrap items-center gap-5 lg:gap-8"
        style={{ background: 'rgb(var(--card) / 0.95)', borderColor: 'rgb(var(--brand-600) / 0.15)', backdropFilter: 'blur(20px)' }}>

        {/* Title + live */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="relative w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border"
            style={{ background: 'rgb(var(--brand-600))', borderColor: 'rgb(var(--brand-600) / 0.3)' }}>
            <Activity className="w-5 h-5 text-white" />
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-neutral-800 bg-positive-400 animate-pulse" />
          </div>
          <div>
            <h1 className="text-[16px] font-bold text-foreground tracking-tight leading-none">Market Pulse</h1>
            <p className="text-[11px] text-neutral-500 mt-0.5">Real-Time Intelligence Engine</p>
          </div>
        </div>

        <div className="h-8 w-px bg-foreground/[0.05] hidden sm:block flex-shrink-0" />

        {/* Time + market status */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center border flex-shrink-0',
            isOpen ? 'border-positive-500/20 bg-positive-500/10' : 'border-neutral-600/20 bg-neutral-600/10')}>
            {isOpen
              ? <Radio className="w-4 h-4 text-positive-400 animate-pulse" />
              : <WifiOff className="w-4 h-4 text-neutral-500" />}
          </div>
          <div>
            <div className={cn('text-[13px] font-bold', isOpen ? 'text-positive-400' : 'text-neutral-500')}>
              {isOpen ? 'MARKET OPEN' : 'MARKET CLOSED'}
            </div>
            <div className="text-[11px] text-neutral-500 tabular-nums flex items-center gap-1 mt-px">
              <Clock className="w-2.5 h-2.5" />
              {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              &nbsp;·&nbsp;
              {time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
          </div>
        </div>

        <div className="h-8 w-px bg-foreground/[0.05] hidden md:block flex-shrink-0" />

        {/* Fear & Greed */}
        {fg && (
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center border flex-shrink-0"
              style={{ background: `${withAlpha(fgColor, 0.08)}`, borderColor: `${withAlpha(fgColor, 0.15)}` }}>
              <FGIcon className="w-4 h-4" style={{ color: fgColor }} />
            </div>
            <div>
              <div className="text-[11px] text-neutral-500 font-medium">Fear & Greed</div>
              <div className="text-[15px] font-bold tabular-nums leading-tight" style={{ color: fgColor }}>
                {fg.value}<span className="text-[11px] font-semibold ml-1">{fg.label}</span>
              </div>
            </div>
          </div>
        )}

        {/* VIX */}
        {vix && (
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-warning-500/10 border border-warning-500/18 flex-shrink-0">
              <Gauge className="w-4 h-4 text-warning-400" />
            </div>
            <div>
              <div className="text-[11px] text-neutral-500 font-medium">VIX</div>
              <div className={cn('text-[15px] font-bold tabular-nums leading-tight flex items-center gap-1',
                vix.changePct < 0 ? 'text-positive-400' : 'text-negative-400')}>
                {vix.price.toFixed(2)}
                <span className="text-[11px]">{vix.changePct >= 0 ? '+' : ''}{vix.changePct.toFixed(2)}%</span>
              </div>
            </div>
          </div>
        )}

        {/* AI Sentiment */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center border flex-shrink-0"
            style={{ background: `${withAlpha(sentColor, 0.08)}`, borderColor: `${withAlpha(sentColor, 0.15)}` }}>
            <Brain className="w-4 h-4" style={{ color: sentColor }} />
          </div>
          <div>
            <div className="text-[11px] text-neutral-500 font-medium">AI Sentiment</div>
            <div className="text-[13px] font-bold" style={{ color: sentColor }}>{sentiment}</div>
          </div>
        </div>

        <div className="flex-1" />

        {/* Refresh */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {lastRefresh && (
            <span className="text-[11px] text-neutral-500 tabular-nums hidden lg:block">
              Updated {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button onClick={onRefresh} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold text-neutral-400 hover:text-foreground hover:border-brand-500/30 hover:bg-brand-500/8 transition-all disabled:opacity-40"
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
                  <circle cx="80" cy="80" r="44" fill="none" stroke="rgb(var(--foreground) / 0.05)" strokeWidth="12" />
                  <circle cx="80" cy="80" r="44" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
                    strokeDasharray={`${dash} 276`}
                    style={{ filter: `drop-shadow(0 0 16px ${withAlpha(color, 0.53)})` }} />
                  {/* Tick marks */}
                  {[0, 25, 50, 75, 100].map((v) => {
                    const angle = (v / 100) * 360 - 90;
                    const rad   = (angle * Math.PI) / 180;
                    const r1 = 57; const r2 = 63;
                    return (
                      <line key={v}
                        x1={80 + r1 * Math.cos(rad)} y1={80 + r1 * Math.sin(rad)}
                        x2={80 + r2 * Math.cos(rad)} y2={80 + r2 * Math.sin(rad)}
                        stroke="rgb(var(--foreground) / 0.15)" strokeWidth="1.5" />
                    );
                  })}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <motion.div className="text-[28px] font-bold tabular-nums" style={{ color }}
                    initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.3, duration: 0.5, ease: EASE }}>
                    {conf}%
                  </motion.div>
                  <div className="text-[11px] font-bold text-neutral-500">Confidence</div>
                </div>
              </div>
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                className="mt-2 text-center">
                <div className="text-[22px] font-bold tracking-tight" style={{ color }}>{label}</div>
                <div className="text-[11px] text-neutral-500 mt-0.5">Current Regime</div>
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
                    background: d.positive ? 'rgb(var(--positive-500) / 0.05)' : d.positive === false ? 'rgb(var(--negative-500) / 0.05)' : 'rgb(var(--foreground) / 0.02)',
                    borderColor: d.positive ? 'rgb(var(--positive-500) / 0.15)' : d.positive === false ? 'rgb(var(--negative-500) / 0.12)' : BORDER,
                  }}>
                  <span className="text-[14px] flex-shrink-0 mt-0.5">
                    {d.positive ? '↑' : d.positive === false ? '↓' : '→'}
                  </span>
                  <span className="text-[12px] text-neutral-300 leading-relaxed">{d.text}</span>
                  <div className="ml-auto flex-shrink-0">
                    {d.positive
                      ? <span className="text-[11px] font-bold text-positive-400 bg-positive-500/10 border border-positive-500/20 px-1.5 py-0.5 rounded-md">POSITIVE</span>
                      : d.positive === false
                      ? <span className="text-[11px] font-bold text-negative-400 bg-negative-500/10 border border-negative-500/20 px-1.5 py-0.5 rounded-md">RISK</span>
                      : <span className="text-[11px] font-bold text-neutral-500 bg-neutral-500/10 border border-neutral-500/20 px-1.5 py-0.5 rounded-md">NEUTRAL</span>}
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
      className="group relative rounded-xl border overflow-hidden cursor-pointer transition-all duration-250 hover:scale-[1.015]"
      style={{
        background: pos ? 'rgb(var(--positive-500) / 0.04)' : 'rgb(var(--negative-500) / 0.04)',
        borderColor: pos ? 'rgb(var(--positive-500) / 0.15)' : 'rgb(var(--negative-500) / 0.15)',
        boxShadow: expanded ? `0 0 28px ${pos ? EMERALD : RED}18` : 'none',
      }}
      onClick={() => setExpanded(v => !v)}>
      <div className="absolute left-0 inset-y-0 w-[2.5px] rounded-r"
        style={{ background: pos ? EMERALD : RED }} />

      <div className="ml-3 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[11px] font-bold text-neutral-500 w-4 flex-shrink-0">#{rank}</span>
            <div className="min-w-0">
              <div className="text-[13px] font-bold text-foreground truncate">{q.symbol}</div>
              <div className="text-[11px] text-neutral-500 truncate">{q.sector}</div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <PctBadge v={q.changePct} />
            <span className="text-[11px] text-neutral-500 tabular-nums">
              Vol {q.volRatio?.toFixed(1)}×
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between mt-2">
          <span className="text-[12px] font-bold text-foreground tabular-nums">
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
              <div className="pt-2.5 mt-2.5 border-t border-foreground/[0.05] grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                {[
                  ['Volume', q.volume ? `${(q.volume / 1e6).toFixed(1)}M` : '—'],
                  ['Avg Vol', q.avgVolume ? `${(q.avgVolume / 1e6).toFixed(1)}M` : '—'],
                  ['Vol Ratio', q.volRatio ? `${q.volRatio.toFixed(2)}×` : '—'],
                  ['52W High', q.high52w ? q.high52w.toFixed(1) : '—'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-neutral-500">{k}</span>
                    <span className="font-bold text-foreground">{v}</span>
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
const SECTOR_ICON: Record<string, LucideIcon> = {
  Technology: Cpu, Financials: Landmark, Healthcare: HeartPulse, Energy: Zap,
  Industrials: Factory, 'Consumer Disc': ShoppingBag, 'Consumer Stap': ShoppingCart,
  Utilities: Lightbulb, 'Real Estate': Home, Materials: Pickaxe, 'Comm Svcs': Radio,
};

function SectorCell({ s }: { s: SectorData }) {
  const pos      = s.changePct >= 0;
  const intensity = Math.min(Math.abs(s.changePct) / 3, 1);
  const cellBg   = pos
    ? `rgb(var(--positive-500) / ${0.04 + intensity * 0.14})`
    : `rgb(var(--negative-500) / ${0.04 + intensity * 0.14})`;
  const border   = pos
    ? `rgb(var(--positive-500) / ${0.12 + intensity * 0.2})`
    : `rgb(var(--negative-500) / ${0.12 + intensity * 0.2})`;
  const color    = pos ? EMERALD : RED;

  return (
    <motion.div variants={cardIn}
      className="relative rounded-xl border p-3 overflow-hidden transition-all duration-300 cursor-default group"
      style={{ background: cellBg, borderColor: border }}
      whileHover={{ scale: 1.03, y: -3, boxShadow: `0 12px 40px ${withAlpha(color, 0.13)}` }}>

      {/* Intensity bar at bottom */}
      <div className="absolute inset-x-0 bottom-0 h-0.5 rounded-b-xl"
        style={{ background: color, opacity: 0.3 + intensity * 0.5 }} />

      <div className="flex items-start justify-between mb-2">
        {(() => { const SectorIcon = SECTOR_ICON[s.name] ?? BarChart3; return <SectorIcon className="h-4 w-4 text-neutral-400" aria-hidden />; })()}
        <span className={cn(
          'text-[11px] font-bold px-1.5 py-0.5 rounded-md border',
          s.bias === 'bullish' ? 'text-positive-400 bg-positive-500/10 border-positive-500/20'
            : s.bias === 'bearish' ? 'text-negative-400 bg-negative-500/10 border-negative-500/20'
            : 'text-neutral-400 bg-neutral-500/10 border-neutral-500/20',
        )}>{s.bias}</span>
      </div>
      <div className="text-[11px] font-bold text-foreground truncate mb-1">{s.name}</div>
      <div className="text-[16px] font-bold tabular-nums" style={{ color }}>
        {s.changePct >= 0 ? '+' : ''}{s.changePct.toFixed(2)}%
      </div>
      <div className="flex items-center justify-between mt-2 text-[11px]">
        <span className="text-neutral-500">RSI {s.rsi}</span>
        <span style={{ color, opacity: 0.8 }}>
          {s.moneyFlow.direction === 'in' ? '↑' : '↓'} {s.moneyFlow.value.toFixed(1)}B
        </span>
      </div>
      {/* Strength bar */}
      <div className="mt-2 h-0.5 rounded-full bg-foreground/[0.05] overflow-hidden">
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
  const rsiColor = q.rsi > 70 ? RED : q.rsi < 30 ? EMERALD : 'rgb(var(--neutral-400))';
  return (
    <motion.div variants={cardIn}
      className="flex-shrink-0 rounded-xl border p-4 w-52 transition-all duration-300 cursor-default"
      style={{ background: CARD, borderColor: BORDER }}
      whileHover={{ scale: 1.04, y: -4, borderColor: 'rgb(var(--brand-600) / 0.4)', boxShadow: `0 16px 40px rgb(var(--brand-600) / 0.15)` }}>

      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="text-[14px] font-bold text-foreground">{q.symbol}</div>
          <div className="text-[11px] text-neutral-500 truncate max-w-[120px]">{q.sector}</div>
        </div>
        <PctBadge v={q.changePct} small />
      </div>

      <div className="text-[20px] font-bold text-foreground tabular-nums mb-1">
        {q.price >= 10000
          ? q.price.toLocaleString('en-IN', { maximumFractionDigits: 0 })
          : q.price >= 100 ? q.price.toFixed(1) : q.price.toFixed(2)}
      </div>

      <Spark data={q.sparkline} pos={pos} h={36} w={176} />

      <div className="grid grid-cols-3 gap-1.5 mt-3 text-[11px]">
        <div className="text-center">
          <div className="font-bold tabular-nums" style={{ color: rsiColor }}>{q.rsi}</div>
          <div className="text-neutral-500">RSI</div>
        </div>
        <div className="text-center">
          <div className="font-bold text-brand-400 tabular-nums">{q.volRatio.toFixed(1)}×</div>
          <div className="text-neutral-500">Vol</div>
        </div>
        <div className="text-center">
          <div className="font-bold text-warning-400 tabular-nums">{q.trendScore}</div>
          <div className="text-neutral-500">Trend</div>
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
            style={{ scrollbarWidth: 'thin', scrollbarColor: `${withAlpha(PURPLE, 0.19)} transparent` }}>
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
          <div className="text-[11px] font-bold text-foreground">{q.symbol}</div>
          <div className="text-[11px] text-neutral-500 truncate max-w-[90px]">{q.name}</div>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md"
            style={{ color: rsCol, background: `${withAlpha(rsCol, 0.07)}` }}>
            {rs >= 70 ? 'HIGH RISK' : rs >= 45 ? 'MOD RISK' : 'LOW RISK'}
          </span>
        </div>
      </div>
      <div className="text-[18px] font-bold text-foreground tabular-nums">
        {q.price >= 1000 ? q.price.toLocaleString('en-US', { maximumFractionDigits: 0 }) : q.price.toFixed(2)}
      </div>
      <PctBadge v={flip ? -q.changePct : q.changePct} small />
      {/* Risk bar */}
      <div className="mt-2.5 h-1 rounded-full bg-foreground/[0.04] overflow-hidden">
        <motion.div className="h-full rounded-full" style={{ background: rsCol }}
          initial={{ width: 0 }} animate={{ width: `${rs}%` }}
          transition={{ duration: 0.8, ease: EASE }} />
      </div>
      <div className="flex justify-between mt-1 text-[11px] text-neutral-500">
        <span>Low</span><span>Risk {rs}/100</span><span>High</span>
      </div>
    </motion.div>
  );
}

function VolatilityMonitor({ data, loading }: { data: PulseData | null; loading: boolean }) {
  return (
    <motion.div {...fadeUp(5)}>
      <TerminalCard>
        <SectionLabel title="Volatility Monitor" icon={Activity} color="rgb(var(--warning-400))" live />
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
  bullish:     { color: EMERALD,   label: 'BULLISH',     icon: TrendingUp,   bg: 'rgb(var(--positive-500) / 0.04)',   border: 'rgb(var(--positive-500) / 0.15)'   },
  bearish:     { color: RED,       label: 'BEARISH',     icon: TrendingDown, bg: 'rgb(var(--negative-500) / 0.04)',   border: 'rgb(var(--negative-500) / 0.15)'   },
  macro:       { color: AMBER,     label: 'MACRO',       icon: Globe2,       bg: 'rgb(var(--warning-500) / 0.04)',  border: 'rgb(var(--warning-500) / 0.15)'  },
  fed:         { color: PURPLE,    label: 'FED',         icon: Brain,        bg: 'rgb(var(--brand-600) / 0.06)',  border: 'rgb(var(--brand-600) / 0.2)'   },
  institutional:{ color: BLUE,    label: 'INSTITUTIONAL',icon: Layers3,     bg: 'rgb(var(--brand-500) / 0.04)',  border: 'rgb(var(--brand-500) / 0.15)'  },
  breaking:    { color: 'rgb(var(--negative-400))', label: 'BREAKING',    icon: Zap,          bg: 'rgb(var(--negative-500) / 0.06)',   border: 'rgb(var(--negative-500) / 0.25)'   },
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
                className="group relative rounded-xl border overflow-hidden transition-all duration-250 hover:border-brand-500/25"
                style={{ background: cfg.bg, borderColor: cfg.border }}>
                <div className="absolute left-0 inset-y-0 w-[2.5px]" style={{ background: cfg.color, opacity: 0.7 }} />
                <div className={cn('ml-3', isLarge ? 'p-3.5' : 'p-3')}>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-bold px-1.5 py-0.5 rounded border"
                        style={{ color: cfg.color, background: `${withAlpha(cfg.color, 0.07)}`, borderColor: `${withAlpha(cfg.color, 0.15)}` }}>
                        {cfg.label}
                      </span>
                      <span className="text-[11px] font-bold px-1.5 py-0.5 rounded border"
                        style={{
                          color: item.impact === 'HIGH' ? RED : item.impact === 'MEDIUM' ? AMBER : 'rgb(var(--neutral-400))',
                          background: item.impact === 'HIGH' ? 'rgb(var(--negative-500) / 0.08)' : item.impact === 'MEDIUM' ? 'rgb(var(--warning-500) / 0.08)' : 'rgb(var(--neutral-400) / 0.08)',
                          borderColor: item.impact === 'HIGH' ? 'rgb(var(--negative-500) / 0.2)' : item.impact === 'MEDIUM' ? 'rgb(var(--warning-500) / 0.2)' : 'rgb(var(--neutral-400) / 0.2)',
                        }}>
                        {item.impact} IMPACT
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-[11px] font-bold" style={{ color: cfg.color }}>{item.conf}%</span>
                      <Icon className="w-3 h-3 flex-shrink-0" style={{ color: cfg.color }} />
                    </div>
                  </div>
                  <p className={cn('text-neutral-200 leading-relaxed font-medium', isLarge ? 'text-[12px]' : 'text-[11px]')}>
                    {item.text}
                  </p>
                  <div className="flex items-center gap-1 mt-1.5">
                    <Clock className="w-2.5 h-2.5 text-neutral-500" />
                    <span className="text-[11px] text-neutral-500">{item.time}</span>
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
      style={{ background: `${withAlpha(color, 0.02)}`, borderColor: `${withAlpha(color, 0.09)}` }}
      whileHover={{ scale: 1.025, y: -3, boxShadow: `0 12px 40px ${withAlpha(color, 0.09)}` }}>
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none rounded-xl opacity-0 hover:opacity-100 transition-opacity duration-500"
        style={{ background: `radial-gradient(circle at 50% 0%, ${withAlpha(color, 0.03)}, transparent)` }} />
      <div className="relative">
        <div className="flex items-start justify-between mb-2">
          <span className="text-[11px] font-bold text-neutral-400">{d.sector}</span>
          <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md border"
            style={{ color, background: `${withAlpha(color, 0.06)}`, borderColor: `${withAlpha(color, 0.13)}` }}>
            {isIn ? 'INFLOW' : 'OUTFLOW'}
          </span>
        </div>
        <div className="text-[22px] font-bold tabular-nums flex items-center gap-1.5" style={{ color }}>
          {isIn ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
          {isIn ? '+' : '-'}${d.flow.toFixed(1)}B
        </div>
        <div className="text-[11px] mt-0.5 font-semibold tabular-nums" style={{ color, opacity: 0.7 }}>
          {d.pct >= 0 ? '+' : ''}{d.pct.toFixed(2)}%
        </div>
        {/* Flow bar */}
        <div className="mt-3 h-1.5 rounded-full bg-foreground/[0.04] overflow-hidden">
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
        <p className="mt-3 text-[11px] text-neutral-500 pt-2.5 border-t border-foreground/[0.04]">
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
    <div className="flex flex-col items-center gap-2 p-3 rounded-xl border" style={{ borderColor: `${withAlpha(color, 0.09)}`, background: `${withAlpha(color, 0.02)}` }}>
      <div className="relative w-20 h-20">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="30" fill="none" stroke="rgb(var(--foreground) / 0.05)" strokeWidth="8" />
          <motion.circle cx="40" cy="40" r="30" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={`${arc} 251`}
            initial={{ strokeDasharray: '0 251' }} animate={{ strokeDasharray: `${arc} 251` }}
            transition={{ duration: 0.9, ease: EASE }}
            style={{ filter: `drop-shadow(0 0 6px ${withAlpha(color, 0.4)})` }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[16px] font-bold tabular-nums" style={{ color }}>
            {value.toLocaleString()}
          </span>
        </div>
      </div>
      <div className="text-center">
        <div className="text-[11px] font-bold text-neutral-300">{label}</div>
        {sub && <div className="text-[11px] text-neutral-500 mt-0.5">{sub}</div>}
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
                <div key={m.label} className="p-3 rounded-xl border border-foreground/[0.04] bg-foreground/[0.02]">
                  <div className="flex justify-between text-[11px] font-bold mb-2">
                    <span className="text-neutral-400">{m.label}</span>
                    <span style={{ color: m.color }}>{m.value.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-foreground/[0.05] overflow-hidden">
                    <motion.div className="h-full rounded-full" style={{ background: m.color }}
                      initial={{ width: 0 }} animate={{ width: `${m.value}%` }}
                      transition={{ duration: 0.9, ease: EASE }} />
                  </div>
                  <div className="text-[11px] text-neutral-500 mt-1">{m.sub}</div>
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
  EARLY:     { color: AMBER,  label: 'EARLY',     bg: 'rgb(var(--warning-500) / 0.08)',  border: 'rgb(var(--warning-500) / 0.2)'  },
  CONFIRMED: { color: EMERALD,label: 'CONFIRMED', bg: 'rgb(var(--positive-500) / 0.08)',   border: 'rgb(var(--positive-500) / 0.2)'   },
  EXTENDED:  { color: 'rgb(var(--neutral-400))', label: 'EXTENDED', bg: 'rgb(var(--neutral-400) / 0.06)', border: 'rgb(var(--neutral-400) / 0.15)' },
};

function BreakoutCard({ b }: { b: Breakout }) {
  const sc  = STATUS_CFG[b.status];
  const pos = b.changePct >= 0;
  return (
    <motion.div variants={cardIn}
      className="group relative rounded-xl border overflow-hidden transition-all duration-300"
      style={{ background: sc.bg, borderColor: sc.border }}
      whileHover={{ scale: 1.015, y: -3, boxShadow: `0 12px 40px ${withAlpha(sc.color, 0.09)}` }}>
      <div className="absolute left-0 inset-y-0 w-[3px]" style={{ background: sc.color }} />

      <div className="ml-3 p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[15px] font-bold text-foreground">{b.symbol}</span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md border"
                style={{ color: sc.color, background: sc.bg, borderColor: sc.border }}>
                {b.status}
              </span>
            </div>
            <div className="text-[11px] text-neutral-500 mt-0.5">{b.sector} · {b.pattern}</div>
          </div>
          <div className="text-right">
            <div className="text-[22px] font-bold tabular-nums" style={{ color: sc.color }}>{b.breakoutScore}</div>
            <div className="text-[11px] text-neutral-500">Score/100</div>
          </div>
        </div>

        {/* Score bar */}
        <div className="relative h-1.5 rounded-full bg-foreground/[0.05] overflow-hidden mb-3">
          <motion.div className="h-full rounded-full" style={{ background: sc.color }}
            initial={{ width: 0 }} animate={{ width: `${b.breakoutScore}%` }}
            transition={{ duration: 0.9, ease: EASE }} />
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="text-center p-2 rounded-lg bg-foreground/[0.03] border border-foreground/[0.05]">
            <div className="text-[12px] font-bold tabular-nums" style={{ color: pos ? EMERALD : RED }}>
              {pos ? '+' : ''}{b.changePct.toFixed(2)}%
            </div>
            <div className="text-[11px] text-neutral-500">Daily</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-foreground/[0.03] border border-foreground/[0.05]">
            <div className="text-[12px] font-bold text-brand-400 tabular-nums">{b.volRatio.toFixed(1)}×</div>
            <div className="text-[11px] text-neutral-500">Vol Ratio</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-foreground/[0.03] border border-foreground/[0.05]">
            <div className="text-[12px] font-bold text-brand-400 tabular-nums">{b.rsi.toFixed(0)}</div>
            <div className="text-[11px] text-neutral-500">RSI</div>
          </div>
        </div>

        <p className="text-[11px] text-neutral-400 leading-relaxed">{b.aiReason}</p>
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
          <div className="flex flex-col items-center justify-center py-12 text-neutral-500">
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

        {/* Grid overlay */}

        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <motion.div
                className="w-12 h-12 rounded-xl flex items-center justify-center border flex-shrink-0"
                style={{ background: 'rgb(var(--brand-600))', borderColor: 'rgb(var(--brand-600) / 0.35)' }}
                animate={{ boxShadow: brainPulse ? `0 0 32px ${withAlpha(PURPLE, 0.4)}` : `0 0 12px ${withAlpha(PURPLE, 0.13)}` }}
                transition={{ duration: 0.8 }}>
                <Brain className="w-6 h-6 text-white" />
              </motion.div>
              <div>
                <div className="text-[16px] font-bold text-foreground flex items-center gap-2">
                  AI Market Story
                  <LiveDot />
                </div>
                <div className="text-[11px] text-neutral-500 mt-0.5">
                  Generated from live Yahoo Finance data · Updated every 90s
                </div>
              </div>
            </div>

            {/* Confidence meter */}
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
              <span className="text-[11px] text-neutral-500">AI Confidence</span>
              <div className="flex items-center gap-1.5">
                {[...Array(5)].map((_, i) => (
                  <motion.div key={i} className="w-5 h-2 rounded-full transition-all"
                    animate={{ background: i < Math.round(conf / 20) ? PURPLE : 'rgb(var(--foreground) / 0.06)' }}
                    transition={{ delay: i * 0.05 }} />
                ))}
                <span className="text-[11px] font-bold" style={{ color: PURPLE }}>{conf}%</span>
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
                  style={{ borderColor: `${withAlpha(color, 0.13)}`, background: `${withAlpha(color, 0.03)}` }}>
                  <div className="text-[11px] text-neutral-500 mb-1">{label}</div>
                  <div className="text-[12px] font-bold leading-tight" style={{ color }}>{value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Institutional flow banner */}
          {n && (
            <div className="flex items-center gap-2.5 mb-4 px-4 py-2.5 rounded-xl border"
              style={{ background: 'rgb(var(--brand-600) / 0.06)', borderColor: 'rgb(var(--brand-600) / 0.15)' }}>
              <Layers3 className="w-4 h-4 text-brand-400 flex-shrink-0" />
              <span className="text-[11px] text-neutral-400 font-medium">Institutional Flow:</span>
              <span className="text-[11px] font-bold text-brand-300">{n.institutionalFlow}</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-positive-400 ml-auto" />
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
                  <p className="text-[12px] text-neutral-300 leading-relaxed">{b}</p>
                </motion.div>
              ))}
            </div>
          )}

          {/* Risk area */}
          {n && (
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border"
              style={{ background: 'rgb(var(--negative-500) / 0.05)', borderColor: 'rgb(var(--negative-500) / 0.15)' }}>
              <AlertTriangle className="w-3.5 h-3.5 text-negative-400 flex-shrink-0" />
              <span className="text-[11px] text-neutral-400"><span className="font-bold text-negative-400">Risk Area:</span> {n.riskArea}</span>
            </div>
          )}

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-foreground/[0.05]">
            <span className="text-[11px] text-neutral-500">
              Data: Yahoo Finance · Refresh: 90s · {data?.timestamp ? new Date(data.timestamp).toLocaleTimeString() : 'Loading…'}
            </span>
            <span className="text-[11px] font-bold" style={{ color: PURPLE }}>
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
  high:   { color: RED,    label: 'HIGH', dot: 'bg-negative-400'    },
  medium: { color: AMBER,  label: 'MED',  dot: 'bg-warning-400'  },
  low:    { color: EMERALD,label: 'LOW',  dot: 'bg-positive-400'},
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
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-foreground/[0.04] bg-foreground/[0.02] hover:border-brand-500/12 transition-all">
              <div className="flex flex-col items-center w-8 flex-shrink-0">
                <span className="text-[11px] font-bold text-neutral-500">{ev.day}</span>
                <span className="text-[14px] font-bold text-foreground leading-tight">{ev.date}</span>
              </div>
              <div className="w-px h-7 bg-foreground/[0.05] flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold text-neutral-200 truncate">{ev.event}</div>
                <div className="text-[11px] text-neutral-500 flex items-center gap-1 mt-px">
                  <Clock className="w-2 h-2" />{ev.time}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className={cn('w-1.5 h-1.5 rounded-full', imp.dot)} />
                <span className="text-[11px] font-bold" style={{ color: imp.color }}>{imp.label}</span>
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
      setData(themeColors(json));
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
      {/* Ambient orbs */}

      <div className="relative max-w-screen-2xl mx-auto px-4 md:px-6 py-5">

        {/* Error banner */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mb-4 flex items-center gap-2.5 px-4 py-3 rounded-xl text-[12px]"
              style={{ background: 'rgb(var(--negative-500) / 0.08)', border: '1px solid rgb(var(--negative-500) / 0.2)', color: RED }}>
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
          <p className="text-[11px] text-neutral-500">
            Nivro Market Pulse · Yahoo Finance API · RSI + Regime AI · {loading ? 'Refreshing…' : '90s auto-refresh'} · Prices delayed 15min
          </p>
        </motion.div>
      </div>
    </div>
  );
}
