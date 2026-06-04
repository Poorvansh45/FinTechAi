'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  BookOpen, Plus, Upload, Sparkles,
  TrendingUp, TrendingDown, Target, Award, Calendar, Activity,
  ChevronDown, ChevronUp,
} from 'lucide-react';

// Storage + types (unchanged)
import {
  listSetups, listTradesBySetup,
  seedDemo, ensureTradeIdsUnique,
  deleteTrade,
} from '@/lib/journal/storage';
import { derive } from '@/lib/journal/types';
import type { Setup, Trade } from '@/lib/journal/types';

// Existing components (unchanged)
import { TradeWizard } from '@/components/journal/TradeWizard';
import { TradeTable } from '@/components/workspace/TradeTable';
import { TradeInsightPanel } from '@/components/workspace/TradeInsightPanel';
import { LiveIndicator } from '@/components/workspace/LiveIndicator';
import { AIJournalAnalyzer } from '@/components/journal/AIJournalAnalyzer';

// Dashboard API
import {
  getDashboardStats, getRecentTrades, getPerformanceData, getAIInsights,
  getPerformanceSnapshot, getTraderScore,
  type JournalStats, type TradeSummary, type PerformancePoint,
  type AIInsight, type PerformanceSnapshot, type TraderScore,
} from '@/lib/api/journalApi';

// Dashboard components
import { KpiCard } from '@/components/journal/dashboard/KpiCard';
import { EquityCurveChart } from '@/components/journal/dashboard/EquityCurveChart';
import { PnlDistribution } from '@/components/journal/dashboard/PnlDistribution';
import { RecentTradesWidget } from '@/components/journal/dashboard/RecentTradesWidget';
import { AIInsightStrip } from '@/components/journal/dashboard/AIInsightStrip';
import { QuickActions } from '@/components/journal/dashboard/QuickActions';
import { EmptyState } from '@/components/journal/dashboard/EmptyState';
import { PerformanceSnapshotRow } from '@/components/journal/dashboard/PerformanceSnapshotRow';
import { TraderScoreCard } from '@/components/journal/dashboard/TraderScoreCard';

type Period = '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';

