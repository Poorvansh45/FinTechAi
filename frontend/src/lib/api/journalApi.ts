/**
 * journalApi.ts  (full rewrite — additive, backward-compatible)
 * ─────────────────────────────────────────────────────────────────────────────
 * Service layer for the Trading Journal dashboard.
 * Currently localStorage-backed. All signatures are FastAPI-ready.
 * Swap function bodies to fetch('/api/v2/journal/...') when endpoints exist.
 *
 * ⛔ DO NOT add mock/random data. Empty state = typed null/empty arrays.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { listSetups, listTradesBySetup } from '@/lib/journal/storage';
import { derive, type Trade } from '@/lib/journal/types';
import {
  computeBehaviorInsights,
  computePerformanceSummary,
} from '@/lib/journal/behavior-analytics';

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC INTERFACES  (FastAPI contract — do not change shapes)
// ═══════════════════════════════════════════════════════════════════════════════

export interface JournalStats {
  totalPnl: number;
  winRate: number;           // 0–100
  profitFactor: number;
  avgRR: number | null;
  totalTrades: number;       // closed only
  bestDay: string;
  openTrades: number;
}

export interface TradeSummary {
  id: string;
  instrument: string;
  side: 'Buy' | 'Sell';
  pnl: number | null;
  pnlPct: number | null;
  rMultiple: number | null;
  durationMin: number | null;
  entryAt: string;
  exitAt: string | null;
  entryPrice: number;
  exitPrice: number | null;
  setupName: string;
  outcome: 'Win' | 'Loss' | 'Open' | 'Breakeven';
  marketType: string;
}

export interface PerformancePoint {
  label: string;
  equity: number;
}

export interface AIInsight {
  id: string;
  type: 'session' | 'setup' | 'risk' | 'improvement' | 'streak';
  title: string;
  body: string;
  severity: 'positive' | 'warn' | 'info';
}

export interface PerformanceSnapshot {
  bestSetup: string;
  worstSetup: string;
  bestSession: string;
  worstSession: string;
  avgHoldMinutes: number | null;
  avgRR: number | null;
  mostTradedInstrument: string;
  currentStreak: number;
}

export interface TraderScore {
  overall: number | null;
  execution: number | null;
  riskManagement: number | null;
  consistency: number | null;
  discipline: number | null;
}

/** KPI card with sparkline and period-over-period comparison */
export interface KpiMetric {
  label: string;
  value: number;
  formatted: string;         // display string e.g. "+$2,450.75"
  change: number | null;     // % change vs previous equal period, null if not computable
  sparkline: number[];       // last N equity/pnl values for mini chart
  positive: boolean;
}

export interface KpiBundle {
  totalPnl: KpiMetric;
  winRate: KpiMetric;
  profitFactor: KpiMetric;
  expectancy: KpiMetric;
  maxDrawdown: KpiMetric;
  totalTrades: KpiMetric;
}

/** Calendar heatmap — one entry per day that had trades */
export interface CalendarDay {
  date: string;              // ISO yyyy-mm-dd
  pnl: number;
  tradeCount: number;
  type: 'profit' | 'loss' | 'breakeven';
}

export interface TradesBreakdown {
  total: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number;           // 0–100
  lossRate: number;
  beRate: number;
}

export interface LongShortBreakdown {
  total: number;
  longs: number;
  shorts: number;
  longWinRate: number;       // 0–100
  shortWinRate: number;
  longPnl: number;
  shortPnl: number;
}

export interface SetupPerformance {
  name: string;
  tradeCount: number;
  totalPnl: number;
  winRate: number;
}

