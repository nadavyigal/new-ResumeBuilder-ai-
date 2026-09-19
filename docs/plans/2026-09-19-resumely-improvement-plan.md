# Resumely Improvement Plan, 2026-09-19

Derived from the read-only CTO review of 2026-09-13 (web `origin/main` `f6c5d9e`, iOS
`origin/main` `2cd6c91`, live Supabase `brtdyamysfmctrhuankn`, CI, live site).
Report: https://claude.ai/code/artifact/14f71e2e-dc33-4e59-8898-1975422d4bdf
Vault record: Builder OS `02-Products/ResumeBuilder/2026-09-13-resumely-cto-review.md`.

- Status: ready to execute, nothing started
- Horizon: six weeks from 2026-09-22
- Owner: solo founder, plus agent sessions
- Last live recheck: 2026-09-19

## The one-paragraph premise

The constraint is demand, not activation. The live database shows no optimizations since
2026-08-31, no web free checks since 2026-08-18, and 0 to 2 external optimizers a week
across 16 weeks, which matches the Agentic OS arrivals series from a different instrument.
So roughly 70% of the next six weeks is founder distribution work, and engineering gets
about 30%, spent on: two silent risks, removing surface area that nobody uses, and one
quality guard on the optimizer. Nothing here tries to tune a funnel that has no traffic.

## Standing rules for every story

1. One story at a time. Plan, get the founder's OK, implement, verify, report, PR, stop.
2. No Supabase migration and no deploy without an explicit "yes" in that session.
3. No new npm dependencies without asking.
4. Before "done": `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`, and
   report the real output. iOS: `xcodebuild build` plus the suite with
   `-testLanguage en -testRegion US`.
5. Update `tasks/progress.md` in the same response as the commit.
6. Fresh worktree per story, named for the story. Never reuse another task's worktree.
7. No em dashes in commits, PR bodies, code comments, or user-facing copy.
8. Do not open a new measurement packet until one funnel step carries 10 or more
   non-internal users. WP-77 is already in flight and is the exception.

## Release and measurement state, as of 2026-09-19

- **1.5.1 is LIVE**, released 2026-09-09T16:51:52Z, verified by three cache-busted Apple
  lookup polls. 0 ratings. The live **binary build number** is unverified: read it in App
  Store Connect.
- That release is the **fifth measurement boundary**. The four before it: 2026-06-18 score
  engine, 2026-08-12 `optimization_completed` split, 2026-08-14 10:09:25Z free ATS score,
  2026-09-09 16:51:52Z listing replacement (same timestamp as this release).
- The earliest arithmetically honest D7 read for 1.5.1 was 2026-09-16. It has passed, so a
  1.5.1 activation read is possible for the first time and needs `AGENTIC_OS_POSTHOG_API_KEY`.
- WP-76's "two thirds never see the upload CTA" is an instrumentation-birthday artifact
  (`resume_upload_cta_seen` born 2026-07-08, window opened around 2026-06-04). WP-77
  remeasures it read-only. **No UI change is authorised by that finding.** WP-76's primary
  result stands: no real user has ever hit the 100-word job floor, so do not change
  `JobInputPolicy.minimumPastedWordCount`.

---

# P0, weeks 1 and 2

## R1. Lock down client-callable SECURITY DEFINER functions

- Complexity: S. Model: Sol. Repo: web.
- **Objective:** only the server, through a service-role client, can call credit and quota
  functions. No client, signed in or anonymous, can.
- **Why:** `grant_apple_credits(p_user_id, p_delta, …)` and `consume_credit(p_user_id, …)`
  are `SECURITY DEFINER`, take the target user as an argument, never check `auth.uid()`,
  and are executable by the `authenticated` role that anonymous sessions hold. The anon key
  ships in the app. That routes around PR #135 through `/rest/v1/rpc`. Latent only because
  credits buy nothing today.
- **Files:** new `supabase/migrations/20260922000000_revoke_client_definer_exec.sql`;
  `src/app/api/v1/iap/verify/route.ts:43`; `src/lib/credits.ts:13`;
  `src/lib/rate-limiting/check-rate-limit.ts:121`; `src/lib/supabase/auth.ts:232`.
