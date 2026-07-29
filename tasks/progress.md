# Project Progress

## 2026-07-29 (later) — WP-64 shipped to production, and the 12 rows are repaired

**Merged and deployed.** PR #126 squash-merged to `main` as `3c1c58c` at 07:52 UTC. CI `build-test` success, Vercel production deploy success on the merge commit, `https://www.resumelybuilderai.com` responding 200. Checks that passed: build-test, Vercel, GitGuardian, CodeRabbit. The one failure was `Workers Builds: match1resume1to1job`, which fails on every PR in this repo including `main` and is not a signal.

**This fixed the live iOS app without an App Store release.** The optimizer runs server-side and iOS 1.4.7 calls `resumelybuilderai.com`, so the deploy repaired the shipping binary's behaviour with no Apple review in the loop. Worth remembering as a general property: **defects in the optimize/score path are hot-fixable; only client-side defects need a build.**

**Backfill applied to the 12 affected rows.** Each role's `responsibilities` was copied into `achievements`, only where `achievements` was empty and `responsibilities` was not.

- Dry run first, as a pure SELECT: 12 rows, `roles_before` = `roles_after` = 5 on every row, and the company list byte-identical in the same order before and after. Role identity and ordering were the two things that could silently break, and both were checked before the write, not after.
- `jsonb_agg(... ORDER BY ord)` is load-bearing. Without the explicit ordinality ordering, role order is not guaranteed and the resumes would have been silently reshuffled.
- Applied: 12 rows updated, 0 → **214 bullets restored**.
- Post-write verification across the whole table: **384 rows with an experience array, 0 still empty, 384 with bullets, 4,611 bullets total, 0 rows with unrepaired key drift.**

**The backfill is reversible.** `responsibilities` was deliberately left in place rather than moved, so undoing it is setting the same roles' `achievements` back to `[]`. Nothing was destroyed; the repair is additive.

**`updated_at` was bumped.** Deliberate: the row content genuinely changed, and any consumer caching on `updated_at` has to see it or it will keep serving the empty version, which is the entire point of the backfill. The cost is that these 12 rows now read as recently modified when the user did not modify them — noted here so nobody reads it as user activity.

**Activation as of this write, and it is the real headline.** Pinned window from the 1.4.7 release (2026-07-28T19:30:45Z) to now, person-level internal exclusion, founder person `a6441489-...` excluded:

| Step | People |
|---|---|
| `app_launched` | **0** |
| `optimized_preview_rendered` | **0** |

With the founder included it reads 1 and 1, which is the sanity check confirming the query resolves, not a result. **Lifetime (365d, same exclusions): 95 launched → 2 activated → 4 exported.** Against EXD-022's gate of >=20 clean activations that is **2 of 20**, and 1.4.7 has contributed nothing because nobody outside the founder has opened it.

**4 exported against 2 activated is structurally impossible** — you cannot export a preview you never rendered. That is the pre-1.4.5 broken-milestone residue still showing through, and it means the lifetime 2 is itself not a clean figure. Any activation claim built on it needs that caveat attached.

**The honest read:** the instrument is no longer the constraint and neither, now, is this defect. **Traffic is.** 95 launches in five months and zero since the current release is not a funnel problem that more engineering solves.

**Not done:** (1) `response_format: json_schema` — the key name is still enforced by instruction rather than by the API. (2) The fix is not yet verified against a live model call; `evals/resume-optimizer/` is where the prompt change should be proven to lower the drift rate, and the nightly eval ran at 05:36 UTC *before* this merge. (3) The event-duplication defect found in the same trace (several events firing 2-4x, `optimization_completed` emitted by both client and server) is recorded but has no packet. (4) The founder's 38 → 61 must not enter any activation or quality series.

**Last Updated:** 2026-07-29

## 2026-07-29 — WP-64: the optimizer was deleting every experience bullet

**Found from a live user report, not a test.** The founder ran an optimization on iOS 1.4.7 (17) at 05:16 UTC and got back a resume with all five roles present and not one bullet under any of them: "it cut all my experience."

