# Quickstart Guide: Credit-Based Pricing System

**Feature**: Epic 5 - Credit-Based Pricing System  
**Estimated Time**: 3 weeks (15 working days)  
**Date**: October 26, 2025

## Overview

Guide to implementing a complete credit-based pricing and monetization system for Resume Builder AI, replacing the current freemium model with a flexible credits-and-bundles approach.

## Prerequisites

- Next.js 14+ application with App Router
- Supabase database with `profiles` table
- Stripe account (test mode for development)
- TypeScript
- React

## Week 1: Foundation (Days 1-5)

### Day 1: Database Schema Setup

**Tasks**:
1. Create migration file: `supabase/migrations/YYYYMMDD_add_credit_system.sql`
2. Add columns to `profiles` table:
   - `credit_balance DECIMAL(10,2) DEFAULT 3.00`
   - `total_credits_purchased DECIMAL(10,2) DEFAULT 0.00`
   - `promo_bonus_applied BOOLEAN DEFAULT false`
3. Run migration: `supabase db push`

**Files Created**:
- `supabase/migrations/YYYYMMDD_add_credit_system.sql`

**Testing**:
```bash
# Test migration
supabase db reset

# Verify welcome credits for new user
SELECT credit_balance FROM profiles WHERE user_id = '<test-user-id>';
# Should return: 3.00
```

---

### Day 2: Feature Costs Configuration

**Tasks**:
1. Create `src/lib/credits/costs.ts`:
```typescript
export const FEATURE_COSTS = {
  resume_optimization: 2,
  job_tailoring: 1,
  cover_letter: 3,
  linkedin_rewrite: 4,
} as const;

export const CREDIT_PACKS = {
  starter_10: { price: 6, credits: 10 },
  job_seeker_25: { price: 12, credits: 25 },
  career_upgrade_50: { price: 20, credits: 50 },
  pro_100: { price: 35, credits: 100 },
} as const;
```

2. Add environment variables to `.env.local`:
```env
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_PACK_STARTER_10=price_...
STRIPE_PRICE_ID_PACK_JOBSEEKER_25=price_...
STRIPE_PRICE_ID_PACK_CAREER_50=price_...
STRIPE_PRICE_ID_PACK_PRO_100=price_...
```

**Files Created**:
- `src/lib/credits/costs.ts`

---

### Day 3-4: Credit Deduction Logic

**Tasks**:
1. Create migration: `supabase/migrations/YYYYMMDD_add_credit_transactions.sql`
2. Create database functions: `deduct_credits_rpc`, `grant_credits_rpc`
3. Create API: `src/app/api/credits/deduct/route.ts`

**Implementation** (deduct_credits_rpc):
```sql
CREATE OR REPLACE FUNCTION deduct_credits_rpc(
  p_user_id UUID,
  p_amount DECIMAL,
  p_feature_type VARCHAR,
  p_related_optimization_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL
) RETURNS JSON AS $$
-- See data-model.md for full implementation
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Files Created**:
- `supabase/migrations/YYYYMMDD_add_credit_transactions.sql`
- `src/app/api/credits/deduct/route.ts`

**Testing**:
```bash
# Test deduction via API
curl -X POST http://localhost:3000/api/credits/deduct \
  -H "Content-Type: application/json" \
  -d '{"featureType": "resume_optimization"}'

# Verify balance updated
SELECT credit_balance FROM profiles WHERE user_id = '<user-id>';
```

---

### Day 5: API Guards

**Tasks**:
1. Add credit checks to existing API routes:
   - `src/app/api/optimize/route.ts` (Story 5.2)
   - Update other feature endpoints to deduct credits

**Pattern**:
```typescript
// Before feature execution
const { data: deductResult } = await supabase.rpc('deduct_credits_rpc', {
  p_user_id: userId,
  p_amount: FEATURE_COSTS.resume_optimization,
  p_feature_type: 'resume_optimization',
  p_description: 'Resume optimization'
});

if (deductResult?.success === false) {
  return NextResponse.json(
    { error: 'Insufficient credits' },
    { status: 402 }
  );
}

// Continue with feature execution...
```

**Files Modified**:
- `src/app/api/optimize/route.ts`
- (Other feature endpoints)

---

## Week 2: Stripe Integration (Days 6-12)

### Day 6: Stripe Setup

**Tasks**:
1. Install Stripe SDK: `npm install stripe @stripe/stripe-js`
2. Create Stripe client: `src/lib/stripe/client.ts`
3. Set up Stripe products/prices in dashboard:
   - Starter Pack: $6
   - Job Seeker Pack: $12
   - Career Upgrade Pack: $20
   - Pro Pack: $35

**Files Created**:
- `src/lib/stripe/client.ts`

---

### Day 7-8: Checkout Implementation

**Tasks**:
1. Create API: `src/app/api/credits/purchase/route.ts`
2. Implement checkout session creation
3. Create success/cancel pages:
   - `src/app/dashboard/billing/success/page.tsx`
   - `src/app/dashboard/billing/cancelled/page.tsx`

**Implementation**:
```typescript
// Create checkout session
const session = await stripe.checkout.sessions.create({
  mode: 'payment',
  line_items: [{ price: priceId, quantity: 1 }],
  success_url: `${baseUrl}/dashboard/billing/success?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${baseUrl}/dashboard/billing/cancelled`,
  customer_email: user.email,
  metadata: { userId: user.id, packType },
});

