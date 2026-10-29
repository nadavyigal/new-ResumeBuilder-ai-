-- Pricing v2: welcome grant, export packs, the Pro subscription and its fair-use cap.
-- Plan: ResumeBuilder-IOS-APP plans/resumely-pricing-v2.md (v3, approved 2026-10-29), story S1.
-- Builds on 20261021120000_export_credits.sql and 20261023120000_apple_iap_verification.sql.
--
-- NOT APPLIED. Applying it to production needs the founder's separate, explicit
-- yes. Apply it on its own through the Supabase MCP, then rename this file to
-- the recorded version (supabase/migrations_archive/README.md).
--
-- What changes for users once applied:
--   * Every real (non-anonymous) account gets 3 free PDF exports once, ever,
--     the first time it reads its credits or exports. Existing accounts get the
--     3 on top of what they hold (founder decision D1). New accounts start at 0,
--     so they hold exactly 3.
--   * An active resumely.pro.monthly subscription unlocks exports without
--     spending credits, up to 40 per billing period; after that, credits.
--   * Match Scores are not touched: they stay free and unlimited.
-- Whether an export is charged at all is still decided by the routes
-- (EXPORT_CREDITS_ENABLED, EXPORT_CREDITS_USER_IDS, iOS only).
--
-- Every function here is SECURITY DEFINER and trusts its arguments, so each is
-- revoked from public, anon and authenticated and granted to service_role only
-- (tasks/lessons.md, 2026-10-22).

-- 0. Constants. Changing one is a one-line `create or replace` migration.
create or replace function public.welcome_export_grant()
returns integer
language sql
immutable
as $$ select 3 $$;

create or replace function public.subscription_export_cap()
returns integer
language sql
immutable
as $$ select 40 $$;

-- 1. New accounts start at 0; the welcome grant gives the free exports.
alter table public.profiles alter column credit_balance set default 0;

-- 2. One welcome grant per account, ever. The primary key is the idempotency
--    key: reinstalling or signing in on a new device cannot grant again.
create table if not exists public.welcome_grants (
  user_id uuid primary key references auth.users(id) on delete cascade,
  exports_granted integer not null check (exports_granted > 0),
  granted_at timestamptz not null default now(),
  -- Set once, by the export that uses up as many credits as the grant gave
  -- (the free_grant_used analytics event).
  used_up_at timestamptz
);

alter table public.welcome_grants enable row level security;
drop policy if exists "Users read own welcome grant" on public.welcome_grants;
create policy "Users read own welcome grant"
  on public.welcome_grants for select using (auth.uid() = user_id);
revoke insert, update, delete, truncate on public.welcome_grants from anon, authenticated;

