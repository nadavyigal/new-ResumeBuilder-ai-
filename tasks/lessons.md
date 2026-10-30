# Lessons Learned — ResumeBuilder

## A still-valid signed Apple payload can be replayed after a refund (2026-10-29)

**Symptom:** Codex P1 on #204. After a REFUND notification revoked a subscription, sending the original, pre-refund signed transaction to `/api/v1/iap/verify` cleared `revoked_at` and switched the plan back on. Same class as the consumable "refund before grant" hole fixed on #197.

**Root cause:** Apple's signature proves a payload is genuine, not that it is current. A JWS signed before the refund stays valid forever and carries no `revocationDate`. The upsert treated "same transaction, no revocation" as the newer truth.

**Fix:** `upsert_subscription` (`20261030094500_pricing_v2.sql`) leaves `revoked_at` unchanged for the transaction the row already holds when its expiry is not later; only a later-expiry renewal overwrites it from its payload. Refunds, revokes and `REFUND_REVERSED` go through `set_subscription_revocation`, ordered by the notification's `signedDate` (`revocation_signed_at`). Renewal info is ordered by its `signedDate` (`renewal_signed_at`), so a late older notification answers `stale`.

**Rule:** for every Apple-signed input, decide which field orders it (expiry for transactions, `signedDate` for renewal info) and never let an equal-or-older payload undo a stricter state (revoked, refunded, auto-renew off). Test it by replaying the old payload after the newer one.

## `REVOKE ... FROM PUBLIC` does not lock a Supabase function (2026-10-22)

**Symptom:** the local database test for PR #195 replayed the production baseline and found `anon` could execute `consume_credit` and `grant_apple_credits`. Both are SECURITY DEFINER and trust `p_user_id`, so any client could have granted itself Apple credits.

**Root cause:** Supabase sets default privileges that grant every new `public` function to `anon` and `authenticated` directly. The baseline only says `REVOKE ALL ... FROM PUBLIC`, which removes the PUBLIC grant and leaves the two role grants. The R1 migration `20260922000000_revoke_client_definer_exec.sql` revoked those grants in production, but the baseline dump that replaced the history keeps only `FROM PUBLIC`, so every fresh replay (Supabase branch, local, staging) reopens the hole. The same replay leaves 12 other baseline SECURITY DEFINER functions callable by `anon` (for example `increment_rate_limit`, `cleanup_old_files`); that is a separate follow-up migration.

**Fix:** `supabase/migrations/20261021120000_export_credits.sql` revokes from `public, anon, authenticated` and grants `service_role` only, for every credit-writing function. `scripts/tests/export-credits-local-db.mjs` checks the ACL and makes real `anon` and `authenticated` calls that must fail with 42501.

**Rule:** every SECURITY DEFINER function gets `revoke all on function ... from public, anon, authenticated;` then an explicit grant, in the same migration that creates it. Test it by calling it as `anon` and `authenticated`, not by reading the dump.

## A new Supabase function is callable by every client unless you revoke it (2026-10-22)

**Symptom:** A SECURITY DEFINER function written for the server only was callable through `/rpc` by `anon` and `authenticated` on a fresh replay, so any client could run it and bypass RLS.

**Cause:** Postgres grants EXECUTE on every new function to PUBLIC, and the baseline's default privileges also grant new `public` functions to `anon` and `authenticated`. `revoke ... from public` alone leaves the role grants.

**Fix:** `20261022120000_harden_security_definer_grants.sql` revokes both defaults for functions postgres creates. From that migration on, a function created by role postgres (what migrations and the SQL editor use) has no client EXECUTE, in any schema.

**Rule:** A new function a client must call (a browser or app `rpc()`, a helper used inside an RLS policy, or a function from a later `create extension`) needs an explicit `grant execute ... to authenticated`. A server-only function needs nothing. Prove grants with real roles (`set local role anon`), not by reading the migration.

## The hiring company's name is not a skill (2026-10-15)

