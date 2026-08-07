/**
 * Equity Journal storage — long-term investing, kept deliberately separate from
 * the trading journal's `journal_v1` state.
 *
 * They record different things: a trade has an entry, an exit and an R-multiple
 * measured in days; a holding is an accumulating position with a cost basis,
 * possibly built over years, that may never be closed at all. Mixing them into
 * one collection would force every trading-journal metric (win rate, expectancy,
 * drawdown) to special-case "positions that have no exit and aren't supposed
 * to", so this is its own key with its own shape.
 *
 * Same localStorage approach and same UUID helper as `storage.ts`, so no new
 * dependency and no backend change.
 */

export type UUID = string;

/** Where a position came from — an IPO allotment has a different story to a
 *  secondary-market purchase, and the IPO tracker needs to survive after
 *  allotment turns it into a holding. */
export type BuySource = 'Secondary' | 'IPO' | 'Bonus' | 'Rights' | 'Transfer';

export type Conviction = 'Core' | 'Satellite' | 'Tactical';

/** One purchase. Multiple buys of the same symbol are kept as separate lots so
 *  the average cost stays auditable rather than being silently overwritten. */
export type BuyLot = {
  id: UUID;
  date: string;          // ISO yyyy-mm-dd
  quantity: number;
  price: number;         // per share, in ₹
  charges?: number;      // brokerage + taxes for this lot
  source: BuySource;
  note?: string;
};

/** A partial or full sale against a holding. */
export type ExitRecord = {
  id: UUID;
  date: string;
  quantity: number;
  price: number;
  charges?: number;
  reason?: string;       // why the thesis ended — the part worth re-reading
};

export type Holding = {
  id: UUID;
  symbol: string;
  companyName?: string;
  conviction: Conviction;
  /** Manually maintained: this page has no price feed of its own, and inventing
   *  one would make the valuation look live when it isn't. */
  lastPrice?: number | null;
  lastPriceAt?: string | null;
  targetPrice?: number | null;
  lots: BuyLot[];
  exits: ExitRecord[];
  thesis?: string;
  createdAt: string;
  updatedAt: string;
};

export type IpoStatus = 'Applied' | 'Allotted' | 'Not Allotted' | 'Withdrawn';

export type IpoApplication = {
  id: UUID;
  symbol: string;
  companyName?: string;
  appliedDate: string;
  lots: number;
  lotSize: number;
  pricePerShare: number;   // upper band / cut-off applied at
  status: IpoStatus;
  allottedQty?: number | null;
  listingPrice?: number | null;
  note?: string;
  createdAt: string;
};

/** A dated observation about a holding or the portfolio generally. */
export type InvestmentNote = {
  id: UUID;
  date: string;
  symbol?: string;         // blank = portfolio-level
  title: string;
  body: string;
  tag?: 'Thesis' | 'Risk' | 'Review' | 'Event';
};

export type EquityState = {
  holdings: Holding[];
  ipos: IpoApplication[];
  notes: InvestmentNote[];
};

const LS_KEY = 'equity_journal_v1';

let state: EquityState | null = null;

export function uuid(): UUID {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function load(): EquityState {
  if (state) return state;
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Tolerate a partially-written or older blob rather than throwing the
        // whole page away over one missing array.
        state = {
          holdings: parsed.holdings ?? [],
          ipos: parsed.ipos ?? [],
          notes: parsed.notes ?? [],
        };
        return state;
      }
    } catch {}
  }
  state = { holdings: [], ipos: [], notes: [] };
  return state;
}

