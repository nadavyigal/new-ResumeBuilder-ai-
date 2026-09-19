import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// R1: consume_credit is SECURITY DEFINER and trusts p_user_id, so EXECUTE is
// revoked from anon and authenticated. These tests pin the thing that keeps the
// route working after the revoke: consumeCredit must build its own service-role
// client, never borrow the caller's user-scoped one.

function loadCredits(rpcResult: { data: unknown; error: { message: string } | null }) {
  jest.resetModules();

  const rpc = jest.fn(async () => rpcResult);
  const serviceClient = { rpc };
  const createServiceRoleClient = jest.fn(() => serviceClient);
  const createRouteHandlerClient = jest.fn(async () => ({
    rpc: jest.fn(async () => {
      throw new Error('consumeCredit must not use the route handler client');
    }),
  }));

  jest.doMock('@/lib/supabase-server', () => ({
    __esModule: true,
    createServiceRoleClient,
    createRouteHandlerClient,
  }));

  const { consumeCredit } = require('@/lib/credits');
  return { consumeCredit, rpc, createServiceRoleClient, createRouteHandlerClient };
}

describe('consumeCredit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('spends the credit through a service-role client', async () => {
    const { consumeCredit, rpc, createServiceRoleClient, createRouteHandlerClient } = loadCredits({
      data: 4,
      error: null,
    });

    const result = await consumeCredit('user-1', 'ats_score');

    expect(createServiceRoleClient).toHaveBeenCalledTimes(1);
    expect(createRouteHandlerClient).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith('consume_credit', {
      p_user_id: 'user-1',
      p_reason: 'ats_score',
    });
    expect(result).toEqual({ ok: true, remaining: 4 });
  });

  it('returns 402 when the function reports no credits left', async () => {
    const { consumeCredit } = loadCredits({ data: null, error: null });

    await expect(consumeCredit('user-1', 'refine_section')).resolves.toEqual({
      ok: false,
      status: 402,
      error: 'insufficient_credits',
    });
  });

  it('returns 500 and the message when the function errors', async () => {
    const { consumeCredit } = loadCredits({
      data: null,
      error: { message: 'permission denied for function consume_credit' },
    });

    await expect(consumeCredit('user-1', 'ats_score')).resolves.toEqual({
      ok: false,
      status: 500,
      error: 'credit_consume_failed',
      details: 'permission denied for function consume_credit',
    });
  });
});
