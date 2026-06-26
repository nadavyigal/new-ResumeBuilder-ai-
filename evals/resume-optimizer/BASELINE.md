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

## Remediation (not yet done — recommended next story)

Mirror the RunSmart Story 1b fix: don't trust the prompt alone for the
fabrication-prone case (no source metric available). Either deterministically
strip/flag invented percentages from `experience[].achievements` in
`optimize-pipeline.ts` post-processing (parallel to RunSmart's
`enforcePlanSafety`), or add a second self-check pass that rejects/regenerates
when a generated metric has no traceable source. Re-run with `npm run
eval:resume` after the fix and update this file.
