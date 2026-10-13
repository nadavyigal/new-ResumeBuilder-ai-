-- Close two confirmed privilege-escalation holes.
--
-- Proven by live probe on 2026-08-11 with an ordinary `authenticated` JWT
-- against production, using only the public anon key that ships in the app:
--   * PATCH /rest/v1/profiles            -> credit_balance set to 9999 (HTTP 200, persisted)
--   * POST  /rest/v1/credit_transactions -> forged 9999 ledger row      (HTTP 201)
-- `plan_type` and `role` live on the same profiles row and gate premium
-- features (see the `plan_type === 'premium'` checks in the chat and
-- expert-workflow routes), so the same PATCH also granted entitlements.
--
-- Root cause: anon and authenticated held Supabase's default blanket
-- INSERT/UPDATE/DELETE/TRUNCATE grants on both tables, and the RLS policies
-- were permissive `{public}` policies keyed only on `auth.uid() = user_id` --
-- which authorises writing your OWN row, including the columns that represent
-- money. RLS cannot restrict columns, so the grant is the correct control.
-- TRUNCATE bypasses RLS altogether and was also granted.
--
-- Pre-existing, not introduced by anonymous sign-in: any of the 35 real users
-- could always have done this. Enabling anonymous auth would have made it free
-- and unlimited (mint identities via curl, no account required), which is how
-- it was found.
--
-- Safe because nothing legitimate writes these tables from a client:
--   * `updateProfile` / `createProfile` in src/lib/supabase/auth.ts are dead
--     code with zero call sites.
--   * iOS never touches either table directly; it goes through API routes.
--   * Every server-side usage is a .select(); the only writers are SECURITY
--     DEFINER functions owned by postgres (`consume_credit`, `handle_new_user`),
--     which bypass both RLS and grants. Verified by running consume_credit
--     after this migration: balance moved 3 -> 2 as expected.
-- SELECT is deliberately retained; RLS already scopes it to the caller's row.
--
-- Verified after applying, same three requests: all now 403 "permission denied",
-- while a legitimate read of one's own profile still returns 200.

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.profiles FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.credit_transactions FROM anon, authenticated;

-- Drop the policies that authorised those writes, so the intent is readable in
-- the schema rather than surviving as dead permissions a future GRANT re-arms.
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own credit transactions" ON public.credit_transactions;
