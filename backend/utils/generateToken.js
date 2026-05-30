const jwt = require('jsonwebtoken');
const env = require('../config/env');

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
    httpOnly: true,
    secure: env.isProduction, // HTTPS only in production
    sameSite: env.isProduction ? 'strict' : 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in ms
  });

  return token;
}

module.exports = generateToken;
