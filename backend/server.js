require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const admin = require('firebase-admin');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 8080;

// ==========================================
// 1. FIREBASE ADMIN SETUP
// ==========================================
// Initialize Firebase Admin (Required for verifying auth tokens securely in backend)
if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Replace escaped newlines from Render env vars
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
    console.log('✅ Firebase Admin initialized');
  } catch (err) {
    console.error('❌ Firebase Admin init error:', err.message);
  }
} else {
  console.warn('⚠️ Missing Firebase Admin environment variables. Auth verification will fail.');
}

// ==========================================
// 2. MIDDLEWARE (Production Configuration)
// ==========================================
// Secure HTTP headers
app.use(helmet());

// Request logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Body parser
app.use(express.json());

// CORS configuration - allowing local dev and Vercel production domains
const allowedOrigins = [
  'http://localhost:9002',
  'http://localhost:3000',
  process.env.FRONTEND_URL, // e.g. https://finai-edge.vercel.app
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`Blocked by CORS: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// Rate limiting to prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

// ==========================================
// 3. AUTHENTICATION MIDDLEWARE
// ==========================================
// Use this middleware to protect backend routes
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Token verification failed:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

// ==========================================
// 4. ROUTES
// ==========================================
// Health check route for Render
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Example protected route
app.get('/api/user/profile', verifyToken, (req, res) => {
  res.status(200).json({
    message: 'Secure data accessed successfully',
    uid: req.user.uid,
  });
});

// Market data routes (public — no auth required for market data)
const marketsRouter = require('./routes/markets');
app.use('/api/markets', marketsRouter);

// Portfolio optimizer routes (public for now — add auth in future)
const portfolioRouter = require('./routes/portfolio');
app.use('/api/portfolio', portfolioRouter);

// ==========================================
// 5. ERROR HANDLING
// ==========================================
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ==========================================
// 6. START SERVER
// ==========================================
app.listen(PORT, () => {
  console.log(`🚀 Production backend running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});