- **Acceptance:**
  - [ ] Every `.rpc(` call site is listed with the client it uses, before any change.
  - [ ] Each one runs through a server-only service-role client.
  - [ ] Migration revokes `execute` from `anon` and `authenticated` on
        `grant_apple_credits`, `consume_credit`, `increment_optimizations_used`,
        `increment_optimization_usage`, `increment_rate_limit`,
        `check_subscription_limit`, `cleanup_old_files`, `generate_file_path`,
        `get_ats_improvement`, `is_ats_v2`. Trigger functions untouched.
  - [ ] Supabase advisor lints 0028 and 0029 no longer list those functions after apply.
  - [ ] iOS makes no direct `.rpc` calls (verified 2026-09-13, re-confirm with a grep).
- **Tests:** SQL proof in the PR body that `set role authenticated; select grant_apple_credits(…)`
  is denied. Jest route tests for `iap/verify`, `optimize`, `public/ats-check` with a
  service-role mock. Full `npm test`.
- **Analytics verification:** the day after apply, server `optimization_completed` and the
  public check events still arrive, and Vercel shows no new 5xx on those routes.
- **Astra checkpoint:** review the migration SQL and every call site **before** the founder
  is asked to approve the apply.
- **Risk:** a call site left on a user-scoped client starts failing. Mitigated by listing
  them all first and by the route tests.

## R2. Production canary and uptime alert

- Complexity: S. Model: Sonnet. Repo: web.
- **Objective:** know within 6 hours when auth, the API, or optimize breaks.
- **Why:** the paused Supabase project took auth down for every installed build from
  2026-08-14 to 08-30, and a device test run found it, not an alert. The Supabase URL is
  hardcoded in shipped Swift, so monitoring is the only lever that works on live installs.
- **Files:** new `.github/workflows/prod-canary.yml` (6-hour cron plus `workflow_dispatch`
  with an optional host override), new `scripts/canary/run-canary.mjs`.
- **Acceptance:**
  - [ ] Checks `https://brtdyamysfmctrhuankn.supabase.co/auth/v1/health`,
        `https://www.resumelybuilderai.com/api/health`, and one fixture optimize as a
        dedicated internal test account.
  - [ ] Credentials only in GitHub secrets, never printed.
  - [ ] On failure it opens or updates a single issue labelled `prod-down`.
  - [ ] Proven by one green dispatch and one forced-red dispatch (wrong host input).
  - [ ] The fixture résumé is synthetic, no real person's data.
- **Tests:** unit test for the script's pass/fail parsing; the two dispatch runs above.
- **Analytics verification:** the canary account is flagged `is_internal_tester`, so no
  canary run appears in any activation number.
- **Astra checkpoint:** confirm no secret leaks into logs and the fixture is synthetic.

## R3. Retire chat gracefully

- Complexity: S. Model: Sonnet. Repo: web, with an iOS read.
- **Objective:** a live 1.5.x user who opens chat sees a clear message instead of a hang,
  and no OpenAI call is made.
- **Why:** 84 chat sessions, the last on 2026-05-14, and the route depends on the OpenAI
  Assistants API (`src/lib/ai-assistant/thread-manager.ts:145`) plus
  `gpt-4-1106-preview` (`src/lib/chat-manager/assistant-manager.ts:15`), both on OpenAI's
  retirement path. Retiring beats migrating a feature nobody uses.
- **Files:** `src/app/api/v1/chat/route.ts` (`ensureThread` at line 339),
  `src/app/api/v1/chat/sessions/route.ts`, and the sibling chat routes.
- **Acceptance:**
  - [ ] OpenAI's deprecation page checked and the dates for the Assistants API and
        `gpt-4-1106-preview` quoted in the PR. **This is an unverified assumption today.**
  - [ ] Chat routes return `410` with `{ code: "CHAT_RETIRED" }` before any OpenAI or
        thread call.
  - [ ] iOS `Features/V2/Chat/` read and reported: confirm a 4xx surfaces the existing
        error state. Report only, do not edit iOS in this story.
