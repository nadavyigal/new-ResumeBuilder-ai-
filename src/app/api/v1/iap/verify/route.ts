import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient, createServiceRoleClient } from '@/lib/supabase-server';
import {
  creditsForProduct,
  getAppleIapConfig,
  isKnownProduct,
  isSubscriptionProduct,
  verifySignedTransaction,
} from '@/lib/iap';
import { captureServerEvent } from '@/lib/posthog-server';
import type { AppleEnvironment } from '@/lib/iap';
import type { JWSTransactionDecodedPayload } from '@apple/app-store-server-library';

// Apple's revocation checks (OCSP) can take a few seconds on a cold start.
export const maxDuration = 60;

/**
 * Grants export credits for a verified StoreKit 2 purchase (StoreKit spec 7.2),
 * or records a verified Pro subscription transaction (pricing v2: the app sends
 * new purchases, renewals and `Transaction.currentEntitlements` on restore).
 * Every check runs, in order; any failure grants nothing. The amount comes
 * from the signed transaction, never from the request body. The app calls
 * `transaction.finish()` only after a 200 here, and re-sends unfinished
 * transactions at launch, so a repeat must be safe: one transaction ID grants
 * once, ever (`grant_apple_purchase`).
 */

type FailureReason =
  | 'iap_verification_unavailable'
  | 'invalid_request'
  | 'invalid_transaction'
  | 'environment_not_allowed'
  | 'unknown_product'
  | 'product_mismatch'
  | 'account_mismatch'
  | 'transaction_revoked'
  | 'transaction_owned_by_another_account'
  | 'subscription_owned_by_another_account'
  | 'failed_to_grant_credits'
  | 'failed_to_record_subscription';

async function fail(
  reason: FailureReason,
  status: number,
  distinctId: string,
  productId?: string
) {
  // Only a product from the section 4 mapping reaches analytics; anything the
  // client typed before the signature check stays out.
  await captureServerEvent(distinctId, 'iap_verify_failed', {
    reason,
    ...(productId && isKnownProduct(productId) ? { product_id: productId } : {}),
  });
  return NextResponse.json({ error: reason }, { status });
}

export async function POST(request: NextRequest) {
  // Check 1: configuration. Never grant without a real verifier.
  const config = getAppleIapConfig();
  if (!config) {
    return fail('iap_verification_unavailable', 503, 'server');
  }

  // Check 2: a signed-in, non-anonymous account.
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
  const signedTransaction = typeof body?.signedTransaction === 'string' ? body.signedTransaction.trim() : '';
  const requestedProductId = typeof body?.productId === 'string' ? body.productId : '';
  if (!signedTransaction || !requestedProductId) {
    return fail('invalid_request', 400, user.id);
  }

  // Checks 3 and 4: Apple's signature chain, bundle, App Apple ID, environment.
  const verified = await verifySignedTransaction(signedTransaction, config);
  if (!verified.ok) {
    if (verified.reason === 'verification_unavailable') {
      // Apple's revocation check could not run. The app keeps the transaction
      // unfinished and retries; nothing is granted.
      return fail('iap_verification_unavailable', 503, user.id, requestedProductId);
    }
    return fail(verified.reason, 400, user.id, requestedProductId);
  }
  const transaction = verified.value;
  const productId = transaction.productId ?? '';
  const transactionId = transaction.transactionId ?? '';
  if (!transactionId) {
    return fail('invalid_transaction', 400, user.id, requestedProductId);
  }

  if (transaction.type === 'Auto-Renewable Subscription' && isSubscriptionProduct(productId)) {
    return recordSubscription({ transaction, productId, requestedProductId, user, environment: verified.environment });
  }

  // Check 5: a consumable from the section 4 mapping, the one the app asked for.
  const creditsPerUnit = creditsForProduct(productId);
  if (transaction.type !== 'Consumable' || !creditsPerUnit) {
    return fail('unknown_product', 400, user.id, productId || requestedProductId);
  }
  if (productId !== requestedProductId) {
    return fail('product_mismatch', 400, user.id, productId);
  }

  // Check 6: bought under this account (purchase(options: [.appAccountToken(userId)])).
  if (!transaction.appAccountToken || transaction.appAccountToken.toLowerCase() !== user.id.toLowerCase()) {
    return fail('account_mismatch', 403, user.id, productId);
  }

  // Check 7: not refunded or revoked.
  if (transaction.revocationDate) {
    return fail('transaction_revoked', 409, user.id, productId);
  }

  const quantity = Number.isInteger(transaction.quantity) && (transaction.quantity as number) > 0
    ? (transaction.quantity as number)
    : 1;
  const credits = creditsPerUnit * quantity;

  // Check 8: grant once. grant_apple_purchase is SECURITY DEFINER and trusts
  // p_user_id, so it runs on a service-role client with the user from getUser().
  const serviceClient = createServiceRoleClient();
  const { data, error } = await (serviceClient as any).rpc('grant_apple_purchase', {
    p_user_id: user.id,
    p_apple_transaction_id: transactionId,
    p_product_id: productId,
    p_credits: credits,
    p_environment: verified.environment,
  });
  if (error) {
    console.error('grant_apple_purchase failed', { productId, details: error.message });
    return fail('failed_to_grant_credits', 500, user.id, productId);
  }

  const result = (data ?? {}) as { status?: unknown; balance?: unknown; credits_granted?: unknown };
  if (result.status === 'revoked') {
    // Apple refunded this purchase before it was ever granted (a replay of the
    // pre-refund signed transaction). apply_iap_refund recorded it.
    return fail('transaction_revoked', 409, user.id, productId);
  }
  if (result.status === 'owned_by_other_account') {
    // Unreachable for purchases under this spec (check 6); guards pre-spec ledger rows.
    return fail('transaction_owned_by_another_account', 409, user.id, productId);
  }
  if (result.status !== 'granted' && result.status !== 'already_granted') {
    console.error('grant_apple_purchase returned an unexpected status', { status: result.status });
    return fail('failed_to_grant_credits', 500, user.id, productId);
  }

  const creditsGranted = typeof result.credits_granted === 'number' ? result.credits_granted : credits;
  await captureServerEvent(user.id, 'iap_verified', {
    product_id: productId,
    credits_granted: creditsGranted,
    environment: verified.environment,
    status: result.status,
  });

  return NextResponse.json({
    success: true,
    status: result.status,
    creditsGranted,
    balance: typeof result.balance === 'number' ? result.balance : null,
  });
}

