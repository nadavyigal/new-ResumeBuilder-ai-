# Fix: Low ATS score after PR #75 — job-description pipeline feeds the scorer near-empty data

> **Target repo:** this repo (`new-ResumeBuilder-ai-`, web/Next.js).
> **iOS repo:** no changes — it renders the backend score; deploying this fix to Vercel (`new-resume-builder-ai` → resumelybuilderai.com) propagates to the iOS app automatically.
> **Created:** 2026-06-19. Source incident: user re-optimized on the Resumely iOS app after PR #75 (`a6e69cb`) and still saw a low ATS score.

## Context

After PR #75 (`fix/ats-score-issues`, merge `a6e69cb`) merged to `main`, the user re-ran resume optimization on the **Resumely iOS app** and still saw a low ATS score. Investigation shows this is expected: **PR #75 could not have fixed this symptom.**

Two facts establish that:

1. **iOS shows a server-computed score, not the web UI.** The iOS app calls `POST /api/optimize` with only `resumeId` + `jobDescriptionId` and renders `ats_score_after` natively (`OptimizedResumeViewModel.currentATSScore`). PR #75's display-sync fixes (`resolve-display-scores.ts`, the optimization `[id]/page.tsx`) are **web-frontend only** and never execute on iOS. Only PR #75's **server-side scoring library** changes reach the device.

2. **PR #75 improved keyword *matching accuracy*, not job-description *extraction*.** Its commits (`95b9442`, `90b203b`) add whole-word phrase matching and fix the `||`→`??` display bug. Better matching cannot raise a score when there is nothing to match against.

### Root cause (confirmed against production DB `brtdyamysfmctrhuankn`)

Every recent optimization is scored nearly **blind to the job description**:

| opt day | opt score | `optimizations.jd_text` len | `job_descriptions.raw_text` len | `parsed_data.requirements` |
|---|---|---|---|---|
| 2026-06-19 (BDM, Tel Aviv) | 35 | **0** | 221 | **null** |
| 2026-06-18 | 29 | **0** | 16 ("dueto" junk) | null |
| 2026-06-16 | 33 | **0** | 234 | null |
| 2026-06-15 | 39 | **0** | 263 | null |

Representative subscores (2026-06-19): `keyword_exact 27, keyword_phrase 2, recency_fit 18, metrics_presence 0, semantic_relevance 70, format 85, sections 100`. The keyword/phrase/recency analyzers collapse because they receive no real job requirements, dragging the aggregate to ~29–39 regardless of résumé quality.

Why the data is empty:
- **`parsed_data.requirements` is JSON `null`** even though parsing ran (the object has `requirements`, `nice_to_have`, `qualifications`, `responsibilities` keys — only `requirements` is populated-as-null). The scraper/parser is not filling it.
- **`optimizations.jd_text` is length 0** on every record — the JD text is never persisted onto the optimization.
- **`raw_text` is a truncated snippet** (~220 chars) — JD capture grabs a teaser, not the full posting.
- In `prepareInput` (`src/lib/ats/index.ts:203-227`), when `job_extracted_json.requirements` is null the code sets `must_have = []` **with no fallback** — it does not re-extract from `job_clean_text` and does not read the populated `qualifications`/`responsibilities` keys.

Intended outcome: scores reflect the actual résumé↔JD match instead of being structurally capped near 30 by an empty JD payload.

## Approach (both layers — scorer robustness + JD ingestion)

### Layer A — Scorer robustness (immediate score lift, server-side)
File: `src/lib/ats/index.ts`, function `prepareInput` (lines ~194-248).

- When `job_extracted_json` is provided but `requirements` is null/empty, **do not leave `must_have = []`**. Fall back in this order:
  1. `job_extracted_json.requirements` (array/string) — current behavior.
  2. Merge in `job_extracted_json.qualifications` and `job_extracted_json.responsibilities` when present (these exist in `parsed_data` today).
  3. If still empty, call `extractJobData(input.job_clean_text || input.job_extracted_json.raw_text, input.job_extracted_json)` so the generic-keyword fallback (already in `jd-extractor.ts:31-44`) actually runs.
