import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// Pricing v2: GET /api/v1/credits gives the welcome grant (get_credit_state)
// and returns the Pro subscription state, falling back to the plain balance.

const USER_ID = '11111111-1111-4111-8111-111111111111';
type RpcResult = { data: unknown; error: { message: string } | null };

function loadRoute({
  user = { id: USER_ID } as { id: string } | null,
  stateResult = { data: { balance: 3, subscription: { active: false } }, error: null } as RpcResult,
  plainBalance = 1,
} = {}) {
  jest.resetModules();
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

  const serviceRpc = jest.fn<(fn: string, params: Record<string, unknown>) => Promise<RpcResult>>(async () => stateResult);
  const ledgerQuery = {
    select: () => ledgerQuery,
    eq: () => ledgerQuery,
    order: () => ledgerQuery,
    limit: async () => ({ data: [{ id: 't1', delta: 3, reason: 'welcome_grant' }], error: null }),
  };
  const profileQuery = {
    select: () => profileQuery,
    eq: () => profileQuery,
    maybeSingle: async () => ({ data: { credit_balance: plainBalance }, error: null }),
  };
  const routeClient = {
    auth: { getUser: jest.fn(async () => ({ data: { user }, error: null })) },
    from: jest.fn((table: string) => (table === 'profiles' ? profileQuery : ledgerQuery)),
    rpc: jest.fn(async () => {
      throw new Error('get_credit_state must not run on the user-scoped client');
    }),
  };
  jest.doMock('@/lib/supabase-server', () => ({
    __esModule: true,
    createRouteHandlerClient: jest.fn(async () => routeClient),
    createServiceRoleClient: jest.fn(() => ({ rpc: serviceRpc })),
  }));

  const { GET } = require('@/app/api/v1/credits/route');
  return { GET, serviceRpc, routeClient };
}

const request = { url: 'https://example.test/api/v1/credits', headers: { get: () => null } } as any;

describe('GET /api/v1/credits', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('gives the welcome grant through get_credit_state on the service-role client', async () => {
    const { GET, serviceRpc, routeClient } = loadRoute();
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(serviceRpc).toHaveBeenCalledWith('get_credit_state', { p_user_id: USER_ID });
    expect(routeClient.rpc).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      balance: 3,
      subscription: { active: false },
      transactions: [{ id: 't1', delta: 3, reason: 'welcome_grant' }],
    });
  });

  it('returns an active subscription with its fair-use count', async () => {
    const { GET } = loadRoute({
      stateResult: {
        data: {
          balance: 2,
          subscription: {
            active: true,
            product_id: 'resumely.pro.monthly',
            expires_at: '2026-11-29T10:00:00+00:00',
            grace_until: null,
            auto_renew: false,
            period_exports: 12,
            period_cap: 40,
          },
        },
        error: null,
      },
    });
    const body = (await (await GET(request)).json()) as Record<string, unknown>;

    expect(body.balance).toBe(2);
    expect(body.subscription).toEqual({
      active: true,
      productId: 'resumely.pro.monthly',
      expiresAt: '2026-11-29T10:00:00+00:00',
      graceUntil: null,
      autoRenew: false,
      periodExports: 12,
      periodCap: 40,
    });
  });

  it('falls back to the plain balance when the pricing v2 functions are missing', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { GET } = loadRoute({
      stateResult: { data: null, error: { message: 'Could not find the function public.get_credit_state' } },
      plainBalance: 1,
    });
    const body = (await (await GET(request)).json()) as Record<string, unknown>;

    expect(body.balance).toBe(1);
    expect(body.subscription).toEqual({ active: false });
    warn.mockRestore();
  });

  it('401 without a user', async () => {
    const { GET, serviceRpc } = loadRoute({ user: null });
    expect((await GET(request)).status).toBe(401);
    expect(serviceRpc).not.toHaveBeenCalled();
  });
});
