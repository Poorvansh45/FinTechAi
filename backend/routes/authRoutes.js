const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { login, logout, getMe, updateUsername, getToken } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

/**
 * Brute-force guard for the one endpoint that checks a password.
 *
 * The global limiter in server.js is a traffic control (100 per 15 min across
 * all of /api/); it is far too loose to constrain password guessing, and the
 * roster contains real, publicly known addresses. bcrypt cost 12 buys time but
 * is not a control.
 *
 * `skipSuccessfulRequests` means only responses >= 400 consume budget, so a
 * legitimate user signing in never spends their own allowance — the limit
 * applies to failures, not to traffic.
 *
 * No custom `keyGenerator` on purpose. The default reads `req.ip`, which
 * Express resolves using `trust proxy = 1` (server.js) — i.e. only the hop
 * Render itself appended. Hand-rolling one from `X-Forwarded-For` would let a
 * caller prepend a forged address and mint a fresh bucket per attempt, and
 * express-rate-limit v7 additionally rejects custom generators that mishandle
 * IPv6 (ERR_ERL_KEY_GEN_IPV6). Inheriting the default is what makes this
 * unspoofable.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 5,                   // failed attempts per client, per window
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many failed login attempts. Please try again later.' },
});

// Public routes
//
// There is deliberately NO /register route. Nivro is a closed private beta:
// accounts are seeded by `scripts/seedUsers.js` and nobody can self-register.
// The route is removed rather than merely guarded so it cannot regress behind a
// misconfigured flag.
router.post('/login', loginLimiter, login);

// Protected routes
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.put('/username', protect, updateUsername);
router.get('/token', protect, getToken);

module.exports = router;
