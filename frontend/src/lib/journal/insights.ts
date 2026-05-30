import { derive, getTradeSession, type Trade } from './types';

export interface TradeInsightResult {
  snapshot: {
    instrument: string;
    direction: string;
    pnl: number | null;
    rr: number | null;
    durationMin: number | null;
    session: string;
    outcome: 'Win' | 'Loss' | 'Open' | 'Breakeven';
  };
  reviews: string[];
  executionScore: number;
  behaviorTags: string[];
  keyImprovement: string;
}

function outcomeFromTrade(trade: Trade, pnl: number | null): TradeInsightResult['snapshot']['outcome'] {
  if (trade.exitPrice == null) return 'Open';
  if (pnl == null || Math.abs(pnl) < 0.01) return 'Breakeven';
  return pnl > 0 ? 'Win' : 'Loss';
}

export function buildTradeInsights(trade: Trade, setupName: string): TradeInsightResult {
  const m = derive(trade);
  const pnl = m.pnl;
  const outcome = outcomeFromTrade(trade, pnl);
  const session = getTradeSession(trade) ?? '—';
  const rr = m.rr ?? null;

  const reviews: string[] = [];
  if (trade.criteriaMet) reviews.push('Setup criteria were met — disciplined entry alignment.');
  if (outcome === 'Win' && (rr ?? 0) >= 1.5) reviews.push('Strong risk-reward achieved on this close.');
  if (outcome === 'Win' && (m.durationMin ?? 0) < 120) reviews.push('Quick capture — momentum played out efficiently.');
  if (outcome === 'Loss' && trade.stopLoss) reviews.push('Stop placement respected — loss contained by plan.');
  if (outcome === 'Loss' && !trade.criteriaMet) reviews.push('Criteria not fully met — review entry checklist.');
  if ((trade.confidence ?? 7) >= 8) reviews.push('High confidence entry — execution matched conviction.');
  if ((trade.confidence ?? 7) <= 4) reviews.push('Low confidence trade — consider smaller size or skip.');
  if (setupName.toLowerCase().includes('breakout')) reviews.push('Breakout context — watch for late chase entries.');
  if (setupName.toLowerCase().includes('liquidity') || trade.setupTag?.includes('sweep')) {
    reviews.push('Liquidity sweep respected in setup framing.');
  }
  if (reviews.length === 0) reviews.push('Trade logged — add more session notes for richer AI review.');

  let executionScore = 50;
  if (trade.criteriaMet) executionScore += 15;
  if (outcome === 'Win') executionScore += 20;
  if (outcome === 'Loss' && trade.stopLoss) executionScore += 10;
  if ((rr ?? 0) >= 2) executionScore += 15;
  else if ((rr ?? 0) >= 1) executionScore += 8;
  if ((trade.confidence ?? 5) >= 7) executionScore += 5;
  executionScore = Math.min(100, Math.max(0, executionScore));

  const behaviorTags: string[] = [];
  if (trade.criteriaMet && (trade.confidence ?? 0) >= 7) behaviorTags.push('disciplined');
  if ((trade.confidence ?? 10) <= 4) behaviorTags.push('uncertain');
  if (trade.emotionTags?.some((e) => /fomo|fear|anxious/i.test(e))) behaviorTags.push('impulsive');
  if (trade.emotionTags?.some((e) => /calm|patient|focused/i.test(e))) behaviorTags.push('patient');
  if (outcome === 'Win' && (trade.confidence ?? 0) >= 8) behaviorTags.push('confident execution');
  if (outcome === 'Loss' && !trade.stopLoss) behaviorTags.push('revenge risk');
  if (behaviorTags.length === 0) behaviorTags.push('neutral');

  let keyImprovement = 'Review exit management near key levels for consistency.';
  if (outcome === 'Loss') keyImprovement = 'Wait for full confirmation before entry — patience improves win rate.';
  if (outcome === 'Win' && (rr ?? 0) < 1) {
    keyImprovement = 'Partial profit-taking near resistance could improve risk-reward.';
  }
  if (outcome === 'Open') keyImprovement = 'Define invalidation and partial targets before scaling in.';

  return {
    snapshot: {
      instrument: trade.instrument,
      direction: trade.side,
      pnl,
      rr,
      durationMin: m.durationMin,
      session,
      outcome,
    },
    reviews: reviews.slice(0, 5),
    executionScore,
    behaviorTags: behaviorTags.slice(0, 4),
    keyImprovement,
  };
}
