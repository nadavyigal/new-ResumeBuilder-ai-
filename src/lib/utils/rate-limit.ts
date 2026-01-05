/**
 * Rate Limiting Utility
 *
 * Implements in-memory rate limiting with sliding window algorithm.
 * For production, consider using Redis or Upstash for distributed rate limiting.
 */

interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  maxRequests: number;  // Maximum requests per window
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store (will reset on server restart)
// For production: use Redis, Upstash, or Vercel KV
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Lazy cleanup of expired entries
 * Called during checkRateLimit to avoid using setInterval (not supported in Edge Runtime)
 */
function cleanupExpiredEntries() {
  const now = Date.now();
  const keysToDelete: string[] = [];

  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      keysToDelete.push(key);
    }
  }

  // Delete in separate loop to avoid modification during iteration
  for (const key of keysToDelete) {
    rateLimitStore.delete(key);
  }
}

/**
 * Check if a request should be rate limited
 *
 * @param identifier - Unique identifier (user ID, IP address)
 * @param config - Rate limit configuration
 * @returns Object with allowed status and remaining count
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = { windowMs: 60 * 1000, maxRequests: 60 }
): {
  allowed: boolean;
  remaining: number;
  resetTime: number;
} {
  // Lazy cleanup - only run occasionally to avoid performance impact
  // Clean up roughly every 100 requests (1% chance per request)
  if (Math.random() < 0.01) {
    cleanupExpiredEntries();
  }

  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  // No entry or window expired - create new entry
  if (!entry || entry.resetTime < now) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + config.windowMs,
    };
    rateLimitStore.set(identifier, newEntry);

    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: newEntry.resetTime,
    };
  }

  // Window still active
  if (entry.count < config.maxRequests) {
    // Increment count
    entry.count++;
    rateLimitStore.set(identifier, entry);

    return {
      allowed: true,
      remaining: config.maxRequests - entry.count,
      resetTime: entry.resetTime,
    };
  }

  // Rate limit exceeded
  return {
    allowed: false,
    remaining: 0,
    resetTime: entry.resetTime,
  };
}

/**
 * Rate limit configurations for different endpoint types
 */
export const RATE_LIMITS = {
  // General API requests
  default: { windowMs: 60 * 1000, maxRequests: 60 },  // 60 req/min

  // Optimization endpoints (more generous for core feature)
  optimizations: { windowMs: 60 * 1000, maxRequests: 100 },  // 100 req/min

  // Bulk operations (stricter limits)
  bulk: { windowMs: 60 * 1000, maxRequests: 3 },  // 3 req/min

  // Chat/AI endpoints (expensive operations)
  ai: { windowMs: 60 * 1000, maxRequests: 20 },  // 20 req/min

  // Download/Export (resource-intensive)
  export: { windowMs: 60 * 1000, maxRequests: 10 },  // 10 req/min
} as const;

/**
 * Get rate limit config based on request path
 */
export function getRateLimitConfig(pathname: string): RateLimitConfig {
  if (pathname.includes('/optimizations/bulk')) {
    return RATE_LIMITS.bulk;
  }
  if (pathname.includes('/optimizations/export')) {
    return RATE_LIMITS.export;
  }
  if (pathname.includes('/optimizations')) {
    return RATE_LIMITS.optimizations;
  }
  if (pathname.includes('/chat') || pathname.includes('/optimize')) {
    return RATE_LIMITS.ai;
  }
  if (pathname.includes('/download') || pathname.includes('/export')) {
    return RATE_LIMITS.export;
  }

  return RATE_LIMITS.default;
}

/**
 * Format rate limit headers for HTTP response
 */
export function getRateLimitHeaders(result: {
  remaining: number;
  resetTime: number;
}): Record<string, string> {
  const resetSeconds = Math.ceil((result.resetTime - Date.now()) / 1000);

  return {
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.resetTime.toString(),
    'X-RateLimit-Reset-After': resetSeconds.toString(),
  };
}
