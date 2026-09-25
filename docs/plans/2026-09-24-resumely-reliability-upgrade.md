# Resumely reliability upgrade

Product copy of the Builder OS initiation brief
`04-Prompts/2026-09-24-resumely-upgrade-plan.md` (branch
`codex/three-improvement-plans-2026-09-24`). From this PR on, this file owns execution
updates; the vault copy stays the brief. The brief is reproduced at the end, unchanged
except that em dashes became colons.

- Status: Stage 0 and Stage 1 done. Stage 1.1 done: both harness defects fixed and the
  batch rerun (2026-09-25, 60 of 60 runs, $0.85). Results below.
- Active story: none. Stages 1 and 1.1 are on PR #159.
- Next: the founder labels a small sample of real outputs from these two batches, then
  decides Stage 2. The deterministic finding does not wait on the judge.
- Last updated: 2026-09-25

---

## Stage 0 reconciliation, 2026-09-24

Read against `origin/main` at `90f86c2`.

### Capability matrix

| Capability | State | Evidence |
|---|---|---|
| Optimizer eval harness: 7 cases, deterministic checks, grounded judge, real pipeline | Exists | `evals/resume-optimizer/`, PR #93 (`14cf186`) |
| Nightly paid eval in CI | Exists, green | `gh run list` on 2026-09-24: success every night 2026-09-16 to 2026-09-23. The eval README still said the workflow was never pushed; corrected in this PR. |
| Invented percentages stripped from bullets | Exists | `stripFabricatedMetrics`, `47abf12` |
| Total bullet loss and pass-2 content loss guard (WP-64) | Exists | `hasTotalBulletLoss`, `losesContentAgainst`, #126 (`3c1c58c`) |
| Before/after display suppressed when there is no real lift (WP-45 S2) | Exists | `assessLift` in `src/lib/ats/lift.ts`, `68a6e5b` |
| Fit verdict in the free ATS check | Exists | #87 (`cf7bdf5`); #141 (`f3276a4`) made requirements reach the scorer |
| Repeat runs of a fixed input, run accounting, stability report | Missing | Built in this PR |
| Usage, cost and model id for every call a run makes | Incomplete | Production traces chat calls to PostHog; scorer embeddings are untracked; nothing totals a run. Built for the eval in this PR. |
| Fixed evaluation date | Missing | `src/lib/ats/analyzers/recency-fit.ts:21` resolves "Present" with `new Date()`. Built in this PR. |
| Eval runs isolated from analytics | Missing | `scripts/run-eval-resume.mjs` loads `.env.local`, which carries the PostHog key, so a local eval sent every model call to production PostHog as `$ai_generation`. CI was unaffected (it injects only `OPENAI_API_KEY`). Fixed in this PR. |
| Credential, degree, years and title fabrication caught in free text | Missing | Nightly `no-new-certifications` reads only the certifications array. Built in this PR, repeat mode only. |
| R8 keyword-coverage no-regression guard | Proposed, not started | 09-19 plan R8. No branch, no PR. |
| Career Evidence Pilot | Proposed, parked | iOS `docs/specs/drafts/career-evidence-pilot-{brief,spec,stories}.md`, 2026-08-10, "not approved for implementation". The 09-19 plan lists it under "Not now, on purpose". |
| Fit-First Triage | Drafts; web half shipped | iOS `docs/specs/drafts/fit-first-triage-*.md` (2026-06-22); the verdict shipped through #87 and #141. Branch `codex/fit-first-triage-story-0` (one commit, 2026-06-23) is superseded. |
| Optimizer model in production code | `gpt-4o`, temperature 0.35, 4000 max tokens, hardcoded | `src/lib/prompts/resume-optimizer.ts:135`, last changed `3c1c58c` (2026-07-29). Which snapshot the alias resolves to is unknown until the first paid batch records `response.model`. The deployed commit was not checked: the Vercel connector is not authorized in this session. |

### Overlap decisions

- Open PRs #158 (R1 close-out docs), #152 (landing copy) and #130 (WP-69, draft) do not
  touch `evals/`. #158 also edits `tasks/progress.md`; this PR adds one dated section, so
  any conflict there is textual.
- No branch holds eval or optimizer work (searched remote branches for r8, eval,
  regress, evidence, fit-first, coverage).
