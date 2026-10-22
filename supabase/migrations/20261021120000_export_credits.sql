-- Export credits: one credit unlocks one optimization for export, forever.
-- StoreKit spec docs/superpowers/specs/2026-10-15-resumely-storekit-export-credits-spec.md,
-- sections 5 and 6.2 (P3b story 1, written 2026-10-21).
--
-- NOT APPLIED. Applying it to production needs the founder's separate, explicit
-- yes (EXD-037). Apply it on its own through the Supabase MCP, then rename this
-- file to the recorded version (supabase/migrations_archive/README.md). Never
-- `db push` before the migration-history repair described there.

-- 1. New accounts start with the free export (spec 6.3). Existing balances are
--    not touched (F2).
alter table public.profiles alter column credit_balance set default 1;

create or replace function public.consume_credit(p_user_id uuid, p_reason text default 'usage'::text)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_remaining integer;
begin
  insert into public.profiles (id, user_id, plan_type, optimizations_used, credit_balance)
  values (gen_random_uuid(), p_user_id, 'free', 0, 1)
  on conflict (user_id) do nothing;

  update public.profiles
  set credit_balance = credit_balance - 1,
      updated_at = now()
  where user_id = p_user_id
    and credit_balance > 0
  returning credit_balance into v_remaining;

  if not found then
    return null;
  end if;

  insert into public.credit_transactions (user_id, delta, reason, source)
  values (p_user_id, -1, coalesce(nullif(trim(p_reason), ''), 'usage'), 'usage');

  return v_remaining;
end;
$$;

create or replace function public.grant_apple_credits(
  p_user_id uuid,
  p_delta integer,
  p_reason text,
  p_source text,
  p_apple_transaction_id text
)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_remaining integer;
  v_rows integer;
begin
  if p_delta <= 0 then
    raise exception 'p_delta must be positive';
  end if;

  if p_apple_transaction_id is null or length(trim(p_apple_transaction_id)) = 0 then
    raise exception 'p_apple_transaction_id is required';
  end if;

  insert into public.profiles (id, user_id, plan_type, optimizations_used, credit_balance)
  values (gen_random_uuid(), p_user_id, 'free', 0, 1)
  on conflict (user_id) do nothing;

  insert into public.credit_transactions (
    user_id,
    delta,
    reason,
    source,
    apple_transaction_id
  )
  values (
    p_user_id,
    p_delta,
    coalesce(nullif(trim(p_reason), ''), 'iap_purchase'),
    coalesce(nullif(trim(p_source), ''), 'apple_iap'),
    trim(p_apple_transaction_id)
  )
  on conflict (apple_transaction_id) do nothing;

  get diagnostics v_rows = row_count;

  if v_rows > 0 then
    update public.profiles
    set credit_balance = credit_balance + p_delta,
        updated_at = now()
    where user_id = p_user_id
    returning credit_balance into v_remaining;
  else
    select credit_balance
      into v_remaining
    from public.profiles
    where user_id = p_user_id;
  end if;

  return coalesce(v_remaining, 0);
end;
$$;

-- Both functions trust p_user_id. The baseline only revokes PUBLIC, and
-- Supabase default privileges grant new public functions to anon and
-- authenticated, so a fresh replay (branch, local) left them callable by any
-- client: anyone could grant themselves Apple credits. Service role only.
revoke all on function public.consume_credit(uuid, text) from public, anon, authenticated;
grant execute on function public.consume_credit(uuid, text) to service_role;
revoke all on function public.grant_apple_credits(uuid, integer, text, text, text) from public, anon, authenticated;
grant execute on function public.grant_apple_credits(uuid, integer, text, text, text) to service_role;

-- 2. Ledger columns for purchases and refunds (spec 5). Refund rows point at
--    the grant through related_apple_transaction_id; apple_transaction_id stays
--    unique to the grant row.
alter table public.credit_transactions
  add column if not exists optimization_id uuid references public.optimizations(id) on delete set null,
  add column if not exists product_id text,
  add column if not exists environment text check (environment in ('Production', 'Sandbox')),
  add column if not exists apple_notification_uuid text unique,
  add column if not exists related_apple_transaction_id text;

-- 3. One row per exported optimization. The primary key is the idempotency key.
create table if not exists public.export_unlocks (
  user_id uuid not null references auth.users(id) on delete cascade,
  optimization_id uuid not null references public.optimizations(id) on delete cascade,
  source text not null check (source in ('credit', 'ungated')),
  created_at timestamptz not null default now(),
  primary key (user_id, optimization_id)
);

alter table public.export_unlocks enable row level security;

drop policy if exists "Users read own export unlocks" on public.export_unlocks;
create policy "Users read own export unlocks"
  on public.export_unlocks for select using (auth.uid() = user_id);

revoke insert, update, delete, truncate on public.export_unlocks from anon, authenticated;

-- 4. unlock_export (spec 6.2). One call is one transaction. The profile row
--    lock serializes every unlock, grant and refund for this user, charged or
--    not, so two requests for the same optimization spend at most one credit.
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

  -- Step 2: make sure the profile exists, then lock it.
  insert into public.profiles (id, user_id, plan_type, optimizations_used, credit_balance)
  values (gen_random_uuid(), p_user_id, 'free', 0, 1)
  on conflict (user_id) do nothing;

  select credit_balance
    into v_balance
  from public.profiles
  where user_id = p_user_id
  for update;

  -- Analytics only (spec 10.3): a paid user has any Apple purchase row.
  v_paid := exists (
    select 1
    from public.credit_transactions
    where user_id = p_user_id
      and source = 'apple_iap'
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

  -- Step 5: no credit, no unlock. Nothing is written.
  if coalesce(v_balance, 0) < 1 then
    return jsonb_build_object('status', 'insufficient', 'balance', 0);
  end if;

  -- Step 6: spend exactly once.
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

  return jsonb_build_object('status', 'unlocked', 'balance', v_balance, 'paid_user', v_paid);
end;
$$;

-- Service role only (the R1 pattern): the function trusts p_user_id.
revoke all on function public.unlock_export(uuid, uuid, boolean) from public;
revoke all on function public.unlock_export(uuid, uuid, boolean) from anon;
revoke all on function public.unlock_export(uuid, uuid, boolean) from authenticated;
grant execute on function public.unlock_export(uuid, uuid, boolean) to service_role;
