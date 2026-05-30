/**
 * Market API Routes
 *
 * GET /api/markets/overview   — Global indices batch quotes
 * GET /api/markets/news       — AI-processed market intelligence feed
 * GET /api/markets/quote/:sym — Single symbol quote
 *
 * All data fetched server-side via Finnhub; API key never exposed to client.
 */

const express = require('express');
const router = express.Router();
const { getGlobalOverview, getMarketNews, getQuote } = require('../services/marketService');
const asyncHandler = require('../utils/asyncHandler');

// ── Global overview (batch indices) ──────────────────────────
router.get('/overview', asyncHandler(async (req, res, next) => {
  try {
    const data = await getGlobalOverview();
    res.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (error) {
    if (typeof next === 'function') {
      next(error);
    } else {
      res.status(500).json({ error: error.message });
    }
  }
}));

// ── Processed news / intelligence feed ───────────────────────
router.get('/news', asyncHandler(async (req, res, next) => {
  try {
    const category = req.query.category || 'general';
    const count = Math.min(parseInt(req.query.count) || 15, 50);
    const data = await getMarketNews(category, count);
    res.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (error) {
    if (typeof next === 'function') {
      next(error);
    } else {
      res.status(500).json({ error: error.message });
    }
  }
}));

// ── Single quote ─────────────────────────────────────────────
router.get('/quote/:symbol', asyncHandler(async (req, res, next) => {
  try {
    const data = await getQuote(req.params.symbol);
    res.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (error) {
    if (typeof next === 'function') {
      next(error);
    } else {
      res.status(500).json({ error: error.message });
    }
  }
}));

module.exports = router;
