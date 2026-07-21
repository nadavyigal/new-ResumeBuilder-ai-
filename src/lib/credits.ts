import type { SupabaseClient } from '@supabase/supabase-js';
import { hasLegacyFreeAccess } from '@/lib/entitlements';

export type CreditConsumeResult =
  | { ok: true; remaining: number | null }
  | { ok: false; status: 402; error: 'insufficient_credits' }
  | { ok: false; status: 500; error: 'credit_consume_failed'; details?: string };

export async function consumeCredit(
  supabase: SupabaseClient,
  userId: string,
  reason: string
): Promise<CreditConsumeResult> {
  if (await hasLegacyFreeAccess(supabase, userId)) {
    const balance = await getCreditBalance(supabase, userId);
    return { ok: true, remaining: balance };
  }

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
