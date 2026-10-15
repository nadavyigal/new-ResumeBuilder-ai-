# Handoff: Resumely market play, plan and execute (pricing, go-to-market, research)

Written 2026-10-14 by Claude Code. **Pre-decision snapshot.** The five decisions below were
answered on 2026-10-14 and the work now lives in
`docs/plans/2026-10-14-market-play-implementation.md`, which wins wherever the two differ.
Do not ask D1 to D5 again and do not write a second plan. Read this file for background only.
The merged plan it implements: https://claude.ai/artifact/NXpvcK4E52sCAopobGaaRR
(version 2, "Merged v1 + v2"). The page is the strategy; this file is the work.

## Objective (one sentence)

Get Resumely to the EXD-029 traffic gate (one channel at 50 or more non-internal arrivals a
week for 4 weeks), with the website, App Store page and product claims telling one honest
story, and with pricing decided and specified, ready to build when the StoreKit gate opens.

## Start here (session 1 agenda)

1. Run the session-start ritual: auto-memory index, `docs/agent-os/project-context.md`,
   `tasks/lessons.md`. This is planning plus product work, so read both.
2. Done 2026-10-14: the founder answered the five decisions below.
3. Done: the plan is `docs/plans/2026-10-14-market-play-implementation.md`.
4. Execute that plan one story at a time: implement, lint and tests, report, ask before the next one.

## Five decisions the founder makes first

| # | Decision | Recommended | Why |
|---|---|---|---|
| D1 | Pricing shape | June spec credit packs: $3.99 for 1, $12.99 for 5, $19.99 for 10 tailored exports, credits never expire, **no subscription at launch** | Pay once, no renewal. Reuses the approved spec. Unlimited plan only if heavy users ask. |
| D2 | Claim order | No "asks before it adds" claim on iOS or in Hebrew until the guard runs there | It runs on the English web only today |
| D3 | Gate channel | Run growth-loop cycle 1 this week, then a weekly cadence in Israeli job-seeker communities, tracked links only | Nothing else in the plan produces arrivals |
| D4 | Research method | Freeze the competitor-research agent unless the founder approves its signups in writing; have it delete the accounts and saved passwords | It signed up as "Northwind Research" at Resume Worded and Kickresume, tried a throwaway email at Jobscan, and saved passwords. The exchange registry says an unapproved sign-in freezes a desk. |
| D5 | Optional paid test | ₪150 of Apple Search Ads in Israel, one week, for cost per tap | EXD-034 excludes paid acquisition, so the founder decides explicitly |

## Rules that bind every track

- **No paywall, no charge, no visible "Premium" before the gate.** EXD-009, EXD-029, EXD-018.
  Pricing work now means deciding and specifying. StoreKit implementation stays behind the
  June plan's four-condition gate (`docs/superpowers/plans/2026-06-07-resumely-plan-3-storekit-paywall.md:16-22`);
  a feature flag does not satisfy it.
- **Logged decisions to respect:** EXD-005 (freemium with a free activation moment),
  EXD-012 (no ATS claims), EXD-030 (App Store optimization is the Q4 channel), EXD-034
  (organic content pilot; paid acquisition excluded). Read them in Agentic OS
  `executive-os/EXECUTIVE-DECISIONS.md` before changing anything they cover. Contradicting
  one needs the founder's explicit call, logged.
- **Research: public pages only.** No signups, no made-up identities, no disposable emails.
- No deploys, migrations, App Store submissions or posts without the founder's explicit "yes"
  in the current message. No new npm dependencies without asking.
- Founder-only steps: App Store Connect, posting on LinkedIn and in communities, StoreKit
  product setup, pricing tiers.

## Verified facts (2026-10-14, against `origin/main`)

Web repo (`nadavyigal/new-ResumeBuilder-ai-`):
- The June pricing spec is approved: `docs/superpowers/specs/2026-06-07-resumely-growth-pricing-design.md`.
  Packs $3.99 / $12.99 / $19.99, unlimited $9.99 a month or $49.99 a year, paywall at
  export, one free export. Its cost warning: above about $2 of AI cost per optimization,
  the $3.99 pack loses money after Apple's cut.
- `src/lib/iap.ts` defines `credits_basic: 100`, `credits_saver: 500`, `credits_super: 2500`.
  These are internal credit units, not the spec's 1 / 5 / 10 exports, and nothing else in
  `src/` references them.
- The score already costs a credit: `src/app/api/ats/score/route.ts` calls
  `consumeCredit(user.id, 'ats_score')` and returns 402 `insufficient_credits`.
  `src/app/api/v1/refine-section/route.ts` does the same. `src/app/api/v1/expert-workflows/run/route.ts`
  does not charge credits: it is premium entitlement gating (`hasPremiumAccess`, 402
  `PREMIUM_REQUIRED`, only when `MONETIZATION_ENABLED=true`). This conflicts with "unlimited free score". Find out how many credits a new
  user gets and whether anyone has hit a 402 (PostHog and Supabase, read-only) before changing it.
