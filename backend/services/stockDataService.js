/**
 * Stock Data Service — Curated NSE Stock Database + Real-Time Quotes
 * ===================================================================
 * - 90 curated NSE stocks across 14 major sectors
 * - Instant stock search by ticker, company name, or sector
 * - Live price quote via Finnhub with graceful fallback
 * - Sector auto-detection from stock database
 *
 * If Finnhub is unavailable or doesn't support a symbol,
 * the service returns { available: false } so the frontend
 * can prompt for manual price entry. The flow NEVER breaks.
 */

const env = require('../config/env');

const FINNHUB_KEY = env.finnhubApiKey;
const FINNHUB_BASE = 'https://finnhub.io/api/v1';

// ─── Quote Cache ─────────────────────────────────────────────
const quoteCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ─── Curated NSE Stock Database (90 stocks, 14 sectors) ──────
const STOCK_DATABASE = [
  // ── Banking (10) ───────────────────────────────────────────
  { ticker: 'HDFCBANK.NS',   name: 'HDFC Bank',              sector: 'Banking' },
  { ticker: 'ICICIBANK.NS',  name: 'ICICI Bank',             sector: 'Banking' },
  { ticker: 'SBIN.NS',       name: 'State Bank of India',    sector: 'Banking' },
  { ticker: 'KOTAKBANK.NS',  name: 'Kotak Mahindra Bank',    sector: 'Banking' },
  { ticker: 'AXISBANK.NS',   name: 'Axis Bank',              sector: 'Banking' },
  { ticker: 'INDUSINDBK.NS', name: 'IndusInd Bank',          sector: 'Banking' },
  { ticker: 'BANDHANBNK.NS', name: 'Bandhan Bank',           sector: 'Banking' },
  { ticker: 'FEDERALBNK.NS', name: 'Federal Bank',           sector: 'Banking' },
  { ticker: 'PNB.NS',        name: 'Punjab National Bank',   sector: 'Banking' },
  { ticker: 'BANKBARODA.NS', name: 'Bank of Baroda',         sector: 'Banking' },

  // ── IT (10) ────────────────────────────────────────────────
  { ticker: 'TCS.NS',        name: 'Tata Consultancy Services', sector: 'IT' },
  { ticker: 'INFY.NS',       name: 'Infosys',                   sector: 'IT' },
  { ticker: 'WIPRO.NS',      name: 'Wipro',                     sector: 'IT' },
  { ticker: 'HCLTECH.NS',    name: 'HCL Technologies',          sector: 'IT' },
  { ticker: 'TECHM.NS',      name: 'Tech Mahindra',             sector: 'IT' },
  { ticker: 'LTIM.NS',       name: 'LTIMindtree',               sector: 'IT' },
  { ticker: 'PERSISTENT.NS', name: 'Persistent Systems',        sector: 'IT' },
  { ticker: 'COFORGE.NS',    name: 'Coforge',                   sector: 'IT' },
  { ticker: 'MPHASIS.NS',    name: 'Mphasis',                   sector: 'IT' },
  { ticker: 'LTTS.NS',       name: 'L&T Technology Services',   sector: 'IT' },

  // ── Energy & Power (8) ─────────────────────────────────────
  { ticker: 'RELIANCE.NS',   name: 'Reliance Industries',    sector: 'Energy' },
  { ticker: 'ONGC.NS',       name: 'Oil & Natural Gas Corp', sector: 'Energy' },
  { ticker: 'BPCL.NS',       name: 'Bharat Petroleum',       sector: 'Energy' },
  { ticker: 'IOC.NS',        name: 'Indian Oil Corporation', sector: 'Energy' },
  { ticker: 'NTPC.NS',       name: 'NTPC Limited',           sector: 'Energy' },
  { ticker: 'POWERGRID.NS',  name: 'Power Grid Corporation', sector: 'Energy' },
  { ticker: 'ADANIGREEN.NS', name: 'Adani Green Energy',     sector: 'Energy' },
  { ticker: 'TATAPOWER.NS',  name: 'Tata Power',             sector: 'Energy' },

  // ── FMCG (8) ──────────────────────────────────────────────
  { ticker: 'HINDUNILVR.NS', name: 'Hindustan Unilever',     sector: 'FMCG' },
  { ticker: 'ITC.NS',        name: 'ITC Limited',            sector: 'FMCG' },
  { ticker: 'NESTLEIND.NS',  name: 'Nestle India',           sector: 'FMCG' },
  { ticker: 'BRITANNIA.NS',  name: 'Britannia Industries',   sector: 'FMCG' },
  { ticker: 'DABUR.NS',      name: 'Dabur India',            sector: 'FMCG' },
  { ticker: 'MARICO.NS',     name: 'Marico',                 sector: 'FMCG' },
  { ticker: 'GODREJCP.NS',   name: 'Godrej Consumer Products', sector: 'FMCG' },
  { ticker: 'COLPAL.NS',     name: 'Colgate-Palmolive India',  sector: 'FMCG' },

  // ── Auto (7) ──────────────────────────────────────────────
  { ticker: 'TATAMOTORS.NS', name: 'Tata Motors',            sector: 'Auto' },
  { ticker: 'MARUTI.NS',     name: 'Maruti Suzuki',          sector: 'Auto' },
  { ticker: 'M&M.NS',        name: 'Mahindra & Mahindra',    sector: 'Auto' },
  { ticker: 'BAJAJ-AUTO.NS', name: 'Bajaj Auto',             sector: 'Auto' },
  { ticker: 'HEROMOTOCO.NS', name: 'Hero MotoCorp',          sector: 'Auto' },
  { ticker: 'EICHERMOT.NS',  name: 'Eicher Motors',          sector: 'Auto' },
  { ticker: 'ASHOKLEY.NS',   name: 'Ashok Leyland',          sector: 'Auto' },

  // ── Pharma & Healthcare (8) ───────────────────────────────
  { ticker: 'SUNPHARMA.NS',  name: 'Sun Pharmaceutical',     sector: 'Pharma' },
  { ticker: 'DRREDDY.NS',    name: "Dr. Reddy's Labs",       sector: 'Pharma' },
  { ticker: 'CIPLA.NS',      name: 'Cipla',                  sector: 'Pharma' },
  { ticker: 'DIVISLAB.NS',   name: "Divi's Laboratories",    sector: 'Pharma' },
  { ticker: 'APOLLOHOSP.NS', name: 'Apollo Hospitals',       sector: 'Pharma' },
  { ticker: 'BIOCON.NS',     name: 'Biocon',                 sector: 'Pharma' },
  { ticker: 'LUPIN.NS',      name: 'Lupin',                  sector: 'Pharma' },
  { ticker: 'FORTIS.NS',     name: 'Fortis Healthcare',      sector: 'Pharma' },

  // ── Metals & Mining (6) ───────────────────────────────────
  { ticker: 'TATASTEEL.NS',  name: 'Tata Steel',             sector: 'Metals' },
  { ticker: 'HINDALCO.NS',   name: 'Hindalco Industries',    sector: 'Metals' },
  { ticker: 'JSWSTEEL.NS',   name: 'JSW Steel',              sector: 'Metals' },
  { ticker: 'VEDL.NS',       name: 'Vedanta',                sector: 'Metals' },
  { ticker: 'COALINDIA.NS',  name: 'Coal India',             sector: 'Metals' },
  { ticker: 'NMDC.NS',       name: 'NMDC',                   sector: 'Metals' },

  // ── Telecom (2) ───────────────────────────────────────────
  { ticker: 'BHARTIARTL.NS', name: 'Bharti Airtel',          sector: 'Telecom' },
  { ticker: 'IDEA.NS',       name: 'Vodafone Idea',          sector: 'Telecom' },

  // ── Infrastructure (5) ────────────────────────────────────
  { ticker: 'LT.NS',         name: 'Larsen & Toubro',        sector: 'Infrastructure' },
  { ticker: 'ADANIENT.NS',   name: 'Adani Enterprises',      sector: 'Infrastructure' },
  { ticker: 'ADANIPORTS.NS', name: 'Adani Ports',            sector: 'Infrastructure' },
  { ticker: 'SIEMENS.NS',    name: 'Siemens India',          sector: 'Infrastructure' },
  { ticker: 'ABB.NS',        name: 'ABB India',              sector: 'Infrastructure' },

  // ── Finance / NBFC (6) ────────────────────────────────────
  { ticker: 'BAJFINANCE.NS', name: 'Bajaj Finance',          sector: 'Finance' },
  { ticker: 'BAJAJFINSV.NS', name: 'Bajaj Finserv',          sector: 'Finance' },
  { ticker: 'SBILIFE.NS',    name: 'SBI Life Insurance',     sector: 'Finance' },
  { ticker: 'HDFCLIFE.NS',   name: 'HDFC Life Insurance',    sector: 'Finance' },
  { ticker: 'ICICIPRULI.NS', name: 'ICICI Prudential Life',  sector: 'Finance' },
  { ticker: 'CHOLAFIN.NS',   name: 'Cholamandalam Investment', sector: 'Finance' },

  // ── Consumer & Retail (6) ─────────────────────────────────
  { ticker: 'TITAN.NS',      name: 'Titan Company',          sector: 'Consumer' },
  { ticker: 'TRENT.NS',      name: 'Trent',                  sector: 'Consumer' },
  { ticker: 'DMART.NS',      name: 'Avenue Supermarts (DMart)', sector: 'Consumer' },
  { ticker: 'PAGEIND.NS',    name: 'Page Industries',        sector: 'Consumer' },
  { ticker: 'ZOMATO.NS',     name: 'Zomato',                 sector: 'Consumer' },
  { ticker: 'NYKAA.NS',      name: 'FSN E-Commerce (Nykaa)', sector: 'Consumer' },

  // ── Cement (4) ────────────────────────────────────────────
  { ticker: 'ULTRACEMCO.NS', name: 'UltraTech Cement',       sector: 'Cement' },
  { ticker: 'SHREECEM.NS',   name: 'Shree Cement',           sector: 'Cement' },
  { ticker: 'AMBUJACEM.NS',  name: 'Ambuja Cements',         sector: 'Cement' },
  { ticker: 'ACC.NS',        name: 'ACC',                    sector: 'Cement' },

  // ── Chemicals (3) ────────────────────────────────────────
  { ticker: 'PIDILITIND.NS', name: 'Pidilite Industries',    sector: 'Chemicals' },
  { ticker: 'SRF.NS',        name: 'SRF Limited',            sector: 'Chemicals' },
  { ticker: 'AARTI.NS',      name: 'Aarti Industries',       sector: 'Chemicals' },

  // ── Real Estate (3) ──────────────────────────────────────
  { ticker: 'DLF.NS',        name: 'DLF',                    sector: 'Real Estate' },
  { ticker: 'GODREJPROP.NS', name: 'Godrej Properties',      sector: 'Real Estate' },
  { ticker: 'OBEROIRLTY.NS', name: 'Oberoi Realty',          sector: 'Real Estate' },

  // ── Oil & Gas (2) ────────────────────────────────────────
  { ticker: 'GAIL.NS',       name: 'GAIL India',             sector: 'Oil & Gas' },
  { ticker: 'PETRONET.NS',   name: 'Petronet LNG',           sector: 'Oil & Gas' },

  // ── Media & Entertainment (2) ─────────────────────────────
  { ticker: 'ZEEL.NS',       name: 'Zee Entertainment',      sector: 'Media' },
  { ticker: 'PVR.NS',        name: 'PVR INOX',               sector: 'Media' },
];

