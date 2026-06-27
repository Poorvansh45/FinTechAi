'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, BookOpen, LineChart, Sparkles, Briefcase,
  TrendingUp, ArrowRight, Globe, FlaskConical, Calendar,
  Zap, ShieldAlert, FileText, Terminal, ArrowUpRight,
  ArrowDownRight, AlertTriangle, TrendingDown, Clock, CheckCircle2,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '@/context/AuthProvider';
import { profileInitial } from '@/lib/auth/types';

// AI Coach suggestions with different styles
const STATIC_COACH_MESSAGES = [
  {
    time: '09:30 AM',
    type: 'warning',
    label: 'Risk Warning',
    text: 'QQQ position sizing is 1.5x above safety thresholds. High volatility zone active.'
  },
  {
    time: '10:45 AM',
    type: 'info',
    label: 'Behavior AI',
    text: 'Increased correlation detected between core watchlist holdings. Sector rotation in progress.'
  }
];

// Upcoming AI messages for simulated typing feedback
const UPCOMING_MESSAGES = [
  "Perfect execution on NVDA breakout. Entry matches high-volume node alignment. Sharpe ratio positive impact.",
  "Risk detected: QQQ position size exceeds daily limit. Consider reducing by 20% to stay within your risk bounds.",
  "Behavioral Alert: Overtrading patterns typically emerge in your history after 10:30 AM on Fridays. Maintain discipline.",
  "SMC zone active on EURUSD H1. Liquidity grab detected. Look for market structure shift before confirmation."
];

