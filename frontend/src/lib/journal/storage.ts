import { Setup, Trade, UUID, derive, SetupStats } from './types';

const LS_KEY = 'journal_v1';

export type JournalState = {
  setups: Setup[];
  trades: Trade[];
};

let state: JournalState | null = null;

function uuid(): UUID {
  // Simple UUID v4-ish
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function load(): JournalState {
  if (state) return state;
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        state = JSON.parse(raw);
        return state!;
      }
    } catch {}
  }
  state = { setups: [], trades: [] };
  return state;
}

function save() {
  if (typeof window === 'undefined' || !state) return;
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

export function listSetups(): Setup[] {
  return load().setups.slice().sort((a, b) => a.name.localeCompare(b.name));
}

export function getSetup(id: UUID): Setup | undefined {
  return load().setups.find((s) => s.id === id);
}

export function createSetup(data: Omit<Setup, 'id' | 'createdAt' | 'updatedAt'>): Setup {
  const now = new Date().toISOString();
  const s: Setup = { id: uuid(), createdAt: now, updatedAt: now, ...data };
  load().setups.push(s);
  save();
  return s;
}

export function updateSetup(id: UUID, patch: Partial<Setup>): Setup | undefined {
  const st = load();
  const i = st.setups.findIndex((s) => s.id === id);
  if (i === -1) return undefined;
  st.setups[i] = { ...st.setups[i], ...patch, updatedAt: new Date().toISOString() };
  save();
  return st.setups[i];
}

export function deleteSetup(id: UUID) {
  const st = load();
  st.setups = st.setups.filter((s) => s.id !== id);
  st.trades = st.trades.filter((t) => t.setupId !== id);
  save();
}

export function listTradesBySetup(setupId: UUID): Trade[] {
  return load().trades.filter((t) => t.setupId === setupId).sort((a, b) => new Date(b.entryAt).getTime() - new Date(a.entryAt).getTime());
}

// Ensure trades have unique, non-empty IDs (migration for legacy/seeded data)
export function ensureTradeIdsUnique() {
  const st = load();
  const seen = new Set<string>();
  for (let i = 0; i < st.trades.length; i++) {
    let id = (st.trades[i] as any).id as string | undefined;
    if (!id || id.trim() === '' || seen.has(id)) {
      id = uuid();
      (st.trades[i] as any).id = id;
    }
    seen.add(id);
  }
  save();
}

export function createTrade(data: Omit<Trade, 'id'> | Trade): Trade {
  // Ignore any incoming id to ensure uniqueness
  const { id: _ignored, ...rest } = data as any;
  const t: Trade = { id: uuid(), ...(rest as Omit<Trade, 'id'>) };
  load().trades.push(t);
  save();
  return t;
}

export function updateTrade(id: UUID, patch: Partial<Trade>): Trade | undefined {
  const st = load();
  const i = st.trades.findIndex((t) => t.id === id);
  if (i === -1) return undefined;
  st.trades[i] = { ...st.trades[i], ...patch };
  save();
  return st.trades[i];
}

export function deleteTrade(id: UUID) {
  const st = load();
  st.trades = st.trades.filter((t) => t.id !== id);
  save();
}

export function computeStats(setupId?: UUID): SetupStats {
  const trades = setupId ? listTradesBySetup(setupId) : load().trades;
  const realized = trades.filter((t) => t.exitPrice != null);
  const metrics = realized.map(derive);
  const total = realized.length;
  const wins = metrics.filter((m) => (m.pnl ?? 0) > 0).length;
  const winRate = total ? wins / total : 0;
  const returns = metrics.map((m) => m.pct ?? 0);
  const avgReturnPct = returns.length ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const bestPct = returns.length ? Math.max(...returns) : 0;
  const worstPct = returns.length ? Math.min(...returns) : 0;
  return { totalTrades: total, winRate, avgReturnPct, bestPct, worstPct };
}

export function seedDemo() {
  const st = load();
  if (st.setups.length > 0) return; // already seeded
  const s1 = createSetup({
    name: 'Momentum Breakout',
    marketType: 'Stocks',
    tags: ['momentum', 'daily'],
    params: { entryCriteria: 'Breakout + volume', stopLoss: 'ATR*1.5', target: '2R', riskRules: '1% risk per trade' },
  });
  const s2 = createSetup({
    name: 'NIFTY Mean Reversion',
    marketType: 'Indices',
    tags: ['intraday', 'mean-rev'],
    params: { entryCriteria: 'RSI<30 bounce', stopLoss: 'Day low -0.5%', target: '1%', riskRules: 'Position sizing by ATR' },
  });
  const now = Date.now();
  createTrade({
    setupId: s1.id,
    instrument: 'NSE:RELIANCE',
    marketType: 'Stocks',
    side: 'Buy',
    entryPrice: 2800,
    exitPrice: 2890,
    entryAt: new Date(now - 7 * 864e5).toISOString(),
    exitAt: new Date(now - 6 * 864e5).toISOString(),
    quantity: 50,
    comments: 'Strong breakout + vol',
  });
  createTrade({
    setupId: s1.id,
    instrument: 'NSE:TCS',
    marketType: 'Stocks',
    side: 'Buy',
    entryPrice: 3800,
    exitPrice: 3720,
    entryAt: new Date(now - 5 * 864e5).toISOString(),
    exitAt: new Date(now - 4 * 864e5).toISOString(),
    quantity: 20,
    comments: 'Failed follow-through',
  });
  createTrade({
    setupId: s2.id,
    instrument: 'NIFTY',
    marketType: 'Indices',
    side: 'Sell',
    entryPrice: 24500,
    exitPrice: 24300,
    entryAt: new Date(now - 3 * 864e5).toISOString(),
    exitAt: new Date(now - 3 * 864e5 + 3 * 3600e3).toISOString(),
    quantity: 50,
    comments: 'Intraday mean reversion short',
  });
}