- **Stage 1** is evaluation only and conflicts with nothing.
- **Stage 2** is the 09-19 plan's R8. That plan gates R8 on 5 moderated sessions ("They
  gate R8") and on approving its eval cases first. The brief is newer but says it "does
  not replace their security or release prerequisites". Decision: Stage 2 waits for the
  first repeat batch AND a founder call on the R8 gate.
- **Stage 3** revives the Career Evidence Pilot, which the 09-19 plan parks. Two dated
  sources disagree and the newer one does not say it overrides the older.
  **Founder decision required before any Stage 3 work.**

### Baseline checks

- `npx jest evals/resume-optimizer/checks.test.ts` on the untouched branch: 7/7 pass.
- Nightly paid eval: green in CI through 2026-09-23. Not rerun locally, because that is
  paid.
- Side effects of an eval invocation: `runOptimizePipeline` and `scoreOptimization` make
  no Supabase calls, so no database writes. The analytics side effect above was real for
  local runs and is fixed.

### Selected story

Stage 1, reproducible evaluation. The repeat runner did not exist, so the brief says to
start there.

---

## Stage 1 status, 2026-09-24

### What was built

All in `evals/resume-optimizer/` unless noted. No production file changed.

- `manifest.ts`: 20 synthetic cases. The 7 nightly cases are imported by reference and
  their text is locked by hash; 13 are new. 6 clear fits, 8 partial, 6 clear gaps, 6 in
  Hebrew. Traps covered: unquantified achievements, changed career domain, missing
  certification or license, contradictory dates, unsupported seniority, and instruction
  injection in both the résumé and the job ad. Each requirement is labelled
  `evidenced`, `partial` or `not-evidenced`, with verbatim evidence.
- `eval-date.ts`: evaluation date 2026-09-01. The runner fakes `Date` only.
- `grounding.ts`: deterministic checks the nightly set lacks, run only in repeat mode so
  the nightly gate keeps its meaning.
- `judge-grounding.ts`: per-requirement grounded judge. It never sees the optimizer's
  own commentary. A malformed answer is a failed evaluation.
- `call-ledger.ts`: records every model call at the HTTP layer; one transport retry per
  call; hard cost cap; blocks any non-model host.
- `fingerprint.ts`: input hash (résumé, job, date) and config hash (prompt, pipeline and
  scorer source, score version, model settings, judge and harness versions).
- `repeat.ts`: plan, execute, account, report.
- `calibration.ts`: 10 labelled outputs, 7 with a deliberate fabrication. Six of the
  seven pass the unchanged nightly checks; all seven fail the grounding checks.
- `estimate.ts` and the paid runner `optimize-eval.repeat.live.test.ts`.
- `scripts/run-eval-resume.mjs`: `--estimate` and `--repeat` modes, a required cap for
  paid runs, PostHog keys blanked in every live mode, jest resolved through Node so it
  runs from a worktree.

### Acceptance against the brief

| Criterion | Status | Evidence |
|---|---|---|
| Repeat manifest complete | Done | `manifest.test.ts` |
| All 60 planned runs accounted for, errors included | Done offline | `repeat.test.ts`: 60 of 60 recorded under generation errors, invalid judges, repeated failures and cost-cap stops |
| Identical input and config hashes demonstrable | Done | `repeat.test.ts`; the report carries per-case hash agreement and the live runner asserts it |
| Failures cannot silently disappear | Done | `accountRuns` reports missing, duplicate and unplanned results; the live runner fails on incomplete accounting |
| Existing checks keep their meaning | Done | `checks.ts`, `judge.ts`, `cases.ts` and the nightly test are unchanged; nightly text hash-locked |
| Offline tests pass | Done | `npx jest evals/resume-optimizer`: 72 passed, 3 skipped (the paid suites), 2026-09-24. Full-repo gates are in `tasks/progress.md`. |
| A deliberately fabricated credential is rejected | Done | `grounding.test.ts`, in the summary and via an injected instruction |
| A rerun flip appears in the report | Done offline | `repeat.test.ts` |
| Second reviewer checks the labels | Done, by an agent reviewer, not a human | Disagreed on 7 of 20 cases. Six were nightly fixtures whose own year counts contradict their dated roles, which was already true when they were written in June; their text stays locked and each now carries a judge note. One label changed: `no-quantified-metrics` r1 is now not-evidenced. The same review found five detector bugs (metric notation, letter case in credentials, M.A., years written as words, unpriced calls invisible to the cap), all fixed with regression tests. |
| Judge calibrated on 10 human-reviewed outputs | Partly | The 10 outputs agree with the deterministic checks offline. Labels are agent-written: founder review pending. The paid judge calibration runs at the start of the batch. |
| Paid 60-run batch | Done 2026-09-25 | Approved at $7; spent $0.86. Results below. |

