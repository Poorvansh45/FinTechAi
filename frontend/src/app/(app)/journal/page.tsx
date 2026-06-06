'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  BookOpen, Plus, Upload, Sparkles,
  ChevronDown, ChevronUp,
} from 'lucide-react';

// Storage
import {
  listSetups, listTrades,
  seedDemo, ensureTradeIdsUnique,
  deleteTrade,
} from '@/lib/journal/storage';
import type { Setup, Trade } from '@/lib/journal/types';

import { TradeTicket } from '@/components/journal/add-trade/TradeTicket';
import { TradeTable } from '@/components/workspace/TradeTable';
import { TradeInsightPanel } from '@/components/workspace/TradeInsightPanel';
import { LiveIndicator } from '@/components/workspace/LiveIndicator';
import { AIJournalAnalyzer } from '@/components/journal/AIJournalAnalyzer';

// Dashboard API
import {
  getKpiBundle, getPerformanceData, getRecentTrades,
  getTradesBreakdown, getLongShortBreakdown, getBestSetups,
  getTopSymbols, getAIInsights, getPerformanceSnapshot, getTraderScore,
  type KpiBundle, type PerformancePoint, type TradeSummary,
  type TradesBreakdown, type LongShortBreakdown, type SetupPerformance,
  type SymbolPerformance, type AIInsight, type PerformanceSnapshot, type TraderScore,
} from '@/lib/api/journalApi';

// Dashboard components
import { KpiStrip } from '@/components/journal/dashboard/KpiStrip';
import { EquityCurveChart } from '@/components/journal/dashboard/EquityCurveChart';
import { PerformanceCalendar } from '@/components/journal/dashboard/PerformanceCalendar';
import { TradesBreakdownCard } from '@/components/journal/dashboard/TradesBreakdownCard';
import { LongShortCard } from '@/components/journal/dashboard/LongShortCard';
import { BestSetupsCard } from '@/components/journal/dashboard/BestSetupsCard';
import { TopSymbolsCard } from '@/components/journal/dashboard/TopSymbolsCard';
import { AIPerformanceCenter } from '@/components/journal/dashboard/AIPerformanceCenter';
import { TraderScoreCard } from '@/components/journal/dashboard/TraderScoreCard';
import { ImprovementCenter } from '@/components/journal/dashboard/ImprovementCenter';
import { RecentTradesTable } from '@/components/journal/dashboard/RecentTradesTable';
import { EmptyState } from '@/components/journal/dashboard/EmptyState';

