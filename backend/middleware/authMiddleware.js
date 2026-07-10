const jwt = require('jsonwebtoken');
const User = require('../models/User');
const HttpError = require('../utils/httpError');
const asyncHandler = require('../utils/asyncHandler');
const env = require('../config/env');

/**
 * protect — JWT auth middleware.
 * Reads token from:
 *  1. HTTP-only cookie "jwt"  (preferred — set by authController)
 *  2. Authorization: Bearer <token>  (fallback for API clients)
 *
 * Attaches req.user (full Mongoose document, password excluded) on success.
 */
const protect = asyncHandler(async (req, res, next) => {
  try {
    let token;

    // 1. Cookie-based (HTTP-only, most secure)
    if (req.cookies && req.cookies.jwt) {
      token = req.cookies.jwt;
    }
    // 2. Header-based fallback
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.slice('Bearer '.length);
    }

    if (!token) {
      if (typeof next === 'function') {
        return next(new HttpError(401, 'Not authorized — no token provided'));
      }
      return res.status(401).json({ error: 'Not authorized — no token provided' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, env.jwtSecret);
    } catch (err) {
      if (typeof next === 'function') {
        return next(new HttpError(401, 'Not authorized — token is invalid or expired'));
      }
      return res.status(401).json({ error: 'Not authorized — token is invalid or expired' });
    }

    // Attach fresh user from DB (ensures user still exists)
    const user = await User.findById(decoded.id);
    if (!user) {
      if (typeof next === 'function') {
        return next(new HttpError(401, 'Not authorized — user no longer exists'));
      }
      return res.status(401).json({ error: 'Not authorized — user no longer exists' });
    }

    req.user = user;
    req.token = token; // raw JWT string — used by GET /api/auth/token
    if (typeof next === 'function') {
      next();
    }
  } catch (error) {
    if (typeof next === 'function') {
      next(error);
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

module.exports = { protect };
