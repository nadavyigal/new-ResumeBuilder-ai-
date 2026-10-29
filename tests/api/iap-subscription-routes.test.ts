import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// Pricing v2: the Pro subscription through /api/v1/iap/verify and App Store
// Server Notifications. The verifiers are mocked; tests/lib/iap.test.ts runs
// the real ones and scripts/tests/pricing-v2-local-db.mjs runs the SQL.

const USER_ID = '11111111-1111-4111-8111-111111111111';
const config = { bundleId: 'b', appAppleId: 1, allowedEnvironments: ['Production', 'Sandbox'] };
const PURCHASE = Date.UTC(2026, 9, 29, 10, 0, 0);
const EXPIRES = Date.UTC(2026, 10, 29, 10, 0, 0);
const SIGNED = Date.UTC(2026, 10, 1, 9, 0, 0);
const NOTIFIED = Date.UTC(2026, 10, 2, 12, 0, 0);

const subscriptionTransaction = {
  transactionId: '3000000000000002',
  originalTransactionId: '3000000000000001',
  productId: 'resumely.pro.monthly',
  type: 'Auto-Renewable Subscription',
  appAccountToken: USER_ID,
  purchaseDate: PURCHASE,
  expiresDate: EXPIRES,
  environment: 'Sandbox',
};

type RpcResult = { data: unknown; error: { message: string } | null };

function mockNextServer() {
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
}

function buildRequest(body: unknown) {
  return { headers: { get: () => null }, json: async () => body } as any;
}

function loadHarness({
  user = { id: USER_ID, is_anonymous: false } as { id: string; is_anonymous?: boolean } | null,
  transaction = subscriptionTransaction as Record<string, unknown>,
  notification = null as Record<string, unknown> | null,
  renewal = { ok: true, value: { autoRenewStatus: 1, signedDate: SIGNED }, environment: 'Sandbox' } as Record<string, unknown>,
  rpc = {} as Record<string, RpcResult>,
} = {}) {
  jest.resetModules();
  mockNextServer();
  const serviceRpc = jest.fn<(fn: string, params: Record<string, unknown>) => Promise<RpcResult>>(
    async (fn) => rpc[fn] ?? { data: null, error: { message: `unexpected rpc ${fn}` } }
  );
  const captureServerEvent = jest.fn<(...args: unknown[]) => Promise<unknown>>(async () => undefined);
  const verifySignedTransaction = jest.fn<(...args: unknown[]) => Promise<unknown>>(async () => ({
    ok: true,
    value: transaction,
    environment: 'Sandbox',
  }));
  const verifySignedNotification = jest.fn<(...args: unknown[]) => Promise<unknown>>(async () => ({
    ok: true,
    value: notification,
    environment: 'Sandbox',
  }));
  const verifySignedRenewalInfo = jest.fn<(...args: unknown[]) => Promise<unknown>>(async () => renewal);

  jest.doMock('@/lib/supabase-server', () => ({
    __esModule: true,
    createRouteHandlerClient: jest.fn(async () => ({
      auth: { getUser: jest.fn(async () => ({ data: { user }, error: null })) },
    })),
    createServiceRoleClient: jest.fn(() => ({ rpc: serviceRpc })),
  }));
  jest.doMock('@/lib/iap', () => {
    const actual = jest.requireActual('@/lib/iap') as Record<string, unknown>;
    return {
      __esModule: true,
      ...actual,
      getAppleIapConfig: jest.fn(() => config),
      verifySignedTransaction,
      verifySignedNotification,
      verifySignedRenewalInfo,
    };
  });
  jest.doMock('@/lib/posthog-server', () => ({ __esModule: true, captureServerEvent }));

  const verify = require('@/app/api/v1/iap/verify/route');
  const notifications = require('@/app/api/v1/iap/notifications/route');
  return { verify: verify.POST, notify: notifications.POST, serviceRpc, captureServerEvent, verifySignedRenewalInfo };
}

const verifyBody = { signedTransaction: 'header.payload.signature', productId: 'resumely.pro.monthly' };
const notifyBody = { signedPayload: 'signed.notification.payload' };

