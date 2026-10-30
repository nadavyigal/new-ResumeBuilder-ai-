import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceRoleClient } from '@/lib/supabase-server';

export type CreditConsumeResult =
  | { ok: true; remaining: number | null }
  | { ok: false; status: 402; error: 'insufficient_credits' }
  | { ok: false; status: 500; error: 'credit_consume_failed'; details?: string };

/**
 * Spends one credit for `userId`.
 *
 * Runs on a service-role client, not the caller's. `consume_credit` is
 * SECURITY DEFINER and trusts its `p_user_id` argument, so R1 revoked EXECUTE
 * from anon and authenticated. The client is built here rather than passed in
 * so no route can reach the function with a user-scoped session by accident.
 *
 * The caller owns the identity check: `userId` must come from
 * `supabase.auth.getUser()`, never from the request body.
 */
export async function consumeCredit(
  userId: string,
  reason: string
): Promise<CreditConsumeResult> {
  const supabase = createServiceRoleClient();
  const { data, error } = await (supabase as any).rpc('consume_credit', {
    p_user_id: userId,
    p_reason: reason,
  });

  if (error) {
    return {
      ok: false,
      status: 500,
      error: 'credit_consume_failed',
      details: error.message,
    };
  }

  if (data === null || data === undefined) {
    return {
      ok: false,
      status: 402,
      error: 'insufficient_credits',
    };
  }

  return {
    ok: true,
    remaining: typeof data === 'number' ? data : null,
  };
}

/**
 * Reads the credit balance through the caller's own client, so RLS still scopes
 * the row to them. This is a plain table read, not one of the R1 functions.
 */
export async function getCreditBalance(supabase: SupabaseClient, userId: string): Promise<number> {
  const { data, error } = await (supabase as any)
    .from('profiles')
    .select('credit_balance')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    return 0;
  }

  const rawBalance = (data as { credit_balance?: unknown }).credit_balance;
  return typeof rawBalance === 'number' ? rawBalance : 0;
}

export type SubscriptionState =
  | { active: false }
  | {
      active: true;
      productId: string;
      expiresAt: string;
      graceUntil: string | null;
      autoRenew: boolean;
      periodExports: number;
      periodCap: number;
    };

export interface CreditState {
  balance: number;
  subscription: SubscriptionState;
}

/**
 * Pricing v2 `get_credit_state`: gives the welcome grant once, then returns the
 * balance and the subscription. Service-role only (it trusts `p_user_id`); the
 * caller passes the user from `supabase.auth.getUser()`. Null on any failure,
 * so the caller can fall back to `getCreditBalance`.
 */
export async function getCreditState(userId: string): Promise<CreditState | null> {
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await (supabase as any).rpc('get_credit_state', { p_user_id: userId });
    if (error || !data || typeof data.balance !== 'number') {
      if (error) console.warn('get_credit_state failed; using the plain balance', { details: error.message });
      return null;
    }
    const sub = (data.subscription ?? {}) as Record<string, unknown>;
    const subscription: SubscriptionState = sub.active === true
      ? {
          active: true,
          productId: String(sub.product_id ?? ''),
          expiresAt: String(sub.expires_at ?? ''),
          graceUntil: typeof sub.grace_until === 'string' ? sub.grace_until : null,
          autoRenew: sub.auto_renew !== false,
          periodExports: typeof sub.period_exports === 'number' ? sub.period_exports : 0,
          periodCap: typeof sub.period_cap === 'number' ? sub.period_cap : 0,
        }
      : { active: false };
    return { balance: data.balance, subscription };
  } catch (error) {
    console.warn('get_credit_state failed; using the plain balance', {
      details: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
