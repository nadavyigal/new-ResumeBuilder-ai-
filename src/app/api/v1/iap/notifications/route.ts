import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-server';
import {
  getAppleIapConfig,
  verifySignedNotification,
  verifySignedRenewalInfo,
  verifySignedTransaction,
  type AppleEnvironment,
  type AppleIapConfig,
} from '@/lib/iap';
import type {
  JWSTransactionDecodedPayload,
  ResponseBodyV2DecodedPayload,
} from '@apple/app-store-server-library';
import { captureServerEvent } from '@/lib/posthog-server';

// Apple's revocation checks (OCSP) can take a few seconds on a cold start.
export const maxDuration = 60;

/**
 * App Store Server Notifications V2 (StoreKit spec section 8). The URL is set
 * in App Store Connect by the founder.
 *
 * Apple retries any non-2xx, so this route answers 2xx only when the
 * notification is handled or deliberately ignored, 500 when the database
 * failed, and 400 for anything that does not verify (nothing changes).
 * `apply_iap_refund` keys on `notificationUUID`, so a retry is a no-op.
 *
 * Pricing v2: subscription notifications update the Pro entitlement through
 * `upsert_subscription` and `update_subscription_renewal`, which are safe to
 * repeat and to receive out of order, and send the subscription funnel events.
 */
