import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// StoreKit spec section 8: unverified payloads change nothing; REFUND and
// REFUND_REVERSED go through apply_iap_refund, keyed on notificationUUID.

const config = { bundleId: 'b', appAppleId: 1, allowedEnvironments: ['Production', 'Sandbox'] };

function refundNotification(type = 'REFUND') {
  return {
    ok: true,
    environment: 'Production',
    value: { notificationType: type, notificationUUID: 'notif-1', data: { signedTransactionInfo: 'signed.txn.info' } },
  };
}

function buildRequest(body: unknown) {
  return { headers: { get: () => null }, json: async () => body } as any;
}

function loadRouteHarness({
  appleConfig = config as typeof config | null,
  notification = refundNotification() as Record<string, unknown>,
  transaction = { ok: true, value: { transactionId: '2000000000000001' }, environment: 'Production' } as Record<string, unknown>,
  rpcResult = {
    data: { status: 'refunded', user_id: 'user-1', credits_changed: -5, balance: 1, product_id: 'resumely.exports.5', environment: 'Production' },
    error: null,
  } as { data: unknown; error: { message: string } | null },
} = {}) {
  jest.resetModules();
  const serviceRpc = jest.fn<(fn: string, params: Record<string, unknown>) => Promise<typeof rpcResult>>(
    async () => rpcResult
  );
  const captureServerEvent = jest.fn<(...args: unknown[]) => Promise<unknown>>(async () => undefined);
  const verifySignedNotification = jest.fn<(...args: unknown[]) => Promise<unknown>>(async () => notification);
  const verifySignedTransaction = jest.fn<(...args: unknown[]) => Promise<unknown>>(async () => transaction);

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
    createServiceRoleClient: jest.fn(() => ({ rpc: serviceRpc })),
  }));
  jest.doMock('@/lib/iap', () => ({
    __esModule: true,
    getAppleIapConfig: jest.fn(() => appleConfig),
    verifySignedNotification,
    verifySignedTransaction,
  }));
  jest.doMock('@/lib/posthog-server', () => ({ __esModule: true, captureServerEvent }));

  const { POST } = require('@/app/api/v1/iap/notifications/route');
  return { POST, serviceRpc, captureServerEvent, verifySignedNotification, verifySignedTransaction };
}

const body = { signedPayload: 'signed.notification.payload' };

describe('POST /api/v1/iap/notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('applies a verified REFUND once, keyed on the notification UUID', async () => {
    const harness = loadRouteHarness();
    const response = await harness.POST(buildRequest(body));

    expect(response.status).toBe(200);
    expect(harness.verifySignedTransaction).toHaveBeenCalledWith('signed.txn.info', config);
    expect(harness.serviceRpc).toHaveBeenCalledWith('apply_iap_refund', {
      p_apple_transaction_id: '2000000000000001',
      p_notification_uuid: 'notif-1',
      p_reversed: false,
    });
    expect(harness.captureServerEvent).toHaveBeenCalledWith('user-1', 'iap_refund_processed', {
      product_id: 'resumely.exports.5',
      credits_deducted: 5,
      environment: 'Production',
      notification_type: 'REFUND',
    });
  });

  it('applies REFUND_REVERSED as a re-grant', async () => {
    const harness = loadRouteHarness({
      notification: refundNotification('REFUND_REVERSED'),
      rpcResult: {
        data: { status: 'reversed', user_id: 'user-1', credits_changed: 5, balance: 6, product_id: 'resumely.exports.5', environment: 'Production' },
        error: null,
      },
    });
    const response = await harness.POST(buildRequest(body));
    expect(response.status).toBe(200);
    expect(harness.serviceRpc).toHaveBeenCalledWith('apply_iap_refund', expect.objectContaining({ p_reversed: true }));
    expect(harness.captureServerEvent).toHaveBeenCalledWith(
      'user-1',
      'iap_refund_processed',
      expect.objectContaining({ credits_deducted: -5 })
    );
  });

  it('answers 200 with no event for a duplicate notification', async () => {
    const harness = loadRouteHarness({ rpcResult: { data: { status: 'duplicate', user_id: 'user-1' }, error: null } });
    const response = await harness.POST(buildRequest(body));
    expect(response.status).toBe(200);
    expect(harness.captureServerEvent).not.toHaveBeenCalled();
  });

  it('answers 200 for a refund of a purchase this server never granted', async () => {
    const harness = loadRouteHarness({ rpcResult: { data: { status: 'no_grant' }, error: null } });
    const response = await harness.POST(buildRequest(body));
    expect(response.status).toBe(200);
    expect(harness.captureServerEvent).not.toHaveBeenCalled();
  });

  it('503 and no change when Apple verification is not configured', async () => {
    const harness = loadRouteHarness({ appleConfig: null });
    const response = await harness.POST(buildRequest(body));
    expect(response.status).toBe(503);
    expect(harness.serviceRpc).not.toHaveBeenCalled();
  });

  it('400 and no change for a missing payload', async () => {
    const harness = loadRouteHarness();
    const response = await harness.POST(buildRequest({}));
    expect(response.status).toBe(400);
    expect(harness.verifySignedNotification).not.toHaveBeenCalled();
    expect(harness.serviceRpc).not.toHaveBeenCalled();
  });

  it('400 and no change for an unverified notification', async () => {
    const harness = loadRouteHarness({ notification: { ok: false, reason: 'invalid_transaction' } });
    const response = await harness.POST(buildRequest(body));
    expect(response.status).toBe(400);
    expect(harness.serviceRpc).not.toHaveBeenCalled();
  });

  it('400 and no change when the transaction inside the notification does not verify', async () => {
    const harness = loadRouteHarness({ transaction: { ok: false, reason: 'invalid_transaction' } });
    const response = await harness.POST(buildRequest(body));
    expect(response.status).toBe(400);
    expect(harness.serviceRpc).not.toHaveBeenCalled();
  });

  it('200 and no change for an environment that is not allowed', async () => {
    const harness = loadRouteHarness({ notification: { ok: false, reason: 'environment_not_allowed' } });
    const response = await harness.POST(buildRequest(body));
    expect(response.status).toBe(200);
    expect(harness.serviceRpc).not.toHaveBeenCalled();
  });

  it.each(['CONSUMPTION_REQUEST', 'TEST', 'ONE_TIME_CHARGE'])('logs %s and changes nothing', async (type) => {
    const harness = loadRouteHarness({ notification: refundNotification(type) });
    const response = await harness.POST(buildRequest(body));
    expect(response.status).toBe(200);
    expect(harness.verifySignedTransaction).not.toHaveBeenCalled();
    expect(harness.serviceRpc).not.toHaveBeenCalled();
  });

  it('500 so Apple retries when the database fails', async () => {
    const harness = loadRouteHarness({ rpcResult: { data: null, error: { message: 'connection reset' } } });
    const response = await harness.POST(buildRequest(body));
    expect(response.status).toBe(500);
  });
});
