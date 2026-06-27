'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, TrendingUp, TrendingDown, Globe, Clock, ShieldAlert,
  Flame, Sparkles, AlertCircle, Info, ChevronRight, Check, X,
  Building, RefreshCw, BarChart2, DollarSign, Calendar, Eye
} from 'lucide-react';
import { cn } from '@/lib/utils';
// @ts-ignore
import DottedMap from 'dotted-map';
import Image from 'next/image';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES & SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────
interface RiskNode {
  id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  risk: 'normal' | 'elevated' | 'high';
  label: string;
  desc: string;
  shape: 'circle' | 'triangle' | 'square' | 'nuclear';
}

interface CrossAsset {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  risk: number;
  sparkline: number[];
}

// Animation helpers
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, delay, ease: 'easeOut' as const } },
});

// ─────────────────────────────────────────────────────────────────────────────
// SHARED UI COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
function GlassCard({ children, className, hover = true, glowColor }: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  glowColor?: string;
}) {
  return (
    <div className={cn(
      'rounded-2xl border border-white/[0.07] p-5',
      'bg-[rgba(7,11,22,0.75)] backdrop-blur-md relative overflow-hidden',
      'transition-all duration-300',
      hover && 'hover:-translate-y-[2px] hover:border-purple-500/20 hover:shadow-[0_10px_40px_rgba(124,92,255,0.07)]',
      glowColor && hover && `hover:shadow-[0_10px_40px_${glowColor}]`,
      className
    )}>
      {children}
    </div>
  );
}

