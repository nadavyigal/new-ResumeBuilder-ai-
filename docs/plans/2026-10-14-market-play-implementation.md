# Implementation plan: Resumely market play

Written 2026-10-14 by Claude Code, from `docs/plans/2026-10-14-market-play-handoff.md` and the
merged plan (artifact NXpvcK4E52sCAopobGaaRR, version 2). Corrected 2026-10-15 after review on
PR #175 (Codex, CodeRabbit, PR Steward) and with R1 measured and re-verified.

Status: **founder approved the market play on 2026-10-15; the plan takes effect when PR #175
merges.** Then the three tracks run in parallel, one session per track, and inside each track
one story at a time: implement, lint and tests, report, ask.

## Founder decisions (2026-10-14)

| # | Decision | Answer |
|---|---|---|
| D1 | Pricing shape | **Yes.** Credit packs $3.99 for 1, $12.99 for 5, $19.99 for 10 tailored exports, credits never expire, no subscription at launch. AI cost per optimization measured in R1 (below): the price floor holds. D1 picks the pack shape only; it does not open the StoreKit implementation gate (Track 2). |
| D2 | Claim order | **Yes.** No "asks before it adds" claim on iOS or in Hebrew until the guard runs there. |
| D3 | Gate channel | **Yes,** run with the marketing advisor. Founder asked for the full prompts for this week: `docs/gtm/growth-loop/cycle-01-prompts.md`. |
| D4 | Research agent | **Freeze it.** It deletes the Resume Worded and Kickresume accounts and the saved passwords. Public pages only from now on. Which agent ran the benchmark is still to be confirmed (see Open questions). |
| D5 | Paid test | **Not now.** Revisit after G1b ships. EXD-034 stands unchanged. |

## R1 result: AI cost per optimization (closes the AI-cost input to the price floor)

Full method and queries: `docs/research/2026-10-ai-cost-per-optimization.md`. Measured in PostHog
project 270848 (LLM analytics, `$ai_total_cost_usd`) on 2026-10-14 and re-run on 2026-10-15
with identical totals.

| Measure, 30 days to 2026-10-14 | Value |
|---|---|
| Optimization runs (2 gpt-4o calls each) | 12 runs, $0.2641 in total |
| Cost per run, all 12 | $0.018 to $0.032, mean $0.022 |
| Cost per run, the 3 runs labelled real | mean $0.028 (about $0.031 with the two untraced calls) |
| Cost per tailored export | $0.022 (real-labelled runs), $0.068 with every run counted, 4 exports |
| Free check | about $0.0005 per check |
| Worst path, estimate | about $0.27 per run before SDK retries; up to about $0.81 if every call is retried twice (research section 4) |

**What it means for D1.** Even the worst path with retries is far under the June spec's
$2 alarm line. After a 30% Apple cut, the 10-pack nets $1.40 per export, so AI cost would have
to reach about 45 optimizations per export before it loses money. The $3.99 / $12.99 / $19.99
prices pass the AI-cost check.

**How sure.** The sample is tiny: 12 runs, 4 exports. Which runs are QA is an inference
(server-only events, repeated input sizes), not a proven identity, and one user labelled
real has the same server-only pattern. The conclusion does not depend on the split: every
run, QA or not, cost under $0.033. Re-run the measurement at 30 or more real exports
(R7) and after any forced model change (gpt-4o and gpt-4o-mini are marked deprecated).

**Not yet covered:** Apple's rate (15% or 30%), VAT that Apple deducts first, hosting cost per
user, and the AI cost of free users as acquisition cost.

## Order of work

Three tracks run in parallel, one session per track. Inside a track, one story at a time.

