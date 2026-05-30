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
    console.error(err.stack || err.message);
  }

  res.status(status).json({
    error: err.message || 'Internal Server Error',
    ...(err.details && { details: err.details }),
    ...(!env.isProduction && status >= 500 && { stack: err.stack }),
  });
}

module.exports = { notFoundHandler, errorHandler };