type Period = '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function JournalDashboardPage() {
  // Core state
  const [setups, setSetups]       = useState<Setup[]>([]);
  const [allTrades, setAllTrades] = useState<Trade[]>([]);
  const [selected, setSelected]   = useState<Trade | null>(null);
  const [showCapture, setShowCapture] = useState(false);
  const [showAnalyzer, setShowAnalyzer] = useState(false);
  const [showTradeList, setShowTradeList] = useState(false);
  const [version, setVersion]     = useState(0);

  // Dashboard data
  const [kpis, setKpis]               = useState<KpiBundle | null | undefined>(undefined);
  const [perfData, setPerfData]       = useState<PerformancePoint[]>([]);
  const [recentTrades, setRecentTrades] = useState<TradeSummary[]>([]);
  const [breakdown, setBreakdown]     = useState<TradesBreakdown | null | undefined>(undefined);
  const [longShort, setLongShort]     = useState<LongShortBreakdown | null | undefined>(undefined);
  const [bestSetups, setBestSetups]   = useState<SetupPerformance[]>([]);
  const [topSymbols, setTopSymbols]   = useState<SymbolPerformance[]>([]);
  const [aiInsights, setAiInsights]   = useState<AIInsight[]>([]);
  const [snapshot, setSnapshot]       = useState<PerformanceSnapshot | null | undefined>(undefined);
  const [traderScore, setTraderScore] = useState<TraderScore | undefined>(undefined);
  const [period, setPeriod]           = useState<Period>('ALL');
  const [loading, setLoading]         = useState(true);

  // Refresh trades from storage
  const refresh = useCallback(() => {
    const s = listSetups();
    setSetups(s);
    setAllTrades(listTrades());
  }, []);

  useEffect(() => { seedDemo(); ensureTradeIdsUnique(); refresh(); }, [refresh, version]);

  // Load all dashboard data
  useEffect(() => {
    setLoading(true);
    Promise.all([
      getKpiBundle(period),
      getRecentTrades(10),
      getTradesBreakdown(),
      getLongShortBreakdown(),
      getBestSetups(4),
      getTopSymbols(4),
      getAIInsights(),
      getPerformanceSnapshot(),
      getTraderScore(),
    ]).then(([k, rt, tb, ls, bs, ts, ai, snap, score]) => {
      setKpis(k);
      setRecentTrades(rt);
      setBreakdown(tb);
      setLongShort(ls);
      setBestSetups(bs);
      setTopSymbols(ts);
      setAiInsights(ai);
      setSnapshot(snap);
      setTraderScore(score);
      setLoading(false);
    });
  }, [version, period]);

  // Equity curve on period change
  useEffect(() => { getPerformanceData(period).then(setPerfData); }, [period, version]);

  const setupName = (id: string) => setups.find((s) => s.id === id)?.name ?? '—';
  const isLoading = loading || kpis === undefined;
  const hasNoTrades = !isLoading && allTrades.length === 0;

  return (
    <div className="space-y-4 animate-fadeIn pb-8">

      {/* ═══════════════════════════════════════════════════════════════
          HEADER
      ═══════════════════════════════════════════════════════════════ */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-400" />
            Trading Journal
            <LiveIndicator />
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Track performance, execution quality, and trading behavior.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowAnalyzer((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-indigo-400 transition-all hover:bg-indigo-400/10"
            style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.18)' }}
          >
            <Sparkles className="w-3.5 h-3.5" /> AI Review
          </button>
          <button
            disabled title="CSV import coming soon"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 opacity-50 cursor-not-allowed"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <Upload className="w-3.5 h-3.5" /> Import
          </button>
          <button
            onClick={() => setShowCapture(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white hover:scale-[1.03] active:scale-95 transition-all"
            style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', boxShadow: '0 0 20px rgba(99,102,241,0.3)' }}
          >
            <Plus className="w-4 h-4" /> Add Trade
          </button>
        </div>
      </div>

      {/* AI Analyzer (collapsible) */}
      {showAnalyzer && (
        <div className="glass-card p-5 animate-fadeUp">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" /> AI Journal Analyzer
            </h2>
            <button onClick={() => setShowAnalyzer(false)} className="text-muted-foreground hover:text-foreground text-xs">Close ×</button>
          </div>
          <AIJournalAnalyzer trades={allTrades} setupName={setupName} />
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          EMPTY STATE
      ═══════════════════════════════════════════════════════════════ */}
      {hasNoTrades ? (
        <EmptyState onAddTrade={() => setShowCapture(true)} />
      ) : (
        <>
          {/* ═══════════════════════════════════════════════════════════
              ROW 1 — KPI STRIP
          ═══════════════════════════════════════════════════════════ */}
          <KpiStrip bundle={kpis === undefined ? null : kpis} loading={isLoading} />

          {/* ═══════════════════════════════════════════════════════════
              ROW 2 — EQUITY CURVE (60%) + CALENDAR (40%)
          ═══════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-3">
            <EquityCurveChart
              data={perfData}
              activePeriod={period}
              onPeriodChange={setPeriod}
              loading={isLoading}
            />
            <PerformanceCalendar version={version} />
          </div>

          {/* ═══════════════════════════════════════════════════════════
              ROW 3 — TRADING BREAKDOWN (4 cards)
          ═══════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <TradesBreakdownCard data={breakdown === undefined ? null : breakdown} loading={isLoading} />
            <LongShortCard data={longShort === undefined ? null : longShort} loading={isLoading} />
            <BestSetupsCard setups={bestSetups} loading={isLoading} />
            <TopSymbolsCard symbols={topSymbols} loading={isLoading} />
          </div>

          {/* ═══════════════════════════════════════════════════════════
              ROW 4 — AI PERFORMANCE CENTER
          ═══════════════════════════════════════════════════════════ */}
          <AIPerformanceCenter insights={aiInsights} loading={isLoading} />

          {/* ═══════════════════════════════════════════════════════════
              ROW 5 — TRADER SCORE
          ═══════════════════════════════════════════════════════════ */}
          <TraderScoreCard
            score={traderScore ?? { overall: null, execution: null, riskManagement: null, consistency: null, discipline: null }}
            loading={isLoading || traderScore === undefined}
          />

          {/* ═══════════════════════════════════════════════════════════
              ROW 6 — IMPROVEMENT CENTER
          ═══════════════════════════════════════════════════════════ */}
          <ImprovementCenter
            snapshot={snapshot === undefined ? null : snapshot}
            loading={isLoading}
          />

          {/* ═══════════════════════════════════════════════════════════
              ROW 7 — RECENT TRADES TABLE
          ═══════════════════════════════════════════════════════════ */}
          <RecentTradesTable trades={recentTrades} loading={isLoading} />

          {/* ═══════════════════════════════════════════════════════════
              EXPANDED TRADE TABLE (collapsible — full existing UI)
          ═══════════════════════════════════════════════════════════ */}
          <div>
            <button
              onClick={() => setShowTradeList((v) => !v)}
              className="flex items-center gap-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors w-full justify-between px-1 py-2"
            >
              <span className="flex items-center gap-2">
                <BookOpen className="w-3.5 h-3.5" />
                Full Trade Log
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8' }}>
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
                  emptyAction={() => setShowCapture(true)}
                />
                <div className="min-h-[400px] lg:min-h-0">
                  {selected ? (
                    <TradeInsightPanel
                      trade={selected}
                      setupName={setupName}
                      onClose={() => setSelected(null)}
                    />
                  ) : (
                    <div className="glass-card h-full min-h-[400px] flex flex-col items-center justify-center gap-3 py-12 text-center px-4">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                        style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}>
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

      {showCapture && (
        <TradeTicket
          setups={setups}
          onClose={() => setShowCapture(false)}
          onSaved={() => { setVersion((v) => v + 1); setShowCapture(false); }}
        />
      )}
    </div>
  );
}
