/**
 * Comprehensive Error Handling for API Routes
 *
 * Phase 7: T048 - Error handling with sanitization and logging
 *
 * Features:
 * - Centralized error handling
 * - Error sanitization (remove sensitive data)
 * - Structured error responses
 * - Error logging with context
 * - Custom error types
 */

import { NextResponse } from 'next/server';
import { createLogger, redactPII } from '../agent/utils/logger';

const logger = createLogger({ component: 'error-handler' });

/**
 * Standard error response format
 */
export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
  requestId?: string;
  details?: Record<string, unknown>;
}

/**
 * Custom error class with additional context
 */
export class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'APIError';
  }
}

/**
 * Predefined error types
 */
export class BadRequestError extends APIError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 400, 'BAD_REQUEST', details);
    this.name = 'BadRequestError';
  }
}

export class UnauthorizedError extends APIError {
  constructor(message: string = 'Unauthorized', details?: Record<string, unknown>) {
    super(message, 401, 'UNAUTHORIZED', details);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends APIError {
  constructor(message: string = 'Forbidden', details?: Record<string, unknown>) {
    super(message, 403, 'FORBIDDEN', details);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends APIError {
  constructor(resource: string, details?: Record<string, unknown>) {
    super(`${resource} not found`, 404, 'NOT_FOUND', details);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends APIError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 409, 'CONFLICT', details);
    this.name = 'ConflictError';
  }
}

export class UnprocessableEntityError extends APIError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 422, 'UNPROCESSABLE_ENTITY', details);
    this.name = 'UnprocessableEntityError';
  }
}

export class TooManyRequestsError extends APIError {
  constructor(message: string = 'Too many requests', details?: Record<string, unknown>) {
    super(message, 429, 'TOO_MANY_REQUESTS', details);
    this.name = 'TooManyRequestsError';
  }
}

export class InternalServerError extends APIError {
  constructor(message: string = 'Internal server error', details?: Record<string, unknown>) {
    super(message, 500, 'INTERNAL_SERVER_ERROR', details);
    this.name = 'InternalServerError';
  }
}

export class ServiceUnavailableError extends APIError {
  constructor(message: string = 'Service unavailable', details?: Record<string, unknown>) {
    super(message, 503, 'SERVICE_UNAVAILABLE', details);
    this.name = 'ServiceUnavailableError';
  }
}

/**
 * Sanitize error message to remove sensitive information
 */
function sanitizeErrorMessage(message: string): string {
  let sanitized = redactPII(message);

  // Remove database connection strings
  sanitized = sanitized.replace(/postgres:\/\/[^\s]+/g, '[DATABASE_URL_REDACTED]');

  // Remove file paths in production
  if (process.env.NODE_ENV === 'production') {
    sanitized = sanitized.replace(/\/[a-zA-Z0-9_\-\/\.]+/g, '[PATH_REDACTED]');
  }

  return sanitized;
}

/**
 * Sanitize error details
 */
