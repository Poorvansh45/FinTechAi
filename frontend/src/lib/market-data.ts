// ─── Mock market data layer ─────────────────────────────────────
// In production, replace with real API calls to Yahoo Finance / Finnhub

export interface MarketIndex {
  symbol: string;
  name: string;
  value: number;
  change: number;
  changePct: number;
  sparkline: number[];
  momentum: 'strong-bull' | 'bullish' | 'neutral' | 'bearish' | 'strong-bear';
}

export interface IntelItem {
  id: string;
  summary: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  impact: 'high' | 'medium' | 'low';
  timestamp: string;
  source: string;
}

export interface MoverStock {
  symbol: string;
  name: string;
  changePct: number;
  volume: string;
  momentum: string;
}

export interface SectorData {
  name: string;
  changePct: number;
  momentum: 'up' | 'down' | 'flat';
}

export interface WatchlistItem {
  symbol: string;
  price: number;
  changePct: number;
  signal: string;
  trend: 'up' | 'down' | 'flat';
}

export interface RiskItem {
  zone: string;
  level: 'high' | 'medium' | 'low';
  detail: string;
}

// ── Sparkline generators ──
const spark = (base: number, trend: number) =>
  Array.from({ length: 20 }, (_, i) =>
    base + trend * (i / 20) + (Math.random() - 0.5) * base * 0.01
  );

// ── Global Indices ──
export const GLOBAL_INDICES: { region: string; indices: MarketIndex[] }[] = [
  {
    region: 'US Markets',
    indices: [
      { symbol: 'NASDAQ', name: 'NASDAQ Composite', value: 19284.73, change: 238.61, changePct: 1.25, sparkline: spark(19000, 300), momentum: 'bullish' },
      { symbol: 'S&P 500', name: 'S&P 500', value: 5924.51, change: 42.36, changePct: 0.72, sparkline: spark(5880, 50), momentum: 'bullish' },
      { symbol: 'DJI', name: 'Dow Jones', value: 42654.89, change: -87.12, changePct: -0.20, sparkline: spark(42700, -80), momentum: 'neutral' },
    ],
  },
  {
    region: 'Europe',
    indices: [
      { symbol: 'FTSE', name: 'FTSE 100', value: 8684.56, change: 34.21, changePct: 0.40, sparkline: spark(8650, 40), momentum: 'bullish' },
      { symbol: 'DAX', name: 'DAX 40', value: 23628.14, change: 189.45, changePct: 0.81, sparkline: spark(23400, 250), momentum: 'strong-bull' },
      { symbol: 'CAC', name: 'CAC 40', value: 7856.32, change: -12.67, changePct: -0.16, sparkline: spark(7870, -20), momentum: 'neutral' },
    ],
  },
  {
    region: 'Asia',
    indices: [
      { symbol: 'NI225', name: 'Nikkei 225', value: 37753.72, change: 284.09, changePct: 0.76, sparkline: spark(37500, 300), momentum: 'bullish' },
      { symbol: 'HSI', name: 'Hang Seng', value: 23345.67, change: -156.34, changePct: -0.67, sparkline: spark(23500, -160), momentum: 'bearish' },
      { symbol: 'SGXNIFTY', name: 'SGX Nifty', value: 24876.50, change: 112.30, changePct: 0.45, sparkline: spark(24750, 120), momentum: 'bullish' },
    ],
  },
  {
    region: 'Commodities',
    indices: [
      { symbol: 'GOLD', name: 'Gold', value: 3228.40, change: 18.90, changePct: 0.59, sparkline: spark(3210, 20), momentum: 'bullish' },
      { symbol: 'CRUDE', name: 'Crude Oil', value: 62.84, change: -1.23, changePct: -1.92, sparkline: spark(64, -1.5), momentum: 'bearish' },
      { symbol: 'SILVER', name: 'Silver', value: 32.56, change: 0.42, changePct: 1.31, sparkline: spark(32, 0.5), momentum: 'strong-bull' },
    ],
  },
  {
    region: 'Risk Metrics',
    indices: [
      { symbol: 'VIX', name: 'Volatility Index', value: 17.83, change: -1.42, changePct: -7.37, sparkline: spark(19, -1.5), momentum: 'bullish' },
      { symbol: 'DXY', name: 'Dollar Index', value: 100.46, change: -0.34, changePct: -0.34, sparkline: spark(101, -0.5), momentum: 'bearish' },
      { symbol: 'US10Y', name: '10Y Treasury', value: 4.48, change: 0.03, changePct: 0.67, sparkline: spark(4.45, 0.03), momentum: 'neutral' },
    ],
  },
];

