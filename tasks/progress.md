# Project Progress

## 2026-07-03 — WP-29 S4 Premium CTA gate
WP-29 S4 completed on branch `codex/wp29-s4-disable-premium-cta`.

Completed:
- Recorded the founder decision in Agentic OS `DECISIONS.md`: choose option A and keep Premium CTAs hidden/disabled until Gate A opens.
- Added a central `MONETIZATION_GATE_OPEN = false` product gate.
- Disabled the Premium pricing CTA and replaced it with an unavailable state instead of linking signed-in users into the signup/dashboard redirect loop.
- Disabled in-app upgrade actions in the paywall modal and Expert Modes panel while preserving preview behavior.
- Guarded `/api/upgrade` so checkout sessions cannot be created while Gate A is closed.
- Added focused regression coverage for the disabled pricing CTA and closed upgrade endpoint.

Validation:
- `npm test -- tests/contracts/upgrade-expert-source.test.ts tests/app/pricing-monetization-gate.test.tsx --runInBand` passed, 2/2 tests.
- `npm run check:i18n` passed with 0 missing HE strings and 0 invalid strings.
- `npx eslint 'src/app/[locale]/pricing/page.tsx' src/app/api/upgrade/route.ts src/components/paywall/upgrade-modal.tsx src/components/expert/ExpertModesPanel.tsx src/lib/monetization-gate.ts tests/contracts/upgrade-expert-source.test.ts tests/app/pricing-monetization-gate.test.tsx` passed.
- `npm run lint` passed with existing warnings only.
- `npm run build` passed.
- `npx tsc --noEmit` still fails on pre-existing contract/security test typing and stale export errors, none in touched S4 files.

Not done:
- Did not wire Stripe or open Gate A.
- Did not start WP-29 S5.

## 2026-07-03 — WP-29 S3 word-count and error preservation
WP-29 S3 completed on branch `codex/wp29-s3-word-count-errors`.

Completed:
- Added `PUBLIC_ATS_MIN_JOB_DESCRIPTION_WORDS = 100` and reused it in the landing upload form and `api/public/ats-check`.
- Updated EN/HE base and funnel copy so the visible minimum no longer falls back to 80 words.
- Changed the public checker to surface server `error` strings verbatim instead of remapping them to stale UI copy.
- Kept `UploadForm` mounted during processing/failure so a failed check preserves the selected PDF and job description text.
- Added focused coverage for a 90-word server rejection and for forced server 400 preservation in the landing checker.

Validation:
- `npm test -- tests/api/ats-check-resume-id-route.test.ts tests/app/free-ats-checker-failure-preserves-input.test.tsx --runInBand` passed, 6/6 tests.
- `npm run check:i18n` passed with 0 missing HE strings and 0 invalid strings.
- `npx eslint src/app/api/public/ats-check/route.ts src/components/landing/FreeATSChecker.tsx src/components/landing/UploadForm.tsx tests/api/ats-check-resume-id-route.test.ts tests/app/free-ats-checker-failure-preserves-input.test.tsx` passed.
- `git diff --check` passed.
- `npm run lint` passed with existing warnings only.
- `npm run build` passed.
- `npx tsc --noEmit` still fails on pre-existing contract/security test typing and stale export errors, none in touched S3 files.

Not done:
- Did not start WP-29 S4. S4 remains a founder decision gate before any implementation.

## 2026-07-03 — WP-29 S2 missing EN funnel messages
WP-29 S2 completed on branch `codex/wp29-s2-en-funnel-messages`.

Completed:
- Added EN funnel override copy for `landing.score.mainIssues.*` and `landing.popup.*` in `src/messages-overrides/funnel/en.json`.
- Copy follows Fit/Match positioning: role fit, parsing, recruiter clarity, full fix plan. It does not use "ATS score", "pass ATS", "beat bots", or guaranteed-outcome framing.
- Added `tests/contracts/funnel-i18n-parity.test.ts` so the critical funnel namespaces keep matching EN/HE leaf keys after runtime message merging.

Validation:
- `jq . src/messages-overrides/funnel/en.json` passed.
- `npm test -- tests/contracts/funnel-i18n-parity.test.ts --runInBand` passed, 2/2 tests.
- `npm run check:i18n` passed with 0 missing HE strings and 0 invalid strings.
- `npx eslint tests/contracts/funnel-i18n-parity.test.ts` passed.
- `git diff --check` passed.
- `npm run lint` passed with existing warnings only.
- `npm run build` passed.
- `npx tsc --noEmit` still fails on pre-existing contract/security test typing and stale export errors, none in touched S2 files.

