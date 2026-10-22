import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-server';
import { captureServerEvent } from '@/lib/posthog-server';
import {
  creditsForTransactionItems,
  decideAdjustment,
  getPaddleWebhookConfig,
  verifyPaddleSignature,
} from '@/lib/paddle';

/**
 * POST /api/v1/paddle/webhook (StoreKit spec 16.4 and 16.5).
 *
 * Paddle retries any non-2xx, so this answers 2xx only when the event is
 * handled or deliberately ignored, and 500 when the database failed. Nothing
 * from the body is trusted before the signature check, and the user always
 * comes from `paddle_checkouts`, never from `custom_data`.
 */

type PaddleEvent = {
  event_id?: unknown;
  event_type?: unknown;
  data?: Record<string, unknown> | null;
};

const ok = () => NextResponse.json({ received: true });

/**
 * Analytics never decides the response: a PostHog failure after a committed
 * grant must not turn into a 500 that Paddle retries forever.
 */
async function track(distinctId: string, event: string, properties: Record<string, unknown>) {
  try {
    await captureServerEvent(distinctId, event, properties);
  } catch (error) {
    console.warn('PostHog capture failed', { event, details: error instanceof Error ? error.message : String(error) });
  }
}

function reject(reason: 'signature' | 'stale' | 'config', status: number) {
  // Not awaited: unauthenticated callers must not be able to slow this route
  // or hold it on an analytics flush.
  void track('server', 'paddle_webhook_rejected', { reason });
  return NextResponse.json({ error: reason === 'config' ? 'paddle_unavailable' : 'invalid_signature' }, { status });
}

export async function POST(request: NextRequest) {
  // Step 1: configuration. Nothing changes without it.
  const config = getPaddleWebhookConfig();
  if (!config) return reject('config', 503);

  // Step 2: the raw body, before any parsing.
  const rawBody = await request.text();

  // Steps 3 and 4: signature and age.
  const signature = verifyPaddleSignature(rawBody, request.headers.get('paddle-signature'), config.webhookSecret);
  if (!signature.ok) return reject(signature.reason, 401);

  // Step 5: parse; an event already handled changes nothing.
  let event: PaddleEvent;
  try {
    event = JSON.parse(rawBody) as PaddleEvent;
  } catch {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }
  const eventId = typeof event.event_id === 'string' ? event.event_id : '';
  const eventType = typeof event.event_type === 'string' ? event.event_type : '';
  const data = event.data && typeof event.data === 'object' ? event.data : null;
  if (!eventId || !eventType || !data) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  const supabase = createServiceRoleClient() as any;
  const seen = await supabase.from('paddle_events').select('event_id').eq('event_id', eventId).maybeSingle();
  if (seen.error) {
    console.error('paddle_events read failed', { eventType, details: seen.error.message });
    return NextResponse.json({ error: 'database_unavailable' }, { status: 500 });
  }
  if (seen.data) return ok();

  // Step 6: route by type. Each handler returns false when Paddle should retry.
  let handled: boolean;
  if (eventType === 'transaction.completed') {
    handled = await handleTransactionCompleted(supabase, data, config.priceCredits, config.environment);
  } else if (eventType === 'adjustment.created' || eventType === 'adjustment.updated') {
    handled = await handleAdjustment(supabase, data, config.priceCredits, config.environment);
  } else {
    console.info('Paddle event ignored', { eventType });
    handled = true;
  }
  if (!handled) {
    return NextResponse.json({ error: 'processing_failed' }, { status: 500 });
  }

  // Written after handling, so an event that failed half way runs again on retry.
  // The ledger keys keep the handling itself idempotent, so a failed write here
  // only means a harmless repeat later.
  const recorded = await supabase
    .from('paddle_events')
    .upsert({ event_id: eventId, event_type: eventType }, { onConflict: 'event_id', ignoreDuplicates: true });
  if (recorded.error) {
    console.warn('paddle_events write failed after handling', { eventType, details: recorded.error.message });
  }
  return ok();
}

