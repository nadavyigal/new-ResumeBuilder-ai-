# Data Model: Credit-Based Pricing System

**Feature**: Epic 5 - Credit-Based Pricing System  
**Date**: October 26, 2025  
**Status**: Complete

## Overview

Database schema for credit-based pricing system, including user credits, transaction history, and Stripe payment records.

## Schema Changes

### Modified: `profiles` Table

Add three new columns to track credits:

```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS credit_balance DECIMAL(10,2) DEFAULT 3.00,
  ADD COLUMN IF NOT EXISTS total_credits_purchased DECIMAL(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS promo_bonus_applied BOOLEAN DEFAULT false;
```

**Purpose**:
- `credit_balance`: Current available credits (DEFAULT 3.00 for welcome credits)
- `total_credits_purchased`: Lifetime purchased credits (excluding welcome credits)
- `promo_bonus_applied`: Flag to prevent multiple promo bonuses per user

**Constraints**:
- No negative balances (application logic + trigger if needed)
- DECIMAL precision for accurate currency calculations

---

### New Table: `credit_transactions`

Transaction history for all credit movements.

```sql
CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_type VARCHAR(50) NOT NULL CHECK (
    transaction_type IN ('purchase', 'deduction', 'refund', 'promo_bonus', 'welcome_bonus')
  ),
  feature_type VARCHAR(50) CHECK (
    feature_type IN ('resume_optimization', 'job_tailoring', 'cover_letter', 'linkedin_rewrite')
  ),
  amount DECIMAL(10,2) NOT NULL, -- positive for credits, negative for deductions
  balance_after DECIMAL(10,2) NOT NULL,
  description TEXT,
  related_optimization_id UUID REFERENCES optimizations(id) ON DELETE SET NULL,
  related_payment_intent VARCHAR(255), -- Stripe payment intent ID
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for performance
CREATE INDEX idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX idx_credit_transactions_type ON credit_transactions(transaction_type);
CREATE INDEX idx_credit_transactions_feature ON credit_transactions(feature_type);
CREATE INDEX idx_credit_transactions_created ON credit_transactions(created_at DESC);
```

**Purpose**: Complete audit trail of all credit movements for transparency, refunds, and analytics.

**Transaction Types**:
- `purchase`: Credits purchased via Stripe
- `deduction`: Credits used for features
- `refund`: Credits refunded (negative amount)
- `promo_bonus`: Bonus credits from promo campaigns
- `welcome_bonus`: Welcome credits for new users

**Linkages**:
- Links to `optimizations` table via `related_optimization_id` for refund tracking
- Stores Stripe payment intent ID for refund processing
- Metadata JSONB for extensible data (e.g., pack type, Stripe event ID)

---

### New Table: `stripe_payments`

Payment records from Stripe Checkout.

```sql
CREATE TABLE stripe_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_checkout_session_id VARCHAR(255) UNIQUE NOT NULL,
  stripe_payment_intent_id VARCHAR(255) UNIQUE,
  stripe_event_id VARCHAR(255) UNIQUE, -- For idempotency
  pack_type VARCHAR(50) CHECK (
    pack_type IN ('starter_10','job_seeker_25','career_upgrade_50','pro_100')
  ),
  is_subscription BOOLEAN DEFAULT false,
  subscription_type VARCHAR(50) CHECK (
    subscription_type IN ('career_boost_20','career_pro_40')
  ),
  amount_paid_cents INTEGER NOT NULL,
  credits_granted DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) NOT NULL CHECK (
    status IN ('pending','succeeded','failed','refunded')
  ),
  payment_method VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for performance
CREATE INDEX idx_stripe_payments_user_id ON stripe_payments(user_id);
CREATE INDEX idx_stripe_payments_session_id ON stripe_payments(stripe_checkout_session_id);
CREATE INDEX idx_stripe_payments_status ON stripe_payments(status);
CREATE INDEX idx_stripe_payments_event_id ON stripe_payments(stripe_event_id);
```

**Purpose**: Store all Stripe payment events for webhook idempotency, refund processing, and analytics.

**Pack Types**:
- `starter_10`: Starter Pack (10 credits, $6)
- `job_seeker_25`: Job Seeker Pack (25 credits, $12)
- `career_upgrade_50`: Career Upgrade Pack (50 credits, $20)
- `pro_100`: Pro Pack (100 credits, $35)

**Subscription Types** (optional):
- `career_boost_20`: Career Boost (20 credits/month, $8/mo)
- `career_pro_40`: Career Pro (40 credits/month, $14/mo)

**Idempotency**: `stripe_event_id` used to prevent duplicate webhook processing.

---

## RLS (Row Level Security) Policies

### `credit_transactions`

```sql
-- Users can view their own transactions
CREATE POLICY "Users can view own transactions" ON credit_transactions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert transactions (via API)
CREATE POLICY "Service role can insert transactions" ON credit_transactions
  FOR INSERT
  WITH CHECK (true); -- API handles authorization
```

