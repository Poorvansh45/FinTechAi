'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Clock, Zap, Flame, ShieldAlert,
  Sparkles, RotateCcw, AlertCircle, ChevronUp, ChevronDown,
  Info, Maximize2, Star, Layers3, Activity, Radar, Search
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { authHeader } from "@/lib/api/authToken";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES & DATA STRUCTURES
// ─────────────────────────────────────────────────────────────────────────────
interface MoverQuote {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  relativeVolume: number;
  atr: number;
  rsi: number;
  pattern: string;
  momentumScore: number;
  aiScore: number;
  marketCap: number;
  breakoutScore?: number;
}

interface RadarItem {
  symbol: string;
  breakoutProb: number;
  volRatio: number;
  rsi: number;
  aiConfidence: number;
  pattern: string;
}

interface ThemeItem {
  name: string;
  flow: number;
  color: string;
}

interface FeedItem {
  ticker: string;
  text: string;
  bias: 'bullish' | 'bearish';
  impact: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  time: string;
}

interface UnusualItem {
  type: string;
  ticker: string;
  details: string;
  urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM';
}

interface PayloadData {
  timestamp: string;
  marketOpen: boolean;
  radar: RadarItem[];
  themes: ThemeItem[];
  aiFeed: FeedItem[];
  unusualActivity: UnusualItem[];
  summary: { text: string; confidence: number };
  heatmap: { name: string; children: { name: string; children: any[] }[] };
  assets: Record<string, Record<string, MoverQuote[]>>;
}

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATIONS
// ─────────────────────────────────────────────────────────────────────────────
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, delay, ease: 'easeOut' as const } },
});

const containerVariants = {
  animate: { transition: { staggerChildren: 0.04 } }
};

const itemVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' as const } }
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
function GlassCard({ children, className, glow, hover = true }: { children: React.ReactNode; className?: string; glow?: string; hover?: boolean }) {
  return (
    <div className={cn(
      'rounded-xl border border-foreground/[0.07] p-4 md:p-5',
      'bg-neutral-900',
      'transition-all duration-300',
      hover && 'hover:-translate-y-[2px] hover:border-brand-500/20',
      glow && `hover:shadow-[0_10px_40px_${glow}]`,
      className
    )}>
      {children}
    </div>
  );
}

function SectionHeader({ title, icon: Icon, gradient = 'bg-brand-500', count }: {
  title: string; icon: any; gradient?: string; count?: number | string;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className={`w-0.5 h-4 rounded-full ${gradient} flex-shrink-0`} />
      <Icon className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
      <h2 className="text-[11px] font-bold text-neutral-400">{title}</h2>
      {count !== undefined && (
        <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-foreground/[0.04] text-neutral-400 border border-foreground/[0.05]">{count}</span>
      )}
      <div className="flex-1 h-px bg-gradient-to-r from-foreground/[0.04] to-transparent" />
    </div>
  );
}

