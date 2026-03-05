/**
 * Rate Limiting Middleware for API Routes
 *
 * Phase 7: T051 - Rate limiting for modification and style endpoints
 * - 30 requests per minute per user
 * - Memory-based (can be upgraded to Redis for production)
 * - Configurable limits per endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '../agent/utils/logger';

const logger = createLogger({ component: 'rate-limiter' });

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /**
   * Maximum number of requests allowed in the window
   */
  maxRequests: number;

  /**
   * Time window in milliseconds
   */
  windowMs: number;

  /**
   * Message to return when rate limit is exceeded
   */
  message?: string;

  /**
   * HTTP status code to return when rate limit is exceeded
   */
  statusCode?: number;
}

/**
 * Request tracking data
 */
interface RequestTracker {
  count: number;
  resetAt: number;
}

/**
 * In-memory rate limit store
 * Key format: `{identifier}:{endpoint}`
 *
 * Note: For production with multiple instances, use Redis:
 * - import { Redis } from '@upstash/redis'
 * - const redis = new Redis({ url, token })
 */
const rateLimitStore = new Map<string, RequestTracker>();

/**
 * Cleanup old entries periodically to prevent memory leaks
 */
setInterval(() => {
  const now = Date.now();
  const keysToDelete: string[] = [];

  for (const [key, tracker] of rateLimitStore.entries()) {
    if (tracker.resetAt < now) {
      keysToDelete.push(key);
    }
  }

  keysToDelete.forEach(key => rateLimitStore.delete(key));

  if (keysToDelete.length > 0) {
    logger.debug(`Rate limiter cleanup: removed ${keysToDelete.length} expired entries`);
  }
}, 60 * 1000); // Run every minute

/**
 * Default rate limit configurations
 */
export const RATE_LIMITS = {
  /**
   * Default limit for most API endpoints
   */
  default: {
    maxRequests: 60,
    windowMs: 60 * 1000, // 1 minute
    message: 'Too many requests, please try again later',
    statusCode: 429,
  },

  /**
   * Modification endpoints (stricter)
   */
  modifications: {
    maxRequests: 30,
    windowMs: 60 * 1000, // 1 minute
    message: 'Too many modification requests. Please wait before making more changes.',
    statusCode: 429,
  },

  /**
   * Style customization endpoints (stricter)
   */
  styles: {
    maxRequests: 30,
    windowMs: 60 * 1000, // 1 minute
    message: 'Too many style changes. Please wait before applying more customizations.',
    statusCode: 429,
  },

  /**
   * AI chat endpoints (moderate)
   */
  chat: {
    maxRequests: 20,
    windowMs: 60 * 1000, // 1 minute
    message: 'Too many messages. Please wait before sending more.',
    statusCode: 429,
  },

  /**
   * Authentication endpoints (strict)
   */
  auth: {
    maxRequests: 5,
    windowMs: 60 * 1000, // 1 minute
    message: 'Too many authentication attempts. Please wait before trying again.',
    statusCode: 429,
  },
} as const;

/**
 * Get user identifier from request
 */
async function getUserIdentifier(request: NextRequest): Promise<string> {
  // Try to get user ID from session/JWT
  // For now, use IP address as fallback
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown';

  // In production, you'd extract user ID from JWT:
  // const token = request.headers.get('authorization')?.replace('Bearer ', '');
  // const decoded = await verify(token, secret);
  // return decoded.sub || ip;

  return ip;
}

/**
 * Check if request should be rate limited
 */
function checkRateLimit(
  identifier: string,
  endpoint: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetAt: number } {
  const key = `${identifier}:${endpoint}`;
  const now = Date.now();

  let tracker = rateLimitStore.get(key);

  // Initialize or reset if window expired
  if (!tracker || tracker.resetAt < now) {
    tracker = {
      count: 0,
      resetAt: now + config.windowMs,
    };
    rateLimitStore.set(key, tracker);
  }

  // Increment counter
  tracker.count++;

  const allowed = tracker.count <= config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - tracker.count);

  return { allowed, remaining, resetAt: tracker.resetAt };
}

/**
 * Rate limit middleware
 */
export async function rateLimit(
  request: NextRequest,
  config: RateLimitConfig = RATE_LIMITS.default
): Promise<NextResponse | null> {
  try {
    const identifier = await getUserIdentifier(request);
    const endpoint = request.nextUrl.pathname;

    const { allowed, remaining, resetAt } = checkRateLimit(identifier, endpoint, config);

    // Add rate limit headers to all responses
    const headers = {
      'X-RateLimit-Limit': config.maxRequests.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': new Date(resetAt).toISOString(),
    };

    if (!allowed) {
      const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);

      logger.warn('Rate limit exceeded', {
        identifier,
        endpoint,
        limit: config.maxRequests,
        window: config.windowMs,
      });

      return NextResponse.json(
        {
          error: config.message || 'Too many requests',
          retryAfter,
          limit: config.maxRequests,
          window: config.windowMs,
        },
        {
          status: config.statusCode || 429,
          headers: {
            ...headers,
            'Retry-After': retryAfter.toString(),
          },
        }
      );
    }

    // Allowed - return null to continue
    // Note: Cannot modify request headers in middleware, so we don't add rate limit headers to allowed requests
    // They can be added in the API route handler if needed
    return null;
  } catch (error) {
    logger.error('Rate limit check failed', {}, error);
    // On error, allow the request through (fail open)
    return null;
  }
}

/**
 * Create a rate limit wrapper for API route handlers
 */
export function withRateLimit(
  handler: (request: NextRequest) => Promise<NextResponse>,
  config: RateLimitConfig = RATE_LIMITS.default
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    // Check rate limit
    const rateLimitResponse = await rateLimit(request, config);

    // If rate limited, return error response
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Otherwise, proceed with handler
    return handler(request);
  };
}

/**
 * Reset rate limit for a specific identifier and endpoint
 * Useful for testing or manual override
 */
export function resetRateLimit(identifier: string, endpoint: string): void {
  const key = `${identifier}:${endpoint}`;
  rateLimitStore.delete(key);
  logger.info('Rate limit reset', { identifier, endpoint });
}

/**
 * Get current rate limit status for an identifier and endpoint
 */
export function getRateLimitStatus(
  identifier: string,
  endpoint: string
): { count: number; resetAt: number } | null {
  const key = `${identifier}:${endpoint}`;
  const tracker = rateLimitStore.get(key);

  if (!tracker) {
    return null;
  }

  return {
    count: tracker.count,
    resetAt: tracker.resetAt,
  };
}

/**
 * Clear all rate limit data (useful for testing)
 */
export function clearAllRateLimits(): void {
  rateLimitStore.clear();
  logger.info('All rate limits cleared');
}