function subscriptionNotification(type: string, subtype?: string) {
  return {
    notificationType: type,
    subtype,
    notificationUUID: `notif-${type}`,
    signedDate: NOTIFIED,
    data: { signedTransactionInfo: 'signed.txn.info', signedRenewalInfo: 'signed.renewal.info' },
  };
}

describe('POST /api/v1/iap/verify with the Pro subscription', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('records a new subscription for the buyer and starts the funnel event', async () => {
    const h = loadHarness({
      rpc: { upsert_subscription: { data: { status: 'created', active: true, expires_at: '2026-11-29T10:00:00+00:00' }, error: null } },
    });
    const response = await h.verify(buildRequest(verifyBody));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      status: 'granted',
      creditsGranted: 0,
      balance: null,
      entitlement: { active: true, productId: 'resumely.pro.monthly', expiresAt: '2026-11-29T10:00:00+00:00' },
    });
    expect(h.serviceRpc).toHaveBeenCalledWith('upsert_subscription', {
      p_user_id: USER_ID,
      p_original_transaction_id: '3000000000000001',
      p_transaction_id: '3000000000000002',
      p_product_id: 'resumely.pro.monthly',
      p_purchase_date: new Date(PURCHASE).toISOString(),
      p_expires_at: new Date(EXPIRES).toISOString(),
      p_revoked_at: null,
      p_environment: 'Sandbox',
    });
    expect(h.serviceRpc).not.toHaveBeenCalledWith('grant_apple_purchase', expect.anything());
    expect(h.captureServerEvent).toHaveBeenCalledWith(USER_ID, 'subscription_started', {
      product_id: 'resumely.pro.monthly',
      environment: 'Sandbox',
      source: 'verify',
    });
  });

  it('sends subscription_renewed when the app delivers a renewal before DID_RENEW', async () => {
    const h = loadHarness({
      rpc: { upsert_subscription: { data: { status: 'renewed', active: true, expires_at: '2026-12-29T10:00:00+00:00' }, error: null } },
    });
    const response = await h.verify(buildRequest(verifyBody));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ status: 'already_granted' }));
    expect(h.captureServerEvent).toHaveBeenCalledWith(USER_ID, 'subscription_renewed', {
      product_id: 'resumely.pro.monthly',
      environment: 'Sandbox',
      source: 'verify',
    });
  });

  it('answers already_granted for a renewal or a restore, with no second start event', async () => {
    const h = loadHarness({
      rpc: { upsert_subscription: { data: { status: 'unchanged', active: true, expires_at: '2026-11-29T10:00:00+00:00' }, error: null } },
    });
    const response = await h.verify(buildRequest(verifyBody));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ status: 'already_granted', creditsGranted: 0 }));
    expect(h.captureServerEvent).not.toHaveBeenCalledWith(USER_ID, 'subscription_started', expect.anything());
  });

  it('records an expired subscription as inactive, so the app can finish it', async () => {
    const h = loadHarness({
      rpc: { upsert_subscription: { data: { status: 'unchanged', active: false, expires_at: '2026-09-29T10:00:00+00:00' }, error: null } },
    });
    const response = await h.verify(buildRequest(verifyBody));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ entitlement: expect.objectContaining({ active: false }) })
    );
  });

  it('409 when the subscription belongs to another Resumely account (restore on a second account)', async () => {
    const h = loadHarness({ rpc: { upsert_subscription: { data: { status: 'owned_by_other_account' }, error: null } } });
    const response = await h.verify(buildRequest(verifyBody));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: 'subscription_owned_by_another_account' });
  });

  it('403 for a subscription bought under another account token', async () => {
    const h = loadHarness({ transaction: { ...subscriptionTransaction, appAccountToken: '22222222-2222-4222-8222-222222222222' } });
    const response = await h.verify(buildRequest(verifyBody));

    expect(response.status).toBe(403);
    expect(h.serviceRpc).not.toHaveBeenCalled();
  });

  it('409 for a refunded subscription transaction, without a write', async () => {
    const h = loadHarness({ transaction: { ...subscriptionTransaction, revocationDate: PURCHASE + 1000 } });
    const response = await h.verify(buildRequest(verifyBody));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: 'transaction_revoked' });
    expect(h.serviceRpc).not.toHaveBeenCalled();
  });

  it('400 product_mismatch when the client names a pack for a subscription', async () => {
    const h = loadHarness();
    const response = await h.verify(buildRequest({ ...verifyBody, productId: 'resumely.exports.14' }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'product_mismatch' });
  });

  it('400 when the subscription transaction has no expiry', async () => {
    const h = loadHarness({ transaction: { ...subscriptionTransaction, expiresDate: undefined } });
    const response = await h.verify(buildRequest(verifyBody));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'invalid_transaction' });
  });

  it('400 unknown_product for an unknown subscription product', async () => {
    const h = loadHarness({ transaction: { ...subscriptionTransaction, productId: 'resumely.pro.yearly' } });
    const response = await h.verify(buildRequest({ ...verifyBody, productId: 'resumely.pro.yearly' }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'unknown_product' });
  });

  it('500 when the subscription cannot be recorded (the app keeps it unfinished)', async () => {
    const h = loadHarness({ rpc: { upsert_subscription: { data: null, error: { message: 'boom' } } } });
    const response = await h.verify(buildRequest(verifyBody));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'failed_to_record_subscription' });
  });

  it('grants the v2 14-pack as 14 credits', async () => {
    const h = loadHarness({
      transaction: { transactionId: 't14', productId: 'resumely.exports.14', type: 'Consumable', quantity: 1, appAccountToken: USER_ID },
      rpc: { grant_apple_purchase: { data: { status: 'granted', credits_granted: 14, balance: 17 }, error: null } },
    });
    const response = await h.verify(buildRequest({ signedTransaction: 'h.p.s', productId: 'resumely.exports.14' }));

    expect(response.status).toBe(200);
    expect(h.serviceRpc).toHaveBeenCalledWith('grant_apple_purchase', expect.objectContaining({ p_credits: 14 }));
  });

  it('still grants a paid but undelivered retired v1 pack', async () => {
    const h = loadHarness({
      transaction: { transactionId: 't10', productId: 'resumely.exports.10', type: 'Consumable', quantity: 1, appAccountToken: USER_ID },
      rpc: { grant_apple_purchase: { data: { status: 'granted', credits_granted: 10, balance: 13 }, error: null } },
    });
    const response = await h.verify(buildRequest({ signedTransaction: 'h.p.s', productId: 'resumely.exports.10' }));

    expect(response.status).toBe(200);
    expect(h.serviceRpc).toHaveBeenCalledWith('grant_apple_purchase', expect.objectContaining({ p_credits: 10 }));
  });
});

