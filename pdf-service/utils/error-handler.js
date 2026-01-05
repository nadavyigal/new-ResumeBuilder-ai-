const logger = require('./logger');

/**
 * Centralized error handling middleware
 * Catches all errors and returns consistent JSON responses
 */
function errorHandler(err, req, res, next) {
  // Log the full error
  logger.error('Request error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Determine status code
  let statusCode = err.statusCode || err.status || 500;

  // Determine error code
  let errorCode = 'SERVER_ERROR';
  if (err.message.includes('CORS')) {
    statusCode = 403;
    errorCode = 'CORS_ERROR';
  } else if (err.message.includes('timeout')) {
    statusCode = 504;
    errorCode = 'TIMEOUT_ERROR';
  } else if (err.message.includes('validation')) {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
  }

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: err.message || 'Internal server error',
    code: errorCode,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

module.exports = errorHandler;