// ─── KPI builder ──────────────────────────────────────────────────────────────
function buildKpis(stats: JournalStats | null) {
  if (!stats) {
    const e = { value: '—', subLabel: 'No journal data' };
    return [
      { label: 'Total P&L',     ...e, icon: TrendingUp,   accentColor: '#6366f1' },
      { label: 'Win Rate',      ...e, icon: Target,        accentColor: '#22c55e' },
      { label: 'Profit Factor', ...e, icon: Award,         accentColor: '#f59e0b' },
      { label: 'Avg RR',        ...e, icon: TrendingDown,  accentColor: '#a78bfa' },
      { label: 'Total Trades',  ...e, icon: Activity,      accentColor: '#38bdf8' },
      { label: 'Best Day',      ...e, icon: Calendar,      accentColor: '#fb923c' },
    ];
  }
  const pos = stats.totalPnl >= 0;
  const rrStr = stats.avgRR !== null ? `${stats.avgRR}R` : '—';
  return [
    {
      label: 'Total P&L',
      value: `${pos ? '+' : ''}${stats.totalPnl.toFixed(2)}`,
      subLabel: `${stats.openTrades} open`,
      icon: pos ? TrendingUp : TrendingDown,
      color: pos ? 'text-emerald-400' : 'text-red-400',
      accentColor: pos ? '#22c55e' : '#ef4444',
    },
    {
      label: 'Win Rate',
      value: `${stats.winRate.toFixed(1)}%`,
      subLabel: `${stats.totalTrades} closed`,
      icon: Target,
      color: stats.winRate >= 50 ? 'text-emerald-400' : 'text-amber-400',
      accentColor: stats.winRate >= 50 ? '#22c55e' : '#f59e0b',
    },
    {
      label: 'Profit Factor',
      value: stats.profitFactor > 50 ? '∞' : String(stats.profitFactor),
      subLabel: stats.profitFactor >= 1.5 ? 'Above target' : 'Below 1.5',
      icon: Award,
      color: stats.profitFactor >= 1.5 ? 'text-emerald-400' : 'text-amber-400',
      accentColor: '#f59e0b',
    },
    {
      label: 'Avg RR',
      value: rrStr,
      subLabel: stats.avgRR === null ? 'Set SL+Target' : undefined,
      icon: TrendingDown,
      color: (stats.avgRR ?? 0) >= 2 ? 'text-emerald-400' : 'text-amber-400',
      accentColor: '#a78bfa',
    },
    {
      label: 'Total Trades',
      value: String(stats.totalTrades),
      subLabel: `${stats.openTrades} open`,
      icon: Activity,
      accentColor: '#38bdf8',
    },
    {
      label: 'Best Day',
      value: stats.bestDay,
      subLabel: 'Highest P&L weekday',
      icon: Calendar,
      accentColor: '#fb923c',
    },
  ];
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function JournalDashboardPage() {
  // Core journal state
  const [setups, setSetups] = useState<Setup[]>([]);
  const [allTrades, setAllTrades] = useState<Trade[]>([]);
  const [selected, setSelected] = useState<Trade | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [showAnalyzer, setShowAnalyzer] = useState(false);
  const [showTradeList, setShowTradeList] = useState(false);
  const [version, setVersion] = useState(0);

  // Dashboard data
  const [stats, setStats] = useState<JournalStats | null | undefined>(undefined);
  const [recentTrades, setRecentTrades] = useState<TradeSummary[]>([]);
  const [perfData, setPerfData] = useState<PerformancePoint[]>([]);
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([]);
  const [snapshot, setSnapshot] = useState<PerformanceSnapshot | null | undefined>(undefined);
  const [traderScore, setTraderScore] = useState<TraderScore | undefined>(undefined);
  const [period, setPeriod] = useState<Period>('ALL');
  const [dashLoading, setDashLoading] = useState(true);

  // Load trades from storage
  const refresh = useCallback(() => {
    const s = listSetups();
    setSetups(s);
    const trades = s
      .flatMap((x) => listTradesBySetup(x.id))
      .sort((a, b) => new Date(b.entryAt).getTime() - new Date(a.entryAt).getTime());
    setAllTrades(trades);
  }, []);

  useEffect(() => { seedDemo(); ensureTradeIdsUnique(); refresh(); }, [refresh, version]);

  // Load all dashboard data
  useEffect(() => {
    setDashLoading(true);
    Promise.all([
      getDashboardStats(),
      getRecentTrades(7),
      getAIInsights(),
      getPerformanceSnapshot(),
      getTraderScore(),
    ]).then(([s, r, ai, snap, ts]) => {
      setStats(s);
      setRecentTrades(r);
      setAiInsights(ai);
      setSnapshot(snap);
      setTraderScore(ts);
      setDashLoading(false);
    });
  }, [version]);

  // Equity curve reloads on period change
  useEffect(() => { getPerformanceData(period).then(setPerfData); }, [period, version]);

  // Win/Loss/Breakeven for donut
  const wlb = useMemo(() => {
    const closed = allTrades.filter((t) => t.exitPrice != null);
    let wins = 0, losses = 0, breakeven = 0;
    for (const t of closed) {
      const pnl = derive(t).pnl ?? 0;
      if (Math.abs(pnl) < 0.01) breakeven++;
      else if (pnl > 0) wins++;
      else losses++;
    }
    return { wins, losses, breakeven };
  }, [allTrades]);

  const setupName = (id: string) => setups.find((s) => s.id === id)?.name ?? '—';
  const kpis = buildKpis(stats === undefined ? null : stats);
  const isLoading = stats === undefined || dashLoading;
  const hasNoTrades = !isLoading && allTrades.length === 0;

  return (
    <div className="space-y-4 animate-fadeIn pb-6">

      {/* ── ROW 1: HEADER ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-400" />
            Trading Journal
            <LiveIndicator />
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Review performance, journal trades, and improve execution quality.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowAnalyzer((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-indigo-400 transition-all"
            style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}
          >
            <Sparkles className="w-3.5 h-3.5" /> AI Review
          </button>
          <button
            disabled
            title="CSV import coming soon"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 opacity-50 cursor-not-allowed"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <Upload className="w-3.5 h-3.5" /> Import
          </button>
          <button
            onClick={() => setShowWizard(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white hover:scale-105 active:scale-95 transition-all"
            style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', boxShadow: '0 0 16px rgba(99,102,241,0.3)' }}
          >
            <Plus className="w-4 h-4" /> Add Trade
          </button>
        </div>
      </div>

      {/* AI Analyzer (collapsible, unchanged) */}
      {showAnalyzer && (
        <div className="glass-card p-5 animate-fadeUp">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" /> AI Journal Analyzer
            </h2>
            <button onClick={() => setShowAnalyzer(false)} className="text-muted-foreground hover:text-foreground text-xs">
              Close ×
            </button>
          </div>
          <AIJournalAnalyzer trades={allTrades} setupName={setupName} />
        </div>
      )}

      {/* ── EMPTY STATE ───────────────────────────────────────────── */}
      {hasNoTrades ? (
        <EmptyState onAddTrade={() => setShowWizard(true)} />
      ) : (
        <>
          {/* ── ROW 2: KPI CARDS ────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
            {kpis.map((kpi) => (
              <KpiCard
                key={kpi.label}
                label={kpi.label}
                value={isLoading ? null : kpi.value}
                subLabel={isLoading ? undefined : kpi.subLabel}
                color={kpi.color}
                icon={kpi.icon}
                accentColor={kpi.accentColor}
              />
            ))}
          </div>

          {/* ── ROW 3: CHARTS — 2-col: [Equity+Donut left] + [Recent Trades right] ── */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3">
            {/* Left column: Equity Curve stacked above P&L Donut */}
            <div className="flex flex-col gap-3">
              <EquityCurveChart
                data={perfData}
                activePeriod={period}
                onPeriodChange={setPeriod}
                loading={isLoading}
              />
              <PnlDistribution
                wins={wlb.wins}
                losses={wlb.losses}
                breakeven={wlb.breakeven}
                loading={isLoading}
              />
            </div>

            {/* Right column: Recent Trades — wider, more visible */}
            <RecentTradesWidget
              trades={recentTrades}
              loading={isLoading}
              onViewAll={() => setShowTradeList(true)}
            />
          </div>

          {/* ── ROW 4: PERFORMANCE SNAPSHOT ─────────────────────── */}
          <PerformanceSnapshotRow
            snapshot={snapshot === undefined ? null : snapshot}
            loading={isLoading}
          />

          {/* ── ROW 5: TRADER SCORE + AI INSIGHTS side by side ──── */}
          <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-3">
            <TraderScoreCard
              score={traderScore ?? { overall: null, execution: null, riskManagement: null, consistency: null, discipline: null }}
              loading={isLoading || traderScore === undefined}
            />
            <AIInsightStrip insights={aiInsights} loading={isLoading} />
          </div>

          {/* ── ROW 6: QUICK ACTIONS ────────────────────────────── */}
          <QuickActions onAddTrade={() => setShowWizard(true)} />

          {/* ── ROW 7: TRADE TABLE (collapsible) ────────────────── */}
          <div>
            <button
              onClick={() => setShowTradeList((v) => !v)}
              className="flex items-center gap-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors w-full justify-between px-1 py-2"
            >
              <span className="flex items-center gap-2">
                <BookOpen className="w-3.5 h-3.5" />
                All Trades
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8' }}
                >
                  {allTrades.length}
                </span>
              </span>
              {showTradeList ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showTradeList && (
              <div className="grid grid-cols-1 lg:grid-cols-[65fr_35fr] gap-3 mt-2 animate-fadeIn">
                <TradeTable
                  trades={allTrades}
                  selectedId={selected?.id ?? null}
                  setupName={setupName}
                  onSelect={setSelected}
                  onDelete={(id) => {
                    deleteTrade(id);
                    setVersion((v) => v + 1);
                    if (selected?.id === id) setSelected(null);
                  }}
                  emptyAction={() => setShowWizard(true)}
                />
                <div className="min-h-[400px] lg:min-h-0">
                  {selected ? (
                    <TradeInsightPanel
                      trade={selected}
                      setupName={setupName}
                      onClose={() => setSelected(null)}
                    />
                  ) : (
                    <div
                      className="glass-card h-full min-h-[400px] flex flex-col items-center justify-center gap-3 py-12 text-center px-4"
                    >
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center"
                        style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}
                      >
                        <Sparkles className="w-5 h-5 text-indigo-400" />
                      </div>
                      <p className="text-sm font-medium">AI Trade Insight Panel</p>
                      <p className="text-[11px] text-muted-foreground max-w-[200px] leading-relaxed">
                        Select a trade to see execution score, behavior tags, and improvement insights.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* TradeWizard modal (unchanged) */}
      {showWizard && (
        <TradeWizard
          setups={setups}
          onClose={() => setShowWizard(false)}
          onSaved={() => { setVersion((v) => v + 1); setShowWizard(false); }}
        />
      )}
    </div>
  );
}