// ─── Search stocks ───────────────────────────────────────────
function searchStocks(query, limit = 12) {
  if (!query || query.length < 1) return [];
  const q = query.toLowerCase().trim();
  return STOCK_DATABASE
    .filter(s =>
      s.ticker.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.sector.toLowerCase().includes(q)
    )
    .slice(0, limit)
    .map(s => ({ ticker: s.ticker, name: s.name, sector: s.sector }));
}

// ─── Get stock info by ticker ────────────────────────────────
function getStockInfo(symbol) {
  return STOCK_DATABASE.find(
    s => s.ticker.toUpperCase() === symbol.toUpperCase()
  ) || null;
}

// ─── Fetch live quote via Finnhub ────────────────────────────
async function getStockQuote(symbol) {
  // Check cache first
  const cached = quoteCache.get(symbol);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data;
  }

  // Attempt Finnhub
  if (FINNHUB_KEY) {
    try {
      const url = `${FINNHUB_BASE}/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_KEY}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });

      if (res.ok) {
        const data = await res.json();
        // Finnhub returns { c: current, d: change, dp: changePct, h, l, pc }
        // c=0 means no data for this symbol
        if (data && data.c && data.c > 0) {
          const result = {
            price: data.c,
            change: data.d || 0,
            changePct: data.dp || 0,
            high: data.h || 0,
            low: data.l || 0,
            prevClose: data.pc || 0,
            available: true,
          };
          quoteCache.set(symbol, { data: result, ts: Date.now() });
          return result;
        }
      }
    } catch (err) {
      console.log(`[StockData] Finnhub quote failed for ${symbol}: ${err.message}`);
    }
  }

  // Graceful fallback — return unavailable
  const info = getStockInfo(symbol);
  return {
    price: null,
    change: null,
    changePct: null,
    available: false,
    sector: info?.sector || null,
    message: 'Live price not available. Please enter current price manually.',
  };
}

// ─── Get full database ──────────────────────────────────────
function getAllStocks() {
  return STOCK_DATABASE.map(s => ({
    ticker: s.ticker,
    name: s.name,
    sector: s.sector,
  }));
}

module.exports = {
  searchStocks,
  getStockInfo,
  getStockQuote,
  getAllStocks,
  STOCK_DATABASE,
};