Not done:
- Did not start WP-29 S3.

## 2026-07-03 — WP-29 S1 optimization review crash guard
WP-29 S1 completed on branch `codex/wp29-s1-optimization-review-crash`.

Completed:
- Confirmed `src/app/[locale]/dashboard/optimizations/[id]/page.tsx` already wraps the optimization review tree in `SectionSelectionProvider` on current `origin/main`, covering both `DesignRenderer` and `ChatSidebar`.
- Added regression coverage in `tests/app/optimization-review-section-provider.test.tsx`:
  - source-level guard that `DesignRenderer` and `ChatSidebar` stay inside `SectionSelectionProvider`
  - render-level guard proving the real review consumers throw the production error without the provider and render with it

Validation:
- `npm test -- tests/app/optimization-review-section-provider.test.tsx --runInBand` passed, 2/2 tests.
- `npx eslint 'src/app/[locale]/dashboard/optimizations/[id]/page.tsx' tests/app/optimization-review-section-provider.test.tsx` passed.
- `git diff --check` passed.
- `npm run lint` passed with existing warnings only.
- `npm run build` passed.
- `npx tsc --noEmit` still fails on pre-existing contract/security test typing and stale export errors, none in touched S1 files.

Not done:
- Did not start WP-29 S2.
- Did not run the live resume-optimizer eval harness because it can call paid external AI services.

## 2026-06-24 — Expert-workflows 500 on LLM variance fixed (submit pack + cover letter root cause)
Founder reported submit pack "not working at all" and cover letter "not visible" in the iOS app. Root-caused to the backend: `runExpertWorkflow` (src/lib/expert-workflows/orchestrator.ts) validated model output AFTER the network-retry loop and threw on any schema miss → HTTP 500. Normal LLM output variance (e.g. 2 cover-letter variants instead of exactly 3, or an out-of-enum `suggested_placement`) intermittently 500s. iOS Submit Package requires the cover-letter workflow with no client retry, so one 500 kills the whole flow → no cover letter. Same class as the `suggested_placement is invalid` 500 seen live in the founder's device log.
Fix (branch `fix/expert-workflows-validation-retry`): `generateValidatedOutput()` regenerates with the validation error fed back into the prompt, up to `MAX_VALIDATION_ATTEMPTS` (3), before failing. Generic across all workflow types — fixes cover-letter/submit-package AND the ATS-report path. Strict validation unchanged; only adds self-correcting retries. Generator injectable for unit tests. New `expert-workflow-validation-retry.test.ts` (5 tests) green; full expert-workflow suite 39/39; changed files lint-clean; pre-existing 23 tsc test-typing errors unaffected. **Awaiting founder approval to merge → auto-deploy to production**, then verify submit-pack/cover-letter end-to-end before the iOS build-6 submission.

Project: ResumeBuilder AI (Web)
Status: Active
Current Phase: WP-29 Resumely web funnel P0 fixes — S1-S4 completed; S5 anonymous-session carryover is next.
Active Story: WP-29 S5 — carry anonymous check results through signup into the new account/dashboard.
Last Completed Story: WP-29 S4 — disabled Premium CTAs while Gate A is closed, guarded `/api/upgrade`, and recorded the option A decision in Agentic OS `DECISIONS.md`. Branch `codex/wp29-s4-disable-premium-cta`.
Next Recommended Story: WP-29 S5 — design and implement anonymous session carryover after signup so the first dashboard is not empty.
Estimated Completion: Web is live; scoring-accuracy work is incremental
Blockers: Gate A remains closed by decision; do not wire Stripe or re-enable Premium CTAs until the gate is explicitly reopened.
Risks: `npx tsc --noEmit` still has pre-existing test typing/export failures; keep reporting them separately from WP-29 regressions until cleaned up. Do not wire Stripe or open the monetization gate while fixing P0 funnel bugs.
Last Validation: WP-29 S4 branch `codex/wp29-s4-disable-premium-cta` — focused pricing/upgrade tests 2/2 passed, `npm run check:i18n` passed, targeted eslint passed, full `npm run lint` passed with existing warnings only, `npm run build` passed. `npx tsc --noEmit` still fails on pre-existing contract/security test typing and stale export errors, none in touched S4 files.
Last Updated: 2026-07-03
Latest QA Report: tasks/2026-06-08-smoke-test-upload-backend.md (plan; execution pending)

<!--
Seeded 2026-06-12 per Agentic OS MANUAL.md "How to make a project reach High confidence"
(open decision in Agentic OS tasks/progress.md, approved by founder 2026-06-12).
Keep the keyed block above current after each significant validation; the Agentic OS
refresh parser reads it. This repo has no tasks/todo.md or session-log.md; MEMORY.md
carries session history.
-->