export default function TopMoversPro() {
  const [data, setData] = useState<PayloadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeAsset, setActiveAsset] = useState<string>('Stocks');
  const [activeTab, setActiveTab] = useState<string>('Gainers');
  const [timeframe, setTimeframe] = useState<string>('1D');
  const [countdown, setCountdown] = useState<number>(30);
  const [showSummary, setShowSummary] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredTile, setHoveredTile] = useState<any>(null);

  const fetchInterval = useRef<NodeJS.Timeout | null>(null);
  const countdownInterval = useRef<NodeJS.Timeout | null>(null);

  // Data Fetching
  const loadMoversData = async () => {
    try {
      const res = await fetch('/api/markets/movers', { headers: await authHeader() });
      if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
      const payload: PayloadData = await res.json();
      setData(payload);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to fetch movers data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMoversData();

    // Auto-refresh every 30 seconds
    fetchInterval.current = setInterval(() => {
      loadMoversData();
      setCountdown(30);
    }, 30000);

    // Countdown tick
    countdownInterval.current = setInterval(() => {
      setCountdown((prev) => (prev > 1 ? prev - 1 : 30));
    }, 1000);

    return () => {
      if (fetchInterval.current) clearInterval(fetchInterval.current);
      if (countdownInterval.current) clearInterval(countdownInterval.current);
    };
  }, []);

  // Format utility
  const formatVol = (val: number) => {
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`;
    return val.toString();
  };

  const assetClasses = ['Stocks', 'ETF', 'Crypto', 'India', 'US', 'Futures'];
  const timeframePills = ['1D', '1W', '1M'];
  const tabsList = ['Gainers', 'Losers', 'Volume Surge', 'Breakouts', 'Relative Strength', 'Institutional Flow', 'Unusual Activity'];

  // Memoized Table Rows
  const tableRows = useMemo(() => {
    if (!data || !data.assets[activeAsset]) return [];
    let list = data.assets[activeAsset][activeTab] || [];

    // Filter by timeframe effect (mock representation since historical ratios scale)
    if (timeframe !== '1D') {
      const factor = timeframe === '1W' ? 2.5 : 6.8;
      list = list.map((item) => ({
        ...item,
        changePct: +(item.changePct * factor).toFixed(2),
        change: +(item.change * factor).toFixed(2),
        relativeVolume: +(item.relativeVolume * (0.85 + Math.random() * 0.3)).toFixed(2),
      }));
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(item =>
        item.symbol.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.sector.toLowerCase().includes(q)
      );
    }

    return list;
  }, [data, activeAsset, activeTab, timeframe, searchQuery]);

  // Dynamic status chips
  const isMarketOpen = data?.marketOpen ?? true;

  return (
    <div className="min-h-screen bg-neutral-950 text-foreground font-sans px-4 md:px-8 py-6 space-y-6 overflow-x-hidden selection:bg-brand-500/30 selection:text-brand-200">
      
      {/* ───────────────────────────────────────────────────────────────────────
          1. HERO SECTION
          ─────────────────────────────────────────────────────────────────────── */}
      <motion.div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-foreground/[0.06] pb-6" {...fadeUp(0)}>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-brand-500/10 text-brand-400 border border-brand-500/20">Scanners Pro</span>
            <div className="w-1.5 h-1.5 rounded-full bg-brand-500" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-brand-400 ">
            Top Movers Pro
          </h1>
          <p className="text-neutral-400 text-xs md:text-sm max-w-xl">
            Institutional Opportunity Scanner: Discover momentum, volume anomalies and smart money flows in real time.
          </p>
        </div>

        {/* Status Chips */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-neutral-900 border border-foreground/[0.06] px-3.5 py-1.5 rounded-xl">
            <span className={cn('w-2 h-2 rounded-full', isMarketOpen ? 'bg-positive-400' : 'bg-warning-400')} />
            <span className="text-[11px] font-bold text-neutral-300">
              {isMarketOpen ? 'Market Open' : 'Market Closed'}
            </span>
          </div>

          <div className="flex items-center gap-2 bg-neutral-900 border border-foreground/[0.06] px-3.5 py-1.5 rounded-xl text-[11px]">
            <Clock className="w-3.5 h-3.5 text-brand-400" />
            <span className="text-neutral-300">Sync:</span>
            <span className="font-mono text-brand-300 font-bold w-6 text-center tabular-nums">{countdown}s</span>
          </div>

          <div className="flex items-center gap-2 bg-neutral-900 border border-brand-500/[0.15] px-3.5 py-1.5 rounded-xl">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
            <span className="text-[11px] font-bold text-brand-300 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-brand-400" /> AI Scanner Active
            </span>
          </div>
        </div>
      </motion.div>

      {/* ───────────────────────────────────────────────────────────────────────
          2. FILTER & SEARCH BAR
          ─────────────────────────────────────────────────────────────────────── */}
      <motion.div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-neutral-850 border border-foreground/[0.05] p-3 rounded-xl" {...fadeUp(0.1)}>
        {/* Asset Classes */}
        <div className="flex flex-wrap items-center gap-1">
          {assetClasses.map((asset) => {
            const isActive = activeAsset === asset;
            return (
              <button
                key={asset}
                onClick={() => { setActiveAsset(asset); setActiveTab('Gainers'); }}
                className={cn(
                  'px-3.5 py-1.5 rounded-xl text-[11px] font-bold transition-all duration-200',
                  isActive
                    ? 'bg-brand-500/15 border border-brand-500/35 text-brand-300'
                    : 'border border-transparent hover:bg-foreground/5 text-neutral-400 hover:text-neutral-200'
                )}
              >
                {asset}
              </button>
            );
          })}
        </div>

        {/* Search & Timeframes */}
        <div className="flex items-center gap-3">
          {/* Search field */}
          <div className="relative flex-1 md:w-56 flex items-center">
            <Search className="absolute left-3 w-3.5 h-3.5 text-neutral-400 opacity-50 pointer-events-none" />
            <input
              type="text"
              placeholder="Search scanners..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-neutral-950 border border-foreground/[0.07] focus:border-brand-500/40 rounded-xl py-1.5 pl-9 pr-3.5 text-xs text-foreground placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-brand-500/20 transition-all"
            />
          </div>

          <div className="h-6 w-px bg-foreground/[0.06]" />

          {/* Timeframe selector */}
          <div className="flex items-center bg-neutral-950 border border-foreground/[0.06] p-1 rounded-xl">
            {timeframePills.map((tf) => {
              const isActive = timeframe === tf;
              return (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={cn(
                    'px-3 py-1 rounded-lg text-[11px] font-bold transition-all',
                    isActive
                      ? 'bg-brand-500/20 text-brand-300'
                      : 'text-neutral-500 hover:text-neutral-300'
                  )}
                >
                  {tf}
                </button>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* ───────────────────────────────────────────────────────────────────────
          3. TAB SCANNERS
          ─────────────────────────────────────────────────────────────────────── */}
      <motion.div className="overflow-x-auto scrollbar-none border-b border-foreground/[0.05] pb-1" {...fadeUp(0.15)}>
        <div className="flex items-center gap-2 min-w-max">
          {tabsList.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="relative py-2.5 px-4 text-[12px] font-bold text-neutral-400 hover:text-foreground transition-colors"
              >
                <span className={cn(isActive && 'text-brand-300')}>{tab}</span>
                {isActive && (
                  <motion.div
                    layoutId="activeScannerTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500 rounded-full"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* ───────────────────────────────────────────────────────────────────────
          4. MAIN GRID LAYOUT
          ─────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: Bloomberg style scanner table (col-span-8) */}
        <div className="lg:col-span-8 space-y-6">
          <motion.div {...fadeUp(0.2)}>
            <GlassCard className="p-0 overflow-hidden" hover={false}>
              <div className="p-4 flex items-center justify-between border-b border-foreground/[0.06]">
                <div className="flex items-center gap-2">
                  <SectionHeader title={`${activeAsset} Scans: ${activeTab}`} icon={Activity} />
                </div>
                <div className="text-[11px] text-neutral-500 font-medium">
                  Displaying {tableRows.length} tickers
                </div>
              </div>

              {loading ? (
                <div className="py-24 flex flex-col items-center justify-center gap-3">
                  <div className="w-8 h-8 rounded-full border-2 border-brand-500/20 border-t-brand-500 animate-spin" />
                  <span className="text-xs text-neutral-500 font-bold">Scanning Institutional Tickers...</span>
                </div>
              ) : error ? (
                <div className="py-16 flex flex-col items-center justify-center text-center gap-3 px-4">
                  <AlertCircle className="w-10 h-10 text-negative-400" />
                  <span className="text-sm text-negative-300 font-bold">Failed to load live data</span>
                  <span className="text-xs text-neutral-500">{error}</span>
                  <button onClick={loadMoversData} className="px-4 py-1.5 mt-2 rounded bg-brand-600 text-white text-xs font-bold hover:bg-brand-700 transition-colors">
                    Retry Scan
                  </button>
                </div>
              ) : tableRows.length === 0 ? (
                <div className="py-20 text-center text-neutral-500 text-xs">
                  No assets matching search query.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-foreground/[0.05] bg-foreground/[0.01] text-[11px] font-bold text-neutral-500">
                        <th className="py-3.5 px-4 text-center w-12">#</th>
                        <th className="py-3.5 px-3">Ticker</th>
                        <th className="py-3.5 px-3">Company</th>
                        <th className="py-3.5 px-3 text-right">Price</th>
                        <th className="py-3.5 px-3 text-right">%</th>
                        <th className="py-3.5 px-3 text-right">Volume</th>
                        <th className="py-3.5 px-3 text-right">RVol</th>
                        <th className="py-3.5 px-3 text-right">ATR</th>
                        <th className="py-3.5 px-3 text-right">RSI</th>
                        <th className="py-3.5 px-3">Sector</th>
                        <th className="py-3.5 px-3">Trigger Pattern</th>
                        <th className="py-3.5 px-3 text-center">Mo.</th>
                        <th className="py-3.5 px-3 text-center text-brand-400">AI</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-foreground/[0.04] text-[11px] font-medium font-mono">
                      <AnimatePresence mode="wait">
                        {tableRows.map((row, index) => {
                          const isGreen = row.changePct >= 0;
                          return (
                            <motion.tr
                              key={row.symbol}
                              variants={itemVariants}
                              initial="initial"
                              animate="animate"
                              exit={{ opacity: 0 }}
                              className="group transition-all hover:bg-foreground/[0.02] cursor-pointer"
                            >
                              {/* Rank */}
                              <td className="py-3 px-4 text-center text-neutral-500 font-bold">{index + 1}</td>
                              
                              {/* Ticker */}
                              <td className="py-3 px-3 font-bold text-foreground group-hover:text-brand-300 transition-colors">
                                {row.symbol}
                              </td>

                              {/* Company */}
                              <td className="py-3 px-3 text-neutral-400 max-w-[130px] truncate font-sans font-normal">
                                {row.name}
                              </td>

                              {/* Price */}
                              <td className="py-3 px-3 text-right text-neutral-200 font-bold tabular-nums">
                                ${row.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>

                              {/* Change Pct */}
                              <td className={cn(
                                'py-3 px-3 text-right font-bold tabular-nums',
                                isGreen ? 'text-positive-400' : 'text-negative-400'
                              )}>
                                {isGreen ? '+' : ''}{row.changePct.toFixed(2)}%
                              </td>

                              {/* Volume */}
                              <td className="py-3 px-3 text-right text-neutral-500 tabular-nums">
                                {formatVol(row.volume)}
                              </td>

                              {/* RVol */}
                              <td className={cn(
                                'py-3 px-3 text-right font-bold tabular-nums',
                                row.relativeVolume >= 2.0 ? 'text-brand-400' : row.relativeVolume >= 1.3 ? 'text-neutral-300' : 'text-neutral-500'
                              )}>
                                {row.relativeVolume.toFixed(2)}x
                              </td>

                              {/* ATR */}
                              <td className="py-3 px-3 text-right text-neutral-500 tabular-nums">
                                {row.atr.toFixed(2)}
                              </td>

                              {/* RSI */}
                              <td className={cn(
                                'py-3 px-3 text-right font-bold tabular-nums',
                                row.rsi >= 70 ? 'text-negative-400' : row.rsi <= 30 ? 'text-positive-400' : 'text-neutral-400'
                              )}>
                                {row.rsi.toFixed(0)}
                              </td>

                              {/* Sector */}
                              <td className="py-3 px-3 text-neutral-500 font-sans font-normal">{row.sector}</td>

                              {/* Pattern */}
                              <td className="py-3 px-3 text-neutral-300 font-sans font-normal">
                                <span className="px-1.5 py-0.5 rounded bg-foreground/[0.03] border border-foreground/[0.04] text-[11px]">
                                  {row.pattern}
                                </span>
                              </td>

                              {/* Momentum Score */}
                              <td className="py-3 px-3 text-center">
                                <span className={cn(
                                  'inline-block px-1.5 py-0.5 rounded text-[11px] font-bold w-7 text-center border',
                                  row.momentumScore >= 75 ? 'bg-positive-500/10 border-positive-500/25 text-positive-400' :
                                  row.momentumScore <= 40 ? 'bg-negative-500/10 border-negative-500/25 text-negative-400' :
                                  'bg-neutral-500/10 border-neutral-500/25 text-neutral-400'
                                )}>
                                  {row.momentumScore}
                                </span>
                              </td>

                              {/* AI Score */}
                              <td className="py-3 px-3 text-center">
                                <span className={cn(
                                  'inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[11px] font-bold border bg-brand-500/10 border-brand-500/30 text-brand-300'
                                )}>
                                  <Sparkles className="w-2 h-2 text-brand-400" />
                                  {row.aiScore}
                                </span>
                              </td>
                            </motion.tr>
                          );
                        })}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              )}
            </GlassCard>
          </motion.div>

          {/* Finviz style Heatmap Section */}
          <motion.div {...fadeUp(0.25)}>
            <GlassCard hover={false} className="space-y-4">
              <SectionHeader title="Finviz-Style Scanner Treemap" icon={Layers3} />
              
              {!data ? (
                <div className="py-12 text-center text-xs text-neutral-500">Loading treemap structure...</div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 h-[280px]">
                    {data.heatmap.children.map((sector) => {
                      const sumVal = sector.children.reduce((acc, c) => acc + c.value, 0);
                      return (
                        <div key={sector.name} className="border border-foreground/[0.05] rounded-xl p-2.5 bg-foreground/[0.01] flex flex-col justify-between overflow-hidden">
                          <div className="text-[11px] font-bold text-neutral-400 border-b border-foreground/[0.04] pb-1 flex justify-between">
                            <span>{sector.name}</span>
                          </div>

                          <div className="grid grid-cols-2 gap-1.5 h-full mt-2">
                            {sector.children.slice(0, 4).map((company) => {
                              const isPositive = company.pct >= 0;
                              // Tint strength scales with the move, capped so the primary text colour
                              // stays readable on the strongest tile in both themes.
                              const intensity = Math.min(0.55, Math.max(0.15, Math.abs(company.pct) / 6));
                              const bgColor = isPositive 
                                ? `rgb(var(--positive-500) / ${intensity})` 
                                : `rgb(var(--negative-500) / ${intensity})`;

                              return (
                                <motion.div
                                  key={company.name}
                                  className="relative flex flex-col items-center justify-center rounded-lg border border-foreground/[0.04] cursor-pointer overflow-hidden p-1 select-none"
                                  style={{ backgroundColor: bgColor }}
                                  whileHover={{ scale: 1.05 }}
                                  onHoverStart={() => setHoveredTile(company)}
                                  onHoverEnd={() => setHoveredTile(null)}
                                >
                                  <span className="text-[11px] font-bold tracking-wider">{company.name}</span>
                                  <span className="text-[11px] font-medium opacity-90 tabular-nums">
                                    {isPositive ? '+' : ''}{company.pct.toFixed(2)}%
                                  </span>
                                </motion.div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Dynamic Tooltip info for Treemap */}
                  <div className="h-10 bg-neutral-950 border border-foreground/[0.06] rounded-xl flex items-center justify-between px-4 text-xs">
                    {hoveredTile ? (
                      <>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-brand-300">{hoveredTile.name}</span>
                          <span className="text-neutral-400">|</span>
                          <span className="text-neutral-400">Sector:</span>
                          <span className="text-neutral-200">{hoveredTile.sector}</span>
                        </div>
                        <div className="flex items-center gap-4 tabular-nums">
                          <div>
                            <span className="text-neutral-500">Price:</span> <span className="font-bold">${hoveredTile.price}</span>
                          </div>
                          <div>
                            <span className="text-neutral-500">RSI:</span> <span className="font-bold text-warning-400">{hoveredTile.rsi}</span>
                          </div>
                          <div>
                            <span className="text-neutral-500">RVol:</span> <span className="font-bold text-brand-400">{hoveredTile.rvol}x</span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <span className="text-neutral-500 italic flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 text-brand-400" /> Hover over a heat map tile to inspect detailed institutional analytics.
                      </span>
                    )}
                  </div>
                </div>
              )}
            </GlassCard>
          </motion.div>

        </div>

        {/* Right Side: Sidebar Scanners (col-span-4) */}
        <div className="lg:col-span-4 space-y-6">

          {/* Trending Themes */}
          <motion.div {...fadeUp(0.2)}>
            <GlassCard className="space-y-4">
              <SectionHeader title="Trending Themes" icon={Flame} count="Capital Flow" />
              
              {!data ? (
                <div className="py-10 text-center text-xs text-neutral-500">Loading flow metrics...</div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {data.themes.map((theme) => {
                    const isFlowIn = theme.flow >= 0;
                    return (
                      <div key={theme.name} className="bg-foreground/[0.02] border border-foreground/[0.05] p-3 rounded-xl flex flex-col justify-between gap-2.5 transition-all hover:bg-foreground/[0.04]">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold tracking-wide">{theme.name}</span>
                          <span className={cn(
                            'text-[11px] font-bold font-mono tabular-nums px-1 rounded',
                            isFlowIn ? 'bg-positive-500/10 text-positive-400' : 'bg-negative-500/10 text-negative-400'
                          )}>
                            {isFlowIn ? '▲' : '▼'} {Math.abs(theme.flow).toFixed(1)}%
                          </span>
                        </div>

                        {/* Animated Visual Flow Indicator Bar */}
                        <div className="h-1.5 w-full bg-foreground/[0.04] rounded-full overflow-hidden relative">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, Math.max(10, Math.abs(theme.flow) * 7))}%` }}
                            transition={{ duration: 0.8, ease: 'easeOut' as const }}
                            className="h-full rounded-full"
                            style={{ backgroundColor: theme.color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </GlassCard>
          </motion.div>

          {/* Unusual Activity Panel */}
          <motion.div {...fadeUp(0.25)}>
            <GlassCard className="space-y-4">
              <SectionHeader title="Unusual Activity Feed" icon={ShieldAlert} />
              
              {!data ? (
                <div className="py-8 text-center text-xs text-neutral-500">Loading order activity...</div>
              ) : (
                <div className="space-y-2.5 max-h-[290px] overflow-y-auto pr-1">
                  {data.unusualActivity.map((act, i) => {
                    const isCritical = act.urgency === 'CRITICAL';
                    const isHigh = act.urgency === 'HIGH';
                    return (
                      <div key={i} className="border border-foreground/[0.05] bg-foreground/[0.01] hover:bg-foreground/[0.03] p-3 rounded-xl space-y-1.5 transition-all">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-neutral-400">{act.type}</span>
                          <span className={cn(
                            'text-[11px] font-bold px-1.5 py-0.5 rounded-md border',
                            isCritical ? 'bg-negative-500/10 border-negative-500/30 text-negative-400' :
                            isHigh ? 'bg-warning-500/10 border-warning-500/30 text-warning-400' :
                            'bg-brand-500/10 border-brand-500/30 text-brand-400'
                          )}>
                            {act.urgency}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-foreground font-mono">{act.ticker}</span>
                          <span className="text-neutral-400 font-sans">{act.details}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </GlassCard>
          </motion.div>

          {/* AI Movers Feed */}
          <motion.div {...fadeUp(0.3)}>
            <GlassCard className="space-y-4">
              <SectionHeader title="Real-Time AI Signals Feed" icon={Radar} />
              
              {!data ? (
                <div className="py-8 text-center text-xs text-neutral-500">Analyzing live prints...</div>
              ) : (
                <div className="relative h-[290px] overflow-hidden border border-foreground/[0.05] rounded-xl bg-neutral-950/20 p-2">
                  <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-neutral-950 to-transparent z-10 pointer-events-none" />
                  
                  {/* Scrolling Feed Container */}
                  <div className="space-y-3 h-full overflow-y-auto pr-1 scrollbar-none py-4">
                    {data.aiFeed.map((feed, idx) => {
                      const isBullish = feed.bias === 'bullish';
                      return (
                        <div key={idx} className="border border-foreground/[0.06] bg-foreground/[0.02] hover:bg-foreground/[0.04] p-3 rounded-xl space-y-2 transition-all">
                          <div className="flex items-center justify-between text-[11px]">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-foreground font-mono">{feed.ticker}</span>
                              <span className={cn(
                                'px-1.5 py-0.5 rounded text-[11px] font-bold',
                                isBullish ? 'bg-positive-500/10 text-positive-400' : 'bg-negative-500/10 text-negative-400'
                              )}>
                                {feed.bias}
                              </span>
                            </div>
                            <span className="text-neutral-500 font-bold">{feed.time}</span>
                          </div>
                          
                          <p className="text-[11px] text-neutral-300 font-sans leading-relaxed">
                            {feed.text}
                          </p>

                          <div className="flex items-center justify-between text-[11px] border-t border-foreground/[0.04] pt-1.5 text-neutral-500">
                            <span>Impact: <strong className={feed.impact === 'CRITICAL' ? 'text-negative-400' : 'text-neutral-300'}>{feed.impact}</strong></span>
                            <span>Engine V3.5</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-neutral-950 to-transparent z-10 pointer-events-none" />
                </div>
              )}
            </GlassCard>
          </motion.div>

        </div>

      </div>

      {/* ───────────────────────────────────────────────────────────────────────
          5. BREAKOUT RADAR (Horizontal grid scroll)
          ─────────────────────────────────────────────────────────────────────── */}
      <motion.div {...fadeUp(0.35)} className="space-y-4">
        <SectionHeader title="Breakout Radar Scanner" icon={Star} count="High Confidence" />
        
        {!data ? (
          <div className="py-12 text-center text-xs text-neutral-500">Scoping breakout patterns...</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {data.radar.map((item) => {
              // Highlight NVDA/TATAMOTORS as highest probability setups (Gold border)
              const hasGoldHighlight = item.breakoutProb >= 90;
              return (
                <div
                  key={item.symbol}
                  className={cn(
                    'relative rounded-xl p-4 bg-neutral-900 transition-all duration-300',
                    hasGoldHighlight
                      ? 'border border-warning-500/40 bg-gradient-to-b from-warning-500/[0.03] to-transparent'
                      : 'border border-foreground/[0.07] hover:border-brand-500/20'
                  )}
                >
                  {hasGoldHighlight && (
                    <span className="absolute -top-2.5 left-4 px-2 py-0.5 bg-warning-700 text-white text-[11px] font-bold rounded-md flex items-center gap-0.5">
                      ★ Golden Setup
                    </span>
                  )}

                  <div className="flex items-center justify-between mb-3 mt-1">
                    <span className="text-xs font-bold text-foreground font-mono">{item.symbol}</span>
                    <span className={cn(
                      'text-[11px] font-mono font-bold',
                      item.breakoutProb >= 85 ? 'text-positive-400' : 'text-neutral-300'
                    )}>
                      {item.breakoutProb}% P.
                    </span>
                  </div>

                  <div className="space-y-2 text-[11px] tabular-nums">
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Vol Ratio:</span>
                      <span className="text-neutral-300 font-bold">{item.volRatio}x</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">RSI:</span>
                      <span className="text-neutral-300 font-bold">{item.rsi}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">AI Conf:</span>
                      <span className="text-brand-400 font-bold">{item.aiConfidence}%</span>
                    </div>
                  </div>

                  <div className="mt-3 border-t border-foreground/[0.05] pt-2 text-[11px] text-neutral-400 leading-tight">
                    {item.pattern}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* ───────────────────────────────────────────────────────────────────────
          6. FLOATING AI OPPORTUNITY SUMMARY
          ─────────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showSummary && data && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 30 }}
            className="fixed bottom-6 right-6 z-40 max-w-sm"
          >
            <div className="bg-neutral-900 border border-brand-500/20 rounded-xl p-4.5 space-y-3 relative group">
              <button
                onClick={() => setShowSummary(false)}
                className="absolute top-2.5 right-2.5 text-neutral-500 hover:text-foreground text-xs transition-colors p-1"
              >
                ✕
              </button>

              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brand-400 animate-pulse" />
                <span className="text-xs font-bold text-neutral-200">AI Opportunity Summary</span>
              </div>

              <p className="text-[11px] text-neutral-300 leading-relaxed font-sans">
                {data.summary.text}
              </p>

              <div className="flex items-center justify-between text-[11px] border-t border-foreground/[0.06] pt-2">
                <span className="text-neutral-500">Confidence Score</span>
                <span className="font-bold font-mono text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-md border border-brand-500/25">
                  {data.summary.confidence}%
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Re-open summary toggle if hidden */}
      {!showSummary && (
        <button
          onClick={() => setShowSummary(true)}
          className="fixed bottom-6 right-6 z-40 bg-brand-600 hover:bg-brand-700 text-white font-bold p-3.5 rounded-full shadow-lg transition-transform flex items-center justify-center"
        >
          <Sparkles className="w-4.5 h-4.5" />
        </button>
      )}

    </div>
  );
}