**Symptom:** on a real optimization for "Business Development Manager - Ad tech at Appstock", the dashboard Quick fixes banner said "Skills/Tools: appstock" and "Improved appstock by [X%] by [action]" (Hebrew too: "שיפרתי appstock ב-[X%]").

**Root cause:** two defects. (1) Job ads name their employer in their duties ("Drive revenue growth for Appstock", "Represent Appstock at industry events"). The requirement atomizer and the capitalised-word fallback both read the name as a skill, even when the scraper had stored `company_name: "Appstock"`. It was also a must-have no résumé can hold, so it held the keyword score down. (2) `MainIssuesSummary` filled the metrics example's `{metric}` with the first missing skill, so any skill read as a number to improve.

**Fix:** `src/lib/ats/extractors/company-names.ts` finds the employer (company fields, "<Title> at <Company>" heading, "<Company> is looking for", "About <Company>", "Company:", "At <Company>, we") and removes it from requirement terms in `extractJobData` and `buildJobDataFromExtractedJson`. The metrics example now uses its own fallback term ("a core KPI").

**Rules:**
1. Before an extracted term reaches the user as a "missing skill", ask whether any résumé could ever contain it. The employer's name, the job title and section headings cannot.
2. Fill a template slot only with a value of the slot's kind. A skill in a metric slot reads as nonsense even when the skill is real.
3. A filter that removes words from requirements must fail closed on doubt, because a false positive deletes a real skill. Review of #187 (2026-10-16) found five ways the first version got it wrong: "About Engineering" read as an employer (deleted "engineering"); "The Trade Desk" refused because it starts with "The"; a prepended title hid the ad's own first-line heading; "Bank of America" missed because of the lowercase "of"; and Salesforce hiring for "Salesforce administration" lost the product. Now: "About <Name>" is read only when nothing stronger names the employer, a company field is trusted as given, title and ad are scanned apart, connectors are allowed, and a name the ad uses as a product ("experience with X", "X administration") is never removed. Round 2: a first-line "X at Y" counts only when X names a job, and "About Y" only when Y looks like a proper name or the ad repeats it.
4. After four review rounds of edge cases (2026-10-18), the rule is evidence strength, not more patterns: remove the employer only on a known company field, a first-line "<Title> at <Company>", a "Company:" label, or a name the ad repeats. A name made only of department words ("Customer Success") is never the employer. When the evidence is weak, keep the requirement: a company name left in the list costs a little score, a deleted skill is a false gap.

## A rescore after a guard must never fall back to the score it replaced (2026-10-16)

**Symptom:** when the truth guard changed the résumé and the rescore came back as the scorer's zero-confidence fallback, `runOptimizePipeline` returned `{ ...selected, optimizedResume: guarded.resume }`: the pass-1 score and lift, measured on the résumé before the guard, shipped beside a different document. Worse, the scorer has thrown instead of returning that fallback since WP-45 D8, so the usual failure was a 500 from `/api/optimize` and the user lost a correct, guarded résumé.

**Fix:** both failures (a throw, or 0 with zero confidence) return the guarded résumé with its real baseline, no after-score and `lift.scoreUnavailable: true` (`unavailableLift` in `src/lib/ats/lift.ts`). `toWireFit` sends `potentialScore`, `delta` and `confidence` as null, `topGaps` empty and an additive `scoreUnavailable`; every `fit` field is optional on iOS, so installed builds decode it and, with `displayScores` false, show no pair.

**Rules:**
1. A cached measurement belongs to the document it measured. When the document changes, rescore or say "unavailable"; never carry the old number forward.
2. When a callee changes from returning a sentinel to throwing, every caller that checked the sentinel needs a `catch` too.
3. An unmeasured run is not a no-lift run: do not count it in `optimization_no_lift`.
## A rewrite prompt cannot stop promotion; check titles, years and leadership claims after it (2026-10-07, consolidated 2026-10-16)

**Symptom:** the optimizer retitled an individual contributor "Engineering Manager", claimed "8+ years" on a three-year career, and wrote "leading teams" for someone who mentored 2 interns. The nightly judge passed every one.

