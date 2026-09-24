# Todo — ResumeBuilder Web

> Open items only. Completed work moves to `tasks/progress.md`.

## Blocking

- [ ] **Apply migration `20260720000000_anonymous_carryover_artifacts.sql`** to the ResumeBuilder AI Supabase project (`brtdyamysfmctrhuankn`). Until this runs, the WP-49 carryover degrades to score-only (the code detects the missing columns and falls back, so nothing breaks — but the feature is inert).
- [ ] Live-verify WP-49 end to end: anonymous check → signup → dashboard shows one-click "Optimize This Resume" → review page renders. Not yet verified against a real signup.

## Security triage (from R1, 2026-09-23)

- [ ] **Five trigger functions still flagged by Supabase advisors 0028 and 0029** in `brtdyamysfmctrhuankn`: `applications_update_search`, `assign_default_template`, `handle_new_user`, `update_applications_updated_at`, `update_session_activity`. All are `SECURITY DEFINER`, return `trigger`, are bound in `pg_trigger`, and are still executable by `PUBLIC`, `anon` and `authenticated`. Postgres refuses to run a trigger function outside a trigger, so the likely exposure is low, but that is an expectation, not a test. Triage: try each via `/rest/v1/rpc` as `anon` to confirm it is refused, then decide whether to revoke `EXECUTE` (triggers do not need it) so the advisors go quiet. Deliberately left out of R1, which excluded trigger functions by design.
- [ ] **Post-apply authenticated smoke test for R1 was never run.** Sign in as an email-and-password account and run the R1 smoke script against production: `/api/ats/score` and `/api/v1/refine-section` must return 200 or `402 insufficient_credits`, never `500 credit_consume_failed`. Details in the 2026-09-23 R1 entry of `tasks/progress.md`.

## Follow-ups

- [ ] Privacy Policy (`privacy` block in `src/messages/en.json` / `he.json`) likely needs a line covering short-term retention of anonymous resume text. The landing bullet was corrected in WP-49; the policy page was not touched.
- [ ] `anonymous_ats_scores.optimization_id` is still never populated. Linking the optimization produced from a carried session would close the loop on conversion attribution.
- [ ] Anonymous sessions that end in **sign-in** (existing account) rather than signup never convert — `auth-form.tsx` only calls `convertPendingAtsSession` on the signup path.

## Deferred (from WP-43)

- [ ] Tier B: DOCX support on the free ATS path.
- [ ] Tier B: resume-only first score before asking for the job description.
