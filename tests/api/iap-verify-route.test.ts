import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// StoreKit spec 7.2: every check, in order, and none of them grants on failure.
// The verifier is mocked here; tests/lib/iap.test.ts runs the real one.

const USER_ID = '11111111-1111-4111-8111-111111111111';
const config = { bundleId: 'b', appAppleId: 1, allowedEnvironments: ['Production', 'Sandbox'] };

const validTransaction = {
  transactionId: '2000000000000001',
  productId: 'resumely.exports.5',
  type: 'Consumable',
  quantity: 1,
  appAccountToken: USER_ID,
  environment: 'Sandbox',
};

function buildRequest(body: unknown) {
  return { headers: { get: () => null }, json: async () => body } as any;
}

const validBody = { signedTransaction: 'header.payload.signature', productId: 'resumely.exports.5' };

function loadRouteHarness({
  user = { id: USER_ID, is_anonymous: false } as { id: string; is_anonymous?: boolean } | null,
  appleConfig = config as typeof config | null,
  verification = { ok: true, value: validTransaction, environment: 'Sandbox' } as Record<string, unknown>,
  rpcResult = { data: { status: 'granted', credits_granted: 5, balance: 6 }, error: null } as {
    data: unknown;
    error: { message: string } | null;
  },
} = {}) {
  jest.resetModules();

  const userRpc = jest.fn(async () => {
    throw new Error('the grant must not run on the user-scoped client');
  });
  const routeClient = {
    auth: { getUser: jest.fn(async () => ({ data: { user }, error: null })) },
    rpc: userRpc,
  };
  const serviceRpc = jest.fn<(fn: string, params: Record<string, unknown>) => Promise<typeof rpcResult>>(
    async () => rpcResult
  );
  const createServiceRoleClient = jest.fn(() => ({ rpc: serviceRpc }));
  const verifySignedTransaction = jest.fn<(...args: unknown[]) => Promise<unknown>>(async () => verification);
  const captureServerEvent = jest.fn<(...args: unknown[]) => Promise<unknown>>(async () => undefined);

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
    createServiceRoleClient,
  }));
  jest.doMock('@/lib/iap', () => {
    const actual = jest.requireActual('@/lib/iap') as Record<string, unknown>;
    return {
      __esModule: true,
      ...actual,
      getAppleIapConfig: jest.fn(() => appleConfig),
      verifySignedTransaction,
    };
  });
  jest.doMock('@/lib/posthog-server', () => ({ __esModule: true, captureServerEvent }));

  const { POST } = require('@/app/api/v1/iap/verify/route');
  return { POST, userRpc, serviceRpc, createServiceRoleClient, verifySignedTransaction, captureServerEvent };
}

async function expectRefused(
  harness: ReturnType<typeof loadRouteHarness>,
  body: unknown,
  status: number,
  error: string
) {
  const response = await harness.POST(buildRequest(body));
  expect(response.status).toBe(status);
  await expect(response.json()).resolves.toEqual({ error });
  expect(harness.serviceRpc).not.toHaveBeenCalled();
  expect(harness.userRpc).not.toHaveBeenCalled();
}

