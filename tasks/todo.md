# Todo — ResumeBuilder Web

> Open items only. Completed work moves to `tasks/progress.md`.

## Blocking

- [ ] **Apply migration `20260720000000_anonymous_carryover_artifacts.sql`** to the ResumeBuilder AI Supabase project (`brtdyamysfmctrhuankn`). Until this runs, the WP-49 carryover degrades to score-only (the code detects the missing columns and falls back, so nothing breaks — but the feature is inert).
- [ ] Live-verify WP-49 end to end: anonymous check → signup → dashboard shows one-click "Optimize This Resume" → review page renders. Not yet verified against a real signup.

## Follow-ups

- [ ] Privacy Policy (`privacy` block in `src/messages/en.json` / `he.json`) likely needs a line covering short-term retention of anonymous resume text. The landing bullet was corrected in WP-49; the policy page was not touched.
- [ ] `anonymous_ats_scores.optimization_id` is still never populated. Linking the optimization produced from a carried session would close the loop on conversion attribution.
- [ ] Anonymous sessions that end in **sign-in** (existing account) rather than signup never convert — `auth-form.tsx` only calls `convertPendingAtsSession` on the signup path.

## Deferred (from WP-43)

- [ ] Tier B: DOCX support on the free ATS path.
- [ ] Tier B: resume-only first score before asking for the job description.