- **Tests:** Jest, POST `/api/v1/chat` returns 410 and makes no OpenAI call.
- **Analytics verification:** Vercel 30-day request counts for `/api/v1/chat*` recorded
  before and after, to feed R7's deletion decision.
- **Astra checkpoint:** screenshot of the iOS chat error state against the deployed preview.

## R4. Campaign-tagged store links, and the web-versus-app split

- Complexity: S. Model: Sonnet. Repo: web.
- **Objective:** every arrival from your own posts is attributable, and you learn whether
  the web checker or the App Store converts better.
- **Why:** distribution is the quarter's binding constraint and nothing currently
  distinguishes one channel from another. Also removes the fake `id000000000` placeholder.
- **Files:** new `src/lib/app-store-link.ts`; `src/app/[locale]/page.tsx`;
  `src/app/[locale]/ats-checker/page.tsx`; `src/app/[locale]/blog/[slug]/page.tsx`; any
  component containing `apps.apple.com`.
- **Acceptance:**
  - [ ] All links read `https://apps.apple.com/app/id6776752349?pt=<provider token from env>&ct=<source>`.
  - [ ] `rg "apps.apple.com" src` returns only the helper.
  - [ ] No `id000000000` anywhere in `src`.
- **Tests:** Jest snapshot of the helper for three sources.
- **Analytics verification:** App Store Connect, App Analytics, Campaigns shows the `ct`
  values within 48 hours of the first post.
- **Astra checkpoint:** diff review only.

## R5. Make the repo docs true

- Complexity: S. Model: Sonnet. Repo: web.
- **Objective:** an agent session that reads `CLAUDE.md` gets today's architecture.
- **Why:** `CLAUDE.md` names `/api/ingest-jd`, `/api/score` and `/api/templates`, none of
  which exist among the 59 real routes; it describes Stripe freemium gating that PR #136
  removed; it calls the Match engine embeddings-based when it is a deterministic
  8-component engine. `project-context.md` describes a `resume-builder-ai/` subdirectory
  that does not exist. 149 root markdown status files contradict each other.
- **Files:** `CLAUDE.md`, `docs/agent-os/project-context.md`, and a `git mv` of every root
  `*.md` except `README.md`, `CLAUDE.md`, `AGENTS.md`, `CURSOR.md` into
  `docs/archive/2025-root-status/`.
- **Acceptance:**
  - [ ] Every route, table and module named in `CLAUDE.md` exists in the code.
  - [ ] ADR-002 marked superseded by PR #136, with what is true now (everything ungated,
        Apple IAP credits dark).
  - [ ] Repo root holds 4 markdown files or fewer.
- **Tests:** `npm run lint`, `npx tsc --noEmit`, `npm run build` still pass.
- **Analytics verification:** none.
- **Astra checkpoint:** spot-check 5 claims in the rewritten `CLAUDE.md` against code.

## Founder-only, same two weeks

- [ ] File `rb-aso-002` in App Store Connect.
- [ ] Rebuild App Store screenshots 1, 2, 7 and 10 without the ATS claims. The text fix
      shipped in 1.5.1; the images still carry it.
- [ ] Read the live 1.5.1 **binary build number** off App Store Connect and record it.
- [ ] Post LinkedIn batch 1 from the personal profile, using R4's tagged links.
- [ ] Book 5 moderated 20-minute sessions with job seekers who have never seen the app.
      They gate R8.
- [ ] Decide the Supabase plan, so the project cannot pause again.
- [ ] Turn on leaked-password protection and take the pending Postgres security patches.
- [ ] Put `AGENTIC_OS_POSTHOG_API_KEY` where agent sessions can read it, or accept that
      every funnel question stays unanswerable, WP-77 included.

---

# P1, weeks 3 and 4

## R6. Hide unused surfaces, iOS 1.5.2

