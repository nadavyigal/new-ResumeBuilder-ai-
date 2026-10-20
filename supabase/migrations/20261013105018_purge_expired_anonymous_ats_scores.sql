-- Daily purge of expired, never-converted anonymous free-check rows.
--
-- public.anonymous_ats_scores rows carry a 7-day expires_at
-- (20251225000000_add_anonymous_scoring.sql), and since
-- 20260720000000_anonymous_carryover_artifacts.sql unconverted rows also hold
-- the parsed resume_text and job_description_text. Nothing ever deleted them:
-- on 2026-10-13 production held 105 expired rows, 3 of them with resume text
-- (the oldest from 2026-08-14), and pg_cron was not installed.
--
-- Scope: only rows that were never claimed by an account (user_id is null).
-- A converted row is the record that a free check became a signup (and, via
-- linkCarryoverOptimization, which optimization it produced); its carryover
-- text is cleared at materialization. If the account is later deleted, the
-- foreign key sets user_id to null and the row becomes eligible here.
--
-- Install SQL follows https://supabase.com/docs/guides/cron/install.
-- cron.schedule with a job name updates that job if it already exists, so
-- re-running this migration does not create a duplicate schedule.
--
-- The extension is created only when absent: on Supabase,
-- `create extension if not exists pg_cron` still runs the platform's
-- after-create script, which fails with "dependent privileges exist" when
-- pg_cron is already installed (for example, enabled from the dashboard).

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    create extension pg_cron with schema pg_catalog;
  end if;
end
$$;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

select cron.schedule(
  'purge-expired-anonymous-ats-scores',
  '17 3 * * *', -- daily at 03:17 UTC
  $$
    delete from public.anonymous_ats_scores
    where expires_at < now()
      and user_id is null
  $$
);