| Track 1: Go-to-market | Track 2: Pricing | Track 3: Research |
|---|---|---|
| 1. G0 cycle 1 (this week) | 1. P1 EXD row + D4 freeze record (docs) | R1 done (above) |
| 2. G1a web hero, ATS claims, badge | 2. P2 stop pre-gate charges (web, tests first) | R3, R4, R5 public pages |
| 3. G1c remaining account wall | 3. P3a StoreKit engineering spec (docs) | R2, R6 founder steps |
| 4. G2a Hebrew holding (from #170) | 4. P3b StoreKit build: **gated**, see Track 2 | R7 later, at 30 exporters |
| 5. G2b iOS "Add only if true" | | |
| 6. G1b screenshots, G2c proof clip | | |

Where tracks touch the same files: G1c and P2 both touch the credit and free-check paths, so
G1c waits for P2 to merge. Track 1 owns `src/messages/*` and landing components; Track 2 owns
`src/lib/credits.ts`, `src/lib/premium-access.ts`, `src/lib/iap.ts` and the routes that charge.

Every code story gets its own branch and worktree off `origin/main`, outside the repo
(`~/Developer/resumebuilder-worktrees/<name>`), never inside it (`tasks/lessons.md`, 2026-08-05).

Web verification for every web story, from the repo root:
`npm run lint`, `npx tsc --noEmit` (read the total error count), `npm test -- <touched suites>`,
and `npm run build` when a shared module's imports change (`tasks/lessons.md`, 2026-07-26).

---

## Track 1: Go-to-market

### G0. Growth-loop cycle 1 (this week)

- **Owner:** founder posts; marketing advisor adapts copy; Claude Code reads the baseline,
  verifies tracking, writes the readout.
- **Files:** none in `src/`. Campaign plumbing already on `main`: `src/lib/campaign-context.ts`,
  `src/components/landing/AppStoreCta.tsx`. Prompts: `docs/gtm/growth-loop/cycle-01-prompts.md`.
  Record: `docs/gtm/growth-loop/cycle-01.md` stages 3 to 6.
- **Change:** one Hebrew post (vault post 2, point 3 removed under D2) on the personal LinkedIn
  profile. The tracked link goes in the first comment, not the body. Campaign
  `rb-li-20260910-trusted-workspace`, `utm_content=he_li_trusted_01`.
- **Verify:** before posting, open the link end to end and see `campaign_id` on the arrival in
  PostHog. In the same check, as a signed-out visitor from the campaign link, confirm the
  score and the missing items appear without a 402 or an account prompt; if they do not, the
  post waits or its claim changes. Baseline read with `scripts/measurement_contract.py` (iOS
  repo). Readout 7 days after the post: arrivals and `campaign_store_handoff` filtered by
  campaign id **and** by `Posted at <= timestamp < Posted at + 168 hours`, so a late read
  does not count extra days or older visits to the same campaign id.
- **Could break:** nothing in code. Risk is an unreadable post: if tracking is not verified, the
  post does not go out (the card's own rule). Note: `/he/ats-checker` still carries ATS wording
  until G1a; retarget the link after G1a.
- **Then:** one post a week in Israeli job-seeker communities, one campaign id each. Three posts
  in a row under 10 arrivals each means change channel.

### G1a. One promise on the web: hero, ATS claims, App Store badge

- **Repo:** web. **Files:** `src/messages/en.json` (e.g. line 129, "scan cleanly in every ATS"),
  `src/messages/he.json` (lines 142, 190, 386), `src/components/landing/hero-section.tsx`,
  `src/components/landing/features-bento.tsx`, the landing page that renders them, and
  `AppStoreCta.tsx` reused for the badge.
- **Change:** hero says "paste the job, see what is missing, fix it". Remove every promise of an
  ATS result (EXD-012). Keep "ATS" as a search term that describes, never promises. Add the
  App Store badge through `AppStoreCta` so campaign identity carries. Same pass on the Hebrew page.
- **Reuse, do not duplicate:** draft PR #152 (`cursor/landing-copy-refresh-4b5f`) already
  rewrites landing copy. Start from it: fix its two confirmed findings (an unsupported
  Word-upload claim, a dead standalone CTA), rebase, then extend. #171 (review-screen copy)
  touches different message keys; leave it to its own review.
- **Verify:** lint, tsc, the landing and campaign-context tests (`tests/unit/campaign-context.test.ts`
  keeps its `ROLLBACK` equality), a grep for "pass ATS", "every ATS", "scan cleanly" across
  `src/messages`, and screenshots of `/en` and `/he` from a local dev server, desktop and phone width.
- **Could break:** SEO for "ATS" queries if the term is removed outright (it stays as a term);
  Hebrew right-to-left layout in the hero; other pages that share the same message keys.
- **Taste:** full `GLOBAL-TASTE.md` pass (public surface).

### G1c. The remaining account wall

- **Repo:** web. **Depends on P2** only if the gated step calls a charging route.
- **Already true on `main`:** the landing checker posts anonymously to
  `/api/public/ats-check` (`FreeATSChecker.tsx:154`) and shows the score and quick wins before
  its signup prompt. That part needs no change.
- **Step 1:** list what is still behind sign-up between the free check and the first export
  (`ContextualSignupPopup.tsx`, the optimize entry). Scope the story to that list only.
- **Change:** the account is asked for at the first tailored export, not before.
- **Verify:** unit tests on the route, a Playwright run of the anonymous path, rate limits still
  enforced on the public route.
- **Could break:** abuse of the public endpoint (OpenAI cost), the 7-day anonymous carryover
  described in `src/messages/en.json:454`.

### G2a. Hebrew phrase holding (web)

- **Reuse, do not duplicate:** PR #170 (`fix/hebrew-job-only-terms`) is this work in progress.
  Fix its confirmed findings first (authority and lexical-prefix collisions, feminine
  singular and plural forms), with the reproduced cases as failing tests, then continue there.
- **Repo:** web. **Files:** `src/lib/ai-optimizer/job-ad-terms.ts` (Hebrew off at line 790),
  `tests/unit/optimize-job-phrase-guard.test.ts`, new Hebrew job-ad fixtures.
- **Change:** teach the job-word check Hebrew proclitics (ו, ה, ב, ל, מ, ש, כ) and Hebrew verb
  forms, then turn holding on for Hebrew. Tests first, from real Hebrew job ads.
- **Verify:** new Hebrew tests fail first, then pass; English guard tests unchanged; calibration
  benchmark in `src/lib/ats/benchmark/` shows zero unintended score changes.
- **Could break:** honest Hebrew rewrites held by mistake (the reason it was turned off).

### G2b. iOS "Add only if true" screen

- **Repo:** iOS (`~/Developer/ResumeBuilder/ResumeBuilder IOS APP`). Build from an rsync copy outside
  iCloud if the build hangs (memory: iOS builds and iCloud).
- **Change:** a review screen that shows held job phrases unselected, sends `confirmJobPhrases: true`,
  and returns the user's choices (web contract: `src/lib/ai-optimizer/optimize-pipeline.ts:38-50`).
- **Verify:** unit tests on the request and response mapping, a simulator run with the Maya fixture.
- **Could break:** installed builds keep the old behaviour by design (opt-in flag); an App Store
  submission is a founder step.

### G1b. App Store screenshots

- **Repo:** iOS. **Change:** rebuild screenshots 1, 2, 7, 8, 10 with Match Score naming, no ATS.
- **Before:** founder reads App Store Connect impressions. Below about 1,000 per arm in 4 weeks:
  no A/B test, ship and compare 4 weeks before and after.
- **Founder step:** upload and submit in App Store Connect.

### G2c. Proof clip and G3 Hebrew positioning

- Clip: 20 seconds of the "Add only if true" card, made in `~/Developer/remotion-resumely`.
  English web only until G2a and G2b both land (D2).
- G3 is copy, not code: "fit my CV to this job" in the G0 posts and the G1a Hebrew page.

---

## Track 2: Pricing (decide now, specify now, build StoreKit only when the gate opens)

Rule: no paywall, no charge, no visible "Premium" before the gate (EXD-009, EXD-029, EXD-018).

**The StoreKit implementation gate stays in force.** The approved June plan
(`docs/superpowers/plans/2026-06-07-resumely-plan-3-storekit-paywall.md:16-22`) forbids starting
StoreKit implementation until all four hold. A feature flag does not satisfy any of them.

| # | Condition | State on 2026-10-15 |
|---|---|---|
| 1 | Prices validated against AI cost | AI-cost input done (R1). Founder confirms the prices in P1. |
| 2 | Apple rate confirmed (15% or 30%) | Open. Founder checks Small Business Program enrollment in App Store Connect. |
| 3 | First-cohort D7 readable (EXD-009; traffic gate EXD-029) | Open. About 3 arrivals a week against 50. |
| 4 | Separate StoreKit engineering spec written and approved | Open. P3a writes it. |

Before the gate: decisions (P1), removing charges that should not exist yet (P2), and the
spec (P3a). No StoreKit code, no App Store Connect products, no paywall UI, no export
decrement.

### P1. Record D1 (docs only)

- **Repo:** Agentic OS. **File:** `executive-os/EXECUTIVE-DECISIONS.md`, one new EXD row in the
  existing format (never reformat the table).
- **Change:** packs 1 / 5 / 10 at $3.99 / $12.99 / $19.99, never expire, no subscription at
  launch; supersedes the June spec's $9.99 a month and $49.99 a year tier. Cite R1 as the
  AI-cost evidence. State that the StoreKit implementation gate is unchanged.
- **Verify:** `./agentic-os verify` passes.

### P2. Stop charging before the gate (tests first)

- **Repo:** web. **Charging paths on `main`, verified 2026-10-15:**
  - `src/app/api/ats/score/route.ts:60` calls `consumeCredit(user.id, 'ats_score')`, 402 `insufficient_credits`.
  - `src/app/api/v1/refine-section/route.ts:34` calls `consumeCredit(user.id, 'refine_section')`.
  - `src/app/api/v1/expert-workflows/run/route.ts` does **not** charge credits. It is
    entitlement gating: `hasPremiumAccess` and 402 `PREMIUM_REQUIRED`, only when
    `MONETIZATION_ENABLED=true` (`src/lib/premium-access.ts:21`). Separate from credits.
  - `src/app/api/optimize/route.ts:137`: charge already commented out.
  - `src/app/api/download/[id]/route.ts`: no credit check at all today.
- **Step 1, read-only:** how many credits a new user gets, and whether anyone has hit a 402 on
  the two charging routes (PostHog project 270848 and Supabase, founder and QA excluded).
- **Step 2, build:** behind the existing `MONETIZATION_ENABLED` switch (default off), every
  pre-gate charge is skipped: `ats_score` **and** `refine_section`. Switch off means no credit is
  consumed and no `insufficient_credits` is returned anywhere. Switch on keeps today's behaviour
  until P3b replaces it. Tests first: each route with the switch off and on.
- **Verify:** new tests fail first then pass; existing credit tests; tsc; lint. No migration.
- **Could break:** iOS clients that read the 402 `insufficient_credits` body (they stop seeing it,
  which is the intent); `src/app/api/v1/iap/verify/route.ts` is untouched.

### P3a. StoreKit engineering spec (docs only, condition 4)

- **Repo:** web, `docs/superpowers/specs/`, one new spec. Founder approves it.
- **Must specify:**
  - Export consumption on the actual export path (`src/app/api/download/[id]/route.ts`):
    atomic, idempotent decrement, free-export accounting (one free tailored export), and no
    bypass by calling the download route directly.
  - Purchase verification that binds the Apple transaction to the requested product, bundle and
    environment, and **fails closed** when verification is not configured. Today
    `src/lib/iap.ts` treats any 2xx as verified and `/api/v1/iap/verify` grants from the
    client-sent `productId`, even with `verification: 'not_configured'`. Unsafe once products exist.
  - Pack mapping to `export_credits` 1 / 5 / 10, replacing the 100 / 500 / 2,500 units in
    `src/lib/iap.ts`; refunds; restore; the paywall sheet at export; the PostHog events.
  - The rollout: flag off, then on only at the founder's yes after conditions 1 to 3.
- **Verify:** spec reviewed (Codex or Opus) and approved by the founder; `WP-2` monetization spec
  updated to the pack shape, as the June spec section 10 requires.

### P3b. StoreKit build (gated)

Starts only when all four gate conditions hold and the founder says yes in that message. Then:
three consumable products in App Store Connect (founder step), the paywall sheet behind the
flag, server verification and export consumption exactly as P3a specifies.

---

## Track 3: Research (public pages only)

No signups, no made-up identities, no disposable emails.

| # | Question | Closes | How | Owner |
|---|---|---|---|---|
| R1 | AI cost per optimization, last 30 days | P1 price floor | **Done** 2026-10-14, re-verified 2026-10-15. $0.018 to $0.032 per run. See "R1 result" | Claude Code |
| R2 | App Store impressions, conversion, sources, 90 days | G1b test choice | App Store Connect export | Founder |
| R3 | Resumaker: prices, does it tailor to a job ad | G3 | resumake.co.il public pages | Claude Code |
| R4 | The Israeli CV-to-job tool from the Geektime piece | G3 | Find the article and product | Claude Code |
| R5 | Teal's prices | Evidence | tealhq.com/pricing in the browser | Claude Code |
| R6 | Willingness to pay in shekels | P1, P3 | Five short founder conversations | Founder |
| R7 | Exports per user | P2 | PostHog, only at 30 or more exporters | Claude Code, later |

---

## Housekeeping found on the way

- `docs/agent-os/project-context.md` still says "improving ATS pass rates" and describes Stripe
  freemium. Both conflict with EXD-012 and this plan. Fix in G1a's branch.
- The handoff listed `expert-workflows/run` as calling `consumeCredit`. It does not: it is
  premium entitlement gating (`PREMIUM_REQUIRED`), recorded in P2. Corrected in the handoff too.

## Open questions

1. D4: which agent ran the competitor benchmark (a Grok desk, and which one)? If it was the
   Growth & Communications desk, it is also the marketing advisor on G0, and freezing it moves
   G0 copy to Claude Code.
2. D4: where are the saved password files (Grok cloud computer, a repo, a local folder)?