- Complexity: M. Model: Sol. Repo: iOS.
- **Objective:** the app presents one loop: Tailor, Résumé, Me.
- **Why:** 5 tabs for one job. Chat unused since May, 0 design customizations, tracker last
  touched 2026-08-09 by what looks like QA. Each surface costs tests, two languages, App
  Review risk, and agent context.
- **Files:** `Core/DesignSystem/Components/ResumlyTabBar.swift:5` (`ResumlyTab`),
  `App/MainTabViewV2.swift` (including the cross-tab paths at lines 73 to 95),
  `Features/V2/Chat/`, the Design tab, `Features/Track/`, `Ambassador/`. Keep
  `ats_optimization_report` reachable from the result screen: it is the one expert workflow
  with real repeat completions (29 in 60 days).
- **Acceptance:**
  - [ ] Hidden behind `RuntimeFeatures` flags, not deleted.
  - [ ] Tab bar shows 3 items; deep links to hidden screens land on Home.
  - [ ] Pending second-job requests and recovered optimizations still route correctly.
  - [ ] EN and HE both clean, RTL included.
- **Tests:** update tab and navigation unit tests; full suite with `-testLanguage en
  -testRegion US`; Hebrew smoke test; physical-device walk of every entry point.
- **Analytics verification:** on exact build 1.5.2, no `chat_*` or non-report `expert_*`
  events from non-internal persons.
- **Astra checkpoint:** a one-page screen map of what disappears, before code. Device
  screenshots of all three tabs in EN and HE, before submission.

## R7. Retire dead server routes safely

- Complexity: M. Model: Sonnet. Repo: web.
- **Objective:** less code and fewer routes, without breaking installed 1.4.x and 1.5.x
  builds.
- **Why:** 59 routes, and about 8k lines across `src/lib/agent` (3.1k),
  `chat-manager` (1.9k), `ai-assistant` (1.2k) serve features nobody uses.
  `/api/debug/scrape-check` is live in production.
- **Files:** candidates `src/app/api/agent/*`, `v1/chat*`, `v1/styles/*`,
  `v1/design/[optimizationId]/{customize,undo,revert}`, `apply-job`, `debug/scrape-check`,
  plus the legacy `'gpt-4'` call sites in `src/lib/chat-manager/ai-client.ts:83` and
  `src/lib/design-manager/design-recommender.ts:42`.
- **Acceptance:**
  - [ ] A route is deleted only with 30 days of zero non-canary requests in Vercel logs.
  - [ ] Routes any shipped iOS build still references become 410 stubs instead.
  - [ ] `rg "'gpt-4'" src` returns nothing.
  - [ ] Their tests are deleted with them; suite, `tsc` and `build` stay green; the nightly
        eval is unchanged.
- **Tests:** full `npm test`; one manual call per removed route against the preview.
- **Analytics verification:** 7 days after deploy, no new 404s from iOS user agents in
  Sentry or Vercel.
- **Astra checkpoint:** the route list with 30-day request counts, approved before any
  deletion.

## R8. Optimizer no-regression guard

- Complexity: M. Model: Sol. Repo: web.
- **Objective:** an optimized résumé never covers fewer of the job's must-have keywords
  than the original did.
- **Why:** a recorded run went `keyword_exact` 60 to 40 after a rewrite. `assessLift`
  suppresses the display and the score floor hides it from the user, but nothing retries or
  keeps the original text, so the product still causes the harm it hides.
- **Files:** `src/lib/ai-optimizer/optimize-pipeline.ts` (after generation, near line 66),
  reusing the keyword analyzer in `src/lib/ats`; `evals/resume-optimizer/checks.ts` and
  `cases.ts`.
- **Acceptance:**
  - [ ] Coverage drop triggers one retry that names the missing terms as a constraint.
  - [ ] If it still drops, the original text is kept for the affected sections.
  - [ ] p95 optimize latency stays under 90s (`maxDuration` is 300).
  - [ ] Fabrication behaviour is unchanged: `stripFabricatedMetrics` still applies.
