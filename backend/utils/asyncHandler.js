function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch((err) => {
      if (typeof next === 'function') {
        next(err);
      } else {
        console.error('Unhandled async error:', err);
      }
    });
  };
}

module.exports = asyncHandler;