function save() {
  if (typeof window === 'undefined' || !state) return;
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

const nowIso = () => new Date().toISOString();

// ── Holdings ────────────────────────────────────────────────────────────────

export function listHoldings(): Holding[] {
  return load().holdings.slice().sort((a, b) => a.symbol.localeCompare(b.symbol));
}

export function addHolding(
  data: Omit<Holding, 'id' | 'createdAt' | 'updatedAt' | 'lots' | 'exits'> & {
    lots?: BuyLot[];
    exits?: ExitRecord[];
  },
): Holding {
  const s = load();
  const h: Holding = {
    ...data,
    lots: data.lots ?? [],
    exits: data.exits ?? [],
    id: uuid(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  s.holdings.push(h);
  save();
  return h;
}

export function updateHolding(id: UUID, patch: Partial<Holding>): void {
  const s = load();
  const h = s.holdings.find((x) => x.id === id);
  if (!h) return;
  Object.assign(h, patch, { updatedAt: nowIso() });
  save();
}

export function deleteHolding(id: UUID): void {
  const s = load();
  s.holdings = s.holdings.filter((h) => h.id !== id);
  save();
}

export function addLot(holdingId: UUID, lot: Omit<BuyLot, 'id'>): void {
  const s = load();
  const h = s.holdings.find((x) => x.id === holdingId);
  if (!h) return;
  h.lots.push({ ...lot, id: uuid() });
  h.updatedAt = nowIso();
  save();
}

export function addExit(holdingId: UUID, exit: Omit<ExitRecord, 'id'>): void {
  const s = load();
  const h = s.holdings.find((x) => x.id === holdingId);
  if (!h) return;
  h.exits.push({ ...exit, id: uuid() });
  h.updatedAt = nowIso();
  save();
}

// ── IPOs ────────────────────────────────────────────────────────────────────

export function listIpos(): IpoApplication[] {
  return load().ipos.slice().sort((a, b) => b.appliedDate.localeCompare(a.appliedDate));
}

export function addIpo(data: Omit<IpoApplication, 'id' | 'createdAt'>): IpoApplication {
  const s = load();
  const ipo: IpoApplication = { ...data, id: uuid(), createdAt: nowIso() };
  s.ipos.push(ipo);
  save();
  return ipo;
}

export function updateIpo(id: UUID, patch: Partial<IpoApplication>): void {
  const s = load();
  const i = s.ipos.find((x) => x.id === id);
  if (!i) return;
  Object.assign(i, patch);
  save();
}

export function deleteIpo(id: UUID): void {
  const s = load();
  s.ipos = s.ipos.filter((i) => i.id !== id);
  save();
}

// ── Notes ───────────────────────────────────────────────────────────────────

export function listNotes(): InvestmentNote[] {
  return load().notes.slice().sort((a, b) => b.date.localeCompare(a.date));
}

export function addNote(data: Omit<InvestmentNote, 'id'>): InvestmentNote {
  const s = load();
  const n: InvestmentNote = { ...data, id: uuid() };
  s.notes.push(n);
  save();
  return n;
}

export function deleteNote(id: UUID): void {
  const s = load();
  s.notes = s.notes.filter((n) => n.id !== id);
  save();
}

// ── Derived figures ─────────────────────────────────────────────────────────

export type HoldingMetrics = {
  /** Shares still held after every recorded exit. */
  openQty: number;
  /** Weighted average cost of the shares still held, charges included. */
  avgCost: number | null;
  investedValue: number;      // openQty × avgCost
  currentValue: number | null;
  unrealisedPnl: number | null;
  unrealisedPct: number | null;
  realisedPnl: number;
  totalBoughtQty: number;
  totalSoldQty: number;
};

/**
 * Realised P&L uses average cost at the time of sale rather than FIFO lot
 * matching. It is the convention Indian brokerage statements report against and
 * it keeps a partial exit from depending on which lot the user happened to
 * enter first — but it is an approximation, and worth knowing about before
 * these numbers are used for tax.
 */
export function holdingMetrics(h: Holding): HoldingMetrics {
  const totalBoughtQty = h.lots.reduce((a, l) => a + l.quantity, 0);
  const totalCost = h.lots.reduce((a, l) => a + l.quantity * l.price + (l.charges ?? 0), 0);
  const avgCostAll = totalBoughtQty > 0 ? totalCost / totalBoughtQty : null;

  const totalSoldQty = h.exits.reduce((a, e) => a + e.quantity, 0);
  const realisedPnl = h.exits.reduce(
    (a, e) => a + (e.quantity * e.price - (e.charges ?? 0) - e.quantity * (avgCostAll ?? 0)),
    0,
  );

  const openQty = Math.max(0, totalBoughtQty - totalSoldQty);
  const investedValue = openQty * (avgCostAll ?? 0);
  const currentValue = h.lastPrice != null ? openQty * h.lastPrice : null;
  const unrealisedPnl = currentValue != null ? currentValue - investedValue : null;
  const unrealisedPct =
    unrealisedPnl != null && investedValue > 0 ? (unrealisedPnl / investedValue) * 100 : null;

  return {
    openQty,
    avgCost: avgCostAll,
    investedValue,
    currentValue,
    unrealisedPnl,
    unrealisedPct,
    realisedPnl,
    totalBoughtQty,
    totalSoldQty,
  };
}

export type PortfolioTotals = {
  invested: number;
  currentValue: number;
  unrealisedPnl: number;
  unrealisedPct: number | null;
  realisedPnl: number;
  openPositions: number;
  /** Holdings with no `lastPrice` — their value can't be counted, and saying so
   *  is better than quietly understating the portfolio. */
  unpricedPositions: number;
};

export function portfolioTotals(holdings: Holding[]): PortfolioTotals {
  let invested = 0;
  let currentValue = 0;
  let realisedPnl = 0;
  let openPositions = 0;
  let unpricedPositions = 0;
  let pricedInvested = 0;

  for (const h of holdings) {
    const m = holdingMetrics(h);
    realisedPnl += m.realisedPnl;
    if (m.openQty <= 0) continue;
    openPositions += 1;
    invested += m.investedValue;
    if (m.currentValue != null) {
      currentValue += m.currentValue;
      pricedInvested += m.investedValue;
    } else {
      unpricedPositions += 1;
    }
  }

  // Percentage is computed only over the priced subset, so an unpriced holding
  // can't drag the return toward -100%.
  const unrealisedPnl = currentValue - pricedInvested;
  const unrealisedPct = pricedInvested > 0 ? (unrealisedPnl / pricedInvested) * 100 : null;

  return { invested, currentValue, unrealisedPnl, unrealisedPct, realisedPnl, openPositions, unpricedPositions };
}