function SectionHeader({ title, icon: Icon, gradient = 'from-purple-500 to-indigo-600', live }: {
  title: string;
  icon: any;
  gradient?: string;
  live?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className={`w-0.5 h-4 rounded-full bg-gradient-to-b ${gradient} flex-shrink-0`} />
      <Icon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
      <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{title}</h2>
      <div className="flex-1 h-px bg-gradient-to-r from-white/[0.04] to-transparent" />
      {live && (
        <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-400 uppercase tracking-wider flex-shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Live
        </span>
      )}
    </div>
  );
}

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const h = 22, w = 50;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 2)}`).join(' ');
  const color = positive ? '#22c55e' : '#ef4444';
  const id = `sp-${Math.random().toString(36).substring(2, 6)}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="flex-shrink-0">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#${id})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function MacroIntel() {
  // 1. UTC Clock State
  const [utcTime, setUtcTime] = useState<string>('00:00:00 UTC');
  
  // 2. Map overlay checklist selections
  const [overlays, setOverlays] = useState({
    intelHotspots: true,
    conflictZones: true,
    militaryBases: true,
    nuclearSites: false,
    gammaIrradiators: false,
    spaceports: false,
    underseaCables: false,
    pipelines: false,
    aiDataCenters: false,
    militaryActivity: true,
    shipTraffic: true,
  });

  // 3. Highlighted geopolitical details (Map selection state)
  const [selectedNode, setSelectedNode] = useState<RiskNode | null>({
    id: 'taiwan',
    name: 'Taiwan Strait Semiconductor Foundries',
    type: 'Semiconductor Hub',
    lat: 24.783,
    lng: 120.979,
    risk: 'high',
    label: 'Taiwan',
    desc: 'Critical semiconductor manufacturing cluster. Heavy monitoring of supply chain disruption probabilities. Threat of embargo or production stoppage directly impacts the global technology equity index (SOXX, NDX).',
    shape: 'square'
  });

  // 4. Interactive hover tooltips
  const [hoveredNode, setHoveredNode] = useState<RiskNode | null>(null);

  // 5. Cross Asset State (Dynamic Price updates every 4 seconds)
  const [assets, setAssets] = useState<CrossAsset[]>([
    { symbol: 'SPX', name: 'S&P 500 Index', price: 5431.12, change: 24.50, changePct: 0.45, risk: 38, sparkline: [5400, 5410, 5408, 5420, 5422, 5431] },
    { symbol: 'NDX', name: 'NASDAQ 100', price: 19680.45, change: 142.10, changePct: 0.73, risk: 42, sparkline: [19500, 19560, 19520, 19610, 19630, 19680] },
    { symbol: 'VIX', name: 'CBOE Volatility', price: 12.85, change: -0.42, changePct: -3.16, risk: 25, sparkline: [13.4, 13.2, 13.1, 13.0, 12.95, 12.85] },
    { symbol: 'DXY', name: 'US Dollar Index', price: 104.22, change: 0.15, changePct: 0.14, risk: 28, sparkline: [104.05, 104.10, 104.08, 104.15, 104.20, 104.22] },
    { symbol: 'US10Y', name: 'US 10Y Yield', price: 4.215, change: -0.012, changePct: -0.28, risk: 31, sparkline: [4.24, 4.23, 4.22, 4.218, 4.212, 4.215] },
    { symbol: 'BTC', name: 'Bitcoin / USD', price: 65420.50, change: 840.10, changePct: 1.30, risk: 65, sparkline: [64200, 64600, 64500, 65100, 65050, 65420] },
    { symbol: 'GOLD', name: 'Spot Gold XAU', price: 2321.40, change: 12.80, changePct: 0.55, risk: 20, sparkline: [2305, 2310, 2308, 2318, 2315, 2321] },
    { symbol: 'OIL', name: 'Brent Crude Oil', price: 81.15, change: -0.85, changePct: -1.04, risk: 42, sparkline: [82.2, 82.0, 81.8, 81.4, 81.5, 81.15] },
    { symbol: 'SILVER', name: 'Spot Silver XAG', price: 29.45, change: 0.22, changePct: 0.75, risk: 34, sparkline: [29.1, 29.2, 29.15, 29.3, 29.35, 29.45] },
    { symbol: 'ETH', name: 'Ethereum / USD', price: 3480.20, change: 35.40, changePct: 1.03, risk: 58, sparkline: [3410, 3440, 3435, 3460, 3455, 3480] },
  ]);

  // Set up UTC clock and dynamic asset prices fluctuation
  useEffect(() => {
    const clockTimer = setInterval(() => {
      const d = new Date();
      const utcStr = d.toUTCString().replace('GMT', 'UTC').split(' ')[4];
      setUtcTime(`${utcStr} UTC`);
    }, 1000);

    const priceTimer = setInterval(() => {
      setAssets((prev) =>
        prev.map((a) => {
          // Fluctuate price by -0.08% to +0.08%
          const pct = (Math.random() * 0.16 - 0.08) / 100;
          const oldPrice = a.price;
          const newPrice = +(oldPrice * (1 + pct)).toFixed(a.symbol === 'US10Y' ? 3 : 2);
          const diff = +(newPrice - oldPrice).toFixed(a.symbol === 'US10Y' ? 3 : 2);
          const newChange = +(a.change + diff).toFixed(2);
          const newChangePct = +((newChange / (newPrice - newChange)) * 100).toFixed(2);
          
          // Rotate sparkline data
          const newSpark = [...a.sparkline.slice(1), newPrice];

          return {
            ...a,
            price: newPrice,
            change: newChange,
            changePct: newChangePct,
            sparkline: newSpark
          };
        })
      );
    }, 4000);

    return () => {
      clearInterval(clockTimer);
      clearInterval(priceTimer);
    };
  }, []);

  // 6. Generate the Dotted World Map SVG
  const map = useMemo(() => new DottedMap({ height: 95, grid: 'diagonal' }), []);
  const svgMap = useMemo(() => {
    return map.getSVG({
      radius: 0.20,
      color: 'rgba(255, 255, 255, 0.06)',
      shape: 'circle',
      backgroundColor: '#050816',
    });
  }, [map]);

  // Map projection helper to view coordinates (800 x 400 space)
  const projectPoint = (lat: number, lng: number) => {
    const x = (lng + 180) * (800 / 360);
    const y = (90 - lat) * (400 / 180);
    return { x, y };
  };

  // Compile active nodes from overlays checkboxes
  const activeNodes = useMemo(() => {
    const list: RiskNode[] = [];
    if (overlays.intelHotspots) {
      list.push(
        { id: 'taiwan', name: 'Taiwan Strait Semiconductor Foundries', type: 'Semiconductor Hub', lat: 24.783, lng: 120.979, risk: 'high', label: 'Taiwan', desc: 'Critical semiconductor manufacturing cluster. Heavy monitoring of supply chain disruption probabilities. Threat of embargo or production stoppage directly impacts the global technology equity index (SOXX, NDX).', shape: 'square' },
        { id: 'middle_east', name: 'Middle East Regional Proxy Grid', type: 'Geopolitical Grid', lat: 29.189, lng: 50.234, risk: 'elevated', label: 'Middle East', desc: 'Proxy tension hotspots and regional defense postures. Drone activities and trade blockades monitor active.', shape: 'circle' }
      );
    }
    if (overlays.conflictZones) {
      list.push(
        { id: 'ukraine', name: 'Ukraine Geopolitical Conflict Corridor', type: 'Conflict Corridor', lat: 48.379, lng: 31.165, risk: 'high', label: 'Ukraine', desc: 'Kinetic conflict territory with strategic ramifications for European power routing, agricultural exports, and EU security grids.', shape: 'circle' }
      );
    }
    if (overlays.militaryBases) {
      list.push(
        { id: 'guam', name: 'Guam Strategic Outpost', type: 'Military Base', lat: 13.444, lng: 144.793, risk: 'normal', label: 'Guam', desc: 'Strategic US military installation monitoring air patrol routes and Western Pacific navigation safety.', shape: 'triangle' },
        { id: 'okinawa', name: 'Okinawa Naval Garrison', type: 'Military Base', lat: 26.312, lng: 127.779, risk: 'normal', label: 'Okinawa', desc: 'Regional naval logistics node maintaining patrol support fleets and satellite telemetry arrays.', shape: 'triangle' }
      );
    }
    if (overlays.nuclearSites) {
      list.push(
        { id: 'zaporizhzhia', name: 'Zaporizhzhia Nuclear Grid', type: 'Nuclear Site', lat: 47.511, lng: 34.586, risk: 'high', label: 'ZNPP', desc: 'Large scale nuclear power infrastructure monitoring status. High safety focus to prevent collateral supply shifts.', shape: 'nuclear' }
      );
    }
    if (overlays.gammaIrradiators) {
      list.push(
        { id: 'svalbard_uplink', name: 'Svalbard Polar Telemetry Uplink', type: 'Satellite Station', lat: 78.223, lng: 15.646, risk: 'elevated', label: 'Svalbard Uplink', desc: 'Polar ground uplink installations backing crucial satellite connectivity grids. Vulnerable to undersea infrastructure damage.', shape: 'nuclear' }
      );
    }
    if (overlays.spaceports) {
      list.push(
        { id: 'kourou', name: 'Guiana Orbital Launch Centre', type: 'Spaceport', lat: 5.237, lng: -52.76, risk: 'normal', label: 'Kourou Spaceport', desc: 'Institutional satellite orbital insertion facility operating normally under standard logistics operations.', shape: 'triangle' }
      );
    }
    if (overlays.underseaCables) {
      list.push(
        { id: 'baltic_cables', name: 'Baltic Undersea Fiber Backbone', type: 'Undersea Telecoms', lat: 57.0, lng: 20.0, risk: 'elevated', label: 'Baltic fiber', desc: 'Fibre infrastructure transmitting key communication relays. Enhanced maritime watch active.', shape: 'circle' }
      );
    }
    if (overlays.pipelines) {
      list.push(
        { id: 'nord_stream', name: 'Nord Stream Supply Paths', type: 'Energy Pipeline', lat: 55.5, lng: 15.5, risk: 'elevated', label: 'Nord Stream', desc: 'Subsea transit route structures monitored under regional energy infrastructure security policies.', shape: 'circle' }
      );
    }
    if (overlays.aiDataCenters) {
      list.push(
        { id: 'ashburn', name: 'US East Hyper-scale Computing Grid', type: 'AI Datacenter Hub', lat: 39.043, lng: -77.487, risk: 'normal', label: 'Ashburn AI', desc: 'Critical dense concentration of hyper-scale server farms hosting neural networks. Power requirements create structural energy demand.', shape: 'square' },
        { id: 'dublin', name: 'Dublin Data Cluster', type: 'AI Datacenter Hub', lat: 53.349, lng: -6.26, risk: 'normal', label: 'Dublin AI', desc: 'European hosting infrastructure. Subsea optical conduits link here to support financial cloud computation.', shape: 'square' }
      );
    }
    if (overlays.militaryActivity) {
      list.push(
        { id: 'red_sea_mil', name: 'Naval Coalition Defense Fleet', type: 'Military Force', lat: 15.0, lng: 42.0, risk: 'high', label: 'Taskforce Fleet', desc: 'Escort fleets patrolling Bab-el-Mandeb to secure merchant logistics from asymmetric attack cycles.', shape: 'triangle' }
      );
    }
    if (overlays.shipTraffic) {
      list.push(
        { id: 'malacca_strait', name: 'Malacca Strait Tanker Corridor', type: 'Shipping Choke', lat: 2.5, lng: 101.5, risk: 'normal', label: 'Malacca Choke', desc: 'Indo-Pacific crude maritime corridor. Shipping levels normal with active counter-piracy patrols.', shape: 'circle' },
        { id: 'bab_el_mandeb', name: 'Bab-el-Mandeb Shipping Corridor', type: 'Shipping Choke', lat: 12.8, lng: 43.2, risk: 'high', label: 'Red Sea Transit', desc: 'Vessels detour around Cape of Good Hope, adding 10-14 days to Asia-Europe routes. Container spot rates elevated.', shape: 'circle' }
      );
    }
    return list;
  }, [overlays]);

  // Calculate current computed risk levels based on visible high/elevated alerts
  const computedDefcon = useMemo(() => {
    const highCount = activeNodes.filter(n => n.risk === 'high').length;
    const elevatedCount = activeNodes.filter(n => n.risk === 'elevated').length;
    if (highCount >= 3) return { level: 3, label: 'ELEVATED RISK', color: 'text-red-400 border-red-500/20 bg-red-500/5' };
    if (highCount >= 1 || elevatedCount >= 2) return { level: 4, label: 'MODERATE RISK', color: 'text-amber-400 border-amber-500/20 bg-amber-500/5' };
    return { level: 5, label: 'STANDARD OPERATION', color: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5' };
  }, [activeNodes]);

  return (
    <div className="min-h-screen bg-[#050816] text-white font-sans px-4 md:px-8 py-6 space-y-6 overflow-x-hidden selection:bg-purple-500/30 selection:text-purple-200">
      
      {/* ───────────────────────────────────────────────────────────────────────
          HEADER HERO & STATUS BAR
          ─────────────────────────────────────────────────────────────────────── */}
      <motion.div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/[0.06] pb-6" {...fadeUp(0)}>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">Flagship Intelligence</span>
            <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-purple-400 bg-clip-text text-transparent">
            Macro Intel Command
          </h1>
          <p className="text-slate-400 text-xs md:text-sm max-w-xl">
            Situational awareness engine analyzing geopolitics, central banks, commodities, currencies and structural risk events.
          </p>
        </div>

        {/* Bloomberg / Palantir style live dashboard status strip */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-[rgba(10,14,25,0.7)] border border-white/[0.06] px-3.5 py-1.5 rounded-xl backdrop-blur-md text-[11px] font-mono shadow-md">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-200 font-bold tabular-nums">{utcTime}</span>
          </div>

          <div className={cn(
            'flex items-center gap-2 border px-3.5 py-1.5 rounded-xl backdrop-blur-md text-[11px] font-bold shadow-md transition-colors duration-300',
            computedDefcon.color
          )}>
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current" />
            </span>
            <span>POSTURE: DEFCON {computedDefcon.level} ({computedDefcon.label})</span>
          </div>

          <button
            onClick={() => setOverlays({
              intelHotspots: true,
              conflictZones: true,
              militaryBases: true,
              nuclearSites: false,
              gammaIrradiators: false,
              spaceports: false,
              underseaCables: false,
              pipelines: false,
              aiDataCenters: false,
              militaryActivity: true,
              shipTraffic: true,
            })}
            className="flex items-center gap-1.5 bg-purple-500/10 border border-purple-500/20 px-3.5 py-1.5 rounded-xl text-[11px] font-bold text-purple-300 hover:bg-purple-500/20 active:scale-95 transition-all shadow-md"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            RESET GRID
          </button>
        </div>
      </motion.div>

      {/* ───────────────────────────────────────────────────────────────────────
          HERO ROW: GLOBAL RISK MAP & STRATEGIC POSTURE ENGINE
          ─────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Global Risk Map (Hero Left, col-span-8) */}
        <motion.div className="lg:col-span-8 space-y-4" {...fadeUp(0.05)}>
          <GlassCard hover={false} className="p-0 border-white/[0.07] overflow-hidden flex flex-col min-h-[520px]">
            {/* Map Header */}
            <div className="p-5 border-b border-white/[0.06] flex items-center justify-between bg-black/25">
              <SectionHeader title="Global Risk Map (Hero Section)" icon={Globe} live />
              
              <div className="text-[10px] text-slate-500 font-mono flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded bg-purple-500/30" />
                <span>Geographic Intel Projections</span>
              </div>
            </div>

            {/* Map Body Content */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-12 relative min-h-[360px]">
              
              {/* Checkbox Sidebar Overlay (col-span-3) */}
              <div className="md:col-span-3 border-r border-white/[0.06] p-4 space-y-3 bg-black/20 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="text-[9px] font-extrabold uppercase text-slate-500 tracking-wider mb-2 font-mono">
                    Situation Layers
                  </div>

                  <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
                    {(Object.keys(overlays) as Array<keyof typeof overlays>).map((key) => {
                      const formattedLabel = key
                        .replace(/([A-Z])/g, ' $1')
                        .replace(/^./, (str) => str.toUpperCase());
                      
                      const checked = overlays[key];

                      return (
                        <label
                          key={key}
                          className={cn(
                            'flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-[10px] font-semibold cursor-pointer select-none transition-all duration-200',
                            checked
                              ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400 shadow-[inset_0_1px_4px_rgba(16,185,129,0.05)]'
                              : 'bg-white/[0.01] border-white/[0.04] text-slate-400 hover:bg-white/[0.03] hover:text-slate-200'
                          )}
                        >
                          <span>{formattedLabel}</span>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => setOverlays(p => ({ ...p, [key]: !p[key] }))}
                              className="sr-only"
                            />
                            <div className={cn(
                              'w-3.5 h-3.5 rounded flex items-center justify-center border transition-all duration-150',
                              checked ? 'bg-emerald-500 border-emerald-400 text-black' : 'border-slate-600'
                            )}>
                              {checked && <Check className="w-2.5 h-2.5 stroke-[4px]" />}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-3 border-t border-white/[0.04] text-[9px] text-slate-500 leading-normal font-mono">
                  Toggle overlays to instantly compile and project strategic risk coordinates.
                </div>
              </div>

              {/* Map View Frame (col-span-9) */}
              <div className="md:col-span-9 relative flex items-center justify-center p-3 bg-slate-950/20">
                {/* SVG Dotted Map Background */}
                <div className="w-full relative aspect-[2/1] bg-[#050816] rounded-xl overflow-hidden border border-white/[0.03] shadow-inner">
                  <Image
                    src={`data:image/svg+xml;utf8,${encodeURIComponent(svgMap)}`}
                    className="h-full w-full [mask-image:linear-gradient(to_bottom,transparent,white_10%,white_90%,transparent)] pointer-events-none select-none object-cover opacity-60"
                    alt="World monitor dotted base"
                    height="400"
                    width="800"
                    draggable={false}
                    priority
                  />

                  {/* Active SVG interactive risk nodes layer */}
                  <svg
                    viewBox="0 0 800 400"
                    className="w-full h-full absolute inset-0 pointer-events-auto select-none z-10"
                    preserveAspectRatio="xMidYMid meet"
                  >
                    <defs>
                      <filter id="glow-red">
                        <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                        <feMerge>
                          <feMergeNode in="coloredBlur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                      <filter id="glow-orange">
                        <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                        <feMerge>
                          <feMergeNode in="coloredBlur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>

                    {activeNodes.map((node) => {
                      const { x, y } = projectPoint(node.lat, node.lng);
                      const color = node.risk === 'high' ? '#EF4444' : node.risk === 'elevated' ? '#F59E0B' : '#10B981';
                      const isSelected = selectedNode?.id === node.id;

                      return (
                        <g
                          key={node.id}
                          className="cursor-pointer pointer-events-auto"
                          onClick={() => setSelectedNode(node)}
                          onMouseEnter={() => setHoveredNode(node)}
                          onMouseLeave={() => setHoveredNode(null)}
                        >
                          {/* Pulsing ring underneath */}
                          <circle
                            cx={x}
                            cy={y}
                            r={isSelected ? 10 : 7}
                            fill={color}
                            opacity={isSelected ? 0.35 : 0.2}
                          >
                            <animate
                              attributeName="r"
                              from={isSelected ? 9 : 6}
                              to={isSelected ? 20 : 15}
                              dur="2.5s"
                              repeatCount="indefinite"
                            />
                            <animate
                              attributeName="opacity"
                              from="0.5"
                              to="0"
                              dur="2.5s"
                              repeatCount="indefinite"
                            />
                          </circle>

                          {/* Specific icon structures based on shapes */}
                          {node.shape === 'triangle' ? (
                            <polygon
                              points={`${x},${y - 6} ${x - 5.5},${y + 4} ${x + 5.5},${y + 4}`}
                              fill={color}
                              stroke="#000"
                              strokeWidth="1"
                              filter={node.risk === 'high' ? 'url(#glow-red)' : node.risk === 'elevated' ? 'url(#glow-orange)' : undefined}
                            />
                          ) : node.shape === 'square' ? (
                            <rect
                              x={x - 4.5}
                              y={y - 4.5}
                              width={9}
                              height={9}
                              fill={color}
                              stroke="#000"
                              strokeWidth="1"
                              filter={node.risk === 'high' ? 'url(#glow-red)' : node.risk === 'elevated' ? 'url(#glow-orange)' : undefined}
                            />
                          ) : node.shape === 'nuclear' ? (
                            <g>
                              <circle cx={x} cy={y} r="4.5" fill={color} stroke="#000" strokeWidth="0.75" />
                              <line x1={x - 6.5} y1={y} x2={x + 6.5} y2={y} stroke={color} strokeWidth="1.2" />
                              <line x1={x} y1={y - 6.5} x2={x} y2={y + 6.5} stroke={color} strokeWidth="1.2" />
                            </g>
                          ) : (
                            <circle
                              cx={x}
                              cy={y}
                              r={isSelected ? 5.5 : 4.5}
                              fill={color}
                              stroke="#000"
                              strokeWidth="1"
                              filter={node.risk === 'high' ? 'url(#glow-red)' : node.risk === 'elevated' ? 'url(#glow-orange)' : undefined}
                            />
                          )}

                          {/* Selected node halo */}
                          {isSelected && (
                            <circle
                              cx={x}
                              cy={y}
                              r="9"
                              fill="none"
                              stroke={color}
                              strokeWidth="1.25"
                              strokeDasharray="2, 2"
                            />
                          )}
                        </g>
                      );
                    })}
                  </svg>

                  {/* Hover node tooltip */}
                  <AnimatePresence>
                    {hoveredNode && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.15, ease: 'easeOut' as const }}
                        className="absolute bg-[#090e1f]/95 border border-white/[0.1] rounded-xl p-3 shadow-2xl backdrop-blur-md z-30 max-w-[220px] pointer-events-none"
                        style={{
                          left: `${Math.min(projectPoint(hoveredNode.lat, hoveredNode.lng).x / 800 * 100, 75)}%`,
                          top: `${Math.min(projectPoint(hoveredNode.lat, hoveredNode.lng).y / 400 * 100, 70)}%`
                        }}
                      >
                        <div className="flex items-center justify-between gap-2 border-b border-white/[0.05] pb-1.5 mb-1.5">
                          <span className="text-[10px] font-bold text-white uppercase truncate">{hoveredNode.label}</span>
                          <span className={cn(
                            'text-[8px] font-bold px-1.5 py-0.5 rounded border tracking-wide uppercase',
                            hoveredNode.risk === 'high' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                            hoveredNode.risk === 'elevated' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                            'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          )}>
                            {hoveredNode.risk}
                          </span>
                        </div>
                        <div className="text-[9px] text-slate-400 font-mono leading-relaxed">
                          {hoveredNode.name}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Floating legend at bottom center of map container */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#090e1a]/90 border border-white/[0.06] rounded-xl px-4 py-2 backdrop-blur-md z-20 flex items-center gap-4 text-[9px] font-mono text-slate-400 select-none shadow-lg">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#EF4444] animate-pulse" />
                    <span>High Alert</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#F59E0B] animate-pulse" />
                    <span>Elevated</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                    <span>Monitoring</span>
                  </div>
                  <div className="h-3 w-px bg-white/[0.1]" />
                  <div className="flex items-center gap-1.5">
                    <span className="w-0.5 h-0.5 bg-slate-400" />
                    <span>▲ Base</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-0.5 h-0.5 bg-slate-400" />
                    <span>■ Datacenter</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-0.5 h-0.5 bg-slate-400" />
                    <span>◈ Strategic Sites</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Selected Node Details Box (Bloomberg detailed layout bottom) */}
            <div className="p-4 border-t border-white/[0.06] bg-black/15 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Active Coordinate Focus:</span>
                  {selectedNode && (
                    <span className={cn(
                      'text-[9px] font-extrabold px-2 py-0.5 rounded border uppercase',
                      selectedNode.risk === 'high' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                      selectedNode.risk === 'elevated' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                      'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    )}>
                      {selectedNode.type} — {selectedNode.risk} risk
                    </span>
                  )}
                </div>
                {selectedNode ? (
                  <h3 className="text-[13px] font-bold text-white tracking-wide">{selectedNode.name}</h3>
                ) : (
                  <h3 className="text-[13px] font-bold text-slate-500">Select a map coordinate to scope intel</h3>
                )}
              </div>

              {selectedNode && (
                <div className="text-[10px] text-slate-400 max-w-xl bg-purple-500/5 border border-purple-500/10 rounded-xl p-3 flex-1">
                  {selectedNode.desc}
                </div>
              )}
            </div>
          </GlassCard>
        </motion.div>

        {/* Strategic Posture Engine (Hero Right, col-span-4) */}
        <motion.div className="lg:col-span-4" {...fadeUp(0.1)}>
          <GlassCard hover={false} className="h-full flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              <SectionHeader title="Strategic Posture Engine" icon={ShieldAlert} />
              
              {/* DEFCON military visual mode */}
              <div className="bg-black/35 border border-white/[0.05] rounded-2xl p-4 flex flex-col items-center justify-center relative overflow-hidden shadow-inner">
                {/* Background grid visual effect */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(139,92,246,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(139,92,246,0.03)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />

                <span className="text-[9px] uppercase font-bold tracking-widest text-purple-400 mb-1.5 font-mono">Capital Regime Threat Matrix</span>
                
                {/* Large regime output badge */}
                <div className="text-3xl font-black tracking-tighter text-red-500 font-mono text-center flex flex-col items-center gap-1">
                  <span>RISK OFF</span>
                  <span className="text-[10px] font-semibold text-slate-400 tracking-wide mt-1 uppercase">Confidence Level: 83%</span>
                </div>

                {/* Animated status ring */}
                <div className="mt-4 flex items-center justify-center relative">
                  <div className="w-20 h-20 rounded-full border-2 border-red-500/20 border-t-red-500 animate-spin" />
                  <div className="absolute inset-2 rounded-full border border-dashed border-red-500/30 flex items-center justify-center">
                    <span className="text-xs font-mono font-black text-red-400">DEFCON 4</span>
                  </div>
                </div>
              </div>

              {/* Driver checklists showing how they support the regime */}
              <div className="space-y-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Posture Regime Drivers:</div>
                
                <div className="grid grid-cols-2 gap-2 font-mono">
                  {[
                    { label: 'VIX Spikes', active: true, desc: 'VIX > 15.5' },
                    { label: 'Dollar Surge', active: true, desc: 'DXY > 104' },
                    { label: 'Bonds Outflow', active: false, desc: 'Yields stable' },
                    { label: 'Oil Deficit', active: true, desc: 'Inventory drops' },
                    { label: 'Geopolitics Alert', active: true, desc: 'Red Sea threats' },
                    { label: 'Market Breadth', active: false, desc: 'Narrow leaders' }
                  ].map((drv, i) => (
                    <div
                      key={i}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-xl border text-[10px] font-medium transition-all duration-200',
                        drv.active
                          ? 'bg-red-500/5 border-red-500/20 text-red-400'
                          : 'bg-white/[0.01] border-white/[0.04] text-slate-500'
                      )}
                    >
                      {drv.active ? (
                        <Check className="w-3.5 h-3.5 stroke-[3px] text-red-500 flex-shrink-0" />
                      ) : (
                        <X className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                      )}
                      <div>
                        <div className="font-bold">{drv.label}</div>
                        <div className="text-[8px] text-slate-500 mt-0.5">{drv.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-purple-500/5 border border-purple-500/10 rounded-2xl p-3.5 text-[10px] leading-relaxed text-slate-400 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-purple-300 font-bold block mb-1">Outlook Regime Transition:</strong>
                Capital allocation suggests elevated protective buying in yields and safe-havens, leading to high correlation pressures across equity index assets.
              </div>
            </div>
          </GlassCard>
        </motion.div>

      </div>

      {/* ───────────────────────────────────────────────────────────────────────
          SECTION 2: GLOBAL RISK SCORE
          ─────────────────────────────────────────────────────────────────────── */}
      <motion.div className="space-y-3" {...fadeUp(0.15)}>
        <SectionHeader title="Global Risk Score Meters" icon={Activity} />

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Geopolitical Risk', score: 67, trend: '+4%', level: 'Elevated', color: 'text-amber-400', progressColor: 'bg-amber-500' },
            { label: 'Oil Disruption Risk', score: 42, trend: '-2%', level: 'Moderate', color: 'text-yellow-400', progressColor: 'bg-yellow-500' },
            { label: 'Inflation Pressure', score: 55, trend: '+1%', level: 'Elevated', color: 'text-amber-400', progressColor: 'bg-amber-500' },
            { label: 'Liquidity Stress', score: 31, trend: '-0.5%', level: 'Stable', color: 'text-emerald-400', progressColor: 'bg-emerald-500' },
            { label: 'Currency Stress', score: 48, trend: '+3%', level: 'Moderate', color: 'text-yellow-400', progressColor: 'bg-yellow-500' },
            { label: 'AI Confidence Index', score: 81, trend: '+5%', level: 'Optimal', color: 'text-purple-400', progressColor: 'bg-purple-500' },
          ].map((item, idx) => (
            <GlassCard key={idx} className="space-y-4 hover:shadow-[0_10px_30px_rgba(139,92,246,0.05)] border-white/[0.06]">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide truncate">{item.label}</span>
                <span className="text-[9px] font-mono text-slate-500">{item.trend}</span>
              </div>

              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-black font-mono tracking-tight">{item.score}</span>
                <span className={cn('text-[9px] font-bold uppercase tracking-wider', item.color)}>{item.level}</span>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 w-full bg-white/[0.04] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${item.score}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' as const }}
                  className={cn('h-full rounded-full', item.progressColor)}
                />
              </div>
            </GlassCard>
          ))}
        </div>
      </motion.div>

      {/* ───────────────────────────────────────────────────────────────────────
          MIDDLE SECTION: NEWS WIRE, COUNTRY INSTABILITY, CROSS ASSET
          ─────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        {/* AI Macro News Radar (col-span-1) */}
        <motion.div {...fadeUp(0.2)}>
          <GlassCard hover={false} className="h-full space-y-4 flex flex-col justify-between">
            <div className="space-y-3 flex-1">
              <div className="flex items-center justify-between">
                <SectionHeader title="AI Macro News Radar" icon={Flame} live />
                <span className="text-[8px] font-mono text-slate-500 uppercase">Updates via Tavily AI</span>
              </div>

              <div className="space-y-3 divide-y divide-white/[0.05]">
                {[
                  {
                    cat: 'FED',
                    title: 'FOMC minutes suggest two rate cuts priced by Q4.',
                    impact: 'HIGH',
                    conf: '89%',
                    desc: 'Officials support cautious cooling metrics over rigid hikes.'
                  },
                  {
                    cat: 'OIL',
                    title: 'Brent crude weakens after US inventory build.',
                    impact: 'MEDIUM',
                    conf: '76%',
                    desc: 'EIA reports unexpected reserves accumulation of 2.1M barrels.'
                  },
                  {
                    cat: 'CHINA',
                    title: 'Property stimulus package announced in Beijing.',
                    impact: 'HIGH',
                    conf: '84%',
                    desc: 'PBOC issues special liquidity injection bonds to local banks.'
                  },
                  {
                    cat: 'BOJ',
                    title: 'Bank of Japan hints at policy normalization schedule.',
                    impact: 'MEDIUM',
                    conf: '71%',
                    desc: 'Bond purchase reductions targeted for Q3 launch cycles.'
                  }
                ].map((news, i) => (
                  <div key={i} className={cn('pt-3 first:pt-0 space-y-1.5')}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold font-mono tracking-widest text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">
                          {news.cat}
                        </span>
                        <span className={cn(
                          'text-[8px] font-extrabold px-1.5 py-0.5 rounded tracking-wide border',
                          news.impact === 'HIGH' ? 'bg-red-500/15 border-red-500/20 text-red-400' : 'bg-amber-500/15 border-amber-500/20 text-amber-400'
                        )}>
                          IMPACT: {news.impact}
                        </span>
                      </div>
                      <span className="text-[9px] font-mono text-slate-500">Conf: {news.conf}</span>
                    </div>

                    <h4 className="text-[11.5px] font-bold text-white tracking-wide leading-snug">
                      {news.title}
                    </h4>
                    <p className="text-[10px] text-slate-400 leading-normal">
                      {news.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-white/[0.06] text-[9.5px] text-purple-300 font-mono flex items-center justify-between">
              <span>Aggregation cycle active</span>
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping" />
            </div>
          </GlassCard>
        </motion.div>

        {/* Country Instability Index (col-span-1) */}
        <motion.div {...fadeUp(0.25)}>
          <GlassCard hover={false} className="h-full space-y-4">
            <SectionHeader title="Country Instability Index" icon={BarChart2} />

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[9px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                    <th className="pb-2">Country</th>
                    <th className="pb-2 text-center">Score</th>
                    <th className="pb-2 text-center">Trend</th>
                    <th className="pb-2 text-right">Stress Sub-scores</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04] text-[11px] font-medium font-mono">
                  {[
                    { name: 'Iran', score: 86, trend: '+16', color: 'text-red-400', u: 100, s: 50, i: 80 },
                    { name: 'Ukraine', score: 82, trend: '+15', color: 'text-red-400', u: 96, s: 50, i: 44 },
                    { name: 'Russia', score: 73, trend: '+24', color: 'text-red-400', u: 70, s: 50, i: 80 },
                    { name: 'China', score: 75, trend: '+22', color: 'text-red-400', u: 70, s: 50, i: 90 },
                    { name: 'Taiwan', score: 68, trend: '+10', color: 'text-amber-400', u: 30, s: 10, i: 20 },
                    { name: 'South Korea', score: 31, trend: '-2', color: 'text-emerald-400', u: 25, s: 5, i: 15 },
                    { name: 'Japan', score: 24, trend: '-1', color: 'text-emerald-400', u: 10, s: 0, i: 18 },
                    { name: 'India', score: 18, trend: '+2', color: 'text-emerald-400', u: 15, s: 0, i: 10 },
                    { name: 'USA', score: 12, trend: '-3', color: 'text-emerald-400', u: 20, s: 0, i: 8 },
                  ].map((country, idx) => {
                    const isHigh = country.score >= 70;
                    const isElevated = country.score >= 40 && country.score < 70;
                    return (
                      <tr key={idx} className="group hover:bg-white/[0.02] transition-colors">
                        <td className="py-2.5 font-bold text-white">{country.name}</td>
                        <td className="py-2.5 text-center">
                          <span className={cn(
                            'font-bold px-1.5 py-0.5 rounded text-[10px]',
                            isHigh ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                            isElevated ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                            'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          )}>
                            {country.score}
                          </span>
                        </td>
                        <td className={cn('py-2.5 text-center font-bold text-[10px]', country.trend.startsWith('+') ? 'text-red-400' : 'text-emerald-400')}>
                          {country.trend}
                        </td>
                        <td className="py-2.5 text-right text-[9px] text-slate-500 group-hover:text-slate-300 transition-colors">
                          U:{country.u} S:{country.s} I:{country.i}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </motion.div>

        {/* Cross Asset Monitor (col-span-1) */}
        <motion.div {...fadeUp(0.3)}>
          <GlassCard hover={false} className="h-full space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <SectionHeader title="Cross Asset Monitor" icon={Globe} live />
                <span className="text-[8px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded animate-pulse">TICKS ACTIVE</span>
              </div>

              <div className="grid grid-cols-1 gap-2.5 max-h-[360px] overflow-y-auto pr-1 scrollbar-thin">
                {assets.map((asset) => {
                  const positive = asset.change >= 0;
                  return (
                    <div
                      key={asset.symbol}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/[0.07] transition-all font-mono"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-black text-white">{asset.symbol}</span>
                          <span className="text-[8px] text-slate-500 truncate max-w-[80px]">{asset.name}</span>
                        </div>
                        <div className="text-[9px] text-slate-400">
                          Risk Index: <span className={cn('font-bold', asset.risk > 50 ? 'text-red-400' : 'text-slate-300')}>{asset.risk}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Sparkline data={asset.sparkline} positive={positive} />

                        <div className="text-right">
                          <div className="text-[11.5px] font-bold text-white tabular-nums">
                            {asset.price.toLocaleString(undefined, { minimumFractionDigits: asset.symbol === 'US10Y' ? 3 : 2 })}
                          </div>
                          <div className={cn('text-[9px] font-bold tabular-nums', positive ? 'text-emerald-400' : 'text-red-400')}>
                            {positive ? '+' : ''}{asset.changePct.toFixed(2)}%
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 text-[9px] text-slate-500 leading-normal border-t border-white/[0.06] font-mono">
              Frictional fluctuations computed directly from global indices pipelines.
            </div>
          </GlassCard>
        </motion.div>

      </div>

      {/* ───────────────────────────────────────────────────────────────────────
          BOTTOM SECTION: MACRO HEAT ENGINE & CRITICAL EVENTS TIMELINE
          ─────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Macro Heat Engine (Capital Flow Paths, col-span-1) */}
        <motion.div {...fadeUp(0.35)}>
          <GlassCard hover={false} className="space-y-4">
            <SectionHeader title="Macro Heat Engine (Capital Flow)" icon={Activity} />
            <div className="text-[10px] text-slate-400 leading-relaxed -mt-2">
              Visualizes real-time rotation directions. Animated particles illustrate current capital velocity between asset groups.
            </div>

            <div className="border border-white/[0.06] rounded-2xl p-5 bg-black/35 relative overflow-hidden flex items-center justify-center min-h-[220px]">
              
              {/* Grid backdrop */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />

              <svg viewBox="0 0 400 200" className="w-full max-w-[500px] h-auto z-10 overflow-visible">
                {/* Node Definitions & coordinates mapping */}
                <g className="font-mono text-[9px] font-bold">
                  {/* Stocks Node */}
                  <g transform="translate(50, 40)" className="cursor-pointer">
                    <rect x="-35" y="-12" width="70" height="24" rx="6" fill="#090E1F" stroke="#8B5CF6" strokeWidth="1.2" />
                    <text x="0" y="3" fill="#FFF" textAnchor="middle">STOCKS</text>
                  </g>
                  {/* Bonds Node */}
                  <g transform="translate(150, 40)">
                    <rect x="-35" y="-12" width="70" height="24" rx="6" fill="#090E1F" stroke="#8B5CF6" strokeWidth="1.2" />
                    <text x="0" y="3" fill="#FFF" textAnchor="middle">BONDS</text>
                  </g>
                  {/* Tech Node */}
                  <g transform="translate(250, 40)">
                    <rect x="-35" y="-12" width="70" height="24" rx="6" fill="#090E1F" stroke="#EF4444" strokeWidth="1.2" />
                    <text x="0" y="3" fill="#FFF" textAnchor="middle">TECH</text>
                  </g>
                  {/* Energy Node */}
                  <g transform="translate(350, 40)">
                    <rect x="-35" y="-12" width="70" height="24" rx="6" fill="#090E1F" stroke="#EF4444" strokeWidth="1.2" />
                    <text x="0" y="3" fill="#FFF" textAnchor="middle">ENERGY</text>
                  </g>

                  {/* Gold Node */}
                  <g transform="translate(50, 160)">
                    <rect x="-35" y="-12" width="70" height="24" rx="6" fill="#090E1F" stroke="#F59E0B" strokeWidth="1.2" />
                    <text x="0" y="3" fill="#FFF" textAnchor="middle">GOLD</text>
                  </g>
                  {/* Safe Haven Node */}
                  <g transform="translate(150, 160)">
                    <rect x="-35" y="-12" width="70" height="24" rx="6" fill="#090E1F" stroke="#F59E0B" strokeWidth="1.2" />
                    <text x="0" y="3" fill="#FFF" textAnchor="middle">SAFE HAVEN</text>
                  </g>
                  {/* Crypto Node */}
                  <g transform="translate(250, 160)">
                    <rect x="-35" y="-12" width="70" height="24" rx="6" fill="#10B981" stroke="#10B981" strokeWidth="1.2" />
                    <text x="0" y="3" fill="#FFF" textAnchor="middle">CRYPTO</text>
                  </g>
                  {/* Risk-On Node */}
                  <g transform="translate(350, 160)">
                    <rect x="-35" y="-12" width="70" height="24" rx="6" fill="#10B981" stroke="#10B981" strokeWidth="1.2" />
                    <text x="0" y="3" fill="#FFF" textAnchor="middle">RISK ON</text>
                  </g>
                </g>

                {/* Flow lines with arrows and running dash arrays */}
                {/* 1. Stocks to Bonds: M 85 40 H 115 */}
                <path d="M 85 40 L 115 40" fill="none" stroke="rgba(139, 92, 246, 0.4)" strokeWidth="1.75" markerEnd="url(#arrow-purple)" strokeDasharray="3, 3" />
                
                {/* 2. Tech to Energy: M 285 40 H 315 */}
                <path d="M 285 40 L 315 40" fill="none" stroke="rgba(239, 68, 68, 0.4)" strokeWidth="1.75" markerEnd="url(#arrow-red)" strokeDasharray="3, 3" />

                {/* 3. Gold ← Safe Haven (Reverse direction flow): M 115 160 L 85 160 */}
                <path d="M 115 160 L 85 160" fill="none" stroke="rgba(245, 158, 11, 0.4)" strokeWidth="1.75" markerEnd="url(#arrow-yellow)" strokeDasharray="3, 3" />

                {/* 4. Crypto ← Risk On: M 315 160 L 285 160 */}
                <path d="M 315 160 L 285 160" fill="none" stroke="rgba(16, 185, 129, 0.4)" strokeWidth="1.75" markerEnd="url(#arrow-green)" strokeDasharray="3, 3" />

                {/* Arrow markers definitions */}
                <defs>
                  <marker id="arrow-purple" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 2 L 8 5 L 0 8 z" fill="#8B5CF6" />
                  </marker>
                  <marker id="arrow-red" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 2 L 8 5 L 0 8 z" fill="#EF4444" />
                  </marker>
                  <marker id="arrow-yellow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 2 L 8 5 L 0 8 z" fill="#F59E0B" />
                  </marker>
                  <marker id="arrow-green" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 2 L 8 5 L 0 8 z" fill="#10B981" />
                  </marker>
                </defs>

                {/* FLOW PARTICLES (Framer motion moving along path coordinate vectors) */}
                {/* Stocks to Bonds particle */}
                <motion.circle
                  r="3.5"
                  fill="#8B5CF6"
                  initial={{ offsetDistance: "0%" }}
                  animate={{ offsetDistance: "100%" }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' as const }}
                  style={{ offsetPath: "path('M 85 40 L 115 40')", filter: 'drop-shadow(0 0 4px #8B5CF6)' }}
                />

                {/* Tech to Energy particle */}
                <motion.circle
                  r="3.5"
                  fill="#EF4444"
                  initial={{ offsetDistance: "0%" }}
                  animate={{ offsetDistance: "100%" }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' as const }}
                  style={{ offsetPath: "path('M 285 40 L 315 40')", filter: 'drop-shadow(0 0 4px #EF4444)' }}
                />

                {/* Gold ← Safe Haven particle */}
                <motion.circle
                  r="3.5"
                  fill="#F59E0B"
                  initial={{ offsetDistance: "0%" }}
                  animate={{ offsetDistance: "100%" }}
                  transition={{ duration: 2.8, repeat: Infinity, ease: 'linear' as const }}
                  style={{ offsetPath: "path('M 115 160 L 85 160')", filter: 'drop-shadow(0 0 4px #F59E0B)' }}
                />

                {/* Crypto ← Risk On particle */}
                <motion.circle
                  r="3.5"
                  fill="#10B981"
                  initial={{ offsetDistance: "0%" }}
                  animate={{ offsetDistance: "100%" }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' as const }}
                  style={{ offsetPath: "path('M 315 160 L 285 160')", filter: 'drop-shadow(0 0 4px #10B981)' }}
                />

              </svg>
            </div>
          </GlassCard>
        </motion.div>

        {/* Critical Events Timeline (col-span-1) */}
        <motion.div {...fadeUp(0.4)}>
          <GlassCard hover={false} className="space-y-4">
            <SectionHeader title="Critical Events Timeline" icon={Calendar} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Today column */}
              <div className="space-y-3">
                <div className="text-[10px] font-extrabold uppercase text-purple-400 tracking-wider font-mono border-b border-purple-500/20 pb-1 mb-2">
                  Today
                </div>

                <div className="space-y-2.5">
                  {[
                    { time: '08:30', name: 'CPI Inflation Report', impact: 'HIGH', impactColor: 'bg-red-500 text-black' },
                    { time: '14:00', name: 'FOMC Press Statement', impact: 'HIGH', impactColor: 'bg-red-500 text-black' },
                    { time: '16:15', name: 'NVDA Earnings release', impact: 'HIGH', impactColor: 'bg-red-500 text-black' }
                  ].map((evt, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl border border-white/[0.04] bg-white/[0.01] flex items-start justify-between gap-3 hover:border-white/[0.08] transition-colors">
                      <div className="space-y-1 font-mono">
                        <span className="text-[9px] font-bold text-slate-500">{evt.time}</span>
                        <div className="text-[11px] font-bold text-slate-100 leading-snug">{evt.name}</div>
                      </div>
                      <span className={cn('text-[8px] font-black px-1.5 py-0.5 rounded tracking-wide uppercase', evt.impactColor)}>
                        {evt.impact}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tomorrow column */}
              <div className="space-y-3">
                <div className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider font-mono border-b border-white/[0.1] pb-1 mb-2">
                  Tomorrow
                </div>

                <div className="space-y-2.5">
                  {[
                    { time: '04:30', name: 'ECB Speech (Lagarde)', impact: 'MED', impactColor: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' },
                    { time: '08:30', name: 'Non-Farm Payrolls (Jobs)', impact: 'HIGH', impactColor: 'bg-red-500 text-black' },
                    { time: '08:30', name: 'PCE Core Inflation Index', impact: 'HIGH', impactColor: 'bg-red-500 text-black' }
                  ].map((evt, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl border border-white/[0.04] bg-white/[0.01] flex items-start justify-between gap-3 hover:border-white/[0.08] transition-colors">
                      <div className="space-y-1 font-mono">
                        <span className="text-[9px] font-bold text-slate-500">{evt.time}</span>
                        <div className="text-[11px] font-bold text-slate-100 leading-snug">{evt.name}</div>
                      </div>
                      <span className={cn('text-[8px] font-black px-1.5 py-0.5 rounded tracking-wide uppercase', evt.impactColor)}>
                        {evt.impact}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </GlassCard>
        </motion.div>

      </div>

      {/* ───────────────────────────────────────────────────────────────────────
          SECTION 9: AI STRATEGIC OUTLOOK (Large bottom card)
          ─────────────────────────────────────────────────────────────────────── */}
      <motion.div {...fadeUp(0.45)}>
        <GlassCard hover={false} className="border-purple-500/15 bg-gradient-to-br from-purple-500/[0.03] to-indigo-500/[0.02]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left summary details (col-span-4) */}
            <div className="lg:col-span-4 space-y-4">
              <SectionHeader title="AI Strategic Outlook" icon={Sparkles} />
              
              <div className="bg-[#090e1f] border border-white/[0.06] rounded-2xl p-5 flex flex-col justify-between h-40">
                <div>
                  <span className="text-[9px] font-mono uppercase font-bold tracking-widest text-slate-400">Projected Regime Bias</span>
                  <div className="text-3xl font-black text-emerald-400 tracking-tight mt-1 flex items-baseline gap-2">
                    <span>BULLISH</span>
                    <span className="text-xs font-mono font-bold text-slate-400">Confidence: 82%</span>
                  </div>
                </div>

                <div className="text-[9px] font-mono text-slate-500 leading-normal">
                  Calculated by integrating macroeconomic factors, oil risk weights, and current central bank messaging variables.
                </div>
              </div>
            </div>

            {/* Right strategic narrative details (col-span-8) */}
            <div className="lg:col-span-8 flex flex-col justify-between space-y-4">
              <div className="space-y-2 text-xs md:text-sm text-slate-300 leading-relaxed font-medium">
                <p>
                  Markets remain structurally risk-on despite elevated regional shipping channel tensions and temporary defensive reallocation. Leading indices maintain their leadership regimes while bond yields show initial consolidation footprints.
                </p>
                <p>
                  Sustained oil inventory weakness helps contain inflation concerns, granting central banks operational runway to model rate cut strategies.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-white/[0.05]">
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Primary Risk Drivers:</span>
                  <ul className="text-[10px] text-slate-400 space-y-1.5 font-mono list-disc pl-4">
                    <li>Taiwan semiconductor supply chain bottleneck risks.</li>
                    <li>Suez Canal / Red Sea shipping route diversions.</li>
                    <li>Upcoming FOMC CPI and jobs macro metrics.</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Expected Regime Forecast:</span>
                  <div className="p-3.5 rounded-xl border border-purple-500/10 bg-purple-500/5 text-[10px] text-purple-300 font-mono leading-relaxed">
                    <strong>Risk-On Bias</strong> with moderate volatility clusters. Maintain defensive exposure allocations in safe-havens, scaling semiconductor indices on breakouts.
                  </div>
                </div>
              </div>
            </div>

          </div>
        </GlassCard>
      </motion.div>

    </div>
  );
}
