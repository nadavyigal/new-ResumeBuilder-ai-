-- Plan 3: StoreKit Paywall — IAP credit tables
-- GATED: Do not apply until CFO price validation + D7 activation data (EXD-009).
--
-- NOTE: The existing system uses profiles.credit_balance + credit_transactions
-- for web credits. This migration adds iOS IAP-specific tables (user_credits +
-- iap_purchases) for StoreKit 2 receipt verification. Reconcile both credit
-- systems before enabling the paywall (decide: single ledger or parallel).

-- User credit balance (IAP-granted credits + unlimited flag)
create table if not exists user_credits (
  user_id uuid references auth.users(id) on delete cascade primary key,
  export_credits integer not null default 0,
  is_unlimited boolean not null default false,
  unlimited_expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Purchase history (idempotency key: transaction_id unique)
create table if not exists iap_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  product_id text not null,
  transaction_id text unique not null,
  original_transaction_id text,
  purchase_date timestamptz not null,
  credits_granted integer not null default 0,
  is_subscription boolean not null default false,
  verified_at timestamptz default now()
);

-- RLS
alter table user_credits enable row level security;
create policy "Users read own credits"
  on user_credits for select
  using (auth.uid() = user_id);

alter table iap_purchases enable row level security;
create policy "Users read own purchases"
  on iap_purchases for select
  using (auth.uid() = user_id);