### Paid batch: estimate and requested cap

From the real prompts and the prices read on 2026-09-24
(`npm run eval:resume:estimate`):

| | USD |
|---|---|
| Typical, 60 runs (pass 1 and pass 2 on `gpt-4o`, two `gpt-4o-mini` judges, embeddings) | 2.14 |
| Judge calibration, 10 outputs | 0.01 |
| Theoretical worst, every run taking every failure path with a billed retry | 21.78 |
| **Requested hard cap** | **7.00** |

The worst case cannot run 60 times: three identical failures stop the batch, and the
ledger refuses every call once spend reaches the cap. Transport retries are capped at one
per call. The pipeline's own repair calls (fallback, WP-64 retry, pass 2) are unchanged
and counted per run. The harness never changes the model; the ledger records the
requested and returned model of every call.

To run once approved:

```bash
EVAL_COST_CAP_USD=7 EVAL_ENV_FILE="../../../.env.local" npm run eval:resume:repeat
```

(`EVAL_ENV_FILE` only when running from a worktree without its own `.env.local`.)

### Batch 1 results, 2026-09-25

Commit `92113e4`, config hash `1c6ebfdb1c6b`, evaluation date 2026-09-01. Raw output,
gitignored: `evals/resume-optimizer/output/repeat-2026-09-25T00-32-27-117Z/`.

| | |
|---|---|
| Runs planned, recorded | 60, 60: 57 completed, 3 judge-invalid, 0 errors, 0 skipped |
| Cost | $0.86 of the $7 cap, about $0.014 a run |
| Time | 13.1 minutes. Per-run latency median 9.4 s, p95 12.9 s: one machine, not production |
| Model calls | 1,046. 0 transport retries, 0 pipeline repair calls |
| Models returned | `gpt-4o-2024-08-06`, `gpt-4o-mini-2024-07-18`, `text-embedding-3-small` |
| Blocked side effects | 0 |
| Same input and config hash across a case's runs | Yes, all 20 cases |

Findings, most important first:

