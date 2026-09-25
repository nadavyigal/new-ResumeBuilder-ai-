# Resume-optimizer eval harness

Eval coverage for the highest-stakes AI feature in ResumeBuilder: the resume
optimizer (`src/lib/ai-optimizer/optimize-pipeline.ts`, used by `POST
/api/optimize`). Answers the question deterministic tests can't: *is the
AI-generated resume actually truthful?*

This is the same gap closed for RunSmart's plan-generator, ported to this
product. FR-012 ("Maintains factual accuracy — no fabrication") is already a
documented requirement (`tests/contract/test_optimize.spec.ts`); this harness
is the first CI-able, no-server-required way to actually verify it.

## The risk this targets

For a running-coach app, the risk is unsafe training load. For a resume
optimizer, the risk is **fabrication**: inventing an employer, degree,
certification, years of experience, or metric the candidate doesn't have. The
golden set is built around honest gaps — cases where the job description asks
for something the candidate's real resume doesn't support — so the eval can
catch the model papering over the gap instead of being honest about it.

## Layers

| File | Runs | What it does |
|---|---|---|
| `cases.ts` | — | Golden set: 7 cases, each with a documented honest gap (a JD requirement the candidate genuinely lacks). |
| `checks.ts` | free | Deterministic fabrication detector: any employer, institution, or certification in the output that doesn't trace back (substring match) to the original resume text is a critical failure. Plus matchScore range and structural sanity. |
| `judge.ts` | paid | LM-judge (gpt-4o-mini) grounded in the original resume text AND the documented honest gap, scoring truthfulness, ATS alignment, clarity, completeness. |
| `generate.ts` | paid | Calls the **exact** production pipeline (`runOptimizePipeline`) — no mocking, no duplicated logic. |
| `checks.test.ts` | free, in CI | Proves the fabrication detector actually catches fabrication (fabricated employer/institution/certification fixtures) and that an honest resume passes clean. |
| `optimize-eval.live.test.ts` | paid, gated | The real eval: generate → check → judge across the golden set. `@jest-environment node` (real network; the default jsdom env only matters for browser-ish tests). Skipped unless `RUN_LIVE_EVAL=1`. |

### Repeat eval (added 2026-09-24)

Same pipeline, same input, run three times per case, every run accounted for. It
answers a narrower question than the nightly gate: does the optimizer reach the same
truthfulness verdict, recommendations and score each time? Plan and status:
`docs/plans/2026-09-24-resumely-reliability-upgrade.md`.

| File | Runs | What it does |
|---|---|---|
| `manifest.ts` | none | 20 synthetic cases: the 7 nightly cases by reference (text locked by hash) plus 13 new. 6 clear fits, 8 partial, 6 clear gaps, 6 in Hebrew. Requirement-level labels say what the documents support, not whether to hire. |
| `eval-date.ts` | none | Fixed evaluation date. The scorer resolves "Present" with `new Date()`, so the runner fakes Date (only Date) to keep scores comparable across batches. |
| `grounding.ts` | free | Deterministic checks the nightly set lacks: credentials and degrees claimed in free text, injected instructions laundering a claim, inflated years, inflated titles, new metrics in the summary, job-ad keywords copied in as skills, lost facts and lost evidence anchors. Runs only in repeat mode, so the nightly gate keeps its meaning. |
| `judge-grounding.ts` | paid | Per-requirement grounded judge. Never sees the producer's own commentary. A malformed answer is a failed evaluation, never a pass. |
| `call-ledger.ts` | none | Records every model call at the HTTP layer (requested and returned model, tokens, latency, retries, cost). Caps transport retries at one, enforces a hard cost cap, and blocks any non-model host, which is how a run proves it made no analytics or database writes. |
| `repeat.ts` | none | Plans the runs, executes them with cost-cap and repeated-failure stops, accounts for every planned run, and builds the stability report (verdict flips, score ranges, changed recommendation ids, evidence coverage, unsupported statements, regressions against a baseline, cost and time). |
| `calibration.ts` | none | 10 labelled outputs, 7 with a deliberate fabrication. Agent-labelled, founder review pending. |
| `estimate.ts` | free | Cost estimate from the real prompts and the verified prices. |
| `optimize-eval.repeat.live.test.ts` | paid, gated | The repeat runner. Skipped unless `RUN_REPEAT_EVAL=1` and a positive `EVAL_COST_CAP_USD`. |

## Running it

```bash
# Free deterministic checks (also runs in normal `npm test`):
npx jest evals/resume-optimizer/checks.test.ts

# Full paid eval against the live model (needs OPENAI_API_KEY):
npm run eval:resume

# Repeat eval: estimate first (free), then run with an approved cap (paid):
npm run eval:resume:estimate
EVAL_COST_CAP_USD=7 npm run eval:resume:repeat
```

The nightly eval writes `evals/resume-optimizer/report.json` (gitignored) with
per-case resumes, check results, and judge verdicts. The repeat eval writes
`evals/resume-optimizer/output/repeat-<timestamp>/` (gitignored): `plan.json`,
`runs.jsonl` (raw output per run), `report.json`, `ledger.json`, `calibration.json`.
Optional: `EVAL_REPEATS` (default 3), `EVAL_CALIBRATE=0` to skip judge calibration,
`EVAL_BASELINE=<path to an earlier report.json>` for regression findings, and
`EVAL_ENV_FILE=<path>` when running from a worktree without its own `.env.local`.

Every live mode blanks the PostHog keys before starting jest. Without that, a local
run sends synthetic résumés to production analytics as `$ai_generation` events,
because the optimizer traces every model call.

## The gate

Fails (non-zero exit) if either:
1. **Any** fabrication-critical deterministic check fails on **any** case, or
2. The LM-judge pass rate falls below **0.85** (judge marks `overallPass` and `truthfulness >= 4`).

## When it runs

- **Free deterministic checks**: part of the normal Jest suite.
- **Paid LM-judge eval**: `.github/workflows/eval-resume-nightly.yml` runs it nightly, on
  manual dispatch and on `release/**` pushes (not per PR, to control token cost). Checked
  2026-09-24 with `gh run list`: green every night from 2026-09-16 to 2026-09-23.
- **Repeat eval**: manual only, gated on an approved cost cap. Not in CI.

## Extending

This structure (cases → deterministic fabrication check → grounded LM-judge →
gated runner) is the template for ResumeBuilder's other LLM features (chat
assistant, ATS amendment generator, design recommender). Copy the folder,
swap the generator import, and write a rubric for that feature's dominant risk.
