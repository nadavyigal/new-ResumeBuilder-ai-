import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { RateLimiter } from '../rate-limit';

describe('RateLimiter', () => {
  beforeEach(() => {
    // Clear any existing rate limit data before each test
    jest.clearAllTimers();
  });

  it('should allow requests within the limit', async () => {
    const limiter = new RateLimiter({
      maxRequests: 5,
      windowMs: 60000, // 1 minute
    });

    const result1 = await limiter.check('user-123');
    expect(result1.allowed).toBe(true);
    expect(result1.remaining).toBe(4);

    const result2 = await limiter.check('user-123');
    expect(result2.allowed).toBe(true);
    expect(result2.remaining).toBe(3);
  });

  it('should reject requests exceeding the limit', async () => {
    const limiter = new RateLimiter({
      maxRequests: 3,
      windowMs: 60000,
    });

    // Make 3 allowed requests
    await limiter.check('user-456');
    await limiter.check('user-456');
    const result3 = await limiter.check('user-456');
    expect(result3.allowed).toBe(true);
    expect(result3.remaining).toBe(0);

    // 4th request should be rejected
    const result4 = await limiter.check('user-456');
    expect(result4.allowed).toBe(false);
    expect(result4.remaining).toBe(0);
  });

  it('should track different users independently', async () => {
    const limiter = new RateLimiter({
      maxRequests: 2,
      windowMs: 60000,
    });

    // User 1 makes 2 requests (hits limit)
    await limiter.check('user-1');
    await limiter.check('user-1');
    const user1Result = await limiter.check('user-1');
    expect(user1Result.allowed).toBe(false);

    // User 2 should still be able to make requests
    const user2Result = await limiter.check('user-2');
    expect(user2Result.allowed).toBe(true);
  });

  it('should return correct reset time', async () => {
    const windowMs = 60000;
    const limiter = new RateLimiter({
      maxRequests: 5,
      windowMs,
    });

    const startTime = Date.now();
    const result = await limiter.check('user-789');

    expect(result.resetTime).toBeGreaterThanOrEqual(startTime + windowMs);
    expect(result.resetTime).toBeLessThanOrEqual(Date.now() + windowMs + 100); // +100ms tolerance
  });

  it('should return correct limit in response', async () => {
    const limiter = new RateLimiter({
      maxRequests: 10,
      windowMs: 60000,
    });

    const result = await limiter.check('user-999');
    expect(result.limit).toBe(10);
  });

  it('should clean up old entries after cleanup interval', async () => {
    jest.useFakeTimers();

    const limiter = new RateLimiter({
      maxRequests: 5,
      windowMs: 60000,
      cleanupIntervalMs: 5000, // Clean up every 5 seconds
    });

    // Make a request
    await limiter.check('user-cleanup');

    // Fast-forward time by 70 seconds (past the window)
    jest.advanceTimersByTime(70000);

    // The old entry should be cleaned up, so we should have full quota again
    const result = await limiter.check('user-cleanup');
    expect(result.remaining).toBe(4); // Should be fresh start

    jest.useRealTimers();
  });

  it('should handle concurrent requests atomically', async () => {
    const limiter = new RateLimiter({
      maxRequests: 5,
      windowMs: 60000,
    });

    // Simulate 10 concurrent requests
    const promises = Array.from({ length: 10 }, () =>
      limiter.check('user-concurrent')
    );

    const results = await Promise.all(promises);

    // Exactly 5 should be allowed
    const allowedCount = results.filter(r => r.allowed).length;
    expect(allowedCount).toBe(5);

    // Exactly 5 should be rejected
    const rejectedCount = results.filter(r => !r.allowed).length;
    expect(rejectedCount).toBe(5);
  });

  it('should reset after window expires', async () => {
    jest.useFakeTimers();

    const limiter = new RateLimiter({
      maxRequests: 2,
      windowMs: 10000, // 10 second window
    });

    // Use up the quota
    await limiter.check('user-reset');
    await limiter.check('user-reset');
    const blockedResult = await limiter.check('user-reset');
    expect(blockedResult.allowed).toBe(false);

    // Fast-forward past the window
    jest.advanceTimersByTime(11000);

    // Should be allowed again
    const allowedResult = await limiter.check('user-reset');
    expect(allowedResult.allowed).toBe(true);

    jest.useRealTimers();
  });
});

describe('Pre-configured limiters', () => {
  it('should export optimization rate limiter', () => {
    const { optimizationRateLimiter } = require('../rate-limit');
    expect(optimizationRateLimiter).toBeDefined();
    expect(typeof optimizationRateLimiter.check).toBe('function');
  });

  it('should export upload rate limiter', () => {
    const { uploadRateLimiter } = require('../rate-limit');
    expect(uploadRateLimiter).toBeDefined();
    expect(typeof uploadRateLimiter.check).toBe('function');
  });

  it('should export download rate limiter', () => {
    const { downloadRateLimiter } = require('../rate-limit');
    expect(downloadRateLimiter).toBeDefined();
    expect(typeof downloadRateLimiter.check).toBe('function');
  });
});