// ── Market Intelligence ──
export const INTEL_FEED: IntelItem[] = [
  { id: '1', summary: 'US futures rise ahead of Fed commentary; NASDAQ leads tech-driven rally.', sentiment: 'bullish', impact: 'high', timestamp: '2 min ago', source: 'Market Intel' },
  { id: '2', summary: 'European markets expected positive opening as ECB signals dovish stance.', sentiment: 'bullish', impact: 'medium', timestamp: '8 min ago', source: 'Global Watch' },
  { id: '3', summary: 'Crude oil weakens 1.9% as OPEC+ supply concerns ease; energy sector under pressure.', sentiment: 'bearish', impact: 'high', timestamp: '15 min ago', source: 'Commodity Desk' },
  { id: '4', summary: 'Gold consolidates near $3,230 on weaker dollar; safe-haven demand intact.', sentiment: 'neutral', impact: 'medium', timestamp: '22 min ago', source: 'Precious Metals' },
  { id: '5', summary: 'VIX drops below 18, signaling reduced market volatility; risk-on sentiment grows.', sentiment: 'bullish', impact: 'high', timestamp: '35 min ago', source: 'Volatility Lab' },
  { id: '6', summary: 'China manufacturing PMI misses estimates; Hang Seng falls 0.67%.', sentiment: 'bearish', impact: 'medium', timestamp: '1h ago', source: 'Asia Watch' },
  { id: '7', summary: 'Semiconductor stocks surge as AI infrastructure demand accelerates globally.', sentiment: 'bullish', impact: 'high', timestamp: '1h ago', source: 'Sector Intel' },
  { id: '8', summary: 'Emerging market currencies weaken against strengthening yen; carry trade unwind risk.', sentiment: 'bearish', impact: 'low', timestamp: '2h ago', source: 'FX Desk' },
];

// ── Market Breadth ──
export const MARKET_BREADTH = {
  advances: 1247,
  declines: 682,
  unchanged: 98,
  bullishPct: 61,
  bearishPct: 33,
  neutralPct: 6,
  volumeAboveAvg: 67,
  newHighs: 84,
  newLows: 23,
  momentumScore: 72,
};

// ── Top Movers ──
export const TOP_GAINERS: MoverStock[] = [
  { symbol: 'NVDA', name: 'NVIDIA Corp', changePct: 5.82, volume: '142M', momentum: 'Strong Breakout' },
  { symbol: 'TATAMOTORS', name: 'Tata Motors', changePct: 4.31, volume: '28M', momentum: 'High Volume' },
  { symbol: 'ADANI', name: 'Adani Enterprises', changePct: 3.97, volume: '18M', momentum: 'Momentum Rally' },
  { symbol: 'RELIANCE', name: 'Reliance Ind.', changePct: 2.84, volume: '35M', momentum: 'Accumulation' },
  { symbol: 'INFY', name: 'Infosys', changePct: 2.45, volume: '22M', momentum: 'Steady Rise' },
];

