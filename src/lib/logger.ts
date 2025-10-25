/**
 * Centralized Logging Utility
 *
 * Provides structured logging with optional Sentry integration for error tracking.
 * Falls back to console logging if Sentry is not configured.
 */

import { IS_PRODUCTION } from '@/lib/env';

// ==================== TYPES ====================

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: any;
}

interface LogMessage {
  level: LogLevel;
  message: string;
  context?: LogContext;
  timestamp: string;
}

// ==================== SENTRY INTEGRATION ====================

/**
 * Lazy-load Sentry to avoid errors if not configured
 */
let Sentry: typeof import('@sentry/nextjs') | null = null;

async function initSentry() {
  if (Sentry) return Sentry;

  try {
    // Only initialize in production or if DSN is configured
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!dsn) {
      console.info('[Logger] Sentry DSN not configured - using console logging only');
      return null;
    }

    Sentry = await import('@sentry/nextjs');

    if (typeof window === 'undefined') {
      // Server-side initialization
      Sentry.init({
        dsn,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: IS_PRODUCTION ? 0.1 : 1.0,
        beforeSend(event) {
          // Don't send events in development unless explicitly enabled
          if (!IS_PRODUCTION && !process.env.SENTRY_DEBUG) {
            return null;
          }
          return event;
        },
      });
    }

    return Sentry;
  } catch (error) {
    console.error('[Logger] Failed to initialize Sentry:', error);
    return null;
  }
}

// Initialize Sentry on import (async, non-blocking)
if (typeof window === 'undefined') {
  initSentry();
}

// ==================== LOGGER CLASS ====================

class Logger {
  private context: LogContext;

  constructor(context: LogContext = {}) {
    this.context = context;
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext: LogContext): Logger {
    return new Logger({ ...this.context, ...additionalContext });
  }

  /**
   * Log debug message (development only)
   */
  debug(message: string, context?: LogContext): void {
    if (!IS_PRODUCTION) {
      this.log('debug', message, context);
    }
  }

  /**
   * Log informational message
   */
  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);

    // Send warning to Sentry in production
    if (IS_PRODUCTION && Sentry) {
      Sentry.captureMessage(message, {
        level: 'warning',
        contexts: { extra: { ...this.context, ...context } },
      });
    }
  }

  /**
   * Log error message and optionally send to Sentry
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    this.log('error', message, { ...context, error: error instanceof Error ? error.message : error });

    // Send error to Sentry
    if (Sentry) {
      const errorToReport = error instanceof Error ? error : new Error(message);

      Sentry.captureException(errorToReport, {
        contexts: {
          extra: { ...this.context, ...context },
        },
      });
    }
  }

  /**
   * Internal logging method
   */
  private log(level: LogLevel, message: string, context?: LogContext): void {
    const logMessage: LogMessage = {
      level,
      message,
      context: { ...this.context, ...context },
      timestamp: new Date().toISOString(),
    };

    // Console logging
    const consoleMethod = level === 'debug' || level === 'info' ? 'log' : level;
    const prefix = `[${logMessage.timestamp}] [${level.toUpperCase()}]`;

    if (Object.keys(logMessage.context || {}).length > 0) {
      console[consoleMethod](prefix, message, logMessage.context);
    } else {
      console[consoleMethod](prefix, message);
    }

    // TODO: Send to external logging service (e.g., Datadog, CloudWatch, etc.)
    // if (IS_PRODUCTION) {
    //   sendToLoggingService(logMessage);
    // }
  }
}

// ==================== EXPORTED INSTANCES ====================

/**
 * Default logger instance
 */
export const logger = new Logger();

/**
 * Create logger with specific context
 */
export function createLogger(context: LogContext): Logger {
  return new Logger(context);
}

/**
 * Export Sentry for direct use if needed
 */
export async function getSentry() {
  return await initSentry();
}

// ==================== CONVENIENCE FUNCTIONS ====================

/**
 * Quick logging functions
 */
export const log = {
  debug: (message: string, context?: LogContext) => logger.debug(message, context),
  info: (message: string, context?: LogContext) => logger.info(message, context),
  warn: (message: string, context?: LogContext) => logger.warn(message, context),
  error: (message: string, error?: Error | unknown, context?: LogContext) => logger.error(message, error, context),
};