- **Tests:** unit tests for retry then fallback; new eval check
  `keyword-coverage-not-lower`; 5 anonymized real-shaped cases, 4 EN and 1 HE; judge pass
  rate at or above the current baseline.
- **Analytics verification:** server `optimization_completed` gains `coverage_delta` and
  `retry_reason`, both non-null on the next canary run.
- **Astra checkpoint:** approve the 5 eval cases before implementation.

---

# P2, weeks 5 and 6, gated

## R9. A first run that works without a résumé file

- Complexity: M to L. Model: Sol. Repos: iOS and web.
- **Gate:** at least 3 of the 5 moderated sessions stall at "find my file". If they do not,
  skip this and act on what the sessions actually showed.
- **Objective:** someone with no résumé file on their phone sees a tailored result in under
  a minute.
- **Why, and how strong the evidence is:** the 90-day external read gave 102 `app_launched`
  to 14 `resume_file_selected`, and the 2026-07-08 walkthrough found the Files picker
  opening on empty Recents. Résumés usually live on laptops and in email. This is a
  hypothesis, and at 2 arrivals a week the funnel cannot confirm it, which is why real
  people gate it.
- **Files:** `Features/V2/Home/HomeTabView.swift:863` (`uploadHero`), `TailorViewModel`,
  `src/app/api/upload-resume/route.ts` (confirm whether it accepts raw text today; add
  `resume_text` if not), plus a bundled sample fixture labelled "Example".
- **Acceptance:**
  - [ ] Two secondary actions under the upload card: paste résumé text, see a sample result.
  - [ ] Pasted text runs the same pipeline as an upload.
  - [ ] A sample result never counts as an optimization anywhere.
  - [ ] EN, HE and RTL all correct.
- **Tests:** route test for text input including short-text rejection and no PII in logs;
  view-model unit tests; UI test for the paste path.
- **Analytics verification:** `optimization_started` gains `input_source` (`file` or
  `text`), plus a new `sample_result_viewed`. Read only when each branch has 10 or more
  non-internal persons.
- **Astra checkpoint:** a mock of the Home card before code; device walk in EN and HE after.

## Smaller P2 items

| Item | Complexity | Model | Notes |
|---|---|---|---|
| Second-job loop | S | Sonnet | After `export_success`, lead with "Tailor for another job", keeping the résumé. `Features/V2/Improve/OptimizedResumeView.swift`. Check: `optimization_started` by returning persons. |
| Hebrew stale-copy class | S | Sonnet | 24 constant-key `NSLocalizedString` display sites (FitCheckView 7, ProfileView 7, FitVerdictView 5, OptimizeFitCheckView 4, TailorView 1) move to `LocalizedStringKey`. Extend `UploadCardLocalizationTests`. |
| Anonymous data retention | S | Sol | Scheduled delete of anonymous users and their Storage files after 30 days idle. 611 résumés and 46 anonymous users exist with no expiry. Needs an explicit yes. |
| Paid-moment experiment | M | Sol | Gated on two consecutive weeks of 50 or more arrivals. Requires R1 done first. One offer at export, flipping `MONETIZATION_GATE_OPEN`. |

---

# Not now, on purpose

Pricing and paywall UI beyond the gated experiment. Score recalibration and the "strong"
band. Changing the 100-word job floor. New events, dashboards or measurement contracts.
Migrating chat to the Responses API. Moving the Supabase URL into `Info.plist`, which does
not prevent a pause. Signed-in web app features. The Career Evidence Pilot and any new
expert workflow. Framework and dependency upgrades beyond security patches. Dropping the
empty RunSmart-shaped tables.

# If there are only 5 engineering hours in a week

R1, R2, and R6 hide-only. Nothing else. Every remaining hour goes to posts, ASO, and the 5
sessions.

# Assumptions that could still be wrong

That anyone wants per-job résumé tailoring on a phone. That Israel and Hebrew is the right
first market. That LinkedIn from a personal profile can reach 50 arrivals a week. That the
optimizer's output is good enough to earn a second visit, which nobody outside the team has
yet said.
