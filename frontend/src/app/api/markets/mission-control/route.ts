import { NextResponse } from 'next/server';
import { isRateLimited, rateLimitKey, verifyAuth } from "@/lib/api/aiRouteGuard";

// ── In-memory cache (60s TTL for market data) ────────────────────
const cache = new Map<string, { data: unknown; expiresAt: number }>();
const TTL = 60_000;

function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return Promise.resolve(hit.data as T);
  return fn().then((data) => {
    cache.set(key, { data, expiresAt: Date.now() + TTL });
    return data;
  });
}

// ── Yahoo Finance v8 (no API key required) ───────────────────────
async function fetchYahoo(symbol: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`Yahoo ${symbol}: ${res.status}`);
  return res.json();
}

function parseYahoo(json: any, displaySymbol: string, displayName: string) {
  try {
    const meta = json.chart.result[0].meta;
    const closes: number[] = json.chart.result[0].indicators.quote[0].close ?? [];
    const validCloses = closes.filter(Boolean);
    const prev = meta.chartPreviousClose ?? validCloses[validCloses.length - 2] ?? meta.regularMarketPrice;
    const price = meta.regularMarketPrice;
    const change = price - prev;
    const changePct = (change / prev) * 100;
    return {
      symbol: displaySymbol,
      name: displayName,
      price,
      change: +change.toFixed(2),
      changePct: +changePct.toFixed(2),
      sparkline: validCloses.slice(-20).map((v: number) => +v.toFixed(2)),
    };
  } catch {
    return null;
  }
}

// ── Fetch multiple symbols ────────────────────────────────────────
type Quote = { symbol: string; name: string; price: number; change: number; changePct: number; sparkline: number[] };

async function fetchQuotes(pairs: { ticker: string; symbol: string; name: string }[]): Promise<(Quote | null)[]> {
  return Promise.all(
    pairs.map(({ ticker, symbol, name }) =>
      cached(`quote:${ticker}`, () => fetchYahoo(ticker).then((j) => parseYahoo(j, symbol, name)).catch(() => null))
    )
  );
}

// ── Handler ───────────────────────────────────────────────────────
export async function GET(req: Request) {
  // Beta-only: these pages live under the AuthGuard-wrapped (app) route group,
  // but the route behind them was reachable anonymously and spends Yahoo Finance
  // requests from the deployment's egress IP. Same guard already used by
  // /api/copilot/chat and /api/journal/analyze — no second auth system.
  const userId = await verifyAuth(req);
  if (!userId) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 401 });
  }
  if (isRateLimited(rateLimitKey(req, userId))) {
    return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
  }

  try {
    // Fetch in parallel
    const [usQuotes, euQuotes, asiaQuotes, cmdQuotes, futuresQuotes, riskQuotes] = await Promise.all([
      fetchQuotes([
        { ticker: '^IXIC', symbol: 'NASDAQ', name: 'NASDAQ Composite' },
        { ticker: '^GSPC', symbol: 'S&P 500', name: 'S&P 500' },
        { ticker: '^DJI',  symbol: 'DJI',     name: 'Dow Jones'       },
      ]),
      fetchQuotes([
        { ticker: '^FTSE', symbol: 'FTSE 100', name: 'FTSE 100' },
        { ticker: '^GDAXI', symbol: 'DAX',     name: 'DAX 40'   },
        { ticker: '^FCHI',  symbol: 'CAC 40',  name: 'CAC 40'   },
      ]),
      fetchQuotes([
        { ticker: '^N225',   symbol: 'Nikkei',   name: 'Nikkei 225'  },
        { ticker: '^HSI',    symbol: 'Hang Seng', name: 'Hang Seng'  },
        { ticker: '^BSESN',  symbol: 'SENSEX',   name: 'BSE Sensex'  },
      ]),
      fetchQuotes([
        { ticker: 'GC=F',  symbol: 'GOLD',   name: 'Gold ($/oz)'   },
        { ticker: 'CL=F',  symbol: 'CRUDE',  name: 'Crude Oil (WTI)'},
        { ticker: 'SI=F',  symbol: 'SILVER', name: 'Silver ($/oz)'  },
      ]),
      fetchQuotes([
        { ticker: 'ES=F',  symbol: 'ES',    name: 'S&P Futures'  },
        { ticker: 'NQ=F',  symbol: 'NQ',    name: 'NASDAQ Futures'},
        { ticker: 'GC=F',  symbol: 'Gold',  name: 'Gold Futures'  },
        { ticker: 'CL=F',  symbol: 'Oil',   name: 'Crude Oil'     },
        { ticker: 'BTC-USD', symbol: 'BTC', name: 'Bitcoin'       },
        { ticker: 'ETH-USD', symbol: 'ETH', name: 'Ethereum'      },
      ]),
      fetchQuotes([
        { ticker: '^VIX',  symbol: 'VIX',   name: 'CBOE VIX'         },
        { ticker: 'DX-Y.NYB', symbol: 'DXY', name: 'Dollar Index'    },
        { ticker: '^TNX',  symbol: 'US10Y', name: '10Y Treasury Yield'},
      ]),
    ]);

    // Market status (US hours: Mon-Fri 09:30-16:00 ET = 19:00-02:00 IST+1)
    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcMin  = now.getUTCMinutes();
    const utcDay  = now.getUTCDay(); // 0=Sun
    const etOffset = -4; // EDT
    const etHour = ((utcHour + etOffset) % 24 + 24) % 24;
    const etDecimal = etHour + utcMin / 60;
    const isWeekday = utcDay >= 1 && utcDay <= 5;
    const marketOpen = isWeekday && etDecimal >= 9.5 && etDecimal < 16;

    // VIX for fear/greed proxy
    const vix = riskQuotes[0];
    const fearGreedValue = vix
      ? Math.max(5, Math.min(95, Math.round(100 - (vix.price / 40) * 100)))
      : 50;
    const fearGreedLabel =
      fearGreedValue >= 75 ? 'Extreme Greed'
      : fearGreedValue >= 55 ? 'Greed'
      : fearGreedValue >= 45 ? 'Neutral'
      : fearGreedValue >= 25 ? 'Fear'
      : 'Extreme Fear';

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      marketOpen,
      fearGreed: { value: fearGreedValue, label: fearGreedLabel },
      vix: vix ? { price: vix.price, changePct: vix.changePct } : null,
      regions: {
        us:    usQuotes.filter(Boolean),
        eu:    euQuotes.filter(Boolean),
        asia:  asiaQuotes.filter(Boolean),
        commodities: cmdQuotes.filter(Boolean),
        risk:  riskQuotes.filter(Boolean),
      },
      futures: futuresQuotes.filter(Boolean),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
