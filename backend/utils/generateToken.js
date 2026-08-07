const jwt = require('jsonwebtoken');
const env = require('../config/env');

/**
 * Attributes for the `jwt` cookie. Exported so logout clears it with the SAME
 * attributes — a mismatch means the browser rejects the clearing Set-Cookie and
 * the session survives a logout.
 *
 * Production is genuinely cross-site: the frontend is served from Vercel and
 * this API from Render, which are different registrable domains. `sameSite:
 * 'strict'` would stop the browser sending this cookie on those requests at
 * all, and that breaks more than login — `GET /api/auth/token` reads this
 * cookie to hand the frontend the bearer token it needs for FastAPI, so every
 * scanner call would fall back to anonymous and 401. Hence `sameSite: 'none'`,
 * which browsers only honour together with `secure: true` (Render terminates
 * TLS, so production is always HTTPS).
 *
 * Local development stays on `lax` + non-secure: same-site over plain HTTP,
 * where `none`/`secure` would be rejected outright.
 */
const jwtCookieOptions = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: env.isProduction ? 'none' : 'lax',
};

/**
 * Generate a JWT and set it as an HTTP-only cookie on the response.
 * @param {Object} res - Express response object
 * @param {string} userId - MongoDB user _id
 * @returns {string} The signed JWT string
 */
function generateToken(res, userId) {
  const token = jwt.sign({ id: userId }, env.jwtSecret, {
    expiresIn: env.jwtExpire,
  });

  res.cookie('jwt', token, {
    ...jwtCookieOptions,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in ms
  });

  return token;
}

module.exports = generateToken;
module.exports.jwtCookieOptions = jwtCookieOptions;