export interface SymbolPerformance {
  symbol: string;
  tradeCount: number;
  totalPnl: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTERNAL HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getAllTrades(): Trade[] {
  const setups = listSetups();
  return setups
    .flatMap((s) => listTradesBySetup(s.id))
    .sort((a, b) => new Date(b.entryAt).getTime() - new Date(a.entryAt).getTime());
}

function getSetupName(setupId: string): string {
  return listSetups().find((s) => s.id === setupId)?.name ?? '—';
}

function outcomeOf(trade: Trade, pnl: number | null): TradeSummary['outcome'] {
  if (trade.exitPrice == null) return 'Open';
  if (pnl == null || Math.abs(pnl) < 0.01) return 'Breakeven';
  return pnl > 0 ? 'Win' : 'Loss';
}

function computeProfitFactor(pnls: number[]): number {
  const gross = pnls.filter((p) => p > 0).reduce((a, b) => a + b, 0);
  const loss  = Math.abs(pnls.filter((p) => p < 0).reduce((a, b) => a + b, 0));
  if (loss === 0) return gross > 0 ? 99 : 0;
  return parseFloat((gross / loss).toFixed(2));
}

function computeExpectancy(pnls: number[]): number {
  if (!pnls.length) return 0;
  const wins     = pnls.filter((p) => p > 0);
  const losses   = pnls.filter((p) => p < 0);
  const winRate  = wins.length / pnls.length;
  const avgWin   = wins.length   ? wins.reduce((a, b) => a + b, 0) / wins.length   : 0;
  const avgLoss  = losses.length ? Math.abs(losses.reduce((a, b) => a + b, 0) / losses.length) : 0;
  return parseFloat((winRate * avgWin - (1 - winRate) * avgLoss).toFixed(2));
}

function computeMaxDrawdown(pnls: number[]): number {
  let peak = 0, equity = 0, maxDD = 0;
  for (const p of pnls) {
    equity += p;
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > maxDD) maxDD = dd;
  }
  return parseFloat(maxDD.toFixed(2));
}

function filterByPeriod(trades: Trade[], period: string): Trade[] {
  if (period === 'ALL') return trades;
  const ms: Record<string, number> = {
    '1W': 7 * 864e5, '1M': 30 * 864e5, '3M': 90 * 864e5,
    '6M': 180 * 864e5, '1Y': 365 * 864e5,
  };
  const cutoff = Date.now() - (ms[period] ?? 0);
  return trades.filter((t) => new Date(t.entryAt).getTime() >= cutoff);
}

function toSparkline(pnls: number[], n = 12): number[] {
  // Cumulative equity curve sampled to last N points
  let cum = 0;
  const curve = pnls.map((p) => { cum += p; return cum; });
  if (curve.length <= n) return curve;
  return curve.slice(curve.length - n);
}

