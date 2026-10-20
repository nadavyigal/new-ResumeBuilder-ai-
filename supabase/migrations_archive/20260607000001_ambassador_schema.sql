-- Plan 4: Ambassador Flow — "I Got Hired"
-- GATED: Do not apply until Plan 3 (paywall) is live AND first export cohort is 3+ weeks old.
--
-- NOTE: user_exports table may not exist in this schema yet (exports currently live in storage).
-- This migration creates it if absent, then adds ambassador tracking columns.
-- If user_exports already exists in your schema, the CREATE TABLE block is a no-op.

-- Ensure user_exports table exists
create table if not exists user_exports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default now(),
  ats_score_before integer,
  ats_score_after integer,
  job_title text
);

-- Add ambassador tracking columns (idempotent)
alter table user_exports
  add column if not exists ambassador_status text
    check (ambassador_status in ('pending', 'yes_hired', 'not_yet', 'dismissed'))
    default 'pending',
  add column if not exists ambassador_notified_at timestamptz,
  add column if not exists ambassador_responded_at timestamptz;

-- Track notification scheduling
create table if not exists ambassador_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  export_id uuid references user_exports(id) not null,
  scheduled_for timestamptz not null,
  triggered_at timestamptz,
  response text check (response in ('yes_hired', 'not_yet', 'dismissed'))
);

-- RLS
alter table user_exports enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'user_exports' and policyname = 'Users read own exports'
  ) then
    create policy "Users read own exports"
      on user_exports for select
      using (auth.uid() = user_id);
  end if;
end $$;

alter table ambassador_notifications enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'ambassador_notifications' and policyname = 'Users read own ambassador notifications'
  ) then
    create policy "Users read own ambassador notifications"
      on ambassador_notifications for select
      using (auth.uid() = user_id);
  end if;
end $$;