return NextResponse.json({ url: session.url });
```

**Files Created**:
- `src/app/api/credits/purchase/route.ts`
- `src/app/dashboard/billing/success/page.tsx`
- `src/app/dashboard/billing/cancelled/page.tsx`

---

### Day 9-10: Webhook Handler

**Tasks**:
1. Create migration: `supabase/migrations/YYYYMMDD_add_stripe_payments.sql`
2. Create API: `src/app/api/webhooks/stripe/route.ts`
3. Implement webhook signature verification
4. Implement idempotency checks

**Implementation**:
```typescript
// Verify signature
const sig = req.headers.get('stripe-signature');
const event = stripe.webhooks.constructEvent(
  await req.text(),
  sig,
  process.env.STRIPE_WEBHOOK_SECRET!
);

// Check idempotency
const { data: existing } = await supabase
  .from('stripe_payments')
  .select('id')
  .eq('stripe_event_id', event.id)
  .single();

if (existing) return NextResponse.json({ received: true });

// Process payment and grant credits
if (event.type === 'checkout.session.completed') {
  await grantCredits(event.data.object);
}
```

**Files Created**:
- `supabase/migrations/YYYYMMDD_add_stripe_payments.sql`
- `src/app/api/webhooks/stripe/route.ts`

---

### Day 11: Billing UI

**Tasks**:
1. Create page: `src/app/dashboard/billing/page.tsx`
2. Display credit packs with pricing
3. Integrate Purchase Credits button

**Files Created**:
- `src/app/dashboard/billing/page.tsx`
- `src/components/billing/PurchaseCreditsButton.tsx`

---

### Day 12: Testing

**Tasks**:
1. Test full purchase flow with Stripe test cards
2. Test webhook processing
3. Test concurrent deductions
4. Test idempotency (duplicate webhooks)

---

## Week 3: UI Polish & Analytics (Days 13-17)

### Day 13-14: Transaction History

**Tasks**:
1. Create API: `src/app/api/credits/transactions/route.ts`
2. Create component: `src/components/billing/TransactionHistory.tsx`
3. Implement pagination and filtering
4. Implement CSV export

**Files Created**:
- `src/app/api/credits/transactions/route.ts`
- `src/components/billing/TransactionHistory.tsx`
- `src/lib/credits/export-csv.ts`

---

### Day 14: Credit Balance Indicator

**Tasks**:
1. Create component: `src/components/layout/CreditBalance.tsx`
2. Add to dashboard header
3. Implement visual indicators (green/yellow/red)

**Files Created**:
- `src/components/layout/CreditBalance.tsx`

---

### Day 15: Low Credit Notifications

**Tasks**:
1. Create components:
   - `src/components/credits/LowCreditWarning.tsx`
   - `src/components/credits/CreditDepletedModal.tsx`
   - `src/components/credits/InsufficientCreditsModal.tsx`
2. Implement toast notifications
3. Implement modal triggers (<2 credits)

**Files Created**:
- `src/components/credits/LowCreditWarning.tsx`
- `src/components/credits/CreditDepletedModal.tsx`
- `src/components/credits/InsufficientCreditsModal.tsx`
- `src/hooks/useCreditBalance.ts`

---

### Day 16-17: Admin Analytics (Optional)

**Tasks**:
1. Create page: `src/app/dashboard/admin/analytics/page.tsx`
2. Display revenue, ARPPU, pack mix
3. Implement cohort analysis
4. Add RLS policies for admin access

**Files Created**:
- `src/app/dashboard/admin/analytics/page.tsx`
- `src/app/api/admin/analytics/revenue/route.ts`

---

## Environment Variables

Add to `.env.local`:

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_PACK_STARTER_10=price_...
STRIPE_PRICE_ID_PACK_JOBSEEKER_25=price_...
STRIPE_PRICE_ID_PACK_CAREER_50=price_...
STRIPE_PRICE_ID_PACK_PRO_100=price_...

# Optional: Promo bonus
PROMO_FIRST_PURCHASE_BONUS_PCT=20

# Supabase (existing)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Testing Checklist

- [ ] Welcome credits granted on signup
- [ ] Credit deduction works atomically
- [ ] Insufficient credits returns 402
- [ ] Stripe checkout redirects correctly
- [ ] Webhook grants credits on payment
- [ ] Webhook idempotency (duplicate events ignored)
- [ ] Transaction history pagination
- [ ] CSV export works
- [ ] Low credit modal triggers
- [ ] Balance indicator updates in real-time

## Deployment Checklist

- [ ] Add environment variables to production
- [ ] Run database migrations on production Supabase
- [ ] Configure Stripe webhook endpoint in production
- [ ] Test payment flow in production (use test mode first)
- [ ] Monitor webhook logs
- [ ] Set up error alerts (Sentry)

## Rollback Plan

If issues occur:
1. Disable API credit guards (temporarily allow all features)
2. Keep Stripe webhook processing (maintain transaction history)
3. Investigate and fix
4. Re-enable guards

## Next Steps

After Week 3:
1. Monitor user adoption (welcome credit usage)
2. Track conversion rates (free → paid)
3. A/B test pricing and pack configurations
4. Iterate on UI based on user feedback

## Support

- Stripe Docs: https://stripe.com/docs
- Supabase Docs: https://supabase.com/docs
- This Spec: `spec.md`
- Data Model: `data-model.md`
- API Contracts: `contracts/api-credits.md`

---

**Status**: Phase 1 Complete ✅  
All quickstart content provided for 3-week implementation.




