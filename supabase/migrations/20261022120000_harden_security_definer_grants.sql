-- Lock down EXECUTE on every SECURITY DEFINER function in public.
--
-- The production baseline (20261012000000) only runs
-- `revoke all ... from public` on these functions. On a fresh replay
-- (Supabase branch, local database), Supabase's default privileges have
-- already granted each new public function to anon and authenticated, so
-- the revoke from PUBLIC leaves them callable by any client through
-- PostgREST /rpc. A SECURITY DEFINER function runs as its owner (postgres)
-- and bypasses RLS: get_ats_improvement reads any user's scores by id,
-- increment_optimizations_used spends any user's quota, consume_credit and
-- grant_apple_credits move any user's credits.
--
-- The baseline dump suggests production already grants the RPC functions
-- to service_role only, but production ACLs were not read for this change.
-- Every statement here is idempotent, so running it where the grants are
-- already correct changes nothing.
--
-- Who calls what (grep of src/ on 2026-10-22):
--   increment_rate_limit   src/lib/rate-limiting/check-rate-limit.ts, service-role client
--   consume_credit         src/lib/credits.ts, service-role client
--   grant_apple_credits    src/app/api/v1/iap/verify/route.ts, service-role client
--   check_subscription_limit  only AuthClient in src/lib/supabase/auth.ts, which
--                          nothing imports; the function always returns true
--   all other RPC functions below: no caller in src/
--
-- Trigger functions need no client EXECUTE at all: Postgres checks EXECUTE
-- on a trigger function only when the trigger is created, never when it
-- fires. scripts/tests/security-definer-grants-local-db.mjs proves the
-- triggers still fire for authenticated users and for signups.
--
-- consume_credit and grant_apple_credits repeat the statements from the
-- export-credits migration (PR #195), so either merge order ends in the
-- same state.

-- RPC functions: service_role only.
revoke all on function public.check_subscription_limit(uuid) from public, anon, authenticated;
grant execute on function public.check_subscription_limit(uuid) to service_role;

revoke all on function public.cleanup_old_files(text, integer) from public, anon, authenticated;
grant execute on function public.cleanup_old_files(text, integer) to service_role;

revoke all on function public.consume_credit(uuid, text) from public, anon, authenticated;
grant execute on function public.consume_credit(uuid, text) to service_role;

revoke all on function public.generate_file_path(uuid, text, text) from public, anon, authenticated;
grant execute on function public.generate_file_path(uuid, text, text) to service_role;

revoke all on function public.get_ats_improvement(uuid) from public, anon, authenticated;
grant execute on function public.get_ats_improvement(uuid) to service_role;

revoke all on function public.grant_apple_credits(uuid, integer, text, text, text) from public, anon, authenticated;
grant execute on function public.grant_apple_credits(uuid, integer, text, text, text) to service_role;

revoke all on function public.increment_optimization_usage(uuid) from public, anon, authenticated;
grant execute on function public.increment_optimization_usage(uuid) to service_role;

revoke all on function public.increment_optimizations_used(uuid, integer) from public, anon, authenticated;
grant execute on function public.increment_optimizations_used(uuid, integer) to service_role;

revoke all on function public.increment_rate_limit(text, text, bigint) from public, anon, authenticated;
grant execute on function public.increment_rate_limit(text, text, bigint) to service_role;

revoke all on function public.is_ats_v2(uuid) from public, anon, authenticated;
grant execute on function public.is_ats_v2(uuid) to service_role;

-- Trigger functions: no client role. The owner keeps EXECUTE.
revoke all on function public.applications_update_search() from public, anon, authenticated, service_role;
revoke all on function public.assign_default_template() from public, anon, authenticated, service_role;
revoke all on function public.handle_new_user() from public, anon, authenticated, service_role;
revoke all on function public.update_applications_updated_at() from public, anon, authenticated, service_role;
revoke all on function public.update_session_activity() from public, anon, authenticated, service_role;