**Fix:** `src/lib/ai-optimizer/seniority-claims.ts` compares each claim with the original résumé after the rewrite and corrects it without a model call, the same posture as `job-ad-terms.ts` and `stripFabricatedMetrics`. #161 (a competing guard with a model repair) was folded in on 2026-10-16: its prompt rule ("Never raise seniority or scope"), its Hebrew title and management patterns, and its "management experience" claim. The same day a probe found #164 still missed both batch 3 failures #161 was opened for (a summary calling a logistics officer "מנהל תפעול", and "team of 3" grown to "org of 30"); those checks were ported too.

**Rules:**
1. Every new deterministic check runs against the calibration outputs before it ships: zero honest outputs may change.
2. A leadership pattern must not match through a preposition, or "Led planning for the team" (true) reads as "led the team" (false).
3. Evidence for a role comes from that role's own block (header lines and bullets). Career-wide evidence let a later manager job excuse a promoted earlier role (PR Steward, 2026-10-13).
4. Read a role header as a block and accept a title only if it names a job. Reading only the adjacent line restored "New York, NY" as a title.
5. Count years in roles, not from the first start date: a gap is not experience.
6. Before closing one of two competing PRs, run the loser's own test inputs against the survivor. A commit message saying "folded in" is not proof.
7. A Hebrew preposition is attached to the number it governs ("ב-35%"). Removing only the number leaves "ב-." in the shipped text; remove the preposition with it. The planted cases in `evals/resume-optimizer/planted.ts` check for anything left hanging.

## A truth guard that silently deletes claims takes points from people the claim is true for (2026-10-12)

**Symptom:** the optimizer bullet guard (#169) cut job-post phrases such as "non-technical stakeholders" that the résumé did not state. Measured on the Maya fixture, each phrase was worth about 3 points, so every user lost them, including users who really had done the thing and simply had not written it down.

**Decision (founder):** never ship an unconfirmed claim, and never take a score away without asking. The guard now *holds* job-post phrases instead of deleting them, and the web review page offers each one as "Add only if true", unselected. Confirming restores the optimizer's line and its score exactly (Maya: optimizer 52, confirmed 52, declined 50). Only clients that can show the item opt in (`confirmJobPhrases`); installed iOS builds keep the old behaviour until their own UI ships.

**Rules:**
1. When a guard removes something that might be true, offer it back to the user rather than deleting it. The score then reflects only what the user stands behind.
2. A behaviour change on a shared API needs an opt-in from clients that can render it. Installed native builds cannot, and silently degrading them is a product decision, not a default.

## A better job-title parser can lower a correct candidate's score (2026-10-12)

**Symptom:** the iOS free check showed "Align your headline or summary with the target title '{targetTitle}'". The job text ("Kesher Commerce is looking for a Data Analyst to join...") matched none of `extractJobTitle`'s patterns, so the title was empty and `fillTemplate` left the placeholder in.

**Trap:** teaching `extractJobTitle` that sentence dropped the Data Analyst candidate from 52 to 48. With a target title, title_alignment compares against the resume's titles; `parsePdf` flattens the PDF to one line, the resume-side title parser finds none, and the analyzer returns 20 instead of the neutral 50 it returns when the job has no title. The offline calibration benchmark did not move because none of its cases use that sentence shape.

**Fix:** guard the output (`createSuggestion` drops any suggestion with an unfilled `{placeholder}`), and parse the hiring sentence in a separate `extractHiringSentence` used only to label the saved job in upload-resume. Scoring reads `parsed_data`, not the row's title.

**Rules:**
1. A template with missing data must produce no suggestion, never a partly filled one. Check after filling, not by hoping every caller supplies every key.
2. Before changing any extractor that feeds scoring, run one real fixture end to end and compare the score, not only the calibration benchmark. A benchmark only covers the shapes it contains.

## Free-check quick wins copied the job post into the résumé (2026-10-11)

**Symptom:** on the live free check, fictional candidates got "before/after" rewrites carrying the job's facts: "a portfolio of 60 mid-market accounts" (60 is the job's number), "reducing churn by tracking account health and acting early on risk" (a job duty), "learning objectives and storyboards" (never in the résumé). A real "38 of 41" became "[X%]". When OpenAI failed, the fallback appended "resulting in 25% improvement in efficiency" to a real bullet.

