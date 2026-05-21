/**
 * FinAI Edge — Portfolio Service (Node.js Bridge) — Hardened
 * ===========================================================
 * Node.js responsibilities:
 *   - HTTP routing, request validation
 *   - Spawning the Python quantitative engine
 *   - Caching expensive computation results
 *   - Forwarding structured warnings to frontend (NOT crashes)
 *
 * Python responsibilities:
 *   - All MPT math, SciPy optimization, Monte Carlo
 *   - yfinance data fetching and ticker validation
 *   - VaR, drawdown, correlation, diversification score
 *
 * Resilience pattern:
 *   - Engine errors are caught and returned as { error, warnings }
 *   - Partial results (some tickers invalid) are still returned
 *   - Never crash the Node process on Python errors
 */

const { spawn } = require('child_process');
const path      = require('path');

// In-memory cache: key = sorted tickers + normalized weights
const cache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/** Find the Python binary (cross-platform) */
const PY_CMD = process.platform === 'win32' ? 'python' : 'python3';
const SCRIPT  = path.join(__dirname, '..', 'scripts', 'portfolio_engine.py');

/**
 * Spawn the Python engine and collect its stdout/stderr.
 * Resolves with parsed JSON. Rejects on process error.
 * Never throws on Python-level errors — they are returned as { error: string }.
 */
function runPythonEngine(payload) {
  return new Promise((resolve, reject) => {
    const proc = spawn(PY_CMD, [SCRIPT, JSON.stringify(payload)]);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', chunk => { stdout += chunk.toString(); });
    proc.stderr.on('data', chunk => { stderr += chunk.toString(); });

    proc.on('close', code => {
      // Log Python stderr (our structured logging goes there)
      if (stderr.trim()) {
        console.log(`[Portfolio Engine] ${stderr.trim()}`);
      }

      if (!stdout.trim()) {
        return reject(new Error(
          code !== 0
            ? `Python exited with code ${code}. Check Python/dependencies.`
            : 'Python produced no output.'
        ));
      }

      try {
        const result = JSON.parse(stdout.trim());
        // Python-level errors are returned as { error } — resolve (not reject)
        // so the route can forward them cleanly to the frontend
        resolve(result);
      } catch (e) {
        reject(new Error(`Failed to parse Python output: ${stdout.slice(0, 300)}`));
      }
    });

    proc.on('error', err => {
      if (err.code === 'ENOENT') {
        reject(new Error(
          `Python not found. Make sure Python 3 is installed and in PATH. ` +
          `Run: pip install numpy pandas scipy yfinance`
        ));
      } else {
        reject(new Error(`Could not start Python process: ${err.message}`));
      }
    });
  });
}

/**
 * Main service function.
 * Validates inputs, checks cache, delegates to Python, forwards result.
 */
async function analyzePortfolio({ tickers, weights, riskProfile }) {
  // ── Input validation (Node layer) ──────────────────────────────────────────
  if (!Array.isArray(tickers) || tickers.length < 2) {
    throw new Error('At least 2 tickers are required for portfolio analysis.');
  }

  if (!weights || typeof weights !== 'object') {
    throw new Error('Weights must be an object mapping ticker → proportion.');
  }

  // Sanitize tickers: trim whitespace, convert to uppercase
  const cleanTickers = tickers.map(t => t.trim().toUpperCase());

  const totalWeight = Object.values(weights).reduce((a, b) => a + Number(b), 0);
  if (Math.abs(totalWeight - 1) > 0.05) {
    throw new Error(
      `Weights must sum to approximately 1.0. Got ${totalWeight.toFixed(4)}. ` +
      `Use the Auto-balance feature to normalize allocations.`
    );
  }

  // Normalize weights to exactly 1
  const normalizedWeights = {};
  for (const [t, w] of Object.entries(weights)) {
    normalizedWeights[t.trim().toUpperCase()] = Number(w) / totalWeight;
  }

  // ── Cache lookup ───────────────────────────────────────────────────────────
  const cacheKey = JSON.stringify({
    tickers: [...cleanTickers].sort(),
    weights: normalizedWeights,
  });

  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    console.log(`[Portfolio Service] Cache hit (${cleanTickers.join(', ')})`);
    return cached.data;
  }

  // ── Run Python engine ──────────────────────────────────────────────────────
  console.log(`[Portfolio Service] Running engine for: ${cleanTickers.join(', ')}`);

  const result = await runPythonEngine({
    tickers:     cleanTickers,
    weights:     normalizedWeights,
    riskProfile: riskProfile ?? 'balanced',
  });

  // If Python returned a structured error (bad data, not enough assets, etc.)
  // still cache and return it — the frontend handles the display
  if (!result.error) {
    cache.set(cacheKey, { data: result, ts: Date.now() });
  }

  return result;
}

module.exports = { analyzePortfolio };
