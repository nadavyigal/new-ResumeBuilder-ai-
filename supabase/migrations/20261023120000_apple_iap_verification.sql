-- Apple In-App Purchase: verified grants and refunds.
-- StoreKit spec docs/superpowers/specs/2026-10-15-resumely-storekit-export-credits-spec.md,
-- sections 7 and 8 (P3b story S3, written 2026-10-22). Builds on
-- 20261021120000_export_credits.sql, which adds the ledger columns used here
-- (product_id, environment, apple_notification_uuid, related_apple_transaction_id).
--
-- NOT APPLIED. Applying it to production needs the founder's separate, explicit
-- yes (EXD-037), after the export-credits migration.
--
-- Both functions trust their arguments, so they run as service_role only. The
-- routes own the identity checks: /api/v1/iap/verify passes the user from
-- getUser() only after Apple's signature, bundle, environment, product and
-- appAccountToken checks pass; /api/v1/iap/notifications passes only data from
-- a verified App Store Server Notification.
--
-- grant_apple_credits (the pre-spec grant, 5 text-ish arguments) is kept, still
-- service_role only, so the earlier migrations and their tests stay valid. No
-- route calls it after this story.

-- 0. Refunds that arrive before the grant. A user could keep a purchase's
--    signed transaction, get the refund from Apple, and only then send the old
--    (pre-refund, still validly signed) transaction to /verify. The refund
--    notification found no grant, so without this record the credits would be
--    granted for a refunded purchase. grant_apple_purchase refuses any
--    transaction refunded here; a later REFUND_REVERSED clears it.
--    (Codex on #197: every notification is recorded, not only the latest.)
create table if not exists public.apple_pre_grant_refunds (
  -- Every notification is kept, keyed by its UUID, so a retried old
  -- notification is a no-op instead of overwriting newer state.
  notification_uuid text primary key,
  apple_transaction_id text not null,
  reversed boolean not null,
  received_at timestamptz not null default now()
);

create index if not exists apple_pre_grant_refunds_transaction_idx
  on public.apple_pre_grant_refunds (apple_transaction_id);

alter table public.apple_pre_grant_refunds enable row level security;
revoke all on public.apple_pre_grant_refunds from anon, authenticated;

-- A transaction counts as refunded while it has more REFUND than
-- REFUND_REVERSED notifications. Counting, not "the latest one", gives the
-- same answer whatever order Apple delivers or retries them in.
-- Both functions below take pg_advisory_xact_lock on the transaction ID first,
-- then the profile row lock, so a refund and a grant for the same transaction
-- run one after the other and never deadlock with unlock_export (profile only).

-- 1. grant_apple_purchase (spec 7.2 check 8). One Apple transaction ID grants
--    once, ever, and only to the account that first claimed it.
create or replace function public.grant_apple_purchase(
  p_user_id uuid,
  p_apple_transaction_id text,
  p_product_id text,
  p_credits integer,
  p_environment text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_transaction_id text := trim(coalesce(p_apple_transaction_id, ''));
  v_balance integer;
  v_rows integer;
  v_owner uuid;
  v_existing_delta integer;
begin
  if p_credits is null or p_credits <= 0 then
    raise exception 'p_credits must be positive';
  end if;
  if length(v_transaction_id) = 0 then
    raise exception 'p_apple_transaction_id is required';
  end if;
  if p_environment is null or p_environment not in ('Production', 'Sandbox') then
    raise exception 'p_environment must be Production or Sandbox';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('apple_txn:' || v_transaction_id, 0));

  insert into public.profiles (id, user_id, plan_type, optimizations_used, credit_balance)
  values (gen_random_uuid(), p_user_id, 'free', 0, 1)
  on conflict (user_id) do nothing;

  -- Same lock as unlock_export and apply_iap_refund: every balance change for
  -- this user is serialized.
  select credit_balance
    into v_balance
  from public.profiles
  where user_id = p_user_id
  for update;

  -- Refunded before it was ever granted: never grant it.
  if not exists (select 1 from public.credit_transactions where apple_transaction_id = v_transaction_id)
     and (
       select count(*) filter (where not reversed) > count(*) filter (where reversed)
       from public.apple_pre_grant_refunds
       where apple_transaction_id = v_transaction_id
     ) then
    return jsonb_build_object('status', 'revoked');
  end if;

  insert into public.credit_transactions (
    user_id, delta, reason, source, apple_transaction_id, product_id, environment
  )
  values (
    p_user_id, p_credits, 'iap_purchase', 'apple_iap', v_transaction_id, p_product_id, p_environment
  )
  on conflict (apple_transaction_id) do nothing;

  get diagnostics v_rows = row_count;

  if v_rows > 0 then
    update public.profiles
    set credit_balance = credit_balance + p_credits,
        updated_at = now()
    where user_id = p_user_id
    returning credit_balance into v_balance;

    return jsonb_build_object('status', 'granted', 'credits_granted', p_credits, 'balance', v_balance);
  end if;

  select user_id, delta
    into v_owner, v_existing_delta
  from public.credit_transactions
  where apple_transaction_id = v_transaction_id;

  if v_owner is distinct from p_user_id then
    return jsonb_build_object('status', 'owned_by_other_account');
  end if;

  return jsonb_build_object('status', 'already_granted', 'credits_granted', v_existing_delta, 'balance', v_balance);
end;
$$;

revoke all on function public.grant_apple_purchase(uuid, text, text, integer, text) from public, anon, authenticated;
grant execute on function public.grant_apple_purchase(uuid, text, text, integer, text) to service_role;

-- 2. apply_iap_refund (spec 8). REFUND deducts what is still outstanding on the
--    grant, at most the current balance; REFUND_REVERSED gives back what refunds
--    deducted and earlier reversals have not returned. With no grant yet, the
--    refund is recorded in apple_pre_grant_refunds (step 0). The user comes from the
--    grant row, never from the notification, so a refund can only touch the
--    account that was credited. The notification UUID is the idempotency key.
--    Exports already unlocked stay unlocked.
create or replace function public.apply_iap_refund(
  p_apple_transaction_id text,
  p_notification_uuid text,
  p_reversed boolean
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_transaction_id text := trim(coalesce(p_apple_transaction_id, ''));
  v_notification_uuid text := trim(coalesce(p_notification_uuid, ''));
  v_user_id uuid;
  v_granted integer;
  v_product_id text;
  v_environment text;
  v_balance integer;
  v_net_refunded integer;
  v_change integer;
  v_rows integer;
  v_has_grant boolean;
  v_refunds integer;
  v_reversals integer;
  v_was_refunded boolean;
begin
  if length(v_transaction_id) = 0 or length(v_notification_uuid) = 0 then
    raise exception 'p_apple_transaction_id and p_notification_uuid are required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('apple_txn:' || v_transaction_id, 0));

  select user_id, delta, product_id, environment
    into v_user_id, v_granted, v_product_id, v_environment
  from public.credit_transactions
  where apple_transaction_id = v_transaction_id;
  v_has_grant := found;

  -- A notification already handled before the grant existed is a no-op now
  -- too, so a late retry cannot deduct from the grant that followed.
  if exists (select 1 from public.apple_pre_grant_refunds where notification_uuid = v_notification_uuid) then
    return jsonb_build_object('status', 'duplicate');
  end if;

  if not v_has_grant then
    -- No grant yet: remember the refund (or its reversal) so a later grant
    -- of this transaction is refused (or allowed again).
    insert into public.apple_pre_grant_refunds (notification_uuid, apple_transaction_id, reversed)
    values (v_notification_uuid, v_transaction_id, coalesce(p_reversed, false));

    return jsonb_build_object(
      'status', 'recorded_before_grant',
      'refunded', (
        select count(*) filter (where not reversed) > count(*) filter (where reversed)
        from public.apple_pre_grant_refunds
        where apple_transaction_id = v_transaction_id
      )
    );
  end if;

  select credit_balance
    into v_balance
  from public.profiles
  where user_id = v_user_id
  for update;

  -- Positive: credits refunds took and reversals have not given back.
  select coalesce(-sum(delta), 0)
    into v_net_refunded
  from public.credit_transactions
  where related_apple_transaction_id = v_transaction_id;

  -- Refunded or not is decided by counting every notification for this
  -- transaction, the ones recorded before the grant included: refunded while
  -- REFUND outnumbers REFUND_REVERSED. Credits move only when that state flips,
  -- so a late REFUND after an earlier reversal, or a second REFUND, deducts
  -- nothing (Codex P2 on #197), whatever order Apple delivers them in.
  select
    (select count(*) from public.apple_pre_grant_refunds where apple_transaction_id = v_transaction_id and not reversed)
      + (select count(*) from public.credit_transactions where related_apple_transaction_id = v_transaction_id and reason = 'iap_refund'),
    (select count(*) from public.apple_pre_grant_refunds where apple_transaction_id = v_transaction_id and reversed)
      + (select count(*) from public.credit_transactions where related_apple_transaction_id = v_transaction_id and reason = 'iap_refund_reversed')
    into v_refunds, v_reversals;
  v_was_refunded := v_refunds > v_reversals;
  if coalesce(p_reversed, false) then
    v_reversals := v_reversals + 1;
  else
    v_refunds := v_refunds + 1;
  end if;

  if coalesce(p_reversed, false) then
    -- Gives back what refunds took, only when this reversal ends the refund.
    v_change := case when v_was_refunded and v_refunds <= v_reversals then greatest(v_net_refunded, 0) else 0 end;
  else
    -- Deducts what is outstanding, only when this refund starts one.
    v_change := case when not v_was_refunded and v_refunds > v_reversals
      then -least(greatest(v_granted - v_net_refunded, 0), greatest(coalesce(v_balance, 0), 0))
      else 0 end;
  end if;

  -- A zero-delta row still records the notification, so a repeat is a no-op.
  insert into public.credit_transactions (
    user_id, delta, reason, source, product_id, environment,
    apple_notification_uuid, related_apple_transaction_id
  )
  values (
    v_user_id,
    v_change,
    case when coalesce(p_reversed, false) then 'iap_refund_reversed' else 'iap_refund' end,
    'apple_iap',
    v_product_id,
    v_environment,
    v_notification_uuid,
    v_transaction_id
  )
  on conflict (apple_notification_uuid) do nothing;

  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    return jsonb_build_object('status', 'duplicate', 'user_id', v_user_id, 'balance', v_balance);
  end if;

  if v_change <> 0 then
    update public.profiles
    set credit_balance = credit_balance + v_change,
        updated_at = now()
    where user_id = v_user_id
    returning credit_balance into v_balance;
  end if;

  return jsonb_build_object(
    'status', case when coalesce(p_reversed, false) then 'reversed' else 'refunded' end,
    'user_id', v_user_id,
    'credits_changed', v_change,
    'balance', v_balance,
    'product_id', v_product_id,
    'environment', v_environment
  );
end;
$$;

revoke all on function public.apply_iap_refund(text, text, boolean) from public, anon, authenticated;
grant execute on function public.apply_iap_refund(text, text, boolean) to service_role;
