import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

// P3b story 1: POST /api/v1/exports/unlock (StoreKit spec 6.4). It resolves the
// user with getUser(), never trusts an id from the body, and spends a credit
// only when the gate applies (EXPORT_CREDITS_ENABLED and the iOS app, spec 6.5).

type RpcResult = { data: unknown; error: { message: string } | null };
type TestUser = { id: string; is_anonymous?: boolean } | null;

function buildRequest(body: unknown, client?: string) {
  return {
    headers: {
      get: (name: string) => (name.toLowerCase() === 'x-resumely-client' ? client ?? null : null),
    },
    json: async () => body,
  } as any;
}

function loadRoute({
  user = { id: 'user-1' } as TestUser,
  rpcResult = { data: { status: 'ungated' }, error: null } as RpcResult,
} = {}) {
  jest.resetModules();

  const routeClient = {
    auth: { getUser: jest.fn(async () => ({ data: { user }, error: null })) },
    rpc: jest.fn(async () => {
      throw new Error('unlock_export must not run on the user-scoped client');
    }),
  };
  const serviceRpc = jest.fn<(fn: string, params: Record<string, unknown>) => Promise<RpcResult>>(
    async () => rpcResult
  );
  const captureServerEvent = jest.fn(async (...args: unknown[]) => {
    void args;
  });

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
    createRouteHandlerClient: jest.fn(async () => routeClient),
    createServiceRoleClient: jest.fn(() => ({ rpc: serviceRpc })),
  }));
  jest.doMock('@/lib/posthog-server', () => ({ __esModule: true, captureServerEvent }));

  const { POST } = require('@/app/api/v1/exports/unlock/route');
  return { POST, serviceRpc, captureServerEvent };
}

describe('POST /api/v1/exports/unlock', () => {
  const previous = process.env.EXPORT_CREDITS_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.EXPORT_CREDITS_ENABLED;
  });

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.EXPORT_CREDITS_ENABLED;
    } else {
      process.env.EXPORT_CREDITS_ENABLED = previous;
    }
  });

  it('returns 401 without a user', async () => {
    const { POST, serviceRpc } = loadRoute({ user: null });

    const response = await POST(buildRequest({ optimizationId: 'opt-1' }, 'ios'));

    expect(response.status).toBe(401);
    expect(serviceRpc).not.toHaveBeenCalled();
  });

  it('returns 400 without an optimizationId', async () => {
    const { POST, serviceRpc } = loadRoute();

    const response = await POST(buildRequest({}, 'ios'));

    expect(response.status).toBe(400);
    expect(serviceRpc).not.toHaveBeenCalled();
  });

  it('records an ungated unlock and spends nothing while the flag is off', async () => {
    const { POST, serviceRpc } = loadRoute();

    const response = await POST(buildRequest({ optimizationId: 'opt-1' }, 'ios'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ungated', balance: null });
    expect(serviceRpc).toHaveBeenCalledWith('unlock_export', {
      p_user_id: 'user-1',
      p_optimization_id: 'opt-1',
      p_charge: false,
    });
  });

  it('keeps the web ungated with the flag on (F1)', async () => {
    process.env.EXPORT_CREDITS_ENABLED = 'true';
    const { POST, serviceRpc } = loadRoute();

    const response = await POST(buildRequest({ optimizationId: 'opt-1' }));

    expect(response.status).toBe(200);
    expect(serviceRpc).toHaveBeenCalledWith('unlock_export', expect.objectContaining({ p_charge: false }));
  });

  it('asks an anonymous iOS session for an account once the gate applies', async () => {
    process.env.EXPORT_CREDITS_ENABLED = 'true';
    const { POST, serviceRpc } = loadRoute({ user: { id: 'anon-1', is_anonymous: true } });

    const response = await POST(buildRequest({ optimizationId: 'opt-1' }, 'ios'));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'account_required' });
    expect(serviceRpc).not.toHaveBeenCalled();
  });

  it('spends one credit for the iOS app once the gate applies', async () => {
    process.env.EXPORT_CREDITS_ENABLED = 'true';
    const { POST, serviceRpc, captureServerEvent } = loadRoute({
      rpcResult: { data: { status: 'unlocked', balance: 2, paid_user: true }, error: null },
    });

    const response = await POST(buildRequest({ optimizationId: 'opt-1' }, 'ios'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'unlocked', balance: 2 });
    expect(serviceRpc).toHaveBeenCalledWith('unlock_export', {
      p_user_id: 'user-1',
      p_optimization_id: 'opt-1',
      p_charge: true,
    });
    expect(captureServerEvent).toHaveBeenCalledWith(
      'user-1',
      'export_unlocked',
      expect.objectContaining({
        optimization_id: 'opt-1', status: 'unlocked', paid_user: true, balance_after: 2, platform: 'ios',
      })
    );
  });

  it('reports paid_user as null when the database result omits it', async () => {
    process.env.EXPORT_CREDITS_ENABLED = 'true';
    const { POST, captureServerEvent } = loadRoute({
      rpcResult: { data: { status: 'unlocked', balance: 2 }, error: null },
    });

    expect((await POST(buildRequest({ optimizationId: 'opt-1' }, 'ios'))).status).toBe(200);
    expect(captureServerEvent).toHaveBeenCalledWith(
      'user-1',
      'export_unlocked',
      expect.objectContaining({ paid_user: null })
    );
  });

  it('returns 402 export_credits_required on an empty balance', async () => {
    process.env.EXPORT_CREDITS_ENABLED = 'true';
    const { POST, captureServerEvent } = loadRoute({
      rpcResult: { data: { status: 'insufficient', balance: 0 }, error: null },
    });

    const response = await POST(buildRequest({ optimizationId: 'opt-1' }, 'ios'));

    expect(response.status).toBe(402);
    expect(await response.json()).toEqual({ error: 'export_credits_required', balance: 0 });
    expect(captureServerEvent).toHaveBeenCalledWith(
      'user-1',
      'export_blocked',
      expect.objectContaining({ optimization_id: 'opt-1', platform: 'ios' })
    );
  });

  it('returns 404 for an optimization the user does not own', async () => {
    process.env.EXPORT_CREDITS_ENABLED = 'true';
    const { POST } = loadRoute({ rpcResult: { data: { status: 'not_found' }, error: null } });

    const response = await POST(buildRequest({ optimizationId: 'opt-other' }, 'ios'));

    expect(response.status).toBe(404);
  });

  it('fails closed with 500 when the charged unlock cannot run', async () => {
    process.env.EXPORT_CREDITS_ENABLED = 'true';
    const { POST } = loadRoute({ rpcResult: { data: null, error: { message: 'boom' } } });

    const response = await POST(buildRequest({ optimizationId: 'opt-1' }, 'ios'));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'export_unlock_failed' });
  });

  it('still answers ungated when recording an ungated unlock fails', async () => {
    const { POST } = loadRoute({ rpcResult: { data: null, error: { message: 'function does not exist' } } });

    const response = await POST(buildRequest({ optimizationId: 'opt-1' }, 'ios'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ungated', balance: null });
  });
});
