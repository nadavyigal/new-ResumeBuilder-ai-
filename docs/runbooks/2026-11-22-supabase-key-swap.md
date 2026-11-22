# Supabase key swap on Vercel (2026-11-22)

Why: the legacy Supabase `anon` and `service_role` keys for project
`brtdyamysfmctrhuankn` were committed to git and are still in history.
We move every surface to the new keys, then disable the legacy keys.

No key values belong in this file, in git, or in chat.

## State

- 2026-11-22: new keys created in Supabase (API Keys page), both named `default`:
  a publishable key (`sb_publishable_...`) and a secret key (`sb_secret_...`).
- Legacy keys still work. Do not disable them until every surface below is moved:
  iOS 1.6.0 still ships the legacy anon key.

## Vercel project `new-resume-builder-ai`

The code keeps the same env var names. Only the values change.

| Env var | New value from Supabase API Keys |
|---|---|
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | publishable key `default` |
| `SUPABASE_SERVICE_ROLE_KEY` | secret key `default` |
| `NEXT_PUBLIC_SUPABASE_URL` | unchanged |

`src/lib/env.ts` only checks length (min 20), so `sb_` keys pass validation.
`@supabase/supabase-js` 2.57 and `@supabase/ssr` 0.7 accept the new keys.

## Order

1. Preview first. Add both vars as **Preview** vars scoped to the git branch
   `claude/2026-11-22-supabase-key-swap`. A branch-scoped Preview var overrides the
   All Environments value for that branch only. Production is untouched.
2. Redeploy that branch's Preview. Test:
   - sign in with email (anon/publishable key, browser and server cookies)
   - open the dashboard and one saved resume (RLS reads)
   - one server route that uses the service role: run a free ATS check
     (`src/app/api/public/ats-check/route.ts`) and open the applications list
     (`src/app/api/v1/applications/route.ts`)
3. If all pass: edit the All Environments values of both vars to the new keys,
   redeploy production, run the same three checks on www.resumelybuilderai.com.
4. Delete the two branch-scoped Preview vars.
5. Rollback: Vercel Instant Rollback to the previous production deployment. The
   legacy keys stay valid until step 6, so rollback is safe.

## Still to move before disabling legacy keys

- `supabase/functions/storekit-verify/index.ts` and `ambassador-reward/index.ts` (this repo)
- `supabase/functions/delete_account/index.ts` (iOS repo)
- iOS `Secrets.xcconfig` `SUPABASE_ANON_KEY`, shipped in a new iOS build
- Then: disable legacy keys in Supabase, and never re-enable them.