function fmt(val: number, prefix = '', decimals = 2): string {
  const abs = Math.abs(val).toFixed(decimals);
  const sign = val >= 0 ? '+' : '-';
  return `${sign}${prefix}${abs}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC SERVICE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export async function getDashboardStats(): Promise<JournalStats | null> {
  const trades  = getAllTrades();
  const closed  = trades.filter((t) => t.exitPrice != null);
  if (trades.length === 0) return null;

  const pnls    = closed.map((t) => derive(t).pnl ?? 0);
  const wins    = pnls.filter((p) => p > 0);
  const winRate = pnls.length ? (wins.length / pnls.length) * 100 : 0;
  const rrs     = closed.map((t) => derive(t).rr).filter((r): r is number => r !== null && r > 0);
  const avgRR   = rrs.length ? parseFloat((rrs.reduce((a, b) => a + b, 0) / rrs.length).toFixed(2)) : null;
  const summary = computePerformanceSummary(trades, getSetupName);

  return {
    totalPnl: parseFloat(pnls.reduce((a, b) => a + b, 0).toFixed(2)),
    winRate: parseFloat(winRate.toFixed(1)),
    profitFactor: computeProfitFactor(pnls),
    avgRR,
    totalTrades: closed.length,
    bestDay: summary.bestDay ?? '—',
    openTrades: trades.filter((t) => t.exitPrice == null).length,
  };
}

/** KPI bundle with sparklines and period-over-period change */
export async function getKpiBundle(period = 'ALL'): Promise<KpiBundle | null> {
  const allTrades = getAllTrades();
  const closed    = allTrades.filter((t) => t.exitPrice != null).reverse(); // chronological
  if (closed.length === 0) return null;

  const current  = filterByPeriod([...closed].reverse(), period).reverse();
  const pnls     = current.map((t) => derive(t).pnl ?? 0);

  // Previous equal period for comparison
  const ms: Record<string, number> = {
    '1W': 7 * 864e5, '1M': 30 * 864e5, '3M': 90 * 864e5,
    '6M': 180 * 864e5, '1Y': 365 * 864e5,
  };
  const periodMs = ms[period];
  let prev: Trade[] = [];
  if (periodMs) {
    const now    = Date.now();
    const start  = now - periodMs;
    const pStart = start - periodMs;
    prev = closed.filter((t) => {
      const ts = new Date(t.entryAt).getTime();
      return ts >= pStart && ts < start;
    });
  }
  const prevPnls = prev.map((t) => derive(t).pnl ?? 0);

  const totalPnl     = parseFloat(pnls.reduce((a, b) => a + b, 0).toFixed(2));
  const prevTotalPnl = parseFloat(prevPnls.reduce((a, b) => a + b, 0).toFixed(2));
  const wins         = pnls.filter((p) => p > 0);
  const winRate      = pnls.length ? (wins.length / pnls.length) * 100 : 0;
  const prevWins     = prevPnls.filter((p) => p > 0);
  const prevWinRate  = prevPnls.length ? (prevWins.length / prevPnls.length) * 100 : 0;
  const pf           = computeProfitFactor(pnls);
  const prevPf       = computeProfitFactor(prevPnls);
  const exp          = computeExpectancy(pnls);
  const prevExp      = computeExpectancy(prevPnls);
  const maxDD        = computeMaxDrawdown(pnls);
  const prevMaxDD    = computeMaxDrawdown(prevPnls);
  const n            = current.length;
  const prevN        = prev.length;

  const changePct = (cur: number, prv: number) =>
    prv !== 0 ? parseFloat(((cur - prv) / Math.abs(prv) * 100).toFixed(1)) : null;

  return {
    totalPnl:    { label: 'Total P&L',     value: totalPnl,  formatted: fmt(totalPnl, '$'),         change: prevPnls.length ? changePct(totalPnl, prevTotalPnl) : null, sparkline: toSparkline(pnls),     positive: totalPnl >= 0 },
    winRate:     { label: 'Win Rate',       value: winRate,   formatted: fmt(winRate, '', 1) + '%',  change: prevPnls.length ? changePct(winRate, prevWinRate) : null,    sparkline: toSparkline(wins.map(() => 1).concat(pnls.filter(p => p <= 0).map(() => 0))), positive: winRate >= 50 },
    profitFactor:{ label: 'Profit Factor',  value: pf,        formatted: pf > 50 ? '∞' : String(pf),change: prevPnls.length ? changePct(pf, prevPf) : null,              sparkline: toSparkline(pnls),     positive: pf >= 1 },
    expectancy:  { label: 'Expectancy',     value: exp,       formatted: fmt(exp, '$'),              change: prevPnls.length ? changePct(exp, prevExp) : null,            sparkline: toSparkline(pnls),     positive: exp >= 0 },
    maxDrawdown: { label: 'Max Drawdown',   value: -maxDD,    formatted: fmt(-maxDD, '$'),           change: prevPnls.length ? changePct(maxDD, prevMaxDD) : null,        sparkline: toSparkline(pnls),     positive: false },
    totalTrades: { label: 'Total Trades',   value: n,         formatted: String(n),                 change: prevN !== 0 ? changePct(n, prevN) : null,                   sparkline: [],                    positive: true },
  };
}

export async function getRecentTrades(limit = 10): Promise<TradeSummary[]> {
  const trades = getAllTrades().slice(0, limit);
  return trades.map((t) => {
    const d = derive(t);
    const pnl = d.pnl;
    return {
      id: t.id,
      instrument: t.instrument,
      side: t.side,
      pnl,
      pnlPct: d.pct,
      rMultiple: d.rr,
      durationMin: d.durationMin,
      entryAt: t.entryAt,
      exitAt: t.exitAt ?? null,
      entryPrice: t.entryPrice,
      exitPrice: t.exitPrice ?? null,
      setupName: getSetupName(t.setupId),
      outcome: outcomeOf(t, pnl),
      marketType: t.marketType,
    };
  });
}

export async function getPerformanceData(period = 'ALL'): Promise<PerformancePoint[]> {
  const all = getAllTrades()
    .filter((t) => t.exitPrice != null)
    .sort((a, b) => new Date(a.entryAt).getTime() - new Date(b.entryAt).getTime());
  const filtered = filterByPeriod(all, period);
  let cum = 0;
  return filtered.map((t, i) => {
    cum += derive(t).pnl ?? 0;
    const date = new Date(t.entryAt);
    const label = period === 'ALL' || period === '1Y'
      ? date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
      : `T${i + 1}`;
    return { label, equity: parseFloat(cum.toFixed(2)) };
  });
}

export async function getCalendarData(year: number, month: number): Promise<CalendarDay[]> {
  const trades = getAllTrades().filter((t) => t.exitPrice != null);
  const dayMap: Record<string, { pnl: number; count: number }> = {};

  for (const t of trades) {
    const d = new Date(t.entryAt);
    if (d.getFullYear() !== year || d.getMonth() !== month) continue;
    const key = d.toISOString().slice(0, 10);
    const pnl = derive(t).pnl ?? 0;
    if (!dayMap[key]) dayMap[key] = { pnl: 0, count: 0 };
    dayMap[key].pnl    += pnl;
    dayMap[key].count  += 1;
  }

  return Object.entries(dayMap).map(([date, v]) => ({
    date,
    pnl: parseFloat(v.pnl.toFixed(2)),
    tradeCount: v.count,
    type: Math.abs(v.pnl) < 0.01 ? 'breakeven' : v.pnl > 0 ? 'profit' : 'loss',
  }));
}

export async function getTradesBreakdown(): Promise<TradesBreakdown | null> {
  const closed = getAllTrades().filter((t) => t.exitPrice != null);
  if (!closed.length) return null;
  const pnls     = closed.map((t) => derive(t).pnl ?? 0);
  const wins     = pnls.filter((p) => p > 0.01).length;
  const losses   = pnls.filter((p) => p < -0.01).length;
  const be       = pnls.filter((p) => Math.abs(p) <= 0.01).length;
  const total    = closed.length;
  return {
    total, wins, losses, breakeven: be,
    winRate:  parseFloat(((wins / total) * 100).toFixed(1)),
    lossRate: parseFloat(((losses / total) * 100).toFixed(1)),
    beRate:   parseFloat(((be / total) * 100).toFixed(1)),
  };
}

export async function getLongShortBreakdown(): Promise<LongShortBreakdown | null> {
  const closed = getAllTrades().filter((t) => t.exitPrice != null);
  if (!closed.length) return null;
  const longs  = closed.filter((t) => t.side === 'Buy');
  const shorts = closed.filter((t) => t.side === 'Sell');
  const wRate  = (arr: Trade[]) => {
    if (!arr.length) return 0;
    const w = arr.filter((t) => (derive(t).pnl ?? 0) > 0).length;
    return parseFloat(((w / arr.length) * 100).toFixed(1));
  };
  const sumPnl = (arr: Trade[]) => parseFloat(arr.reduce((a, t) => a + (derive(t).pnl ?? 0), 0).toFixed(2));
  return {
    total: closed.length,
    longs: longs.length,
    shorts: shorts.length,
    longWinRate: wRate(longs),
    shortWinRate: wRate(shorts),
    longPnl: sumPnl(longs),
    shortPnl: sumPnl(shorts),
  };
}

export async function getBestSetups(limit = 4): Promise<SetupPerformance[]> {
  const closed  = getAllTrades().filter((t) => t.exitPrice != null);
  const map: Record<string, { pnl: number; wins: number; n: number }> = {};
  for (const t of closed) {
    const name = getSetupName(t.setupId);
    if (!map[name]) map[name] = { pnl: 0, wins: 0, n: 0 };
    const pnl = derive(t).pnl ?? 0;
    map[name].pnl  += pnl;
    map[name].n    += 1;
    if (pnl > 0) map[name].wins += 1;
  }
  return Object.entries(map)
    .map(([name, v]) => ({
      name,
      tradeCount: v.n,
      totalPnl: parseFloat(v.pnl.toFixed(2)),
      winRate: parseFloat(((v.wins / v.n) * 100).toFixed(1)),
    }))
    .sort((a, b) => b.totalPnl - a.totalPnl)
    .slice(0, limit);
}

export async function getTopSymbols(limit = 4): Promise<SymbolPerformance[]> {
  const closed = getAllTrades().filter((t) => t.exitPrice != null);
  const map: Record<string, { pnl: number; n: number }> = {};
  for (const t of closed) {
    if (!map[t.instrument]) map[t.instrument] = { pnl: 0, n: 0 };
    map[t.instrument].pnl += derive(t).pnl ?? 0;
    map[t.instrument].n   += 1;
  }
  return Object.entries(map)
    .map(([symbol, v]) => ({ symbol, tradeCount: v.n, totalPnl: parseFloat(v.pnl.toFixed(2)) }))
    .sort((a, b) => b.totalPnl - a.totalPnl)
    .slice(0, limit);
}

export async function getAIInsights(): Promise<AIInsight[]> {
  const trades = getAllTrades();
  const raw = computeBehaviorInsights(trades, getSetupName);
  return raw.map((r) => {
    let type: AIInsight['type'] = 'improvement';
    if (r.id === 'session') type = 'session';
    else if (r.id === 'setup') type = 'setup';
    else if (r.id === 'streak' || r.id === 'fri') type = 'risk';
    else if (r.id === 'reversal') type = 'improvement';
    const title =
      r.id === 'session' ? 'Best Session Found' :
      r.id === 'setup'   ? 'Best Setup Identified' :
      r.id === 'streak'  ? 'Risk Warning' :
      r.id === 'fri'     ? 'Friday Pattern' : 'Setup Improvement';
    return { id: r.id, type, title, body: r.text, severity: r.severity ?? 'info' };
  });
}

export async function getPerformanceSnapshot(): Promise<PerformanceSnapshot | null> {
  const trades = getAllTrades();
  const closed = trades.filter((t) => t.exitPrice != null);
  if (!closed.length) return null;
  const setupPnl: Record<string, number>   = {};
  const sessionPnl: Record<string, number> = {};
  const instrCount: Record<string, number> = {};
  let holdSum = 0, holdCount = 0, rrSum = 0, rrCount = 0;

  for (const t of closed) {
    const d   = derive(t);
    const pnl = d.pnl ?? 0;
    const sn  = getSetupName(t.setupId);
    setupPnl[sn] = (setupPnl[sn] ?? 0) + pnl;
    const sess = (() => {
      if (t.session) return t.session;
      const c = t.comments ?? '';
      if (c.includes('London')) return 'London';
      if (c.includes('NY') || c.includes('New York')) return 'NY';
      if (c.includes('Asian')) return 'Asian';
      return 'Unknown';
    })();
    sessionPnl[sess] = (sessionPnl[sess] ?? 0) + pnl;
    instrCount[t.instrument] = (instrCount[t.instrument] ?? 0) + 1;
    if (d.durationMin != null && d.durationMin >= 0) { holdSum += d.durationMin; holdCount++; }
    if (d.rr != null && d.rr > 0) { rrSum += d.rr; rrCount++; }
  }

  const ss = Object.entries(setupPnl).sort((a, b) => b[1] - a[1]);
  const sl = Object.entries(sessionPnl).filter(([k]) => k !== 'Unknown').sort((a, b) => b[1] - a[1]);
  const si = Object.entries(instrCount).sort((a, b) => b[1] - a[1]);

  let streak = 0;
  const sorted = [...closed].sort((a, b) => new Date(b.entryAt).getTime() - new Date(a.entryAt).getTime());
  for (const t of sorted) {
    const pnl = derive(t).pnl ?? 0;
    if (streak === 0) { streak = pnl > 0 ? 1 : pnl < 0 ? -1 : 0; }
    else if (streak > 0 && pnl > 0) streak++;
    else if (streak < 0 && pnl < 0) streak--;
    else break;
  }
  return {
    bestSetup: ss[0]?.[0] ?? '—', worstSetup: ss[ss.length - 1]?.[0] ?? '—',
    bestSession: sl[0]?.[0] ?? '—', worstSession: sl[sl.length - 1]?.[0] ?? '—',
    avgHoldMinutes: holdCount > 0 ? Math.round(holdSum / holdCount) : null,
    avgRR: rrCount > 0 ? parseFloat((rrSum / rrCount).toFixed(2)) : null,
    mostTradedInstrument: si[0]?.[0] ?? '—',
    currentStreak: streak,
  };
}

export async function getTraderScore(): Promise<TraderScore> {
  const trades = getAllTrades();
  const closed = trades.filter((t) => t.exitPrice != null);
  if (closed.length < 3) return { overall: null, execution: null, riskManagement: null, consistency: null, discipline: null };

  const pnls     = closed.map((t) => derive(t).pnl ?? 0);
  const wins     = pnls.filter((p) => p > 0).length;
  const winRate  = wins / pnls.length;

  const withCriteria = closed.filter((t) => t.criteriaMet != null).length;
  const criteriaMet  = closed.filter((t) => t.criteriaMet === true).length;
  const execution    = withCriteria > 0 ? Math.round((criteriaMet / withCriteria) * 100) : Math.round(winRate * 80);

  const withSL       = closed.filter((t) => t.stopLoss != null).length;
  const riskManagement = Math.round((withSL / closed.length) * 100);

  const mean    = pnls.reduce((a, b) => a + b, 0) / pnls.length;
  const variance = pnls.map((p) => (p - mean) ** 2).reduce((a, b) => a + b, 0) / pnls.length;
  const cv      = mean !== 0 ? Math.sqrt(variance) / Math.abs(mean) : 1;
  const consistency = Math.max(0, Math.min(100, Math.round(100 - cv * 30)));

  const withConf = closed.filter((t) => t.confidence != null);
  const avgConf  = withConf.length ? withConf.reduce((a, t) => a + (t.confidence ?? 5), 0) / withConf.length : 5;
  const discipline = Math.round((avgConf / 10) * 100);

  const overall = Math.round((execution + riskManagement + consistency + discipline) / 4);
  return { overall, execution, riskManagement, consistency, discipline };
}
