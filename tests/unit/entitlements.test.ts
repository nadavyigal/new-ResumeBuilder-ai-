import { describe, it, expect, beforeEach } from '@jest/globals';
import type { SupabaseClient } from '@supabase/supabase-js';
import { hasLegacyFreeAccess, hasUnlimitedAccess } from '@/lib/entitlements';
import { consumeCredit } from '@/lib/credits';

function createMockSupabase(profile: Record<string, unknown> | null, rpcResult?: unknown) {
  const maybeSingle = jest.fn().mockResolvedValue({ data: profile, error: null });
  const eq = jest.fn().mockReturnValue({ maybeSingle });
  const select = jest.fn().mockReturnValue({ eq });
  const from = jest.fn().mockReturnValue({ select });
  const rpc = jest.fn().mockResolvedValue({ data: rpcResult, error: null });

  return {
    from,
    rpc,
    _maybeSingle: maybeSingle,
  } as unknown as SupabaseClient;
}

describe('entitlements', () => {
  describe('hasLegacyFreeAccess', () => {
    it('returns true when legacy_free_access is true', async () => {
      const supabase = createMockSupabase({ legacy_free_access: true });
      await expect(hasLegacyFreeAccess(supabase, 'user-1')).resolves.toBe(true);
    });

    it('returns false when legacy_free_access is false', async () => {
      const supabase = createMockSupabase({ legacy_free_access: false });
      await expect(hasLegacyFreeAccess(supabase, 'user-1')).resolves.toBe(false);
    });

    it('returns false when profile is missing', async () => {
      const supabase = createMockSupabase(null);
      await expect(hasLegacyFreeAccess(supabase, 'user-1')).resolves.toBe(false);
    });
  });

  describe('hasUnlimitedAccess', () => {
    it('returns true for premium metadata without profile lookup', async () => {
      const supabase = createMockSupabase(null);
      await expect(
        hasUnlimitedAccess(supabase, 'user-1', { plan_type: 'premium' })
      ).resolves.toBe(true);
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('returns true for legacy grandfathered profile', async () => {
      const supabase = createMockSupabase({
        plan_type: 'free',
        legacy_free_access: true,
      });
      await expect(hasUnlimitedAccess(supabase, 'user-1')).resolves.toBe(true);
    });

    it('returns false for standard free profile', async () => {
      const supabase = createMockSupabase({
        plan_type: 'free',
        legacy_free_access: false,
      });
      await expect(hasUnlimitedAccess(supabase, 'user-1')).resolves.toBe(false);
    });
  });
});

describe('consumeCredit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('skips RPC and does not deduct for legacy grandfathered users', async () => {
    const supabase = createMockSupabase(
      { legacy_free_access: true, credit_balance: 2 },
      null
    );

    const result = await consumeCredit(supabase, 'user-legacy', 'ats_score');

    expect(result).toEqual({ ok: true, remaining: 2 });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('calls consume_credit RPC for non-legacy users', async () => {
    const supabase = createMockSupabase(
      { legacy_free_access: false, credit_balance: 1 },
      0
    );

    const result = await consumeCredit(supabase, 'user-new', 'ats_score');

    expect(result).toEqual({ ok: true, remaining: 0 });
    expect(supabase.rpc).toHaveBeenCalledWith('consume_credit', {
      p_user_id: 'user-new',
      p_reason: 'ats_score',
    });
  });
});
