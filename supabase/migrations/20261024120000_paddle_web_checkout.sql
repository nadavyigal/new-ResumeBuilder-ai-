-- Paddle web checkout: data model and the two credit functions.
-- StoreKit spec docs/superpowers/specs/2026-10-15-resumely-storekit-export-credits-spec.md,
-- sections 16.4.1, 16.5 and 16.6 (Payments Phase 3, story 1, written 2026-10-22).
-- Builds on 20261021120000_export_credits.sql (ledger columns product_id and
-- environment) and follows 20261023120000_apple_iap_verification.sql.
--
-- NOT APPLIED. Applying it to production needs the founder's separate, explicit
-- yes (EXD-037), after the two migrations above.
--
-- One ledger for both stores: credits bought with Paddle are spent by
-- unlock_export exactly like Apple credits. Both functions trust their
-- arguments, so they run as service_role only; the webhook route passes only
-- data from a Paddle-signed event, and the user only from paddle_checkouts.

-- 1. Ledger columns (16.6). product_id holds the pri_ ID; environment is
--    'Production' or 'Sandbox'.
alter table public.credit_transactions
  add column if not exists paddle_transaction_id text unique,
  add column if not exists paddle_adjustment_id text unique,
  -- Refund and chargeback rows point at the grant; paddle_transaction_id stays
  -- unique to the grant row (the same split as related_apple_transaction_id).
  add column if not exists related_paddle_transaction_id text;

-- 2. Checkouts the server opened (16.3 step 2). The webhook takes the user from
--    here, never from custom_data, so a client cannot choose whose account is
--    credited.
create table if not exists public.paddle_checkouts (
  paddle_transaction_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  price_id text not null,
  environment text not null check (environment in ('Production', 'Sandbox')),
  created_at timestamptz not null default now()
);

-- 3. Webhook events already handled (16.4 step 5). Written after an event is
--    handled, so a retry of an event that failed half way runs again; the
--    ledger keys make the handling itself idempotent.
create table if not exists public.paddle_events (
  event_id text primary key,
  event_type text not null,
  received_at timestamptz not null default now()
);

-- Adjustments that arrive before their transaction.completed (Paddle does not
-- promise event order). Kept until the grant, which applies them in order.
create table if not exists public.paddle_pending_adjustments (
  paddle_adjustment_id text primary key,
  paddle_transaction_id text not null,
  action text not null check (action in ('refund', 'chargeback', 'chargeback_reverse')),
  credits integer not null check (credits >= 0),
  received_at timestamptz not null default now()
);

create index if not exists paddle_pending_adjustments_transaction_idx
  on public.paddle_pending_adjustments (paddle_transaction_id);

alter table public.paddle_checkouts enable row level security;
alter table public.paddle_events enable row level security;
alter table public.paddle_pending_adjustments enable row level security;
revoke all on public.paddle_checkouts, public.paddle_events, public.paddle_pending_adjustments
  from anon, authenticated;

