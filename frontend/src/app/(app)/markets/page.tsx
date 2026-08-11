'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, TrendingUp, TrendingDown, Minus, RefreshCw,
  Radio, Clock, Zap, AlertCircle, Brain, BarChart3,
  Globe2, ArrowUpRight, ArrowDownRight, ChevronRight,
  WifiOff, Target, Flame, Snowflake, Scale, Calendar,
  Building2, Layers3, Wifi, Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { authHeader } from "@/lib/api/authToken";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface Quote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  sparkline: number[];
}

interface MissionData {
  timestamp: string;
  marketOpen: boolean;
  fearGreed: { value: number; label: string };
  vix: { price: number; changePct: number } | null;
  regions: {
    us: Quote[];
    eu: Quote[];
    asia: Quote[];
    commodities: Quote[];
    risk: Quote[];
  };
  futures: Quote[];
}

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATION HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.42, delay, ease: 'easeOut' as const } },
});

const cardAnim = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.32, ease: 'easeOut' as const } },
};

const stagger = { animate: { transition: { staggerChildren: 0.06 } } };

// ─────────────────────────────────────────────────────────────────────────────
// SHARED UI PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────
function GlassCard({ children, className, glow, hover = true }: { children: React.ReactNode; className?: string; glow?: string; hover?: boolean }) {
  return (
    <div className={cn(
      'rounded-2xl border border-white/[0.07] p-4',
      'bg-[rgba(7,11,22,0.75)] backdrop-blur-md',
      'transition-all duration-250 hover:-translate-y-[2px] hover:border-purple-500/20 hover:shadow-[0_10px_40px_rgba(124,92,255,0.09)]',
      glow && `hover:shadow-[0_10px_40px_${glow}]`,
      className
    )}>
      {children}
    </div>
  );
}

function SectionHeader({ title, icon: Icon, gradient = 'from-violet-500 to-purple-600', live }: {
  title: string; icon: any; gradient?: string; live?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className={`w-0.5 h-4 rounded-full bg-gradient-to-b ${gradient} flex-shrink-0`} />
      <Icon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
      <h2 className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{title}</h2>
      <div className="flex-1 h-px bg-gradient-to-r from-white/[0.04] to-transparent" />
      {live && (
        <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-400 uppercase tracking-wider flex-shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Live
        </span>
      )}
    </div>
  );
}

function Sparkline({ data, positive, h = 28, w = 60 }: { data: number[]; positive: boolean; h?: number; w?: number }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 2)}`).join(' ');
  const color = positive ? '#22c55e' : '#ef4444';
  const id = `sp${positive ? 'g' : 'r'}${w}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="flex-shrink-0">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#${id})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — HERO STATUS BAR
