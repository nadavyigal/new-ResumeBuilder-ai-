import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// R1: grant_apple_credits is SECURITY DEFINER and trusts p_user_id, so EXECUTE
// is revoked from anon and authenticated. The route must resolve the user on
// its own client and then run the grant on a service-role client.

function buildRequest(body: unknown) {
  return {
    headers: { get: () => null },
    json: async () => body,
  } as any;
}

function loadRouteHarness({
  user = { id: 'user-1' } as { id: string } | null,
  rpcResult = { data: 20, error: null } as { data: unknown; error: { message: string } | null },
} = {}) {
  jest.resetModules();

  const userRpc = jest.fn(async () => {
    throw new Error('the grant must not run on the user-scoped client');
  });
  const routeClient = {
    auth: { getUser: jest.fn(async () => ({ data: { user }, error: null })) },
    rpc: userRpc,
  };
  const serviceRpc = jest.fn(async () => rpcResult);
  const createRouteHandlerClient = jest.fn(async () => routeClient);
  const createServiceRoleClient = jest.fn(() => ({ rpc: serviceRpc }));

  jest.doMock('next/server', () => ({
    __esModule: true,
    NextResponse: class {
      status: number;
      private body: unknown;

      constructor(body: unknown, init?: { status?: number }) {
        this.body = body;
        this.status = init?.status ?? 200;
      }

      static json(body: unknown, init?: { status?: number }) {
        return new this(body, init);
      }

      async json() {
        return this.body;
      }
    },
  }));

  jest.doMock('@/lib/supabase-server', () => ({
    __esModule: true,
    createRouteHandlerClient,
    createServiceRoleClient,
  }));

  jest.doMock('@/lib/iap', () => ({
    __esModule: true,
    creditsForProduct: jest.fn(() => 20),
    verifyAppleTransaction: jest.fn(async () => ({ verified: true, message: 'ok' })),
  }));

  const { POST } = require('@/app/api/v1/iap/verify/route');
  return { POST, userRpc, serviceRpc, createServiceRoleClient };
}

describe('POST /api/v1/iap/verify', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('grants credits through a service-role client, not the caller session', async () => {
    const { POST, userRpc, serviceRpc, createServiceRoleClient } = loadRouteHarness();

    const response = await POST(
      buildRequest({ productId: 'credits_20', appleTransactionId: 'txn-1' })
    );

    expect(response.status).toBe(200);
    expect(createServiceRoleClient).toHaveBeenCalledTimes(1);
    expect(userRpc).not.toHaveBeenCalled();
    expect(serviceRpc).toHaveBeenCalledWith(
      'grant_apple_credits',
      expect.objectContaining({ p_user_id: 'user-1', p_delta: 20, p_source: 'apple_iap' })
    );
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ success: true, creditsGranted: 20, balance: 20 })
    );
  });

  it('rejects an unauthenticated caller before touching the function', async () => {
    const { POST, serviceRpc, createServiceRoleClient } = loadRouteHarness({ user: null });

    const response = await POST(
      buildRequest({ productId: 'credits_20', appleTransactionId: 'txn-1' })
    );

    expect(response.status).toBe(401);
    expect(createServiceRoleClient).not.toHaveBeenCalled();
    expect(serviceRpc).not.toHaveBeenCalled();
  });

  it('surfaces a 500 when the grant is denied at the database', async () => {
    const { POST } = loadRouteHarness({
      rpcResult: { data: null, error: { message: 'permission denied for function grant_apple_credits' } },
    });

    const response = await POST(
      buildRequest({ productId: 'credits_20', appleTransactionId: 'txn-1' })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ error: 'failed_to_grant_credits' })
    );
  });
});
