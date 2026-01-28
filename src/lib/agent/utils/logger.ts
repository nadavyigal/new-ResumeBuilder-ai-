/**
 * Structured Logger with PII Redaction and Error Sanitization
 *
 * Enhanced for Phase 7 with:
 * - Extended PII patterns (SSN, credit cards, API keys)
 * - Log levels (debug, info, warn, error)
 * - Error sanitization
 * - Performance tracking
 * - Structured logging format
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type Category = "agent_run" | "tool_error" | "storage_warn" | "api_request" | "performance" | "security";

export interface LogContext {
  userId?: string;
  optimizationId?: string;
  sessionId?: string;
  requestId?: string;
  endpoint?: string;
  duration?: number;
  [key: string]: unknown;
}

/**
 * Enhanced PII redaction with additional patterns
 */
function redactPII(input: string): string {
  let out = input;
  // Emails
  out = out.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[redacted-email]");
  // Phones (simple patterns)
  out = out.replace(/\+?\d{1,3}?[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g, "[redacted-phone]");
  // Addresses (very naive): number + street word
  out = out.replace(/\b\d{1,5}\s+([A-Za-z]+\s?){1,4}(Street|St|Avenue|Ave|Road|Rd|Blvd|Lane|Ln|Drive|Dr)\b/gi, "[redacted-address]");
  // SSN
  out = out.replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[redacted-ssn]");
  // Credit cards (basic pattern)
  out = out.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, "[redacted-card]");
  // API keys and tokens (32+ chars)
  out = out.replace(/\b[A-Za-z0-9_-]{32,}\b/g, (match) => {
    // Skip common words
    if (/^[a-z]+$/i.test(match) && match.length < 40) return match;
    return "[redacted-token]";
  });
  // IP addresses
  out = out.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[redacted-ip]");
  return out;
}

/**
 * Sanitize error for logging
 */
function sanitizeError(error: unknown): { name: string; message: string; stack?: string } {
  if (error instanceof Error) {
    const sanitized = {
      name: error.name,
      message: redactPII(error.message),
      stack: undefined as string | undefined,
    };

    // Include stack trace only in development
    if (process.env.NODE_ENV === 'development' && error.stack) {
      sanitized.stack = redactPII(error.stack);
    }

    return sanitized;
  }

  return {
    name: 'UnknownError',
    message: redactPII(String(error)),
  };
}

/**
 * Determine if log level should be logged
 */
function shouldLog(level: LogLevel): boolean {
  const logLevel = (process.env.LOG_LEVEL || 'info') as LogLevel;
  const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
  const currentLevelIndex = levels.indexOf(logLevel);
  const messageLevelIndex = levels.indexOf(level);
  return messageLevelIndex >= currentLevelIndex;
}

/**
 * Original log function (backward compatible)
 */
export function log(category: Category, message: string, meta?: Record<string, any>) {
  const safeMessage = redactPII(String(message || ""));
  const safeMeta = meta ? JSON.parse(redactPII(JSON.stringify(meta))) : undefined;
  const payload = { t: new Date().toISOString(), category, message: safeMessage, ...(safeMeta ? { meta: safeMeta } : {}) };
  console.log(JSON.stringify(payload));
}

/**
 * Enhanced logging with levels
 */
export function logWithLevel(
  level: LogLevel,
  category: Category,
  message: string,
  context?: LogContext,
  error?: unknown
): void {
  if (!shouldLog(level)) return;

  const safeMessage = redactPII(String(message || ""));
  const safeContext = context ? JSON.parse(redactPII(JSON.stringify(context))) : undefined;

  const payload: any = {
    t: new Date().toISOString(),
    level,
    category,
    message: safeMessage,
    ...(safeContext ? { context: safeContext } : {}),
  };

  if (error) {
    payload.error = sanitizeError(error);
  }

  const output = JSON.stringify(payload);

  // Output to appropriate stream
  if (level === 'error') {
    console.error(output);
  } else if (level === 'warn') {
    console.warn(output);
  } else {
    console.log(output);
  }
}

/**
 * Logger class for structured logging
 */
export class Logger {
  private context: LogContext;

  constructor(context: LogContext = {}) {
    this.context = context;
  }

  child(additionalContext: LogContext): Logger {
    return new Logger({ ...this.context, ...additionalContext });
  }

  debug(message: string, context?: LogContext): void {
    logWithLevel('debug', 'agent_run', message, { ...this.context, ...context });
  }

  info(message: string, context?: LogContext): void {
    logWithLevel('info', 'agent_run', message, { ...this.context, ...context });
  }

  warn(message: string, context?: LogContext, error?: unknown): void {
    logWithLevel('warn', 'storage_warn', message, { ...this.context, ...context }, error);
  }

  error(message: string, context?: LogContext, error?: unknown): void {
    logWithLevel('error', 'tool_error', message, { ...this.context, ...context }, error);
  }

  performance(operation: string, duration: number, context?: LogContext): void {
    const level = duration > 5000 ? 'warn' : 'info';
    logWithLevel(level, 'performance', `${operation} took ${duration}ms`, {
      ...this.context,
      ...context,
      operation,
      duration,
    });
  }

  apiRequest(endpoint: string, method: string, context?: LogContext): void {
    logWithLevel('info', 'api_request', `${method} ${endpoint}`, {
      ...this.context,
      ...context,
      endpoint,
      method,
    });
  }
}

/**
 * Default logger instance
 */
export const logger = new Logger();

/**
 * Create logger with context
 */
export function createLogger(context: LogContext): Logger {
  return new Logger(context);
}

/**
 * Utility: Measure async function execution time
 */
export async function measureAsync<T>(
  operation: string,
  fn: () => Promise<T>,
  context?: LogContext
): Promise<T> {
  const start = Date.now();
  const log = createLogger(context || {});

  try {
    log.debug(`Starting: ${operation}`);
    const result = await fn();
    const duration = Date.now() - start;
    log.performance(operation, duration);
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    log.error(`Failed: ${operation}`, { duration }, error);
    throw error;
  }
}

/**
 * Export redactPII for use in other modules
 */
export { redactPII };

