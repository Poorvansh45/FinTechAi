"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthProvider";
import { LightBeamButton } from "@/components/ui/light-beam-button";
import {
  BrainCircuit, BarChart3, BookOpen, Bot, ScanLine,
  ArrowRight, Shield, Zap, TrendingUp,
  Plug, Sparkles, Settings2, Clock,
  CheckCircle2, Lock,
  Globe, Briefcase, History, LineChart, Activity, Filter, Layers,
  ShieldCheck, HelpCircle, MessageSquare, Flame, ChevronRight
} from "lucide-react";

// Timeline features
const UPCOMING = [
  {
    icon: Plug,
    title: "MT5 Integration",
    tag: "Coming Soon",
    desc: "Connect your MetaTrader 5 account using your ID & password. Automatically fetch executed trades and journal them in one click.",
    bullets: ["Auto-fetch trades from MT5", "No manual entry required", "Works with any MT5 broker"],
    color: "#6366f1",
  },
  {
    icon: Sparkles,
    title: "Smart Auto Journaling",
    tag: "In Development",
    desc: "AI detects your trades from broker feeds, tags setups automatically, and fills in entry logic — so you can focus on trading.",
    bullets: ["Auto-tag setups (FVG, BOS, OB…)", "Smart session detection", "Duplicate trade filtering"],
    color: "#22c55e",
  },
  {
    icon: Bot,
    title: "AI Trade Assistant",
    tag: "Planned",
    desc: "A real-time AI coach that reviews trades as you log them — suggests improvements, flags mistakes, and tracks your growth.",
    bullets: ["Real-time mistake detection", "R:R improvement suggestions", "Psychological pattern alerts"],
    color: "#a78bfa",
  },
  {
    icon: Settings2,
    title: "Custom Strategy Builder",
    tag: "Planned",
    desc: "Define your own trading setups with custom rules, criteria, and risk parameters — then track performance per strategy.",
    bullets: ["Define entry/exit rules", "Per-strategy analytics", "Backtesting integration"],
    color: "#f59e0b",
  },
];

const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  "Coming Soon":    { bg: "rgba(99,102,241,0.15)",  text: "#a5b4fc" },
  "In Development": { bg: "rgba(34,197,94,0.12)",   text: "#4ade80" },
  "Planned":        { bg: "rgba(245,158,11,0.12)",  text: "#fbbf24" },
};

// Outcome-focused testimonials emphasizing quantifiable metrics
const TESTIMONIALS = [
  {
    quote: "The SMC scanner alone has saved me 2.5 hours of manual analysis daily. Real-time FVG and Order Block structures are identified instantly, freeing me to focus purely on executions.",
    name: "Alex Dumont",
    role: "Prop Firm Swing Trader",
    style: "SMC Setup Focus",
    rating: 5,
    avatar: "AD"
  },
  {
    quote: "FinAI Edge cut down my capital drawdown by 40% in two weeks. The Portfolio Optimizer correlation matrix completely changed how I allocate portfolio weights and sector exposure.",
    name: "Dr. Sarah Chen",
    role: "Quantitative Researcher",
    style: "Systematic Futures",
    rating: 5,
    avatar: "SC"
  },
  {
    quote: "Gemini AI trade reviews detected 14 recurring psychological mistakes in my logs. Cut down revenge trading by 37% and significantly boosted my overall expectancy factor.",
    name: "Marcus Vance",
    role: "Independent Options Scalper",
    style: "Momentum / Flow",
    rating: 5,
    avatar: "MV"
  },
  {
    quote: "Syncing MT5 executions directly to local performance analytics saved me hours of manual entry and highlighted my session win rate limits. Execution discipline improved instantly.",
    name: "Elena Rostova",
    role: "Full-Time FX Trader",
    style: "Trend Breakouts",
    rating: 5,
    avatar: "ER"
  },
  {
    quote: "The AI-powered mistake scanner caught my habit of chasing breakouts within seconds of logging. Saved thousands in potential slippage by enforcing strict entry compliance.",
    name: "Kenji Sato",
    role: "Equity Day Trader",
    style: "VBP / Volume Profile",
    rating: 5,
    avatar: "KS"
  }
];

