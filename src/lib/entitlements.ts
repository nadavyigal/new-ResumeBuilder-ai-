import type { SupabaseClient } from '@supabase/supabase-js';

type ProfileEntitlementRow = {
  plan_type?: string | null;
  legacy_free_access?: boolean | null;
};

/**
 * Returns true when the user was grandfathered before monetization cutoff.
 * Legacy users skip all paywall and credit enforcement unconditionally.
 */
export async function hasLegacyFreeAccess(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('legacy_free_access')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    return false;
  }

  return (data as { legacy_free_access?: boolean }).legacy_free_access === true;
}

/**
 * Returns true when paywall/credit checks should be skipped (premium or legacy grandfathered).
 * Model-agnostic: works regardless of flat-fee vs credit pricing.
 */
export async function hasUnlimitedAccess(
  supabase: SupabaseClient,
  userId: string,
  userMetadata?: Record<string, unknown> | null
): Promise<boolean> {
  if (userMetadata?.is_premium === true || userMetadata?.plan_type === 'premium') {
    return true;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('plan_type, legacy_free_access')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    return false;
  }

  const profile = data as ProfileEntitlementRow;
  return profile.plan_type === 'premium' || profile.legacy_free_access === true;
}
