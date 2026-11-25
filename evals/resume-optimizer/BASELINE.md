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

## 2026-11-24: prompt upgrade (truth, Hebrew, content rules) on gpt-6.2-sol

Design doc: `docs/ai-prompt-upgrade/phase1-review.md`. Generator `OPENAI_MODEL_PLAN=gpt-6.2-sol`
(effort low), judges `gpt-4o-mini` (same as the B row above, so the comparison is fair),
`EVAL_CALIBRATE=0` (calibration unchanged since 2026-11-23). New prompts: 25 cases x 3 runs
(`EVAL_CASE_SET=prompt-upgrade`). Old prompts: the 5 new cases x 3 runs, from `origin/main` at `fa4de8b`.

| Set | Old prompts (B) | New prompts (C) |
|---|---|---|
| 20 manifest cases, verdict pass | 13/20 (65%, 1 run, 2026-11-23) | 42/60 (70%); first run alone 13/20 |
| Hebrew subset (6 cases) | 4/6 (67%) | 15/18 (83%) |
| 5 new cases (HE-1 to HE-5), verdict pass | 3/15 | 7/15 |
| Deterministic critical failures | 0/20 + 4/15 on new cases | 0/75 |
| Content-rule lint (beat-ATS, robots, guarantees, prices, competitors), slash forms, placeholders, dates | 0 / 35 runs | 0 / 75 runs |
| Language match (today's rule) | 35/35 | 75/75 |
| JSON failures, `finish_reason: length`, schema fallbacks, repair calls | 0 | 0 |
| Cost per run (generation + judges) | $0.0119 (20 cases), $0.0131 (new cases) | $0.0121 |
| Latency per run p50 / p95 | 16.7 s / 22.0 s | 15.1 s / 18.6 s |

- Old-prompt critical failures on the new cases: the employer צה"ל rewritten as a different
  string (read as a new employer), "Tel Aviv University" translated to Hebrew (read as a new
  institution), and an added Hebrew degree line. Truth rule 2 (never translate or expand names)
  removes all of them.
- Cases that pass 3/3 now and failed in B: `language-hebrew`; `short-tenure-stretch` 2/3.
- One case below B: `no-certification-required` (B pass on 1 run, C 1/3). The three C summaries
  match B's almost word for word and repeat the resume's own "4 years"; the gpt-4o-mini judge
  flags that sentence in two runs and passes it in the third. Judge variance, not a prompt change.
- Still failing in both: `career-change-teacher-to-ld`, `he-career-change-army-to-ops`,
  `contradictory-dates`, `unsupported-seniority-eng-manager`, and on the new set
  `he-qa-istqb-gap`, `he-army-logistics-team-size` (the judge reads "seeking an operations role"
  framing as papering over the gap). Follow-up, not this PR.

Expert workflows and quick wins (`scripts/eval/expert-mini.ts`, WRITER gpt-6.1-terra, FAST
gpt-6-luna; 3 cases incl. Hebrew HE-6; 9 rewrites, 6 cover-letter runs, 6 quick-wins runs each):

| | Old prompts | New prompts |
|---|---|---|
| Validation failures | 0 | 0 |
| Cover letters with a bracket placeholder ("[Your Name]") | 2/6 | 0/6 |
| Critical content findings, promise patterns, slash forms, gender flips | 0 | 0 |
| Language match | 21/21 | 21/21 |
| Full rewrite latency per call p95 / max (timeout 30 s) | 12.5 s / 12.5 s | 12.1 s / 12.1 s |
| Rewrite truth guard: terms removed, titles restored | n/a | 0 / 0 (nothing to remove) |
| Quick wins discarded by grounding | 5 | 3 |
| Spend | $0.0885 | $0.0886 |

Total paid spend for this PR's evals: $1.28 (cap $10).

## 2026-11-25: judges moved to gpt-6-luna (gpt-4o-mini shuts down 2027-01-14)

`EVAL_JUDGE_MODEL` now defaults to `gpt-6-luna` for both judges, and the nightly workflow
evaluates the production generator (`OPENAI_MODEL_PLAN=gpt-6.2-sol`) instead of the code
default. Measured on one repeat run (20 manifest cases, sol generator, $0.25), then the SAME
20 outputs re-judged with `rejudge.live.test.ts`:

| Judge | Nightly calibration | Grounding calibration | Planted fabrications missed | Nightly pass (live) | Grounding pass (live) | Agreement with luna |
|---|---|---|---|---|---|---|
| **gpt-6-luna** (new default) | **10/10** | 7/10 | 0 | 20/20 | 18/20 | — |
| gpt-4o-mini (old) | 6/10 | 9/10 | 0 | 20/20 | 15/20 | nightly 20/20, grounding 17/20 |
| gpt-6.1-terra (tried) | 9/10 | 7/10 | 0 | 20/20 | 20/20 | nightly 20/20, grounding 18/20 |

- Calibration = 10 labelled outputs, 7 with a planted fabrication. No judge missed a fabrication.
- luna's 3 grounding calibration errors are honest résumés marked as failing (it flagged
  "Communication", "TypeScript" and a Hebrew skill line as forbidden claims). Strict, not lax.
- The nightly gate (7 cases, nightly judge only) passes with luna and sol: judge pass 100%, 0 critical.
- New repeat-run baseline with luna judges: 18/20 pass, 0 deterministic failures, 0 verdict flips.
  Comparisons with batches judged by gpt-4o-mini above are not like for like.
