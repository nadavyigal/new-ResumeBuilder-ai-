
# 


Overall Progress: `100%`

## Tasks

- [x] 🟩 Define agent types and enums
  - [x] 🟩 Add `src/lib/agent/types.ts` with `AgentResult`, `Diff`, tool interfaces, and `RunInput`.
  - [x] 🟩 Export `OptimizedResume` alias from `ai-optimizer` for reuse.

- [x] 🟩 Implement intent detection helper
  - [x] 🟩 Add `src/lib/agent/intents.ts` with regex-first detection.
  - [x] 🟩 Add OpenAI Agents classification fallback (short rationale only).

- [x] 🟩 Implement pure tool adapters
  - [x] 🟩 JobLinkScraper.getJob (wrap `scraper/jobExtractor` + `job-scraper`).
  - [x] 🟩 ResumeParser.parse (wrap `pdf-parser`, path or bytes).
  - [x] 🟩 ResumeWriter.applyDiff (apply text/style/layout diffs to `OptimizedResume`).
  - [x] 🟩 DesignOps.theme (validate/normalize font, color, spacing, density, layout).
  - [x] 🟩 LayoutEngine.render (use `template-engine`, generate PDF via `export.ts`, upload).
  - [x] 🟩 SkillsMiner.extract (keywords via `ai-optimizer.extractKeywords`).
  - [x] 🟩 ATS.score (keyword score via `ai-optimizer.calculateMatchScore` + recs).
  - [x] 🟩 Versioning.commit (insert into `resume_versions`).
  - [x] 🟩 HistoryStore.save / linkApply (insert/update `history`).

- [x] 🟩 Add Supabase migration (idempotent)
  - [x] 🟩 Create `supabase/migrations/20251023000100_agent_sdk.sql`.
  - [x] 🟩 Alter `profiles`: `credit_balance DECIMAL DEFAULT 0`, `welcome_credit_applied BOOLEAN DEFAULT false`.
  - [x] 🟩 Create `resume_versions` (FK `auth.users`, indexes).
  - [x] 🟩 Create `history` (FK `auth.users`, `resume_versions`, indexes).

- [x] 🟩 Implement AgentRuntime orchestrator
  - [x] 🟩 Add `src/lib/agent/index.ts` with `class AgentRuntime { run(...) }`.
  - [x] 🟩 Detect intent → plan actions → execute tools → merge diffs → score ATS.
  - [x] 🟩 Persist version/history; package `AgentResult` with short rationales only.
  - [x] 🟩 Stub undo/redo/compare with `ui_prompts`.

- [x] 🟩 Wire OpenAI Agents SDK
  - [x] 🟩 Define lightweight LLM planner `src/lib/agent/llm-planner.ts`.
  - [x] 🟩 Use model `gpt-4o-mini` for planning/classification.
  - [x] 🟩 Integrate planner suggestions into actions log.

- [x] 🟩 Implement render/export and storage
  - [x] 🟩 Use `export.ts` to create preview PDF.
  - [x] 🟩 Upload to Supabase Storage bucket `artifacts` (placeholder path on failure).
  - [x] 🟩 Return Storage path in `artifacts.preview_pdf_path`.

- [x] 🟩 Add API routes (additive, server-only)
  - [x] 🟩 `src/app/api/agent/run/route.ts` (Node runtime) → returns `AgentResult`.
  - [x] 🟩 `src/app/api/agent/apply/route.ts` → sets `apply_date`, returns updated history row.

- [x] 🟩 Add Jest config and mocks
  - [x] 🟩 Add `jest.config.ts` with TS paths mapping.
  - [x] 🟩 Provide safe defaults to avoid network calls in tests.

- [x] 🟩 Write unit tests for tools (minimal, meaningful)
  - [x] 🟩 `tests/agent/design-ops.test.ts` (validation/coercion).
  - [x] 🟩 `tests/agent/resume-writer.test.ts` (apply text/style diffs).
  - [x] 🟩 `tests/agent/skills-miner.test.ts` (deterministic keywords).
  - [x] 🟩 `tests/agent/ats.test.ts` (score + recommendations).

- [x] 🟩 Write e2e API smoke tests
  - [x] 🟩 `tests/api/agent-run.test.ts` (acceptance command; actions/diffs/artifacts/score).
  - [x] 🟩 `tests/api/agent-apply.test.ts` (`history_id` → `apply_date` set, record returned).

- [x] 🟩 Lint, types, and compatibility checks
  - [x] 🟩 Type safety and validators integrated
  - [x] 🟩 No UI files changed; additive routes only
  - [x] 🟩 Optional signed URL left for future toggle

## Validation & Fallback Layer

- [x] 🟩 Add validators and safe parsers
  - [x] 🟩 `src/lib/agent/validators.ts` (Zod schemas + safeParse* helpers)
  - [x] 🟩 `RunInput`, `Diff`, `AgentArtifacts`, `AgentResult`, `ATSReport`

- [x] 🟩 Add runtime fallbacks
  - [x] 🟩 `src/lib/agent/runtime/fallbacks.ts` (`getFallbackATS`, `getFallbackDiffs`, `getFallbackArtifacts`)

- [x] 🟩 Add structured logger
  - [x] 🟩 `src/lib/agent/utils/logger.ts` (agent_run, tool_error, storage_warn + PII redaction)

- [x] 🟩 Integrate validators into tools
  - [x] 🟩 Import validators in all adapters before returning data
  - [x] 🟩 Validate ATS report, diffs, artifacts where applicable

- [x] 🟩 Hardening `/api/agent/run`
  - [x] 🟩 Catch errors and always return valid `AgentResult`
  - [x] 🟩 Use fallbacks and add `ui_prompts` on degraded paths

## Config Safety Nets — Rollout Plan

- [x] 🟩 Step 1: Environment configuration
  - [x] 🟩 Add `.env.example` with flags and key placeholders
  - [x] 🟩 Note `local.env` for real API keys

- [x] 🟩 Step 2: Agent flags module
  - [x] 🟩 `src/lib/agent/config.ts` exporting `{ enabled, shadow, model }`

- [x] 🟩 Step 3: Route gating and shadow mode
  - [x] 🟩 `src/app/api/agent/run/route.ts` returns 501 if fully disabled
  - [x] 🟩 Shadow: legacy optimizer response + background agent run
  - [x] 🟩 Structured logging and safety wrappers

- [x] 🟩 Step 4: Shadow telemetry logging
  - [x] 🟩 Compute metrics and insert into `agent_shadow_logs`
  - [x] 🟩 No impact on response timing

- [x] 🟩 Step 5: SQL migration (idempotent)
  - [x] 🟩 `supabase/migrations/20251023000300_agent_shadow.sql`

- [x] 🟩 Step 6: Compatibility and safety checks
  - [x] 🟩 Default flags keep prod unchanged
  - [x] 🟩 501 path verified in code
  - [x] 🟩 Shadow mode telemetry path implemented

- [x] 🟩 Step 7: Minimal docs
  - [x] 🟩 Comments in files and `.env.example` for usage
