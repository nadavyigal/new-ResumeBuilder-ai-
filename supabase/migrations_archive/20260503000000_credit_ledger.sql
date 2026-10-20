alter table public.profiles
  add column if not exists credit_balance integer not null default 3;

create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  delta integer not null,
  reason text not null,
  source text not null default 'system',
  apple_transaction_id text unique,
  created_at timestamptz not null default now()
);

create index if not exists idx_credit_transactions_user_created_at
  on public.credit_transactions (user_id, created_at desc);

alter table public.credit_transactions enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'credit_transactions'
      and policyname = 'Users can view own credit transactions'
  ) then
    create policy "Users can view own credit transactions"
      on public.credit_transactions
      for select
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'credit_transactions'
      and policyname = 'Users can insert own credit transactions'
  ) then
    create policy "Users can insert own credit transactions"
      on public.credit_transactions
      for insert
      with check (auth.uid() = user_id);
  end if;
end $$;

create or replace function public.consume_credit(
  p_user_id uuid,
  p_reason text default 'usage'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remaining integer;
begin
  insert into public.profiles (id, user_id, plan_type, optimizations_used, credit_balance)
  values (gen_random_uuid(), p_user_id, 'free', 0, 3)
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

grant execute on function public.consume_credit(uuid, text) to authenticated;

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
set search_path = public
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
  values (gen_random_uuid(), p_user_id, 'free', 0, 3)
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

grant execute on function public.grant_apple_credits(uuid, integer, text, text, text) to authenticated;