- Mirror the same null-safe handling for `nice_to_have`.
- Keep the existing `containsWholePhrase` / `scoreSkillListMatch` logic from PR #75 unchanged — it is correct; it was just starved of input.

Reuse, don't reinvent: `extractJobData` already filters generic business words and caps at 12 keywords; route the fallback through it rather than writing new extraction.

### Layer B — JD ingestion (root fix)
1. **Populate `requirements` at parse time.** In the JD scrape/parse step that writes `job_descriptions.parsed_data` (the producer of keys `posting_id`, `scraped_at`, `source_domain`, `provenance`), ensure `requirements` (and `nice_to_have`) are filled from the model output instead of landing null. Trace the writer via `grep -rn "parsed_data" src/app/api` and the JD scrape route.
2. **Persist the JD text the scorer used.** Set `optimizations.jd_text` when the optimization is created (currently always empty) so re-scoring and debugging have the exact input. Check the `/api/optimize` and review-apply routes.
3. **Stop scoring against truncated snippets.** Confirm whether `raw_text` ~220 chars is a scraper truncation (likely a LinkedIn/teaser capture). If so, capture the full posting or prefer `clean_text` when longer. Flag to user if this is a product/scraper limit rather than a bug.

### Files to modify (representative)
- `src/lib/ats/index.ts` — `prepareInput` fallback (Layer A, primary).
- `src/lib/ats/extractors/jd-extractor.ts` — optionally read `qualifications`/`responsibilities` in `extractJobData`.
- JD scrape/parse route under `src/app/api/**` that writes `parsed_data` — populate `requirements` (Layer B).
- `src/app/api/optimize/route.ts` (and review-apply path) — persist `jd_text` (Layer B).

## Tests
- Extend `tests/unit/ats-skill-match.test.ts` (or add `tests/unit/ats-prepare-input.test.ts`): given `job_extracted_json` with `requirements: null` but populated `qualifications`/`responsibilities` and a real `clean_text`, assert `must_have.length > 0` and `keyword_exact` subscore > 0.
- Regression: `requirements` present as array still used verbatim (no double-counting from qualifications merge).
- Junk JD (16-char "dueto") still yields a low-but-defensible score without throwing.

## Verification (use latest DB optimization — no new device run needed)
1. Take the 2026-06-19 "Business Development Manager (Tel Aviv)" optimization (raw_text 221 chars, requirements null, baseline opt score **35**).
2. After Layer A, re-run scoring against that exact `resume_text` + `job_descriptions` row (via `rescoreOptimization` or a one-off script) and diff subscores. Expect `keyword_exact` / `keyword_phrase` to rise from ~27/2 and the aggregate to move materially above 35.
3. After Layer B, re-parse that JD row and confirm `parsed_data.requirements` is a non-empty array and a fresh optimization persists non-empty `optimizations.jd_text`.
4. Read-only confirm via Supabase MCP (`brtdyamysfmctrhuankn`): the latest optimizations now show non-zero `jd_text` length and non-null `requirements`.
5. Lint + tests green before declaring done. Deploy to production (Vercel `new-resume-builder-ai`) is required for the iOS app to see the change — flag the deploy for explicit approval.

## Out of scope / notes
- Do not change PR #75's matching algorithm — it is correct.
- `metrics_presence` is consistently 0 (résumé genuinely lacks quantified metrics); that is a separate, legitimate signal, not part of this fix.
- The two 16-char "dueto" JD rows are user/scrape junk, not the target case.
- iOS in-memory LRU score cache (`OptimizationDetailCacheActor`, limit 10) clears on app restart; not the root cause but mention to the user if a stale score lingers after deploy.