describe('POST /api/v1/iap/notifications for the Pro subscription', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renewalUpdated = { data: { status: 'updated', user_id: USER_ID, auto_renew_turned_off: false }, error: null };

  it('DID_RENEW moves the subscription forward and sends subscription_renewed', async () => {
    const h = loadHarness({
      notification: subscriptionNotification('DID_RENEW'),
      rpc: { upsert_subscription: { data: { status: 'renewed', user_id: USER_ID }, error: null }, update_subscription_renewal: renewalUpdated },
    });
    const response = await h.notify(buildRequest(notifyBody));

    expect(response.status).toBe(200);
    expect(h.serviceRpc).toHaveBeenCalledWith('upsert_subscription', expect.objectContaining({
      p_user_id: USER_ID,
      p_original_transaction_id: '3000000000000001',
      p_revoked_at: null,
    }));
    expect(h.serviceRpc).toHaveBeenCalledWith('update_subscription_renewal', {
      p_original_transaction_id: '3000000000000001',
      p_auto_renew: true,
      p_grace_until: null,
      p_signed_at: new Date(SIGNED).toISOString(),
    });
    expect(h.captureServerEvent).toHaveBeenCalledWith(USER_ID, 'subscription_renewed', {
      product_id: 'resumely.pro.monthly',
      environment: 'Sandbox',
      source: 'notification',
    });
    expect(h.serviceRpc).not.toHaveBeenCalledWith('apply_iap_refund', expect.anything());
  });

  it('a repeated DID_RENEW changes nothing and sends no event', async () => {
    const h = loadHarness({
      notification: subscriptionNotification('DID_RENEW'),
      rpc: { upsert_subscription: { data: { status: 'unchanged', user_id: USER_ID }, error: null }, update_subscription_renewal: renewalUpdated },
    });
    expect((await h.notify(buildRequest(notifyBody))).status).toBe(200);
    expect(h.captureServerEvent).not.toHaveBeenCalled();
  });

  it('SUBSCRIBED before the app reports it creates the row and sends subscription_started', async () => {
    const h = loadHarness({
      notification: subscriptionNotification('SUBSCRIBED', 'INITIAL_BUY'),
      rpc: { upsert_subscription: { data: { status: 'created', user_id: USER_ID }, error: null }, update_subscription_renewal: renewalUpdated },
    });
    expect((await h.notify(buildRequest(notifyBody))).status).toBe(200);
    expect(h.captureServerEvent).toHaveBeenCalledWith(USER_ID, 'subscription_started', {
      product_id: 'resumely.pro.monthly',
      environment: 'Sandbox',
      source: 'notification',
    });
  });

  it('auto-renew turned off sends subscription_cancelled once', async () => {
    const h = loadHarness({
      notification: subscriptionNotification('DID_CHANGE_RENEWAL_STATUS', 'AUTO_RENEW_DISABLED'),
      renewal: { ok: true, value: { autoRenewStatus: 0, signedDate: SIGNED }, environment: 'Sandbox' },
      rpc: {
        upsert_subscription: { data: { status: 'unchanged', user_id: USER_ID }, error: null },
        update_subscription_renewal: { data: { status: 'updated', user_id: USER_ID, auto_renew_turned_off: true }, error: null },
      },
    });
    expect((await h.notify(buildRequest(notifyBody))).status).toBe(200);
    expect(h.serviceRpc).toHaveBeenCalledWith('update_subscription_renewal', expect.objectContaining({ p_auto_renew: false }));
    expect(h.captureServerEvent).toHaveBeenCalledWith(USER_ID, 'subscription_cancelled', {
      product_id: 'resumely.pro.monthly',
      environment: 'Sandbox',
      reason: 'auto_renew_off',
    });
  });

  it('DID_FAIL_TO_RENEW in the grace period stores the grace end', async () => {
    const grace = Date.UTC(2026, 11, 15);
    const h = loadHarness({
      notification: subscriptionNotification('DID_FAIL_TO_RENEW', 'GRACE_PERIOD'),
      renewal: { ok: true, value: { autoRenewStatus: 1, gracePeriodExpiresDate: grace, signedDate: SIGNED }, environment: 'Sandbox' },
      rpc: { upsert_subscription: { data: { status: 'unchanged', user_id: USER_ID }, error: null }, update_subscription_renewal: renewalUpdated },
    });
    expect((await h.notify(buildRequest(notifyBody))).status).toBe(200);
    expect(h.serviceRpc).toHaveBeenCalledWith('update_subscription_renewal', {
      p_original_transaction_id: '3000000000000001',
      p_auto_renew: true,
      p_grace_until: new Date(grace).toISOString(),
      p_signed_at: new Date(SIGNED).toISOString(),
    });
    expect(h.captureServerEvent).not.toHaveBeenCalled();
  });

  it('EXPIRED sends subscription_cancelled with the expiry reason', async () => {
    const h = loadHarness({
      notification: subscriptionNotification('EXPIRED', 'VOLUNTARY'),
      renewal: { ok: true, value: { autoRenewStatus: 0, signedDate: SIGNED }, environment: 'Sandbox' },
      rpc: { upsert_subscription: { data: { status: 'unchanged', user_id: USER_ID }, error: null }, update_subscription_renewal: renewalUpdated },
    });
    expect((await h.notify(buildRequest(notifyBody))).status).toBe(200);
    expect(h.captureServerEvent).toHaveBeenCalledWith(USER_ID, 'subscription_cancelled', expect.objectContaining({ reason: 'expired_voluntary' }));
  });

  it('GRACE_PERIOD_EXPIRED sends subscription_cancelled', async () => {
    const h = loadHarness({
      notification: subscriptionNotification('GRACE_PERIOD_EXPIRED'),
      rpc: { upsert_subscription: { data: { status: 'unchanged', user_id: USER_ID }, error: null }, update_subscription_renewal: renewalUpdated },
    });
    expect((await h.notify(buildRequest(notifyBody))).status).toBe(200);
    expect(h.captureServerEvent).toHaveBeenCalledWith(USER_ID, 'subscription_cancelled', expect.objectContaining({ reason: 'grace_period_expired' }));
  });

  it('REFUND of a subscription revokes it through set_subscription_revocation, not the credit refund', async () => {
    const revokedAt = Date.UTC(2026, 10, 2);
    const h = loadHarness({
      notification: subscriptionNotification('REFUND'),
      transaction: { ...subscriptionTransaction, revocationDate: revokedAt },
      rpc: {
        upsert_subscription: { data: { status: 'unchanged', user_id: USER_ID }, error: null },
        set_subscription_revocation: { data: { status: 'revoked', user_id: USER_ID, active: false }, error: null },
        update_subscription_renewal: renewalUpdated,
      },
    });
    expect((await h.notify(buildRequest(notifyBody))).status).toBe(200);
    expect(h.serviceRpc).toHaveBeenCalledWith('set_subscription_revocation', {
      p_original_transaction_id: '3000000000000001',
      p_transaction_id: '3000000000000002',
      p_revoked_at: new Date(revokedAt).toISOString(),
      p_signed_at: new Date(NOTIFIED).toISOString(),
    });
    expect(h.serviceRpc).not.toHaveBeenCalledWith('apply_iap_refund', expect.anything());
    expect(h.captureServerEvent).toHaveBeenCalledWith(USER_ID, 'subscription_cancelled', expect.objectContaining({ reason: 'refunded' }));
  });

  it('REFUND_REVERSED clears the revocation, ordered by the notification signedDate', async () => {
    const h = loadHarness({
      notification: subscriptionNotification('REFUND_REVERSED'),
      rpc: {
        upsert_subscription: { data: { status: 'unchanged', user_id: USER_ID }, error: null },
        set_subscription_revocation: { data: { status: 'restored', user_id: USER_ID, active: true }, error: null },
        update_subscription_renewal: renewalUpdated,
      },
    });
    expect((await h.notify(buildRequest(notifyBody))).status).toBe(200);
    expect(h.serviceRpc).toHaveBeenCalledWith('set_subscription_revocation', expect.objectContaining({
      p_revoked_at: null,
      p_signed_at: new Date(NOTIFIED).toISOString(),
    }));
    expect(h.serviceRpc).not.toHaveBeenCalledWith('apply_iap_refund', expect.anything());
    expect(h.captureServerEvent).not.toHaveBeenCalledWith(USER_ID, 'subscription_cancelled', expect.anything());
  });

  it('a stale refund (older than a reversal already applied) sends no cancellation', async () => {
    const h = loadHarness({
      notification: subscriptionNotification('REFUND'),
      transaction: { ...subscriptionTransaction, revocationDate: Date.UTC(2026, 10, 2) },
      rpc: {
        upsert_subscription: { data: { status: 'unchanged', user_id: USER_ID }, error: null },
        set_subscription_revocation: { data: { status: 'stale', user_id: USER_ID, active: true }, error: null },
        update_subscription_renewal: renewalUpdated,
      },
    });
    expect((await h.notify(buildRequest(notifyBody))).status).toBe(200);
    expect(h.captureServerEvent).not.toHaveBeenCalled();
  });

  it('400 for a refund notification with no signedDate to order it by', async () => {
    const h = loadHarness({
      notification: { ...subscriptionNotification('REFUND'), signedDate: undefined },
      transaction: { ...subscriptionTransaction, revocationDate: Date.UTC(2026, 10, 2) },
      rpc: { upsert_subscription: { data: { status: 'unchanged', user_id: USER_ID }, error: null } },
    });
    expect((await h.notify(buildRequest(notifyBody))).status).toBe(400);
    expect(h.serviceRpc).not.toHaveBeenCalledWith('set_subscription_revocation', expect.anything());
  });

  it('500 when the revocation cannot be written, so Apple retries', async () => {
    const h = loadHarness({
      notification: subscriptionNotification('REFUND'),
      transaction: { ...subscriptionTransaction, revocationDate: Date.UTC(2026, 10, 2) },
      rpc: {
        upsert_subscription: { data: { status: 'unchanged', user_id: USER_ID }, error: null },
        set_subscription_revocation: { data: null, error: { message: 'boom' } },
      },
    });
    expect((await h.notify(buildRequest(notifyBody))).status).toBe(500);
  });

  it('a notification with no account token and no row is acknowledged and changes nothing', async () => {
    const h = loadHarness({
      notification: subscriptionNotification('DID_RENEW'),
      transaction: { ...subscriptionTransaction, appAccountToken: undefined },
      rpc: { upsert_subscription: { data: { status: 'unknown_owner' }, error: null } },
    });
    expect((await h.notify(buildRequest(notifyBody))).status).toBe(200);
    expect(h.serviceRpc).toHaveBeenCalledWith('upsert_subscription', expect.objectContaining({ p_user_id: null }));
    expect(h.serviceRpc).not.toHaveBeenCalledWith('update_subscription_renewal', expect.anything());
    expect(h.captureServerEvent).not.toHaveBeenCalled();
  });

  it('500 when the database fails, so Apple retries', async () => {
    const h = loadHarness({
      notification: subscriptionNotification('DID_RENEW'),
      rpc: { upsert_subscription: { data: null, error: { message: 'boom' } } },
    });
    expect((await h.notify(buildRequest(notifyBody))).status).toBe(500);
  });

  it('503 when the renewal info cannot be verified right now, after sending the renewal event once', async () => {
    const h = loadHarness({
      notification: subscriptionNotification('DID_RENEW'),
      renewal: { ok: false, reason: 'verification_unavailable' },
      rpc: { upsert_subscription: { data: { status: 'renewed', user_id: USER_ID }, error: null } },
    });
    expect((await h.notify(buildRequest(notifyBody))).status).toBe(503);
    // The retry will find the row unchanged, so the event cannot wait for it.
    expect(h.captureServerEvent).toHaveBeenCalledTimes(1);
    expect(h.captureServerEvent).toHaveBeenCalledWith(USER_ID, 'subscription_renewed', expect.anything());
    expect(h.serviceRpc).not.toHaveBeenCalledWith('update_subscription_renewal', expect.anything());
  });

  it('a late, older renewal info (stale) sends no cancellation', async () => {
    const h = loadHarness({
      notification: subscriptionNotification('DID_CHANGE_RENEWAL_STATUS', 'AUTO_RENEW_DISABLED'),
      renewal: { ok: true, value: { autoRenewStatus: 0, signedDate: SIGNED }, environment: 'Sandbox' },
      rpc: {
        upsert_subscription: { data: { status: 'unchanged', user_id: USER_ID }, error: null },
        update_subscription_renewal: { data: { status: 'stale', user_id: USER_ID, auto_renew_turned_off: false }, error: null },
      },
    });
    expect((await h.notify(buildRequest(notifyBody))).status).toBe(200);
    expect(h.captureServerEvent).not.toHaveBeenCalled();
  });

  it('400 when the renewal info has no signedDate to order it by', async () => {
    const h = loadHarness({
      notification: subscriptionNotification('DID_CHANGE_RENEWAL_STATUS', 'AUTO_RENEW_DISABLED'),
      renewal: { ok: true, value: { autoRenewStatus: 0 }, environment: 'Sandbox' },
      rpc: { upsert_subscription: { data: { status: 'unchanged', user_id: USER_ID }, error: null } },
    });
    expect((await h.notify(buildRequest(notifyBody))).status).toBe(400);
    expect(h.serviceRpc).not.toHaveBeenCalledWith('update_subscription_renewal', expect.anything());
  });

  it('still ignores notification types it does not handle', async () => {
    const h = loadHarness({ notification: subscriptionNotification('PRICE_INCREASE') });
    expect((await h.notify(buildRequest(notifyBody))).status).toBe(200);
    expect(h.serviceRpc).not.toHaveBeenCalled();
  });
});