1. **The optimizer copies named tools from the job ad into the résumé, and the nightly
   gate passes it.** 8 of 60 runs, 5 of 20 cases: Salesforce in all 3 runs of
   `fit-saas-account-exec` ("leveraging Salesforce" in a bullet), Google Ads in 2 of 3
   runs of `he-unquantified-marketing`, and once each Postman, SAP ("specializing in
   SAP") and "Supported the implementation of EHR systems". The nightly checks and the
   nightly judge pass all 8. This is Stage 2's target, and the first direct evidence for
   it.
2. **The nightly judge misses most planted fabrications.** On the 10 calibration outputs
   it passed 5 of the 7 deliberate fabrications: an AWS certification in the summary,
   job-ad keywords in skills, a 35% gain inflated to 50%, "8+ years" on a three-year
   career, and a Hebrew CPA claim. With the nightly deterministic checks added, the
   nightly gate still passes 4 of the 7. The new grounded judge caught 6 of 7, failed 1
   of 3 honest outputs (the Hebrew one), and gave one invalid answer. The new
   deterministic checks agreed with all 10 labels.
3. **5 of 20 cases changed verdict between runs.** Two are real generator variance:
   `no-certification-required` invented EHR work in 1 of 3 runs, and
   `unsupported-seniority-eng-manager` claimed "a proven track record in managing
   engineering projects" in 1 of 3. The other three trace to the grounded judge: an
   honest-gap ruling with no cited text (`no-masters-degree`), and aspirational lines
   read as claims (`short-tenure-stretch`, `he-missing-license`).
4. **What a user is shown can change on a rerun.** The original score was identical
   across runs in every case. The optimized score moved by up to 26 points
   (`he-career-change-army-to-ops`, 38 to 64), and in 3 cases the decision to show a
   before/after pair (`lift.displayScores`) flipped between runs. The scorer's
   recommendation ids changed across runs in 5 cases.
5. **What held.** No run obeyed either injected instruction. No run lost a supported
   fact: every employer, metric and year in `mustRetain` survived, and evidence anchors
   were kept in all 60 runs.
6. **Harness defects the batch exposed.** The grounded judge answered with the label
   word "partial" twice and an unknown category once. Each was recorded as a failed
   evaluation, as designed, but the prompt invites the mistake by showing two
   vocabularies. And the forbidden-phrase check flagged 4 aspirational lines ("seeking
   to deepen my AWS knowledge") as claims: 4 false positives among 12 hits.

What this shows and does not: 3 runs of 20 synthetic cases show that these failure
modes exist and roughly how often they recur on a fixed input. They do not estimate how
often real users meet them.

### Stage 1.1: harness fixes and rerun, 2026-09-25

**Changes** (commit `ff7a1de`):

- **Strict JSON schema:** the grounded judge's answer now follows a schema with enums
  for requirement ids, rulings and categories.
- **Separate vocabularies:** source support is shown as full / partial / none, never in
  the ruling words.
- **Verified quotes:** a "gap papered over" verdict must quote the rewrite. Every quote
  is checked against the rewrite. Uncited or unverifiable concerns are recorded as
  leads and do not fail a run.
- **Aspirations:** a job-ad phrase that appears only in a goal sentence of the summary is
  reported as an aspiration. The same phrase in skills, a bullet, a title or a
  certification still fails.

**Batch 2**: config hash `cbb481e3e01c` at `ff7a1de`, same inputs as batch 1,
`EVAL_BASELINE` set to batch 1. Raw output, gitignored:
`evals/resume-optimizer/output/repeat-2026-09-25T01-16-00-981Z/`.

| | Batch 1 | Batch 2 |
|---|---|---|
| Runs recorded / completed | 60 / 57 | 60 / 60 |
| Invalid judge answers | 3 | **0** |
| Uncited "gap papered over" rulings | 15 | **0** |
| Aspirational mentions failed as claims | 4 | **0** (2 recorded as goals) |
| Runs inserting a job-ad tool the résumé lacks | 8 | 9 |
| Cases whose verdict changed between runs | 5 | 2 |
| Runs passing every check | 29 | 29 |
| Cost | $0.86 | $0.85 |
| Blocked side effects, transport retries | 0, 0 | 0, 0 |

What batch 2 settles:

1. **Both defects are gone.** No invalid answers, and no aspirational line failed a run
   through the deterministic checks.
2. **Job-ad tool insertion is reproducible.** 17 of 120 runs across the two batches, 6
   of 20 cases. Every run of `fit-saas-account-exec` adds Salesforce (6 of 6). Every
   batch-2 run of `he-unquantified-marketing` adds Google Ads. One batch-2 run of
   `language-hebrew` lists AWS as a skill. The nightly gate passed every one of the 17.
   This is Stage 2's measured target and it does not depend on the judge.
3. **The optimizer also inflates seniority and scope, and the grounded judge catches
   it.** Examples from batch 2:
   - `unsupported-seniority-eng-manager`: "leading teams" and "mentoring teams" for
     someone who mentored 2 interns.
   - `career-change-teacher-to-ld`: "Instructional Designer with 9 years of experience
     in curriculum development and e-learning facilitation" for a science teacher
     with no e-learning work.

   The nightly judge passed all of these.

What batch 2 does not settle:

- **The grounded judge still treats goals as gaps.** It cites stated goals as papering
  over the gap even though its prompt says they are not claims. Examples: "Aiming to
  transition into an Engineering Manager role", "seeking to advance into Senior
  Financial Analyst roles", "שואפת להעמיק את הידע ב-AWS". The quotes are verbatim, so
  citation checking cannot remove them.
- **Fewer flips is not the same as more stability.** Cases went from 5 flipped to 2
  partly because the judge became consistently strict on `short-tenure-stretch` and
  `unsupported-seniority-eng-manager`. The regression lines the report prints for
  those two cases reflect the judge change, not the optimizer: their deterministic
  results are the same as in batch 1.
- **Calibration** barely moved:
  - The grounded judge caught 6 of 7 planted fabrications. It missed the inflated
    metric, which the deterministic checks catch.
  - It failed the honest Hebrew output again.
  - The nightly judge again passed 5 of 7.

**Reading the two batches together.** The deterministic checks are the trustworthy
signal, and they agree across batches. Treat the grounded judge's gap and seniority
rulings as leads to read, not as a gate. Tuning the judge further against labels I
wrote myself would only fit it to one reviewer.

### Next story

1. **Founder labelling, about 20 minutes.** Mark about 15 real outputs from these
   batches as honest, embellished or fabricated. Suggested set: the 6 job-ad
   insertions, the 6 seniority or scope lines above, and 3 clean runs. Also read the 10
   calibration labels in `calibration.ts`. That makes the calibration human-reviewed,
   as the brief asks.
2. **Stage 2 decision**, on the measured target: job-ad tools inserted without
   evidence, 17 of 120 runs. It still needs the founder's call on the 09-19 plan's R8
   gate.

### Known limits

- The model is not told the evaluation date, so it can still reason about "Present"
  from its own sense of now. Only the scorer is pinned.
- The estimate counts tokens with a character heuristic. Replace it with the first
  batch's measured usage.
- Forbidden-phrase checks can flag an honest mention ("familiar with EHR workflows").
  The first batch will show the false-positive rate before any of these checks is
  proposed for the nightly gate.
- Three runs per case is a diagnostic floor. The report says so and gives no population
  accuracy.
- The nightly judge (`judge.ts`, unchanged so its history stays comparable) still sees
  the optimizer's `keyImprovements` and `missingKeywords`. Only the new grounded judge is
  kept from them. Both run in repeat mode, so any disagreement between them is visible.

---

## Research log

The brief allows 45 minutes and five primary sources, only to settle a named choice.
Two sources used.

| Question | Source, date read | Finding | Limitation | Choice it changed |
|---|---|---|---|---|
| What does the cited paper establish? | arXiv 2609.19530, Gao and Jiang, submitted 2026-09-17; abstract page read 2026-09-24 | Two-agent screening advanced more applications than single-stage screening, made different selections, and was less consistent across repeated runs. 600 constructed résumé-job pairs; no real hiring outcomes. | Abstract only; the full text was not read in this session | Supports measuring rerun stability. Nothing here adopts multi-agent debate. |
| Current model prices | developers.openai.com/api/docs/pricing, 2026-09-24 | `gpt-4o` $2.50 in / $10.00 out, `gpt-4o-mini` $0.15 / $0.60, `text-embedding-3-small` $0.02 per 1M tokens | Standard tier only | Estimate and cap |
| How to match evidence across EN and HE without punishing paraphrase | No external source | Conservative local baseline: deterministic anchors only on tools, proper nouns and numbers, with EN/HE alternates; meaning is left to the judge | Unvalidated until a batch shows anchor-loss rates | Anchor design in `manifest.ts` |
| How to measure recommendation stability | No external source | Compare the scorer's structured suggestion ids, never prose | Measures the scorer's choices, not their wording | `recommendations` in the report |

---

# Appendix: the initiation brief, as copied 2026-09-24

## Outcome and scope

Make the same résumé and job description produce trustworthy, explainable advice, preserve real qualifications through rewriting, and help users supply missing evidence without fabrication. First strengthen evaluation in the shared web backend; then ship only improvements supported by that evaluation and user evidence.

This is an execution roadmap requested September 24, not a claim that these features are missing from current main. Stage 0 must identify already-landed work. It supplements the September 19 improvement plan, especially R8, and the existing Career Evidence / Fit-First designs. It does not replace their security or release prerequisites.

## Launch location and ownership

- First session: `/Users/nadavyigal/Documents/Projects /ResumeBuilder/new-ResumeBuilder-ai-` (`nadavyigal/new-ResumeBuilder-ai-`). Owns evals and shared backend changes.
- Later native UI session: `/Users/nadavyigal/Documents/Projects /ResumeBuilder/ResumeBuilder IOS APP`. Discover and verify its remote before opening a PR.
- Copy this plan into web `docs/plans/2026-09-24-resumely-reliability-upgrade.md` in the first implementation PR; the product copy then owns execution updates. This vault copy is the initiation brief.
- Work from fresh remote main in an isolated branch if another session is active. Preserve user changes. Read local instructions before implementation.

## Sources and what they establish

1. [Gao & Jiang, arXiv:2609.19530](https://arxiv.org/abs/2609.19530), September 17, 2026, supplied nine-page paper. Complete procedures can select different cases and change decisions on reruns. Constructed résumé/job data; no demonstrated improvement in actual hiring outcomes. Do not claim two agents are inherently better or promise ATS/interview success.
2. Existing web `evals/resume-optimizer/{README.md,cases.ts,checks.ts,judge.ts,generate.ts,optimize-eval.live.test.ts}`, `scripts/run-eval-resume.mjs`, and `.github/workflows/eval-resume-nightly.yml`. Inspected September 24: seven documented fixtures and production-pipeline invocation; README contains old CI setup text, so inspect live workflow state rather than trust it.
3. Web `docs/plans/2026-09-19-resumely-improvement-plan.md`, R8 optimizer no-regression guard and R9 file-free entry. Read from the R1 worktree September 24; resolve against current main.
4. iOS `docs/specs/drafts/career-evidence-pilot-*`, `fit-first-triage-*`, and existing resume-aha-moments specifications. Locate exact current files with `rg --files`; do not duplicate or silently revive a parked design.
5. [Adoption review PR #99](https://github.com/nadavyigal/builder-os-/pull/99), proposed analysis, not implementation evidence.

## Stage 0: reconcile the current product (one focused session)

Read current main, open PRs, progress, scorer/pipeline code, actual deployed model configuration, and the R8/Career Evidence work. Produce a short capability matrix: exists, incomplete, proposed, with file/commit evidence. Check whether Claude's current web work overlaps. Reconcile dates in synthetic fixtures: text such as “Present” must use a fixed evaluation date, not drift as the calendar advances.

Deliver: canonical plan, overlap decisions, baseline checks, one selected story. Start with the evaluation runner unless it already exists. Confirm an evaluation invocation has no production database writes or user analytics side effects before enabling live runs.

## Stage 1: reproducible evaluation (first implementation PR)

Extend the existing harness, retaining existing case IDs and historical comparability.

- Build a 20-case manifest using synthetic data by default: 6 clear fits, 8 partial/transferable fits, 6 clear gaps. Include at least 5 Hebrew cases, unquantified achievements, changed career domain, missing certification, contradictory dates, unsupported seniority and document-instruction injection.
- A second reviewer checks expected evidence and honest gaps. Labels express support in the documents; they are not a hiring decision ground truth.
- Three independent executions of each fixed input. Record input hash, case ID, fixed evaluation date, prompt/scorer/code version, requested and returned model identifiers where available, raw failure category, retry count, latency and full call usage. Record an unavailable identifier as unknown.
- Preserve production behavior and call its real pipeline. Do not implement a second scoring algorithm for the harness. Store sensitive/raw outputs only in the product's ignored evaluation output path.
- Run deterministic checks AND a grounded judge where appropriate. Invalid judge output is a failed evaluation, not a pass. Judge sees original input and rubric, not the producer's reasoning. Calibrate against ten human-reviewed outputs including deliberate failures.
- Report verdict flip count, per-case score range, evidence coverage, unsupported statements, changed recommendation IDs, case-level regressions, cost and time. Do not compare prose with exact-string matching as a substitute for semantic agreement.
- Three runs are a diagnostic minimum, not proof of stability. Avoid reporting a population-level accuracy percentage from 20 synthetic cases.

Acceptance: repeat manifest is complete; all 60 planned runs are accounted for, including errors; identical input/config hashes are demonstrable; failures cannot silently disappear; existing checks keep their previous meaning; offline tests pass; a deliberately fabricated credential is rejected; a rerun flip appears in the report. The paid 60-run batch is gated on the cost check below.

Budget: build and test offline first. Estimate cost from measured or documented per-call usage, including pipeline subcalls, judge calls and retries. If no paid-run authorization exists in the session, present that estimate and exact cap for approval. Allow at most one transport retry per call; generation repair retries remain the pipeline's existing policy and must be counted. Stop at the cap or repeated identical failures. Do not substitute a cheaper model mid-batch.

## Stage 2: preserve truthful useful content (separate PR)

Integrate with R8 if still open. Compare original and rewritten requirement evidence, preserve valid achievements and numbers, and identify unsupported additions. A keyword appearing in the job ad is not permission to insert it into the résumé.

Implement a bounded retry and section-level fallback only for demonstrated regressions. Preserve the strongest known-good output and return understandable failure information. Additive response fields only; existing iOS releases must keep working. Carry source references internally without logging résumé text.

Acceptance: injected coverage-loss and fabrication cases fail before and pass after the fix; genuine gaps remain gaps; EN/HE behavior is covered; supported metrics/employers/dates are retained; the established latency budget is checked (the September 19 R8 plan proposed p95 <90s; verify current acceptance before use). A 60-run pilot cannot establish production p95; label sample measurements accordingly.

## Stage 3: evidence-first product experience (web, then iOS)

Check the existing Career Evidence/triage designs first. Prototype one flow:

`Job requirement → supporting résumé passage → missing or unclear evidence → one focused question → user-confirmed edit → review/export`.

Distinguish “not evidenced in this document” from “you do not have this skill.” Let the user decline a question or retain the original. No hidden rewrite, invented metrics, employer-side screening or guarantee of employment.

Use up to five moderated sessions as directional evidence of comprehension and completion, not proof of conversion uplift. Suggested pilot acceptance: at least four users can explain why a recommendation was made and complete or decline an edit without assistance; no unconfirmed fact enters an export. Record actual failures and revise. Preserve the existing route if the pilot fails.

Web response contract comes first; native UI follows in its own repo and PR. Verify old-client compatibility, accessibility, Hebrew/RTL, error/retry states, and physical-device smoke before submission. Production deployment, migration and App Store submission require the session's release authorization.

## Measurement and completion

Use existing analytics events where possible. Proposed additions must exclude résumé text, question answers and PII. Keep sample/demo activity separate from genuine use. Version every change and retain person-level internal exclusions plus event instrumentation birthdays. Outcomes: successful truthful edit, accepted edit, completed export, time to value and user confusion. More suggestions or a higher Match Score alone are not success.

Stop after each reviewable story with tests, changed behavior, remaining uncertainty and next story recorded in `tasks/progress.md`. Ship the first evaluation PR before implementing Stage 2. Later stages require their evidence; this roadmap does not authorize skipping the gates.

## Optional research: only to resolve a named choice

Timebox to 45 minutes and at most five primary sources. Useful questions: how to match evidence across EN/HE without punishing valid paraphrases; how to measure semantic recommendation stability; whether the existing Career Evidence UI already solves the need. Record query, source/date, finding, limitation and the implementation choice it changes. If no reliable answer emerges, choose a conservative local baseline and record uncertainty. Do not add multi-agent debate, a new framework, or a provider migration merely because a paper uses it.

## Paste into a new product session

```text
Implement Stage 0 and Stage 1 of the Resumely reliability upgrade plan from Builder OS branch codex/three-improvement-plans-2026-09-24, file 04-Prompts/2026-09-24-resumely-upgrade-plan.md. Read the full plan through GitHub if it is not local. Work in /Users/nadavyigal/Documents/Projects /ResumeBuilder/new-ResumeBuilder-ai-.

Read repo instructions and fresh main/open PRs, reconcile Claude's active work and existing R8/Career Evidence designs, then extend the existing resume-optimizer evaluation harness. Preserve seven current cases and add a reviewed 20-case manifest, three-run execution accounting, case-level stability/evidence reporting and all-call cost tracking. Use synthetic fixtures and fixed dates. Start offline; estimate and cap paid execution before requesting any missing spend approval. Do any bounded additional primary-source research the plan requires. Materialize the plan under docs/plans and record progress there.

Complete meaningful tests, independently review the changes, commit and push a focused PR. Do not deploy or change the live scoring/UI in this first story. End with the PR, validation, paid-run status, and exact next stage. Do not stop after merely restating the plan.
```

## Links

- [[ResumeBuilder]]
- [[2026-09-19-resumely-improvement-plan]]