- "Add only if true" (#169, merged 2026-10-12 in `9293b20`) runs on the web review page
  only. Commit `6a74947` switched phrase holding off for Hebrew.
- `docs/gtm/growth-loop/cycle-01.md` (campaign `rb-li-20260910-trusted-workspace`) is
  seeded and has never been run. It points to `/he/ats-checker`.
- The live site (resumelybuilderai.com) still says "Free ATS Resume Check" and "layouts
  that scan cleanly in every ATS", asks for an account before AI fixes, and has no App Store link.
- `tasks/progress.md` said #169 was "awaiting founder merge"; it was merged on 2026-10-12.
  Corrected in the commit that adds this file.

iOS repo (`nadavyigal/ResumeBuilder-IOS-APP`, local path `~/Developer/ResumeBuilder/ResumeBuilder IOS APP`):
- Hebrew App Store metadata exists: `docs/app-store/he-metadata.md` (published as `rb-he-aso-001`).
- iOS has no "Add only if true" screen yet. That is the web repo's next recommended story.
- Screenshots 1, 2, 7, 8 and 10 still say ATS. The founder accepted that for 1.5.1 only.

Numbers (Portfolio HQ, 2026-10-14): about 3 non-internal arrivals a week; 5 clean D7 exports
on iOS (diagnostic only); App Store ratings 0 in the US and 2 in Israel (average 5.0).

## Tracks and stories

### Go-to-market (first, because it is the bottleneck)

- **G0, growth-loop cycle 1** (founder posts, Claude prepares). Use the experiment card in
  `docs/gtm/growth-loop/`. One Hebrew post on the personal LinkedIn profile, unique UTM,
  read arrivals after 7 days. Then a weekly cadence in Israeli job-seeker communities,
  one campaign id per post. Target: 50 tracked arrivals a week. Rule: three posts in a row
  under 10 arrivals each means change the channel. Retarget the link once G1 ships.
  Use the five voiced clips (Drive folder "סרטונים", files named "... - עם קול.mp4").
- **G1, one promise on the web** (web repo). Hero: paste the job, see what is missing,
  fix it. Remove ATS promises (EXD-012) but keep "ATS" as a search term. Add the App Store
  badge. Check the Hebrew page too. None of this waits for P2: the free check already shows
  the score and quick wins without an account (`FreeATSChecker.tsx:154`). Only any remaining
  wall before the first export (G1c) may depend on P2.
- **G1b, App Store screenshots** (iOS repo, founder submits). Rebuild the 5 ATS screenshots
  with Match Score naming. Before choosing an A/B test, read App Store Connect impressions:
  below about 1,000 per arm in 4 weeks, ship and compare the 4 weeks before and after.
- **G2, "asks before it adds"** (iOS repo plus web). Build the iOS "Add only if true"
  screen and send `confirmJobPhrases: true`. Re-enable Hebrew phrase holding with tests
  for Hebrew job ads. Then make the 20-second proof clip with the Remotion setup in
  `~/Developer/remotion-resumely`. Lead line: "Tailored to the job. Asks before it adds." /
  "מותאם למשרה. שואל לפני שמוסיף." Use it on the English web only until both land.
- **G3, Hebrew positioning.** "Fit my CV to this job" in Hebrew, not "a Hebrew CV builder".
  The listing exists, so the work is copy in the G0 posts and the G1 Hebrew page.

### Pricing (decide and specify now; StoreKit build waits for the gate)

- **P1, pack shape.** Record D1 as a new EXD row in Agentic OS, superseding the spec's
  subscription tier if the founder agrees.
- **P2, reconcile credits with the free tier.** Design the mapping: free score and fix list
  unlimited with no account; one free tailored export; packs as export credits. Decide
  what happens to the `ats_score`, `refine-section` and `expert-workflows` credit charges.
  Tests first (TDD). The switch stays off.
- **P3, StoreKit products.** Superseded by P3a (spec, now) and P3b (build, gated) in the
  implementation plan. Original note: (iOS repo, founder sets them up in App Store Connect). Three
  consumable in-app purchases with Israeli and US tiers, a paywall sheet at export behind a
  feature flag that defaults to off, and server verification through `verifyAppleTransaction`.
- **Price floor.** Measure AI cost per optimization (OpenAI usage divided by optimizations,
  last 30 days) before fixing the $3.99 price.

### Research (public pages only)

| Question | Closes | How |
|---|---|---|
| App Store impressions, conversion, sources | G1b test choice | Founder exports from App Store Connect |
| AI cost per optimization | P1 floor | OpenAI usage dashboard and PostHog optimization count |
| Resumaker: prices, does it tailor to a job ad | G3 | resumake.co.il, public pages |
| The Israeli CV-to-job tool from the Geektime piece | G3 | Find the article and the product |
| Teal's prices on its own page | Evidence | Browser visit to tealhq.com/pricing |
| Willingness to pay in shekels | P1, P3 | Five short founder conversations now; pack sales at the gate |
| Exports per user | P2 | PostHog, only with 30 or more exporters |

## When to change course

- 4 weeks at 50 or more arrivals a week: the gate is open. Read the D7 export rate
  (EXD-029), then switch pricing on with the founder's yes.
- Three posts under 10 arrivals each: switch channel. Hebrew under 20 a week after 4 weeks:
  add English LinkedIn as a second arm.
- AI cost above about $2 per export: raise the single-export price before launch.
- Refunds above 5% in the first paid month: review the paywall copy.
- "Asks before it adds" not beating "see your score" across two paired posts: keep it as a
  trust line and lead with the score.

## Order of work

1. D1 to D5 answered, plan file written, founder OK.
2. G0 cycle 1 (this week, founder posts).
3. G1 web hero, App Store badge and ATS removal (web), shipped with P2's credit fix if the
   account wall depends on it.
4. G2 iOS "Add only if true" plus Hebrew phrase holding.
5. G1b screenshots, then P1 and P3 behind the off switch.
6. Research items alongside, as public-page reads.

## Not now

B2B licences, SEO at scale, a Chrome extension, a weekly subscription.

## Paste this to start the new session

Open a new Claude Code session in `~/Developer/ResumeBuilder/new-ResumeBuilder-ai-` and paste:

```
Read docs/plans/2026-10-14-market-play-implementation.md in full; it holds the founder's
recorded D1 to D5 answers. Do not ask them again. Run the session-start ritual for this repo.
Then take the next open story in your track, one story at a time: implement, lint and tests,
report, ask before the next one.
```
