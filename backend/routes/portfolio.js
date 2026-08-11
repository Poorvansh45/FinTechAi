/**
 * Portfolio Route — /api/portfolio
 *
 * Node.js handles: routing, validation, error classification
 * Python handles:  all quantitative calculations
 *
 * Response contract:
 *   Success:       { success: true, validTickers, warnings?, ...metrics }
 *   Partial:       { success: true, warnings: [...], failedTickers: [...], ...metrics }
 *   Engine error:  { error: string, warnings?: [...], failedTickers?: [...] }
 *   Node error:    { error: string }
 */

const express  = require('express');
const router   = express.Router();
const { analyzePortfolio } = require('../services/portfolioService');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { protect } = require('../middleware/authMiddleware');

/**
 * Upper bound on tickers per request.
 *
 * Each call spawns a Python process (services/portfolioService.js), so an
 * unbounded array is a cheap way to exhaust CPU and memory on a small
 * instance. 30 is not an arbitrary number: it matches the contract the
 * equivalent FastAPI endpoint already enforces —
 * `tickers: list[str] = Field(..., min_length=2, max_length=30)` in
 * fastapi_app/schemas/portfolio.py — so both /analyze endpoints now accept
 * exactly the same range. The existing `< 2` check below already mirrored
 * that schema's lower bound; this closes the upper one.
 */
const MAX_TICKERS = 30;

/**
 * POST /api/portfolio/analyze
 * Body: { tickers: string[], weights: { ticker: number }, riskProfile?: string }
 */
router.post('/analyze', protect, asyncHandler(async (req, res, next) => {
  try {
    const { tickers, weights, riskProfile } = req.body;

    // Basic presence check
    if (!tickers || !weights) {
      return res.status(400).json({
        error: 'Request body must include "tickers" (array) and "weights" (object).',
      });
    }

    if (!Array.isArray(tickers) || tickers.length < 2) {
      return res.status(400).json({
        error: 'At least 2 tickers are required for portfolio optimization.',
      });
    }

    // Bounded BEFORE analyzePortfolio() — which spawns the Python process — so
    // an oversized array is rejected without any subprocess being created.
    if (tickers.length > MAX_TICKERS) {
      return res.status(400).json({
        error: `At most ${MAX_TICKERS} tickers are supported per request.`,
      });
    }

    let result;
    try {
      result = await analyzePortfolio({ tickers, weights, riskProfile });
    } catch (err) {
      const isUserError = err.message.includes('At least') || err.message.includes('Weights');
      throw new HttpError(isUserError ? 400 : 500, err.message);
    }

    // Python returned a structured error (e.g. not enough valid tickers)
    if (result.error) {
      return res.status(422).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    if (typeof next === 'function') {
      next(error);
    } else {
      res.status(error.status || 500).json({ error: error.message });
    }
  }
}));

module.exports = router;
