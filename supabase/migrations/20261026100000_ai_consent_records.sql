-- Durable record of the iOS "résumé and job text go to OpenAI" consent.
--
-- NOT APPLIED. Applying it to production needs the founder's separate, explicit
-- yes. Apply it on its own through the Supabase dashboard or MCP, then archive
-- it the same way as the export-credits migration. Never `db push` before the
-- migration-history repair described in supabase/migrations_archive/README.md.
--
-- The API writes this with the service role, and only for the user id taken
-- from the bearer token. Clients cannot read or write the table. AI routes do
-- not read it yet, so an installed app that has not called the new endpoint
-- keeps working.

create table if not exists public.ai_consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  consent_version text not null,
  action text not null check (action in ('grant', 'withdraw')),
  recorded_at timestamptz not null default now(),
  client_recorded_at timestamptz
);

create index if not exists ai_consent_records_user_recorded_idx
  on public.ai_consent_records (user_id, recorded_at desc);

alter table public.ai_consent_records enable row level security;

revoke all on table public.ai_consent_records from public;
revoke all on table public.ai_consent_records from anon;
revoke all on table public.ai_consent_records from authenticated;
grant select, insert on table public.ai_consent_records to service_role;
