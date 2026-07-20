# Session Log — ResumeBuilder Web

> Newest first. One entry per working session. Narrative detail lives in `tasks/progress.md`.

## 2026-07-20 — WP-49 anonymous ATS carryover (WP-29 S5)

**Worked on:** carrying the anonymous ATS check result through signup into the new account.

**Completed:** resume text + job description now persist on the anonymous session and are materialized into owned `resumes` / `job_descriptions` rows at conversion, on both the instant-confirm and email-confirmation paths. Dashboard offers a one-click optimize from the carried artifacts. Migration written, guarded against being unapplied, and covered by tests (36/36 targeted green, red-state verified).

**Decisions:** server-side persistence on the existing `anonymous_ats_scores` row rather than a signed client token — resume text is too large for a token, is PII, and a client-held token does not survive email confirmation on another device. Anonymous copies are cleared as soon as the user owns them.

**Next session:** apply migration `20260720000000` to the ResumeBuilder AI project (`brtdyamysfmctrhuankn`), then run a live signup and confirm the dashboard offers the one-click optimize. Consider a matching Privacy Policy line about short-term anonymous resume retention.

**Not done:** migration not applied, nothing deployed, no live end-to-end verification.