**Root cause.** `RESUME_OPTIMIZATION_SYSTEM_PROMPT` specifies the per-role bullet array as `achievements`. gpt-4o sometimes returns **`responsibilities`** instead, with `achievements` present but empty. Every consumer reads `achievements` and skips on empty — `DesignRenderer.tsx:525`, `ats-resume-template.tsx:118`, `api/v1/optimizations/[id]/route.ts:60`, `lib/ats/integration.ts:102` — and **nothing in the codebase reads a resume role's `responsibilities`**. The role survived with title, company and dates; every bullet was discarded. Structurally intact, substantively empty, which is exactly why it read as "lean" rather than "broken".

**The scorer could not catch it, because it reads the same empty key.** The founder's run scored `ats_score_original` 38 → `ats_score_optimized` **61**. The product deleted the user's evidence, graded the remains on summary and skills alone, and reported a 23-point improvement. Any guard built on the score would have passed this.

**Scope, measured in production:** 12 of 384 stored optimizations carrying an `experience` array lost every bullet this way (3.1%), earliest 2026-05-28, most recent the founder's run. All 12 belong to one account — **but that account holds 357 of 384 runs (93%)**, so at the observed 3.4% rate the other 27 runs would be expected to produce roughly one event and produced zero. **The data cannot distinguish a resume-specific trigger from a background rate affecting every user**, and it is not reported as founder-only.