-- 4. apply_paddle_adjustment (16.5). The user comes from the grant row; the
--    adjustment ID is the idempotency key; exports already unlocked stay unlocked.
--      refund, chargeback: deduct the credits of the refunded items, at most
--        what is still outstanding on the grant and at most the balance (floor 0).
--      chargeback_reverse: give back what chargebacks deducted and earlier
--        reversals have not returned, never what a refund took.
--    Before the grant: recorded in paddle_pending_adjustments when this server
--    opened the checkout (the grant applies it), 'unbound' when it did not (the
--    founder refunds by hand, 16.4.1 step 1), so the webhook can answer 200.
create or replace function public.apply_paddle_adjustment(
  p_paddle_transaction_id text,
  p_paddle_adjustment_id text,
  p_action text,
  p_credits integer
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_transaction_id text := trim(coalesce(p_paddle_transaction_id, ''));
  v_adjustment_id text := trim(coalesce(p_paddle_adjustment_id, ''));
  v_user_id uuid;
  v_granted integer;
  v_price_id text;
  v_environment text;
  v_has_grant boolean;
  v_balance integer;
  v_net_deducted integer;
  v_chargeback_outstanding integer;
  v_change integer;
  v_rows integer;
  v_pending record;
begin
  if length(v_transaction_id) = 0 or length(v_adjustment_id) = 0 then
    raise exception 'p_paddle_transaction_id and p_paddle_adjustment_id are required';
  end if;
  if p_action is null or p_action not in ('refund', 'chargeback', 'chargeback_reverse') then
    raise exception 'p_action must be refund, chargeback or chargeback_reverse';
  end if;
  if p_credits is null or p_credits < 0 then
    raise exception 'p_credits must be zero or positive';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('paddle_txn:' || v_transaction_id, 0));

  if exists (select 1 from public.credit_transactions where paddle_adjustment_id = v_adjustment_id)
     or exists (select 1 from public.paddle_pending_adjustments where paddle_adjustment_id = v_adjustment_id) then
    return jsonb_build_object('status', 'duplicate');
  end if;

  select user_id, delta, product_id, environment
    into v_user_id, v_granted, v_price_id, v_environment
  from public.credit_transactions
  where paddle_transaction_id = v_transaction_id;
  v_has_grant := found;

  if not v_has_grant then
    if not exists (select 1 from public.paddle_checkouts where paddle_transaction_id = v_transaction_id) then
      return jsonb_build_object('status', 'unbound');
    end if;
    insert into public.paddle_pending_adjustments (paddle_adjustment_id, paddle_transaction_id, action, credits)
    values (v_adjustment_id, v_transaction_id, p_action, p_credits);
    return jsonb_build_object('status', 'recorded_before_grant');
  end if;

  -- A chargeback reversal that arrives before its chargeback waits for it
  -- (Codex P1 on #199): recording it now would give back 0 and spend its ID,
  -- and the chargeback would then deduct for good.
  if p_action = 'chargeback_reverse' and not exists (
    select 1 from public.credit_transactions
    where related_paddle_transaction_id = v_transaction_id and reason = 'paddle_chargeback'
  ) then
    insert into public.paddle_pending_adjustments (paddle_adjustment_id, paddle_transaction_id, action, credits)
    values (v_adjustment_id, v_transaction_id, p_action, p_credits);
    return jsonb_build_object('status', 'deferred');
  end if;

  select credit_balance
    into v_balance
  from public.profiles
  where user_id = v_user_id
  for update;

  -- Positive: credits all deductions took and reversals have not given back.
  select coalesce(-sum(delta), 0)
    into v_net_deducted
  from public.credit_transactions
  where related_paddle_transaction_id = v_transaction_id;

  -- Positive: credits chargebacks took and reversals have not given back.
  select coalesce(-sum(delta), 0)
    into v_chargeback_outstanding
  from public.credit_transactions
  where related_paddle_transaction_id = v_transaction_id
    and reason in ('paddle_chargeback', 'paddle_chargeback_reversed');

  if p_action = 'chargeback_reverse' then
    v_change := least(p_credits, greatest(v_chargeback_outstanding, 0));
  else
    v_change := -least(
      p_credits,
      greatest(v_granted - v_net_deducted, 0),
      greatest(coalesce(v_balance, 0), 0)
    );
  end if;

  -- A zero-delta row still records the adjustment, so a repeat is a no-op.
  insert into public.credit_transactions (
    user_id, delta, reason, source, product_id, environment,
    paddle_adjustment_id, related_paddle_transaction_id
  )
  values (
    v_user_id,
    v_change,
    case p_action
      when 'refund' then 'paddle_refund'
      when 'chargeback' then 'paddle_chargeback'
      else 'paddle_chargeback_reversed'
    end,
    'paddle',
    v_price_id,
    v_environment,
    v_adjustment_id,
    v_transaction_id
  )
  on conflict (paddle_adjustment_id) do nothing;

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

  -- A chargeback lets the reversals that were waiting for it run now.
  if p_action = 'chargeback' then
    for v_pending in
      select paddle_adjustment_id, credits
      from public.paddle_pending_adjustments
      where paddle_transaction_id = v_transaction_id and action = 'chargeback_reverse'
      order by received_at, paddle_adjustment_id
    loop
      delete from public.paddle_pending_adjustments where paddle_adjustment_id = v_pending.paddle_adjustment_id;
      perform public.apply_paddle_adjustment(
        v_transaction_id, v_pending.paddle_adjustment_id, 'chargeback_reverse', v_pending.credits
      );
    end loop;
    select credit_balance into v_balance from public.profiles where user_id = v_user_id;
  end if;

  return jsonb_build_object(
    'status', case when p_action = 'chargeback_reverse' then 'reversed' else 'deducted' end,
    'user_id', v_user_id,
    'credits_changed', v_change,
    'balance', v_balance,
    'price_id', v_price_id,
    'environment', v_environment
  );
end;
$$;

revoke all on function public.apply_paddle_adjustment(text, text, text, integer) from public, anon, authenticated;
grant execute on function public.apply_paddle_adjustment(text, text, text, integer) to service_role;

-- 5. grant_paddle_credits (16.4.1 step 3). One Paddle transaction ID grants
--    once, ever, and only to the account that opened the checkout: the
--    function checks paddle_checkouts itself instead of trusting the caller.
--    Same locks as grant_apple_purchase: a per-transaction advisory lock, then
--    the profile row lock that unlock_export also takes. Adjustments that
--    arrived first are applied right after the grant, in arrival order.
create or replace function public.grant_paddle_credits(
  p_user_id uuid,
  p_delta integer,
  p_paddle_transaction_id text,
  p_price_id text,
  p_environment text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_transaction_id text := trim(coalesce(p_paddle_transaction_id, ''));
  v_balance integer;
  v_rows integer;
  v_owner uuid;
  v_existing_delta integer;
  v_pending record;
begin
  if p_delta is null or p_delta <= 0 then
    raise exception 'p_delta must be positive';
  end if;
  if length(v_transaction_id) = 0 then
    raise exception 'p_paddle_transaction_id is required';
  end if;
  if p_environment is null or p_environment not in ('Production', 'Sandbox') then
    raise exception 'p_environment must be Production or Sandbox';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('paddle_txn:' || v_transaction_id, 0));

  if not exists (
    select 1 from public.paddle_checkouts
    where paddle_transaction_id = v_transaction_id and user_id = p_user_id
  ) then
    return jsonb_build_object('status', 'unbound');
  end if;

  insert into public.profiles (id, user_id, plan_type, optimizations_used, credit_balance)
  values (gen_random_uuid(), p_user_id, 'free', 0, 1)
  on conflict (user_id) do nothing;

  select credit_balance
    into v_balance
  from public.profiles
  where user_id = p_user_id
  for update;

  insert into public.credit_transactions (
    user_id, delta, reason, source, paddle_transaction_id, product_id, environment
  )
  values (
    p_user_id, p_delta, 'paddle_purchase', 'paddle', v_transaction_id, p_price_id, p_environment
  )
  on conflict (paddle_transaction_id) do nothing;

  get diagnostics v_rows = row_count;

  if v_rows > 0 then
    update public.profiles
    set credit_balance = credit_balance + p_delta,
        updated_at = now()
    where user_id = p_user_id
    returning credit_balance into v_balance;

    -- Refunds or chargebacks that arrived before this grant.
    for v_pending in
      select paddle_adjustment_id, action, credits
      from public.paddle_pending_adjustments
      where paddle_transaction_id = v_transaction_id
      order by received_at, paddle_adjustment_id
    loop
      delete from public.paddle_pending_adjustments where paddle_adjustment_id = v_pending.paddle_adjustment_id;
      perform public.apply_paddle_adjustment(
        v_transaction_id, v_pending.paddle_adjustment_id, v_pending.action, v_pending.credits
      );
    end loop;

    select credit_balance into v_balance from public.profiles where user_id = p_user_id;
    return jsonb_build_object('status', 'granted', 'credits_granted', p_delta, 'balance', v_balance);
  end if;

  select user_id, delta
    into v_owner, v_existing_delta
  from public.credit_transactions
  where paddle_transaction_id = v_transaction_id;

  if v_owner is distinct from p_user_id then
    return jsonb_build_object('status', 'owned_by_other_account');
  end if;

  return jsonb_build_object('status', 'already_granted', 'credits_granted', v_existing_delta, 'balance', v_balance);
end;
$$;

revoke all on function public.grant_paddle_credits(uuid, integer, text, text, text) from public, anon, authenticated;
grant execute on function public.grant_paddle_credits(uuid, integer, text, text, text) to service_role;
