-- Grandfather existing free users before monetization (EXD-009 companion).
-- Do not apply to production without explicit founder go-ahead.
-- Backfill: run scripts/backfill-legacy-free-access.sql at ship time.

alter table public.profiles
  add column if not exists legacy_free_access boolean not null default false;

comment on column public.profiles.legacy_free_access is
  'When true, user keeps full free access regardless of paywall/credit enforcement. Set via one-time backfill for accounts created before monetization cutoff.';

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

  -- Legacy grandfathered users: skip deduction, return current balance.
  select credit_balance
    into v_remaining
  from public.profiles
  where user_id = p_user_id
    and legacy_free_access = true;

  if found then
    return v_remaining;
  end if;

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
