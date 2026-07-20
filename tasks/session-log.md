# Session Log — ResumeBuilder Web

> Newest first. One entry per working session. Narrative detail lives in `tasks/progress.md`.

## 2026-07-20 — WP-49 anonymous ATS carryover (WP-29 S5)

**Worked on:** carrying the anonymous ATS check result through signup into the new account.

**Completed:** resume text + job description now persist on the anonymous session and are materialized into owned `resumes` / `job_descriptions` rows at conversion, on both the instant-confirm and email-confirmation paths. Dashboard offers a one-click optimize from the carried artifacts. Migration written, guarded against being unapplied, and covered by tests (36/36 targeted green, red-state verified).

**Decisions:** server-side persistence on the existing `anonymous_ats_scores` row rather than a signed client token — resume text is too large for a token, is PII, and a client-held token does not survive email confirmation on another device. Anonymous copies are cleared as soon as the user owns them.

**Next session:** apply migration `20260720000000` to the ResumeBuilder AI project (`brtdyamysfmctrhuankn`), then run a live signup and confirm the dashboard offers the one-click optimize. Consider a matching Privacy Policy line about short-term anonymous resume retention.

**Not done:** migration not applied, nothing deployed, no live end-to-end verification.

## 2026-07-20 — WP-49 hold cleared: carryover reads survive an unapplied migration

PR #117 was held (not rejected) on a deploy-ordering hazard. The WP-39-style 42703/PGRST204
guard covered only the `ats-check` insert; the three read paths selected the six new columns
with no fallback. Merging and deploying ahead of the migration would have made those selects
fail, `anonScore` come back null, and the `.update()` setting `user_id`/`converted_at` never
run - silently stopping session conversion, which works in production today.

- Added `selectAnonymousScoreWithFallback` to `src/lib/anonymous-carryover.ts`: try the wide
  column list, retry with the pre-migration narrow list on 42703/PGRST204.
- Applied to all three reads: `auth/callback/route.ts`, and `convert-session/route.ts` GET + POST.
- Materialization is skipped when the row was read without the carryover columns; conversion
  still completes. This also covers the PostgREST schema-cache reload window.
- Moved `isUndefinedColumnError` into the shared lib so there is one definition. `ats-check`
  behavior unchanged.
- Privacy Policy (EN + HE) now documents short-term anonymous resume retention. The 7-day figure
  is the existing `expires_at` default from migration 20251225000000, not an invented number.

Validation: tsc 0 `src/` errors, matching the pre-change baseline measured by stashing the diff.
eslint clean on all touched files. Contracts suite 51 passed / 9 failed - the same 9 failures in
the same 5 suites occur on the untouched baseline, so no regression. The 3 new tests were verified
to FAIL when the fallback is disabled, so they genuinely pin the invariant.

The migration was deliberately NOT applied - that needs explicit founder approval.

Not done: PR triage (#112 expert apply finalize, #100 grandfather free users).
