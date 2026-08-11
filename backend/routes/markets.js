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
const { protect } = require('../middleware/authMiddleware');

// Every route below requires a session. These endpoints spend third-party
// (Finnhub) request quota, and `/quote/:symbol` takes a caller-supplied symbol
// — so the in-memory TTL cache, which is keyed per symbol, is missed on every
// distinct symbol an anonymous caller asks for. Left open, one script could
// exhaust the quota for real users.

// ── Global overview (batch indices) ──────────────────────────
router.get('/overview', protect, asyncHandler(async (req, res, next) => {
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
router.get('/news', protect, asyncHandler(async (req, res, next) => {
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
router.get('/quote/:symbol', protect, asyncHandler(async (req, res, next) => {
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