async function handleTransactionCompleted(
  supabase: any,
  data: Record<string, unknown>,
  priceCredits: ReadonlyMap<string, number>,
  environment: 'Production' | 'Sandbox'
): Promise<boolean> {
  const transactionId = typeof data.id === 'string' ? data.id : '';
  if (!transactionId) return true;

  // 16.4.1 step 1: the user comes from the checkout this server opened.
  const checkout = await supabase
    .from('paddle_checkouts')
    .select('user_id, environment')
    .eq('paddle_transaction_id', transactionId)
    .maybeSingle();
  if (checkout.error) {
    console.error('paddle_checkouts read failed', { details: checkout.error.message });
    return false;
  }
  const customData = data.custom_data && typeof data.custom_data === 'object' ? (data.custom_data as Record<string, unknown>) : null;
  const claimedUser = typeof customData?.user_id === 'string' ? customData.user_id : null;
  if (!checkout.data?.user_id || (claimedUser && claimedUser !== checkout.data.user_id)) {
    // Not opened by this server, or custom_data disagrees: grant nothing.
    // The founder refunds by hand.
    console.warn('paddle_unbound_transaction', { hasCheckout: Boolean(checkout.data), customDataMismatch: Boolean(claimedUser) });
    await track('server', 'paddle_webhook_rejected', { reason: 'unbound_transaction' });
    return true;
  }
  const userId: string = checkout.data.user_id;
  if (checkout.data.environment !== environment) {
    // A checkout opened in the other Paddle environment (for example a sandbox
    // preview that shares this database): never let one credit the other.
    console.warn('Paddle event environment does not match its checkout; ignored', { environment });
    await track('server', 'paddle_webhook_rejected', { reason: 'environment_mismatch' });
    return true;
  }

  // 16.4.1 step 2: credits from the price map, never from the body's amounts.
  const { credits, firstPriceId, unknownPriceIds } = creditsForTransactionItems(data.items, priceCredits);
  if (unknownPriceIds.length > 0) {
    console.warn('Paddle transaction has unknown price IDs; they grant nothing', { count: unknownPriceIds.length });
  }
  if (credits <= 0 || !firstPriceId) return true;

  // 16.4.1 step 3: one transaction ID, one grant, ever.
  const { data: result, error } = await supabase.rpc('grant_paddle_credits', {
    p_user_id: userId,
    p_delta: credits,
    p_paddle_transaction_id: transactionId,
    p_price_id: firstPriceId,
    p_environment: environment,
  });
  if (error) {
    console.error('grant_paddle_credits failed', { details: error.message });
    return false;
  }
  const status = (result as { status?: unknown } | null)?.status;
  if (status === 'granted' || status === 'already_granted') {
    await track(userId, 'paddle_purchase_granted', {
      price_id: firstPriceId,
      credits_granted: credits,
      environment,
      status,
      platform: 'web',
      store: 'paddle',
    });
  } else {
    console.warn('grant_paddle_credits did not grant', { status });
  }
  return true;
}

async function handleAdjustment(
  supabase: any,
  data: Record<string, unknown>,
  priceCredits: ReadonlyMap<string, number>,
  environment: 'Production' | 'Sandbox'
): Promise<boolean> {
  const adjustmentId = typeof data.id === 'string' ? data.id : '';
  const transactionId = typeof data.transaction_id === 'string' ? data.transaction_id : '';
  if (!adjustmentId || !transactionId) return true;

  const decision = decideAdjustment(data);
  if (!decision.act) {
    console.info('Paddle adjustment logged, no credit change', { why: decision.why });
    return true;
  }

  // A whole refunded or charged-back item is the checkout's whole pack: one
  // price at quantity 1 (16.3 step 2). The database caps the deduction at what
  // the grant still has outstanding and at the balance.
  const checkout = await supabase
    .from('paddle_checkouts')
    .select('price_id, environment')
    .eq('paddle_transaction_id', transactionId)
    .maybeSingle();
  if (checkout.error) {
    console.error('paddle_checkouts read failed', { details: checkout.error.message });
    return false;
  }
  if (checkout.data && checkout.data.environment !== environment) {
    console.warn('Paddle adjustment environment does not match its checkout; ignored', { environment });
    await track('server', 'paddle_webhook_rejected', { reason: 'environment_mismatch' });
    return true;
  }
  const grantRow = await supabase
    .from('credit_transactions')
    .select('delta')
    .eq('paddle_transaction_id', transactionId)
    .maybeSingle();
  if (grantRow.error) {
    console.error('credit_transactions read failed', { details: grantRow.error.message });
    return false;
  }
  // The grant's own amount when it exists, else the pack the checkout was opened for.
  const packCredits =
    (typeof grantRow.data?.delta === 'number' ? grantRow.data.delta : null) ??
    (checkout.data?.price_id ? priceCredits.get(checkout.data.price_id) ?? 0 : 0);

  const { data: result, error } = await supabase.rpc('apply_paddle_adjustment', {
    p_paddle_transaction_id: transactionId,
    p_paddle_adjustment_id: adjustmentId,
    p_action: decision.action,
    p_credits: packCredits,
  });
  if (error) {
    console.error('apply_paddle_adjustment failed', { details: error.message });
    return false;
  }

  const outcome = (result ?? {}) as { status?: unknown; user_id?: unknown; credits_changed?: unknown };
  if ((outcome.status === 'deducted' || outcome.status === 'reversed') && typeof outcome.user_id === 'string') {
    const changed = typeof outcome.credits_changed === 'number' ? outcome.credits_changed : 0;
    await track(outcome.user_id, 'paddle_adjustment_processed', {
      action: decision.action,
      credits_deducted: -changed,
      environment,
      platform: 'web',
      store: 'paddle',
    });
  } else if (outcome.status === 'unbound') {
    console.warn('Paddle adjustment for a transaction this server never opened', { action: decision.action });
  }
  return true;
}
