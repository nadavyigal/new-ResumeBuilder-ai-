import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient, createServiceRoleClient } from '@/lib/supabase-server';
import { captureServerEvent } from '@/lib/posthog-server';
import { createPaddleTransaction, getPaddleCheckoutConfig } from '@/lib/paddle';
import { checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from '@/lib/utils/rate-limit';

// The Paddle API call can take up to its 15 s timeout.
export const maxDuration = 30;

/**
 * POST /api/v1/web-checkout { priceId } (StoreKit spec 16.3 step 2).
 *
 * The server binds the buyer to the purchase: it creates the Paddle
 * transaction itself and records `paddle_checkouts (txn, user)` before the
 * browser ever sees the transaction ID. The webhook grants only to that user.
 * This route grants nothing; Paddle.js opens the returned transaction.
 */
export async function POST(request: NextRequest) {
  const config = getPaddleCheckoutConfig();
  if (!config) {
    return NextResponse.json({ error: 'paddle_unavailable' }, { status: 503 });
  }

  const supabase = await createRouteHandlerClient(request);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (user.is_anonymous) {
    return NextResponse.json({ error: 'account_required' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const priceId = typeof body?.priceId === 'string' ? body.priceId.trim() : '';
  if (!config.priceCredits.has(priceId)) {
    return NextResponse.json({ error: 'unknown_price' }, { status: 400 });
  }

  const rate = checkRateLimit(`web-checkout:${user.id}`, RATE_LIMITS.default);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please slow down and try again shortly.' },
      { status: 429, headers: getRateLimitHeaders(rate) }
    );
  }

  const created = await createPaddleTransaction(config, priceId, user.id);
  if (!created.ok) {
    console.error('Paddle transaction create failed', { status: created.status });
    return NextResponse.json({ error: 'paddle_checkout_failed' }, { status: 502 });
  }

  const serviceClient = createServiceRoleClient() as any;
  const { error } = await serviceClient.from('paddle_checkouts').insert({
    paddle_transaction_id: created.transactionId,
    user_id: user.id,
    price_id: priceId,
    environment: config.environment,
  });
  if (error) {
    // The transaction ID is never returned, so nobody can open or pay it; it
    // stays an unpaid draft in Paddle, and the webhook would answer `unbound`.
    console.error('paddle_checkouts insert failed', { details: error.message });
    return NextResponse.json({ error: 'checkout_unavailable' }, { status: 500 });
  }

  try {
    await captureServerEvent(user.id, 'web_checkout_opened', { price_id: priceId, platform: 'web', store: 'paddle' });
  } catch {
    // Analytics never blocks a checkout.
  }

  return NextResponse.json({ transactionId: created.transactionId });
}