export const TOP_LOSERS: MoverStock[] = [
  { symbol: 'HDFCBANK', name: 'HDFC Bank', changePct: -2.87, volume: '31M', momentum: 'Distribution' },
  { symbol: 'WIPRO', name: 'Wipro Ltd', changePct: -2.34, volume: '15M', momentum: 'Weak Structure' },
  { symbol: 'SBIN', name: 'SBI', changePct: -1.92, volume: '45M', momentum: 'Below Support' },
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel', changePct: -1.56, volume: '12M', momentum: 'Range Breakdown' },
  { symbol: 'SUNPHARMA', name: 'Sun Pharma', changePct: -1.23, volume: '8M', momentum: 'Profit Booking' },
];

export const VOLUME_BREAKOUTS: MoverStock[] = [
  { symbol: 'COALINDIA', name: 'Coal India', changePct: 3.12, volume: '85M', momentum: '4x Avg Volume' },
  { symbol: 'TATAPOWER', name: 'Tata Power', changePct: 2.67, volume: '62M', momentum: '3.2x Avg Volume' },
  { symbol: 'IRCTC', name: 'IRCTC', changePct: 1.98, volume: '45M', momentum: '2.8x Avg Volume' },
  { symbol: 'ITC', name: 'ITC Ltd', changePct: 0.84, volume: '78M', momentum: '2.1x Avg Volume' },
  { symbol: 'BPCL', name: 'BPCL', changePct: -0.45, volume: '55M', momentum: '1.9x Avg Volume' },
];

// ── Sector Heatmap ──
export const SECTORS: SectorData[] = [
  { name: 'Banking', changePct: -0.82, momentum: 'down' },
  { name: 'IT', changePct: 1.94, momentum: 'up' },
  { name: 'Pharma', changePct: -0.45, momentum: 'down' },
  { name: 'FMCG', changePct: 0.32, momentum: 'flat' },
  { name: 'Auto', changePct: 2.18, momentum: 'up' },
  { name: 'Energy', changePct: -1.56, momentum: 'down' },
  { name: 'Metals', changePct: 1.23, momentum: 'up' },
  { name: 'Realty', changePct: 3.47, momentum: 'up' },
  { name: 'Infra', changePct: 0.89, momentum: 'up' },
  { name: 'Media', changePct: -0.67, momentum: 'down' },
  { name: 'PSU Bank', changePct: -1.12, momentum: 'down' },
  { name: 'Telecom', changePct: 0.56, momentum: 'flat' },
];

// ── Watchlist Intelligence ──
export const WATCHLIST: WatchlistItem[] = [
  { symbol: 'TATAMOTORS', price: 782.45, changePct: 4.31, signal: 'Momentum Accelerating', trend: 'up' },
  { symbol: 'INFY', price: 1584.20, changePct: 2.45, signal: 'Breakout Above Resistance', trend: 'up' },
  { symbol: 'RELIANCE', price: 2934.60, changePct: 2.84, signal: 'High Volume Accumulation', trend: 'up' },
  { symbol: 'HDFCBANK', price: 1654.80, changePct: -2.87, signal: 'Weak Volume Structure', trend: 'down' },
  { symbol: 'WIPRO', price: 423.15, changePct: -2.34, signal: 'Below Key EMA', trend: 'down' },
  { symbol: 'ITC', price: 468.90, changePct: 0.84, signal: 'Consolidation Range', trend: 'flat' },
];

// ── Risk Overview ──
export const RISK_ITEMS: RiskItem[] = [
  { zone: 'Small Cap Pharma', level: 'high', detail: 'Overextended valuations, declining volumes' },
  { zone: 'Mid Cap IT', level: 'medium', detail: 'Elevated RSI, potential mean reversion' },
  { zone: 'PSU Banking', level: 'high', detail: 'NPA concerns, sector rotation outflows' },
  { zone: 'Infra & Realty', level: 'low', detail: 'Government capex tailwind, stable momentum' },
];

export const FEAR_GREED = {
  value: 62,
  label: 'Greed',
  trend: 'rising' as const,
};
