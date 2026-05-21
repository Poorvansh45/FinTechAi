'use client';

import { LayoutDashboard, RefreshCw, Radio } from 'lucide-react';
import { GlobalMarketStrip } from '@/components/markets/GlobalMarketStrip';
import { MarketIntelFeed } from '@/components/markets/MarketIntelFeed';
import { MarketBreadth } from '@/components/markets/MarketBreadth';
import { TopMovers } from '@/components/markets/TopMovers';
import { SectorHeatmap } from '@/components/markets/SectorHeatmap';
import { WatchlistIntel } from '@/components/markets/WatchlistIntel';
import { RiskOverview } from '@/components/markets/RiskOverview';

export default function MarketsOverviewPage() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="max-w-screen-2xl mx-auto space-y-4">

      {/* ── Compact Page Header ────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-gradient-to-br from-blue-600 to-violet-600 shadow-md shadow-indigo-500/20">
            <LayoutDashboard className="w-3.5 h-3.5 text-white"/>
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight leading-tight">Markets Overview</h1>
            <p className="text-[10px] text-slate-500 tabular-nums">{dateStr} · {timeStr} IST</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/15">
            <Radio className="w-3 h-3 animate-pulse"/>Market Open
          </span>
          <button className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-all" title="Refresh">
            <RefreshCw className="w-3.5 h-3.5"/>
          </button>
        </div>
      </div>

      {/* ── S1: Global Market Strip ────────────────────── */}
      <GlobalMarketStrip/>

      {/* ── S2+S3: Intel Feed + Breadth ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        <div className="lg:col-span-3"><MarketIntelFeed/></div>
        <div className="lg:col-span-2"><MarketBreadth/></div>
      </div>

      {/* ── S4+S5: Top Movers + Sector Heatmap ─────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <TopMovers/>
        <SectorHeatmap/>
      </div>

      {/* ── S6+S7: Watchlist + Risk ────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <WatchlistIntel/>
        <RiskOverview/>
      </div>

      {/* ── Footer ─────────────────────────────────────── */}
      <div className="text-center pb-3">
        <p className="text-[9px] text-slate-400 dark:text-slate-600">
          {timeStr} IST · FinAI Edge Intelligence Engine · Data may be delayed 15 min
        </p>
      </div>
    </div>
  );
}
