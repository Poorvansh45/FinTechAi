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

// ── Global overview (batch indices) ──────────────────────────
router.get('/overview', async (req, res) => {
  try {
    const data = await getGlobalOverview();
    res.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('Markets overview error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch market overview' });
  }
});

// ── Processed news / intelligence feed ───────────────────────
router.get('/news', async (req, res) => {
  try {
    const category = req.query.category || 'general';
    const count = Math.min(parseInt(req.query.count) || 15, 50);
    const data = await getMarketNews(category, count);
    res.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('Market news error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch market intelligence' });
  }
});

// ── Single quote ─────────────────────────────────────────────
router.get('/quote/:symbol', async (req, res) => {
  try {
    const data = await getQuote(req.params.symbol);
    res.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error(`Quote error (${req.params.symbol}):`, err);
    res.status(500).json({ success: false, error: 'Failed to fetch quote' });
  }
});

module.exports = router;
