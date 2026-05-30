const admin = require('../config/firebaseAdmin');
const HttpError = require('../utils/httpError');

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    if (typeof next === 'function') {
      return next(new HttpError(401, 'Unauthorized: No token provided'));
    }
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.slice('Bearer '.length);
  try {
    req.user = await admin.auth().verifyIdToken(token);
    if (typeof next === 'function') {
      return next();
    }
  } catch (error) {
    console.error('Token verification failed:', error);
    if (typeof next === 'function') {
      return next(new HttpError(401, 'Unauthorized: Invalid token'));
    }
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
}

module.exports = { requireAuth };