export default function AppHomePage() {
  const { user } = useAuth();
  const displayName = user?.username ?? 'Vansh';
  const initial = user?.username ? profileInitial(user.username) : 'V';

  // Live market status animation
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Format date dynamically
  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  // AI Typing Coach State
  const [messageIdx, setMessageIdx] = useState(0);
  const [currentText, setCurrentText] = useState('');
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    const targetText = UPCOMING_MESSAGES[messageIdx];
    let charIdx = 0;
    setCurrentText('');
    setIsTyping(true);
    
    const timer = setInterval(() => {
      if (charIdx < targetText.length) {
        setCurrentText(targetText.slice(0, charIdx + 1));
        charIdx++;
      } else {
        clearInterval(timer);
        setIsTyping(false);
        const delay = setTimeout(() => {
          setMessageIdx((prev) => (prev + 1) % UPCOMING_MESSAGES.length);
        }, 7000);
        return () => clearTimeout(delay);
      }
    }, 20);

    return () => clearInterval(timer);
  }, [messageIdx]);

  // Framer Motion staggered entrance animations
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 120, damping: 18 } }
  };

  return (
    <div className="min-h-screen bg-[#050816] text-white py-6 md:py-8">
      {/* ══ Welcome Header Section ════════════════════════════════ */}
      <div className="max-w-[1600px] mx-auto px-6 md:px-8 mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 p-6 rounded-3xl border border-white/[0.08] bg-[#09101E] backdrop-blur-md relative overflow-hidden">
          {/* Background beam effects */}
          <div className="absolute top-0 right-0 w-[400px] h-[200px] bg-violet-600/5 rounded-full blur-[80px] pointer-events-none" />
          
          <div className="flex flex-col md:flex-row md:items-center gap-5 relative z-10">
            {/* Avatar */}
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white shadow-[0_0_20px_rgba(109,93,251,0.2)] flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg,#6D5DFB,#8B5CF6)',
                border: '1px solid rgba(109,93,251,0.3)'
              }}
            >
              {initial}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                  Platform Home
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-white mt-3 leading-tight">
                Welcome back,<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#B98EFF] to-[#6AAFFF]">
                  {displayName === 'there' ? 'Vansh' : displayName}
                </span>
              </h1>
              <p className="text-sm text-zinc-400 mt-2 max-w-xl leading-relaxed">
                Your intelligence center is synchronized. Review scanners, backtests and AI coaching.
              </p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-start lg:items-end gap-3.5 relative z-10 min-w-[150px]">
            {/* Live Indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-semibold w-fit">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-purple-500"></span>
              </span>
              <span className="uppercase tracking-wider text-[9px]">Markets Live</span>
            </div>

            {/* Date Display */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/5 text-slate-400 text-xs font-medium font-mono w-fit">
              <Calendar className="w-3.5 h-3.5 text-purple-400" />
              <span>{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
            </div>

            {/* Elegant Open Dashboard button */}
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold text-white transition-all hover:opacity-90 shadow-lg shadow-purple-500/10 border border-purple-500/30 w-fit"
              style={{ background: 'linear-gradient(135deg,#6D5DFB,#8B5CF6)' }}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              Open Dashboard
            </Link>
          </div>
        </div>
      </div>

      {/* ══ Bento Grid Content ══════════════════════════════════ */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="max-w-[1600px] mx-auto px-6 md:px-8 gap-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 pb-12"
      >
        {/* ROW 1 CARD 1: Markets Watchlist */}
        <motion.div variants={itemVariants} className="bg-[#09101E] border border-white/[0.08] rounded-3xl transition-all duration-300 hover:-translate-y-1 hover:border-purple-500/30 hover:shadow-[0_0_40px_rgba(109,93,251,0.12)] p-6 flex flex-col justify-between min-h-[220px]">
          <div>
            <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-3">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-400" />
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Markets Watchlist</span>
              </div>
              <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">LIVE</span>
            </div>

            <div className="grid grid-cols-2 gap-y-2.5 gap-x-4">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-300">SPY</span>
                <span className="font-mono text-emerald-400 font-bold">+1.24%</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-300">QQQ</span>
                <span className="font-mono text-emerald-400 font-bold">+0.92%</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-300">NVDA</span>
                <span className="font-mono text-emerald-400 font-bold">+1.65%</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-300">BTC</span>
                <span className="font-mono text-rose-400 font-bold">-0.80%</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/5">
            {/* Live animated SVG sparkline */}
            <svg className="w-full h-10 overflow-visible" viewBox="0 0 100 30">
              <defs>
                <linearGradient id="sparklineGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
                </linearGradient>
              </defs>
              <motion.path
                d="M0 25 Q15 10 30 18 T60 5 T80 20 T100 8"
                fill="none"
                stroke="#8b5cf6"
                strokeWidth="1.5"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.5, ease: "easeOut" }}
              />
              <path
                d="M0 25 Q15 10 30 18 T60 5 T80 20 T100 8 L100 30 L0 30 Z"
                fill="url(#sparklineGrad)"
              />
              <circle
                cx="100"
                cy="8"
                r="3"
                fill="#8b5cf6"
                className="animate-pulse"
              />
            </svg>
          </div>
        </motion.div>

        {/* ROW 1 CARD 2: Trading Journal Stats */}
        <motion.div variants={itemVariants} className="bg-[#09101E] border border-white/[0.08] rounded-3xl transition-all duration-300 hover:-translate-y-1 hover:border-purple-500/30 hover:shadow-[0_0_40px_rgba(109,93,251,0.12)] p-6 flex flex-col justify-between min-h-[220px]">
          <div>
            <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-amber-400" />
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Trading Journal</span>
              </div>
              <Link href="/journal" className="text-[10px] text-slate-500 hover:text-white flex items-center gap-0.5 transition-colors">
                Log <ArrowRight className="w-2.5 h-2.5" />
              </Link>
            </div>

            <div className="space-y-2.5">
              <div className="flex justify-between items-baseline">
                <span className="text-2xl font-black tracking-tight text-white font-mono">68%</span>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Win Rate</span>
              </div>
              
              {/* Ratio Bar */}
              <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden flex">
                <div className="h-full bg-emerald-500" style={{ width: '68%' }} />
                <div className="h-full bg-rose-500" style={{ width: '32%' }} />
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400 pt-1">
                <div>
                  <span className="block text-[8px] font-bold uppercase tracking-wider text-slate-500">Total Trades</span>
                  <span className="font-mono font-bold text-white text-sm">24</span>
                </div>
                <div>
                  <span className="block text-[8px] font-bold uppercase tracking-wider text-slate-500">Last Session</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">+3.4 R</span>
                </div>
              </div>
            </div>
          </div>

          <div className="text-[10px] text-slate-500 border-t border-white/5 pt-2 flex items-center justify-between">
            <span>Avg Risk/Reward: 1:2.30</span>
            <span className="text-emerald-400">3 W - 1 L</span>
          </div>
        </motion.div>

        {/* ROW 1 CARD 3: Performance Analytics */}
        <motion.div variants={itemVariants} className="bg-[#09101E] border border-white/[0.08] rounded-3xl transition-all duration-300 hover:-translate-y-1 hover:border-purple-500/30 hover:shadow-[0_0_40px_rgba(109,93,251,0.12)] p-6 flex flex-col justify-between min-h-[220px]">
          <div>
            <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-3">
              <div className="flex items-center gap-2">
                <LineChart className="w-4 h-4 text-emerald-400" />
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Performance Snap</span>
              </div>
              <span className="text-[9px] font-bold text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded border border-violet-500/20">98% efficiency</span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-slate-400">Net Profit</div>
                <div className="text-xl font-bold font-mono text-emerald-400 tracking-tight">+$12,450.80</div>
                <div className="text-[10px] text-slate-500">Profit Factor: <span className="text-slate-300 font-mono">2.42</span></div>
              </div>

              {/* Circular progress meter */}
              <div className="relative w-16 h-16 flex-shrink-0 flex items-center justify-center">
                <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-white/5"
                    strokeWidth="2.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <motion.path
                    className="text-violet-500"
                    strokeWidth="2.5"
                    strokeDasharray="84, 100"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    initial={{ strokeDasharray: "0, 100" }}
                    animate={{ strokeDasharray: "84, 100" }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                  />
                </svg>
                <div className="absolute text-[10px] font-black text-white font-mono">84%</div>
              </div>
            </div>
          </div>

          <div className="text-[9px] text-slate-500 border-t border-white/5 pt-2 flex justify-between">
            <span>Score: Excellent</span>
            <span className="text-slate-400">Avg Drawdown: 1.4%</span>
          </div>
        </motion.div>

        {/* ROW 1 CARD 4: Quant Lab Allocation */}
        <motion.div variants={itemVariants} className="bg-[#09101E] border border-white/[0.08] rounded-3xl transition-all duration-300 hover:-translate-y-1 hover:border-purple-500/30 hover:shadow-[0_0_40px_rgba(109,93,251,0.12)] p-6 flex flex-col justify-between min-h-[220px]">
          <div>
            <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-3">
              <div className="flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-violet-400" />
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Quant Lab Weights</span>
              </div>
              <span className="text-[9px] font-mono text-slate-400 bg-white/5 px-1 py-0.5 rounded">MPT Optimized</span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Sharpe Ratio:</span>
                <span className="font-mono font-bold text-white">2.84</span>
              </div>
              
              {/* Core assets allocations list */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-400">NVDA (35%)</span>
                  <span className="text-slate-400">AAPL (25%)</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden flex">
                  <div className="h-full bg-violet-500" style={{ width: '35%' }} />
                  <div className="h-full bg-blue-500" style={{ width: '25%' }} />
                  <div className="h-full bg-amber-500" style={{ width: '15%' }} />
                  <div className="h-full bg-slate-600" style={{ width: '25%' }} />
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-400">BTC (15%)</span>
                  <span className="text-slate-400">CASH (25%)</span>
                </div>
              </div>
            </div>
          </div>

          <div className="text-[10px] text-slate-500 border-t border-white/5 pt-2 flex justify-between">
            <span>Portfolio Alpha: 4.12%</span>
            <span>Beta: 0.88</span>
          </div>
        </motion.div>

        {/* ══ ROW 2: Split-Columns Layout ══════════════════════════ */}
        
        {/* ROW 2 CARD 1: Market Intelligence (2 columns) */}
        <motion.div variants={itemVariants} className="bg-[#09101E] border border-white/[0.08] rounded-3xl transition-all duration-300 hover:-translate-y-1 hover:border-purple-500/30 hover:shadow-[0_0_40px_rgba(109,93,251,0.12)] p-6 flex flex-col justify-between lg:col-span-2 min-h-[300px]">
          <div>
            <div className="flex items-center justify-between border-b border-white/5 pb-2.5 mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-violet-400" />
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Market Intelligence</span>
              </div>
              <span className="text-[9px] font-medium text-slate-400">Macro Rotation / SMC Scanner</span>
            </div>

            <div className="space-y-4">
              {/* Bullish/Bearish Breadth Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                  <span className="text-emerald-400">Bullish Breadth (62%)</span>
                  <span className="text-rose-400">Bearish Breadth (38%)</span>
                </div>
                <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden flex">
                  <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400" style={{ width: '62%' }} />
                  <div className="h-full bg-gradient-to-r from-rose-500 to-rose-600" style={{ width: '38%' }} />
                </div>
              </div>

              {/* Ticker break down */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">SMC Breakouts</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/5 text-xs">
                      <div className="flex items-center gap-2">
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        <span className="font-semibold">TSLA</span>
                      </div>
                      <span className="font-mono text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded text-[10px]">+4.80%</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/5 text-xs">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="w-3.5 h-3.5 text-blue-400" />
                        <span className="font-semibold">MSFT</span>
                      </div>
                      <span className="font-mono text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded text-[10px]">+1.22%</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Volume Surges</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/5 text-xs">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="font-semibold">AVGO</span>
                      </div>
                      <span className="font-mono text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded text-[10px]">+3.60%</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/5 text-xs">
                      <div className="flex items-center gap-2">
                        <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                        <span className="font-semibold">AMD</span>
                      </div>
                      <span className="font-mono text-rose-400 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded text-[10px]">-2.10%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/5 flex flex-wrap gap-2">
            <span className="text-[9px] bg-white/5 text-slate-400 px-2 py-0.5 rounded-full border border-white/5">Tech: +2.10%</span>
            <span className="text-[9px] bg-white/5 text-slate-400 px-2 py-0.5 rounded-full border border-white/5">Finance: -0.40%</span>
            <span className="text-[9px] bg-white/5 text-slate-400 px-2 py-0.5 rounded-full border border-white/5">Energy: +1.50%</span>
            <span className="text-[9px] bg-white/5 text-slate-400 px-2 py-0.5 rounded-full border border-white/5">Healthcare: +0.80%</span>
          </div>
        </motion.div>

        {/* ROW 2 CARD 2: AI Coaching Insights (2 columns) */}
        <motion.div variants={itemVariants} className="bg-[#09101E] border border-white/[0.08] rounded-3xl transition-all duration-300 hover:-translate-y-1 hover:border-purple-500/30 hover:shadow-[0_0_40px_rgba(109,93,251,0.12)] p-6 flex flex-col justify-between lg:col-span-2 min-h-[300px]">
          <div>
            <div className="flex items-center justify-between border-b border-white/5 pb-2.5 mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-400 animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">AI Coaching Feed</span>
              </div>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
              </span>
            </div>

            <div className="space-y-3">
              {/* Static feed messages */}
              {STATIC_COACH_MESSAGES.map((msg, i) => (
                <div key={i} className="p-3 rounded-2xl bg-white/[0.01] border border-white/[0.04] flex items-start gap-3">
                  <div className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    msg.type === 'warning' ? 'bg-amber-400' : 'bg-blue-400'
                  }`} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{msg.label}</span>
                      <span className="text-[9px] text-slate-600 font-mono">{msg.time}</span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1 font-normal leading-relaxed">{msg.text}</p>
                  </div>
                </div>
              ))}

              {/* Dynamic typing simulation message */}
              <div className="p-3 rounded-2xl bg-violet-950/10 border border-violet-500/10 flex items-start gap-3 relative overflow-hidden">
                <div className="absolute top-0 right-0 text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-bl bg-violet-500/10 text-violet-300 font-mono">
                  Copilot Stream
                </div>
                <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-violet-300">Live Trade Coach</span>
                    <span className="text-[9px] text-violet-500/70 font-mono">Streaming...</span>
                  </div>
                  
                  <div className="text-xs text-slate-200 mt-1.5 leading-relaxed font-mono min-h-[40px] relative">
                    <span>{currentText}</span>
                    {isTyping && (
                      <span className="inline-block w-1.5 h-3.5 bg-violet-400 ml-1 animate-[pulse_0.8s_infinite] align-middle" />
                    )}
                  </div>
                </div>
              </div>

            </div>
          </div>

          <div className="text-[9px] text-slate-600 border-t border-white/5 pt-2 text-right">
            <span>Powered by Gemini 1.5 Pro • Memory Context Sync Active</span>
          </div>
        </motion.div>

        {/* ROW 2 CARD 3: Workspace Files (1 column) */}
        <motion.div variants={itemVariants} className="bg-[#09101E] border border-white/[0.08] rounded-3xl transition-all duration-300 hover:-translate-y-1 hover:border-purple-500/30 hover:shadow-[0_0_40px_rgba(109,93,251,0.12)] p-6 flex flex-col justify-between min-h-[300px]">
          <div>
            <div className="flex items-center justify-between border-b border-white/5 pb-2.5 mb-3">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-amber-400" />
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Workspace Files</span>
              </div>
              <span className="text-[9px] text-slate-500">4 total</span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-3 p-2 rounded-xl bg-white/[0.01] hover:bg-white/[0.03] border border-white/[0.04] transition-all group/file cursor-pointer">
                <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-200 truncate group-hover/file:text-white transition-colors">journal_2026_06.json</p>
                  <p className="text-[9px] text-slate-500 font-mono">1.2 MB • Edited 2m ago</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-2 rounded-xl bg-white/[0.01] hover:bg-white/[0.03] border border-white/[0.04] transition-all group/file cursor-pointer">
                <Terminal className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-200 truncate group-hover/file:text-white transition-colors">smc_breakout_v2.py</p>
                  <p className="text-[9px] text-slate-500 font-mono">18.4 KB • Backtest Passed</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-2 rounded-xl bg-white/[0.01] hover:bg-white/[0.03] border border-white/[0.04] transition-all group/file cursor-pointer">
                <FileText className="w-4 h-4 text-violet-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-200 truncate group-hover/file:text-white transition-colors">fvg_scanner_config.json</p>
                  <p className="text-[9px] text-slate-500 font-mono">2.4 KB • Setup Active</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-2 rounded-xl bg-white/[0.01] hover:bg-white/[0.03] border border-white/[0.04] transition-all group/file cursor-pointer">
                <LineChart className="w-4 h-4 text-pink-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-200 truncate group-hover/file:text-white transition-colors">sharpe_matrix.csv</p>
                  <p className="text-[9px] text-slate-500 font-mono">250 KB • Exported Today</p>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-white/5 pt-2 flex items-center justify-between">
            <span className="text-[9px] text-slate-500">Local-First Storage</span>
            <span className="text-[9px] text-violet-400 hover:text-white cursor-pointer font-medium flex items-center gap-0.5">
              Sync files <ChevronRight className="w-2.5 h-2.5" />
            </span>
          </div>
        </motion.div>

        {/* ══ ROW 3: Linear-style Activity Log (4 columns span) ══════ */}
        <motion.div variants={itemVariants} className="bg-[#09101E] border border-white/[0.08] rounded-3xl transition-all duration-300 hover:-translate-y-1 hover:border-purple-500/30 hover:shadow-[0_0_40px_rgba(109,93,251,0.12)] p-6 lg:col-span-4 min-h-[250px] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-white/5 pb-2.5 mb-5">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-violet-400" />
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Activity Timeline</span>
              </div>
              <span className="text-[9px] text-slate-500">Local auditing active</span>
            </div>

            {/* Timeline */}
            <div className="relative border-l border-white/5 ml-3 pl-6 space-y-6">
              
              {/* Event 1 */}
              <div className="relative">
                {/* Node dot */}
                <div className="absolute -left-[30px] top-1.5 w-2 h-2 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.8)]" />
                
                <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                  <span className="text-[10px] font-mono text-slate-500 min-w-[70px]">Today 09:15</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-300">Technical Setup Detected</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold uppercase">SMC Scanner</span>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Fair Value Gap (FVG) filled on QQQ at 452.80. Shift in market structure confirmed on M5. Dispatched execution alert to dashboard.
                </p>
              </div>

              {/* Event 2 */}
              <div className="relative">
                {/* Node dot */}
                <div className="absolute -left-[30px] top-1.5 w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                
                <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                  <span className="text-[10px] font-mono text-slate-500 min-w-[70px]">Today 10:30</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-300">Trade Journal Sync</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold uppercase">Journal</span>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Logged breakout long on NVDA. Entry price: $125.40, Target: $127.90. Net outcome: <span className="text-emerald-400 font-semibold font-mono">+2.50 R (+ $1,420.00)</span>.
                </p>
              </div>

              {/* Event 3 */}
              <div className="relative">
                {/* Node dot */}
                <div className="absolute -left-[30px] top-1.5 w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                
                <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                  <span className="text-[10px] font-mono text-slate-500 min-w-[70px]">Today 11:05</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-300">AI Performance Review</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20 font-bold uppercase">Copilot</span>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Calculated trade risk efficiency score of 94/100. Overtrading risk level reduced from moderate to low based on journal activity frequency.
                </p>
              </div>

              {/* Event 4 (Yesterday) */}
              <div className="relative">
                {/* Node dot */}
                <div className="absolute -left-[30px] top-1.5 w-2 h-2 rounded-full bg-slate-600" />
                
                <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                  <span className="text-[10px] font-mono text-slate-500 min-w-[70px]">Yesterday 16:30</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-300">Weekly Performance Report</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-400 border border-slate-500/20 font-bold uppercase">Analytics</span>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Weekly performance metrics exported successfully. Profit factor stays stable at 2.42. Sharpe ratio calculated at 2.84.
                </p>
              </div>

            </div>
          </div>

          <div className="mt-6 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500">
            <span>Showing last 4 events</span>
            <span className="text-violet-400 hover:text-white cursor-pointer transition-colors flex items-center gap-0.5">
              Open Audit Log <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </motion.div>

      </motion.div>
    </div>
  );
}
