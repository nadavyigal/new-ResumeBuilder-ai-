create table if not exists public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  apns_token text not null,
  platform text not null default 'ios',
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, apns_token)
);

create index if not exists idx_device_tokens_user_last_seen
  on public.device_tokens (user_id, last_seen_at desc);

alter table public.device_tokens enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'device_tokens'
      and policyname = 'Users can view own device tokens'
  ) then
    create policy "Users can view own device tokens"
      on public.device_tokens
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
      and tablename = 'device_tokens'
      and policyname = 'Users can upsert own device tokens'
  ) then
    create policy "Users can upsert own device tokens"
      on public.device_tokens
      for insert
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'device_tokens'
      and policyname = 'Users can delete own device tokens'
  ) then
    create policy "Users can delete own device tokens"
      on public.device_tokens
      for delete
      using (auth.uid() = user_id);
  end if;
end $$;
