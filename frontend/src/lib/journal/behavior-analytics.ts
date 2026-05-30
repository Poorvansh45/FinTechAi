import { derive, getTradeSession, type Trade } from './types';

export interface BehaviorInsight {
  id: string;
  text: string;
  severity?: 'info' | 'warn' | 'positive';
}

export function computeBehaviorInsights(trades: Trade[], setupName: (id: string) => string): BehaviorInsight[] {
  const closed = trades.filter((t) => t.exitPrice != null);
  if (closed.length < 3) {
    return [{ id: 'few', text: 'Log more closed trades to unlock behavioral pattern detection.', severity: 'info' }];
  }

  const insights: BehaviorInsight[] = [];

  const bySession: Record<string, { wins: number; n: number }> = {};
  closed.forEach((t) => {
    const s = getTradeSession(t) ?? 'Unknown';
    if (!bySession[s]) bySession[s] = { wins: 0, n: 0 };
    bySession[s].n++;
    if ((derive(t).pnl ?? 0) > 0) bySession[s].wins++;
  });
  const bestSession = Object.entries(bySession).sort(
    (a, b) => b[1].wins / b[1].n - a[1].wins / a[1].n
  )[0];
  if (bestSession && bestSession[0] !== 'Unknown') {
    insights.push({
      id: 'session',
      text: `Best performance during ${bestSession[0]} session (${((bestSession[1].wins / bestSession[1].n) * 100).toFixed(0)}% win rate).`,
      severity: 'positive',
    });
  }

  const dayMap: Record<number, { wins: number; n: number }> = {};
  closed.forEach((t) => {
    const d = new Date(t.entryAt).getDay();
    if (!dayMap[d]) dayMap[d] = { wins: 0, n: 0 };
    dayMap[d].n++;
    if ((derive(t).pnl ?? 0) > 0) dayMap[d].wins++;
  });
  const fri = dayMap[5];
  if (fri && fri.n >= 2 && fri.wins / fri.n < 0.4) {
    insights.push({ id: 'fri', text: 'Friday trades underperform — consider reducing size or skipping.', severity: 'warn' });
  }

  let streak = 0;
  let afterLossWr = { wins: 0, n: 0 };
  for (const t of [...closed].sort((a, b) => new Date(a.entryAt).getTime() - new Date(b.entryAt).getTime())) {
    const pnl = derive(t).pnl ?? 0;
    if (pnl < 0) {
      streak++;
      if (streak >= 2) afterLossWr.n++;
      if (streak >= 2 && pnl > 0) afterLossWr.wins++;
    } else {
      if (streak >= 2) {
        afterLossWr.n++;
        if (pnl > 0) afterLossWr.wins++;
      }
      streak = 0;
    }
  }
  if (afterLossWr.n >= 3 && afterLossWr.wins / afterLossWr.n < 0.35) {
    insights.push({
      id: 'streak',
      text: 'Win rate drops after 2 consecutive losses — pause and reset process.',
      severity: 'warn',
    });
  }

  const setupPerf: Record<string, { wins: number; n: number }> = {};
  closed.forEach((t) => {
    const name = setupName(t.setupId);
    if (!setupPerf[name]) setupPerf[name] = { wins: 0, n: 0 };
    setupPerf[name].n++;
    if ((derive(t).pnl ?? 0) > 0) setupPerf[name].wins++;
  });
  const sorted = Object.entries(setupPerf).filter(([, v]) => v.n >= 2).sort(
    (a, b) => b[1].wins / b[1].n - a[1].wins / a[1].n
  );
  if (sorted[0]) {
    insights.push({
      id: 'setup',
      text: `Momentum setups (${sorted[0][0]}) outperform others in your journal.`,
      severity: 'positive',
    });
  }

  const tags = closed.flatMap((t) => t.setupTag ?? t.entryModel ?? []).filter(Boolean);
  if (tags.some((t) => /reversal/i.test(String(t)))) {
    insights.push({
      id: 'reversal',
      text: 'Reversal setups show mixed results — tighten confirmation rules.',
      severity: 'info',
    });
  }

  return insights.slice(0, 6);
}

export function computePerformanceSummary(trades: Trade[], setupName: (id: string) => string) {
  const closed = trades.filter((t) => t.exitPrice != null);
  const setupPerf: Record<string, number> = {};
  const sessionPerf: Record<string, number> = {};
  const dayPerf: Record<string, number> = {};
  const instrPerf: Record<string, number> = {};

  closed.forEach((t) => {
    const pnl = derive(t).pnl ?? 0;
    const sn = setupName(t.setupId);
    setupPerf[sn] = (setupPerf[sn] ?? 0) + pnl;
    const sess = getTradeSession(t) ?? 'Unknown';
    sessionPerf[sess] = (sessionPerf[sess] ?? 0) + pnl;
    const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(t.entryAt).getDay()];
    dayPerf[day] = (dayPerf[day] ?? 0) + pnl;
    instrPerf[t.instrument] = (instrPerf[t.instrument] ?? 0) + pnl;
  });

  const top = (m: Record<string, number>) =>
    Object.entries(m).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

  return {
    bestSetup: top(setupPerf),
    strongestSession: top(sessionPerf),
    bestDay: top(dayPerf),
    topInstrument: top(instrPerf),
    worstBehavior:
      closed.filter((t) => (derive(t).pnl ?? 0) < 0).length > closed.length * 0.55
        ? 'Overtrading after losses'
        : 'Late session entries',
  };
}
