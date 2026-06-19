# Project Progress

Project: ResumeBuilder AI (Web)
Status: Active
Current Phase: ATS scoring pipeline error sweep (production score-capping bugs); PDF parse/render-preview rollout parked
Active Story: LinkedIn job scrape returns thin/meta-only content in production (Vercel serverless IP likely flagged by LinkedIn anti-bot) — root cause of low scores on real test jobs; parked per founder decision 2026-06-19, no new scraping-proxy dependency added without explicit approval
Last Completed Story: Wired job_extracted_json (parsed_data) into PUT /api/v1/optimizations/[id] save-path scoreOptimization() call (commit 85505a3, 2026-06-19) — closes the gap where manual edits/re-scores bypassed PR #76's structured resolver
Next Recommended Story: If LinkedIn scrape-blocking needs fixing later — either evaluate a residential-IP scraping proxy (new paid dependency, needs approval) or add a thin-scrape detector that prompts the user to paste JD text manually instead of silently scoring against a truncated og:description snippet
Estimated Completion: Web is live; launch-support items above remain
Blockers: LinkedIn appears to serve degraded/meta-only HTML to Vercel's serverless egress IPs — confirmed by diffing a direct curl (full 2,950-char description, all sections present) against the production-scraped row (222 chars, every parsed_data field null) for the same job URL. Not fixable in the resolver/scorer layer; needs a scrape-layer fix.
Risks: PDF/DOCX upload smoke test still not run (#1 pre-approval risk per tasks/MEMORY.md 2026-06-08); user_credits table vs profiles.credit_balance reconciliation must be resolved at Gate A
Last Validation: PR #76 merged 2026-06-19 08:40 UTC + save-path fix (85505a3) 2026-06-19. CI/lint/tests all pass. Cloudflare Workers Build "match1resume1to1job" check fails on every PR (#72-76) — confirmed stale/orphaned integration (no wrangler.toml in repo), not a regression.
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

## 2026-06-19 — Save-path resolver gap fixed; real root cause found (LinkedIn scrape blocking)
Fixed commit 85505a3: PUT /api/v1/optimizations/[id] now selects parsed_data and forwards it as jobExtractedJson to scoreOptimization(), so manual edits/re-scores get the same structured fallback as the initial optimize path. Lint clean, ats-prepare-input.test.ts passes (4/4).

Founder re-ran a fresh optimization live (not a cached one) on the Base44 Partnership Manager LinkedIn job and the score was still 21/100 — confirmed via Supabase (optimizations row created 14:38 UTC, well after the PR #76 deploy). Pulled job_descriptions.parsed_data for that row: every field (requirements, qualifications, responsibilities, nice_to_have) is null, and clean_text/raw_text are both exactly 222 chars — the truncated og:description meta tag.

Direct curl of the identical LinkedIn URL from this machine returned the full page (260KB) with the show-more-less-html section intact (2,950 chars, "Job Description" + "Qualifications" bullet lists, no authwall). The production scraper (src/lib/scraper/jobExtractor.ts, fetched from Vercel's serverless egress) is getting a stripped-down version of the same page — almost certainly LinkedIn anti-bot serving degraded content to flagged datacenter/cloud IP ranges. No error is thrown (200 OK), so it fails silently into a near-empty job_data.

This means PR #76's resolver and the save-path fix above are both correct and necessary, but neither can fix this specific failure mode — there's no real text to fall back to. Founder decision 2026-06-19: park this, do not add a scraping-proxy dependency without explicit approval. If revisited, options are (a) a residential-IP proxy service (new paid dependency) or (b) detect thin scrapes and prompt the user to paste the JD manually instead of silently scoring against the meta snippet.
