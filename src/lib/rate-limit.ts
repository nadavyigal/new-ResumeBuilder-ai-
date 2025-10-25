/**
 * Simple In-Memory Rate Limiting
 *
 * Note: This is a simple implementation suitable for single-instance deployments.
 * For production with multiple instances, consider using Redis-based rate limiting
 * with Upstash (@upstash/ratelimit) or Vercel KV.
 *
 * This implementation uses an in-memory Map to track requests per user.
 * The Map is automatically cleaned up periodically to prevent memory leaks.
 */

interface RateLimitConfig {
  /**
   * Maximum number of requests allowed in the time window
   */
  maxRequests: number;

  /**
   * Time window in milliseconds
   */
  windowMs: number;

  /**
   * Optional: Custom identifier function (defaults to user ID)
   */
  getIdentifier?: (request: Request) => string | null;
}

interface RequestRecord {
  count: number;
  resetTime: number;
}

/**
 * In-memory storage for rate limit data
 * Key: identifier (user ID, IP, etc.)
 * Value: { count, resetTime }
 */
const rateLimitStore = new Map<string, RequestRecord>();

/**
 * Clean up expired entries every 5 minutes to prevent memory leaks
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000); // 5 minutes

/**
 * Rate limiter class
 */
export class RateLimiter {
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Check if a request should be rate limited
   *
   * @param identifier - Unique identifier (user ID, IP, etc.)
   * @returns { allowed: boolean, remaining: number, resetTime: number }
   */
  async check(identifier: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
    limit: number;
  }> {
    const now = Date.now();
    const record = rateLimitStore.get(identifier);

    // No existing record or window expired - create new record
    if (!record || now > record.resetTime) {
      const resetTime = now + this.config.windowMs;
      rateLimitStore.set(identifier, {
        count: 1,
        resetTime,
      });

      return {
        allowed: true,
        remaining: this.config.maxRequests - 1,
        resetTime,
        limit: this.config.maxRequests,
      };
    }

    // Existing record within window
    if (record.count < this.config.maxRequests) {
      // Under limit - increment and allow
      record.count++;
      rateLimitStore.set(identifier, record);

      return {
        allowed: true,
        remaining: this.config.maxRequests - record.count,
        resetTime: record.resetTime,
        limit: this.config.maxRequests,
      };
    }

    // Over limit - deny
    return {
      allowed: false,
      remaining: 0,
      resetTime: record.resetTime,
      limit: this.config.maxRequests,
    };
  }

  /**
   * Reset rate limit for a specific identifier
   */
  async reset(identifier: string): Promise<void> {
    rateLimitStore.delete(identifier);
  }
}

// ==================== PRE-CONFIGURED RATE LIMITERS ====================

/**
 * Rate limiter for resume optimization (expensive OpenAI calls)
 * Limit: 5 requests per hour per user
 */
export const optimizationRateLimiter = new RateLimiter({
  maxRequests: 5,
  windowMs: 60 * 60 * 1000, // 1 hour
});

/**
 * Rate limiter for resume uploads
 * Limit: 10 uploads per hour per user
 */
export const uploadRateLimiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 60 * 60 * 1000, // 1 hour
});

/**
 * Rate limiter for PDF/DOCX downloads
 * Limit: 20 downloads per hour per user (less expensive)
 */
export const downloadRateLimiter = new RateLimiter({
  maxRequests: 20,
  windowMs: 60 * 60 * 1000, // 1 hour
});

/**
 * Rate limiter for general API routes
 * Limit: 60 requests per minute per user
 */
export const generalRateLimiter = new RateLimiter({
  maxRequests: 60,
  windowMs: 60 * 1000, // 1 minute
});

// ==================== UTILITY FUNCTIONS ====================

/**
 * Get rate limit headers for HTTP responses
 */
export function getRateLimitHeaders(result: {
  limit: number;
  remaining: number;
  resetTime: number;
}): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.resetTime.toString(),
    'Retry-After': Math.ceil((result.resetTime - Date.now()) / 1000).toString(),
  };
}

/**
 * Create a standardized rate limit error response
 */
export function createRateLimitResponse(result: {
  limit: number;
  remaining: number;
  resetTime: number;
}): Response {
  const retryAfterSeconds = Math.ceil((result.resetTime - Date.now()) / 1000);

  return new Response(
    JSON.stringify({
      error: 'Too many requests',
      message: `Rate limit exceeded. Please try again in ${retryAfterSeconds} seconds.`,
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: retryAfterSeconds,
      limit: result.limit,
      resetTime: result.resetTime,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        ...getRateLimitHeaders(result),
      },
    }
  );
}
