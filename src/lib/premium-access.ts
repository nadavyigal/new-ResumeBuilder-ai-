/**
 * The single place that decides whether a paid surface is gated.
 *
 * Monetization is not live. Until it is, every authenticated user gets every
 * service, and no request is answered with 402. The reason is measured, not
 * philosophical: on 2026-08-12 a first-time user finished the whole funnel,
 * exported a PDF, and then tapped four different premium workflows in nineteen
 * seconds. All four returned locked, and the project contains no paywall,
 * purchase, subscription or upgrade event of any kind. There was nothing behind
 * the lock to convert him with, so the lock only removed the one thing he was
 * still willing to do.
 *
 * Turning gating back on is one environment variable:
 *
 *   MONETIZATION_ENABLED=true
 *
 * Unset or any other value means ungated. The default is deliberately the
 * permissive one: a missing env var in a new environment should not silently
 * reinstate a paywall that has no purchase flow behind it.
 */
export const MONETIZATION_ENABLED = process.env.MONETIZATION_ENABLED === 'true';

/**
 * The user's real entitlement, ignoring whether gating is currently switched on.
 *
 * Kept separate from {@link hasPremiumAccess} so analytics can keep recording
 * who *would* be a paying user while everything is free. Without this the
 * ungated period becomes a blind spot, and sizing the affected population on the
 * day monetization starts would mean guessing.
 */
export async function resolvePremiumEntitlement(
  supabase: any,
  userId: string,
  user: any
): Promise<boolean> {
  const metadata = user?.user_metadata || {};
  if (metadata.is_premium === true || metadata.plan_type === 'premium') {
    return true;
  }

  const { data } = await supabase
    .from('profiles')
    .select('plan_type')
    .eq('user_id', userId)
    .maybeSingle();

  return data?.plan_type === 'premium';
}

export interface PremiumAccess {
  /** Whether this request may run the paid work. */
  allowed: boolean;
  /** The user's real entitlement, independent of whether gating is on. */
  entitled: boolean;
  /** Whether gating was switched on for this request. */
  gated: boolean;
}

/**
 * Whether this request is allowed to run a paid surface.
 *
 * While `MONETIZATION_ENABLED` is off this skips the entitlement lookup
 * entirely: there is no decision to inform, and the query is a round trip per
 * request. `entitled` is reported as false in that case and callers should read
 * `gated` before drawing conclusions from it.
 */
export async function hasPremiumAccess(
  supabase: any,
  userId: string,
  user: any
): Promise<PremiumAccess> {
  if (!MONETIZATION_ENABLED) {
    return { allowed: true, entitled: false, gated: false };
  }

  const entitled = await resolvePremiumEntitlement(supabase, userId, user);
  return { allowed: entitled, entitled, gated: true };
}