const REFUND_TYPES = new Set(['REFUND', 'REFUND_REVERSED']);
const SUBSCRIPTION_TYPES = new Set([
  'SUBSCRIBED',
  'DID_RENEW',
  'DID_CHANGE_RENEWAL_STATUS',
  'DID_FAIL_TO_RENEW',
  'EXPIRED',
  'GRACE_PERIOD_EXPIRED',
  'REFUND',
  'REFUND_REVERSED',
  'REVOKE',
]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const config = getAppleIapConfig();
  if (!config) {
    return NextResponse.json({ error: 'iap_verification_unavailable' }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const signedPayload = typeof body?.signedPayload === 'string' ? body.signedPayload.trim() : '';
  if (!signedPayload) {
    return NextResponse.json({ error: 'invalid_notification' }, { status: 400 });
  }

  const verified = await verifySignedNotification(signedPayload, config);
  if (!verified.ok) {
    if (verified.reason === 'verification_unavailable') {
      return NextResponse.json({ error: 'iap_verification_unavailable' }, { status: 503 });
    }
    if (verified.reason === 'environment_not_allowed') {
      console.warn('App Store notification from an environment that is not allowed; ignored');
      return NextResponse.json({ received: true });
    }
    return NextResponse.json({ error: 'invalid_notification' }, { status: 400 });
  }

  const notification = verified.value;
  const type = notification.notificationType ?? '';
  if (!REFUND_TYPES.has(type) && !SUBSCRIPTION_TYPES.has(type)) {
    // CONSUMPTION_REQUEST is logged only in v1 (spec 8); so is everything else.
    console.info('App Store notification ignored', { type, subtype: notification.subtype });
    return NextResponse.json({ received: true });
  }

  const notificationUUID = notification.notificationUUID ?? '';
  const signedTransactionInfo = notification.data?.signedTransactionInfo ?? '';
  if (!signedTransactionInfo) {
    return NextResponse.json({ error: 'invalid_notification' }, { status: 400 });
  }

  const transactionResult = await verifySignedTransaction(signedTransactionInfo, config);
  if (!transactionResult.ok) {
    const status = transactionResult.reason === 'verification_unavailable' ? 503 : 400;
    return NextResponse.json({ error: 'invalid_notification' }, { status });
  }

  if (transactionResult.value.type === 'Auto-Renewable Subscription') {
    return handleSubscriptionNotification({
      notification,
      type,
      transaction: transactionResult.value,
      environment: transactionResult.environment,
      config,
    });
  }

  if (!REFUND_TYPES.has(type)) {
    console.info('Subscription notification for a non-subscription transaction ignored', { type });
    return NextResponse.json({ received: true });
  }
  if (!notificationUUID) {
    return NextResponse.json({ error: 'invalid_notification' }, { status: 400 });
  }
  const transactionId = transactionResult.value.transactionId ?? '';
  if (!transactionId) {
    return NextResponse.json({ error: 'invalid_notification' }, { status: 400 });
  }

  const reversed = type === 'REFUND_REVERSED';
  const serviceClient = createServiceRoleClient();
  const { data, error } = await (serviceClient as any).rpc('apply_iap_refund', {
    p_apple_transaction_id: transactionId,
    p_notification_uuid: notificationUUID,
    p_reversed: reversed,
  });
  if (error) {
    console.error('apply_iap_refund failed', { type, details: error.message });
    return NextResponse.json({ error: 'refund_failed' }, { status: 500 });
  }

  const result = (data ?? {}) as {
    status?: unknown;
    user_id?: unknown;
    credits_changed?: unknown;
    product_id?: unknown;
    environment?: unknown;
  };
  if (result.status === 'recorded_before_grant') {
    // No grant yet. The refund is remembered, so a later /verify of the same
    // transaction is refused (a REFUND_REVERSED clears it).
    console.warn('Refund notification before any grant; recorded', { type });
    return NextResponse.json({ received: true });
  }

  if ((result.status === 'refunded' || result.status === 'reversed') && typeof result.user_id === 'string') {
    const changed = typeof result.credits_changed === 'number' ? result.credits_changed : 0;
    await captureServerEvent(result.user_id, 'iap_refund_processed', {
      product_id: typeof result.product_id === 'string' ? result.product_id : null,
      // Positive for a refund, negative when a reversal gives credits back.
      credits_deducted: -changed,
      environment: typeof result.environment === 'string' ? result.environment : verified.environment,
      notification_type: type,
    });
  }

  return NextResponse.json({ received: true });
}

/**
 * Pricing v2: one subscription notification. The owner comes from the signed
 * transaction's appAccountToken, or from the existing row when Apple sent no
 * token; a subscription is never moved to another account here.
 */
async function handleSubscriptionNotification({
  notification,
  type,
  transaction,
  environment,
  config,
}: {
  notification: ResponseBodyV2DecodedPayload;
  type: string;
  transaction: JWSTransactionDecodedPayload;
  environment: AppleEnvironment;
  config: AppleIapConfig;
}) {
  const originalTransactionId = transaction.originalTransactionId ?? '';
  const transactionId = transaction.transactionId ?? '';
  if (!originalTransactionId || !transactionId || !transaction.purchaseDate || !transaction.expiresDate) {
    return NextResponse.json({ error: 'invalid_notification' }, { status: 400 });
  }
  const token = transaction.appAccountToken ?? '';
  const productId = transaction.productId ?? '';

  const serviceClient = createServiceRoleClient();
  const { data, error } = await (serviceClient as any).rpc('upsert_subscription', {
    p_user_id: UUID_PATTERN.test(token) ? token.toLowerCase() : null,
    p_original_transaction_id: originalTransactionId,
    p_transaction_id: transactionId,
    p_product_id: productId,
    p_purchase_date: new Date(transaction.purchaseDate).toISOString(),
    p_expires_at: new Date(transaction.expiresDate).toISOString(),
    p_revoked_at: transaction.revocationDate ? new Date(transaction.revocationDate).toISOString() : null,
    p_environment: environment,
  });
  if (error) {
    console.error('upsert_subscription failed', { type, details: error.message });
    return NextResponse.json({ error: 'subscription_update_failed' }, { status: 500 });
  }

  const result = (data ?? {}) as { status?: unknown; user_id?: unknown };
  if (result.status === 'unknown_owner' || result.status === 'owned_by_other_account') {
    // No account to credit yet (the app records it through /verify), or the
    // token names another account than the buyer. Nothing changes.
    console.warn('Subscription notification not applied', { type, status: result.status });
    return NextResponse.json({ received: true });
  }
  const userId = typeof result.user_id === 'string' ? result.user_id : null;
  const base = { product_id: productId, environment };

  // Events that follow from the transaction go out now, before the renewal
  // info step can fail: a retry finds the row unchanged and would never send
  // them (Codex P2 on #204). Whichever request records a renewal first, this
  // one or /verify, gets 'renewed' and sends subscription_renewed, once.
  if (userId) {
    if (result.status === 'created') {
      await captureServerEvent(userId, 'subscription_started', { ...base, source: 'notification' });
    }
    if (result.status === 'renewed') {
      await captureServerEvent(userId, 'subscription_renewed', { ...base, source: 'notification' });
    }
  }

  // Refunds and their reversals: only here, from a verified notification,
  // ordered by its signedDate (Codex P1 and P2 on #204).
  if (type === 'REFUND' || type === 'REVOKE' || type === 'REFUND_REVERSED') {
    const signedAt = notification.signedDate;
    if (!signedAt) {
      return NextResponse.json({ error: 'invalid_notification' }, { status: 400 });
    }
    const reversed = type === 'REFUND_REVERSED';
    const revokedAt = transaction.revocationDate ?? signedAt;
    const { data: revocationData, error: revocationError } = await (serviceClient as any).rpc(
      'set_subscription_revocation',
      {
        p_original_transaction_id: originalTransactionId,
        p_transaction_id: transactionId,
        p_revoked_at: reversed ? null : new Date(revokedAt).toISOString(),
        p_signed_at: new Date(signedAt).toISOString(),
      }
    );
    if (revocationError) {
      console.error('set_subscription_revocation failed', { type, details: revocationError.message });
      return NextResponse.json({ error: 'subscription_update_failed' }, { status: 500 });
    }
    const revocationStatus = (revocationData as { status?: unknown } | null)?.status;
    if (userId && revocationStatus === 'revoked') {
      await captureServerEvent(userId, 'subscription_cancelled', {
        ...base,
        reason: type === 'REVOKE' ? 'revoked' : 'refunded',
      });
    }
  }

  let autoRenewTurnedOff = false;
  const signedRenewalInfo = notification.data?.signedRenewalInfo ?? '';
  if (signedRenewalInfo) {
    const renewal = await verifySignedRenewalInfo(signedRenewalInfo, config);
    if (!renewal.ok) {
      const status = renewal.reason === 'verification_unavailable' ? 503 : 400;
      return NextResponse.json({ error: 'invalid_notification' }, { status });
    }
    const autoRenewStatus = renewal.value.autoRenewStatus;
    const grace = renewal.value.gracePeriodExpiresDate;
    const signedDate = renewal.value.signedDate;
    if (!signedDate) {
      return NextResponse.json({ error: 'invalid_notification' }, { status: 400 });
    }
    const { data: renewalData, error: renewalError } = await (serviceClient as any).rpc('update_subscription_renewal', {
      p_original_transaction_id: originalTransactionId,
      p_auto_renew: autoRenewStatus === 1 ? true : autoRenewStatus === 0 ? false : null,
      p_grace_until: grace ? new Date(grace).toISOString() : null,
      p_signed_at: new Date(signedDate).toISOString(),
    });
    if (renewalError) {
      console.error('update_subscription_renewal failed', { type, details: renewalError.message });
      return NextResponse.json({ error: 'subscription_update_failed' }, { status: 500 });
    }
    autoRenewTurnedOff = (renewalData as { auto_renew_turned_off?: unknown } | null)?.auto_renew_turned_off === true;
  }

  if (userId) {
    if (autoRenewTurnedOff) {
      await captureServerEvent(userId, 'subscription_cancelled', { ...base, reason: 'auto_renew_off' });
    }
    if (type === 'GRACE_PERIOD_EXPIRED') {
      await captureServerEvent(userId, 'subscription_cancelled', { ...base, reason: 'grace_period_expired' });
    }
    if (type === 'EXPIRED') {
      const subtype = typeof notification.subtype === 'string' ? notification.subtype.toLowerCase() : 'unknown';
      await captureServerEvent(userId, 'subscription_cancelled', { ...base, reason: `expired_${subtype}` });
    }
  }

  return NextResponse.json({ received: true });
}