-- 3. Subscriptions, one row per Apple original transaction. The row belongs to
--    the account whose appAccountToken bought it; restoring on another account
--    never moves it.
create table if not exists public.subscriptions (
  original_transaction_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null,
  latest_transaction_id text not null,
  current_period_start timestamptz not null,
  expires_at timestamptz not null,
  grace_until timestamptz,
  revoked_at timestamptz,
  auto_renew boolean not null default true,
  environment text not null check (environment in ('Production', 'Sandbox')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_user_idx on public.subscriptions (user_id);

alter table public.subscriptions enable row level security;
drop policy if exists "Users read own subscriptions" on public.subscriptions;
create policy "Users read own subscriptions"
  on public.subscriptions for select using (auth.uid() = user_id);
revoke insert, update, delete, truncate on public.subscriptions from anon, authenticated;

-- 4. Exports unlocked by the subscription are recorded as their own source, so
--    the fair-use count reads straight from export_unlocks.
alter table public.export_unlocks drop constraint if exists export_unlocks_source_check;
alter table public.export_unlocks
  add constraint export_unlocks_source_check check (source in ('credit', 'ungated', 'subscription'));

create index if not exists export_unlocks_user_source_created_idx
  on public.export_unlocks (user_id, source, created_at);

-- 5. ensure_welcome_grant: gives the free exports once to a real account.
--    Anonymous sessions get nothing (exports need a real account); they get
--    the grant on the first call after the account is linked.
create or replace function public.ensure_welcome_grant(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_anonymous boolean;
  v_amount integer := public.welcome_export_grant();
  v_balance integer;
  v_rows integer;
begin
  select coalesce(is_anonymous, false)
    into v_anonymous
  from auth.users
  where id = p_user_id;

  if not found or v_anonymous then
    return jsonb_build_object('status', 'not_eligible');
  end if;

  insert into public.profiles (id, user_id, plan_type, optimizations_used, credit_balance)
  values (gen_random_uuid(), p_user_id, 'free', 0, 0)
  on conflict (user_id) do nothing;

  -- Same row lock as every other balance change for this user.
  select credit_balance
    into v_balance
  from public.profiles
  where user_id = p_user_id
  for update;

  insert into public.welcome_grants (user_id, exports_granted)
  values (p_user_id, v_amount)
  on conflict (user_id) do nothing;

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    return jsonb_build_object('status', 'already_granted', 'balance', v_balance);
  end if;

  update public.profiles
  set credit_balance = credit_balance + v_amount,
      updated_at = now()
  where user_id = p_user_id
  returning credit_balance into v_balance;

  insert into public.credit_transactions (user_id, delta, reason, source)
  values (p_user_id, v_amount, 'welcome_grant', 'welcome_grant');

  return jsonb_build_object('status', 'granted', 'exports_granted', v_amount, 'balance', v_balance);
end;
$$;

revoke all on function public.ensure_welcome_grant(uuid) from public, anon, authenticated;
grant execute on function public.ensure_welcome_grant(uuid) to service_role;

-- 6. subscription_state: the user's active subscription, if any, with how many
--    exports it has unlocked this period. Read-only.
create or replace function public.subscription_state(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_sub public.subscriptions%rowtype;
  v_used integer;
begin
  select *
    into v_sub
  from public.subscriptions
  where user_id = p_user_id
    and revoked_at is null
    and now() < greatest(expires_at, coalesce(grace_until, expires_at))
  order by expires_at desc
  limit 1;

  if not found then
    return jsonb_build_object('active', false);
  end if;

  select count(*)
    into v_used
  from public.export_unlocks
  where user_id = p_user_id
    and source = 'subscription'
    and created_at >= v_sub.current_period_start;

  return jsonb_build_object(
    'active', true,
    'product_id', v_sub.product_id,
    'expires_at', v_sub.expires_at,
    'grace_until', v_sub.grace_until,
    'auto_renew', v_sub.auto_renew,
    'period_start', v_sub.current_period_start,
    'period_exports', v_used,
    'period_cap', public.subscription_export_cap()
  );
end;
$$;

revoke all on function public.subscription_state(uuid) from public, anon, authenticated;
grant execute on function public.subscription_state(uuid) to service_role;

-- 7. get_credit_state: what the app shows in Profile and on the paywall.
--    Gives the welcome grant first, so a new account sees its free exports.
create or replace function public.get_credit_state(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_balance integer;
begin
  perform public.ensure_welcome_grant(p_user_id);

  select credit_balance
    into v_balance
  from public.profiles
  where user_id = p_user_id;

  return jsonb_build_object(
    'balance', coalesce(v_balance, 0),
    'subscription', public.subscription_state(p_user_id)
  );
end;
$$;

revoke all on function public.get_credit_state(uuid) from public, anon, authenticated;
grant execute on function public.get_credit_state(uuid) to service_role;

-- 8. upsert_subscription: records a verified subscription transaction from
--    /api/v1/iap/verify (p_user_id from getUser(), after the appAccountToken
--    check) or from a verified App Store notification (p_user_id from the
--    transaction's appAccountToken, or null when Apple sent none).
--
--    A transaction with a later expiry moves the row forward (a renewal); the
--    same latest transaction updates its revocation (a refund); an older one
--    changes nothing, so Apple's retries and out-of-order delivery are safe.
create or replace function public.upsert_subscription(
  p_user_id uuid,
  p_original_transaction_id text,
  p_transaction_id text,
  p_product_id text,
  p_purchase_date timestamptz,
  p_expires_at timestamptz,
  p_revoked_at timestamptz,
  p_environment text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_original text := trim(coalesce(p_original_transaction_id, ''));
  v_transaction text := trim(coalesce(p_transaction_id, ''));
  v_sub public.subscriptions%rowtype;
  v_status text;
begin
  if length(v_original) = 0 or length(v_transaction) = 0 then
    raise exception 'p_original_transaction_id and p_transaction_id are required';
  end if;
  if p_purchase_date is null or p_expires_at is null then
    raise exception 'p_purchase_date and p_expires_at are required';
  end if;
  if p_environment is null or p_environment not in ('Production', 'Sandbox') then
    raise exception 'p_environment must be Production or Sandbox';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('apple_sub:' || v_original, 0));

  select *
    into v_sub
  from public.subscriptions
  where original_transaction_id = v_original
  for update;

  if not found then
    -- No owner to record it for: Apple sent no token, or the token names an
    -- account that no longer exists (deleted). Nothing is written.
    if p_user_id is null or not exists (select 1 from auth.users where id = p_user_id) then
      return jsonb_build_object('status', 'unknown_owner');
    end if;
    insert into public.subscriptions (
      original_transaction_id, user_id, product_id, latest_transaction_id,
      current_period_start, expires_at, revoked_at, environment
    )
    values (
      v_original, p_user_id, p_product_id, v_transaction,
      p_purchase_date, p_expires_at, p_revoked_at, p_environment
    );
    v_status := 'created';
  elsif p_user_id is not null and p_user_id <> v_sub.user_id then
    return jsonb_build_object('status', 'owned_by_other_account');
  elsif p_expires_at > v_sub.expires_at then
    update public.subscriptions
    set product_id = p_product_id,
        latest_transaction_id = v_transaction,
        current_period_start = p_purchase_date,
        expires_at = p_expires_at,
        revoked_at = p_revoked_at,
        grace_until = null,
        updated_at = now()
    where original_transaction_id = v_original;
    v_status := 'renewed';
  elsif v_transaction = v_sub.latest_transaction_id
        and p_revoked_at is distinct from v_sub.revoked_at then
    update public.subscriptions
    set revoked_at = p_revoked_at,
        updated_at = now()
    where original_transaction_id = v_original;
    v_status := case when p_revoked_at is null then 'restored' else 'revoked' end;
  else
    v_status := 'unchanged';
  end if;

  select *
    into v_sub
  from public.subscriptions
  where original_transaction_id = v_original;

  return jsonb_build_object(
    'status', v_status,
    'user_id', v_sub.user_id,
    'product_id', v_sub.product_id,
    'expires_at', v_sub.expires_at,
    'active', v_sub.revoked_at is null
      and now() < greatest(v_sub.expires_at, coalesce(v_sub.grace_until, v_sub.expires_at))
  );
end;
$$;

revoke all on function public.upsert_subscription(uuid, text, text, text, timestamptz, timestamptz, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.upsert_subscription(uuid, text, text, text, timestamptz, timestamptz, timestamptz, text)
  to service_role;

-- 9. update_subscription_renewal: auto-renew status and the billing grace
--    period, from the signed renewal info of a verified notification. A null
--    argument leaves that column as it is.
create or replace function public.update_subscription_renewal(
  p_original_transaction_id text,
  p_auto_renew boolean,
  p_grace_until timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_original text := trim(coalesce(p_original_transaction_id, ''));
  v_user uuid;
  v_was_auto_renew boolean;
begin
  if length(v_original) = 0 then
    raise exception 'p_original_transaction_id is required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('apple_sub:' || v_original, 0));

  select user_id, auto_renew
    into v_user, v_was_auto_renew
  from public.subscriptions
  where original_transaction_id = v_original
  for update;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  update public.subscriptions
  set auto_renew = coalesce(p_auto_renew, auto_renew),
      grace_until = coalesce(p_grace_until, grace_until),
      updated_at = now()
  where original_transaction_id = v_original;

  return jsonb_build_object(
    'status', 'updated',
    'user_id', v_user,
    'auto_renew_turned_off', v_was_auto_renew and p_auto_renew is false
  );
end;
$$;

revoke all on function public.update_subscription_renewal(text, boolean, timestamptz) from public, anon, authenticated;
grant execute on function public.update_subscription_renewal(text, boolean, timestamptz) to service_role;

-- 10. grant_apple_purchase: unchanged except that a profile it creates starts
--     at 0 like every new profile. Same signature, so the verify route needs
--     no change for packs.
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
  values (gen_random_uuid(), p_user_id, 'free', 0, 0)
  on conflict (user_id) do nothing;

  select credit_balance
    into v_balance
  from public.profiles
  where user_id = p_user_id
  for update;

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

-- 11. unlock_export, v2. Same signature and statuses as before, so the routes
--     keep working either side of this migration. New: the welcome grant runs
--     first; an active subscription unlocks within its cap before any credit
--     is spent; the answer says when the welcome grant was just used up and
--     when the subscription cap was the reason for a 402.
create or replace function public.unlock_export(
  p_user_id uuid,
  p_optimization_id uuid,
  p_charge boolean
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_balance integer;
  v_source text;
  v_rows integer;
  v_paid boolean;
  v_sub jsonb;
  v_cap_reached boolean := false;
  v_grant public.welcome_grants%rowtype;
  v_spent integer;
  v_free_grant_used boolean := false;
begin
  -- Step 1: the optimization must belong to this user.
  if not exists (
    select 1
    from public.optimizations
    where id = p_optimization_id
      and user_id = p_user_id
  ) then
    return jsonb_build_object('status', 'not_found');
  end if;

  -- Step 2: the welcome grant (creates the profile if needed), then lock the
  -- profile. Every unlock, grant and refund for this user waits on this lock.
  perform public.ensure_welcome_grant(p_user_id);

  insert into public.profiles (id, user_id, plan_type, optimizations_used, credit_balance)
  values (gen_random_uuid(), p_user_id, 'free', 0, 0)
  on conflict (user_id) do nothing;

  select credit_balance
    into v_balance
  from public.profiles
  where user_id = p_user_id
  for update;

  -- Analytics only: a paid user has an Apple purchase or a subscription.
  v_paid := exists (
    select 1
    from public.credit_transactions
    where user_id = p_user_id
      and source = 'apple_iap'
  ) or exists (
    select 1
    from public.subscriptions
    where user_id = p_user_id
  );

  -- Step 3: already unlocked, whatever p_charge is. No spend.
  select source
    into v_source
  from public.export_unlocks
  where user_id = p_user_id
    and optimization_id = p_optimization_id;

  if found then
    return jsonb_build_object('status', 'already_unlocked', 'source', v_source, 'balance', v_balance, 'paid_user', v_paid);
  end if;

  -- Step 4: ungated. Record it so the export stays free after the gate opens.
  if not coalesce(p_charge, false) then
    insert into public.export_unlocks (user_id, optimization_id, source)
    values (p_user_id, p_optimization_id, 'ungated')
    on conflict (user_id, optimization_id) do nothing;
    return jsonb_build_object('status', 'ungated', 'paid_user', v_paid);
  end if;

  -- Step 5: an active subscription within its fair-use cap spends nothing.
  v_sub := public.subscription_state(p_user_id);
  if coalesce((v_sub ->> 'active')::boolean, false) then
    if (v_sub ->> 'period_exports')::integer < (v_sub ->> 'period_cap')::integer then
      insert into public.export_unlocks (user_id, optimization_id, source)
      values (p_user_id, p_optimization_id, 'subscription')
      on conflict (user_id, optimization_id) do nothing;
      return jsonb_build_object(
        'status', 'unlocked',
        'source', 'subscription',
        'balance', v_balance,
        'paid_user', v_paid,
        'period_exports', (v_sub ->> 'period_exports')::integer + 1,
        'period_cap', (v_sub ->> 'period_cap')::integer
      );
    end if;
    v_cap_reached := true;
  end if;

  -- Step 6: no credit, no unlock. Nothing is written.
  if coalesce(v_balance, 0) < 1 then
    if v_cap_reached then
      return jsonb_build_object(
        'status', 'insufficient',
        'balance', 0,
        'subscription_cap_reached', true,
        'cap_resets_at', v_sub ->> 'expires_at'
      );
    end if;
    return jsonb_build_object('status', 'insufficient', 'balance', 0);
  end if;

  -- Step 7: spend exactly once.
  insert into public.export_unlocks (user_id, optimization_id, source)
  values (p_user_id, p_optimization_id, 'credit')
  on conflict (user_id, optimization_id) do nothing;

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    select source
      into v_source
    from public.export_unlocks
    where user_id = p_user_id
      and optimization_id = p_optimization_id;
    return jsonb_build_object('status', 'already_unlocked', 'source', v_source, 'balance', v_balance, 'paid_user', v_paid);
  end if;

  update public.profiles
  set credit_balance = credit_balance - 1,
      updated_at = now()
  where user_id = p_user_id
  returning credit_balance into v_balance;

  insert into public.credit_transactions (user_id, delta, reason, source, optimization_id)
  values (p_user_id, -1, 'export_unlock', 'usage', p_optimization_id);

  -- Step 8: the export that spends as many credits as the welcome grant gave
  -- marks it used up, once.
  select *
    into v_grant
  from public.welcome_grants
  where user_id = p_user_id
    and used_up_at is null;

  if found then
    select count(*)
      into v_spent
    from public.credit_transactions
    where user_id = p_user_id
      and reason = 'export_unlock'
      and created_at >= v_grant.granted_at;

    if v_spent >= v_grant.exports_granted then
      update public.welcome_grants
      set used_up_at = now()
      where user_id = p_user_id;
      v_free_grant_used := true;
    end if;
  end if;

  return jsonb_build_object(
    'status', 'unlocked',
    'source', 'credit',
    'balance', v_balance,
    'paid_user', v_paid,
    'free_grant_used', v_free_grant_used,
    'welcome_exports', case when v_free_grant_used then v_grant.exports_granted else null end
  );
end;
$$;

revoke all on function public.unlock_export(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.unlock_export(uuid, uuid, boolean) to service_role;

-- The two constants are harmless to read, but nothing outside the server needs them.
revoke all on function public.welcome_export_grant() from public, anon, authenticated;
revoke all on function public.subscription_export_cap() from public, anon, authenticated;
grant execute on function public.welcome_export_grant() to service_role;
grant execute on function public.subscription_export_cap() to service_role;