/**
 * Pricing v2: a verified Pro subscription transaction. Checks 5 to 7 match the
 * consumable path; check 8 is `upsert_subscription`, which keeps one row per
 * original transaction on the account that bought it. An expired transaction
 * is recorded too (a restore can send one), and answers `active: false`, so
 * the app can finish it.
 */
async function recordSubscription({
  transaction,
  productId,
  requestedProductId,
  user,
  environment,
}: {
  transaction: JWSTransactionDecodedPayload;
  productId: string;
  requestedProductId: string;
  user: { id: string };
  environment: AppleEnvironment;
}) {
  if (productId !== requestedProductId) {
    return fail('product_mismatch', 400, user.id, productId);
  }
  if (!transaction.appAccountToken || transaction.appAccountToken.toLowerCase() !== user.id.toLowerCase()) {
    return fail('account_mismatch', 403, user.id, productId);
  }
  if (transaction.revocationDate) {
    return fail('transaction_revoked', 409, user.id, productId);
  }
  const originalTransactionId = transaction.originalTransactionId ?? '';
  const transactionId = transaction.transactionId ?? '';
  if (!originalTransactionId || !transactionId || !transaction.purchaseDate || !transaction.expiresDate) {
    return fail('invalid_transaction', 400, user.id, productId);
  }

  const serviceClient = createServiceRoleClient();
  const { data, error } = await (serviceClient as any).rpc('upsert_subscription', {
    p_user_id: user.id,
    p_original_transaction_id: originalTransactionId,
    p_transaction_id: transactionId,
    p_product_id: productId,
    p_purchase_date: new Date(transaction.purchaseDate).toISOString(),
    p_expires_at: new Date(transaction.expiresDate).toISOString(),
    p_revoked_at: null,
    p_environment: environment,
  });
  if (error) {
    console.error('upsert_subscription failed', { productId, details: error.message });
    return fail('failed_to_record_subscription', 500, user.id, productId);
  }

  const result = (data ?? {}) as { status?: unknown; active?: unknown; expires_at?: unknown };
  if (result.status === 'owned_by_other_account') {
    // Restore Purchases on a second Resumely account: the plan stays with the buyer.
    return fail('subscription_owned_by_another_account', 409, user.id, productId);
  }
  if (typeof result.status !== 'string' || result.status === 'unknown_owner') {
    console.error('upsert_subscription returned an unexpected status', { status: result.status });
    return fail('failed_to_record_subscription', 500, user.id, productId);
  }

  const active = result.active === true;
  const expiresAt = typeof result.expires_at === 'string' ? result.expires_at : null;
  await captureServerEvent(user.id, 'iap_verified', {
    product_id: productId,
    credits_granted: 0,
    environment,
    status: result.status,
    kind: 'subscription',
  });
  if (result.status === 'created') {
    await captureServerEvent(user.id, 'subscription_started', { product_id: productId, environment, source: 'verify' });
  }

  return NextResponse.json({
    success: true,
    status: result.status === 'created' ? 'granted' : 'already_granted',
    creditsGranted: 0,
    balance: null,
    entitlement: { active, productId, expiresAt },
  });
}
