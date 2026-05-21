/**
 * Market Data Service — fetches, caches and processes market data
 * from Finnhub API. All API calls are server-side only.
 *
 * Uses a simple in-memory cache with TTL to avoid hitting rate limits.
 */

const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
const BASE = 'https://finnhub.io/api/v1';

// ─── In-memory cache with TTL ────────────────────────────────
const cache = new Map();
const CACHE_TTL = 60_000; // 60 seconds

function getCached(key) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}

function setCache(key, data) {
  cache.set(key, { data, ts: Date.now() });
}

// ─── Finnhub fetch helper ────────────────────────────────────
async function fhFetch(path) {
  const url = `${BASE}${path}${path.includes('?') ? '&' : '?'}token=${FINNHUB_KEY}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Finnhub ${res.status}: ${res.statusText}`);
  return res.json();
}

// ─── Quote for a symbol ──────────────────────────────────────
async function getQuote(symbol) {
  const key = `quote:${symbol}`;
  const cached = getCached(key);
  if (cached) return cached;

  const data = await fhFetch(`/quote?symbol=${symbol}`);
  setCache(key, data);
  return data;
}

// ─── Market news (category = general, forex, crypto, merger) ─
async function getMarketNews(category = 'general', count = 15) {
  const key = `news:${category}`;
  const cached = getCached(key);
  if (cached) return cached;

  const raw = await fhFetch(`/news?category=${category}`);
  // Process: deduplicate, trim, classify sentiment
  const processed = (raw || []).slice(0, count).map((item) => ({
    id: String(item.id),
    headline: item.headline,
    summary: item.summary?.slice(0, 200) || item.headline,
    source: item.source,
    url: item.url,
    image: item.image,
    datetime: item.datetime,
    timestamp: new Date(item.datetime * 1000).toISOString(),
    sentiment: classifySentiment(item.headline + ' ' + (item.summary || '')),
    impact: estimateImpact(item.headline),
  }));

  setCache(key, processed);
  return processed;
}

// ─── Simple keyword-based sentiment classifier ───────────────
function classifySentiment(text) {
  const t = text.toLowerCase();
  const bullish = ['surge', 'rally', 'gain', 'rise', 'climb', 'jump', 'soar', 'boost', 'bullish', 'upgrade', 'beat', 'strong', 'record', 'high', 'positive', 'growth', 'expand'];
  const bearish = ['fall', 'drop', 'decline', 'sink', 'crash', 'plunge', 'tumble', 'bearish', 'weak', 'cut', 'loss', 'low', 'fear', 'concern', 'warn', 'risk', 'sell', 'downgrade', 'miss'];

  let score = 0;
  for (const w of bullish) if (t.includes(w)) score++;
  for (const w of bearish) if (t.includes(w)) score--;

  return score > 0 ? 'bullish' : score < 0 ? 'bearish' : 'neutral';
}

function estimateImpact(headline) {
  const h = headline.toLowerCase();
  if (/fed|fomc|rate|gdp|inflation|recession|crisis|war/.test(h)) return 'high';
  if (/earnings|ipo|merger|acquisition|sector|industry/.test(h)) return 'medium';
  return 'low';
}

// ─── Batch quotes for global indices ─────────────────────────
const GLOBAL_SYMBOLS = {
  'US Markets': [
    { symbol: '^IXIC',  name: 'NASDAQ',    display: 'NASDAQ'   },
    { symbol: '^GSPC',  name: 'S&P 500',   display: 'S&P 500'  },
    { symbol: '^DJI',   name: 'Dow Jones',  display: 'DJI'      },
  ],
  'Europe': [
    { symbol: '^FTSE',  name: 'FTSE 100',  display: 'FTSE'     },
    { symbol: '^GDAXI', name: 'DAX 40',    display: 'DAX'      },
    { symbol: '^FCHI',  name: 'CAC 40',    display: 'CAC'      },
  ],
  'Asia': [
    { symbol: '^N225',  name: 'Nikkei 225', display: 'NI225'    },
    { symbol: '^HSI',   name: 'Hang Seng',  display: 'HSI'      },
  ],
  'Commodities': [
    { symbol: 'OANDA:XAU_USD', name: 'Gold',      display: 'GOLD'   },
    { symbol: 'OANDA:XAG_USD', name: 'Silver',     display: 'SILVER' },
  ],
};

async function getGlobalOverview() {
  const key = 'global:overview';
  const cached = getCached(key);
  if (cached) return cached;

  const result = {};
  for (const [region, syms] of Object.entries(GLOBAL_SYMBOLS)) {
    result[region] = [];
    for (const s of syms) {
      try {
        const q = await getQuote(s.symbol);
        result[region].push({
          symbol: s.display,
          name: s.name,
          value: q.c || 0,        // current price
          change: q.d || 0,       // change
          changePct: q.dp || 0,   // change percent
          high: q.h || 0,
          low: q.l || 0,
          prevClose: q.pc || 0,
          momentum: q.dp > 1.5 ? 'strong-bull' : q.dp > 0 ? 'bullish' : q.dp > -1.5 ? 'neutral' : 'bearish',
        });
      } catch (err) {
        console.error(`Quote error for ${s.symbol}:`, err.message);
        result[region].push({ symbol: s.display, name: s.name, value: 0, change: 0, changePct: 0, momentum: 'neutral', error: true });
      }
    }
  }

  setCache(key, result);
  return result;
}

module.exports = {
  getQuote,
  getMarketNews,
  getGlobalOverview,
  classifySentiment,
  estimateImpact,
};