**Root cause:** the quick-win prompt passed the job's responsibility sentences verbatim, numbers included, and asked for "relevant keywords from the job description". The only check on the output was length and JSON shape. Same class as the 2026-09-25 lesson below, in a second generator that lesson's fix never reached.

**Fix:** `src/lib/ats/quick-wins/grounding.ts` rejects a rewrite that adds or drops a number, puts a placeholder over a real number, inflates a number, borrows any term the job uses and the résumé does not (only an action-verb swap such as "monitor" -> "track" is allowed), quotes a "before" that is not verbatim résumé text, or takes a number from another bullet (a summary may gather numbers only with their original wording). The first version allowed two job-only terms; the first live preview run used that room to append job duties, so the budget is zero. One repair retry with the reasons; no template padding. Fixtures and tests: `tests/fixtures/free-check-2026-10-11/`, `src/lib/ats/__tests__/free-check-truthfulness.test.ts`.

**Rules:**
1. Every AI surface that rewrites résumé text needs its own deterministic grounding check. A guard in the optimizer does not protect the free check. The reverse held a day later: the optimizer's tool-only guard let "non-technical stakeholders" into a bullet on iOS (2026-10-12). Both paths now share `findJobOnlyTerms` in `src/lib/ats/quick-wins/grounding.ts`; a third rewriting surface must call it too.
2. Never pad a short AI result with template claims. Fewer suggestions is an honest result.
3. Filler keywords ("finish", "acting early risk", "write sql queries") come from clause atomization, not from the model. Fix them in `skill-phrase-extractor.ts` and re-run the calibration benchmark (zero score changes on 2026-10-11).

## A red suite on main hides the bug behind it (2026-10-06)

**Symptom:** 18 suites / 77 tests were red on main for months and every PR called them "pre-existing". Two were real product bugs (fragment skills written into resumes by "apply tip"; CamelCase keywords dropped by `extractKeywords`), one was a real missing Stripe webhook, and two suites had never run at all because they crashed at parse time.

**Cause:** once a suite is red, a new failure inside it is invisible. A parse error hides every assertion in the file; a failing first line hides the lines after it.

**Rules:**
1. When fixing a stale assertion, run the file again and read what the *later* assertions say. The template suites only proved "no data loss" after the heading checks stopped failing first.
2. A negative check against a string the output never contains (`not.toContain('CERTIFICATIONS')` when the HTML says `Certifications`) can never fail. Assert on the real markup.
3. A test that needs OpenAI, the real Supabase project or a running server is gated behind an opt-in flag (`tests/helpers/live-gates.ts`), never left red in the default run.
4. Never quarantine by name in CI. Fix the suite or gate it explicitly; CI runs the whole `npx jest`.

## Telling a model which keywords are missing makes it insert them (2026-09-25)

**Symptom:** the optimizer added named tools from the job ad that the résumé never mentions (Salesforce, Google Ads, Postman, SAP, AWS) in 17 of 120 eval runs. The nightly gate passed all 17: its checks read only the certifications array, and its judge passed 5 of 7 planted fabrications.

**Root cause:** `buildInitialGaps` computes the job keywords absent from the résumé and the gap prompt asked the model to "include" them "where truthfully supported"; the system prompt said to "explicitly address each one". A list of terms the résumé lacks, handed over as things to include, is an instruction to fabricate. The hedge "where truthfully supported" did not hold.

**Fix:** say what the list is ("NOT found in the original resume, do not claim these") and enforce deterministically afterwards (`src/lib/ai-optimizer/job-ad-terms.ts`), the same posture as `stripFabricatedMetrics`. Batch 3: 0 insertions in 60 runs.

