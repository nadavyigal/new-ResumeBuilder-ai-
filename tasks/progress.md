# Project Progress

Project: ResumeBuilder AI (Web)
Status: Active
Current Phase: ATS scoring pipeline error sweep (production score-capping bugs); PDF parse/render-preview rollout parked
Active Story: Verify ATS score fix actually surfaces on a freshly-created iOS optimization (existing/cached optimization rows show stale scores by design — GET /api/v1/optimizations/[id] reads persisted ats_score_original/optimized, no recompute)
Last Completed Story: PR #76 — feed scorer real JD requirements when parsed_data.requirements is null (merged 2026-06-19)
Next Recommended Story: Pass job_extracted_json into the PUT /api/v1/optimizations/[id] save path's scoreOptimization() call — it currently falls back to naive text extraction instead of the structured resolver, so edits/re-saves don't get PR #76's fix either
Estimated Completion: Web is live; launch-support items above remain
Blockers: —
Risks: PDF/DOCX upload smoke test still not run (#1 pre-approval risk per tasks/MEMORY.md 2026-06-08); user_credits table vs profiles.credit_balance reconciliation must be resolved at Gate A
Last Validation: PR #76 merged 2026-06-19 08:40 UTC. CI build-test pass, Vercel deploy SUCCESS, lint pass. Cloudflare Workers Build "match1resume1to1job" check fails on every PR (#72-76) — confirmed stale/orphaned integration (no wrangler.toml in repo), not a regression.
Last Updated: 2026-06-19
Latest QA Report: tasks/2026-06-08-smoke-test-upload-backend.md (plan; execution pending)

<!--
Seeded 2026-06-12 per Agentic OS MANUAL.md "How to make a project reach High confidence"
(open decision in Agentic OS tasks/progress.md, approved by founder 2026-06-12).
Keep the keyed block above current after each significant validation; the Agentic OS
refresh parser reads it. This repo has no tasks/todo.md or session-log.md; MEMORY.md
carries session history.
-->

## 2026-06-18 — ATS PDF fix merged + smoke passed
fix/pdf-parser-unpdf merged to main (PR #74). unpdf resolves the Vercel 500. Render-preview remains parked.

## 2026-06-19 — ATS JD pipeline fix merged (PR #76); score-capping bug only partially closed
fix/ats-jd-pipeline merged to main (PR #76, commit 7a91c8c). Scorer now falls back to qualifications/responsibilities and re-extracts from JD text when parsed_data.requirements is null — fixes the initial /api/optimize creation path. CI/lint/Vercel all green.

Cloudflare Workers Build "match1resume1to1job" check failed on this merge — verified it fails identically on PR #72, #73, #74, #75 too, and this repo has no wrangler.toml. Stale/orphaned Git integration, unrelated to this app. Not a regression; candidate for disconnecting later.

Found while verifying live: the fix does not fully close the score-capping bug.
1. GET /api/v1/optimizations/[id] (iOS diagnosis screen) reads persisted ats_score_original/ats_score_optimized columns and never recomputes — so any optimization created before 08:40 UTC today will keep showing its old, pre-fix score forever. Re-running /api/optimize on a fresh job is required to see the fix.
2. PUT /api/v1/optimizations/[id] (save-edit path) calls scoreOptimization() without jobExtractedJson, so it falls back to extractJobRequirements()'s naive text parsing instead of buildJobDataFromExtractedJson()'s structured fallback — meaning saves/re-scores through this path still don't benefit from PR #76.

Next: confirm with a brand-new optimize run (not a re-opened old one) whether the score lifts; if it does, file a follow-up to wire job_extracted_json into the save-path scoreOptimization() call in src/app/api/v1/optimizations/[id]/route.ts.
