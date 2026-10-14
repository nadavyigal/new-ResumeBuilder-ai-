# Implementation plan: Resumely market play

Written 2026-10-14 by Claude Code, from `docs/plans/2026-10-14-market-play-handoff.md` and the
merged plan (artifact NXpvcK4E52sCAopobGaaRR, version 2). Status: **waiting for the founder's OK.**
No code is edited until that OK. Then one story at a time: implement, lint and tests, report, ask.

## Founder decisions (2026-10-14)

| # | Decision | Answer |
|---|---|---|
| D1 | Pricing shape | **Yes.** Credit packs $3.99 for 1, $12.99 for 5, $19.99 for 10 tailored exports, credits never expire, no subscription at launch. Measure AI cost per optimization first (R1), in its own session. |
| D2 | Claim order | **Yes.** No "asks before it adds" claim on iOS or in Hebrew until the guard runs there. |
| D3 | Gate channel | **Yes,** run with the marketing advisor. Founder asked for the full prompts for this week: `docs/gtm/growth-loop/cycle-01-prompts.md`. |
| D4 | Research agent | **Freeze it.** It deletes the Resume Worded and Kickresume accounts and the saved passwords. Public pages only from now on. Which agent ran the benchmark is still to be confirmed (see Open questions). |
| D5 | Paid test | **Not now.** Revisit after G1b ships. EXD-034 stands unchanged. |

## Order of work

1. **G0** cycle 1 this week (founder posts, Claude prepares and measures).
2. **R1** AI cost per optimization, in a separate session, alongside G0.
3. **P1** record D1 as an EXD row. **D4** record the freeze. Docs only.
4. **G1a** web hero, ATS claims, App Store badge (no dependency on P2).
5. **P2** credits reconciled with the free tier, switch off.
6. **G1c** remove the account wall before score and fixes (needs P2).
7. **G2a** Hebrew phrase holding (web). **G2b** iOS "Add only if true" screen.
8. **G1b** App Store screenshots. **G2c** proof clip.
9. **P3** StoreKit products and paywall sheet, flag off.
10. Research items R2 to R7 alongside, public pages only.

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
  PostHog. Baseline read with `scripts/measurement_contract.py` (iOS repo). Readout 7 days after
  the post: arrivals and `campaign_store_handoff` filtered by campaign id.
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
- **Verify:** lint, tsc, the landing and campaign-context tests (`tests/unit/campaign-context.test.ts`
  keeps its `ROLLBACK` equality), a grep for "pass ATS", "every ATS", "scan cleanly" across
  `src/messages`, and screenshots of `/en` and `/he` from a local dev server, desktop and phone width.
- **Could break:** SEO for "ATS" queries if the term is removed outright (it stays as a term);
  Hebrew right-to-left layout in the hero; other pages that share the same message keys.
- **Taste:** full `GLOBAL-TASTE.md` pass (public surface).

### G1c. No account wall before the score and fixes

- **Repo:** web. **Depends on P2.** **Files:** found during P2 (the free check flow,
  `FreeATSChecker.tsx`, `ContextualSignupPopup.tsx`, `src/app/api/public/ats-check/route.ts`).
- **Change:** a visitor sees the score and the fix list without signing up. The account is asked
  for at the first tailored export.
- **Verify:** unit tests on the route, a Playwright run of the anonymous path, rate limits still
  enforced on the public route.
- **Could break:** abuse of the public endpoint (OpenAI cost), the 7-day anonymous carryover
  described in `src/messages/en.json:454`.

### G2a. Hebrew phrase holding (web)

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

## Track 2: Pricing (decide now, build behind a switch)

Rule: no paywall, no charge, no visible "Premium" before the gate (EXD-009, EXD-029, EXD-018).

### P1. Record D1 (docs only)

- **Repo:** Agentic OS. **File:** `executive-os/EXECUTIVE-DECISIONS.md`, one new EXD row in the
  existing format (never reformat the table).
- **Change:** packs 1 / 5 / 10 at $3.99 / $12.99 / $19.99, never expire, no subscription at
  launch; supersedes the June spec's $9.99 a month and $49.99 a year tier. Price final only after R1.
- **Verify:** `./agentic-os verify` passes.

### P2. Reconcile credits with the free tier (tests first, switch off)

- **Repo:** web. **Files:** `src/lib/credits.ts`, `src/app/api/ats/score/route.ts:60`
  (`consumeCredit(user.id, 'ats_score')`), `src/app/api/v1/refine-section/route.ts:34`,
  `src/app/api/v1/expert-workflows/run/route.ts:92` (402), `src/app/api/optimize/route.ts:137`
  (charge already commented out), `src/lib/iap.ts` (100 / 500 / 2,500 units),
  `supabase/migrations/20260607000000_user_credits_iap_purchases.sql` (`export_credits`, default 0).
- **Step 1, read-only:** how many credits a new user gets, and whether anyone has hit a 402 on
  these routes (PostHog project 270848 and Supabase, founder and QA accounts excluded).
- **Step 2, design:** score and fix list free and unlimited; one free tailored export; packs map
  to `export_credits` 1 / 5 / 10; decide each existing charge (likely: score free, refine and
  expert runs free until the gate, export charged). One server-side switch, default off.
- **Step 3, build:** tests first; switch off means today's behaviour minus the score charge.
- **Verify:** new tests fail first then pass; existing credit tests; tsc; no migration unless the
  founder says yes in that message.
- **Could break:** iOS clients that read the 402 `insufficient_credits` body; the IAP verify route
  (`src/app/api/v1/iap/verify/route.ts`) that grants by product id.

### P3. StoreKit products (iOS, flag off)

- **Repo:** iOS, plus `src/lib/iap.ts` product ids on web. **Founder step:** create three
  consumable products in App Store Connect with Israeli and US tiers.
- **Change:** paywall sheet at export behind a flag that defaults to off; server verification
  through `verifyAppleTransaction`.
- **Verify:** StoreKit configuration file tests in the simulator; flag-off build shows no paywall.

---

## Track 3: Research (public pages only)

No signups, no made-up identities, no disposable emails.

| # | Question | Closes | How | Owner |
|---|---|---|---|---|
| R1 | AI cost per optimization, last 30 days | P1 price floor | Own session. OpenAI usage divided by optimizations; check repo AI tracing first | Claude Code (new session) |
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
- The handoff listed `expert-workflows/run` as calling `consumeCredit`. It returns 402 at line 92
  but does not call `consumeCredit`; `optimize/route.ts` has its charge commented out. P2 step 1
  confirms the real charging paths.

## Open questions

1. D4: which agent ran the competitor benchmark (a Grok desk, and which one)? If it was the
   Growth & Communications desk, it is also the marketing advisor on G0, and freezing it moves
   G0 copy to Claude Code.
2. D4: where are the saved password files (Grok cloud computer, a repo, a local folder)?