describe('POST /api/v1/iap/verify', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('grants the signed amount through a service-role client and reports iap_verified', async () => {
    const harness = loadRouteHarness();
    const response = await harness.POST(buildRequest(validBody));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, status: 'granted', creditsGranted: 5, balance: 6 });
    expect(harness.userRpc).not.toHaveBeenCalled();
    expect(harness.serviceRpc).toHaveBeenCalledWith('grant_apple_purchase', {
      p_user_id: USER_ID,
      p_apple_transaction_id: '2000000000000001',
      p_product_id: 'resumely.exports.5',
      p_credits: 5,
      p_environment: 'Sandbox',
    });
    expect(harness.verifySignedTransaction).toHaveBeenCalledWith('header.payload.signature', config);
    expect(harness.captureServerEvent).toHaveBeenCalledWith(USER_ID, 'iap_verified', {
      product_id: 'resumely.exports.5',
      credits_granted: 5,
      environment: 'Sandbox',
      status: 'granted',
    });
  });

  it('answers already_granted for a repeat, so the app can finish the transaction', async () => {
    const harness = loadRouteHarness({
      rpcResult: { data: { status: 'already_granted', credits_granted: 5, balance: 6 }, error: null },
    });
    const response = await harness.POST(buildRequest(validBody));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, status: 'already_granted', creditsGranted: 5, balance: 6 });
  });

  it('grants credits x quantity', async () => {
    const harness = loadRouteHarness({
      verification: { ok: true, value: { ...validTransaction, quantity: 2 }, environment: 'Production' },
      rpcResult: { data: { status: 'granted', credits_granted: 10, balance: 11 }, error: null },
    });
    await harness.POST(buildRequest(validBody));
    expect(harness.serviceRpc).toHaveBeenCalledWith(
      'grant_apple_purchase',
      expect.objectContaining({ p_credits: 10, p_environment: 'Production' })
    );
  });

  it('accepts the app account token in upper case', async () => {
    const harness = loadRouteHarness({
      verification: { ok: true, value: { ...validTransaction, appAccountToken: USER_ID.toUpperCase() }, environment: 'Sandbox' },
    });
    const response = await harness.POST(buildRequest(validBody));
    expect(response.status).toBe(200);
  });

  it('check 1: 503 and no grant when Apple verification is not configured', async () => {
    const harness = loadRouteHarness({ appleConfig: null });
    await expectRefused(harness, validBody, 503, 'iap_verification_unavailable');
    expect(harness.verifySignedTransaction).not.toHaveBeenCalled();
    expect(harness.captureServerEvent).toHaveBeenCalledWith('server', 'iap_verify_failed', {
      reason: 'iap_verification_unavailable',
    });
  });

  it('check 2: 401 for no user', async () => {
    const harness = loadRouteHarness({ user: null });
    await expectRefused(harness, validBody, 401, 'Unauthorized');
  });

  it('check 2: 401 account_required for an anonymous session', async () => {
    const harness = loadRouteHarness({ user: { id: USER_ID, is_anonymous: true } });
    await expectRefused(harness, validBody, 401, 'account_required');
  });

  it('400 for the pre-spec body (a bare transaction ID is never trusted)', async () => {
    const harness = loadRouteHarness();
    await expectRefused(harness, { productId: 'resumely.exports.5', appleTransactionId: 'made-up' }, 400, 'invalid_request');
    expect(harness.verifySignedTransaction).not.toHaveBeenCalled();
  });

  it('check 3: 400 when the signature does not verify', async () => {
    const harness = loadRouteHarness({ verification: { ok: false, reason: 'invalid_transaction' } });
    await expectRefused(harness, validBody, 400, 'invalid_transaction');
  });

  it('check 3: 503 when Apple\'s revocation check cannot run (app retries)', async () => {
    const harness = loadRouteHarness({ verification: { ok: false, reason: 'verification_unavailable' } });
    await expectRefused(harness, validBody, 503, 'iap_verification_unavailable');
  });

  it('check 4: 400 for an environment that is not allowed', async () => {
    const harness = loadRouteHarness({ verification: { ok: false, reason: 'environment_not_allowed' } });
    await expectRefused(harness, validBody, 400, 'environment_not_allowed');
  });

  it('check 5: 400 unknown_product for an old credits_* product', async () => {
    const harness = loadRouteHarness({
      verification: { ok: true, value: { ...validTransaction, productId: 'credits_super' }, environment: 'Sandbox' },
    });
    await expectRefused(harness, { ...validBody, productId: 'credits_super' }, 400, 'unknown_product');
  });

  it('check 5: 400 unknown_product for a non-consumable', async () => {
    const harness = loadRouteHarness({
      verification: { ok: true, value: { ...validTransaction, type: 'Non-Consumable' }, environment: 'Sandbox' },
    });
    await expectRefused(harness, validBody, 400, 'unknown_product');
  });

  it('check 5: 400 product_mismatch when the client names a bigger pack than it bought', async () => {
    const harness = loadRouteHarness({
      verification: { ok: true, value: { ...validTransaction, productId: 'resumely.exports.1' }, environment: 'Sandbox' },
    });
    await expectRefused(harness, { ...validBody, productId: 'resumely.exports.10' }, 400, 'product_mismatch');
  });

  it('check 6: 403 for a transaction bought under another account', async () => {
    const harness = loadRouteHarness({
      verification: {
        ok: true,
        value: { ...validTransaction, appAccountToken: '22222222-2222-4222-8222-222222222222' },
        environment: 'Sandbox',
      },
    });
    await expectRefused(harness, validBody, 403, 'account_mismatch');
  });

  it('check 6: 403 for a transaction with no account token', async () => {
    const harness = loadRouteHarness({
      verification: { ok: true, value: { ...validTransaction, appAccountToken: undefined }, environment: 'Sandbox' },
    });
    await expectRefused(harness, validBody, 403, 'account_mismatch');
  });

  it('check 7: 409 for a revoked transaction', async () => {
    const harness = loadRouteHarness({
      verification: { ok: true, value: { ...validTransaction, revocationDate: 1761100000000 }, environment: 'Sandbox' },
    });
    await expectRefused(harness, validBody, 409, 'transaction_revoked');
  });

  it('check 8: 409 when the transaction is already on another account\'s ledger', async () => {
    const harness = loadRouteHarness({ rpcResult: { data: { status: 'owned_by_other_account' }, error: null } });
    const response = await harness.POST(buildRequest(validBody));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: 'transaction_owned_by_another_account' });
  });

  it('check 8: 409 when Apple refunded the transaction before it was granted', async () => {
    const harness = loadRouteHarness({ rpcResult: { data: { status: 'revoked' }, error: null } });
    const response = await harness.POST(buildRequest(validBody));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: 'transaction_revoked' });
  });

  it('never sends a client-typed product ID to analytics', async () => {
    const harness = loadRouteHarness({ verification: { ok: false, reason: 'invalid_transaction' } });
    await harness.POST(buildRequest({ ...validBody, productId: 'jane.doe@example.com' }));
    expect(harness.captureServerEvent).toHaveBeenCalledWith(USER_ID, 'iap_verify_failed', { reason: 'invalid_transaction' });
  });

  it('check 8: 500 when the grant fails at the database', async () => {
    const harness = loadRouteHarness({ rpcResult: { data: null, error: { message: 'permission denied' } } });
    const response = await harness.POST(buildRequest(validBody));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'failed_to_grant_credits' });
  });
});
