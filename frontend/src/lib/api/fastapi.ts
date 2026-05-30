/**
 * FinAI Edge — FastAPI Client
 * =============================
 * Dedicated API client for the Python FastAPI analytics backend.
 * Handles: portfolio analysis, market data, AI generation.
 *
 * Features:
 *  - AbortController timeout on every request (configurable per-call)
 *  - Exponential-backoff retry for transient 5xx / network errors
 *  - Structured FastAPIError with status + detail
 */

import { env } from '@/config/env';

// ── Constants ──────────────────────────────────────────────────────

/** Default request timeout in milliseconds (30 s). */
const DEFAULT_TIMEOUT_MS = 30_000;

/** Max number of automatic retries for transient errors. */
const MAX_RETRIES = 2;

/** Base backoff delay in ms (doubles each retry). */
const RETRY_BACKOFF_MS = 800;

// ── Types ──────────────────────────────────────────────────────────

export interface HoldingInput {
  ticker: string;
  name: string;
  quantity: number;
  avg_buy_price: number;
  current_price: number;
  sector?: string;
}

export interface HoldingStats {
  ticker: string;
  name: string;
  sector: string;
  quantity: number;
  avg_buy_price: number;
  current_price: number;
  invested: number;
  value: number;
  pnl: number;
  pnl_pct: number;
  allocation: number;
}

export interface PortfolioTotals {
  total_value: number;
  total_invested: number;
  total_pnl: number;
  total_pnl_pct: number;
  holding_count: number;
}

export interface SectorExposure {
  sector: string;
  value: number;
  weight_pct: number;
  stock_count: number;
  tickers: string[];
}

export interface HealthData {
  score: number;
  label: string;
  color: string;
  breakdown: Record<string, number>;
  summary: string;
}

export interface RiskData {
  volatility: number;
  volatility_pct: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  treynor_ratio: number;
  var_95: number;
  var_99: number;
  max_drawdown: number;
  max_drawdown_pct: number;
  beta: number;
  cagr: number;
  risk_level: {
    level: string;
    score: number;
    color: string;
    factors: string[];
  };
  data_source: string;
}

export interface RebalanceSuggestion {
  ticker: string;
  action: 'trim' | 'add' | 'remove' | 'introduce';
  current_pct: number;
  target_pct: number;
  delta_pct: number;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  category: string;
}

export interface HoldingsAnalysis {
  success: boolean;
  holdings: HoldingStats[];
  totals: PortfolioTotals;
  sector_exposure: SectorExposure[];
  sector_concentration: Record<string, unknown>;
  sector_bias: Record<string, unknown>;
  concentration: Record<string, unknown>;
  risk: RiskData;
  health: HealthData;
  rebalance_suggestions: RebalanceSuggestion[];
  insights: Array<{ title: string; body: string; tone: string }>;
  diversification_score: number;
}

export interface StockQuote {
  ticker: string;
  price: number | null;
  change: number | null;
  change_pct: number | null;
  high: number | null;
  low: number | null;
  prev_close: number | null;
  volume: number | null;
  available: boolean;
  source: string;
}

export interface InstrumentResult {
  ticker: string;
  name: string;
  sector: string;
  exchange: string;
  instrument_type: string;
}

// ── FastAPI Fetch Wrapper ──────────────────────────────────────────

class FastAPIError extends Error {
  status: number;
  detail: string;

  constructor(message: string, status: number, detail = '') {
    super(message);
    this.name = 'FastAPIError';
    this.status = status;
    this.detail = detail;
  }
}

/** Sleep helper for retry backoff. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Returns true for error types that should be retried. */
function isRetryable(status: number): boolean {
  // Retry on server errors and gateway timeouts; not on 4xx client errors
  return status === 0 || status >= 500;
}

async function fastapiFetch<T>(
  path: string,
  options: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const url = `${env.fastapiUrl}${path.startsWith('/') ? path : `/${path}`}`;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let lastError: Error = new Error('Unknown error');

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // Fresh AbortController per attempt so each gets its own timeout signal
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timerId);

      const text = await response.text();
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }

      if (!response.ok) {
        const detail =
          typeof data === 'object' && data && 'detail' in data
            ? String((data as { detail?: unknown }).detail)
            : `Request failed with status ${response.status}`;

        // Don't retry client errors
        if (!isRetryable(response.status)) {
          throw new FastAPIError(detail, response.status, detail);
        }

        lastError = new FastAPIError(detail, response.status, detail);

        if (attempt < MAX_RETRIES) {
          const delay = RETRY_BACKOFF_MS * Math.pow(2, attempt);
          console.warn(
            `[FastAPI] ${response.status} on attempt ${attempt + 1}/${MAX_RETRIES + 1}. Retrying in ${delay}ms…`,
          );
          await sleep(delay);
          continue;
        }
        throw lastError;
      }

      return data as T;
    } catch (err) {
      clearTimeout(timerId);

      // AbortError = timeout
      if (err instanceof DOMException && err.name === 'AbortError') {
        lastError = new FastAPIError(
          `Request to FastAPI timed out after ${timeoutMs / 1000}s`,
          408,
          'timeout',
        );

        if (attempt < MAX_RETRIES) {
          const delay = RETRY_BACKOFF_MS * Math.pow(2, attempt);
          console.warn(
            `[FastAPI] Timeout on attempt ${attempt + 1}/${MAX_RETRIES + 1}. Retrying in ${delay}ms…`,
          );
          await sleep(delay);
          continue;
        }
        throw lastError;
      }

      // FastAPIError already classified — bubble immediately
      if (err instanceof FastAPIError) throw err;

      // Network-level error (CORS, offline, DNS) — retryable
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < MAX_RETRIES) {
        const delay = RETRY_BACKOFF_MS * Math.pow(2, attempt);
        console.warn(
          `[FastAPI] Network error on attempt ${attempt + 1}/${MAX_RETRIES + 1}: ${lastError.message}. Retrying in ${delay}ms…`,
        );
        await sleep(delay);
        continue;
      }
      throw lastError;
    }
  }

  throw lastError;
}

