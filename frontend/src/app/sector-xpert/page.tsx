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
    <div className="min-h-screen bg-[#050816] text-slate-100 flex flex-col">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-12 left-1/2 -translate-x-1/2 w-[800px] h-[350px] rounded-full bg-gradient-to-r from-cyan-600/10 via-teal-600/10 to-blue-600/5 blur-[140px]" />
        <div className="absolute top-[400px] right-10 w-[500px] h-[300px] rounded-full bg-cyan-500/5 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex-1 space-y-10">
        
        {/* ── HEADER SECTION ────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-xs font-semibold tracking-wide uppercase">
              <FlaskConical className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span>Sector Xpert · BETA</span>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-white/10 bg-white/5 text-slate-400 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Under Testing
            </span>
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white">
              Sector <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-blue-400 bg-clip-text text-transparent">Xpert</span>
            </h1>
            <p className="text-base sm:text-lg text-slate-400 max-w-3xl leading-relaxed">
              Explore India&apos;s market sectors, their performance, and the stocks driving them.
            </p>
          </div>
        </div>

        {/* ── BETA ANNOUNCEMENT BANNER ───────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-cyan-950/40 via-[#0B132B]/60 to-[#0A0E17]/80 p-6 sm:p-8 backdrop-blur-xl shadow-xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2 text-cyan-300 font-semibold text-sm">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>Next-Gen Sector Intelligence Platform</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">
                Institutional Sector Rotation & Breadth Matrix
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Sector Xpert is currently undergoing data architecture setup and internal testing. Detailed sectoral capital flows, heavyweight contribution matrices, and real-time Nifty indices analytics will be accessible shortly.
              </p>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="px-4 py-2.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-xs font-semibold flex items-center gap-2">
                <Lock className="w-3.5 h-3.5" />
                <span>Data Pipelines Offline</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── PLANNED CAPABILITIES GRID ─────────────────────────────── */}
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <PieChart className="w-5 h-5 text-cyan-400" />
              <span>Core Module Features Preview</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Upcoming analytical tools designed for Sector Xpert.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Feature 1 */}
            <div className="group relative rounded-2xl border border-white/[0.08] bg-[#0B0F19]/80 p-6 backdrop-blur-xl transition-all duration-300 hover:border-cyan-500/30 hover:bg-[#0E1526]/90">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <BarChart3 className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 inline-block mb-2">
                Heatmap
              </span>
              <h3 className="text-base font-semibold text-white mb-1">
                Sector Heatmaps
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Real-time performance heatmaps across 15+ Nifty sectoral & thematic indices.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="group relative rounded-2xl border border-white/[0.08] bg-[#0B0F19]/80 p-6 backdrop-blur-xl transition-all duration-300 hover:border-cyan-500/30 hover:bg-[#0E1526]/90">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <RotateCcw className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400 px-2 py-0.5 rounded bg-teal-500/10 border border-teal-500/20 inline-block mb-2">
                Flows
              </span>
              <h3 className="text-base font-semibold text-white mb-1">
                Capital Rotation
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Track capital shifts between defensive vs cyclical sectors to catch macro trends.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="group relative rounded-2xl border border-white/[0.08] bg-[#0B0F19]/80 p-6 backdrop-blur-xl transition-all duration-300 hover:border-cyan-500/30 hover:bg-[#0E1526]/90">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Layers className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 inline-block mb-2">
                Constituents
              </span>
              <h3 className="text-base font-semibold text-white mb-1">
                Leaders & Laggards
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Identify key heavyweight stocks driving individual sector rallies or pullbacks.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="group relative rounded-2xl border border-white/[0.08] bg-[#0B0F19]/80 p-6 backdrop-blur-xl transition-all duration-300 hover:border-cyan-500/30 hover:bg-[#0E1526]/90">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <LineChart className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 inline-block mb-2">
                Valuation
              </span>
              <h3 className="text-base font-semibold text-white mb-1">
                Sector Breadth & PE
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Historical valuation bands (P/E, P/B) and percentage of stocks trading above 50/200 DMA.
              </p>
            </div>
          </div>
        </div>

        {/* ── FOOTER / SYSTEM READY NOTE ────────────────────────────── */}
        <div className="rounded-2xl border border-white/[0.06] bg-[#080C14]/60 p-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Existing Screener, Technical Scanners & Workspace remain fully active.</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/screener"
              className="text-slate-400 hover:text-cyan-300 transition-colors inline-flex items-center gap-1 font-medium"
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
