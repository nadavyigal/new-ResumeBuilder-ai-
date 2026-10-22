import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-server';
import { getAppleIapConfig, verifySignedNotification, verifySignedTransaction } from '@/lib/iap';
import { captureServerEvent } from '@/lib/posthog-server';

/**
 * App Store Server Notifications V2 (StoreKit spec section 8). The URL is set
 * in App Store Connect by the founder.
 *
 * Apple retries any non-2xx, so this route answers 2xx only when the
 * notification is handled or deliberately ignored, 500 when the database
 * failed, and 400 for anything that does not verify (nothing changes).
 * `apply_iap_refund` keys on `notificationUUID`, so a retry is a no-op.
 */
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
  const type = notification.notificationType;
  if (type !== 'REFUND' && type !== 'REFUND_REVERSED') {
    // CONSUMPTION_REQUEST is logged only in v1 (spec 8); so is everything else.
    console.info('App Store notification ignored', { type, subtype: notification.subtype });
    return NextResponse.json({ received: true });
  }

  const notificationUUID = notification.notificationUUID ?? '';
  const signedTransactionInfo = notification.data?.signedTransactionInfo ?? '';
  if (!notificationUUID || !signedTransactionInfo) {
    return NextResponse.json({ error: 'invalid_notification' }, { status: 400 });
  }

  const transactionResult = await verifySignedTransaction(signedTransactionInfo, config);
  if (!transactionResult.ok) {
    const status = transactionResult.reason === 'verification_unavailable' ? 503 : 400;
    return NextResponse.json({ error: 'invalid_notification' }, { status });
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
  if (result.status === 'no_grant') {
    // A purchase this server never granted (for example made before S3). Nothing to take back.
    console.warn('Refund notification for a transaction with no grant', { type });
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