// ── Portfolio API ──────────────────────────────────────────────────

export const portfolioApi = {
  /**
   * Full holdings-based analysis.
   * Returns P&L, sectors, risk metrics, health score, rebalance, insights.
   */
  analyzeHoldings: (holdings: HoldingInput[]) =>
    fastapiFetch<HoldingsAnalysis>('/api/v2/portfolio/analyze-holdings', {
      method: 'POST',
      body: JSON.stringify({ holdings }),
      timeoutMs: 90_000,   // 90 s — mirrors server-side ANALYSIS_TIMEOUT
    }),

  /**
   * MPT portfolio optimization.
   * Returns efficient frontier, optimal portfolios, VaR, drawdown.
   */
  analyzePortfolio: (
    tickers: string[],
    weights: Record<string, number>,
    riskProfile = 'balanced',
  ) =>
    fastapiFetch<Record<string, unknown>>('/api/v2/portfolio/analyze', {
      method: 'POST',
      body: JSON.stringify({ tickers, weights, risk_profile: riskProfile }),
    }),

  /** Quick health check. */
  getHealthScore: (holdings: HoldingInput[]) =>
    fastapiFetch<{ health: HealthData; risk: RiskData }>('/api/v2/portfolio/health', {
      method: 'POST',
      body: JSON.stringify({ holdings }),
    }),

  /** Get rebalance suggestions. */
  getRebalanceSuggestions: (holdings: HoldingInput[]) =>
    fastapiFetch<{ suggestions: RebalanceSuggestion[] }>('/api/v2/portfolio/rebalance', {
      method: 'POST',
      body: JSON.stringify({ holdings }),
    }),

  /** Save portfolio to MongoDB. */
  savePortfolio: (data: { user_id?: string; name: string; holdings: HoldingInput[] }) =>
    fastapiFetch<{ success: boolean; portfolio_id: string }>('/api/v2/portfolio/save', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** List saved portfolios. */
  listPortfolios: (userId = 'anonymous') =>
    fastapiFetch<{ portfolios: unknown[] }>(`/api/v2/portfolio/saved?user_id=${userId}`),
};

// ── Market Data API ────────────────────────────────────────────────

export const marketApi = {
  /** Get live quote for a symbol. */
  getQuote: (symbol: string) =>
    fastapiFetch<{ data: StockQuote }>(`/api/v2/market/quote/${encodeURIComponent(symbol)}`),

  /** Search instruments by query. */
  search: (query: string, limit = 12) =>
    fastapiFetch<{ results: InstrumentResult[] }>(
      `/api/v2/market/search?q=${encodeURIComponent(query)}&limit=${limit}`,
    ),

  /** Get bulk quotes for multiple symbols. */
  getBulkQuotes: (symbols: string[]) =>
    fastapiFetch<{ quotes: Record<string, StockQuote> }>(
      `/api/v2/market/bulk-quotes?symbols=${symbols.map(encodeURIComponent).join(',')}`,
    ),

  /** Get historical candles. */
  getCandles: (symbol: string, interval = '1d', period = '1y') =>
    fastapiFetch<{ candles: unknown[] }>(
      `/api/v2/market/candles/${encodeURIComponent(symbol)}?interval=${interval}&period=${period}`,
    ),

  /** Check provider status. */
  getProviderStatus: () =>
    fastapiFetch<{ providers: unknown[]; cache: unknown }>('/api/v2/market/provider-status'),
};

// ── AI API ─────────────────────────────────────────────────────────

export const aiApi = {
  /** Generate AI portfolio from onboarding. */
  generatePortfolio: (data: {
    goal: string;
    horizon: string;
    risk: string;
    monthly_investment: number;
    asset_preferences?: string[];
  }) =>
    fastapiFetch<Record<string, unknown>>('/api/v2/ai/generate-portfolio', {
      method: 'POST',
      body: JSON.stringify(data),
      timeoutMs: 45_000,   // 45 s — Gemini can be slow
    }),
};
