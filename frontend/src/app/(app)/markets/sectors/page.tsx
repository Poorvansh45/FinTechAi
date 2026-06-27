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
      'rounded-2xl border border-white/[0.07] p-5',
      'bg-[rgba(7,11,22,0.75)] backdrop-blur-md',
      'transition-all duration-300',
      hover && 'hover:-translate-y-[2px] hover:border-purple-500/20 hover:shadow-[0_10px_40px_rgba(124,92,255,0.07)]',
      className
    )}>
      {children}
    </div>
  );
}

function SectionHeader({ title, icon: Icon, gradient = 'from-violet-500 to-purple-600' }: {
  title: string; icon: any; gradient?: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className={`w-0.5 h-4 rounded-full bg-gradient-to-b ${gradient} flex-shrink-0`} />
      <Icon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
      <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{title}</h2>
      <div className="flex-1 h-px bg-gradient-to-r from-white/[0.04] to-transparent" />
    </div>
  );
}

function MiniSparkline({ data, positive }: { data: number[]; positive: boolean }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const h = 24, w = 55;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 2)}`).join(' ');
  const color = positive ? '#22c55e' : '#ef4444';
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
    Technology: { arrow: '↑', color: 'text-emerald-400' },
    Financials: { arrow: '↑', color: 'text-emerald-400' },
    Industrials: { arrow: '→', color: 'text-slate-500' },
    Utilities: { arrow: '→', color: 'text-slate-500' },
    Healthcare: { arrow: '↓', color: 'text-red-400 animate-pulse' },
    Energy: { arrow: '↓', color: 'text-red-400 animate-pulse' },
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
      color: "#8B5CF6" // Purple = Institutional Flow
    },
    {
      start: { lat: 37.0902, lng: -95.7129, label: "US" },
      end: { lat: 48.526, lng: 15.2551, label: "Europe" },
      color: "#10B981" // Green = Risk-On
    },
    {
      start: { lat: 48.526, lng: 15.2551, label: "Europe" },
      end: { lat: 36.2048, lng: 138.2529, label: "Japan" },
      color: "#10B981" // Green = Risk-On
    },
    {
      start: { lat: 23.6978, lng: 120.9605, label: "Taiwan" },
      end: { lat: 37.0902, lng: -95.7129, label: "US" },
      color: "#8B5CF6" // Purple = Institutional Flow
    },
    {
      start: { lat: 35.8617, lng: 104.1954, label: "China" },
      end: { lat: 35.9078, lng: 127.7669, label: "Korea" },
      color: "#EF4444" // Red = Risk-Off
    }
  ];

  return (
    <div className="min-h-screen bg-[#050816] text-white font-sans px-4 md:px-8 py-6 space-y-6 overflow-x-hidden selection:bg-purple-500/30 selection:text-purple-200">
      
      {/* HEADER HERO */}
      <motion.div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/[0.06] pb-6" {...fadeUp(0)}>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">Sector Flow Matrix</span>
            <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-purple-400 bg-clip-text text-transparent">
            Sector Rotation Command
          </h1>
          <p className="text-slate-400 text-xs md:text-sm max-w-xl">
            Trace global capital flow cycles, track sector leadership strength, and scan structural shift events.
          </p>
        </div>

        {/* Real-time Status indicators */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[rgba(10,14,25,0.7)] border border-white/[0.06] px-3.5 py-1.5 rounded-xl backdrop-blur-md text-[11px]">
            <Clock className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
            <span className="text-slate-400">Score Sync:</span>
            <span className="font-mono text-purple-300 font-bold tabular-nums w-6 text-center">{nextUpdateSeconds}s</span>
          </div>
          <div className="flex items-center gap-2 bg-[rgba(10,14,25,0.7)] border border-white/[0.06] px-3.5 py-1.5 rounded-xl backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-bold text-slate-300">Live Feeds Active</span>
          </div>
        </div>
      </motion.div>

      {/* MAIN LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN (lg:col-span-8) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* SECTION 1: Sector Rotation Matrix */}
          <motion.div {...fadeUp(0.1)}>
            <div className="flex items-center justify-between border-b border-white/[0.05] pb-2 mb-3">
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
                        'rounded-2xl border p-5 flex flex-col justify-between h-[135px] relative overflow-hidden group transition-all duration-300 bg-[rgba(7,11,22,0.75)] backdrop-blur-md',
                        isBullish ? 'border-emerald-500/10 hover:border-emerald-500/30 hover:shadow-[0_8px_30px_rgba(16,185,129,0.06)]' :
                        isBearish ? 'border-red-500/10 hover:border-red-500/30 hover:shadow-[0_8px_30px_rgba(239,68,68,0.06)]' :
                        'border-white/[0.07] hover:border-purple-500/20'
                      )}
                      style={{
                        boxShadow: isBullish ? 'inset 0 0 15px rgba(16,185,129,0.02)' :
                                   isBearish ? 'inset 0 0 15px rgba(239,68,68,0.02)' : 'none'
                      }}
                    >
                      {/* Intensity light glow at card top */}
                      <div className={cn(
                        'absolute top-0 inset-x-0 h-[1.5px] opacity-60 transition-opacity group-hover:opacity-100',
                        isGreen ? 'bg-emerald-500/80 shadow-[0_1px_10px_#10B981]' : 'bg-red-500/80 shadow-[0_1px_10px_#EF4444]'
                      )} />

                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[12px] font-black text-white group-hover:text-purple-300 transition-colors">{s.name}</span>
                          <div className="text-[9px] text-slate-500 font-semibold tracking-wide mt-0.5">RSI: {s.rsi}</div>
                        </div>
                        
                        {/* Gamified bias dot indicator */}
                        <div className="flex items-center gap-1.5">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-75', 
                              isBullish ? 'bg-emerald-400 animate-ping' : isBearish ? 'bg-red-400 animate-ping' : 'bg-slate-400'
                            )} />
                            <span className={cn('relative inline-flex rounded-full h-1.5 w-1.5',
                              isBullish ? 'bg-emerald-500' : isBearish ? 'bg-red-500' : 'bg-slate-500'
                            )} />
                          </span>
                          <span className={cn(
                            'text-[8px] font-extrabold px-1.5 py-0.5 rounded border tracking-wider',
                            isBullish ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' :
                            isBearish ? 'bg-red-500/10 border-red-500/25 text-red-400' :
                            'bg-slate-500/10 border-slate-500/25 text-slate-400'
                          )}>
                            {s.bias}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-end justify-between mt-4">
                        <div>
                          <div className={cn('text-[18px] font-black font-mono tabular-nums leading-none', isGreen ? 'text-emerald-400' : 'text-red-400')}>
                            {isGreen ? '+' : ''}{s.changePct.toFixed(1)}%
                          </div>
                          <div className="text-[9px] text-slate-500 flex items-center gap-0.5 mt-1 font-mono font-medium">
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
                <div className="flex items-center gap-4 text-[10px] font-bold">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                    <span className="text-purple-400">Institutional Flow</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-emerald-400">Risk-On</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                    <span className="text-red-400">Risk-Off</span>
                  </div>
                </div>
              </div>

              <div className="border border-white/[0.06] rounded-2xl overflow-hidden bg-black/35 shadow-[inset_0_0_20px_rgba(0,0,0,0.6)]">
                <WorldMap dots={capitalFlowDots} loop={true} />
              </div>
            </GlassCard>
          </motion.div>

          {/* SECTION 5: Sector Rotation Wheel */}
          <motion.div {...fadeUp(0.25)}>
            <GlassCard className="space-y-4">
              <SectionHeader title="Sector Rotation Wheel" icon={RotateCcw} />
              <div className="text-[10px] text-slate-400 font-medium text-center -mt-2">
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
                      stroke="rgba(139, 92, 246, 0.15)"
                      strokeWidth="2.5"
                      strokeDasharray="6 6"
                      style={{ filter: "drop-shadow(0 0 4px rgba(139, 92, 246, 0.2))" }}
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
                        fill="#8B5CF6"
                        style={{ filter: "drop-shadow(0 0 8px #8B5CF6)" }}
                      />
                      <circle
                        cx="100"
                        cy="40"
                        r="8"
                        fill="transparent"
                        stroke="#8B5CF6"
                        strokeWidth="1.5"
                        className="animate-ping"
                        style={{ transformOrigin: "100px 40px" }}
                      />
                    </motion.g>
                    
                    {/* Center Core Indicator Dot */}
                    <circle cx="100" cy="100" r="14" className="fill-[#080C14] stroke-purple-500/35" strokeWidth="2" />
                    <circle cx="100" cy="100" r="4" fill="#8B5CF6" className="animate-pulse" />
                  </svg>
                  
                  {/* Positioned Node Labels */}
                  {/* 1. Technology (Top) */}
                  <div className="absolute top-2 text-center flex flex-col items-center">
                    <span className="text-[9px] font-black bg-purple-500/10 text-purple-300 border border-purple-500/25 px-2 py-0.5 rounded-full uppercase tracking-widest shadow-md">
                      Technology
                    </span>
                    <span className="text-[8px] text-slate-500 font-bold mt-1 uppercase tracking-wide">Peak Growth</span>
                  </div>

                  {/* 2. Industrials (Right) */}
                  <div className="absolute right-0 text-center flex flex-col items-center">
                    <span className="text-[9px] font-black bg-indigo-500/10 text-indigo-300 border border-indigo-500/25 px-2 py-0.5 rounded-full uppercase tracking-widest shadow-md">
                      Industrials
                    </span>
                    <span className="text-[8px] text-slate-500 font-bold mt-1 uppercase tracking-wide">Late Bull</span>
                  </div>

                  {/* 3. Energy (Bottom) */}
                  <div className="absolute bottom-2 text-center flex flex-col items-center">
                    <span className="text-[9px] font-black bg-red-500/10 text-red-300 border border-red-500/25 px-2 py-0.5 rounded-full uppercase tracking-widest shadow-md">
                      Energy
                    </span>
                    <span className="text-[8px] text-slate-500 font-bold mt-1 uppercase tracking-wide">Defensive Peak</span>
                  </div>

                  {/* 4. Financials (Left) */}
                  <div className="absolute left-0 text-center flex flex-col items-center">
                    <span className="text-[9px] font-black bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 px-2 py-0.5 rounded-full uppercase tracking-widest shadow-md">
                      Financials
                    </span>
                    <span className="text-[8px] text-slate-500 font-bold mt-1 uppercase tracking-wide">Early Cycle</span>
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
                    const barColor = isHigh ? 'bg-gradient-to-r from-purple-500 to-indigo-500 shadow-[0_0_10px_rgba(139,92,246,0.3)]' : isLow ? 'bg-gradient-to-r from-red-500 to-rose-600 shadow-[0_0_10px_rgba(239,68,68,0.3)]' : 'bg-gradient-to-r from-slate-500 to-slate-400';
                    return (
                      <div key={name} className="space-y-1.5 font-mono">
                        <div className="flex justify-between text-xs font-bold items-center">
                          <span className="text-slate-300 font-sans">{name}</span>
                          <span className={cn(
                            'text-[10px] px-1.5 py-0.5 rounded font-black flex items-center gap-1',
                            isHigh ? 'text-purple-300 bg-purple-500/10 border border-purple-500/20' : isLow ? 'text-red-300 bg-red-500/10 border border-red-500/20' : 'text-slate-400 bg-slate-500/10'
                          )}>
                            {score}
                            <span className={cn("font-bold text-xs leading-none", trends[name]?.color)}>
                              {trends[name]?.arrow}
                            </span>
                          </span>
                        </div>

                        {/* Progress meter */}
                        <div className="h-2 w-full bg-white/[0.04] rounded-full overflow-hidden">
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
            <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/[0.07] to-[rgba(7,11,22,0.85)] p-6 md:p-7 relative overflow-hidden shadow-[0_12px_45px_rgba(245,158,11,0.05)] hover:border-amber-500/40 transition-all duration-300">
              {/* Ambient fire background glow */}
              <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-amber-500/10 blur-2xl pointer-events-none" />
              
              <div className="flex items-center gap-2 text-[10px] uppercase font-black tracking-widest text-amber-400 select-none mb-4">
                <span className="animate-pulse">🔥</span> Hot Sector
              </div>

              <div className="flex items-baseline justify-between mb-5 border-b border-white/[0.05] pb-3.5">
                <h3 className="text-xl md:text-2xl font-extrabold text-white tracking-tight">Technology</h3>
                <span className="text-emerald-400 font-mono font-bold text-base md:text-lg animate-pulse">+4.5%</span>
              </div>

              <div className="grid grid-cols-2 gap-6 text-[11px] text-slate-400 font-mono mb-4">
                <div className="space-y-1">
                  <span className="text-slate-500 block text-[8px] uppercase font-bold tracking-widest font-sans">Inst. Flow</span>
                  <span className="font-bold text-white text-sm md:text-base font-mono">+$4.5B</span>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-500 block text-[8px] uppercase font-bold tracking-widest font-sans">AI Confidence</span>
                  <span className="font-bold text-purple-400 text-sm md:text-base font-mono">91%</span>
                </div>
              </div>

              <div className="border-t border-white/[0.05] pt-3.5 text-[10px] font-bold text-amber-500 uppercase tracking-widest flex items-center gap-2 font-sans select-none">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> Momentum Leader
              </div>
            </div>
          </motion.div>

          {/* SECTION 4: AI Sector Narratives */}
          <motion.div {...fadeUp(0.2)}>
            <GlassCard className="space-y-4">
              <SectionHeader title="AI Sector Narratives" icon={Sparkles} />
              
              <div className="space-y-3">
                {[
                  { text: 'Technology attracting institutional inflows as hardware demand accelerates.', bias: 'BULLISH', color: 'text-purple-400' },
                  { text: 'Financials showing broad participation with strong retail and block sweeps.', bias: 'BULLISH', color: 'text-emerald-400' },
                  { text: 'Healthcare weakening after multiple high-profile earnings misses.', bias: 'BEARISH', color: 'text-red-400' },
                  { text: 'Energy remains under pressure due to global crude inventory softness.', bias: 'BEARISH', color: 'text-red-400' },
                ].map((narr, i) => (
                  <div key={i} className="flex gap-2.5 border-b border-white/[0.03] pb-2.5 last:border-b-0 last:pb-0">
                    <span className={cn('text-xs flex-shrink-0 mt-0.5 font-bold', narr.color)}>●</span>
                    <p className="text-xs text-slate-300 font-sans leading-relaxed">{narr.text}</p>
                  </div>
                ))}

                <div className="flex items-center justify-between text-[10px] border-t border-white/[0.06] pt-3.5 font-mono">
                  <span className="text-slate-500 font-bold uppercase tracking-wider">Scanner Confidence</span>
                  <span className="font-bold text-purple-400 bg-purple-500/10 border border-purple-500/25 px-2 py-0.5 rounded-full">
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

              <div className="relative pl-6 space-y-5 border-l border-white/[0.08] ml-2">
                {[
                  { time: '09:30', event: '↓ Energy', colorClass: 'bg-red-500/10 text-red-400 border border-red-500/20', circleColor: 'bg-red-500', desc: 'Slight selling detected in crude futures triggering early rotation out of oil majors.' },
                  { time: '12:00', event: '↑ Technology', colorClass: 'bg-purple-500/10 text-purple-400 border border-purple-500/20', circleColor: 'bg-purple-500', desc: 'Surge in high-frequency block buys for AI chip makers on positive Taiwan semiconductor notes.' },
                  { time: '15:30', event: '↑ Financials', colorClass: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20', circleColor: 'bg-emerald-500', desc: 'Smart money accumulation detected in major banking institutions during late trading session block trades.' },
                ].map((item, idx) => (
                  <div key={idx} className="relative">
                    {/* Node Dot on vertical timeline */}
                    <span className="absolute -left-[30px] top-1.5 w-2.5 h-2.5 rounded-full border border-slate-700 bg-[#050816] flex items-center justify-center z-10">
                      <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse", item.circleColor)} />
                    </span>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded font-mono text-[9px] bg-white/[0.04] text-slate-400 border border-white/[0.05]">{item.time}</span>
                        <span className={cn('text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border leading-none', item.colorClass)}>
                          {item.event}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-relaxed font-sans pt-0.5">
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
