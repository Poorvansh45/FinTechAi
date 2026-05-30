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

/**
 * POST /api/portfolio/analyze
 * Body: { tickers: string[], weights: { ticker: number }, riskProfile?: string }
 */
router.post('/analyze', asyncHandler(async (req, res, next) => {
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
