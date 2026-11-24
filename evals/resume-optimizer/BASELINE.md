# Resume-optimizer eval — baseline

First eval run that establishes where the resume optimizer's factual-accuracy
quality starts. The gate is intentionally left at target (judge pass rate >=
0.85); the harness itself needed two corrections before it measured truthfully
(documented below), but the underlying generator currently fails on real
fabrication. Do not loosen thresholds to pass — fix the generator.

## Run 1 (2026-06-26, harness as first written) — judgePassRate 29%, 0 critical

Misleading result. Investigation found two harness bugs, not five production bugs:

1. **Judge prompt bug**: the judge penalized cases where the model *honestly
   left a missing qualification unaddressed* (the correct, safe behavior) as
   if that were itself a fabrication. 4 of 5 "failures" were this false
   positive (`no-masters-degree`, `short-tenure-stretch`,
   `no-certification-required`, `language-hebrew`). Fixed by making the judge
   prompt explicit: honest omission is a SUCCESS, not a defect; only fail for
   a concrete, citable fabricated claim.
2. **Deterministic-checker gap**: `checks.ts` only verified entity names
   (employer/institution/certification) traced to the original resume. It had
   no check for fabricated *numbers* in achievement bullets. Fixed by adding
   `no-new-percentage-metrics`: any `\d+%` in optimized achievements must
   exact-match a percentage already present in the original resume text.

## Run 2 (2026-06-26, after harness fixes) — judgePassRate 86%, 1 critical

With the harness corrected, the real finding surfaced cleanly:

- **`no-quantified-metrics` fails the deterministic gate.** The candidate's
  original resume has zero numbers anywhere. The optimizer invented "reducing
  resolution time by 20%" and "improving CSAT scores by 15%" — concrete,
  unsupported metrics. The system prompt (`resume-optimizer.ts`) already says
  *"If no metric exists, keep impact statements concrete but non-numeric"* —
  proven, live, that the model violates this instruction under pressure when
  no real metric is available to draw from.
- All other 6 cases: 0 fabrication, judge pass.

## Run 3 (2026-06-26, after production fix) — judgePassRate 100%, 0 critical

Fixed: `stripFabricatedMetrics()` added to `optimize-pipeline.ts`, applied to
every candidate (gap-prompt path, fallback path, and pass 2) before scoring or
returning. Mirrors RunSmart's `enforcePlanSafety` — deterministic enforcement,
not prompt-only. It removes any `\d+%` figure in achievement bullets that
doesn't exact-match a percentage already present in the original resume text,
then collapses leftover dangling connector words ("by by", "by through") so
the bullet still reads cleanly.

Verified on `no-quantified-metrics`: the optimizer's invented "20%"/"15%" are
now gone and the bullets read naturally ("Led a team to reduce ticket
resolution time through process streamlining...", "Improved CSAT scores by
training new hires..."). Judge: truthfulness 4, overallPass true, "No
fabricated claims were found."

Unit-tested directly in `tests/unit/optimize-pipeline.test.ts` (`describe('stripFabricatedMetrics')`,
5 cases: fabricated removal, multiple fabrications, genuine metric preserved,
no-percentage passthrough, percentage-only-bullet edge case).

This baseline is now green at 100% / 0 critical. Re-run with `npm run
eval:resume` after any future change to the pipeline or prompt, and update
this file if the result changes.

## 2026-11-23: model comparison before the gpt-4o shutdown (2027-01-14)

Repeat eval, 20 manifest cases (6 Hebrew), 1 run each, `EVAL_REPEATS=1`. Generator
set with `OPENAI_MODEL_PLAN`; judges `gpt-4o-mini` unless noted. Prompts unchanged.

| Generator | Verdict pass | Hebrew pass | Deterministic | Grounding judge | Gen p50 / p95 per call | Gen tokens in / out / reasoning | Gen cost per CV |
|---|---|---|---|---|---|---|---|
| gpt-4o (current) | 12/20 | 4/6 | 20/20 | 12/20 | 3.5 s / 4.6 s | 64,435 / 16,795 / 0 | $0.0165 |
| gpt-6.2-sol (effort low) | 13/20 | 4/6 | 20/20 | 13/20 | 7.6 s / 10.6 s | 65,376 / 19,973 / 0 | $0.0114 |
| gpt-6.1-terra (effort low) | 13/20 | 4/6 | 19/20 | 13/20 | 6.5 s / 8.6 s | 65,095 / 18,679 / 23 | $0.0058 |
| gpt-6.2-sol, judges on gpt-6-luna | 18/20 | 5/6 | 19/20 | 19/20 | 7.6 s / 10.6 s | 65,371 / 19,970 / 0 | $0.0121 |

- No generator regressed. All 40 generation calls per model returned valid JSON (0 non-200, 0 repair calls).
- The one deterministic failure (terra, and sol on its second batch) is the same Hebrew case,
  `he-career-change-army-to-ops`: the model expanded צה״ל to "צבא ההגנה לישראל (צה״ל)" and the
  substring employer check reads the expansion as a new employer. A checker limit on Hebrew
  abbreviations, not an invented employer; left as is.
- Judge calibration (10 labelled outputs, 7 planted fabrications): nightly judge gpt-4o-mini 6/10,
  gpt-6-luna 10/10; grounding judge gpt-4o-mini 9/10, gpt-6-luna 8/10. Neither missed a planted
  fabrication. On live outputs gpt-6-luna fails far fewer runs (19/20 vs 13/20 grounding passes),
  so switching the judge moves the baseline: re-baseline before using it as the gate.
