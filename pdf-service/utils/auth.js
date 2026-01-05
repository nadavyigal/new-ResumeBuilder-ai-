const logger = require('./logger');

/**
 * Authentication middleware
 * Validates PDF_SERVICE_SECRET via Authorization Bearer token
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const PDF_SERVICE_SECRET = process.env.PDF_SERVICE_SECRET;

  if (!PDF_SERVICE_SECRET) {
    logger.error('PDF_SERVICE_SECRET environment variable not configured');
    return res.status(500).json({
      success: false,
      error: 'Server configuration error',
      code: 'CONFIG_ERROR',
    });
  }

  if (!authHeader) {
    logger.warn('Missing Authorization header');
    return res.status(401).json({
      success: false,
      error: 'Missing Authorization header',
      code: 'AUTH_MISSING',
    });
  }

  const expectedHeader = `Bearer ${PDF_SERVICE_SECRET}`;
  if (authHeader !== expectedHeader) {
    logger.warn('Invalid authorization token');
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      code: 'AUTH_INVALID',
    });
  }

  // Authentication successful
  next();
}

module.exports = authMiddleware;
