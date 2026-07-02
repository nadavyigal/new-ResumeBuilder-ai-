-- One-time backfill: grandfather existing users before monetization ships.
-- Run at ship time only — NOT during development.
--
-- Usage:
--   1. Replace <CUTOFF_TIMESTAMP> with the exact timestamptz when paywall goes live.
--   2. Review the row count before committing.
--   3. Run against production only with explicit founder approval.
--
-- Example cutoff: '2026-07-15 00:00:00+00'

begin;

update public.profiles
set legacy_free_access = true,
    updated_at = now()
where created_at < '<CUTOFF_TIMESTAMP>'::timestamptz
  and legacy_free_access = false;

-- Verify:
-- select count(*) from public.profiles where legacy_free_access = true;

commit;
