/** @jest-environment node */
import { describe, expect, it } from '@jest/globals';
import { enforceAiRateLimit } from '@/lib/utils/ai-rate-limit';
import { RATE_LIMITS } from '@/lib/utils/rate-limit';

describe('enforceAiRateLimit', () => {
  it('lets the first RATE_LIMITS.ai.maxRequests calls through, then answers 429', async () => {
    const key = `test-ai-limit:${Date.now()}:${Math.random()}`;
    for (let i = 0; i < RATE_LIMITS.ai.maxRequests; i += 1) {
      expect(enforceAiRateLimit(key)).toBeNull();
    }

    const limited = enforceAiRateLimit(key);
    expect(limited).not.toBeNull();
    expect(limited!.status).toBe(429);
    expect(Number(limited!.headers.get('Retry-After'))).toBeGreaterThanOrEqual(1);
    expect(limited!.headers.get('X-RateLimit-Limit')).toBe(String(RATE_LIMITS.ai.maxRequests));
    expect(await limited!.json()).toEqual({
      error: 'Rate limit exceeded. Please slow down and try again shortly.',
    });
  });

  it('counts each user separately', () => {
    const a = `test-ai-limit-a:${Math.random()}`;
    const b = `test-ai-limit-b:${Math.random()}`;
    for (let i = 0; i <= RATE_LIMITS.ai.maxRequests; i += 1) enforceAiRateLimit(a);
    expect(enforceAiRateLimit(a)).not.toBeNull();
    expect(enforceAiRateLimit(b)).toBeNull();
  });
});
