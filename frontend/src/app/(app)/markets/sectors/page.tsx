'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Clock, Zap, Flame, ShieldAlert,
  Sparkles, RotateCcw, AlertCircle, Layers3, Activity, Globe, DollarSign
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { WorldMap } from '@/components/ui/map';

// ─────────────────────────────────────────────────────────────────────────────
// DATA TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface SectorMatrixItem {
  name: string;
  changePct: number;
  flow: number;
  rsi: number;
  bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  sparkline: number[];
}

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATIONS
// ─────────────────────────────────────────────────────────────────────────────
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, delay, ease: 'easeOut' as const } },
});

const itemVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' as const } }
};

// ─────────────────────────────────────────────────────────────────────────────
// SHARED COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
function GlassCard({ children, className, hover = true }: { children: React.ReactNode; className?: string; hover?: boolean }) {
  return (
    <div className={cn(
      'rounded-xl border border-foreground/[0.07] p-5',
      'bg-neutral-900',
      'transition-all duration-300',
      hover && 'hover:-translate-y-[2px] hover:border-brand-500/20',
      className
    )}>
      {children}
    </div>
  );
}

function SectionHeader({ title, icon: Icon, gradient = 'bg-brand-500' }: {
  title: string; icon: any; gradient?: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className={`w-0.5 h-4 rounded-full ${gradient} flex-shrink-0`} />
      <Icon className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
      <h2 className="text-[11px] font-bold text-neutral-400">{title}</h2>
      <div className="flex-1 h-px bg-gradient-to-r from-foreground/[0.04] to-transparent" />
    </div>
  );
}

