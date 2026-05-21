export type UUID = string;

export type MarketType = 'Indices' | 'Stocks' | 'FNO' | 'Forex' | 'Crypto';
export type Side = 'Buy' | 'Sell';

export type Setup = {
  id: UUID;
  name: string;
  marketType: MarketType;
  tags?: string[];
  params: {
    entryCriteria?: string;
    stopLoss?: string;
    target?: string;
    riskRules?: string;
    notes?: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type Trade = {
  id: UUID;
  setupId: UUID;
  instrument: string;
  marketType: MarketType;
  side: Side;
  entryPrice: number;
  exitPrice?: number | null;
  entryAt: string;
  exitAt?: string | null;
  quantity: number; // lots for Forex, shares for Stocks, contracts for FNO
  comments?: string;
  criteriaMet?: boolean;
  criteriaNotes?: string;
  entryModel?: string;
  // Optional overrides
  pipSize?: number;
  pipValue?: number;
  pointValue?: number;
  stopLoss?: number;
  target?: number;
};

export type TradeDerived = {
  pnl: number | null;
  pct: number | null;
  points: number | null;
  pips: number | null;
  rMultiple: number | null;
  durationMin: number | null;
  rr: number | null;
};

export type SetupStats = {
  totalTrades: number;
  winRate: number;
  avgReturnPct: number;
  bestPct: number;
  worstPct: number;
};

/**
 * Infer pip size based on instrument symbol.
 * 
 * XAUUSD (Gold):
 *   - Price moves in 0.01 increments (e.g. 2300.50 → 2300.51 = 1 pip)
 *   - 1 pip = $0.01; with 1 standard lot (100 oz) → pip value = $1 per 0.01
 *   - Formula: pips = (exit − entry) / 0.01
 *   - P&L = pips × lot_size × $1   (for XAUUSD, 1 lot = $1/pip by standard)
 * 
 * USDJPY / JPY pairs:
 *   - pip size = 0.01
 *
 * Standard Forex (EURUSD, GBPUSD, etc.):
 *   - pip size = 0.0001
 *   - pip value per standard lot = $10 (default)
 */
function inferPipSize(instr: string): number {
  const s = (instr || '').toUpperCase();
  if (s.includes('XAU') || s.includes('GOLD')) return 0.01;
  if (s.includes('JPY')) return 0.01;
  if (s.includes('XAG') || s.includes('SILVER')) return 0.001;
  return 0.0001; // standard forex default
}

/**
 * Infer pip value (profit per pip per lot).
 * XAUUSD: $1 per pip per lot (standard lot = 100 oz; $0.01 move × 100 oz = $1)
 * Standard Forex: $10 per pip per standard lot
 */
function inferPipValue(instr: string): number {
  const s = (instr || '').toUpperCase();
  if (s.includes('XAU') || s.includes('GOLD')) return 1;    // $1/pip/lot
  if (s.includes('XAG') || s.includes('SILVER')) return 50; // silver approximation
  if (s.includes('JPY')) return 7;  // ~$7/pip/standard lot for JPY
  return 10; // standard forex: $10/pip/lot
}

export function derive(trade: Trade): TradeDerived {
  if (trade.exitPrice == null) {
    return { pnl: null, pct: null, points: null, pips: null, rMultiple: null, durationMin: null, rr: null };
  }

  const dir = trade.side === 'Buy' ? 1 : -1;
  const priceDiff = (trade.exitPrice - trade.entryPrice) * dir;
  const pct = trade.entryPrice > 0 ? (priceDiff / trade.entryPrice) * 100 : 0;
  const points = priceDiff;

  let pips: number | null = null;
  let pnl: number;

  if (trade.marketType === 'Forex') {
    const pipSize = trade.pipSize ?? inferPipSize(trade.instrument);
    const pipVal = trade.pipValue ?? inferPipValue(trade.instrument);
    pips = parseFloat((priceDiff / pipSize).toFixed(1));
    pnl = parseFloat((pips * pipVal * (trade.quantity || 1)).toFixed(2));
  } else if (trade.marketType === 'Crypto') {
    // Crypto: direct price × quantity
    pnl = parseFloat((priceDiff * (trade.quantity || 1)).toFixed(2));
  } else {
    // Stocks, Indices, FNO: points × pointValue × quantity
    const pointValue = trade.pointValue ?? 1;
    pnl = parseFloat((points * pointValue * (trade.quantity || 1)).toFixed(2));
  }

  // R:R from stored SL/Target if available
  let rr: number | null = null;
  if (trade.stopLoss && trade.target && trade.entryPrice) {
    const risk = Math.abs(trade.entryPrice - trade.stopLoss);
    const reward = Math.abs(trade.target - trade.entryPrice);
    rr = risk > 0 ? parseFloat((reward / risk).toFixed(2)) : null;
  }

  const start = new Date(trade.entryAt).getTime();
  const end = new Date(trade.exitAt ?? trade.entryAt).getTime();
  const durationMin = Math.max(0, Math.round((end - start) / 60000));

  return { pnl, pct, points, pips, rMultiple: null, durationMin, rr };
}
