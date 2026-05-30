require('dotenv').config();

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 8080),
  frontendUrl: process.env.FRONTEND_URL,
  mongoUri: process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/finai_edge',
  jwtSecret: process.env.JWT_SECRET || 'change_this_secret_in_production',
  jwtExpire: process.env.JWT_EXPIRE || '30d',
  finnhubApiKey: process.env.FINNHUB_API_KEY,
};

env.isProduction = env.nodeEnv === 'production';

if (!process.env.JWT_SECRET && !env.isProduction) {
  console.warn('[WARN] JWT_SECRET not set in .env — using insecure default. Set it before deploying.');
}

module.exports = env;