## 2026-06-20 — Resumely ATS claim defensibility (copy/positioning, branch claude/angry-murdock-dd0e58)
Implemented approved decision "Resumely ATS Claim Defensibility": the score is a self-defined **Resumely Match Score**, never an external ATS vendor's score. Copy/label/translation-only — no scoring logic or API changes.
- Renamed user-facing "ATS score"/"ATS Score" labels to "Match Score"/"Match" across both locale layers (base `src/messages/{en,he}.json` + funnel overrides `src/messages-overrides/funnel/{en,he}.json`), keeping "ATS" only in descriptive/SEO contexts.
- Added score explainer microcopy `landing.score.explainer` ("Based on formatting + keyword match vs the job you paste. Not affiliated with any ATS vendor." / Hebrew equiv), rendered under the score in `ATSScoreDisplay.tsx`.
- Audit fixes: removed "beat ATS filters"/"Beats ATS filters"/"land more interviews" and "your ATS score" possessive framing from newsletter, hero social proof, share messages, OG image, and `atsCheckerPage` meta. No named ATS vendors found anywhere.
- Hardcoded labels fixed: `ats-resume-template.tsx` ("ATS Match Score"→"Match Score"), `opengraph-image.tsx`.
- 7 files changed. Validation: `npm run lint` 0 errors; `npm run check:i18n` 0 missing in HE / 0 invalid; tsc errors are pre-existing in `tests/` only (none in touched files).
- Flagged, kept for SEO/scope: funnel hero H1 "Pass ATS Filters" and meta.title "...See If Your Resume Passes".

