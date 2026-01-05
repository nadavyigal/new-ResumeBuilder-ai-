require('@swc/register')({
  jsc: {
    parser: {
      syntax: 'ecmascript',
      jsx: true,
    },
    transform: {
      react: {
        runtime: 'classic',
      },
    },
  },
  module: {
    type: 'commonjs',
  },
  extensions: ['.js', '.jsx'],
});
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');
const authMiddleware = require('./utils/auth');
const errorHandler = require('./utils/error-handler');
const { getBrowser, shutdown: shutdownBrowser } = require('./lib/pdf-generator');
const generatePdfRouter = require('./routes/generate-pdf');

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================
// Middleware
// ============================================

// Security headers
app.use(helmet());

// CORS configuration
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',');
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`CORS policy violation from origin: ${origin}`);
      callback(new Error('CORS policy violation'));
    }
  },
  credentials: true,
}));

// Rate limiting (10 requests per minute per IP)
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10,
  message: { success: false, error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/generate-pdf', limiter);

// Body parsing (10MB limit for resume data)
app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

// ============================================
// Routes
// ============================================

// Health check (no auth required)
app.get('/health', async (req, res) => {
  const memoryUsage = process.memoryUsage();

  // Check Chromium availability
  let chromiumStatus = false;
  try {
    const browser = await getBrowser();
    chromiumStatus = browser && browser.isConnected();
  } catch (error) {
    logger.warn('[Health] Chromium check failed', { error: error.message });
  }

  res.json({
    status: 'healthy',
    chromium: chromiumStatus,
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    memory: {
      used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
    },
  });
});

// PDF generation routes
app.use('/api', generatePdfRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// Error handler
app.use(errorHandler);

// ============================================
// Startup & Shutdown
// ============================================

let server;

// Graceful shutdown
async function gracefulShutdown(signal) {
  logger.info(`${signal} received, shutting down gracefully...`);

  // Close browser instance
  try {
    await shutdownBrowser();
  } catch (error) {
    logger.error('Error shutting down browser:', error);
  }

  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection:', { reason, promise });
});

// Start HTTP server
server = app.listen(PORT, () => {
  logger.info(`PDF service listening on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV}`);
  logger.info(`Allowed origins: ${allowedOrigins.join(', ')}`);

  // Warm up browser instance
  getBrowser()
    .then(() => logger.info('Browser instance initialized'))
    .catch((error) => logger.error('Failed to initialize browser:', error));
});
