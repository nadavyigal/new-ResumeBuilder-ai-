/**
 * The guard that stops an anonymous caller farming /api/optimize.
 *
 * An anonymous Supabase user holds a real auth.uid(), which is what lets them
 * through the route's `getUser()` check at all — and it is also why the
 * existing per-user limit (`optimize:${user.id}`) does not bind for them: a
 * fresh anonymous identity is free. IP is the identifier they cannot rotate.
 */

import {
  ANONYMOUS_OPTIMIZE_ENDPOINT,
  ANONYMOUS_OPTIMIZE_LIMIT,
  requiresAnonymousRateLimit,
} from '@/lib/rate-limiting/anonymous-optimize-limit';

describe('who the anonymous optimize ceiling applies to', () => {
  it('guards an anonymous user', () => {
    expect(requiresAnonymousRateLimit({ is_anonymous: true })).toBe(true);
  });

  it('exempts a signed-in user', () => {
    // IP-limiting real users would punish an entire office or carrier CGNAT
    // range for one heavy neighbour, and they already carry a per-user limit
    // they cannot rotate away from.
    expect(requiresAnonymousRateLimit({ is_anonymous: false })).toBe(false);
  });

  it('stays inert while anonymous sign-ins are disabled', () => {
    // With the Supabase toggle off the flag is simply absent. The guard must
    // read that as "not anonymous" so it can ship before the toggle is flipped
    // rather than having to land in the same change.
    expect(requiresAnonymousRateLimit({})).toBe(false);
    expect(requiresAnonymousRateLimit(undefined)).toBe(false);
    expect(requiresAnonymousRateLimit(null)).toBe(false);
  });

  it('does not treat a truthy non-true value as anonymous', () => {
    // Guards against a provider returning a string; only a real boolean counts.
    expect(requiresAnonymousRateLimit({ is_anonymous: 'yes' } as never)).toBe(false);
  });
});

describe('how the ceiling is sized', () => {
  it('sits well above the product-level guest cap', () => {
    // The 5/month guest export cap is a client-side conversion nudge, not an
    // abuse control. This ceiling must never be the thing a real person hits,
    // so it has to clear that cap by a wide margin.
    const PRODUCT_GUEST_CAP = 5;
    expect(ANONYMOUS_OPTIMIZE_LIMIT.maxRequests).toBeGreaterThan(PRODUCT_GUEST_CAP * 2);
  });

  it('caps farming to a bounded number per IP per day', () => {
    expect(ANONYMOUS_OPTIMIZE_LIMIT.windowMs).toBe(24 * 60 * 60 * 1000);
    // Without an upper bound this stops being a control at all.
    expect(ANONYMOUS_OPTIMIZE_LIMIT.maxRequests).toBeLessThanOrEqual(50);
  });

  it('books against its own endpoint key', () => {
    // Sharing a key with the public ATS check would let free score checks eat
    // the optimize budget and vice versa.
    expect(ANONYMOUS_OPTIMIZE_ENDPOINT).toBe('optimize-anonymous');
    expect(ANONYMOUS_OPTIMIZE_ENDPOINT).not.toBe('ats-check');
  });
});
