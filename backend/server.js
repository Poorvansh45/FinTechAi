// ── DNS SRV Resolution Fix for MongoDB Atlas ───────────────────
const dns = require('dns');
try {
  dns.setDefaultResultOrder('ipv4first');
  dns.setServers(['1.1.1.1', '8.8.8.8']);
} catch (err) {
  console.warn('[WARN] Could not configure DNS resolution:', err.message);
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const env = require('./config/env');
const { protect } = require('./middleware/authMiddleware');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();

// ── Reverse proxy ──────────────────────────────────────────────
// Render (like most PaaS) terminates TLS at a load balancer and forwards the
// real caller in X-Forwarded-For. Without this, req.ip is the proxy's address
// on EVERY request, so the rate limiter below collapses into a single global
// bucket — 100 requests per 15 minutes shared by all users rather than each.
// express-rate-limit detects this itself and raises
// ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.
//
// The value is 1, not `true`. `true` trusts the whole X-Forwarded-For chain,
// so a caller could prepend a forged address and mint a fresh rate-limit
// bucket per request, bypassing the limiter entirely. 1 trusts only the
// nearest hop — Render's own proxy — and reads the client address from there.
// Harmless locally: with no X-Forwarded-For present, req.ip is the socket
// address as before.
app.set('trust proxy', 1);

// ── Security & Logging ─────────────────────────────────────────
app.use(helmet());
app.use(morgan(env.isProduction ? 'combined' : 'dev'));

// ── Body & Cookie Parsers ──────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// ── CORS ───────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:9002',
  'http://localhost:3000',
  env.frontendUrl,
].filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    console.warn(`[CORS] Blocked: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true, // Required for cookies to be sent cross-origin
}));

// ── Rate Limiting ──────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

// ── Health Check ───────────────────────────────────────────────
app.get('/health', (req, res, next) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

// ── Routes ─────────────────────────────────────────────────────
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

const marketsRouter = require('./routes/markets');
app.use('/api/markets', marketsRouter);

const portfolioRouter = require('./routes/portfolio');
app.use('/api/portfolio', portfolioRouter);

// Protected user profile route (example of protect middleware usage)
app.get('/api/user/profile', protect, (req, res, next) => {
  res.status(200).json({
    success: true,
    message: 'Secure data accessed successfully',
    userId: req.user._id,
    username: req.user.username,
  });
});

// ── Error Handlers ─────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ── MongoDB + Server Start ─────────────────────────────────────
async function start() {
  try {
    await mongoose.connect(env.mongoUri);
    console.log('[MongoDB] Connected successfully');
  } catch (err) {
    console.error('[MongoDB] Connection failed:', err.message);
    console.warn('[MongoDB] Continuing without DB — auth endpoints will fail until connected.');
  }

  app.listen(env.port, () => {
    console.log(`\n🚀 FinAI Edge Backend running on port ${env.port}`);
    console.log(`   Environment: ${env.nodeEnv}`);
    console.log(`   API Base:    http://localhost:${env.port}/api`);
  });
}

// Only auto-start when run directly (node server.js). When imported by tests,
// the app is exported without listening or connecting to MongoDB.
if (require.main === module) {
  start();
}

module.exports = app;
