'use client';

import React from 'react';
import Link from 'next/link';
import {
  PieChart,
  RotateCcw,
  Layers,
  BarChart3,
  Sparkles,
  FlaskConical,
  ArrowRight,
  ShieldCheck,
  LineChart,
  Lock,
} from 'lucide-react';

export default function SectorXpertPage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex-1 space-y-10">
        
        {/* ── HEADER SECTION ────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md border border-brand-500/30 bg-brand-500/10 text-brand-300 text-xs font-semibold">
              <FlaskConical className="w-3.5 h-3.5 text-brand-400 animate-pulse" />
              <span>Sector Xpert · BETA</span>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border border-foreground/10 bg-foreground/5 text-neutral-400 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-warning-400" />
              Under Testing
            </span>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
              Sector <span className="text-brand-400 ">Xpert</span>
            </h1>
            <p className="text-base sm:text-lg text-neutral-400 max-w-3xl leading-relaxed">
              Explore India&apos;s market sectors, their performance, and the stocks driving them.
            </p>
          </div>
        </div>

        {/* ── BETA ANNOUNCEMENT BANNER ───────────────────────────────── */}
        <div className="relative overflow-hidden rounded-xl border border-brand-500/20 bg-neutral-900 p-6 sm:p-8 shadow-xl">
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2 text-brand-300 font-semibold text-sm">
                <Sparkles className="w-4 h-4 text-brand-400" />
                <span>Next-Gen Sector Intelligence Platform</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                Institutional Sector Rotation & Breadth Matrix
              </h2>
              <p className="text-sm text-neutral-300 leading-relaxed">
                Sector Xpert is currently undergoing data architecture setup and internal testing. Detailed sectoral capital flows, heavyweight contribution matrices, and real-time Nifty indices analytics will be accessible shortly.
              </p>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="px-4 py-2.5 rounded-xl border border-brand-500/30 bg-brand-500/10 text-brand-300 text-xs font-semibold flex items-center gap-2">
                <Lock className="w-3.5 h-3.5" />
                <span>Data Pipelines Offline</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── PLANNED CAPABILITIES GRID ─────────────────────────────── */}
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
              <PieChart className="w-5 h-5 text-brand-400" />
              <span>Core Module Features Preview</span>
            </h2>
            <p className="text-xs text-neutral-400 mt-1">
              Upcoming analytical tools designed for Sector Xpert.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Feature 1 */}
            <div className="group relative rounded-xl border border-foreground/[0.08] bg-neutral-900/80 p-6 transition-all duration-300 hover:border-brand-500/30 hover:bg-neutral-900/90">
              <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <BarChart3 className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-brand-400 px-2 py-0.5 rounded bg-brand-500/10 border border-brand-500/20 inline-block mb-2">
                Heatmap
              </span>
              <h3 className="text-base font-semibold text-foreground mb-1">
                Sector Heatmaps
              </h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Real-time performance heatmaps across 15+ Nifty sectoral & thematic indices.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="group relative rounded-xl border border-foreground/[0.08] bg-neutral-900/80 p-6 transition-all duration-300 hover:border-brand-500/30 hover:bg-neutral-900/90">
              <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <RotateCcw className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-brand-400 px-2 py-0.5 rounded bg-brand-500/10 border border-brand-500/20 inline-block mb-2">
                Flows
              </span>
              <h3 className="text-base font-semibold text-foreground mb-1">
                Capital Rotation
              </h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Track capital shifts between defensive vs cyclical sectors to catch macro trends.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="group relative rounded-xl border border-foreground/[0.08] bg-neutral-900/80 p-6 transition-all duration-300 hover:border-brand-500/30 hover:bg-neutral-900/90">
              <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Layers className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-brand-400 px-2 py-0.5 rounded bg-brand-500/10 border border-brand-500/20 inline-block mb-2">
                Constituents
              </span>
              <h3 className="text-base font-semibold text-foreground mb-1">
                Leaders & Laggards
              </h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Identify key heavyweight stocks driving individual sector rallies or pullbacks.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="group relative rounded-xl border border-foreground/[0.08] bg-neutral-900/80 p-6 transition-all duration-300 hover:border-brand-500/30 hover:bg-neutral-900/90">
              <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <LineChart className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-brand-400 px-2 py-0.5 rounded bg-brand-500/10 border border-brand-500/20 inline-block mb-2">
                Valuation
              </span>
              <h3 className="text-base font-semibold text-foreground mb-1">
                Sector Breadth & PE
              </h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Historical valuation bands (P/E, P/B) and percentage of stocks trading above 50/200 DMA.
              </p>
            </div>
          </div>
        </div>

        {/* ── FOOTER / SYSTEM READY NOTE ────────────────────────────── */}
        <div className="rounded-xl border border-foreground/[0.06] bg-neutral-950/60 p-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-positive-400" />
            <span>Existing Screener, Technical Scanners & Workspace remain fully active.</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/screener"
              className="text-neutral-400 hover:text-brand-300 transition-colors inline-flex items-center gap-1 font-medium"
            >
              <span>Go to Screener</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
