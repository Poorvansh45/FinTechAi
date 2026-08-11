const env = require('../config/env');

function notFoundHandler(req, res, next) {
  const err = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  err.status = 404;
  if (typeof next === 'function') {
    next(err);
  } else {
    res.status(404).json({ error: err.message });
  }
}

function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  if (status >= 500) {
    // Full diagnostics stay server-side, always — this is the only place they
    // are recorded, so it must not become conditional on the environment.
    console.error(err.stack || err.message);
  }

  // 4xx messages are deliberate and user-facing ("Invalid email or password",
  // "At most 30 tickers are supported per request") — they are part of the API
  // contract and are returned unchanged.
  //
  // 5xx messages are NOT authored: they are whatever an unhandled exception
  // happened to say, which in this codebase can include Mongo connection
  // strings, file paths, and driver internals (e.g. a MongooseError naming the
  // collection and host). In production those are replaced with a fixed string;
  // outside production the real message and stack are kept for debugging.
  const isServerError = status >= 500;
  const body = {
    error: isServerError && env.isProduction
      ? 'Internal Server Error'
      : (err.message || 'Internal Server Error'),
    ...(err.details && { details: err.details }),
    ...(!env.isProduction && isServerError && { stack: err.stack }),
  };

  res.status(status).json(body);
}

module.exports = { notFoundHandler, errorHandler };
