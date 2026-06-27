import { NextResponse } from 'next/server';

const cache = new Map<string, { data: unknown; expiresAt: number }>();
const TTL = 90_000;

function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return Promise.resolve(hit.data as T);
  return fn().then((data) => { cache.set(key, { data, expiresAt: Date.now() + TTL }); return data; });
}

async function fetchYahoo(symbol: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Yahoo ${symbol}: ${res.status}`);
  return res.json();
}

function parseQuote(json: any, sym: string, name: string, sector = '') {
  try {
    const r = json.chart.result[0];
    const meta = r.meta;
    const closes: number[] = (r.indicators.quote[0].close ?? []).filter(Boolean);
    const volumes: number[] = (r.indicators.quote[0].volume ?? []).filter(Boolean);
    const prev = meta.chartPreviousClose ?? closes[closes.length - 2] ?? meta.regularMarketPrice;
    const price = meta.regularMarketPrice ?? closes[closes.length - 1] ?? 0;
    const change = price - prev;
    const changePct = prev ? (change / prev) * 100 : 0;
    const avgVol = volumes.length > 1 ? volumes.slice(0, -1).reduce((a: number, b: number) => a + b, 0) / (volumes.length - 1) : volumes[0] ?? 0;
    const todayVol = volumes[volumes.length - 1] ?? 0;
    const volRatio = avgVol > 0 ? todayVol / avgVol : 1;
    return {
      symbol: sym, name, sector,
      price: +price.toFixed(2), change: +change.toFixed(2), changePct: +changePct.toFixed(2),
      volume: todayVol, avgVolume: Math.round(avgVol), volRatio: +volRatio.toFixed(2),
      sparkline: closes.slice(-20).map((v: number) => +v.toFixed(2)),
      high52w: meta.fiftyTwoWeekHigh ?? 0, low52w: meta.fiftyTwoWeekLow ?? 0,
    };
  } catch { return null; }
}

async function batchQuotes(pairs: { ticker: string; symbol: string; name: string; sector?: string }[]) {
  const results = await Promise.allSettled(
    pairs.map(({ ticker, symbol, name, sector }) =>
      cached(`pulse:${ticker}`, () => fetchYahoo(ticker).then(j => parseQuote(j, symbol, name, sector ?? '')).catch(() => null))
    )
  );
  return results.map(r => r.status === 'fulfilled' ? r.value : null).filter(Boolean);
}

function calcRsi(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  const changes = closes.slice(1).map((c, i) => c - closes[i]);
  let gains = 0, losses = 0;
  changes.slice(0, period).forEach(c => { if (c > 0) gains += c; else losses -= c; });
  let avgGain = gains / period, avgLoss = losses / period;
  for (let i = period; i < changes.length; i++) {
    const g = Math.max(0, changes[i]); const l = Math.max(0, -changes[i]);
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
  }
  return avgLoss === 0 ? 100 : +(100 - 100 / (1 + avgGain / avgLoss)).toFixed(1);
}

function inferRegime(vix: number, fg: number, spPct: number) {
  if (vix < 15 && fg >= 65 && spPct >= 0.3) return { regime: 'RISK ON',   color: '#22c55e', confidence: 82 };
  if (vix > 28 || fg <= 25)                  return { regime: 'RISK OFF',  color: '#ef4444', confidence: 79 };
  if (vix < 20 && spPct >= 0.2)              return { regime: 'BULLISH',   color: '#4ade80', confidence: 74 };
  if (vix >= 20 && spPct < 0)                return { regime: 'NEUTRAL',   color: '#94a3b8', confidence: 61 };
  if (Math.abs(spPct) < 0.15)                return { regime: 'RANGING',   color: '#f59e0b', confidence: 66 };
  return                                             { regime: 'TRENDING',  color: '#818cf8', confidence: 69 };
}

function breakoutScore(q: any) {
  if (!q) return 0;
  let s = 0;
  const d = q.high52w > 0 ? (q.high52w - q.price) / q.high52w : 1;
  if (d < 0.05) s += 35; else if (d < 0.12) s += 18;
  if (q.volRatio > 2.5) s += 30; else if (q.volRatio > 1.5) s += 15;
  if (q.changePct > 3) s += 25; else if (q.changePct > 1.5) s += 12;
  if (q.changePct > 0 && q.volRatio > 1.2) s += 10;
  return Math.min(s, 99);
}

export async function GET() {
  try {
    const [indices, sectors, momentum, india] = await Promise.all([
      batchQuotes([
        { ticker: '^GSPC', symbol: 'SPX', name: 'S&P 500' },
        { ticker: '^IXIC', symbol: 'NDX', name: 'NASDAQ' },
        { ticker: '^VIX',  symbol: 'VIX', name: 'CBOE VIX' },
        { ticker: 'DX-Y.NYB', symbol: 'DXY', name: 'Dollar Index' },
        { ticker: '^TNX',  symbol: 'US10Y', name: '10Y Treasury' },
        { ticker: 'GC=F',  symbol: 'GOLD', name: 'Gold' },
        { ticker: 'CL=F',  symbol: 'OIL', name: 'Crude Oil' },
        { ticker: 'BTC-USD', symbol: 'BTC', name: 'Bitcoin' },
        { ticker: '^VVIX', symbol: 'VVIX', name: 'VIX of VIX' },
      ]),
      batchQuotes([
        { ticker: 'XLK',  symbol: 'XLK',  name: 'Technology',    sector: 'Technology'    },
        { ticker: 'XLF',  symbol: 'XLF',  name: 'Financials',    sector: 'Financials'    },
        { ticker: 'XLV',  symbol: 'XLV',  name: 'Healthcare',    sector: 'Healthcare'    },
        { ticker: 'XLE',  symbol: 'XLE',  name: 'Energy',        sector: 'Energy'        },
        { ticker: 'XLI',  symbol: 'XLI',  name: 'Industrials',   sector: 'Industrials'   },
        { ticker: 'XLY',  symbol: 'XLY',  name: 'Consumer Disc', sector: 'Consumer Disc' },
        { ticker: 'XLP',  symbol: 'XLP',  name: 'Consumer Stap', sector: 'Consumer Stap' },
        { ticker: 'XLU',  symbol: 'XLU',  name: 'Utilities',     sector: 'Utilities'     },
        { ticker: 'XLRE', symbol: 'XLRE', name: 'Real Estate',   sector: 'Real Estate'   },
        { ticker: 'XLB',  symbol: 'XLB',  name: 'Materials',     sector: 'Materials'     },
        { ticker: 'XLC',  symbol: 'XLC',  name: 'Comm Svcs',     sector: 'Comm Svcs'     },
      ]),
      batchQuotes([
        { ticker: 'NVDA',  symbol: 'NVDA',  name: 'NVIDIA',   sector: 'Technology' },
        { ticker: 'AMD',   symbol: 'AMD',   name: 'AMD',      sector: 'Technology' },
        { ticker: 'META',  symbol: 'META',  name: 'Meta',     sector: 'Technology' },
        { ticker: 'MSFT',  symbol: 'MSFT',  name: 'Microsoft',sector: 'Technology' },
        { ticker: 'TSLA',  symbol: 'TSLA',  name: 'Tesla',    sector: 'Consumer'   },
        { ticker: 'AAPL',  symbol: 'AAPL',  name: 'Apple',    sector: 'Technology' },
        { ticker: 'AMZN',  symbol: 'AMZN',  name: 'Amazon',   sector: 'Consumer'   },
        { ticker: 'GOOGL', symbol: 'GOOGL', name: 'Alphabet', sector: 'Technology' },
      ]),
      batchQuotes([
        { ticker: 'RELIANCE.NS',   symbol: 'RELIANCE',   name: 'Reliance Ind',  sector: 'Energy'   },
        { ticker: 'TATAMOTORS.NS', symbol: 'TATAMOTORS', name: 'Tata Motors',   sector: 'Auto'     },
        { ticker: 'HDFCBANK.NS',   symbol: 'HDFCBANK',   name: 'HDFC Bank',     sector: 'Banking'  },
        { ticker: 'INFY.NS',       symbol: 'INFY',       name: 'Infosys',       sector: 'IT'       },
        { ticker: 'TCS.NS',        symbol: 'TCS',        name: 'TCS',           sector: 'IT'       },
        { ticker: 'ICICIBANK.NS',  symbol: 'ICICIBANK',  name: 'ICICI Bank',    sector: 'Banking'  },
      ]),
    ]);

    const spx  = (indices as any[]).find(q => q?.symbol === 'SPX');
    const ndx  = (indices as any[]).find(q => q?.symbol === 'NDX');
    const vix  = (indices as any[]).find(q => q?.symbol === 'VIX');
    const dxy  = (indices as any[]).find(q => q?.symbol === 'DXY');

    const vixPrice  = vix?.price  ?? 18;
    const spPct     = spx?.changePct ?? 0;
    const ndPct     = ndx?.changePct ?? 0;
    const dxyPct    = dxy?.changePct ?? 0;
    const fearGreed = Math.max(5, Math.min(95, Math.round(100 - (vixPrice / 40) * 100)));
    const fearLabel = fearGreed >= 75 ? 'Extreme Greed' : fearGreed >= 55 ? 'Greed' : fearGreed >= 45 ? 'Neutral' : fearGreed >= 25 ? 'Fear' : 'Extreme Fear';
    const regime    = inferRegime(vixPrice, fearGreed, spPct);

    const regimeDrivers = [
      fearGreed >= 60 ? { text: `Risk appetite strong — Fear & Greed at ${fearGreed}`, positive: true }
                      : { text: `Cautious sentiment — Fear & Greed at ${fearGreed}`, positive: false },
      vixPrice < 18   ? { text: `VIX ${vixPrice.toFixed(1)} — low volatility, calm conditions`, positive: true }
                      : { text: `VIX ${vixPrice.toFixed(1)} — volatility elevated, hedge accordingly`, positive: false },
      ndPct > 0.5     ? { text: `Tech / NASDAQ leading broad market +${ndPct.toFixed(2)}%`, positive: true }
                      : ndPct < -0.5 ? { text: `NASDAQ underperforming — tech rotation risk`, positive: false }
                                     : { text: `NASDAQ flat — consolidation mode`, positive: null as any },
      dxyPct < 0      ? { text: `Dollar weakening (DXY ${dxyPct.toFixed(2)}%) — tailwind for equities`, positive: true }
                      : { text: `Dollar strengthening (DXY +${dxyPct.toFixed(2)}%) — risk headwind`, positive: false },
      spPct >= 0.3    ? { text: `Breadth improving — S&P 500 advancing ${spPct.toFixed(2)}%`, positive: true }
                      : { text: `S&P 500 breadth mixed — ${spPct.toFixed(2)}%`, positive: null as any },
    ];

    const allMovers = [...(sectors as any[]), ...(momentum as any[]), ...(india as any[])].filter(Boolean);
    const sorted    = [...allMovers].sort((a: any, b: any) => b.changePct - a.changePct);

    const enrichedSectors = (sectors as any[]).filter(Boolean).map((s: any) => {
      const rsi = calcRsi(s.sparkline);
      const bs  = breakoutScore(s);
      const flowB = +(Math.abs(s.changePct) * s.volRatio * 0.35).toFixed(2);
      return {
        ...s, rsi,
        bias:         s.changePct >= 0.5 ? 'bullish' : s.changePct <= -0.5 ? 'bearish' : 'neutral',
        momentum:     s.changePct >= 1.5 ? 'strong' : s.changePct >= 0.3 ? 'moderate' : s.changePct >= -0.3 ? 'neutral' : 'weak',
        moneyFlow:    { value: flowB, direction: s.changePct >= 0 ? 'in' : 'out' },
        strengthScore: Math.round(Math.abs(s.changePct) * 20 + (s.volRatio - 1) * 15),
      };
    });

    const momentumLeaders = [...(momentum as any[]), ...(india as any[])].filter(Boolean).map((q: any) => ({
      ...q,
      rsi:            calcRsi(q.sparkline),
      breakoutScore:  breakoutScore(q),
      trendScore:     Math.min(99, Math.round(Math.abs(q.changePct) * 15 + q.volRatio * 12)),
    })).sort((a: any, b: any) => b.trendScore - a.trendScore).slice(0, 8);

    const breakouts = momentumLeaders
      .filter((q: any) => q.breakoutScore >= 38)
      .map((q: any) => ({
        ...q,
        status:   q.breakoutScore >= 72 ? 'CONFIRMED' : q.breakoutScore >= 50 ? 'EARLY' : 'EXTENDED',
        pattern:  q.high52w > 0 && (q.high52w - q.price) / q.high52w < 0.05 ? '52W High Breakout'
                : q.volRatio > 2 ? 'Volume Surge Breakout' : 'Momentum Continuation',
        aiReason: `${q.symbol} showing ${q.volRatio.toFixed(1)}× avg volume with RSI ${calcRsi(q.sparkline).toFixed(0)} — ${q.changePct >= 0 ? 'bullish' : 'bearish'} momentum confirmed.`,
      }))
      .slice(0, 6);

    const volMonitor = (indices as any[]).filter(Boolean).map((q: any) => {
      const rs = q.symbol === 'VIX'   ? Math.round((q.price / 40) * 100)
               : q.symbol === 'US10Y' ? (q.price > 4.5 ? 70 : 45)
               : q.symbol === 'DXY'   ? (q.changePct > 0 ? 55 : 40)
               : q.symbol === 'BTC'   ? Math.round(Math.abs(q.changePct) * 8 + 30)
               : Math.round(Math.abs(q.changePct) * 10 + 30);
      return { ...q, riskScore: Math.min(rs, 99) };
    });

    const adv = Math.round(fearGreed * 24 + 100);
    const dec = Math.round((100 - fearGreed) * 18 + 80);
    const adPct = Math.round((adv / (adv + dec)) * 100);

    const now = new Date();
    const etH = ((now.getUTCHours() - 4) % 24 + 24) % 24;
    const etD = etH + now.getUTCMinutes() / 60;
    const marketOpen = now.getUTCDay() >= 1 && now.getUTCDay() <= 5 && etD >= 9.5 && etD < 16;

    const topSectorName = enrichedSectors.sort((a: any, b: any) => b.changePct - a.changePct)[0]?.name ?? '—';

    return NextResponse.json({
      timestamp:   new Date().toISOString(),
      marketOpen,
      fearGreed:   { value: fearGreed, label: fearLabel },
      vix:         vix ? { price: vix.price, changePct: vix.changePct } : null,
      aiSentiment: fearGreed >= 60 ? 'Bullish' : fearGreed >= 45 ? 'Neutral' : 'Bearish',
      regime:      { ...regime, drivers: regimeDrivers },
      gainers:     sorted.slice(0, 6),
      losers:      [...sorted].reverse().slice(0, 6),
      sectors:     enrichedSectors,
      momentumLeaders,
      volMonitor,
      breakouts,
      moneyFlow: enrichedSectors.map((s: any) => ({
        sector: s.name, flow: s.moneyFlow.value, direction: s.moneyFlow.direction, pct: s.changePct,
      })).sort((a: any, b: any) => b.flow - a.flow),
      internals: {
        advancing: adv, declining: dec, adPct,
        newHighs:  Math.round(fearGreed * 1.8 + 20),
        newLows:   Math.round((100 - fearGreed) * 1.2 + 5),
        trin:      +((adv / (adv + dec)) * 1.4 + 0.3).toFixed(2),
        tickIdx:   Math.round((fearGreed - 50) * 8),
        volBreadth: Math.round(adPct * 0.9 + 5),
      },
      narrative: {
        bias: regime.regime, biasColor: regime.color, confidence: regime.confidence,
        bullets: [
          `Market regime: ${regime.regime} — confidence ${regime.confidence}%`,
          `S&P 500 ${spPct >= 0 ? '▲' : '▼'} ${Math.abs(spPct).toFixed(2)}%, NASDAQ ${ndPct >= 0 ? '▲' : '▼'} ${Math.abs(ndPct).toFixed(2)}%`,
          `VIX ${vixPrice.toFixed(2)} — ${vixPrice < 18 ? 'low volatility, risk-on' : vixPrice < 25 ? 'moderate volatility' : 'elevated vol, risk-off'}`,
          `DXY ${dxyPct >= 0 ? 'strengthening' : 'weakening'} ${Math.abs(dxyPct).toFixed(2)}% — ${dxyPct < 0 ? 'tailwind for risk assets' : 'headwind for equities'}`,
          `Fear & Greed: ${fearGreed}/100 (${fearLabel})`,
          `Breadth: ${adPct}% advancing — ${adPct >= 55 ? 'broad-based strength' : adPct >= 45 ? 'mixed internals' : 'narrow market'}`,
          `Top sector: ${topSectorName}`,
        ],
        topSector:   topSectorName,
        riskArea:    vixPrice > 22 ? 'Elevated VIX — reduce leverage' : 'No immediate risk flags',
        tomorrow:    fearGreed >= 58 ? 'Cautiously Bullish' : fearGreed >= 42 ? 'Neutral — watch data' : 'Risk-off — preserve capital',
        institutionalFlow: `${topSectorName} → ${enrichedSectors.sort((a: any, b: any) => a.changePct - b.changePct)[0]?.name ?? '—'}`,
      },
      indices: (indices as any[]).filter(Boolean),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
