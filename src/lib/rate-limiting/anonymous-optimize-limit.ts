import type { RateLimitConfig } from './check-rate-limit';

/**
 * Abuse ceiling for anonymous optimize traffic, keyed on IP.
 *
 * Why this exists: an anonymous Supabase user holds a real `auth.uid()`, so the
 * per-user limit on `/api/optimize` (`optimize:${user.id}`) is bypassed by
 * simply minting another anonymous identity. IP is the only identifier an
 * anonymous caller cannot cheaply rotate.
 *
 * Sized deliberately: the product-level guest cap is 5 exports/month and is
 * enforced client-side in `UserDefaults`, which is a conversion nudge, not an
 * abuse control. This ceiling sits well above any legitimate single-person day
 * so it only ever catches farming, never a real person iterating on a couple of
 * resumes.
 */
export const ANONYMOUS_OPTIMIZE_LIMIT: RateLimitConfig = {
  maxRequests: 20,
  windowMs: 24 * 60 * 60 * 1000,
};

/** Endpoint key for the `rate_limits` table. Distinct from the public ATS check. */
export const ANONYMOUS_OPTIMIZE_ENDPOINT = 'optimize-anonymous';

/**
 * Whether a request should be held to the anonymous IP ceiling.
 *
 * Signed-in users are exempt on purpose: IP-limiting them would punish everyone
 * behind a shared NAT — an office, a university, carrier CGNAT — for one heavy
 * neighbour, and they already carry a stable per-user limit that they cannot
 * rotate away from.
 *
 * Returns false when the flag is absent, which is the state on a project with
 * anonymous sign-ins disabled. That makes this guard inert until the toggle is
 * turned on, so it can land before the toggle rather than after it.
 */
export function requiresAnonymousRateLimit(
  user: { is_anonymous?: boolean } | null | undefined,
): boolean {
  return user?.is_anonymous === true;
}
