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

/** One figure in the hero's glance row. Declared at module scope so it keeps a
 *  stable component identity across renders. */
function HeroStat({
  label, value, sub, tone, loading,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: 'pos' | 'neg';
  loading?: boolean;
}) {
  return (
    <div className="px-2 sm:px-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</div>
      {loading ? (
        <div className="mx-auto mt-2 h-6 w-16 skeleton rounded" />
      ) : (
        <div
          className={`mt-2 text-xl font-black tabular-nums leading-none ${
            tone === 'pos' ? 'text-emerald-400' : tone === 'neg' ? 'text-red-400' : 'text-white'
          }`}
        >
          {value}
        </div>
      )}
      <div className="mt-1.5 text-[10px] text-slate-600">{sub}</div>
    </div>
  );
}

/** Section heading. Gives each band of the dashboard a name and a consistent
 *  amount of air above its content, which is what the flat stack of rows was
 *  missing — everything read as one undifferentiated column of cards. */
function Section({
  title, subtitle, children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-4">
        <h2 className="text-base font-bold tracking-tight text-white">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

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
      // Fetch a deep slice, not 10: the table still shows the latest 10, but the
      // hero's "today" figure has to sum every trade closed today, and capping
      // the fetch at 10 would silently under-report it on an active day.
      getRecentTrades(100),
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

  // Hero glance-stats, all derived from data already loaded — no new requests.
  const openTrades = allTrades.filter((t) => !t.exitAt || t.status === 'Open').length;
  const lastTrade = recentTrades[0] ?? null;
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayPnl = recentTrades
    .filter((t) => t.exitAt?.slice(0, 10) === todayKey)
    .reduce((sum, t) => sum + (t.pnl ?? 0), 0);
  const tradedToday = recentTrades.filter((t) => t.exitAt?.slice(0, 10) === todayKey).length;

  return (
    // Page shell: the dashboard previously ran edge-to-edge with no horizontal
    // padding at all — the (app) layout adds none — which is what made every
    // section look flush-left. A centred max-width column plus real gutters
    // gives the content a measure to sit in.
    <div className="mx-auto w-full max-w-[1600px] px-5 sm:px-8 lg:px-10 pb-20 animate-fadeIn">

      {/* ═══════════════════════════════════════════════════════════════
          HERO — centred, with room to breathe
      ═══════════════════════════════════════════════════════════════ */}
      <header className="border-b border-white/[0.06] py-12 lg:py-16 text-center">
        <div className="flex items-center justify-center gap-2.5">
          <BookOpen className="w-4 h-4 text-indigo-400" />
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-400">
            Workspace
          </span>
          <LiveIndicator />
        </div>

        <h1 className="mt-5 text-4xl lg:text-5xl font-black tracking-tight text-white">
          Trading Journal
        </h1>

        <p className="mx-auto mt-4 max-w-xl text-sm lg:text-[15px] leading-relaxed text-slate-400">
          Professional trade analytics, AI reviews, execution tracking
          and performance insights.
        </p>

        {/* Actions */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
          <button
            onClick={() => setShowCapture(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white hover:scale-[1.03] active:scale-95 transition-all"
            style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', boxShadow: '0 0 20px rgba(99,102,241,0.3)' }}
          >
            <Plus className="w-4 h-4" /> Add Trade
          </button>
          <button
            onClick={() => setShowAnalyzer((v) => !v)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-indigo-400 transition-all hover:bg-indigo-400/10"
            style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.18)' }}
          >
            <Sparkles className="w-3.5 h-3.5" /> AI Review
          </button>
          <button
            disabled title="CSV import coming soon"
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-500 opacity-50 cursor-not-allowed"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <Upload className="w-3.5 h-3.5" /> Import
          </button>
        </div>

        {/* Glance stats — the four things you check before anything else */}
        {!hasNoTrades && (
          <div className="mx-auto mt-10 grid max-w-3xl grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4 sm:divide-x sm:divide-white/[0.06]">
            <HeroStat
              label="Last Trade"
              value={lastTrade ? lastTrade.instrument : '—'}
              sub={lastTrade ? (lastTrade.outcome === 'Open' ? 'still open' : lastTrade.outcome.toLowerCase()) : 'no trades yet'}
              loading={isLoading}
            />
            <HeroStat
              label="Today's P&L"
              value={tradedToday ? `${todayPnl >= 0 ? '+' : ''}${todayPnl.toFixed(0)}` : '—'}
              sub={tradedToday ? `${tradedToday} closed today` : 'nothing closed today'}
              tone={tradedToday ? (todayPnl >= 0 ? 'pos' : 'neg') : undefined}
              loading={isLoading}
            />
            <HeroStat
              label="Win Rate"
              value={kpis?.winRate?.formatted ?? '—'}
              sub={period === 'ALL' ? 'all time' : period}
              loading={isLoading}
            />
            <HeroStat
              label="Open Trades"
              value={String(openTrades)}
              sub={openTrades === 1 ? 'position running' : 'positions running'}
              loading={isLoading}
            />
          </div>
        )}
      </header>

      {/* AI Analyzer (collapsible) */}
      {showAnalyzer && (
        <div className="glass-card p-6 mt-10 animate-fadeUp">
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
        <div className="mt-12">
          <EmptyState onAddTrade={() => setShowCapture(true)} />
        </div>
      ) : (
        // 40px between sections (was 12px) — the single biggest readability win
        // on this page after the page gutters themselves.
        <div className="mt-12 space-y-10">
          {/* ═══════════════════════════════════════════════════════════
              KPIs — 2 headline + 4 supporting
          ═══════════════════════════════════════════════════════════ */}
          <KpiStrip bundle={kpis === undefined ? null : kpis} loading={isLoading} />

          {/* ═══════════════════════════════════════════════════════════
              EQUITY CURVE (65%) + CALENDAR (35%)
          ═══════════════════════════════════════════════════════════ */}
          <Section title="Performance" subtitle="Equity progression and daily outcomes">
            <div className="grid grid-cols-1 lg:grid-cols-[65fr_35fr] gap-5">
              <EquityCurveChart
                data={perfData}
                activePeriod={period}
                onPeriodChange={setPeriod}
                loading={isLoading}
              />
              <PerformanceCalendar version={version} />
            </div>
          </Section>

          {/* ═══════════════════════════════════════════════════════════
              AI COACH — promoted above the breakdown cards; this is the
              page's differentiator and it used to sit four rows down.
          ═══════════════════════════════════════════════════════════ */}
          <Section title="AI Trade Coach" subtitle="Behavioural patterns detected across your history">
            <AIPerformanceCenter insights={aiInsights} loading={isLoading} />
          </Section>

          {/* ═══════════════════════════════════════════════════════════
              TRADING BREAKDOWN (4 cards)
          ═══════════════════════════════════════════════════════════ */}
          <Section title="Breakdown" subtitle="Where the results are actually coming from">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
              <TradesBreakdownCard data={breakdown === undefined ? null : breakdown} loading={isLoading} />
              <LongShortCard data={longShort === undefined ? null : longShort} loading={isLoading} />
              <BestSetupsCard setups={bestSetups} loading={isLoading} />
              <TopSymbolsCard symbols={topSymbols} loading={isLoading} />
            </div>
          </Section>

          {/* ═══════════════════════════════════════════════════════════
              SCORE + IMPROVEMENT
          ═══════════════════════════════════════════════════════════ */}
          <Section title="Discipline" subtitle="Execution quality and what to work on next">
            <div className="space-y-5">
              <TraderScoreCard
                score={traderScore ?? { overall: null, execution: null, riskManagement: null, consistency: null, discipline: null }}
                loading={isLoading || traderScore === undefined}
              />
              <ImprovementCenter
                snapshot={snapshot === undefined ? null : snapshot}
                loading={isLoading}
              />
            </div>
          </Section>

          {/* ═══════════════════════════════════════════════════════════
              RECENT TRADES
          ═══════════════════════════════════════════════════════════ */}
          <Section title="Activity" subtitle="Your most recent closed positions">
            <RecentTradesTable trades={recentTrades.slice(0, 10)} loading={isLoading} />
          </Section>

          {/* ═══════════════════════════════════════════════════════════
              EXPANDED TRADE TABLE (collapsible — full existing UI)
          ═══════════════════════════════════════════════════════════ */}
          <div>
            <button
              onClick={() => setShowTradeList((v) => !v)}
              className="flex items-center gap-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors w-full justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
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
              <div className="grid grid-cols-1 lg:grid-cols-[65fr_35fr] gap-5 mt-4 animate-fadeIn">
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
        </div>
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