function sanitizeErrorDetails(details?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!details) return undefined;

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(details)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeErrorMessage(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeErrorDetails(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Convert error to standard error response
 */
function formatErrorResponse(
  error: unknown,
  requestId?: string
): ErrorResponse {
  // Handle APIError (our custom errors)
  if (error instanceof APIError) {
    return {
      error: error.code || error.name,
      message: sanitizeErrorMessage(error.message),
      statusCode: error.statusCode,
      timestamp: new Date().toISOString(),
      requestId,
      details: sanitizeErrorDetails(error.details),
    };
  }

  // Handle standard errors
  if (error instanceof Error) {
    // Determine status code from error type
    let statusCode = 500;

    if (error.name === 'ValidationError') {
      statusCode = 400;
    } else if (error.name === 'UnauthorizedError' || error.message.includes('unauthorized')) {
      statusCode = 401;
    } else if (error.name === 'ForbiddenError' || error.message.includes('forbidden')) {
      statusCode = 403;
    } else if (error.name === 'NotFoundError' || error.message.includes('not found')) {
      statusCode = 404;
    }

    return {
      error: error.name,
      message: sanitizeErrorMessage(error.message),
      statusCode,
      timestamp: new Date().toISOString(),
      requestId,
    };
  }

  // Handle unknown errors
  return {
    error: 'UnknownError',
    message: sanitizeErrorMessage(String(error)),
    statusCode: 500,
    timestamp: new Date().toISOString(),
    requestId,
  };
}

/**
 * Main error handler
 */
export function handleError(
  error: unknown,
  context?: {
    userId?: string;
    endpoint?: string;
    requestId?: string;
    [key: string]: unknown;
  }
): NextResponse<ErrorResponse> {
  const errorResponse = formatErrorResponse(error, context?.requestId);

  // Log error with context
  logger.error('API error', {
    ...context,
    error: errorResponse.error,
    message: errorResponse.message,
    statusCode: errorResponse.statusCode,
  }, error);

  // Return JSON error response
  return NextResponse.json(errorResponse, {
    status: errorResponse.statusCode,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Async error handler wrapper for API routes
 */
export function withErrorHandler<T>(
  handler: (request: Request, context?: T) => Promise<NextResponse>
) {
  return async (request: Request, context?: T): Promise<NextResponse> => {
    try {
      return await handler(request, context);
    } catch (error) {
      // Extract request ID if available
      const requestId = request.headers.get('x-request-id') || undefined;

      return handleError(error, {
        endpoint: new URL(request.url).pathname,
        requestId,
        method: request.method,
      });
    }
  };
}

/**
 * Validate required fields in request body
 */
export function validateRequired(
  data: Record<string, unknown>,
  fields: string[]
): void {
  const missing = fields.filter(field => !data[field]);

  if (missing.length > 0) {
    throw new BadRequestError(
      `Missing required fields: ${missing.join(', ')}`,
      { missingFields: missing }
    );
  }
}

/**
 * Validate field types
 */
export function validateTypes(
  data: Record<string, unknown>,
  schema: Record<string, 'string' | 'number' | 'boolean' | 'object' | 'array'>
): void {
  const errors: string[] = [];

  for (const [field, expectedType] of Object.entries(schema)) {
    const value = data[field];

    if (value === undefined || value === null) {
      continue; // Skip validation for undefined/null
    }

    const actualType = Array.isArray(value) ? 'array' : typeof value;

    if (actualType !== expectedType) {
      errors.push(`${field} must be ${expectedType} (got ${actualType})`);
    }
  }

  if (errors.length > 0) {
    throw new BadRequestError(
      'Invalid field types',
      { validationErrors: errors }
    );
  }
}

/**
 * Assert user owns a resource
 */
export function assertOwnership(
  resourceUserId: string,
  currentUserId: string,
  resourceType: string = 'resource'
): void {
  if (resourceUserId !== currentUserId) {
    throw new ForbiddenError(
      `You do not have permission to access this ${resourceType}`,
      { resourceUserId, currentUserId }
    );
  }
}

/**
 * Try-catch wrapper for async operations
 */
export async function tryCatch<T>(
  operation: () => Promise<T>,
  errorMessage: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }

    throw new InternalServerError(
      errorMessage,
      { originalError: error instanceof Error ? error.message : String(error) }
    );
  }
}

/**
 * Example usage:
 *
 * ```typescript
 * import { withErrorHandler, validateRequired, NotFoundError } from '@/lib/middleware/error-handler';
 *
 * export const POST = withErrorHandler(async (request) => {
 *   const body = await request.json();
 *
 *   // Validate required fields
 *   validateRequired(body, ['name', 'email']);
 *
 *   // Find user
 *   const user = await db.users.findOne({ id: body.userId });
 *   if (!user) {
 *     throw new NotFoundError('User');
 *   }
 *
 *   // ... rest of handler
 *
 *   return NextResponse.json({ success: true });
 * });
 * ```
 */
