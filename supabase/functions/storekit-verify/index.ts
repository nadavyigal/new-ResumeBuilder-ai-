// supabase/functions/storekit-verify/index.ts
// Plan 3: StoreKit Paywall — receipt verification edge function
//
// GATED: Skeleton only. Complete implementation when gate opens (EXD-009):
//   1. CFO validates prices
//   2. D7 activation data readable in PostHog
//   3. Engineering spec written and approved
//
// Architecture:
//   POST { originalTransactionID, userID, productID }
//   → Verifies with Apple App Store Server API
//   → Upserts iap_purchases row (idempotent via transaction_id UNIQUE)
//   → Updates user_credits (credits or unlimited flag)
//   → Returns { success: true, creditsGranted, isUnlimited }
//
// Product ID → credits map (matches PurchaseTier.swift):
//   com.resumely.export.single   → 1 credit
//   com.resumely.export.pack5    → 5 credits
//   com.resumely.export.pack10   → 10 credits
//   com.resumely.unlimited.monthly → is_unlimited = true (expires in 30d)
//   com.resumely.unlimited.annual  → is_unlimited = true (expires in 365d)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CREDITS_BY_PRODUCT: Record<string, number> = {
  'com.resumely.export.single': 1,
  'com.resumely.export.pack5': 5,
  'com.resumely.export.pack10': 10,
};

const SUBSCRIPTION_PRODUCTS = new Set([
  'com.resumely.unlimited.monthly',
  'com.resumely.unlimited.annual',
]);

const UNLIMITED_DURATION_DAYS: Record<string, number> = {
  'com.resumely.unlimited.monthly': 30,
  'com.resumely.unlimited.annual': 365,
};

serve(async (req) => {
  // TODO: Implement when gate opens.
  // Steps:
  // 1. Parse and validate request body
  // 2. Authenticate user via Supabase auth header
  // 3. Call Apple App Store Server API to verify originalTransactionID
  //    Endpoint: https://api.storekit.itunes.apple.com/inApps/v1/transactions/{transactionId}
  //    (sandbox: api.storekit-sandbox.itunes.apple.com)
  // 4. On valid verification:
  //    a. Upsert iap_purchases (unique on transaction_id — idempotent)
  //    b. Update user_credits:
  //       - credit product: increment export_credits by creditsGranted
  //       - subscription: set is_unlimited = true, unlimited_expires_at = now() + duration
  // 5. Return { success: true, creditsGranted, isUnlimited }

  return new Response(
    JSON.stringify({ error: 'Not implemented — gate condition not met (EXD-009)' }),
    { status: 501, headers: { 'Content-Type': 'application/json' } }
  );
});