function MiniSparkline({ data, positive }: { data: number[]; positive: boolean }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const h = 24, w = 55;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 2)}`).join(' ');
  const color = positive ? 'rgb(var(--positive-400))' : 'rgb(var(--negative-400))';
  const id = `mini-sp-${Math.random().toString(36).substring(2, 6)}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="flex-shrink-0">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#${id})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function SectorRotation() {
  // 1. Sector Rotation Matrix Data
  const sectorsData: SectorMatrixItem[] = [
    { name: 'Technology', changePct: 4.5, flow: 4.5, rsi: 74, bias: 'BULLISH', sparkline: [4.1, 4.2, 4.15, 4.3, 4.5] },
    { name: 'Financials', changePct: 3.1, flow: 3.1, rsi: 68, bias: 'BULLISH', sparkline: [2.8, 2.9, 2.95, 3.0, 3.1] },
    { name: 'Industrials', changePct: 2.4, flow: 2.2, rsi: 61, bias: 'BULLISH', sparkline: [2.1, 2.3, 2.25, 2.35, 2.4] },
    { name: 'Utilities', changePct: 1.1, flow: 0.8, rsi: 52, bias: 'NEUTRAL', sparkline: [0.9, 1.0, 0.95, 1.05, 1.1] },
    { name: 'Consumer Disc', changePct: -1.4, flow: -1.1, rsi: 44, bias: 'BEARISH', sparkline: [-0.9, -1.1, -1.2, -1.3, -1.4] },
    { name: 'Healthcare', changePct: -2.1, flow: -1.5, rsi: 39, bias: 'BEARISH', sparkline: [-1.5, -1.8, -1.9, -2.0, -2.1] },
    { name: 'Energy', changePct: -3.0, flow: -2.8, rsi: 28, bias: 'BEARISH', sparkline: [-2.2, -2.5, -2.7, -2.9, -3.0] },
  ];

  // 2. Leadership Race State (Updates every minute)
  const [leadershipScores, setLeadershipScores] = useState<Record<string, number>>({
    Technology: 91,
    Financials: 82,
    Industrials: 76,
    Utilities: 65,
    Healthcare: 49,
    Energy: 33,
  });
  const [nextUpdateSeconds, setNextUpdateSeconds] = useState<number>(60);

  // Trend directions for progress scores
  const trends: Record<string, { arrow: string; color: string }> = {
    Technology: { arrow: '↑', color: 'text-positive-400' },
    Financials: { arrow: '↑', color: 'text-positive-400' },
    Industrials: { arrow: '→', color: 'text-neutral-500' },
    Utilities: { arrow: '→', color: 'text-neutral-500' },
    Healthcare: { arrow: '↓', color: 'text-negative-400 animate-pulse' },
    Energy: { arrow: '↓', color: 'text-negative-400 animate-pulse' },
  };

  useEffect(() => {
    const scoreInterval = setInterval(() => {
      // Re-calculate scores slightly every minute
      setLeadershipScores((prev) => {
        const randomize = (val: number, minBound: number, maxBound: number) => {
          const delta = Math.floor(Math.random() * 5) - 2; // -2 to +2
          return Math.max(minBound, Math.min(maxBound, val + delta));
        };
        return {
          Technology: randomize(prev.Technology, 85, 99),
          Financials: randomize(prev.Financials, 75, 95),
          Industrials: randomize(prev.Industrials, 68, 88),
          Utilities: randomize(prev.Utilities, 55, 75),
          Healthcare: randomize(prev.Healthcare, 38, 58),
          Energy: randomize(prev.Energy, 20, 45),
        };
      });
      setNextUpdateSeconds(60);
    }, 60000);

    const timeInterval = setInterval(() => {
      setNextUpdateSeconds((prev) => (prev > 1 ? prev - 1 : 60));
    }, 1000);

    return () => {
      clearInterval(scoreInterval);
      clearInterval(timeInterval);
    };
  }, []);

  // 3. Dotted World Map Dot Config
  const capitalFlowDots = [
    {
      start: { lat: 37.0902, lng: -95.7129, label: "US" },
      end: { lat: 20.5937, lng: 78.9629, label: "India" },
      color: "rgb(var(--brand-400))" // Purple = Institutional Flow
    },
    {
      start: { lat: 37.0902, lng: -95.7129, label: "US" },
      end: { lat: 48.526, lng: 15.2551, label: "Europe" },
      color: "rgb(var(--positive-400))" // Green = Risk-On
    },
    {
      start: { lat: 48.526, lng: 15.2551, label: "Europe" },
      end: { lat: 36.2048, lng: 138.2529, label: "Japan" },
      color: "rgb(var(--positive-400))" // Green = Risk-On
    },
    {
      start: { lat: 23.6978, lng: 120.9605, label: "Taiwan" },
      end: { lat: 37.0902, lng: -95.7129, label: "US" },
      color: "rgb(var(--brand-400))" // Purple = Institutional Flow
    },
    {
      start: { lat: 35.8617, lng: 104.1954, label: "China" },
      end: { lat: 35.9078, lng: 127.7669, label: "Korea" },
      color: "rgb(var(--negative-400))" // Red = Risk-Off
    }
  ];

  return (
    <div className="min-h-screen bg-neutral-950 text-foreground font-sans px-4 md:px-8 py-6 space-y-6 overflow-x-hidden selection:bg-brand-500/30 selection:text-brand-200">
      
      {/* HEADER HERO */}
      <motion.div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-foreground/[0.06] pb-6" {...fadeUp(0)}>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-brand-500/10 text-brand-400 border border-brand-500/20">Sector Flow Matrix</span>
            <div className="w-1.5 h-1.5 rounded-full bg-brand-500" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-brand-400 ">
            Sector Rotation Command
          </h1>
          <p className="text-neutral-400 text-xs md:text-sm max-w-xl">
            Trace global capital flow cycles, track sector leadership strength, and scan structural shift events.
          </p>
        </div>

        {/* Real-time Status indicators */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-neutral-900 border border-foreground/[0.06] px-3.5 py-1.5 rounded-xl text-[11px]">
            <Clock className="w-3.5 h-3.5 text-brand-400 animate-pulse" />
            <span className="text-neutral-400">Score Sync:</span>
            <span className="font-mono text-brand-300 font-bold tabular-nums w-6 text-center">{nextUpdateSeconds}s</span>
          </div>
          <div className="flex items-center gap-2 bg-neutral-900 border border-foreground/[0.06] px-3.5 py-1.5 rounded-xl">
            <span className="w-2 h-2 rounded-full bg-positive-400" />
            <span className="text-[11px] font-bold text-neutral-300">Live Feeds Active</span>
          </div>
        </div>
      </motion.div>

      {/* MAIN LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN (lg:col-span-8) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* SECTION 1: Sector Rotation Matrix */}
          <motion.div {...fadeUp(0.1)}>
            <div className="flex items-center justify-between border-b border-foreground/[0.05] pb-2 mb-3">
              <SectionHeader title="Sector Rotation Matrix" icon={Layers3} />
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3.5">
              {sectorsData.map((s) => {
                const isGreen = s.changePct >= 0;
                const isBullish = s.bias === 'BULLISH';
                const isBearish = s.bias === 'BEARISH';
                
                return (
                  <motion.div
                    key={s.name}
                    whileHover={{ y: -3, scale: 1.025 }}
                    transition={{ duration: 0.25, ease: 'easeOut' as const }}
                  >
                    <div
                      className={cn(
                        'rounded-xl border p-5 flex flex-col justify-between h-[135px] relative overflow-hidden group transition-all duration-300 bg-neutral-900',
                        isBullish ? 'border-positive-500/10 hover:border-positive-500/30' :
                        isBearish ? 'border-negative-500/10 hover:border-negative-500/30' :
                        'border-foreground/[0.07] hover:border-brand-500/20'
                      )}
                      style={{
                        boxShadow: isBullish ? 'none' :
                                   isBearish ? 'none' : 'none'
                      }}
                    >
                      {/* Intensity light glow at card top */}
                      <div className={cn(
                        'absolute top-0 inset-x-0 h-[1.5px] opacity-60 transition-opacity group-hover:opacity-100',
                        isGreen ? 'bg-positive-500/80' : 'bg-negative-500/80'
                      )} />

                      <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
                        <div className="min-w-0">
                          <span className="text-[12px] font-bold text-foreground group-hover:text-brand-300 transition-colors">{s.name}</span>
                          <div className="text-[11px] text-neutral-500 font-semibold tracking-wide mt-0.5">RSI: {s.rsi}</div>
                        </div>
                        
                        {/* Gamified bias dot indicator */}
                        <div className="flex items-center gap-1.5">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className={cn('relative inline-flex rounded-full h-1.5 w-1.5',
                              isBullish ? 'bg-positive-500' : isBearish ? 'bg-negative-500' : 'bg-neutral-500'
                            )} />
                          </span>
                          <span className={cn(
                            'text-[11px] font-bold px-1.5 py-0.5 rounded border tracking-wider',
                            isBullish ? 'bg-positive-500/10 border-positive-500/25 text-positive-400' :
                            isBearish ? 'bg-negative-500/10 border-negative-500/25 text-negative-400' :
                            'bg-neutral-500/10 border-neutral-500/25 text-neutral-400'
                          )}>
                            {s.bias}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-end justify-between mt-4">
                        <div>
                          <div className={cn('text-[18px] font-bold font-mono tabular-nums leading-none', isGreen ? 'text-positive-400' : 'text-negative-400')}>
                            {isGreen ? '+' : ''}{s.changePct.toFixed(1)}%
                          </div>
                          <div className="text-[11px] text-neutral-500 flex items-center gap-0.5 mt-1 font-mono font-medium">
                            <DollarSign className="w-2.5 h-2.5" />
                            Flow: {isGreen ? '+' : ''}{s.flow.toFixed(1)}B
                          </div>
                        </div>
                        <MiniSparkline data={s.sparkline} positive={isGreen} />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* SECTION 2: Capital Flow Map (Geographic routes over dotted map) */}
          <motion.div {...fadeUp(0.2)}>
            <GlassCard hover={false} className="space-y-4">
              <div className="flex items-center justify-between">
                <SectionHeader title="Capital Flow Map" icon={Globe} />
                <div className="flex items-center gap-4 text-[11px] font-bold">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                    <span className="text-brand-400">Institutional Flow</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-positive-400" />
                    <span className="text-positive-400">Risk-On</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-negative-400" />
                    <span className="text-negative-400">Risk-Off</span>
                  </div>
                </div>
              </div>

              <div className="border border-foreground/[0.06] rounded-xl overflow-hidden bg-neutral-950/35">
                <WorldMap dots={capitalFlowDots} loop={true} />
              </div>
            </GlassCard>
          </motion.div>

          {/* SECTION 5: Sector Rotation Wheel */}
          <motion.div {...fadeUp(0.25)}>
            <GlassCard className="space-y-4">
              <SectionHeader title="Sector Rotation Wheel" icon={RotateCcw} />
              <div className="text-[11px] text-neutral-400 font-medium text-center -mt-2">
                Capital rotates clockwise based on macroeconomic recovery phases.
              </div>

              <div className="flex flex-col items-center justify-center py-6 relative">
                {/* SVG Ring Container */}
                <div className="relative w-64 h-64 flex items-center justify-center">
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 200">
                    {/* Glowing Outer Dash Ring */}
                    <circle
                      cx="100"
                      cy="100"
                      r="60"
                      fill="none"
                      stroke="rgb(var(--brand-500) / 0.15)"
                      strokeWidth="2.5"
                      strokeDasharray="6 6"
                      style={{ filter: "drop-shadow(0 0 4px rgb(var(--brand-500) / 0.2))" }}
                    />
                    
                    {/* Rotating Group containing the Glowing Capital Orb */}
                    <motion.g
                      animate={{ rotate: 360 }}
                      transition={{ duration: 8, ease: "linear", repeat: Infinity }}
                      className="origin-center"
                    >
                      {/* Inner Glowing Capital Flow Orb (rotating clockwise) */}
                      <circle
                        cx="100"
                        cy="40"
                        r="5"
                        fill="rgb(var(--brand-400))"
                        style={{ filter: "drop-shadow(0 0 8px rgb(var(--brand-500)))" }}
                      />
                    </motion.g>
                    
                    {/* Center Core Indicator Dot */}
                    <circle cx="100" cy="100" r="14" className="fill-neutral-950 stroke-brand-500/35" strokeWidth="2" />
                    <circle cx="100" cy="100" r="4" fill="rgb(var(--brand-400))" className="animate-pulse" />
                  </svg>
                  
                  {/* Positioned Node Labels */}
                  {/* 1. Technology (Top) */}
                  <div className="absolute top-2 text-center flex flex-col items-center">
                    <span className="text-[11px] font-bold bg-brand-500/10 text-brand-300 border border-brand-500/25 px-2 py-0.5 rounded-md shadow-md">
                      Technology
                    </span>
                    <span className="text-[11px] text-neutral-500 font-bold mt-1">Peak Growth</span>
                  </div>

                  {/* 2. Industrials (Right) */}
                  <div className="absolute right-0 text-center flex flex-col items-center">
                    <span className="text-[11px] font-bold bg-brand-500/10 text-brand-300 border border-brand-500/25 px-2 py-0.5 rounded-md shadow-md">
                      Industrials
                    </span>
                    <span className="text-[11px] text-neutral-500 font-bold mt-1">Late Bull</span>
                  </div>

                  {/* 3. Energy (Bottom) */}
                  <div className="absolute bottom-2 text-center flex flex-col items-center">
                    <span className="text-[11px] font-bold bg-negative-500/10 text-negative-300 border border-negative-500/25 px-2 py-0.5 rounded-md shadow-md">
                      Energy
                    </span>
                    <span className="text-[11px] text-neutral-500 font-bold mt-1">Defensive Peak</span>
                  </div>

                  {/* 4. Financials (Left) */}
                  <div className="absolute left-0 text-center flex flex-col items-center">
                    <span className="text-[11px] font-bold bg-positive-500/10 text-positive-300 border border-positive-500/25 px-2 py-0.5 rounded-md shadow-md">
                      Financials
                    </span>
                    <span className="text-[11px] text-neutral-500 font-bold mt-1">Early Cycle</span>
                  </div>
                </div>
              </div>
            </GlassCard>
          </motion.div>

        </div>

        {/* RIGHT COLUMN (lg:col-span-4) */}
        <div className="lg:col-span-4 space-y-6">

          {/* SECTION 3: Sector Leadership Race */}
          <motion.div {...fadeUp(0.15)}>
            <GlassCard className="space-y-4">
              <SectionHeader title="Sector Leadership Race" icon={Flame} />
              
              <div className="space-y-3.5">
                {Object.entries(leadershipScores)
                  .sort((a, b) => b[1] - a[1])
                  .map(([name, score]) => {
                    const isHigh = score >= 70;
                    const isLow = score <= 45;
                    const barColor = isHigh ? 'bg-brand-500 ' : isLow ? 'bg-negative-500 ' : 'bg-neutral-900 ';
                    return (
                      <div key={name} className="space-y-1.5 font-mono">
                        <div className="flex justify-between text-xs font-bold items-center">
                          <span className="text-neutral-300 font-sans">{name}</span>
                          <span className={cn(
                            'text-[11px] px-1.5 py-0.5 rounded font-bold flex items-center gap-1',
                            isHigh ? 'text-brand-300 bg-brand-500/10 border border-brand-500/20' : isLow ? 'text-negative-300 bg-negative-500/10 border border-negative-500/20' : 'text-neutral-400 bg-neutral-500/10'
                          )}>
                            {score}
                            <span className={cn("font-bold text-xs leading-none", trends[name]?.color)}>
                              {trends[name]?.arrow}
                            </span>
                          </span>
                        </div>

                        {/* Progress meter */}
                        <div className="h-2 w-full bg-foreground/[0.04] rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${score}%` }}
                            transition={{ duration: 0.5, ease: 'easeOut' as const }}
                            className={cn('h-full rounded-full', barColor)}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </GlassCard>
          </motion.div>

          {/* SIGNATURE SECTION: Hot Sector Card (Polished with Breathing Space) */}
          <motion.div {...fadeUp(0.18)}>
            <div className="rounded-xl border border-warning-500/25 bg-gradient-to-br from-warning-500/[0.07] to-neutral-900 p-6 md:p-7 relative overflow-hidden hover:border-warning-500/40 transition-all duration-300">
              {/* Ambient fire background glow */}
              
              <div className="flex items-center gap-2 text-[11px] font-bold text-warning-400 select-none mb-4">
                <Flame className="h-3.5 w-3.5" aria-hidden /> Hot sector
              </div>

              <div className="flex items-baseline justify-between mb-5 border-b border-foreground/[0.05] pb-3.5">
                <h3 className="text-xl md:text-2xl font-bold text-white tracking-tight">Technology</h3>
                <span className="text-positive-400 font-mono font-bold text-base md:text-lg animate-pulse">+4.5%</span>
              </div>

              <div className="grid grid-cols-2 gap-6 text-[11px] text-neutral-400 font-mono mb-4">
                <div className="space-y-1">
                  <span className="text-neutral-500 block text-[11px] font-bold font-sans">Inst. Flow</span>
                  <span className="font-bold text-white text-sm md:text-base font-mono">+$4.5B</span>
                </div>
                <div className="space-y-1">
                  <span className="text-neutral-500 block text-[11px] font-bold font-sans">AI Confidence</span>
                  <span className="font-bold text-brand-400 text-sm md:text-base font-mono">91%</span>
                </div>
              </div>

              <div className="border-t border-foreground/[0.05] pt-3.5 text-[11px] font-bold text-warning-400 flex items-center gap-2 font-sans select-none">
                <span className="w-2 h-2 rounded-full bg-warning-500" /> Momentum Leader
              </div>
            </div>
          </motion.div>

          {/* SECTION 4: AI Sector Narratives */}
          <motion.div {...fadeUp(0.2)}>
            <GlassCard className="space-y-4">
              <SectionHeader title="AI Sector Narratives" icon={Sparkles} />
              
              <div className="space-y-3">
                {[
                  { text: 'Technology attracting institutional inflows as hardware demand accelerates.', bias: 'BULLISH', color: 'text-brand-400' },
                  { text: 'Financials showing broad participation with strong retail and block sweeps.', bias: 'BULLISH', color: 'text-positive-400' },
                  { text: 'Healthcare weakening after multiple high-profile earnings misses.', bias: 'BEARISH', color: 'text-negative-400' },
                  { text: 'Energy remains under pressure due to global crude inventory softness.', bias: 'BEARISH', color: 'text-negative-400' },
                ].map((narr, i) => (
                  <div key={i} className="flex gap-2.5 border-b border-foreground/[0.03] pb-2.5 last:border-b-0 last:pb-0">
                    <span className={cn('text-xs flex-shrink-0 mt-0.5 font-bold', narr.color)}>●</span>
                    <p className="text-xs text-neutral-300 font-sans leading-relaxed">{narr.text}</p>
                  </div>
                ))}

                <div className="flex items-center justify-between text-[11px] border-t border-foreground/[0.06] pt-3.5 font-mono">
                  <span className="text-neutral-500 font-bold">Scanner Confidence</span>
                  <span className="font-bold text-brand-400 bg-brand-500/10 border border-brand-500/25 px-2 py-0.5 rounded-md">
                    88% CONFIDENCE
                  </span>
                </div>
              </div>
            </GlassCard>
          </motion.div>

          {/* SECTION 5: Sector Timeline */}
          <motion.div {...fadeUp(0.25)}>
            <GlassCard className="space-y-4">
              <SectionHeader title="Sector Rotation Timeline" icon={Clock} />

              <div className="relative pl-6 space-y-5 border-l border-foreground/[0.08] ml-2">
                {[
                  { time: '09:30', event: '↓ Energy', colorClass: 'bg-negative-500/10 text-negative-400 border border-negative-500/20', circleColor: 'bg-negative-500', desc: 'Slight selling detected in crude futures triggering early rotation out of oil majors.' },
                  { time: '12:00', event: '↑ Technology', colorClass: 'bg-brand-500/10 text-brand-400 border border-brand-500/20', circleColor: 'bg-brand-500', desc: 'Surge in high-frequency block buys for AI chip makers on positive Taiwan semiconductor notes.' },
                  { time: '15:30', event: '↑ Financials', colorClass: 'bg-positive-500/10 text-positive-400 border border-positive-500/20', circleColor: 'bg-positive-500', desc: 'Smart money accumulation detected in major banking institutions during late trading session block trades.' },
                ].map((item, idx) => (
                  <div key={idx} className="relative">
                    {/* Node Dot on vertical timeline */}
                    <span className="absolute -left-[30px] top-1.5 w-2.5 h-2.5 rounded-full border border-neutral-700 bg-neutral-950 flex items-center justify-center z-10">
                      <span className={cn("w-1.5 h-1.5 rounded-full", item.circleColor)} />
                    </span>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded font-mono text-[11px] bg-foreground/[0.04] text-neutral-400 border border-foreground/[0.05]">{item.time}</span>
                        <span className={cn('text-[11px] font-bold px-1.5 py-0.5 rounded border leading-none', item.colorClass)}>
                          {item.event}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-400 leading-relaxed font-sans pt-0.5">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </motion.div>

        </div>

      </div>

    </div>
  );
}
