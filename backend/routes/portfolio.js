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

/**
 * POST /api/portfolio/analyze
 * Body: { tickers: string[], weights: { ticker: number }, riskProfile?: string }
 */
router.post('/analyze', async (req, res) => {
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

  try {
    const result = await analyzePortfolio({ tickers, weights, riskProfile });

    // Python returned a structured error (e.g. not enough valid tickers)
    if (result.error) {
      return res.status(422).json(result);
    }

    return res.status(200).json(result);

  } catch (err) {
    // Node-level or process spawn errors
    console.error('[Portfolio Route]', err.message);

    // User-facing vs. internal error
    const isUserError = err.message.includes('At least') || err.message.includes('Weights');
    return res.status(isUserError ? 400 : 500).json({ error: err.message });
  }
});

module.exports = router;