**Rules:**
1. Never pass a model a list of things the source lacks without saying, in the same line, that they must not be claimed.
2. Measure fabrication with repeat runs, not a single nightly pass. One run per case hid this: the same case inserted Salesforce in 6 of 6 runs, and the gate never noticed.
3. Expect honest fixes to lower the headline number. Here the mean lift halved, because part of it had been made of claims the résumé could not back.

## A duplicate of the repo inside the repo poisons every glob (2026-08-05)

**Symptom, twice in one session, from two different sources.** First, `npm run build` failed on
`src/app/[locale]/auth/callback/route 2.ts` — an iCloud duplicate that exists on no branch and in
no CI run. Then PR #112's test file reported 4 failures that belonged to a *different working
tree*: `.claude/worktrees/wp69-score-version`, a live git worktree checked out inside the repo.

**Cause.** Both are the same defect wearing different clothes: a tool that discovers files by
pattern rather than by git. `next build` walks the app directory; jest walks `testMatch`. Neither
asks git what is tracked. `modulePathIgnorePatterns` excluded `resume-builder-ai/` but nobody had
thought of `.claude/worktrees/`.

**Scale, measured, because the guess would have been far too low.** With nested worktrees
collected: **148 suites / 869 tests / 156 failing.** Without: **74 / 435 / 76.** Exactly half of
every run was a stale clone of itself, contributing 80 of the 156 failures.

**The expensive part is not the noise, it is the baseline.** The "17 failed suites / 80 failed
tests" figure quoted across `tasks/progress.md` as the comparison point for every change was
measured with the duplicate present. Every "identical to baseline" claim built on it was
comparing against a number that was partly an old copy of this repo. Re-measure before reusing it.

**Rules:**
1. Any tool that discovers files by glob needs an explicit ignore for `.claude/worktrees/` and for
   iCloud ` 2.*` duplicates. Both are now in `jest.config.js` and `.gitignore` respectively.
2. When a test fails, read the **path in the failure output** before reading the test. A path that
   does not start where you expect is the whole diagnosis.
3. Never create a git worktree inside the repo it belongs to. Put it in a temp directory.


## A shared module's imports decide which bundle it lands in (2026-07-26)

**Symptom:** `npm run build` failed with `node:readline` unresolved in a browser bundle,
after a refactor that touched no routing and no client code.

**Cause:** deduplicating two scorer orchestrators moved a `await import('./quick-wins/generator')`
into `src/lib/ats/core.ts`. That module reaches posthog-node. core.ts is transitively imported
by a client page through `optimization-review/index.ts` → `integration.ts`, so the Node built-in
was pulled into the client graph. **Webpack traces dynamic imports too** — `await import()` is
not an escape hatch from the client/server boundary.

**Rule:** when a module is reachable from both a route handler and a page component, it must not
import anything Node-only. Inject the dependency instead: declare a function type, let server
callers pass the real implementation. And re-run a clean `next build` after ANY change to what a
shared module imports — jest, eslint and tsc all pass while the bundle is broken.

**Companion rule:** read the total `tsc --noEmit` error count, not a `grep`-filtered subset. A
filter scoped to the directory I was editing hid a second broken call site in another route, and
the production type-check found it after I had already declared the fix complete.

## Tightening a scorer without recalibrating its bands silently breaks it (2026-07-24)

**Symptom:** users were told "Skip" on three quarters of checks and "Strong" was never
awarded to anyone. The 60-day observed maximum was 51 on the free checker and 62 on
authenticated optimizations, against a Strong threshold of 75.