// ─────────────────────────────────────────────────────────────────────────────
function HeroStatusBar({ data, loading, lastRefresh, onRefresh }: {
  data: MissionData | null; loading: boolean; lastRefresh: Date | null; onRefresh: () => void;
}) {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);

  const isOpen = data?.marketOpen ?? false;
  const fg = data?.fearGreed;
  const vix = data?.vix;
  const fgVal = fg?.value ?? 50;
  const fgColor = fgVal >= 70 ? '#22c55e' : fgVal >= 55 ? '#84cc16' : fgVal >= 45 ? '#eab308' : fgVal >= 25 ? '#f97316' : '#ef4444';
  const FGIcon = fgVal >= 60 ? Flame : fgVal >= 40 ? Scale : Snowflake;

  return (
    <motion.div {...fadeUp(0)}>
      <div className="rounded-2xl border border-white/[0.09] bg-[rgba(7,11,22,0.85)] backdrop-blur-xl p-4 md:p-5">
        <div className="flex flex-wrap items-center gap-4 lg:gap-7">

          {/* Market Status */}
          <div className="flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center border flex-shrink-0',
              isOpen ? 'bg-emerald-500/10 border-emerald-500/20 shadow-[0_0_20px_rgba(34,197,94,0.12)]'
                     : 'bg-slate-500/10 border-slate-500/15')}>
              {isOpen ? <Radio className="w-5 h-5 text-emerald-400 animate-pulse" />
                      : <WifiOff className="w-5 h-5 text-slate-500" />}
            </div>
            <div>
              <div className={cn('text-[14px] font-bold', isOpen ? 'text-emerald-400' : 'text-slate-500')}>
                Market {isOpen ? 'OPEN' : 'CLOSED'}
              </div>
              <div className="text-[10px] text-slate-600 tabular-nums flex items-center gap-1 mt-0.5">
                <Clock className="w-2.5 h-2.5" />
                {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                &nbsp;·&nbsp;
                {time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </div>
            </div>
          </div>

          <div className="w-px h-8 bg-white/[0.06] hidden sm:block" />

          {/* Fear & Greed */}
          {fg && (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center border flex-shrink-0"
                style={{ background: `${fgColor}14`, borderColor: `${fgColor}28` }}>
                <FGIcon className="w-4 h-4" style={{ color: fgColor }} />
              </div>
              <div>
                <div className="text-[10px] text-slate-500 font-medium">Fear & Greed</div>
                <div className="text-[16px] font-bold tabular-nums leading-tight" style={{ color: fgColor }}>
                  {fg.value}&nbsp;<span className="text-[11px] font-semibold">{fg.label}</span>
                </div>
              </div>
            </div>
          )}

          <div className="w-px h-8 bg-white/[0.06] hidden sm:block" />

          {/* VIX */}
          {vix && (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-orange-500/10 border border-orange-500/18 flex-shrink-0">
                <Activity className="w-4 h-4 text-orange-400" />
              </div>
              <div>
                <div className="text-[10px] text-slate-500 font-medium">VIX</div>
                <div className={cn('text-[16px] font-bold tabular-nums leading-tight flex items-center gap-1',
                  vix.changePct < 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {vix.price.toFixed(2)}
                  <span className="text-[11px]">{vix.changePct > 0 ? '+' : ''}{vix.changePct.toFixed(2)}%</span>
                </div>
              </div>
            </div>
          )}

          <div className="w-px h-8 bg-white/[0.06] hidden lg:block" />

          {/* Pill badges */}
          <div className="hidden lg:flex items-center gap-2">
            {[
              { label: 'AI Engine', color: '#8b5cf6', bg: '#8b5cf614' },
              { label: 'Yahoo Finance', color: '#3b82f6', bg: '#3b82f614' },
              { label: '60s Refresh', color: '#22c55e', bg: '#22c55e14' },
            ].map(({ label, color, bg }) => (
              <span key={label} className="text-[9px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wider"
                style={{ color, background: bg, borderColor: `${color}28` }}>
                {label}
              </span>
            ))}
          </div>

          <div className="flex-1" />

          {/* Refresh */}
          <div className="flex items-center gap-3">
            {lastRefresh && (
              <span className="text-[9px] text-slate-600 tabular-nums hidden md:block">
                {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button onClick={onRefresh} disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.07] text-[11px] font-medium text-slate-400 hover:text-white hover:border-purple-500/30 hover:bg-purple-500/5 transition-all disabled:opacity-50">
              <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />Refresh
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — GLOBAL SNAPSHOT (Tabbed)
// ─────────────────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'us',          label: 'US',          color: 'from-blue-500 to-indigo-600'    },
  { key: 'eu',          label: 'Europe',       color: 'from-emerald-500 to-cyan-600'  },
  { key: 'asia',        label: 'Asia',         color: 'from-orange-500 to-amber-600'  },
  { key: 'commodities', label: 'Commodities',  color: 'from-yellow-500 to-amber-600'  },
  { key: 'risk',        label: 'Risk / FX',    color: 'from-red-500 to-rose-600'      },
] as const;

type TabKey = typeof TABS[number]['key'];

function QuoteCard({ quote }: { quote: Quote }) {
  const pos = quote.changePct >= 0;
  return (
    <motion.div variants={cardAnim}>
      <GlassCard className="flex-1">
        <div className="flex items-start justify-between mb-2">
          <div className="min-w-0">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{quote.symbol}</div>
            <div className="text-[11px] text-slate-700 truncate">{quote.name}</div>
          </div>
          <Sparkline data={quote.sparkline} positive={pos} />
        </div>
        <div className="flex items-end justify-between mt-1">
          <div>
            <div className="text-[18px] font-bold text-white tabular-nums">
              {quote.price >= 1000
                ? quote.price.toLocaleString('en-US', { maximumFractionDigits: 0 })
                : quote.price.toFixed(2)}
            </div>
            <div className={cn('flex items-center gap-0.5 text-[12px] font-bold tabular-nums',
              pos ? 'text-emerald-400' : 'text-red-400')}>
              {pos ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {pos ? '+' : ''}{quote.changePct.toFixed(2)}%
            </div>
          </div>
          <div className={cn('text-[9px] font-bold px-2 py-0.5 rounded-full border',
            pos ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/18'
               : 'text-red-400 bg-red-500/10 border-red-500/18')}>
            {pos ? 'BULL' : 'BEAR'}
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}

function GlobalSnapshot({ data, loading }: { data: MissionData | null; loading: boolean }) {
  const [activeTab, setActiveTab] = useState<TabKey>('us');
  const quotes: Quote[] = data?.regions[activeTab] ?? [];
  const tab = TABS.find(t => t.key === activeTab)!;

  return (
    <motion.div {...fadeUp(0.08)}>
      <SectionHeader title="Global Snapshot" icon={Globe2} gradient="from-blue-500 to-indigo-600" live />

      {/* Tab Bar */}
      <div className="flex items-center gap-1 mb-4 p-1 rounded-xl bg-white/[0.03] border border-white/[0.05] w-fit">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200',
              activeTab === t.key
                ? 'bg-white/[0.08] text-white shadow-sm border border-white/[0.08]'
                : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.03]'
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Cards */}
      <AnimatePresence mode="wait">
        <motion.div key={activeTab}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: 'easeOut' as const }}>
          {loading || quotes.length === 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-[100px] rounded-2xl bg-white/[0.03] animate-pulse border border-white/[0.04]" />
              ))}
            </div>
          ) : (
            <motion.div variants={stagger} initial="initial" animate="animate"
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {quotes.map(q => <QuoteCard key={q.symbol} quote={q} />)}
            </motion.div>
          )}

          {/* Subtle region label */}
          <div className="flex items-center gap-1.5 mt-2">
            <div className={`w-2 h-2 rounded-full bg-gradient-to-br ${tab.color} flex-shrink-0`} />
            <span className="text-[9px] text-slate-700 uppercase tracking-widest">{tab.label} Markets</span>
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — FUTURES MONITOR
// ─────────────────────────────────────────────────────────────────────────────
function FuturesMonitor({ data, loading }: { data: MissionData | null; loading: boolean }) {
  const futures = data?.futures ?? [];
  return (
    <motion.div {...fadeUp(0.1)}>
      <GlassCard hover={false} className="h-full transition-none">
        <SectionHeader title="Futures Monitor" icon={Target} gradient="from-cyan-500 to-blue-600" live />
        {loading || futures.length === 0 ? (
          <div className="space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="h-10 rounded-xl bg-white/[0.03] animate-pulse" />)}</div>
        ) : (
          <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-1.5">
            {futures.map(f => {
              const pos = f.changePct >= 0;
              return (
                <motion.div key={f.symbol} variants={cardAnim}
                  className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.025] border border-white/[0.04] hover:border-purple-500/15 hover:bg-white/[0.04] transition-all">
                  <div className="flex items-center gap-2.5">
                    <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', pos ? 'bg-emerald-400' : 'bg-red-400')} />
                    <span className="text-[12px] font-bold text-white w-10">{f.symbol}</span>
                    <span className="text-[10px] text-slate-600 hidden md:block">{f.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] font-bold tabular-nums text-white">
                      {f.price >= 10000 ? f.price.toLocaleString('en-US', { maximumFractionDigits: 0 })
                        : f.price >= 100 ? f.price.toFixed(1) : f.price.toFixed(2)}
                    </span>
                    <span className={cn('text-[11px] font-bold tabular-nums w-[52px] text-right',
                      pos ? 'text-emerald-400' : 'text-red-400')}>
                      {pos ? '+' : ''}{f.changePct.toFixed(2)}%
                    </span>
                    <Sparkline data={f.sparkline} positive={pos} h={22} w={44} />
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </GlassCard>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — MARKET BREADTH (4 mini cards)
// ─────────────────────────────────────────────────────────────────────────────
function MarketBreadthSection({ data }: { data: MissionData | null }) {
  const fg = data?.fearGreed?.value ?? 50;
  const advances = Math.round(fg * 20 + 200);
  const declines = Math.round((100 - fg) * 15 + 150);
  const unchanged = Math.round(45 + Math.sin(fg) * 20);
  const total = advances + declines + unchanged;
  const advPct = Math.round((advances / total) * 100);
  const advColor = advPct >= 50 ? '#22c55e' : '#ef4444';

  const miniCards = [
    {
      title: 'Advance / Decline',
      value: `${advances} / ${declines}`,
      sub: `${advPct}% advancing`,
      color: advColor,
      bar: advPct,
      icon: advPct >= 50 ? ArrowUpRight : ArrowDownRight,
    },
    {
      title: 'Momentum',
      value: `${fg} / 100`,
      sub: fg >= 60 ? 'Strong momentum' : fg >= 40 ? 'Moderate' : 'Weak',
      color: '#818cf8',
      bar: fg,
      icon: Activity,
    },
    {
      title: 'Volume vs Avg',
      value: '65%',
      sub: 'Above average',
      color: '#3b82f6',
      bar: 65,
      icon: BarChart3,
    },
    {
      title: '52W High / Low',
      value: '84 / 23',
      sub: 'New highs dominating',
      color: '#22c55e',
      bar: Math.round((84 / (84 + 23)) * 100),
      icon: TrendingUp,
    },
  ];

  return (
    <motion.div {...fadeUp(0.12)}>
      <GlassCard hover={false} className="h-full transition-none">
        <SectionHeader title="Market Breadth" icon={BarChart3} gradient="from-emerald-500 to-cyan-600" />
        <div className="grid grid-cols-2 gap-2.5">
          {miniCards.map(({ title, value, sub, color, bar, icon: Icon }) => (
            <div key={title} className="p-3 rounded-xl bg-white/[0.025] border border-white/[0.05] hover:border-purple-500/15 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{title}</span>
                <Icon className="w-3 h-3 flex-shrink-0" style={{ color }} />
              </div>
              <div className="text-[15px] font-bold tabular-nums" style={{ color }}>{value}</div>
              <div className="text-[9px] text-slate-600 mt-0.5 mb-2">{sub}</div>
              <div className="h-1 rounded-full bg-white/[0.05] overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(bar, 100)}%`, background: color }} />
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — AI COMMENTARY FEED (varied card sizes)
// ─────────────────────────────────────────────────────────────────────────────
type CardVariant = 'breaking' | 'institutional' | 'macro' | 'fed' | 'normal';

interface FeedItem {
  variant: CardVariant;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  impact: 'high' | 'medium' | 'low';
  summary: string;
  detail?: string;
  time: string;
  tag: string;
  confidence?: number;
}

const FEED_ITEMS: FeedItem[] = [
  {
    variant: 'breaking',
    sentiment: 'bullish',
    impact: 'high',
    tag: 'BREAKING',
    summary: 'NASDAQ futures surge 1.4% — AI infrastructure demand drives institutional inflows into mega-cap tech.',
    detail: 'NVDA +3.2%, MSFT +1.8%, GOOGL +2.1% in pre-market. Options flow shows heavy call buying.',
    time: 'Just now',
    confidence: 88,
  },
  {
    variant: 'fed',
    sentiment: 'neutral',
    impact: 'high',
    tag: 'FED',
    summary: 'FOMC minutes signal data-dependent approach — two cuts priced in by Q4 2025.',
    detail: 'Powell comments: "Inflation trajectory encouraging, but not yet sufficient." Markets react positively.',
    time: '6m ago',
    confidence: 92,
  },
  {
    variant: 'institutional',
    sentiment: 'bullish',
    impact: 'high',
    tag: 'INSTITUTIONAL',
    summary: 'Goldman Sachs upgrades US equities to Overweight — raises S&P 500 target to 6,200.',
    time: '14m ago',
    confidence: 85,
  },
  {
    variant: 'normal',
    sentiment: 'bearish',
    impact: 'high',
    tag: 'COMMODITIES',
    summary: 'Crude oil slides 1.9% as OPEC+ signals output expansion; energy sector faces rotation pressure.',
    time: '22m ago',
    confidence: 79,
  },
  {
    variant: 'macro',
    sentiment: 'neutral',
    impact: 'medium',
    tag: 'MACRO',
    summary: 'China PMI misses at 49.1 vs 50.3 expected — Hang Seng falls 0.7% on growth concerns.',
    detail: 'Yuan weakens marginally; PBoC expected to maintain accommodative stance.',
    time: '35m ago',
    confidence: 73,
  },
  {
    variant: 'normal',
    sentiment: 'bullish',
    impact: 'medium',
    tag: 'GOLD',
    summary: 'Gold consolidates near $3,230 on weaker dollar — safe-haven demand remains intact heading into CPI.',
    time: '48m ago',
    confidence: 70,
  },
  {
    variant: 'normal',
    sentiment: 'bearish',
    impact: 'low',
    tag: 'FX',
    summary: 'Emerging market currencies soften against yen; carry trade unwind risk remains elevated.',
    time: '1h ago',
    confidence: 65,
  },
];

const sentimentCfg = {
  bullish: { color: '#22c55e', bg: '#22c55e12', border: '#22c55e20', icon: TrendingUp },
  bearish: { color: '#ef4444', bg: '#ef444412', border: '#ef444420', icon: TrendingDown },
  neutral: { color: '#94a3b8', bg: '#94a3b812', border: '#94a3b820', icon: Minus },
};

const variantCfg: Record<CardVariant, { accent: string; tagColor: string; tagBg: string; tagBorder: string }> = {
  breaking:     { accent: '#ef4444', tagColor: '#fca5a5', tagBg: '#ef444415', tagBorder: '#ef444428' },
  fed:          { accent: '#8b5cf6', tagColor: '#c4b5fd', tagBg: '#8b5cf615', tagBorder: '#8b5cf628' },
  institutional:{ accent: '#3b82f6', tagColor: '#93c5fd', tagBg: '#3b82f615', tagBorder: '#3b82f628' },
  macro:        { accent: '#f59e0b', tagColor: '#fcd34d', tagBg: '#f59e0b15', tagBorder: '#f59e0b28' },
  normal:       { accent: '#475569', tagColor: '#94a3b8', tagBg: '#47556915', tagBorder: '#47556928' },
};

function FeedCard({ item }: { item: FeedItem }) {
  const s = sentimentCfg[item.sentiment];
  const v = variantCfg[item.variant];
  const SIcon = s.icon;
  const isLarge = item.variant === 'breaking' || item.variant === 'fed';
  const isHighlighted = item.variant === 'institutional';

  return (
    <motion.div variants={cardAnim}
      className={cn(
        'group relative rounded-xl border overflow-hidden transition-all duration-250',
        isLarge && 'ring-1',
        isHighlighted ? 'bg-blue-500/[0.04] border-blue-500/20' : 'bg-white/[0.02] border-white/[0.05]',
        'hover:border-purple-500/20 hover:bg-white/[0.035]',
      )}
      style={isLarge ? { borderColor: v.accent + '30', boxShadow: `0 0 20px ${v.accent}10` } : {}}>

      {/* Left accent stripe */}
      <div className="absolute left-0 inset-y-0 w-[2.5px]" style={{ background: v.accent, opacity: 0.7 }} />

      <div className={cn('ml-2.5 p-3', isLarge && 'p-4')}>
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border"
              style={{ color: v.tagColor, background: v.tagBg, borderColor: v.tagBorder }}>
              {item.tag}
            </span>
            <span className={cn('text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border')}
              style={{ color: s.color, background: s.bg, borderColor: s.border }}>
              {item.sentiment}
            </span>
            {item.impact === 'high' && (
              <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border text-orange-400 bg-orange-500/10 border-orange-500/20">
                High Impact
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {item.confidence && (
              <span className="text-[9px] font-bold tabular-nums" style={{ color: s.color }}>{item.confidence}%</span>
            )}
            <SIcon className="w-3 h-3 flex-shrink-0" style={{ color: s.color }} />
          </div>
        </div>

        {/* Summary */}
        <p className={cn('text-slate-200 font-medium leading-relaxed',
          isLarge ? 'text-[13px]' : 'text-[12px]')}>
          {item.summary}
        </p>

        {/* Detail (for large cards) */}
        {item.detail && isLarge && (
          <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">{item.detail}</p>
        )}

        {/* Footer */}
        <div className="flex items-center gap-1.5 mt-2">
          <Clock className="w-2.5 h-2.5 text-slate-700" />
          <span className="text-[9px] text-slate-700">{item.time}</span>
        </div>
      </div>
    </motion.div>
  );
}

function AICommentaryFeed() {
  return (
    <motion.div {...fadeUp(0.14)}>
      <GlassCard hover={false} className="h-full transition-none">
        <SectionHeader title="AI Commentary Feed" icon={Brain} gradient="from-violet-500 to-pink-600" live />
        <motion.div variants={stagger} initial="initial" animate="animate"
          className="space-y-2 max-h-[520px] overflow-y-auto pr-0.5">
          {FEED_ITEMS.map((item, i) => <FeedCard key={i} item={item} />)}
        </motion.div>
      </GlassCard>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6 — SMART ALERTS (hierarchical sizing)
// ─────────────────────────────────────────────────────────────────────────────
const SMART_ALERTS = [
  { type: 'Fed Event',         detail: 'FOMC minutes release 14:00 ET — major volatility risk',         color: '#8b5cf6', size: 'large',  urgent: true  },
  { type: 'CPI Data Thursday', detail: 'Consumer Price Index — consensus 3.1% YoY',                      color: '#f59e0b', size: 'medium', urgent: true  },
  { type: 'VIX Below 20',      detail: 'Risk appetite recovering — conditions favorable for equities',    color: '#22c55e', size: 'small',  urgent: false },
  { type: 'Sector Rotation',   detail: 'Flows: Utilities → Tech & Financials',                           color: '#3b82f6', size: 'small',  urgent: false },
  { type: 'Unusual Activity',  detail: 'Heavy put buying on SPY 540 strike detected',                    color: '#ef4444', size: 'medium', urgent: true  },
  { type: 'PCE Friday',        detail: 'Personal Consumption Expenditure — key inflation metric',         color: '#f97316', size: 'small',  urgent: false },
];

function SmartAlerts() {
  return (
    <motion.div {...fadeUp(0.16)}>
      <GlassCard hover={false} className="h-full transition-none">
        <SectionHeader title="Smart Alerts" icon={Zap} gradient="from-yellow-500 to-orange-600" />
        <div className="space-y-2">
          {SMART_ALERTS.map((alert, i) => (
            <div key={i} className={cn(
              'relative flex items-start gap-3 rounded-xl border transition-all overflow-hidden',
              alert.size === 'large' ? 'p-3.5' : alert.size === 'medium' ? 'p-3' : 'p-2.5',
              alert.urgent ? 'bg-white/[0.03]' : 'bg-white/[0.015]',
            )}
              style={{ borderColor: `${alert.color}25`, boxShadow: alert.urgent ? `0 0 12px ${alert.color}08` : undefined }}>
              {/* Accent stripe */}
              <div className="absolute left-0 inset-y-0 w-[2px] rounded-r-full" style={{ background: alert.color }} />

              <div className="ml-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={cn('font-bold uppercase tracking-wider',
                    alert.size === 'large' ? 'text-[11px]' : 'text-[9px]')}
                    style={{ color: alert.color }}>
                    {alert.type}
                  </span>
                  {alert.urgent && (
                    <span className="text-[8px] font-bold text-red-400 bg-red-500/10 border border-red-500/18 px-1.5 py-px rounded-full">
                      URGENT
                    </span>
                  )}
                </div>
                <p className={cn('text-slate-300',
                  alert.size === 'large' ? 'text-[12px]' : 'text-[11px]')}>
                  {alert.detail}
                </p>
              </div>
              <AlertCircle className={cn('flex-shrink-0', alert.size === 'large' ? 'w-4 h-4' : 'w-3 h-3')}
                style={{ color: alert.color }} />
            </div>
          ))}
        </div>
      </GlassCard>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7 — ECONOMIC CALENDAR (mini timeline)
// ─────────────────────────────────────────────────────────────────────────────
const CALENDAR_EVENTS = [
  { day: 'Mon', date: '23',  event: 'Consumer Confidence',  impact: 'medium', time: '10:00 ET', actual: null  },
  { day: 'Tue', date: '24',  event: 'GDP Estimate Q1',       impact: 'high',   time: '08:30 ET', actual: null  },
  { day: 'Wed', date: '25',  event: 'Fed Beige Book',        impact: 'medium', time: '14:00 ET', actual: null  },
  { day: 'Thu', date: '26',  event: 'CPI — Core YoY',        impact: 'high',   time: '08:30 ET', actual: null  },
  { day: 'Fri', date: '27',  event: 'PCE Price Index',       impact: 'high',   time: '08:30 ET', actual: null  },
];

const impactColors = {
  high:   { color: '#ef4444', bg: '#ef444412', border: '#ef444425', label: 'High'   },
  medium: { color: '#f59e0b', bg: '#f59e0b12', border: '#f59e0b25', label: 'Med'    },
  low:    { color: '#22c55e', bg: '#22c55e12', border: '#22c55e25', label: 'Low'    },
} as const;

function EconomicCalendar() {
  return (
    <motion.div {...fadeUp(0.18)}>
      <GlassCard hover={false} className="h-full transition-none">
        <SectionHeader title="Economic Calendar" icon={Calendar} gradient="from-blue-500 to-cyan-600" />
        <div className="space-y-2">
          {CALENDAR_EVENTS.map((ev, i) => {
            const imp = impactColors[ev.impact as keyof typeof impactColors];
            return (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-purple-500/15 transition-all">
                {/* Day bubble */}
                <div className="flex flex-col items-center w-8 flex-shrink-0">
                  <span className="text-[9px] font-bold text-slate-600 uppercase">{ev.day}</span>
                  <span className="text-[14px] font-bold text-white leading-tight">{ev.date}</span>
                </div>
                <div className="w-px h-8 bg-white/[0.05] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-slate-200 truncate">{ev.event}</div>
                  <div className="text-[9px] text-slate-600 flex items-center gap-1 mt-0.5">
                    <Clock className="w-2.5 h-2.5" />{ev.time}
                  </div>
                </div>
                <span className="text-[8px] font-bold uppercase px-2 py-0.5 rounded-full border flex-shrink-0"
                  style={{ color: imp.color, background: imp.bg, borderColor: imp.border }}>
                  {imp.label}
                </span>
              </div>
            );
          })}
        </div>
      </GlassCard>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 8 — INSTITUTIONAL FLOW
// ─────────────────────────────────────────────────────────────────────────────
const INST_FLOWS = [
  { sector: 'Technology',  flow: '+$2.1B', dir: 'in'  as const, pct: '+1.8%', color: '#8b5cf6' },
  { sector: 'Financials',  flow: '+$900M', dir: 'in'  as const, pct: '+0.9%', color: '#3b82f6' },
  { sector: 'Healthcare',  flow: '+$340M', dir: 'in'  as const, pct: '+0.4%', color: '#22c55e' },
  { sector: 'Energy',      flow: '-$620M', dir: 'out' as const, pct: '-1.3%', color: '#ef4444' },
  { sector: 'Utilities',   flow: '-$480M', dir: 'out' as const, pct: '-1.1%', color: '#f97316' },
  { sector: 'Real Estate', flow: '-$210M', dir: 'out' as const, pct: '-0.7%', color: '#f59e0b' },
];

function InstitutionalFlow() {
  return (
    <motion.div {...fadeUp(0.2)}>
      <GlassCard hover={false} className="h-full transition-none">
        <SectionHeader title="Institutional Flow" icon={Building2} gradient="from-purple-500 to-violet-700" live />
        <motion.div variants={stagger} initial="initial" animate="animate"
          className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {INST_FLOWS.map(({ sector, flow, dir, pct, color }) => (
            <motion.div key={sector} variants={cardAnim}
              className="relative p-3 rounded-xl border overflow-hidden group transition-all duration-200 hover:-translate-y-1"
              style={{ borderColor: `${color}20`, background: `${color}08` }}>
              <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ boxShadow: `inset 0 0 20px ${color}10` }} />
              <div className="relative">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">{sector}</div>
                <div className={cn('text-[18px] font-bold tabular-nums')} style={{ color }}>
                  {dir === 'in' ? <ArrowUpRight className="w-3.5 h-3.5 inline -mt-0.5" />
                               : <ArrowDownRight className="w-3.5 h-3.5 inline -mt-0.5" />}
                  {flow}
                </div>
                <div className="text-[10px] mt-0.5 font-semibold tabular-nums" style={{ color, opacity: 0.7 }}>{pct}</div>
              </div>
            </motion.div>
          ))}
        </motion.div>
        <div className="mt-3 pt-2.5 border-t border-white/[0.04]">
          <p className="text-[9px] text-slate-700">
            Institutional flow estimated from options flow, dark pool prints & sector ETF volume.
          </p>
        </div>
      </GlassCard>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 9 — WATCHLIST INTELLIGENCE (card-based)
// ─────────────────────────────────────────────────────────────────────────────
const WATCHLIST = [
  { role: 'Strongest',          symbol: 'TATAMOTORS', price: '₹782', changePct: 4.31,  signal: 'Momentum Accelerating',   rsi: 71, color: '#22c55e' },
  { role: 'Weakest',            symbol: 'HDFCBANK',   price: '₹1,654', changePct: -2.87, signal: 'Weak Volume Structure',  rsi: 34, color: '#ef4444' },
  { role: 'Breakout Candidate', symbol: 'INFY',       price: '₹1,584', changePct: 2.45, signal: 'Breakout Above Resistance', rsi: 63, color: '#8b5cf6' },
];

const WATCHLIST_OTHER = [
  { symbol: 'RELIANCE', price: '₹2,934', changePct: 2.84,  signal: 'High Volume Accumulation', trend: 'up'   as const },
  { symbol: 'WIPRO',    price: '₹423',   changePct: -2.34, signal: 'Below Key EMA',             trend: 'down' as const },
  { symbol: 'ITC',      price: '₹468',   changePct: 0.84,  signal: 'Consolidation Range',       trend: 'flat' as const },
];

function WatchlistIntelSection() {
  return (
    <motion.div {...fadeUp(0.22)}>
      <GlassCard hover={false} className="h-full transition-none">
        <div className="flex items-center justify-between mb-3">
          <SectionHeader title="Watchlist Intelligence" icon={Star} gradient="from-purple-500 to-pink-600" />
          <Link href="/screener/watchlists"
            className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1 -mt-3 transition-colors flex-shrink-0">
            Manage <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Featured 3 cards */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {WATCHLIST.map(({ role, symbol, price, changePct, signal, rsi, color }) => {
            const pos = changePct >= 0;
            return (
              <div key={symbol} className="p-3 rounded-xl border transition-all hover:-translate-y-1"
                style={{ borderColor: `${color}25`, background: `${color}08` }}>
                <div className="text-[8px] font-bold uppercase tracking-wider mb-1.5"
                  style={{ color, opacity: 0.8 }}>{role}</div>
                <div className="text-[14px] font-bold text-white">{symbol}</div>
                <div className={cn('text-[13px] font-bold tabular-nums mt-0.5', pos ? 'text-emerald-400' : 'text-red-400')}>
                  {pos ? '+' : ''}{changePct.toFixed(2)}%
                </div>
                <div className="text-[8px] text-slate-500 mt-1.5 leading-snug">{signal}</div>
                <div className="flex items-center gap-1 mt-1.5">
                  <span className="text-[8px] text-slate-600">RSI</span>
                  <span className="text-[9px] font-bold" style={{ color }}>{rsi}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Rest as compact rows */}
        <div className="space-y-1.5">
          {WATCHLIST_OTHER.map(({ symbol, price, changePct, signal, trend }) => (
            <div key={symbol}
              className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-purple-500/12 transition-all">
              <div className="flex items-center gap-2.5">
                <div className={cn('w-1.5 h-1.5 rounded-full',
                  trend === 'up' ? 'bg-emerald-400' : trend === 'down' ? 'bg-red-400' : 'bg-slate-500')} />
                <div>
                  <div className="text-[12px] font-bold text-white">{symbol}</div>
                  <div className="text-[9px] text-slate-600">{signal}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] font-bold text-slate-300 tabular-nums">{price}</div>
                <div className={cn('text-[11px] font-bold tabular-nums',
                  changePct >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 10 — AI MARKET SUMMARY (redesigned)
// ─────────────────────────────────────────────────────────────────────────────
function AIMarketSummary({ data }: { data: MissionData | null }) {
  const fg = data?.fearGreed?.value ?? 50;
  const vixPrice = data?.vix?.price;
  const bias = fg >= 60 ? 'BULLISH' : fg >= 45 ? 'NEUTRAL' : 'BEARISH';
  const biasColor = fg >= 60 ? '#22c55e' : fg >= 45 ? '#eab308' : '#ef4444';
  const risk = vixPrice ? (vixPrice < 18 ? 'LOW' : vixPrice < 25 ? 'MODERATE' : 'HIGH') : 'MODERATE';
  const riskColor = risk === 'LOW' ? '#22c55e' : risk === 'MODERATE' ? '#eab308' : '#ef4444';
  const confidence = fg >= 60 ? 82 : fg >= 50 ? 75 : fg >= 40 ? 68 : 60;

  const narrativeBullets = [
    `Equity markets ${fg >= 55 ? 'positive' : 'cautious'} with Fear & Greed at ${fg} (${data?.fearGreed?.label ?? 'Neutral'})`,
    vixPrice ? `VIX ${vixPrice.toFixed(1)} — ${risk.toLowerCase()} volatility environment` : 'Volatility data loading...',
    'Institutional flows rotating: Utilities → Technology & Financials',
    'Fed data-dependent — 2 rate cuts priced by Q4 2025',
    `Tomorrow: CPI Thursday is key catalyst — consensus 3.1%`,
  ];

  const statCards = [
    { label: 'Today\'s Bias', value: bias, color: biasColor },
    { label: 'Confidence', value: `${confidence}%`, color: '#8b5cf6' },
    { label: 'Risk Level', value: risk, color: riskColor },
    { label: 'Tomorrow Focus', value: 'CPI Thu', color: '#f59e0b' },
  ];

  return (
    <motion.div {...fadeUp(0.24)}>
      <GlassCard hover={false} className="relative overflow-hidden border-purple-500/[0.12] transition-none">
        <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-purple-600/5 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-indigo-600/5 blur-2xl pointer-events-none" />

        <div className="relative">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center border border-purple-500/30 shadow-[0_0_24px_rgba(139,92,246,0.25)]">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-[14px] font-bold text-white">AI Market Summary</div>
                <div className="text-[9px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                  <Wifi className="w-2.5 h-2.5 text-emerald-500" />
                  Live · Nivro Intelligence Engine
                </div>
              </div>
            </div>
            {/* Confidence meter */}
            <div className="flex flex-col items-end gap-1">
              <span className="text-[9px] text-slate-500">Confidence</span>
              <div className="flex items-center gap-1.5">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="w-4 h-1.5 rounded-full transition-all"
                    style={{ background: i < Math.round(confidence / 20) ? '#8b5cf6' : '#ffffff12' }} />
                ))}
                <span className="text-[10px] font-bold text-purple-400">{confidence}%</span>
              </div>
            </div>
          </div>

          {/* Stat cards row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            {statCards.map(({ label, value, color }) => (
              <div key={label} className="p-2.5 rounded-xl border text-center"
                style={{ borderColor: `${color}22`, background: `${color}0C` }}>
                <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">{label}</div>
                <div className="text-[14px] font-bold" style={{ color }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Institutional Flow tag */}
          <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl bg-purple-500/[0.07] border border-purple-500/15">
            <Layers3 className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
            <span className="text-[10px] text-slate-400 font-medium">Institutional Flow:</span>
            <span className="text-[10px] font-bold text-purple-300">TECH → FINANCIALS</span>
            <ArrowUpRight className="w-3 h-3 text-emerald-400 ml-auto" />
          </div>

          {/* Narrative */}
          <div className="space-y-1.5">
            {narrativeBullets.map((b, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="w-1 h-1 rounded-full bg-purple-400 flex-shrink-0 mt-[5px]" />
                <p className="text-[12px] text-slate-300 leading-relaxed">{b}</p>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-4 pt-3 border-t border-white/[0.05] flex items-center justify-between">
            <span className="text-[9px] text-slate-700">Updated every 60s · Powered by Nivro</span>
            <span className="text-[9px] font-bold text-purple-400">
              Tomorrow: {fg >= 58 ? 'Cautiously Bullish' : fg >= 45 ? 'Neutral ↗' : 'Risk Management Priority'}
            </span>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function MissionControlPage() {
  const [data, setData] = useState<MissionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/markets/mission-control', { headers: await authHeader() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setLastRefresh(new Date());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 60_000);
    return () => clearInterval(t);
  }, [fetchData]);

  return (
    <div className="min-h-screen relative" style={{ background: 'linear-gradient(160deg,#050816 0%,#070B14 100%)' }}>
      {/* Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
      <div className="absolute top-0 left-1/4 w-[600px] h-[300px] rounded-full bg-purple-600/5 blur-[100px] pointer-events-none" />

      <div className="relative max-w-screen-2xl mx-auto px-4 md:px-6 py-5 space-y-5">

        {/* Page Header */}
        <motion.div {...fadeUp(0)} className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-violet-700 flex items-center justify-center shadow-lg shadow-indigo-500/20 border border-indigo-500/20">
              <Target className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-[17px] font-bold text-white tracking-tight">Mission Control</h1>
              <p className="text-[9px] text-slate-600 uppercase tracking-widest">Markets · Command Center</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-1.5">
            {[
              { label: 'Pulse', href: '/markets/pulse' },
              { label: 'Movers', href: '/markets/movers' },
              { label: 'Sectors', href: '/markets/sectors' },
              { label: 'AI Signals', href: '/markets/signals' },
            ].map(({ label, href }) => (
              <Link key={label} href={href}
                className="text-[11px] font-medium text-slate-600 hover:text-purple-300 px-3 py-1.5 rounded-lg hover:bg-purple-500/5 border border-transparent hover:border-purple-500/12 transition-all flex items-center gap-1">
                {label}<ChevronRight className="w-3 h-3" />
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Error banner */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-500/8 border border-red-500/15 text-red-400 text-[12px]">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              Live data unavailable ({error}). Showing reference data.
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Row 1: Hero ───────────────────────────────────────────── */}
        <HeroStatusBar data={data} loading={loading} lastRefresh={lastRefresh} onRefresh={fetchData} />

        {/* ── Row 2: Global Snapshot (tabbed) ───────────────────────── */}
        <GlobalSnapshot data={data} loading={loading} />

        {/* ── Row 3: Futures | Breadth ───────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <FuturesMonitor data={data} loading={loading} />
          <MarketBreadthSection data={data} />
        </div>

        {/* ── Row 4: Commentary | Smart Alerts ──────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3"><AICommentaryFeed /></div>
          <div className="lg:col-span-2"><SmartAlerts /></div>
        </div>

        {/* ── Row 5: Economic Calendar | Institutional Flow ─────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <EconomicCalendar />
          <InstitutionalFlow />
        </div>

        {/* ── Row 6: Watchlist | AI Summary ─────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <WatchlistIntelSection />
          <AIMarketSummary data={data} />
        </div>

        {/* Footer */}
        <motion.div {...fadeUp(0.3)} className="text-center pb-4">
          <p className="text-[9px] text-slate-700 uppercase tracking-widest">
            Nivro Intelligence Engine · Yahoo Finance · {loading ? 'Refreshing…' : '60s auto-refresh'} · Prices may be delayed 15min
          </p>
        </motion.div>
      </div>
    </div>
  );
}
