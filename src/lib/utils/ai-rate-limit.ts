import { NextResponse } from 'next/server';
import { checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from '@/lib/utils/rate-limit';

/**
 * Per-user cap for routes that call OpenAI. Returns a 429 response when the
 * caller is over the limit, or null when the request may proceed.
 *
 * Same limit and response shape as `/api/v1/refine-section` and `/api/v1/chat`
 * (RATE_LIMITS.ai, 20 requests per minute). The store is in memory, so the cap
 * is per server instance: it stops a runaway client, not a distributed attack.
 */
export function enforceAiRateLimit(key: string): NextResponse | null {
  const result = checkRateLimit(key, RATE_LIMITS.ai);
  if (result.allowed) return null;

  const retryAfter = Math.max(1, Math.ceil((result.resetTime - Date.now()) / 1000));
  return NextResponse.json(
    { error: 'Rate limit exceeded. Please slow down and try again shortly.' },
    {
      status: 429,
      headers: {
        ...getRateLimitHeaders(result),
        'Retry-After': retryAfter.toString(),
        'X-RateLimit-Limit': RATE_LIMITS.ai.maxRequests.toString(),
      },
    }
  );
}
