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

## Running it

```bash
# Free deterministic checks (also runs in normal `npm test`):
npx jest evals/resume-optimizer/checks.test.ts

# Full paid eval against the live model (needs OPENAI_API_KEY):
npm run eval:resume
```

Writes `evals/resume-optimizer/report.json` (gitignored) with per-case resumes,
check results, and judge verdicts.

## The gate

Fails (non-zero exit) if either:
1. **Any** fabrication-critical deterministic check fails on **any** case, or
2. The LM-judge pass rate falls below **0.85** (judge marks `overallPass` and `truthfulness >= 4`).

## When it runs

- **Free deterministic checks**: part of the normal Jest suite.
- **Paid LM-judge eval**: run manually via `npm run eval:resume` today. A nightly + pre-release GitHub Action (mirroring RunSmart's plan-generator eval cadence — not per-PR, to control token cost) is written at `.github/workflows/eval-resume-nightly.yml` but **not yet pushed** — the repo's git push token lacks the `workflow` OAuth scope required to add files under `.github/workflows/`. Run `gh auth refresh -s workflow` then push that file to enable it.

## Extending

This structure (cases → deterministic fabrication check → grounded LM-judge →
gated runner) is the template for ResumeBuilder's other LLM features (chat
assistant, ATS amendment generator, design recommender). Copy the folder,
swap the generator import, and write a rubric for that feature's dominant risk.