**Fix is three layers, because a prompt is not an enforcement mechanism** (same posture as `stripFabricatedMetrics` and RunSmart's `enforcePlanSafety`):

1. **`src/lib/ai-optimizer/normalize-experience.ts`** coalesces the bullet key at **both** parse sites — `index.ts` pass 1 and `optimize-pipeline.ts` gap pass, which is a second independent model call that drifts the same way. Accepts `achievements`, `responsibilities`, `bullets`, `highlights`, `accomplishments`; first non-empty wins; never overwrites real achievements; always returns an array. Its only import is type-only, so it adds nothing at runtime and cannot cycle with `./index` or cross the client/server bundle boundary (WP-58).
2. **Two preservation guards in the pipeline.** `hasTotalBulletLoss` rejects a candidate whose roles carry no bullets at all and retries pass 1 once. `losesContentAgainst` keeps pass 1 when pass 2 drops more than a third of the evidence — **pass 2 starts from pass 1's output and never sees the original resume, so its losses are permanent by construction**. Both are deliberately narrow so genuine consolidation still passes.
3. **The prompt** now states that every role must appear with its bullets, that an empty bullet list is not allowed, and that the array is named `achievements` and must not be renamed. The schema example is annotated so a single role reads as the shape rather than the expected count.

**Validation.** 25 new tests, all passing. Two of them (`4a`, `4b`) drive the real `runOptimizePipeline` rather than the pure helpers, and **both were confirmed failing on the parent commit** — `Array []` where the bullets belong, and `passesUsed 2` where the emptied pass 2 wins on score. That second one is the point: the guard has to beat the score, because the score prefers the broken document.

Full suite **17 failed suites / 80 failed tests, identical to baseline**, passing **311 → 336** (exactly the 25 added). `tsc` **27 errors, exactly baseline**, none in touched files — an intermediate version added 19 and was rewritten. `eslint` 0 errors, its single warning pre-existing and unchanged. **`next build` verified on a clean detached worktree of the fix commit**, not the working tree: the working tree fails on `src/app/[locale]/auth/callback/route 2.ts`, an untracked iCloud duplicate that does not exist in CI, and building in place would have reported a red build for a green change.

**Not done:** (1) **The 12 affected historical rows are not backfilled.** Their bullets are intact in `rewrite_data` under `responsibilities` and simply are not read; moving them into `achievements` is a production write and needs explicit approval. (2) **No `response_format: json_schema`** — instruction-level enforcement only; a strict schema would make the key name impossible to get wrong and is the real fix for layer 3. (3) The founder's 38 → 61 is not a valid measurement of anything and must not enter any activation or quality series. (4) Not verified against a live model call; the eval harness at `evals/resume-optimizer/` would be the place to prove the prompt change actually lowers the drift rate.

**Related:** the iOS repo's 2026-07-27 entry recorded "the optimizer still degrades resumes" (`keyword_exact` 60 → 40) and asked for its own packet. **That is a different, less severe defect** — a scoring regression, not content deletion — and remains open. Both come from the same gap: until now nothing compared the optimizer's output against its input.

**Last Updated:** 2026-07-29

## 2026-07-26 — WP-58: landed the WP-45 scorer stack on main

Nine commits of scorer-integrity work were stacked three PRs deep with none of it on `main`. All of it is now merged: S1 via PR #119, S2 through S9 plus the WP-58 build fixes via PR #121.

**The #121 Vercel failure was mine.** S3 deduplicated the two orchestrators by folding index.ts's quick-wins block into core.ts. That block does `await import('./quick-wins/generator')`, which reaches posthog-ai → posthog-server → posthog-node → `node:readline`. core.ts is transitively imported by a client page (`optimization-reviews/[id]/page.tsx` → optimization-review/index.ts → integration.ts → core.ts), so a Node built-in landed in the browser bundle and `npm run build` failed. Webpack traces dynamic imports too. The generator is now injected rather than imported: core.ts declares a `QuickWinsGenerator` type and calls whatever the caller passes; the two server routes import the real one and hand it in. S3's single-implementation goal is intact — index.ts still re-exports core.ts's `scoreResume` and the identity test still holds.

**Workers check confirmed pre-existing.** `Workers Builds: match1resume1to1job` fails on `main` commit `bd3ba59b` as well as on every PR in the stack. Unrelated to this work; it is not a signal.

**The 51/68 anomaly is answered — the data is not contaminated.** Deduplicating `anonymous_ats_scores` by `(resume_hash, job_description_hash)` over 60 days: 67 raw rows collapse to 36 unique pairs. The 16 rows scoring exactly 51 come from just **2 distinct resumes and 2 distinct jobs** inside a 5-day window. They are genuinely computed scores for the same two documents re-submitted, each run minting a new anonymous session — the "15 distinct people" was an artefact of anonymous session identity, the same artefact that made `is_internal_tester=true` look like 32 people. **S5's bands are unaffected: the benchmark uses synthetic fixtures, not production scores.** The descriptive stats were mildly optimistic and get slightly worse when deduplicated: mean 34.5 → 31.4, median 36 → 28.5. Maximum stays 51 and the count at or above 75 stays 0, so every headline finding holds.

**Merge mechanics worth remembering:** merging #119 with `--delete-branch` removed #120's base branch, which auto-closed #120. The commits were safe on the branch; recovery was to merge `main` forward into the top branch and retarget. Also `gh pr edit --base` fails on this repo with a Projects-classic GraphQL error — use `gh api -X PATCH .../pulls/N -f base=main`.

**Validation on merged `main` (4e7b56f):** suite 17 pre-existing suite failures / 80 failing tests — identical to the recorded baseline — with passing count 277. `tsc` 27 errors, all in pre-existing files, **0 in `src/lib/ats`** (the 27th vs the recorded 26 is in an untracked stray `route 2.ts` that does not exist in CI). `eslint` clean. `next build` passes on a clean checkout of merged `main`.

**Two verification lessons, both mine:** I verified S3 through S9 with jest, eslint and tsc but re-ran `next build` only up to the S2 commit — a clean production build is the only check that sees the client/server module boundary. And I grepped `tsc` output to a filtered subset instead of reading the total count, which hid a second broken call site in `api/ats/score/route.ts`.

## 2026-07-24 — WP-45 S2: symmetric comparison + no-regression invariant (PR #120, stacked on #119)

**The invariant.** `optimize-pipeline.ts` chose between pass 1 and pass 2 by comparing them to each other and never to the resume the user started with, so a run that moved the score +2 — or moved it down — was returned as a result. That is the 42 -> 44 from the Meirav session, and it is not rare: 24 of 59 optimizations in 60 days ended at +4 or worse, 6 of them lower than they started. Pass 2 now also triggers when a run has not meaningfully beaten the original, and every result carries a `LiftAssessment` from the new `src/lib/ats/lift.ts`. That module never raises a score, never clamps a delta positive and never applies a floor — `lift.displayScores` tells the caller to show what changed and what is still missing instead of a number pair. Floor is a named constant at 5, provisional until S5 picks it from the labelled benchmark.

**Fifth measurement defect found.** Four analyzers branch on `resume_json` — section_completeness, title_alignment, metrics_presence, semantic — and in the shipping path only the optimized side ever has it. section_completeness scores field presence via `hasRequiredSections()` with JSON and a header regex over messy extracted text without it. Production 60d: optimized mean 99.7 with 58 of 59 rows at or above 99 (min 85), against 66.5 original. Roughly +3 points of fake delta on every optimization. The structured path is now used only when both sides are structured; recency is exempt because it takes `recency_json`, reconstructed in S1 for exactly this reason.

**S1 follow-on caught by the new tests:** `prepareInput`'s format fallback was still applying `analyzeFormatWithTemplate` to whichever side happened to have JSON, reintroducing the D3 two-different-functions comparison in a new place. Fixed.

**Signal:** both routes running the pipeline emit `optimization_no_lift`, bucketed (negative / 0_to_4 / 5_to_9 / 10_plus) plus a stalled-component name. No resume or job content.

**Validation:** 12 new deterministic tests. Both symmetry gates verified failing against the S1 head — the first needed a messy-extraction fixture, because a clean original with proper headers scores 100 on either path and hides the defect. A guard test confirms genuine improvements still register. Full suite 17 pre-existing suite failures before and after, passing 201 -> 213. eslint clean, tsc 26 before and after, `next build` passes on a clean checkout.

**Not done:** no UI change — `lift.displayScores` is produced but nothing consumes it, that is S8, so users still see the raw pair for now. Absolute scores move for everyone as the optimized side loses an unearned advantage on four components, which makes historical rows even less comparable (S9). The floor of 5 is a placeholder for S5.

## 2026-07-24 — WP-45 S1: repair the three dead scoring components (PR #119)

Backend-only scorer integrity pass. Triggered by a moderated user session (Meirav) that showed a fit score of 45, then 42 before / 44 after optimizing. The audit found the composite was structurally incapable of doing better.

**Evidence (privacy-safe aggregates, 60 days, pulled 2026-07-24):** free checker `anonymous_ats_scores` n=67, mean 34.5, max 51, zero at or above 75. Authenticated `optimizations` n=59, 32.2 -> 41.6, max after 62, and 24 of 59 (41%) ended at +4 or worse. Across all non-tester `fit_check_completed` events, `strong` has never once been emitted against its own >= 75 threshold.

**Four defects, all confirmed in code and in the subscore means:**
- `keyword_phrase` (12% weight): 0.6 -> 4.2. Scores verbatim 3-6 word JD reuse, so only keyword stuffing moves it. Withdrawn from the weighting; remaining weights rescaled old/0.88. Analyzer still runs.
- `metrics_presence` (10%): 6.2 -> 7.2. Clamps to 0 without metrics and `penalties.ts` subtracted another 5 for the same fact, on both sides of every pair, unescapable because `stripFabricatedMetrics` correctly forbids inventing figures. Penalty removed.
- `format_parseability` (14%): 87.8 -> 87.8, identical on all 59 rows. `core.ts` and `index.ts` built one `format_report` and passed it to both analyzer runs. Now resolved per side, in both orchestrators.
- `recency_fit` (8%): 50.0 -> 12.7. The original arrives as raw text and hits the constant-50 fallback while the optimized side has JSON. New conservative text extractor derives dated roles, returning null rather than guessing.

**Effect:** an excellent candidate whose resume has no quantified metrics scored 72, now 87 — `strong` is reachable for someone who deserves it. A typical resume moves 33 -> 44 and stays below the strong band. A clear mismatch stays low.

**The review pass mattered.** An adversarial review of the first commit found two own-goals that would have inflated the delta: the derived work history was reaching four analyzers that branch on `resume_json`, collapsing the original side's `section_completeness` from ~100 to 25; and `integration.ts` compared `generateFormatReport` (base 85) against `analyzeFormatWithTemplate` (base 100), manufacturing ~+2.4 points on every run. Both corrected in the second commit, plus a NaN path in `getAdjustedWeights` newly reachable via the zero weight.

**Validation:** 30 new deterministic tests, no network. 6 gates verified to fail on the pre-fix source, 5 further regression gates verified to fail on the first commit. Reference fixtures pinned to exact composite values so reverting D1 or D2 fails loudly. Full suite 17 pre-existing suite failures before and after (identical on origin/main), passing 171 -> 201. eslint clean. tsc 26 errors before and after, 0 in `src/lib/ats`. `next build` passes on a clean checkout.

**Not done:** `core.ts`/`index.ts` remain duplicate orchestrators (both patched identically). `SubScoreBreakdown.tsx` still renders `keyword_phrase` as a normal bar. Historical `ats_score_original` rows are not comparable to new ones — that is WP-45 S9 and rescoring needs separate approval. Free-checker scores rise ~11-13 points, so the >= 75 "Strong" verdict may start firing there; band calibration is WP-45 S5.

**Open question:** 15 distinct non-tester people recorded a fit score of exactly 51 and 17 recorded exactly 68. Identical scores across many people suggests a cached or default value; worth 30 minutes before S5 calibration.

## 2026-07-11 — WP-43: Free ATS Checker entry-funnel activation (Tier A), merged PR #115

Shipped all 6 Tier A stories from a live cold first-time-user walkthrough of resumelybuilderai.com. Copy/design + client-only, no backend changes.

- S1: above-the-fold "Check my resume →" CTA on mobile, scrolls to and focuses the upload card. Fires `ats_checker_hero_cta_clicked`.
- S2: styled dropzone replacing the raw native `<input type="file">`; states PDF-only + 5MB + privacy up front.
- S3: two-item live checklist (resume / job description) replaces the old single-priority hint so both requirements show at once.
- S4: nudges users under the 100-word minimum toward the backend-supported URL path (which skips the word-count gate) instead of just blocking them.
- S5: warns inline when a pasted URL is `linkedin.com` — the documented thin-scrape failure (see 2026-06-21 entry below) returns a false low score with no error surfaced.
- S6: moves "Already have an account? Log in" below the tool on mobile via a duplicated, breakpoint-hidden pair; desktop DOM/layout is pixel-identical (verified via preview server screenshot at both breakpoints).

**Validation:** `tsc --noEmit` clean on touched files (19 pre-existing errors in unrelated test files, same count on unmodified `main`); `eslint` clean; `npm run check:i18n` 0 missing EN/HE keys; existing 3 tests + 3 new tests green (6/6); live-verified in a preview server at mobile and desktop widths — all 6 stories confirmed working, desktop confirmed visually unchanged.

**Not done:** Tier B (DOCX support on the free path, resume-only first score before the JD ask) — both need backend work, explicitly deferred. Companion iOS packet WP-44's S1 (picker directory fix) turned out to be blocked (no iCloud capability in the app) — see ResumeBuilder iOS `tasks/progress.md`.

Ties to the Resumely activation funnel re-read scheduled 2026-07-18 (minimum check) / 2026-07-25 (definitive).

## 2026-07-10 — Web export wall diagnosis + observability fix

**Verdict:** production PDF export is functional; the proven web defect was a complete analytics blind spot around the export action, not a universal paywall/auth/PDF failure.

- Fresh production QA flow completed signup → upload → optimization review → approved draft → PDF download. Production optimization: `d4f0ff18-871b-483a-a5af-843c2f361f9a`; browser observed a real download with no console error.
- Supabase/PostHog reconciliation found seven organic web users from February reached `/dashboard/optimizations/{id}` but had no export events. Historical session replay is outside the 30-day retention window, and the web button used a raw `window.location.href`, so past click-vs-abandonment cannot be distinguished.
- The cited 2026-07-06 iOS zero-export result is now stale: refreshed founder-excluded iOS funnel through 2026-07-10 is 9 `resume_uploaded` people → 2 `optimization_completed` → 1 `export_success`.
- Fix: the optimization page now emits `optimized_viewed`, `export_cta_seen`, and `export_pdf_tapped` with `optimization_id`, `platform=web`, and source. The authenticated download route now emits `export_started`, terminal `export_success`, or `export_failed` with format and renderer/error code.
- QA exclusion: `nadav.yigal+export-wall-qa-jul10@gmail.com` / user `fe2cc2bc-75e6-4b64-8036-a2aac07f4917` is tagged in PostHog with `is_internal_tester=true`, `qa_account=true`, purpose `export_wall_jul10`; founder-excluded queries also retain the `-qa-` email convention exclusion.
- TDD: `tests/contracts/web-export-observability.test.ts` failed 3/3 before implementation and passes 3/3 after. Targeted eslint clean; full lint 0 errors / 11 pre-existing warnings; production build succeeded. `npx tsc --noEmit` retains only documented pre-existing test errors and has no story-file errors.
- Post-fix local smoke against the real QA optimization: authenticated route loaded the row, generated a 7,328-byte PDF through the jsPDF fallback, and logged `Sending download response`.

**Expected funnel movement:** `optimization_completed` → `optimized_viewed` → `export_cta_seen` becomes measurable on web; a click then resolves to `export_pdf_tapped` → `export_started` → exactly one of `export_success` / `export_failed`.

**Not deployed:** branch `codex/fix-web-export-observability` remains local for review; no production deployment was authorized in this story.

## 2026-07-09 — WP-39 S4 live smoke test: Expert Apply regression confirmed (Outcome B)
Live production test on `main` @ `1a37fc4`. **Verdict: Outcome (B) — API returns `success: true` but `expert_workflow_runs.applied_at` stays NULL.**

### Test setup
- Account: `nadav.yigal+fable-qa-jul03@gmail.com` (existing QA, production sign-in OK).
- Flow: upload resume → optimize → save approved draft → optimization `5d6b526e-6ce9-42fc-995b-84cae5d9227e`.
- Expert run: `ats_optimization_report`, run id `4102da8d-0bde-4692-a133-321f396e3f20` (created via production `runExpertWorkflow` orchestrator; UI Preview blocked `402 PREMIUM_REQUIRED` for free tier).
- Apply: authenticated `POST /api/v1/expert-workflows/runs/4102da8d-0bde-4692-a133-321f396e3f20/apply` from active browser session (same fetch path as ExpertModesPanel Apply).

### Observed behavior
| Layer | Result |
|-------|--------|
| HTTP apply response | **200**, `{ success: true, updated_fields: ["skills.technical"], ats_impact: { before: 42, after: 55, delta: 13 } }` |
| `optimizations` row | **Updated** — `ats_score_optimized` 42→55, `rewrite_data.skills` expanded, `updated_at` 2026-07-09 10:50:29Z |
| `expert_workflow_runs` row | **NOT finalized** — `applied_at` NULL, `apply_mode` NULL, `status` still `needs_user_input` |
| Supabase REST log | `PATCH expert_workflow_runs` → **400**; `PATCH optimizations` → **204** |

### Root cause (not UX abandonment)
Production schema drift: code writes `applied_assets_json` in `applyExpertWorkflowRun()` (`orchestrator.ts` ~L788–801), but production `expert_workflow_runs` **has no `applied_assets_json` column**.

- Repo migration exists: `supabase/migrations/20260303000000_expert_workflow_assets_and_new_types.sql` (adds `applied_assets_json`).
- Production `schema_migrations` has `20260301000000`, `20260302000000` only — **`20260303000000` never applied**.
- Cliff timing matches: `applied_at` metadata landed 2026-03-02 (`20260302000000`); apply payload gained `applied_assets_json` in Mar-9 hardening (`a8d97a6`); migration dated 2026-03-03 never shipped → every apply PATCH 400s.
- Secondary bug: final `expert_workflow_runs` UPDATE **does not check `{ error }`** — partial apply (optimization writes succeed) still returns `success: true` to the UI. Matches silent-failure pattern in production metrics (0 applies since ~2026-03-10).

### Decisive outcome
**(B) Live regression** — frontend/API report success; `applied_at` write fails. Prior S4 scenario-(a) verdict **rejected**.

### Recommended fix (not implemented — >1 file / needs migration approval)
1. **P0:** Apply migration `20260303000000` to production Supabase (`brtdyamysfmctrhuankn`).
2. **P1:** In `applyExpertWorkflowRun`, check and propagate errors from the `expert_workflow_runs` UPDATE (return 500 / `success: false` when PATCH fails).
3. Re-run this smoke test after migration; expect Outcome (A).

### Extra finding (run gate)
Free-tier users cannot create expert runs via UI (`Preview workflow` → `402 PREMIUM_REQUIRED`). Apply is not reachable end-to-end without premium or service-role run creation — separate from the `applied_at` bug but worsens completion rate.

## 2026-07-09 — WP-39 S4 + D4 Expert apply dead-path + anon RPC security read (investigation only)
Read-only investigation on `main` @ `b7db662`. No code changes, no migrations, no grant revokes.

### S4 — Expert-workflow Apply path
**Verdict: scenario (a) — Apply exists and is reachable; users are not completing the second step.** Not a dead/orphaned code path and not a small reconnect regression.

**Where `applied_at` is written:** sole writer is `applyExpertWorkflowRun()` in `src/lib/expert-workflows/orchestrator.ts` (sets `applied_at`, `status: completed`, apply metadata on `expert_workflow_runs`). Invoked only from `POST /api/v1/expert-workflows/runs/[id]/apply` (auth required via `createRouteHandlerClient` + `getUser()`).

**UI triggers (reachable today):**
- **Web:** `ExpertModesPanel` on `dashboard/optimizations/[id]` — secondary Apply / Save Selection button appears whenever `runResult` exists (not gated on `status === completed` or premium; only Run is premium-gated). Posts to apply route; tracks `expert_apply_clicked` / `expert_mode_apply_completed`.
- **iOS:** `ExpertModesView` → `ExpertModesViewModel.apply()` → same apply API. Apply buttons shown in per-workflow output views and `ExpertReportView` (`showApplyButton: true` even when `needs_user_input`).
- **iOS Submit Package:** `submit()` runs cover-letter + screening workflows but does **not** call apply; `savePackageToMe()` calls apply then `saveExpertReport` — apply only lands if user completes save-to-Me.
- **Chat:** `POST /api/v1/chat` can `runExpertWorkflow()` inline but never calls apply; response text says "Open Expert Modes panel to review and apply."

**Git history around 2026-03-10:** `applied_at` column added 2026-03-02 (`20260302000000_application_expert_reports_and_apply_metadata.sql`). Last DB `applied_at` ~2026-03-10 aligns with first-week dogfooding after Expert Modes shipped (2026-03-01–02). 2026-03-09 `a8d97a6` hardened apply response shape and tests — did **not** remove Apply UI or route. 2026-03-12 `optimization_review_runs` added a separate, healthier apply flow (12/16 applied in 14d per founder SQL) that likely absorbed resume-edit intent.

**Why runs exist without `applied_at`:** Run (`POST /api/v1/expert-workflows/run` or chat) persists `expert_workflow_runs` + `expert_workflow_artifacts` immediately. Apply is a deliberate second action. Most runs are `needs_user_input` (validator sets status when `missing_evidence` non-empty) — Apply is still offered but UX shows warning banners; users may stop after reviewing output. Artifacts (334 rows) confirm generation works; finalize step is skipped.

**Recommended next story (out of scope here):** UX/product — auto-apply option, merge run+apply for document workflows, surface Apply CTA when `needs_user_input`, or instrument `expert_apply_clicked` vs `expert_mode_run_completed` in PostHog to quantify drop-off. Not a ≤3-file wire fix.

### D4 — Anon-executable SECURITY DEFINER RPCs
**Verdict: `consume_credit` and `grant_apple_credits` are exploitable if anon EXECUTE is live on production; `generate_file_path` is low risk.**

| Function | App call sites | Internal auth guard | Exploitability (if anon RPC works) |
|----------|----------------|---------------------|-------------------------------------|
| `consume_credit(p_user_id, p_reason)` | `src/lib/credits.ts` → `POST /api/ats/score`, `POST /api/v1/refine-section` (both require session; pass `user.id`) | **None** — decrements `profiles.credit_balance` for arbitrary `p_user_id` | **High** — unauthenticated caller can drain any user's credits |
| `grant_apple_credits(...)` | `POST /api/v1/iap/verify` only (session + `verifyAppleTransaction` before RPC) | **None** — grants credits for arbitrary `p_user_id`; idempotency is `apple_transaction_id` only | **High** — bypasses Apple verification and API route; mint credits with attacker-chosen transaction IDs |
| `generate_file_path(user_uuid, filename, file_type)` | **No app RPC usage** (types only in `database.ts`) | **None** — pure string builder | **Low** — no DB writes; storage RLS still requires `auth.uid()` on upload paths |

**Repo vs production:** `supabase/migrations/20260503000000_credit_ledger.sql` grants credit functions to `authenticated` only; no `REVOKE EXECUTE FROM PUBLIC/anon`. `generate_file_path` created without restrictive grants in `20250915000001_setup_storage.sql`; remote schema dump marks it `SECURITY DEFINER`. Supabase advisor flag implies production still allows `anon` EXECUTE (schema drift or default PUBLIC grants).

**Follow-up migration scope (founder decision):** `REVOKE EXECUTE ON FUNCTION ... FROM anon, PUBLIC`; `GRANT EXECUTE ... TO authenticated, service_role` only; add `IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN RAISE` inside credit functions; keep `grant_apple_credits` service-role-only (edge function) or add signed-server secret check.

## 2026-07-09 — WP-39 S1 PostHog auth URL sanitizer (P0 privacy leak)
Fixed PostHog capturing Supabase auth-callback URLs with `access_token` / `refresh_token` / `code` / `email` in `$current_url`. **Root cause:** unsanitized `window.location.href` in manual `$pageview` capture plus no `before_send` hook, so posthog-js auto-attached tokens on every event. **Fix:** (1) `sanitizeAnalyticsUrl()` + `before_send` in `src/lib/posthog.ts` — auth routes (`/auth/callback`, `/auth/reset-password`) reduced to pathname only; sensitive params stripped globally from query/hash on all routes. (2) `PostHogProvider` uses `sanitizeAnalyticsUrl()` for manual pageviews. **Files:** `src/lib/posthog.ts`, `src/components/providers/posthog-provider.tsx`, `tests/unit/posthog-url-sanitizer.test.ts`. **Validation:** eslint clean on touched files; new regression test 5/5 pass; verified red state (all 5 fail with sanitizer removed, then restored). Full `npm test` has pre-existing failures (17 suites, `@react-pdf` ESM parse) unrelated to this change. **PostHog historical leak check:** no personal API key in env — could not query dashboard/HogQL; recommend manual audit in PostHog for `$current_url` containing `access_token` or `/auth/callback#`. **Branch:** `fix/posthog-auth-url-sanitizer`.

## 2026-07-09 — WP-37 S5 Web JD fragment filter + anon conversion quiet
Shipped two cleanups. (1) `filterRequirementFragments()` in `job-data-resolver.ts` drops bare pronouns and single-word fragments ("We", "go") from `parsed_data.requirements` at normalize time. (2) `auth-form.tsx` skips noisy console error on 404 session-not-found during anon conversion and clears stale `ats_session_id` from localStorage. **Validation:** `ats-prepare-input` + rate-limit preservation tests pass; eslint clean; `npm run build` succeeded.

## 2026-07-08 — WP-37 S2 Web rate-limit input preservation
Fixed anonymous ATS checker wiping resume + JD after a 429 rate-limit response. Root cause: `FreeATSChecker` unmounted `UploadForm` when `step === "rate-limited"`, so `handleBackToChecker` remounted a fresh form. Fix: keep `UploadForm` mounted (hidden) during rate-limit, same pattern as the processing step. **Files:** `src/components/landing/FreeATSChecker.tsx`, `tests/app/free-ats-checker-failure-preserves-input.test.tsx`. **Validation:** new + existing preservation tests pass; `npm run check:i18n` clean; `git diff --check` clean; `npm run lint` 0 errors; `npm run build` succeeded.

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
