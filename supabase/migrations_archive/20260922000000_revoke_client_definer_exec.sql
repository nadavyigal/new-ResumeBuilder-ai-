-- R1. Lock down client-callable SECURITY DEFINER functions.
--
-- Live state of project brtdyamysfmctrhuankn, read 2026-09-23 before apply:
-- ten of the eleven target functions exist. All ten are SECURITY DEFINER, take
-- the target user or row as an argument, and none references auth.uid().
--
--   * Eight are executable by PUBLIC, anon and authenticated:
--     check_subscription_limit, cleanup_old_files, generate_file_path,
--     get_ats_improvement, increment_optimization_usage,
--     increment_optimizations_used, increment_rate_limit, is_ats_v2.
--   * consume_credit and grant_apple_credits are executable by authenticated
--     but not by PUBLIC or anon; migration 20260709102900 already removed those
--     two. authenticated is the role an anonymous Supabase session holds, so
--     both are still reachable through /rest/v1/rpc with the anon key that
--     ships inside the iOS app.
--
-- upgrade_to_premium does not exist in production, so it is not a live
-- vulnerability. It stays in the list defensively. That protects only a
-- matching function present when this migration runs: a function created or
-- recreated later gets Postgres's default PUBLIC grant again and is NOT covered.
--
-- After this migration only service_role and postgres can execute them, so the
-- only path to a credit or quota change is a server route that has already
-- resolved the caller with supabase.auth.getUser().
--
-- Trigger functions are deliberately untouched: they run as the table owner on
-- INSERT/UPDATE and never appear on the RPC surface.
--
-- Revoking from PUBLIC is the part that actually does the work. Revoking from
-- anon and authenticated alone would be a no-op while the PUBLIC grant stands.
-- That same revoke would strip the server's own access, which is why the
-- service_role and postgres grants are re-applied in the same loop.
--
-- The loop keys on function name rather than an exact signature on purpose.
-- This repo carries two signature histories for is_ats_v2 and
-- get_ats_improvement (bigint and uuid) and two for cleanup_old_files and
-- generate_file_path. Naming signatures would silently miss a live overload.

do $$
declare
  target_names text[] := array[
    'grant_apple_credits',
    'consume_credit',
    'increment_optimizations_used',
    'increment_optimization_usage',
    'increment_rate_limit',
    'check_subscription_limit',
    'cleanup_old_files',
    'generate_file_path',
    'get_ats_improvement',
    'is_ats_v2',
    'upgrade_to_premium'
  ];
  fn record;
  revoked_count integer := 0;
begin
  for fn in
    select
      p.oid,
      p.proname,
      pg_get_function_identity_arguments(p.oid) as identity_args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (target_names)
      -- Skip anything wired to a trigger; those are not an RPC surface.
      and p.prorettype <> 'pg_catalog.trigger'::regtype
  loop
    execute format(
      'revoke all on function public.%I(%s) from public, anon, authenticated',
      fn.proname,
      fn.identity_args
    );
    execute format(
      'grant execute on function public.%I(%s) to service_role, postgres',
      fn.proname,
      fn.identity_args
    );
    revoked_count := revoked_count + 1;
    raise notice 'revoked client execute on public.%(%)', fn.proname, fn.identity_args;
  end loop;

  raise notice 'R1: locked down % function(s)', revoked_count;

  if revoked_count = 0 then
    raise exception 'R1: matched no functions, refusing to record a no-op migration';
  end if;
end
$$;

-- Proof to paste into the PR body, run after apply:
--
--   set local role authenticated;
--   select public.grant_apple_credits('00000000-0000-0000-0000-000000000000'::uuid, 1, 'x', 'x', 'x');
--   -- expected: ERROR permission denied for function grant_apple_credits
--   reset role;
--
-- Full remaining-grant audit, run after apply. Expect zero rows:
--
--   select p.proname,
--          pg_get_function_identity_arguments(p.oid) as args,
--          case when acl.grantee = 0 then 'PUBLIC'
--               else acl.grantee::regrole::text end as client_grantee
--   from pg_proc p
--   join pg_namespace n on n.oid = p.pronamespace
--   cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
--   where n.nspname = 'public'
--     and acl.privilege_type = 'EXECUTE'
--     and (acl.grantee = 0 or acl.grantee::regrole::text in ('anon', 'authenticated'))
--     and p.proname in (
--       'grant_apple_credits', 'consume_credit', 'increment_optimizations_used',
--       'increment_optimization_usage', 'increment_rate_limit', 'check_subscription_limit',
--       'cleanup_old_files', 'generate_file_path', 'get_ats_improvement', 'is_ats_v2',
--       'upgrade_to_premium')
--   order by 1, 2;
