# Supabase key swap on Vercel (2026-11-22)

Why: the legacy Supabase `anon` and `service_role` keys for project
`brtdyamysfmctrhuankn` were committed to git and are still in history.
We move every surface to the new keys, then disable the legacy keys.

No key values belong in this file, in git, or in chat.

## State

- 2026-11-22: new keys created in Supabase (API Keys page), both named `default`:
  a publishable key (`sb_publishable_...`) and a secret key (`sb_secret_...`).
- 2026-11-25 11:58 UTC: legacy keys disabled (founder). iOS 1.6.0 and older lose sign-in until users
  install the build with `sb_publishable_`.
- 2026-11-22: Vercel production moved to the new keys and redeployed (no build cache).
  Verified on www.resumelybuilderai.com: browser bundle has only `sb_publishable_`;
  Supabase API log shows `/auth/v1/user` 200 with `sb_publishable_` and server
  storage reads 200 with `sb_secret_`; dashboard and applications list load.

## Gotchas found on 2026-11-22

- Vercel refuses the Secret type for `NEXT_PUBLIC_` vars. Save the publishable key as Config.
- The old production `SUPABASE_SERVICE_ROLE_KEY` was Config (readable). It is Secret now.
- A publishable key pasted into `SUPABASE_SERVICE_ROLE_KEY` gives RLS 401s on writes, not
  a startup error. Check the key type in Supabase Logs Explorer:
  `request.sb.apikey.apikey.prefix` on `edge_logs`.
- Saving a Vercel env var offers a Redeploy prompt. A redeploy started before both values
  are saved ships a mixed build; redeploy again once both are saved.
- Production redeploy asks for the founder's passkey.

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

## Surface status (2026-11-22)

| Surface | Key | Status |
|---|---|---|
| Web production (Vercel `new-resume-builder-ai`) | publishable + secret | Done, verified on live site and Supabase API log |
| `delete_account` edge function (iOS repo) | `SUPABASE_SECRET_KEYS.default` | Done: v4 deployed, `verify_jwt = false`; probes 401/401/405; manual E2E delete test PASSED (founder, simulator, test user removed from Supabase) |
| `storekit-verify`, `ambassador-reward` (this repo) | none today | Not deployed (404) and stubs that return 501 without reading a key. Code comments now require `SUPABASE_SECRET_KEYS` when built |
| Database: cron, `pg_net`, webhooks | none | Checked: no job or webhook holds a key |
| CI (`.github/workflows/ci.yml`) | placeholders | No change needed |
| iOS app `Secrets.xcconfig` `SUPABASE_ANON_KEY` | publishable | Local file updated on the founder's Mac; ships with the next App Store build (iOS PR #246) |
| iOS 1.6.0 and older, already installed | legacy anon | Broken since 2026-11-25 11:58 UTC: sign-in fails until users update |

## Stale Vercel copies (safe to delete)

Branch-scoped Preview vars on branch `claude/2026-11-22-supabase-key-swap`:
`SUPABASE_SERVICE_ROLE_KEY` (Secret) and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Config).
They hold the same new keys as All Environments, so deleting them changes nothing.
Delete both after this PR merges (Vercel > Environment Variables > search SUPABASE > row menu > Delete).

## Checklist before disabling legacy keys (item 4 overridden by founder decision in item 5)

1. [x] Web production on new keys.
2. [x] `delete_account` on the new secret key; E2E delete test passed.
3. [x] No database job, webhook or CI uses a key.
4. [ ] An iOS build with `sb_publishable_` in `Secrets.xcconfig` is live on the App Store.
5. [x] Old app versions: founder chose on 2026-11-25 to disable now (option a). Reason: on 2026-11-25
   01:52 UTC a scanner (python-httpx, Germany, hosting network) called `GET /rest/v1/` with the leaked
   `service_role` key and got 200, which returns the table list. iOS 1.6.0 and older lose sign-in until
   users install the build from item 4.
6. [x] Skipped the 7-day wait (item 5). Checked 2026-11-22 to 11-25: only Vercel before the swap, a founder test
   script, and the scanner. Use this query after disabling to find callers that broke:
   `select timestamp, event_message, log_attributes from logs where source = 'edge_logs' order by timestamp desc limit 500`
   and look at `request.sb.apikey.apikey.prefix` (legacy shows a JWT, not `sb_`).
7. [x] Legacy keys disabled by the founder on 2026-11-25 at 11:58:16 UTC. Verified right after:
   legacy `service_role` on `GET /rest/v1/` returns 401 "Legacy API keys are disabled"; publishable key
   `/auth/v1/settings` 200; live site dashboard and applications list load, `/api/v1/applications` 200;
   edge_logs after the change show only `sb_publishable_` and `sb_secret_` calls, all 200 except one 400 that
   predates this work (`design_templates.ats_score` does not exist, `src/app/api/v1/applications/route.ts:296`).
   Do not re-enable: the keys leaked and a scanner used them.