## 2026-06-18 — ATS PDF fix merged + smoke passed
fix/pdf-parser-unpdf merged to main (PR #74). unpdf resolves the Vercel 500. Render-preview remains parked.

## 2026-06-19 — ATS JD pipeline fix merged (PR #76); score-capping bug only partially closed
fix/ats-jd-pipeline merged to main (PR #76, commit 7a91c8c). Scorer now falls back to qualifications/responsibilities and re-extracts from JD text when parsed_data.requirements is null — fixes the initial /api/optimize creation path. CI/lint/Vercel all green.

Cloudflare Workers Build "match1resume1to1job" check failed on this merge — verified it fails identically on PR #72, #73, #74, #75 too, and this repo has no wrangler.toml. Stale/orphaned Git integration, unrelated to this app. Not a regression; candidate for disconnecting later.

Found while verifying live: the fix does not fully close the score-capping bug.
1. GET /api/v1/optimizations/[id] (iOS diagnosis screen) reads persisted ats_score_original/ats_score_optimized columns and never recomputes — so any optimization created before 08:40 UTC today will keep showing its old, pre-fix score forever. Re-running /api/optimize on a fresh job is required to see the fix.
2. PUT /api/v1/optimizations/[id] (save-edit path) calls scoreOptimization() without jobExtractedJson, so it falls back to extractJobRequirements()'s naive text parsing instead of buildJobDataFromExtractedJson()'s structured fallback — meaning saves/re-scores through this path still don't benefit from PR #76.

Next: confirm with a brand-new optimize run (not a re-opened old one) whether the score lifts; if it does, file a follow-up to wire job_extracted_json into the save-path scoreOptimization() call in src/app/api/v1/optimizations/[id]/route.ts.

## 2026-06-21 — Story 1 fixed (JD heading classifier), Story 2 closed as not-a-bug
PR #80 merged. Branch fix/ats-jd-requirements-and-metrics created from updated main.

**Story 1 (fixed, PR #81 open):** `extractFromLinkedIn` (src/lib/scraper/jobExtractor.ts) matched section headings against a fixed literal-phrase list ("Responsibilities", "What you'll do", "Requirements", "Must have", "Qualifications"...). Live-fetched the real Fresha BD posting's guest-fragment HTML (job 4425913724) and found it uses "What You Will Be Doing" / "What We Are Looking For" / "Added bonus" — none matched, so requirements/qualifications/responsibilities were ALL null despite a full, well-structured 11.7KB body. Re-checked the existing `guest-fragment.html` fixture (Base44 job) and found the same latent gap — its first `<ul>` was responsibilities content under heading "Job Description" that the old regex never caught either; the fixture's test only passed because `qualifications` happened to match literally.

Fix: added `classifyHeading` + `extractClassifiedHeadingSections` — scans every `<strong>heading</strong><ul>` block and buckets it by keyword family (responsibilities/requirements/qualifications/nice_to_have/benefits) when the literal-phrase match found nothing. Wired up `nice_to_have` (previously hardcoded null). New regression test + fixture added. Verified against the real Fresha fragment: responsibilities (9 items), requirements (5 items), nice_to_have (2 items) all populate where they were null before.

**Story 2 (investigated, closed — not a bug):** Pulled the actual production optimization row (d30a6841) and traced backward past the AI-optimized rewrite_data to the pre-optimization `resumes.raw_text` (resume_id b797b20e). The ORIGINAL resume — before the AI touched anything — has zero quantified metrics anywhere except "15+ years" in the summary. The AI optimizer's system prompt explicitly forbids fabricating metrics, and it correctly preserved this truthfully. `metrics_presence: 0` is an accurate score, not a defect. No code change made — fabricating numbers would violate the no-fabrication rule and the "defensible Resumely Match Score" positioning; a UX nudge to get users to add real numbers would be a new feature requiring founder sign-off, not a bug fix.

## 2026-06-21 — Persistent low scores root-caused: NOT a deploy gap; multi-causal scoring bug
Investigated why the founder still sees low scores despite the LinkedIn guest-scrape + Layer B fixes being merged.

Decisive findings (evidence from prod Supabase + Vercel):
1. **Not a deploy gap.** Latest production deploy is 1h old and carries the `git-main` alias (→ www.resumelybuilderai.com). Production tracks main.
2. **The LinkedIn guest scrape now WORKS.** Fresha BD job (opt d30a6841, created 2026-06-21 08:49 AFTER all fixes) has raw_text/clean_text = 6371 chars. The thin-scrape problem is solved for this job. (The older Base44 job f3a1f852 with 222 chars predates the Jun-20 fix.)
3. **Real remaining bug = garbage keyword extraction.** parsed_data.requirements/qualifications/responsibilities are ALL null even with full about_this_job, so the scorer falls back to `extractJobData` on prose → `extractKeywords`. That function matched tech terms as substrings (no word boundaries): `rust`⊂"trusted", `api`⊂"rapidly", `express`⊂"expressing", `go`⊂"Google". For the BD role must_have came out `["rust","express","api","Fresha\nAbout","Trusted"]` → keyword_exact=25, keyword_phrase=0 → overall 34.

Fix (this branch): word-bound the tech-term matching with alphanumeric lookarounds + stop capitalized phrases spanning newlines. Real-data repro: keyword_exact 25→33. Lint/tsc/24 ATS tests green.

Honest scope note — the substring fix is necessary but only lifts ~2 pts. The dominant drags are: (a) JD structured requirements never extracted (Bug A, scraper); (b) keyword_phrase structurally ~0 (verbatim n-gram design, 12%); (c) metrics_presence legitimately 0 because the AI optimizer writes metric-free bullets (10%). Resolving "low scores" fully is a product decision — see keyed block "Next Recommended Story" / "Blockers".

## 2026-06-19 — Save-path resolver gap fixed; real root cause found (LinkedIn scrape blocking)
Fixed commit 85505a3: PUT /api/v1/optimizations/[id] now selects parsed_data and forwards it as jobExtractedJson to scoreOptimization(), so manual edits/re-scores get the same structured fallback as the initial optimize path. Lint clean, ats-prepare-input.test.ts passes (4/4).

Founder re-ran a fresh optimization live (not a cached one) on the Base44 Partnership Manager LinkedIn job and the score was still 21/100 — confirmed via Supabase (optimizations row created 14:38 UTC, well after the PR #76 deploy). Pulled job_descriptions.parsed_data for that row: every field (requirements, qualifications, responsibilities, nice_to_have) is null, and clean_text/raw_text are both exactly 222 chars — the truncated og:description meta tag.

Direct curl of the identical LinkedIn URL from this machine returned the full page (260KB) with the show-more-less-html section intact (2,950 chars, "Job Description" + "Qualifications" bullet lists, no authwall). The production scraper (src/lib/scraper/jobExtractor.ts, fetched from Vercel's serverless egress) is getting a stripped-down version of the same page — almost certainly LinkedIn anti-bot serving degraded content to flagged datacenter/cloud IP ranges. No error is thrown (200 OK), so it fails silently into a near-empty job_data.

This means PR #76's resolver and the save-path fix above are both correct and necessary, but neither can fix this specific failure mode — there's no real text to fall back to. Founder decision 2026-06-19: park this, do not add a scraping-proxy dependency without explicit approval. If revisited, options are (a) a residential-IP proxy service (new paid dependency) or (b) detect thin scrapes and prompt the user to paste the JD manually instead of silently scoring against the meta snippet.