### `stripe_payments`

```sql
-- Users can view their own payments
CREATE POLICY "Users can view own payments" ON stripe_payments
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert payments (via webhook)
CREATE POLICY "Service role can insert payments" ON stripe_payments
  FOR INSERT
  WITH CHECK (true); -- Webhook handler verified externally
```

## Database Functions

### `deduct_credits_rpc` Function

Atomic credit deduction with balance check.

```sql
CREATE OR REPLACE FUNCTION deduct_credits_rpc(
  p_user_id UUID,
  p_amount DECIMAL,
  p_feature_type VARCHAR,
  p_related_optimization_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_balance DECIMAL;
  v_balance_after DECIMAL;
  v_result JSON;
BEGIN
  -- Lock and check balance atomically
  SELECT credit_balance INTO v_balance
  FROM profiles
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  IF v_balance IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;
  
  IF v_balance < p_amount THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Insufficient credits',
      'current_balance', v_balance,
      'required', p_amount
    );
  END IF;
  
  -- Deduct credits
  UPDATE profiles
  SET credit_balance = credit_balance - p_amount
  WHERE user_id = p_user_id;
  
  SELECT credit_balance INTO v_balance_after FROM profiles WHERE user_id = p_user_id;
  
  -- Insert transaction record
  INSERT INTO credit_transactions (
    user_id, 
    transaction_type, 
    feature_type, 
    amount, 
    balance_after,
    related_optimization_id,
    description
  ) VALUES (
    p_user_id,
    'deduction',
    p_feature_type,
    -p_amount,
    v_balance_after,
    p_related_optimization_id,
    p_description
  );
  
  RETURN json_build_object(
    'success', true,
    'balance_after', v_balance_after
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Usage** (via Supabase RPC):
```typescript
const { data } = await supabase.rpc('deduct_credits_rpc', {
  p_user_id: userId,
  p_amount: 2,
  p_feature_type: 'resume_optimization',
  p_description: 'Resume optimization'
});
```

---

### `grant_credits_rpc` Function

Grant credits (for purchases, bonuses, refunds).

```sql
CREATE OR REPLACE FUNCTION grant_credits_rpc(
  p_user_id UUID,
  p_amount DECIMAL,
  p_transaction_type VARCHAR,
  p_description TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_balance DECIMAL;
  v_balance_after DECIMAL;
BEGIN
  -- Grant credits
  UPDATE profiles
  SET credit_balance = credit_balance + p_amount
  WHERE user_id = p_user_id;
  
  SELECT credit_balance INTO v_balance_after FROM profiles WHERE user_id = p_user_id;
  
  -- Insert transaction record
  INSERT INTO credit_transactions (
    user_id,
    transaction_type,
    amount,
    balance_after,
    description
  ) VALUES (
    p_user_id,
    p_transaction_type,
    p_amount,
    v_balance_after,
    p_description
  );
  
  RETURN json_build_object(
    'success', true,
    'balance_after', v_balance_after
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Entity Relationships

```
┌─────────────┐
│   profiles  │
│             │
│ credit_     │
│ balance     │ ◄──────────────◄───┐
│ (DEFAULT 3) │                    │
└─────────────┘                    │
                                    │
┌────────────────────────────────┐ │
│ credit_transactions             │ │
│ ─────────────────────────      │ │
│ user_id ───────────────────┐   │ │
│ transaction_type            │   │ │
│ amount (+/-)                │   │ │
│ balance_after               │───┘ │
│ related_optimization_id ────┼─────┼───┐
│ stripe_event_id             │     │   │
└─────────────────────────────┘     │   │
                                    │   │
┌────────────────────────────────┐  │   │
│ stripe_payments               │  │   │
│ ───────────────────────────── │  │   │
│ user_id ───────────────────┐  │  │   │
│ stripe_checkout_session_id  │  │  │  │
│ stripe_event_id (unique)    │◄─┘  │  │
│ pack_type                    │   │  │
│ credits_granted              │   │  │
└───────────────────────────────┘   │  │
                                    │  │
┌────────────────────────────────┐  │  │
│ optimizations                  │◄─┴──┘
│ ─────────────────────────      │
│ id (UUID)                      │
│ user_id                        │
│ match_score                    │
│ rewrite_data (JSONB)           │
└────────────────────────────────┘
```

## Migration Scripts

All migrations stored in `supabase/migrations/`.

**Migration 1**: `YYYYMMDD_add_credit_system.sql`
- Adds columns to `profiles`
- Initializes welcome credits for existing users

**Migration 2**: `YYYYMMDD_add_credit_transactions.sql`
- Creates `credit_transactions` table
- Adds RLS policies
- Creates database functions

**Migration 3**: `YYYYMMDD_add_stripe_payments.sql`
- Creates `stripe_payments` table
- Adds RLS policies
- Adds indexes

## Status

**Phase 1 Complete** ✅  
Database schema designed, RLS policies defined, functions implemented.