export default function HomePage() {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [activeShowcase, setActiveShowcase] = useState("markets");
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    router.prefetch('/auth');

    const handleExit = () => setIsExiting(true);
    window.addEventListener('premium-auth-exit', handleExit);
    return () => window.removeEventListener('premium-auth-exit', handleExit);
  }, [router]);

  const handleAuthNavigation = (targetUrl: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => {
        router.push(targetUrl);
      }, 150);
    }, 120);
  };
  
  // Spotlight mouse track ref
  const spotlightRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!spotlightRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    spotlightRef.current.style.background = `radial-gradient(400px circle at ${x}px ${y}px, rgba(139, 92, 246, 0.04), transparent 80%)`;
  };

  // Dynamic watchlist ticker updates
  const [mockStocks, setMockStocks] = useState([
    { sym: "NVDA", name: "NVIDIA Corp", val: 128.50, change: "+3.84%", up: true, flash: false },
    { sym: "TSLA", name: "Tesla Inc", val: 184.20, change: "-1.24%", up: false, flash: false },
    { sym: "AAPL", name: "Apple Inc", val: 212.10, change: "+0.95%", up: true, flash: false }
  ]);

  // Dynamic AI feed statements
  const aiFeeds = [
    {
      title: "🤖 Setup Detected",
      body: "NVDA broke resistance. SMC Scanner confirms bullish FVG.",
      color: "text-[#A78BFA]",
      bg: "bg-[#8B5CF6]/5 border-[#8B5CF6]/10"
    },
    {
      title: "⚡ Order Block Mitigated",
      body: "AAPL demand zone tested. Bullish rejection scanner active.",
      color: "text-[#A78BFA]",
      bg: "bg-[#8B5CF6]/5 border-[#8B5CF6]/10"
    },
    {
      title: "🎯 Strategy Executed",
      body: "Portfolio optimized weight trigger active on tech sector.",
      color: "text-[#A78BFA]",
      bg: "bg-[#8B5CF6]/5 border-[#8B5CF6]/10"
    }
  ];

  const [activeFeedIdx, setActiveFeedIdx] = useState(0);
  const [feedGlow, setFeedGlow] = useState(false);

  useEffect(() => {
    const feedInterval = setInterval(() => {
      setFeedGlow(true);
      setActiveFeedIdx(prev => (prev + 1) % aiFeeds.length);
      setTimeout(() => setFeedGlow(false), 800);
    }, 6000);
    return () => clearInterval(feedInterval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setMockStocks(prev => prev.map((stock, i) => {
        // Only update one stock at a time randomly
        if (Math.random() > 0.4) {
          const delta = (Math.random() - 0.45) * 0.4;
          const newVal = Math.max(10, stock.val + delta);
          const newChangePct = (delta >= 0 ? "+" : "") + ((delta / stock.val) * 100).toFixed(2) + "%";
          return {
            ...stock,
            val: parseFloat(newVal.toFixed(2)),
            change: newChangePct,
            up: delta >= 0,
            flash: true
          };
        }
        return { ...stock, flash: false };
      }));
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-[120px] pb-24 animate-fadeIn overflow-x-hidden">
      
      {/* ── 2. HERO SECTION WITH CINEMATIC GLOW ── */}
      <div 
        className="relative pt-6 md:pt-8 pb-0 px-4 overflow-hidden group/hero"
        onMouseMove={handleMouseMove}
      >
        
        {/* Soft spotlight overlay following cursor */}
        <div
          ref={spotlightRef}
          className="absolute inset-0 pointer-events-none transition-opacity duration-300 opacity-0 group-hover/hero:opacity-100 -z-10"
          style={{
            background: `radial-gradient(400px circle at 0px 0px, rgba(139, 92, 246, 0.04), transparent 80%)`,
          }}
        />

        {/* Glow System Overlays */}
        {/* Soft Radial Glow behind Hero Headline */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 w-[600px] h-[350px] rounded-full bg-gradient-to-r from-violet-600/10 to-indigo-600/5 blur-[120px] pointer-events-none -z-10 animate-pulse" />
        
        {/* Faint Gradient Bloom behind Hero Preview */}
        <div className="absolute top-[300px] left-1/2 -translate-x-1/2 w-[900px] h-[450px] rounded-full bg-[#8B5CF6]/4 blur-[140px] pointer-events-none -z-10 animate-pulse" />
        
        {/* Subtle grid pattern overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none -z-20" />

        <div className="max-w-6xl mx-auto text-center space-y-6">
          <motion.div
            animate={{ opacity: isExiting ? 0 : 1 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="space-y-6"
          >
          
          {/* Tagline Label */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full backdrop-blur-md bg-white/[0.02] border border-white/[0.08] text-[#94A3B8] shadow-[0_0_15px_rgba(139,92,246,0.05)] hover:border-[#8B5CF6]/30 transition-all duration-300">
            <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6] animate-pulse shadow-[0_0_8px_rgba(139,92,246,0.8)]" />
            <span className="font-mono tracking-[0.25em] text-[10px] uppercase text-[#A78BFA]">FUTURE TRADING OS</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-7xl md:text-[88px] lg:text-[100px] xl:text-[112px] font-black tracking-tight text-[#F8FAFC] leading-[1.0] max-w-5xl mx-auto animate-hero-headline">
            The AI Operating System <br className="hidden md:inline" />
            for <span className="relative inline-block text-transparent bg-clip-text bg-gradient-to-r from-[#8B5CF6] via-[#A78BFA] to-[#6366F1] drop-shadow-[0_0_30px_rgba(139,92,246,0.3)]">Modern Traders</span>
          </h1>

          {/* Subheadline & Capabilities Row */}
          <div className="space-y-4">
            <p className="text-base sm:text-lg text-[#94A3B8] leading-relaxed max-w-[650px] mx-auto animate-hero-subheadline font-sans tracking-wide">
              Research markets. Detect institutional footprints. <br className="hidden sm:inline" />
              Optimize portfolio decisions. Trade with intelligence.
            </p>
            
            {/* Monospace capabilities indicator tags for Section 5 */}
            <div className="flex items-center justify-center gap-x-3 gap-y-1.5 flex-wrap text-[10px] font-mono text-[#A78BFA]/60 uppercase tracking-widest animate-hero-subheadline [animation-delay:120ms] max-w-2xl mx-auto">
              <span>Markets Monitor</span>
              <span className="text-white/10">•</span>
              <span>SMC Zone Screener</span>
              <span className="text-white/10">•</span>
              <span>Portfolio Optimizer</span>
              <span className="text-white/10">•</span>
              <span>AI Copilot Review</span>
              <span className="text-white/10">•</span>
              <span>Trading Intelligence</span>
            </div>
          </div>

          {/* Dual Button System CTAs */}
          <div className="flex items-center justify-center gap-4 flex-wrap pt-2 animate-hero-ctas">
            {isAuthenticated ? (
              <>
                <LightBeamButton href="/home">
                  Launch Platform <ArrowRight className="w-4 h-4" />
                </LightBeamButton>
                <Link href="#platform"
                  className="flex items-center justify-center gap-2 px-8 rounded-full text-sm font-semibold text-[#F8FAFC] transition-all bg-white/[0.02] border border-white/[0.08] hover:bg-white/[0.06] hover:border-[#8B5CF6]/20 active:scale-[0.98] shadow-sm"
                  style={{ height: '52px' }}>
                  See Ecosystem
                </Link>
              </>
            ) : (
              <>
                <LightBeamButton href="/auth?mode=signin" onClick={handleAuthNavigation('/auth?mode=signin')}>
                  Sign In <ArrowRight className="w-4 h-4" />
                </LightBeamButton>
                
                <Link href="#product"
                  className="flex items-center justify-center gap-2 px-8 rounded-full text-sm font-semibold text-[#F8FAFC] transition-all bg-white/[0.02] border border-white/[0.08] hover:bg-white/[0.06] hover:border-[#8B5CF6]/20 active:scale-[0.98] shadow-sm"
                  style={{ height: '52px' }}>
                  See Ecosystem
                </Link>
              </>
            )}
          </div>

          {/* Premium Trust Strip (Section 2) */}
          <div className="max-w-4xl mx-auto pt-8 md:pt-10 animate-hero-ctas [animation-delay:350ms]">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-y-3.5 gap-x-8 px-8 py-3.5 rounded-full bg-white/[0.01] border border-white/[0.06] backdrop-blur-md shadow-[0_4px_30px_rgba(0,0,0,0.4)]">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#94A3B8] whitespace-nowrap">
                <ShieldCheck className="w-3.5 h-3.5 text-[#8B5CF6] flex-shrink-0" />
                <span>100% Local Data Storage</span>
              </div>
              <div className="hidden sm:block w-px h-3.5 bg-white/[0.08]" />
              <div className="flex items-center gap-2 text-xs font-semibold text-[#94A3B8] whitespace-nowrap">
                <Bot className="w-3.5 h-3.5 text-[#8B5CF6] flex-shrink-0" />
                <span>Powered by Gemini AI</span>
              </div>
              <div className="hidden sm:block w-px h-3.5 bg-white/[0.08]" />
              <div className="flex items-center gap-2 text-xs font-semibold text-[#94A3B8] whitespace-nowrap">
                <ScanLine className="w-3.5 h-3.5 text-[#8B5CF6] flex-shrink-0" />
                <span>Institutional-Grade Scanners</span>
              </div>
              <div className="hidden sm:block w-px h-3.5 bg-white/[0.08]" />
              <div className="flex items-center gap-2 text-xs font-semibold text-[#94A3B8] whitespace-nowrap">
                <Zap className="w-3.5 h-3.5 text-[#8B5CF6] flex-shrink-0" />
                <span>Zero-Latency Signals</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Dynamic Mockup Preview with 32px radius (Scaled by 15-20% to max-w-6xl) */}
        <motion.div
          animate={{ opacity: isExiting ? 0 : 1 }}
          transition={{ duration: 0.25, delay: 0.15, ease: 'easeInOut' }}
          className="relative pt-8 md:pt-12 animate-hero-preview max-w-6xl mx-auto"
        >
            <div className={`relative rounded-[32px] border bg-[#0B1020]/80 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.8),_inset_0_1px_0_0_rgba(255,255,255,0.05)] backdrop-blur-xl overflow-hidden transition-all duration-1000 ${
              feedGlow ? 'shadow-[0_24px_80px_rgba(139,92,246,0.15),_inset_0_1px_0_0_rgba(255,255,255,0.08)] border-[#8B5CF6]/20' : 'border-white/[0.08]'
            }`}>
              
              {/* Header inside mockup */}
              <div className="flex items-center justify-between px-3 pb-3 border-b border-white/[0.05] mb-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#EF4444]/40" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]/40" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#10B981]/40" />
                </div>
                <div className="flex items-center gap-4 text-[10px] font-mono text-[#94A3B8]">
                  <span>workspace_main_v1.0.tsx</span>
                  <span className="text-[#10B981] flex items-center gap-1.5 font-bold animate-workspace-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-ping" />
                    LIVE WORKSPACE
                  </span>
                </div>
              </div>

              {/* Mockup panels */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-left">
                
                {/* Panel 1: Watchlist */}
                <div className="md:col-span-1 rounded-[16px] bg-white/[0.02] border border-white/[0.04] p-3 space-y-2.5">
                  <div className="text-[10px] font-bold tracking-widest text-[#94A3B8] uppercase font-mono">MARKETS WATCHLIST</div>
                  <div className="space-y-1.5">
                    {mockStocks.map(stock => (
                      <div key={stock.sym} className={`flex items-center justify-between p-2 rounded-lg bg-white/[0.02] border border-white/[0.04] transition-all duration-300 ${stock.flash ? 'animate-pulseGreen border-[#10B981]/30' : ''}`}>
                        <div>
                          <div className="text-xs font-bold text-[#F8FAFC]">{stock.sym}</div>
                          <div className="text-[9px] text-[#94A3B8]">{stock.name}</div>
                        </div>
                        <div className="text-right">
                          <div className={`text-xs font-bold font-mono transition-colors duration-300 ${stock.up ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                            {stock.change}
                          </div>
                          <div className="text-[9px] text-[#94A3B8] font-mono">${stock.val.toFixed(2)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Panel 2: Charting (Increased min-h for Section 1 vertical presence) */}
                <div className="md:col-span-2 rounded-[16px] bg-white/[0.02] border border-white/[0.04] p-3 flex flex-col justify-between min-h-[300px] relative">
                  <div className="flex items-center justify-between z-10">
                    <div>
                      <span className="text-[10px] font-bold tracking-widest text-[#94A3B8] uppercase font-mono">PORTFOLIO OPTIMIZER</span>
                      <h4 className="text-sm font-bold text-[#F8FAFC] mt-0.5">SMC Order Block Scanner</h4>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[8px] font-mono bg-[#8B5CF6]/10 text-[#A78BFA] border border-[#8B5CF6]/20">5M INTERVAL</span>
                  </div>

                  {/* Visual Candlesticks */}
                  <div className="w-full h-32 flex items-end justify-between px-2 relative mt-4">
                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none py-2">
                      {[1,2,3,4].map(i => <div key={i} className="border-b border-white/[0.02] w-full" />)}
                    </div>
                    <div className="flex items-center justify-around w-full h-full pt-6 z-10">
                      <div className="flex flex-col items-center justify-end h-full w-4">
                        <div className="w-0.5 h-12 bg-[#10B981]" />
                        <div className="w-2.5 h-16 bg-[#10B981]/80 rounded-sm" />
                      </div>
                      <div className="flex flex-col items-center justify-end h-full w-4">
                        <div className="w-0.5 h-16 bg-[#10B981]" />
                        <div className="w-2.5 h-8 bg-[#10B981]/80 rounded-sm" />
                      </div>
                      <div className="flex flex-col items-center justify-end h-full w-4">
                        <div className="w-0.5 h-20 bg-[#EF4444]" />
                        <div className="w-2.5 h-12 bg-[#EF4444]/80 rounded-sm" />
                      </div>
                      <div className="flex flex-col items-center justify-end h-full w-4">
                        <div className="w-0.5 h-10 bg-[#10B981]" />
                        <div className="w-2.5 h-20 bg-[#10B981]/80 rounded-sm" />
                      </div>
                      <div className="flex flex-col items-center justify-end h-full w-4">
                        <div className="w-0.5 h-24 bg-[#8B5CF6]" />
                        <div className="w-2.5 h-12 bg-[#8B5CF6]/80 rounded-sm shadow-[0_0_12px_rgba(139,92,246,0.3)]" />
                      </div>
                    </div>
                    
                    {/* Animated Line Drawing */}
                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 300 128" fill="none">
                      <path className="animate-draw" d="M 20 95 Q 80 75 140 85 T 260 28" stroke="#6366F1" strokeWidth="2" fill="none" />
                      <circle className="animate-dot fill-violet-400" r="3" />
                    </svg>
                  </div>
                </div>

                {/* Panel 3: AI Review pane */}
                <div className="md:col-span-1 rounded-[16px] bg-white/[0.02] border border-white/[0.04] p-3 flex flex-col justify-between">
                  <div className="space-y-2.5">
                    <div className="text-[10px] font-bold tracking-widest text-[#94A3B8] uppercase font-mono flex items-center justify-between">
                      <span>AI COPILOT FEED</span>
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#8B5CF6] opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#8B5CF6]"></span>
                      </span>
                    </div>
                    <div className={`p-2.5 rounded-lg text-[10px] leading-normal transition-all duration-500 border ${
                      aiFeeds[activeFeedIdx].bg
                    } ${feedGlow ? 'shadow-[0_0_15px_rgba(139,92,246,0.15)] scale-[0.99] border-[#8B5CF6]/30' : ''}`}>
                      <span className={`font-bold block mb-0.5 ${aiFeeds[activeFeedIdx].color} flex items-center gap-1.5`}>
                        {aiFeeds[activeFeedIdx].title}
                      </span>
                      <p className="text-slate-300">{aiFeeds[activeFeedIdx].body}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-[#10B981]/5 border border-[#10B981]/10 text-[10px] text-[#10B981] leading-normal">
                      <span className="font-bold text-[#F8FAFC] block mb-0.5">✅ Risk Check</span>
                      R:R Optimized. Drawdown limit metrics protected.
                    </div>
                  </div>
                  <div className="pt-2 border-t border-white/[0.04] flex items-center">
                    <input type="text" placeholder="Ask AI Copilot..." disabled className="bg-white/5 border border-white/[0.08] rounded px-2 py-1 text-[9px] w-full text-[#94A3B8]" />
                  </div>
                </div>

              </div>
            </div>
            {/* Soft atmospheric glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[200px] rounded-full bg-[#8B5CF6]/5 blur-[100px] pointer-events-none -z-10" />
          </motion.div>

        </div>
      </div>

      {/* ── 4. COMPLETE ECOSYSTEM SECTION (UNIFIED HEIGHT CARDS) ── */}
      <div id="product" className="max-w-5xl mx-auto px-4 space-y-12 anchor-offset">
        <div className="text-center space-y-3">
          <div className="font-mono tracking-[0.25em] text-[11px] uppercase text-[#A78BFA]">
            PLATFORM ARCHITECTURE
          </div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-[#F8FAFC]">
            A Complete Trading <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#8B5CF6] to-[#6366F1]">Intelligence Ecosystem</span>
          </h2>
          <p className="text-sm text-[#94A3B8] max-w-xl mx-auto leading-relaxed">
            FinAI Edge integrates data research, algorithmic filters, mathematical models, 
            disciplined journaling, and real-time AI guidance into a single OS.
          </p>
        </div>

        {/* Bento Grid with min-height alignments */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Card 1: Markets (Colspan: 2 on MD) */}
          <Link href="/markets" className="glass-card p-6 flex flex-col justify-between min-h-[300px] md:col-span-2 group/card" style={{ textDecoration: 'none' }}>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 h-full items-stretch">
              {/* Left Column (Info) */}
              <div className="md:col-span-3 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-500/10 border border-blue-500/20 text-blue-400">
                      <Globe className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#F8FAFC]">Markets Monitor</h3>
                      <span className="text-[9px] font-mono text-blue-400 tracking-wider">REAL-TIME DATA</span>
                    </div>
                  </div>
                  <p className="text-xs text-[#94A3B8] leading-relaxed">
                    Live market pulse, sector heatmap overlays, breakout momentum indexes, and risk volatility tracking powered by live WebSockets.
                  </p>
                </div>
                
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {["Market Pulse", "Heatmap", "Trend Analyzer", "Risk Analytics"].map(f => (
                    <span key={f} className="px-2 py-0.5 rounded text-[9px] font-medium bg-white/[0.02] border border-white/[0.06] text-slate-400">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
              
              {/* Right Column (Mini Live Ticker Widget) */}
              <div className="md:col-span-2 rounded-xl bg-black/40 border border-white/[0.04] p-3 flex flex-col justify-between space-y-2 font-mono">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-1.5 text-[9px] text-slate-500 uppercase tracking-wider font-bold">
                  <span>INDEX</span>
                  <span>PRICE</span>
                  <span>CHANGE</span>
                </div>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between p-1.5 rounded bg-white/[0.01]">
                    <span className="text-slate-300 font-bold">SPY</span>
                    <span className="text-slate-400">$542.10</span>
                    <span className="text-emerald-400 font-bold">+1.24%</span>
                  </div>
                  <div className="flex items-center justify-between p-1.5 rounded bg-white/[0.01]">
                    <span className="text-slate-300 font-bold">QQQ</span>
                    <span className="text-slate-400">$478.50</span>
                    <span className="text-emerald-400 font-bold">+2.10%</span>
                  </div>
                  <div className="flex items-center justify-between p-1.5 rounded bg-white/[0.01]">
                    <span className="text-slate-300 font-bold">IWM</span>
                    <span className="text-slate-400">$201.30</span>
                    <span className="text-red-400 font-bold">-0.45%</span>
                  </div>
                </div>
                <div className="text-[8px] text-[#10B981] flex items-center gap-1.5 justify-end mt-1 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                  LIVE WEB_FEED ACTIVE
                </div>
              </div>
            </div>
          </Link>

          {/* Card 2: Screener */}
          <Link href="/screener" className="glass-card p-6 flex flex-col justify-between min-h-[300px] md:col-span-1 group/card" style={{ textDecoration: 'none' }}>
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <ScanLine className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#F8FAFC]">SMC Screener</h3>
                    <span className="text-[9px] font-mono text-emerald-400 tracking-wider">SCANNER LAB</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[8px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">LIVE SCAN</span>
              </div>
              <p className="text-xs text-[#94A3B8] leading-relaxed">
                Filter stocks based on standard indicators, Smart Money Concept demand zones, fair value gaps, and breakout volumes.
              </p>
            </div>

            {/* Mini Screener Feed Widget */}
            <div className="rounded-xl bg-black/40 border border-white/[0.04] p-3 space-y-2 mt-4 font-mono text-[10px]">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-1 text-slate-500 font-bold">
                <span>TICKER</span>
                <span>PATTERN</span>
                <span>STATUS</span>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="font-bold">AAPL</span>
                  <span className="text-slate-400">Bullish FVG</span>
                  <span className="text-[#10B981] flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-[#10B981] animate-ping" />
                    LIVE
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="font-bold">TSLA</span>
                  <span className="text-slate-400">Order Block</span>
                  <span className="text-violet-400">TRIGGERED</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="font-bold">NVDA</span>
                  <span className="text-slate-400">Liquidity Sweep</span>
                  <span className="text-slate-500">PENDING</span>
                </div>
              </div>
            </div>
          </Link>

          {/* Card 3: Portfolio */}
          <Link href="/portfolio" className="glass-card p-6 flex flex-col justify-between min-h-[300px] md:col-span-1 group/card" style={{ textDecoration: 'none' }}>
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-violet-500/10 border border-violet-500/20 text-violet-400">
                    <Briefcase className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#F8FAFC]">Portfolio</h3>
                    <span className="text-[9px] font-mono text-violet-400 tracking-wider">MPT & AI ENGINE</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[8px] font-mono bg-violet-500/10 text-violet-400 border border-violet-500/20">OPTIMIZER</span>
              </div>
              <p className="text-xs text-[#94A3B8] leading-relaxed">
                Optimize weight allocation utilizing Modern Portfolio Theory, analyze asset metrics, and build personalized portfolios with AI.
              </p>
            </div>

            {/* Mini Portfolio Weight Allocation Widget */}
            <div className="rounded-xl bg-black/40 border border-white/[0.04] p-3 space-y-2.5 mt-4 font-mono text-[10px]">
              <div className="flex items-center justify-between text-slate-500 font-bold border-b border-white/[0.06] pb-1">
                <span>WEIGHTS</span>
                <span>SHARPE: 2.85</span>
              </div>
              <div className="space-y-2">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[9px] text-slate-300">
                    <span>NVDA (42%)</span>
                    <span>AAPL (35%)</span>
                    <span>MSFT (23%)</span>
                  </div>
                  {/* Stacked allocation bar */}
                  <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden flex">
                    <div className="h-full bg-violet-500" style={{ width: "42%" }} />
                    <div className="h-full bg-indigo-500" style={{ width: "35%" }} />
                    <div className="h-full bg-blue-500" style={{ width: "23%" }} />
                  </div>
                </div>
                <div className="text-[8px] text-slate-500 text-right uppercase">
                  Markowitz Frontier Active
                </div>
              </div>
            </div>
          </Link>

          {/* Card 4: Workspace (Colspan: 2 on MD) */}
          <Link href="/journal" className="glass-card p-6 flex flex-col justify-between min-h-[300px] md:col-span-2 group/card" style={{ textDecoration: 'none' }}>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 h-full items-stretch">
              {/* Left Column (Info) */}
              <div className="md:col-span-3 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-500/10 border border-amber-500/20 text-amber-400">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#F8FAFC]">Execution Workspace</h3>
                      <span className="text-[9px] font-mono text-amber-400 tracking-wider">CORE UTILITIES</span>
                    </div>
                  </div>
                  <p className="text-xs text-[#94A3B8] leading-relaxed">
                    A highly-disciplined, local-first trading journal, detailed performance tables, win-rate metrics, and emotional state logs.
                  </p>
                </div>
                
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {["Journal", "Performance Analytics", "Drawdown Tracker", "Expectancy Curve"].map(f => (
                    <span key={f} className="px-2 py-0.5 rounded text-[9px] font-medium bg-white/[0.02] border border-white/[0.06] text-slate-400">
                      {f}
                    </span>
                  ))}
                </div>
              </div>

              {/* Right Column (Mini Journal Log Table) */}
              <div className="md:col-span-2 rounded-xl bg-black/40 border border-white/[0.04] p-3 flex flex-col justify-between space-y-2 font-mono">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-1.5 text-[9px] text-slate-500 uppercase tracking-wider font-bold">
                  <span>ASSET</span>
                  <span>R:R SCALE</span>
                  <span>OUTCOME</span>
                </div>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between p-1.5 rounded bg-white/[0.01]">
                    <span className="text-slate-300 font-bold">BTCUSD</span>
                    <span className="text-slate-400">1 : 3.5 Ratio</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">WIN</span>
                  </div>
                  <div className="flex items-center justify-between p-1.5 rounded bg-white/[0.01]">
                    <span className="text-slate-300 font-bold">EURUSD</span>
                    <span className="text-slate-400">1 : 2.0 Ratio</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] bg-red-500/10 text-red-400 border border-red-500/20 font-bold">LOSS</span>
                  </div>
                  <div className="flex items-center justify-between p-1.5 rounded bg-white/[0.01]">
                    <span className="text-slate-300 font-bold">GBPUSD</span>
                    <span className="text-slate-400">1 : 3.0 Ratio</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">WIN</span>
                  </div>
                </div>
                <div className="text-[8px] text-[#A78BFA] text-right font-bold">
                  LOCAL SECURE SQLite STORAGE
                </div>
              </div>
            </div>
          </Link>

          {/* Card 5: AI Copilot (Colspan: 3 on MD - Flagship Highlight) */}
          <Link href="/ai-copilot" className="glass-card p-8 flex flex-col justify-between relative overflow-hidden md:col-span-3 border-[#8B5CF6]/20 bg-gradient-to-br from-[#0B1020] to-[#121829] shadow-[0_0_30px_rgba(139,92,246,0.08)] group/card" style={{ textDecoration: 'none' }}>
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-violet-600/5 blur-3xl pointer-events-none -z-10" />
            
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-center">
              
              {/* Left Column (Info) */}
              <div className="md:col-span-3 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-pink-500/10 border border-pink-500/20 text-pink-400 shadow-[0_0_16px_rgba(236,72,153,0.1)]">
                      <Sparkles className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-100">AI Cognitive Copilot</h3>
                      <span className="text-[10px] font-mono text-pink-400 tracking-wider">GEMINI AI COACHING SYSTEM</span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Personalized cognitive coaching powered by advanced Gemini AI. Auto-flags emotional revenge biases, validates trade setup rules, and conducts statistical expectancy diagnostics.
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {["Biases Scanner", "Interactive Coaching", "Rule Auditing", "Expectancy Diagnostics"].map(f => (
                    <span key={f} className="px-2.5 py-0.5 rounded-full text-[9px] font-semibold bg-pink-500/5 border border-pink-500/10 text-pink-300">
                      {f}
                    </span>
                  ))}
                </div>
              </div>

              {/* Right Column (Mini UI Chat Box Overlay) */}
              <div className="md:col-span-2 rounded-2xl border border-[#8B5CF6]/20 bg-[#0B1020]/90 p-4 space-y-3 shadow-[0_4px_30px_rgba(139,92,246,0.05)] text-[10px] font-sans">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <div className="flex items-center gap-1.5 font-mono text-[9px] text-slate-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-ping" />
                    <span>COGNITIVE REVIEW SESSION</span>
                  </div>
                </div>
                <div className="space-y-2.5 max-h-[140px] overflow-y-auto">
                  <div className="space-y-1">
                    <div className="text-[8px] font-mono uppercase text-slate-500 font-bold">TRADER</div>
                    <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.04] text-slate-300">
                      Why did I lose on the EURUSD short setup today?
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[8px] font-mono uppercase text-pink-400 font-bold">GEMINI COACH</div>
                    <div className="p-2 rounded-lg bg-[#8B5CF6]/5 border border-[#8B5CF6]/10 text-pink-300 leading-normal">
                      You shorted directly inside a high-volume demand zone. Scanner flags FOMO bias; entry violated rule 3 (wait for mitigation).
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </Link>

        </div>
      </div>

      {/* ── 5. WHY FINAI EDGE SECTION ── */}
      <div className="max-w-5xl mx-auto px-4 space-y-12">
        <div className="text-center space-y-3">
          <div className="font-mono tracking-[0.25em] text-[11px] uppercase text-[#A78BFA]">
            WHY FINAI EDGE
          </div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-[#F8FAFC]">
            Engineered for <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#8B5CF6] to-[#6366F1]">Capital Preservation</span>
          </h2>
          <p className="text-sm text-[#94A3B8] max-w-xl mx-auto leading-relaxed">
            Professional operators require structured pipelines. Here is how FinAI Edge structures your performance cycle.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          
          {/* Step 1: Research */}
          <div className="glass-card p-8 space-y-4 relative flex flex-col justify-between">
            <div className="space-y-4">
              <div className="text-[10px] font-mono tracking-widest text-[#8B5CF6] font-bold">01 / DISCOVERY</div>
              <h3 className="text-lg font-bold text-[#F8FAFC]">Research Opportunities</h3>
              <p className="text-xs text-[#94A3B8] leading-relaxed">
                Scan multiple assets simultaneously using fair value gaps, order block zones, and technical filter structures to identify institutional footprints before placing capital.
              </p>
            </div>
            <div className="h-1 bg-[#8B5CF6]/20 rounded-full overflow-hidden mt-4">
              <div className="h-full bg-[#8B5CF6] w-1/3" />
            </div>
          </div>

          {/* Step 2: Analyze */}
          <div className="glass-card p-8 space-y-4 relative flex flex-col justify-between">
            <div className="space-y-4">
              <div className="text-[10px] font-mono tracking-widest text-[#8B5CF6] font-bold">02 / LOGGING</div>
              <h3 className="text-lg font-bold text-[#F8FAFC]">Analyze Executions</h3>
              <p className="text-xs text-[#94A3B8] leading-relaxed">
                Log trades through a structured 9-step wizard tracking execution timeframes, strategy compliance, session volume indexes, and cognitive mindsets.
              </p>
            </div>
            <div className="h-1 bg-[#8B5CF6]/20 rounded-full overflow-hidden mt-4">
              <div className="h-full bg-[#8B5CF6] w-2/3" />
            </div>
          </div>

          {/* Step 3: Improve */}
          <div className="glass-card p-8 space-y-4 relative flex flex-col justify-between">
            <div className="space-y-4">
              <div className="text-[10px] font-mono tracking-widest text-[#8B5CF6] font-bold">03 / EVOLUTION</div>
              <h3 className="text-lg font-bold text-[#F8FAFC]">Refine &amp; Improve</h3>
              <p className="text-xs text-[#94A3B8] leading-relaxed">
                Let the Gemini AI coach extract psychological risk leaks, review setup guidelines, flag emotional chasers, and optimize statistical expectancy math.
              </p>
            </div>
            <div className="h-1 bg-[#8B5CF6]/20 rounded-full overflow-hidden mt-4">
              <div className="h-full bg-gradient-to-r from-[#8B5CF6] to-[#6366F1] w-full" />
            </div>
          </div>

        </div>
      </div>

      {/* ── 6. PRODUCT SHOWCASE SECTION WITH ACTIVE SHIFT ── */}
      <div id="platform" className="max-w-5xl mx-auto px-4 space-y-12 anchor-offset">
        <div className="text-center space-y-3">
          <div className="font-mono tracking-[0.25em] text-[11px] uppercase text-[#A78BFA]">
            PLATFORM DECK
          </div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-[#F8FAFC]">
            Interactive <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#8B5CF6] to-[#6366F1]">Module Walkthrough</span>
          </h2>
          <p className="text-sm text-[#94A3B8] max-w-xl mx-auto leading-relaxed">
            Click on any module to review high-fidelity interfaces and see how the OS performs.
          </p>
        </div>

        {/* Interactive Layout */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-stretch">
          
          {/* Vertical Menu Tabs */}
          <div className="md:col-span-1 flex flex-col gap-2">
            {[
              { id: "markets", label: "Markets Monitor", icon: Globe, badge: "LIVE DATA" },
              { id: "screener", label: "SMC Scanner", icon: ScanLine, badge: "ACTIVE" },
              { id: "portfolio", label: "Portfolio Optimizer", icon: Briefcase, badge: "RUNNING" },
              { id: "workspace", label: "Execution Journal", icon: BookOpen, badge: "CORE" },
              { id: "ai-copilot", label: "Gemini AI Copilot", icon: Sparkles, badge: "AI PRO" }
            ].map(tab => {
              const active = activeShowcase === tab.id;
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveShowcase(tab.id)}
                  className={`flex flex-col items-start p-4 rounded-xl text-left border transition-all duration-300 relative overflow-hidden ${
                    active 
                      ? 'bg-[#0B1120] border-[#8B5CF6]/40 shadow-[0_0_16px_rgba(139,92,246,0.1)] text-[#F8FAFC]' 
                      : 'bg-[#030712]/30 border-white/[0.04] text-[#94A3B8] hover:bg-white/[0.02] hover:border-white/[0.08]'
                  }`}
                >
                  {active && <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#8B5CF6]" />}
                  <div className="flex items-center gap-2">
                    <TabIcon className={`w-4 h-4 ${active ? 'text-[#8B5CF6]' : 'text-slate-500'}`} />
                    <span className="text-xs font-bold">{tab.label}</span>
                  </div>
                  <span className={`text-[8px] font-mono tracking-wider mt-1 px-1.5 py-0.5 rounded ${
                    active ? 'bg-[#8B5CF6]/10 text-[#A78BFA]' : 'bg-white/5 text-slate-500'
                  }`}>{tab.badge}</span>
                </button>
              );
            })}
          </div>

          {/* Large Visual Display Container (Uses Key to trigger animation) */}
          <div key={activeShowcase} className="md:col-span-3 rounded-[24px] border border-white/[0.08] bg-[#0B1120]/40 p-6 flex flex-col justify-between min-h-[320px] relative overflow-hidden shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] animate-showcaseShift">
            
            {/* Ambient Background glow */}
            <div className="absolute -bottom-16 -right-16 w-48 h-48 rounded-full bg-[#8B5CF6]/5 blur-3xl pointer-events-none" />

            {/* Markets showcase content */}
            {activeShowcase === "markets" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
                  <h4 className="text-sm font-bold text-slate-200">Sector Performance Heatmap Overview</h4>
                  <span className="text-[10px] text-[#10B981] font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                    Live WebSockets
                  </span>
                </div>
                <p className="text-xs text-[#94A3B8] leading-relaxed">
                  Analyze sector rotations in real-time. Spot capital flowing into Technology and Energy sectors using multi-timeframe breakout indicators.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                  {[
                    { label: "Technology", val: "+2.45%", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
                    { label: "Financials", val: "+0.92%", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
                    { label: "Energy", val: "-1.15%", color: "bg-red-500/10 text-red-400 border-red-500/20" },
                    { label: "Healthcare", val: "+0.15%", color: "bg-white/5 text-slate-400 border-white/10" }
                  ].map(sec => (
                    <div key={sec.label} className={`p-3 rounded-xl border text-center ${sec.color}`}>
                      <div className="text-[10px] font-bold">{sec.label}</div>
                      <div className="text-xs font-bold font-mono mt-1">{sec.val}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Screener showcase content */}
            {activeShowcase === "screener" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
                  <h4 className="text-sm font-bold text-slate-200">Algorithmic SMC Breakout Scanner</h4>
                  <span className="text-[9px] font-mono text-amber-400 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">TESTED</span>
                </div>
                <p className="text-xs text-[#94A3B8] leading-relaxed">
                  Track institutional footprint scanners natively. The engine highlights Breaks of Structure (BOS), Changes of Character (CHOCH), and mitigations automatically.
                </p>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] border border-white/[0.04] text-[10px]">
                    <span className="font-bold text-[#F8FAFC]">AAPL (5M Interval)</span>
                    <span className="text-emerald-400 font-mono">BOS DETECTED (Bullish)</span>
                    <span className="text-slate-500 font-mono">MITIGATED</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] border border-white/[0.04] text-[10px]">
                    <span className="font-bold text-[#F8FAFC]">NVDA (15M Interval)</span>
                    <span className="text-indigo-400 font-mono">CHOCH DETECTED (Bullish)</span>
                    <span className="text-emerald-400 font-mono">OPEN LIMIT</span>
                  </div>
                </div>
              </div>
            )}

            {/* Portfolio showcase content */}
            {activeShowcase === "portfolio" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
                  <h4 className="text-sm font-bold text-slate-200">Modern Portfolio Theory Optimizer</h4>
                  <span className="text-[10px] text-[#A78BFA] font-mono">Sharpe Ratio: 2.85</span>
                </div>
                <p className="text-xs text-[#94A3B8] leading-relaxed">
                  Run mathematical covariance algorithms. The system calculates the efficient frontier model automatically, optimizing return matrices relative to risk variance.
                </p>
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-2">
                  <div className="text-[9px] font-bold text-slate-400 font-mono">OPTIMAL WEIGHT ALLOCATION</div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-8 text-[9px] font-mono text-slate-400">NVDA</span>
                      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-[#8B5CF6]" style={{ width: "42%" }} />
                      </div>
                      <span className="text-[9px] font-mono text-slate-400">42%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-8 text-[9px] font-mono text-slate-400">AAPL</span>
                      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-[#6366F1]" style={{ width: "35%" }} />
                      </div>
                      <span className="text-[9px] font-mono text-slate-400">35%</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Workspace showcase content */}
            {activeShowcase === "workspace" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
                  <h4 className="text-sm font-bold text-slate-200">Performance Log Wizard</h4>
                  <span className="text-[9px] font-mono text-slate-500">Local-First DB</span>
                </div>
                <p className="text-xs text-[#94A3B8] leading-relaxed">
                  Log trades with zero friction. Fill in strategy compliance rules, target R:R scales, session ranges, and psychological triggers for deep performance auditing.
                </p>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className="p-2 rounded-lg bg-white/[0.01] border border-white/[0.04] flex justify-between">
                    <span className="text-slate-500">Strategy Setup</span>
                    <span className="font-bold text-[#F8FAFC]">SMC Liquidity Sweep</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white/[0.01] border border-white/[0.04] flex justify-between">
                    <span className="text-slate-500">Target R:R Scale</span>
                    <span className="font-bold text-[#10B981]">1 : 3.5 Ratio</span>
                  </div>
                </div>
              </div>
            )}

            {/* AI Copilot showcase content */}
            {activeShowcase === "ai-copilot" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
                  <h4 className="text-sm font-bold text-slate-200">Gemini Behavioral Auditing Panel</h4>
                  <span className="text-[9px] font-mono text-pink-400 bg-pink-500/10 border border-pink-500/20 px-2 py-0.5 rounded">AI READY</span>
                </div>
                <p className="text-xs text-[#94A3B8] leading-relaxed">
                  Chat directly with your data. The AI Copilot detects execution mistakes, flags psychological revenge patterns, and answers strategy mechanics queries.
                </p>
                <div className="p-2.5 rounded-lg bg-[#8B5CF6]/5 border border-[#8B5CF6]/10 text-[10px] text-[#A78BFA] leading-normal space-y-1">
                  <div className="font-bold text-[#F8FAFC]">🤖 AI Performance Insight:</div>
                  <p>
                    "Review of your last 10 NVDA executions suggests a win rate drawdown when trading the NY Session Open. Consider adjusting entries to after 10:00 AM EST to allow initial volatility ranges to settle."
                  </p>
                </div>
              </div>
            )}

            {/* Bottom links */}
            <div className="pt-4 border-t border-white/[0.04] flex items-center justify-between text-[11px] text-[#94A3B8]">
              <span className="font-mono">FINTECHAI ENGINE v1.2</span>
              <motion.div whileTap={{ scale: 0.97 }} transition={{ duration: 0.12, ease: 'easeOut' }} className="inline-flex">
                <Link href="/auth?mode=signin" onClick={handleAuthNavigation('/auth?mode=signin')} className="flex items-center gap-1 text-[#8B5CF6] hover:text-[#A78BFA] transition-colors font-semibold">
                  Explore Module <ChevronRight className="w-3 h-3" />
                </Link>
              </motion.div>
            </div>

          </div>

        </div>
      </div>

      {/* ── 7. TESTIMONIALS MARQUEE SECTION (OUTCOME FOCUSED) ── */}
      <div id="testimonials" className="space-y-12 overflow-hidden anchor-offset">
        <div className="text-center max-w-3xl mx-auto px-4">
          <div className="font-mono tracking-[0.25em] text-[11px] uppercase text-[#A78BFA] mb-3">
            PROVEN EDGE
          </div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-[#F8FAFC]">
            Trusted by <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#8B5CF6] to-[#6366F1]">Serious Traders</span>
          </h2>
          <p className="text-sm text-[#94A3B8] mt-2 leading-relaxed">
            See how active market participants utilize FinAI Edge to refine executions, optimize risk, and scale capital.
          </p>
        </div>

        {/* Marquee Row */}
        <div className="relative w-full overflow-hidden py-4">
          {/* Alpha Fade overlays on left/right sides */}
          <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#030712] to-transparent z-10 pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#030712] to-transparent z-10 pointer-events-none" />
          
          <div className="animate-marquee gap-4 px-4">
            {[...TESTIMONIALS, ...TESTIMONIALS].map((t, idx) => (
              <div key={idx} className="w-[320px] md:w-[380px] flex-shrink-0 rounded-[24px] border border-white/[0.08] bg-[#0B1120]/60 p-6 flex flex-col justify-between space-y-4 hover:border-[#8B5CF6]/30 hover:shadow-[0_0_24px_rgba(139,92,246,0.05)] transition-all duration-300">
                {/* Rating & Quote */}
                <div className="space-y-3">
                  <div className="flex gap-0.5">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <span key={i} className="text-amber-400 text-xs">★</span>
                    ))}
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-semibold">
                    "{t.quote}"
                  </p>
                </div>

                {/* User details */}
                <div className="flex items-center gap-3 pt-2 border-t border-white/[0.04]">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br from-[#8B5CF6] to-[#6366F1]">
                    {t.avatar}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">{t.name}</h4>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">{t.role} • <span className="text-[#8B5CF6]">{t.style}</span></p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 8. PRICING SECTION ── */}
      <div id="pricing" className="max-w-5xl mx-auto px-4 space-y-12 anchor-offset">
        <div className="text-center space-y-3">
          <div className="font-mono tracking-[0.25em] text-[11px] uppercase text-[#A78BFA]">
            TRANSPARENT PRICING
          </div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-[#F8FAFC]">
            Simple Plans built for <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#8B5CF6] to-[#6366F1]">Serious Growth</span>
          </h2>
          <p className="text-sm text-[#94A3B8] max-w-xl mx-auto leading-relaxed">
            Choose the edge level that matches your capital footprint. All data stored securely.
          </p>
        </div>

        {/* Pricing Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          
          {/* Starter Card */}
          <div className="rounded-[24px] border border-white/[0.08] bg-[#0B1120]/40 p-8 flex flex-col justify-between hover:border-white/10 transition-colors">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-[#F8FAFC]">Starter</h3>
                <p className="text-xs text-[#94A3B8] mt-1">Perfect for starting your disciplined trading journey.</p>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-white">$0</span>
                <span className="text-xs text-slate-500 font-mono">/ FOREVER</span>
              </div>
              <div className="h-px bg-white/[0.05]" />
              <ul className="space-y-3">
                {[
                  "100% Local-first data storage",
                  "Standard 9-step trade journal",
                  "Basic analytics & performance metrics",
                  "Manual trade entry logs"
                ].map(bullet => (
                  <li key={bullet} className="flex items-center gap-2.5 text-xs text-slate-400">
                    <CheckCircle2 className="w-4 h-4 text-slate-600 flex-shrink-0" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
            <motion.div whileTap={{ scale: 0.97 }} transition={{ duration: 0.12, ease: 'easeOut' }}>
              <Link href="/auth?mode=signin" onClick={handleAuthNavigation('/auth?mode=signin')} className="mt-8 w-full block text-center py-3 rounded-full text-xs font-semibold bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all" style={{ height: '48px', lineHeight: '48px', padding: '0' }}>
                Sign In
              </Link>
            </motion.div>
          </div>

          {/* Pro Card (RECOMMENDED - Highlighted with LightBeamButton) */}
          <div className="rounded-[24px] border border-[#8B5CF6]/30 bg-[#0B1120] p-8 flex flex-col justify-between hover:border-[#8B5CF6]/50 hover:shadow-[0_0_32px_rgba(139,92,246,0.1)] transition-all duration-300 relative shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
            <div className="absolute top-0 right-8 -translate-y-1/2 bg-[#8B5CF6] text-white font-mono text-[9px] font-bold px-3 py-1 rounded-full tracking-wider shadow-[0_0_12px_rgba(139,92,246,0.4)]">
              RECOMMENDED
            </div>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-[#F8FAFC]">Pro</h3>
                <p className="text-xs text-[#94A3B8] mt-1">For active traders seeking data edge and AI review.</p>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-white">$49</span>
                <span className="text-xs text-slate-400 font-mono">/ MONTH</span>
              </div>
              <div className="h-px bg-white/[0.08]" />
              <ul className="space-y-3">
                {[
                  "Everything in Starter plan",
                  "Live Market data & Sector heatmaps",
                  "SMC & FVG breakout scanners",
                  "Gemini AI Trade Review & Chat",
                  "MT5 broker auto-sync",
                  "Advanced psychological mistake audits"
                ].map(bullet => (
                  <li key={bullet} className="flex items-center gap-2.5 text-xs text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-[#8B5CF6] flex-shrink-0" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
            <LightBeamButton href="/auth?mode=signin" onClick={handleAuthNavigation('/auth?mode=signin')} className="mt-8 w-full">
              Upgrade to Pro
            </LightBeamButton>
          </div>

          {/* Elite Card */}
          <div className="rounded-[24px] border border-white/[0.08] bg-[#0B1120]/40 p-8 flex flex-col justify-between hover:border-white/10 transition-colors">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-[#F8FAFC]">Elite</h3>
                <p className="text-xs text-[#94A3B8] mt-1">Designed for systematic researchers and prop operators.</p>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-white">$99</span>
                <span className="text-xs text-slate-500 font-mono">/ MONTH</span>
              </div>
              <div className="h-px bg-white/[0.05]" />
              <ul className="space-y-3">
                {[
                  "Everything in Pro plan",
                  "Quant strategy lab backtesting",
                  "Modern Portfolio Optimizer (MPT)",
                  "Multi-account correlation matrix",
                  "Custom scanning conditions",
                  "Premium low-latency API feed"
                ].map(bullet => (
                  <li key={bullet} className="flex items-center gap-2.5 text-xs text-slate-400">
                    <CheckCircle2 className="w-4 h-4 text-slate-600 flex-shrink-0" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
            <motion.div whileTap={{ scale: 0.97 }} transition={{ duration: 0.12, ease: 'easeOut' }}>
              <Link href="/auth?mode=signin" onClick={handleAuthNavigation('/auth?mode=signin')} className="mt-8 w-full block text-center py-3 rounded-full text-xs font-semibold bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all" style={{ height: '48px', lineHeight: '48px', padding: '0' }}>
                Join Elite Tier
              </Link>
            </motion.div>
          </div>

        </div>
      </div>

      {/* ── 9. ROADMAP SECTION WITH VERTICAL CONNECTORS ── */}
      <div id="roadmap" className="max-w-4xl mx-auto px-4 space-y-12 anchor-offset">
        <div className="text-center space-y-3">
          <div className="font-mono tracking-[0.25em] text-[11px] uppercase text-[#A78BFA]">
            ROADMAP
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-[#F8FAFC]">Upcoming Features</h2>
          <p className="text-sm text-[#94A3B8] mt-2 max-w-lg mx-auto leading-relaxed">
            We are actively expanding the FinAI Edge operating system capabilities. Here is what is currently planned.
          </p>
        </div>

        {/* Timeline container */}
        <div className="relative pl-8 md:pl-16 space-y-8">
          
          {/* Vertical line connector */}
          <div className="absolute left-4 md:left-[35px] top-2 bottom-2 w-[2px] bg-gradient-to-b from-[#8B5CF6] via-[#6366F1] to-transparent pointer-events-none -z-10" />

          {UPCOMING.map((f, i) => {
            const tagStyle = TAG_COLORS[f.tag] ?? { bg: "rgba(99,102,241,0.1)", text: "#a5b4fc" };
            return (
              <div key={f.title} className="relative animate-fadeUp" style={{ animationDelay: `${i * 80}ms` }}>
                {/* Node indicator */}
                <div className="absolute -left-[28px] md:-left-[41px] top-7 w-6 h-6 rounded-full bg-[#030712] border-[3px] border-[#8B5CF6] flex items-center justify-center z-20">
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                </div>
                
                <div className="glass-card p-6 relative overflow-hidden flex flex-col justify-between">
                  
                  {/* Glow system indicator */}
                  <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-[0.03] blur-2xl pointer-events-none"
                    style={{ background: f.color }} />

                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${f.color}18`, border: `1px solid ${f.color}30` }}>
                      <f.icon className="w-5 h-5" style={{ color: f.color }} />
                    </div>
                    <span className="text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider font-mono"
                      style={{ background: tagStyle.bg, color: tagStyle.text }}>
                      {f.tag}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-[#F8FAFC]">{f.title}</h3>
                    <p className="text-xs text-[#94A3B8] leading-relaxed mt-1">{f.desc}</p>
                  </div>

                  <ul className="space-y-1.5">
                    {f.bullets.map(b => (
                      <li key={b} className="flex items-center gap-2 text-xs text-[#94A3B8]">
                        <CheckCircle2 className="w-3 h-3 flex-shrink-0" style={{ color: f.color }} />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-4 pt-3 border-t border-white/[0.04] flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                  <Lock className="w-3 h-3" />
                  <span>Not yet available</span>
                </div>
              </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 10. FINAL CTA SECTION (EMOTIONAL FINISH) ── */}
      <div className="max-w-4xl mx-auto px-4 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full bg-[#8B5CF6]/5 blur-[80px] pointer-events-none -z-10" />
        
        <div className="rounded-[24px] border border-white/[0.08] bg-[#0B1120] p-12 text-center space-y-6 shadow-[0_12px_40px_rgba(0,0,0,0.5),_inset_0_1px_0_0_rgba(255,255,255,0.05)]">
          <div className="flex items-center justify-center gap-2 text-xs font-semibold text-[#A78BFA] font-mono tracking-wider">
            <Shield className="w-4 h-4 text-[#8B5CF6]" />
            <span>100% Local — Your data never leaves your device</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#F8FAFC] tracking-tight leading-tight max-w-2xl mx-auto">
            Your Edge Isn't Another Indicator. <br />
            It's <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#8B5CF6] to-[#6366F1]">Intelligence</span>.
          </h2>
          <p className="text-sm text-[#94A3B8] max-w-lg mx-auto">
            Trade with structure. Not emotion. Get started in minutes.
          </p>
          <div className="pt-2">
            <LightBeamButton href="/journal">
              Sign In <ArrowRight className="w-4 h-4" />
            </LightBeamButton>
          </div>
        </div>
      </div>

      {/* ── 11. MINIMALIST FOOTER SECTION (CONDENSED) ── */}
      <footer className="border-t border-white/[0.08] bg-[#030712] pt-16 pb-8 text-xs text-[#94A3B8]">
        <div className="max-w-5xl mx-auto px-4 space-y-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-gradient-to-br from-[#8B5CF6] to-[#6366F1]">
                <BrainCircuit className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-bold text-[#F8FAFC]">FinAI Edge</span>
            </div>
            
            <div className="flex items-center gap-6 font-mono text-[10px] tracking-wider uppercase text-slate-500">
              <Link href="#product" className="hover:text-[#F8FAFC] transition-colors">Product</Link>
              <Link href="#platform" className="hover:text-[#F8FAFC] transition-colors">Platform</Link>
              <Link href="#pricing" className="hover:text-[#F8FAFC] transition-colors">Pricing</Link>
              <Link href="#roadmap" className="hover:text-[#F8FAFC] transition-colors">Roadmap</Link>
              <Link href="#testimonials" className="hover:text-[#F8FAFC] transition-colors">Testimonials</Link>
            </div>
          </div>
          
          <div className="h-px bg-white/[0.05]" />
          
          <div className="flex flex-col md:flex-row justify-between gap-4 text-[10px] text-slate-500">
            <span>&copy; {new Date().getFullYear()} FinAI Edge. All rights reserved.</span>
            <div className="flex gap-4">
              <span className="cursor-default">Local storage secure</span>
              <span className="cursor-default">No account tracking data</span>
            </div>
          </div>

          <div className="text-[9.5px] text-slate-600 leading-normal max-w-4xl text-center md:text-left">
            Risk Warning: Trading financial instruments involves substantial risk of loss and is not suitable for every investor. FinAI Edge generates statistical audits and behavioral reviews for systematic execution coaching, which should not be construed as investment advice.
          </div>
        </div>
      </footer>

    </div>
  );
}