**Cause:** four correct fixes landed 2026-06-18 to 2026-06-26 — word-bound keyword
extraction (#80), requirement atomization (#82), the junk-phrase filter (#85), and
stripFabricatedMetrics. Each removed a source of inflation. None was followed by a
recalibration pass, so the top third of the scale became unreachable while the bands
stayed where they were. Monthly optimized-score means: 60.7 in May, 38.8 in June.

**Rule:** any change that alters what the scorer counts is a scale change. Re-run the
calibration benchmark (`src/lib/ats/benchmark/`) in the same PR and either confirm the
bands still separate the labelled cases or move them deliberately with the date recorded.
Never compare or average scores across a boundary — use `src/lib/ats/score-regime.ts`.

**Second-order rule, learned the same day:** when fixing a measurement asymmetry, verify
the change does not move the ORIGINAL side of a before/after pair, not just that the
composite went up. Two attempts at this in one session made the reported improvement
wider for reasons unrelated to the optimization — a derived stub reaching four analyzers
that branch on `resume_json`, and two different format functions being compared to each
other. Both flattered the product.

> Read this before any triage session. Add a new lesson whenever a recurring bug is fixed.

---

## Jest 30 async mocks can infer `never` in contract tests

**Symptom:** `npx tsc --noEmit` reports `TS2345` because values passed to `mockResolvedValue` or `mockRejectedValue` are not assignable to `never`, even though Jest executes the test successfully.
**Root cause:** An untyped `jest.fn()` does not provide enough return-type context for Jest 30's resolved/rejected value helpers under this repo's TypeScript configuration.
**Fix:** Define the async implementation directly, for example `jest.fn(async () => value)` or `jest.fn(async () => { throw error; })`, so TypeScript infers the promise result from the function body. When matcher typing also needs argument types, use a typed rest tuple and `void args`; underscore-prefixed unused parameters still trigger this repo's ESLint rule.

---

## `status` is a read-only parameter in zsh

**Symptom:** A verification wrapper exits immediately with `zsh: read-only variable: status` before it can inspect the command result.
**Root cause:** zsh reserves `status` for the previous command's exit code.
**Fix:** Store exit codes in a neutral variable such as `exit_code` rather than assigning to `status`.

---

## ATS keyword extractor matched tech terms as substrings (fabricated skills → low scores)

**Symptom:** Non-technical roles (Business Development, Partnership Manager) scored ~34 even with a fully-scraped 6KB JD. `must_have` for a Fresha BD role came out as `["rust","express","api","Fresha\nAbout","Trusted"]`.
**Root cause:** `extractKeywords` in `src/lib/ats/utils/text-utils.ts` matched each technical term with `new RegExp(term, 'gi')` — no word boundaries. So `rust` matched inside "t**rust**ed", `api` inside "r**api**dly", `express` inside "**express**ing", `go` inside "Google". These fabricated skills never appear in the resume, collapsing `keyword_exact` (22%) and `keyword_phrase` (12%).
**Fix:** Wrap each term in alphanumeric lookarounds `(?<![A-Za-z0-9])(?:term)(?![A-Za-z0-9])` (not `\b` — several terms contain symbols like `c++`, `.net`, `ci/cd`, `rest api`). Also changed the capitalized-phrase pattern from `\s+` to `[ \t]+` so phrases don't span line breaks ("Fresha\nAbout").
**Note:** This was one of several compounding causes of low scores — see progress.md 2026-06-21. It is necessary but not sufficient on its own (lifts ~2 pts); the JD structured-requirement extraction and AI-optimizer metric quality are the larger remaining levers.

---

## LinkedIn JD section headings vary endlessly — classify by keyword, don't enumerate phrases

**Symptom:** A Fresha Business Development Manager posting (the same job behind the 34/100 score investigated above) had `parsed_data.requirements/qualifications/responsibilities` ALL null despite a full 6KB scrape with genuinely well-structured `<strong>heading</strong><ul><li>...` content.
**Root cause:** `extractFromLinkedIn` in `src/lib/scraper/jobExtractor.ts` matched section headings against a fixed list of literal phrases ("Responsibilities", "What you'll do", "Requirements", "Must have", "Qualifications"...). This posting used "What You Will Be Doing", "What We Are Looking For", and "Added bonus" — none of which matched, so every structured field silently came back null even though the content was present. Re-checking the existing `guest-fragment.html` fixture (Base44 job) showed the *same* gap was already latent there: its first `<ul>` (under heading "Job Description") was responsibilities content the old regex never caught either — only `qualifications` matched ("Qualifications" heading), which is why that test still passed (it only asserted `listCount > 0`, not which bucket).
**Fix:** Added a generic fallback (`extractClassifiedHeadingSections` + `classifyHeading`) that scans every `<strong>heading</strong><ul>...</ul>` block in the description and buckets it by keyword family (responsibilities / requirements / qualifications / nice_to_have / benefits) via regex on the heading text, rather than requiring an exact phrase. Only fills buckets the literal-phrase matching above left empty, so a recognized phrase still wins first. Also wired up `nice_to_have` (previously always hardcoded `null`).
**Verified:** Live-fetched the real Fresha LinkedIn guest fragment (job 4425913724) and confirmed responsibilities/requirements/nice_to_have populate correctly post-fix. Regression test added: `tests/unit/linkedin-job-extractor.test.ts` with new fixture `tests/fixtures/linkedin/guest-fragment-varied-headings.html`.
**Note:** This closes the dominant remaining lever from the 2026-06-21 multi-causal diagnosis — JD structured-requirement extraction. The scorer no longer needs to fall back to the noisy `extractKeywords` prose-keyword proxy for postings with well-formed but non-standard heading phrasing.

---

## Supabase 406: `.single()` on missing or multiple rows

**Mistake:** Using `.single()` on a query that can return zero or multiple rows.
**Fix:** Use `.maybeSingle()` when zero rows is valid. Only use `.single()` for primary key lookups with a guaranteed match.

---

## Stripe webhook: secret mismatch

**Mistake:** `STRIPE_WEBHOOK_SECRET` set to the Stripe API key instead of the webhook endpoint signing secret.
**Why it fails:** Stripe signs webhook payloads with the endpoint-specific secret, not the API key. A mismatch causes all webhook events to fail verification silently.
**Fix:** In Stripe Dashboard → Developers → Webhooks → click your endpoint → reveal the "Signing secret". That value (starts with `whsec_`) goes in `STRIPE_WEBHOOK_SECRET`.

---

## OpenAI timeout on long resumes

**Mistake:** AI route handler times out on long resumes because the default Vercel function timeout is too short.
**Fix:** Add `export const maxDuration = 60` to any route file that calls OpenAI. For streaming responses, use `streamText` from Vercel AI SDK.

---

## Normalize compatibility aliases at every persistence boundary

**Mistake:** Fixing `responsibilities` versus `achievements` only where the AI JSON is parsed, while a later canonicalizer accepts both keys and can persist `achievements: []` again.
**Why it fails:** The optimizer output is not the final stored object. Review selection rebuilds and normalizes the résumé before insert, so a correct upstream object can be replaced by an original canonical role whose bullets remain under the alias. Renderers and scorers still read only the canonical key.
**Fix:** Enforce the canonical field at every rebuild or persistence boundary, and keep tolerant fallbacks on read paths for historical rows. Regression fixtures must exercise the full review/apply shape, not only the model parse function.

---

## Wrong Supabase project in env

**Mistake:** `NEXT_PUBLIC_SUPABASE_URL` points at the wrong project (dev vs. prod).
**Fix:** Check the URL subdomain against Supabase Settings > API. They must match.

---

## Raw pdfjs-dist is a trap on Vercel serverless — use unpdf instead

**Symptom:** Server-side PDF parsing (e.g. `/api/public/ats-check`) returned a 500 with an empty body in production while working locally. Caught by the route's try/catch it became a 400 "We could not read your resume."

**Final fix: do NOT call `pdfjs-dist` directly. Use `unpdf`** (a serverless-first wrapper that bundles a pdfjs build with the DOM polyfills baked in). It's a normal ESM dependency webpack bundles — no externals, no worker config, no tracing hacks, no DOM globals:
```ts
import { extractText, getDocumentProxy } from 'unpdf';
const pdf = await getDocumentProxy(new Uint8Array(buffer));
const { totalPages, text } = await extractText(pdf, { mergePages: true });
```
Always wrap the call in try/catch returning a JSON 400 so a bad PDF can never surface as a blank 500. Refs: PR #72 + #73 (incomplete pdfjs fixes), PR #74 (unpdf — the real fix).

**The four layers we peeled before giving up on raw pdfjs — each a browser/Node env difference that was a false green locally:**
1. `require()` of `pdf.mjs` (ESM) → `ERR_REQUIRE_ESM` on Vercel's Node. Changing to `import()` wasn't enough because `config.externals` makes **webpack compile `import()` back into a `require()`**.
2. `webpackIgnore` native import fixed #1, but `require.resolve('…pdf.worker.mjs')` compiles to a numeric webpack module id → pdfjs "Invalid workerSrc type". Fix: don't set `workerSrc` (Node uses a main-thread fake worker).
3. A webpackIgnore'd import isn't auto-traced, so `pdf.mjs`/`pdf.worker.mjs` are missing from the function bundle unless force-included via `outputFileTracingIncludes`.
4. Once pdfjs finally loaded, it threw `ReferenceError: DOMMatrix is not defined` — Vercel's runtime takes a pdfjs code path needing the DOM global. **Not reproducible locally** (local pdfjs extracts text fine without DOMMatrix), so no local fix could be verified. This is why we switched to unpdf.

**Two reproduction techniques (a plain `next start` is NOT enough — local Node hides these):**
- ESM/require trap: `NODE_OPTIONS='--no-experimental-require-module' npm run start` makes local Node reject `require()` of ESM like Vercel's does.
- DOM-globals trap: in a node script, `delete globalThis.DOMMatrix; delete globalThis.Path2D; delete globalThis.ImageData;` before parsing, to simulate Vercel's environment. unpdf passes this; raw pdfjs's failing path does not.

---

## LinkedIn serves a degraded authwall to datacenter IPs — scrape the guest API, never /jobs/view

**Symptom:** URL-submitted LinkedIn jobs scored very low (~21/100) in production but looked fine when tested locally. The stored `job_descriptions` row had `clean_text`/`raw_text` of exactly ~222 chars and every `parsed_data` field null.

**Root cause:** `extractJob` fetched `https://www.linkedin.com/jobs/view/{id}`. From Vercel's serverless egress IP, LinkedIn returns a degraded authwall/`session_redirect` page that contains only the `og:description` meta tag (~222 chars) and NO `show-more-less-html` job body. `extractFromLinkedIn` parsed the meta snippet into `about_this_job` and returned a valid object **without throwing**, so the catch-fallbacks never fired and the thin data flowed straight to scoring. A residential IP (local dev / curl) gets the full page, so this is invisible locally — same class of false-green as the unpdf/DOMMatrix trap above.

**Fix:** Use LinkedIn's public guest endpoint `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{id}` — it returns the full posting body, works from datacenter IPs, and needs no User-Agent. The guest fragment differs from the full page: no `og:title`/`<title>` (title/company come from `topcard__title` / `topcard__org-name-link`), no `<p>` tags in the body (recover the whole `show-more-less-html__markup` as the body), and `<strong>Qualifications<br><br></strong>` headings (the `<br>` breaks any regex requiring the keyword immediately before `</strong>` — match `<strong[^>]*>\s*(Keyword)` instead). Ref: PR fix/linkedin-guest-scrape.

**Never let a scrape silently produce a score.** Added `isThinExtraction` + `ThinJobExtractionError` thrown centrally in `extractJob`; `/api/upload-resume` now prefers pasted text and otherwise returns `422 JOB_URL_UNREADABLE`. Optimizing against an empty JD is worse than telling the user to paste it.

**Reproduction caveat:** a real authwall only reproduces from a datacenter IP. Local curl/dev gets full content. Verify on a Vercel preview via the `?token=`-gated `/api/debug/scrape-check` route, not locally.
