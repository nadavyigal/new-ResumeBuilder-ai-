# Bench Scripts — Enhancement Quality Plan

Overall Progress: `100%`

## Tasks:

- [x] 🟩 Step 1: Fixtures readiness
  - [x] 🟩 Ensure `tests/fixtures/` contains 10 resume + JD pairs
  - [x] 🟩 Standardize filenames and minimal JSON/text structure

- [x] 🟩 Step 2: Implement benchmark script
  - [x] 🟩 Add `scripts/bench-agent.mjs` (Node ESM)
  - [x] 🟩 Load fixtures; map to { resume_json, job_text }
  - [x] 🟩 Run baseline ATS and `AgentRuntime` for each sample

- [x] 🟩 Step 3: Metrics computation
  - [x] 🟩 Compute per-sample ATS before/after; median lift across 10
  - [x] 🟩 Measure latency_ms (p50, p95); support “no PDF” (BENCH_SKIP_PDF) and “with PDF”
  - [x] 🟩 Calculate diff_stability (median diff count)

- [x] 🟩 Step 4: Structured logging
  - [x] 🟩 Output JSON: `{ ats_gain, diff_stability, latency_ms: { p50, p95 }, errors: { fatal, nonfatal } }`
  - [x] 🟩 Optional per-sample logs with `--verbose`

- [x] 🟩 Step 5: Pass/fail criteria
  - [x] 🟩 Enforce thresholds and exit code accordingly

- [x] 🟩 Step 6: Execution wiring
  - [x] 🟩 Add npm script `bench:agent`
  - [x] 🟩 Document usage in script header

- [x] 🟩 Step 7: Safety and isolation
  - [x] 🟩 Use fallbacks; never throw uncaught exceptions
  - [x] 🟩 Avoid external network during benchmarks
