# Plan: G1c-2, guest tailoring on the web (and the CAPTCHA decision)

Status: **proposal.** Written 2026-10-16, revised 2026-10-18.

**What is approved (2026-10-17, founder, PR Steward thread on this PR): the direction only.**
Guest tailoring through Supabase anonymous sessions, with server controls in place before guest
access opens. **Not approved:** any cap value, any CAPTCHA option, any Supabase auth configuration
change, any implementation story, and the launch of guest entry. Each of those needs its own
founder OK. No code until then.
Parent plan: `docs/plans/2026-10-14-market-play-implementation.md`, Track 1, G1c. G1c-1 (#185)
removed the account wall from the free check; this is the rest of G1c: the account is asked at
the first tailored export, not before.

## Goal

A web visitor can go from the free check to a tailored résumé without an account: upload,
tailor, review ("Add only if true"), see the result. The account is asked once, at the first
export (download), and the guest's work carries into that account.

## What is behind the account wall today (read 2026-10-16 on `main` 9281cc4)

| Step | Where | Today |
|---|---|---|
| Free check | `/api/public/ats-check` | Open (G1c-1). No change. |
| Dashboard pages | `src/middleware.ts:82`, `src/app/[locale]/dashboard/layout.tsx:19` | Redirect to sign-in without a session |
| Upload résumé + job | `src/app/api/upload-resume/route.ts:29-32` | 401 without a session; no anonymous IP limit. **It runs the optimizer itself** (`route.ts:251`) unless the form sends `deferOptimization`, and the web résumé page does not (`src/app/[locale]/dashboard/resume/page.tsx:119`). So the web path never calls `/api/optimize`. |
| Tailor | `src/app/api/optimize/route.ts:24-27` | 401 without a session; **already accepts an anonymous session** and holds it to 20 runs per IP per day (`src/lib/rate-limiting/anonymous-optimize-limit.ts`) |
| Review and apply | `src/app/api/v1/optimization-reviews/[id]/apply/route.ts` | 401 without a session |
| Export | `src/app/api/download/[id]/route.ts:26-29`, `src/app/api/apply-job/route.ts` (returns `resumePdfBase64`), `src/app/api/optimizations/export/route.ts` (a ZIP of PDFs) | 401 without a session; any session, anonymous included, can export through all three |
| Other paid AI | `src/app/api/v1/chat/route.ts:179-190`, `src/app/api/v1/refine-section/route.ts:24-37`, `src/app/api/ats/score/route.ts:22-63` | Any session, anonymous included. Only the in-memory per-user limiter (`checkRateLimit`), which a new anonymous id or a new serverless instance resets |
| iOS guests | `ResumeBuilder IOS APP/Core/API/Endpoints.swift:76-98` | Installed iOS guests call `download`, `optimizations/export`, `chat`, `refine-section` and `ats/score` with an anonymous session today. Any server rule that rejects every anonymous caller breaks them. |
| Sign-up page | `src/middleware.ts:86` | Any session is redirected away from `/auth/*`. An anonymous guest could never reach sign-up. |
| Analytics | `src/components/providers/auth-provider.tsx:41-60` | `posthog.identify` on any session, anonymous included |

## Recommended approach: Supabase anonymous sessions, converted in place at export

The iOS app already does this for guests: a Supabase anonymous session (a real `auth.users` row,
`is_anonymous: true`), the same API routes, the same row-level security. Anonymous sign-ins are
on in production: the iOS guest flow ran against production on 2026-10-12 (iOS PR #188).
`@supabase/supabase-js` 2.57.2 is installed and has `signInAnonymously`. No new dependency.

**Web guests are tagged.** The web starts the session with
`signInAnonymously({ options: { data: { client: "web" } } })`, so `user_metadata.client` is
`"web"`. The account-at-export rule applies only to anonymous users with that tag; iOS guests,
which have no tag, keep today's behaviour. The tag is user-editable, so it is **not a security boundary**: it only
decides which guests see the export prompt. Spend is protected separately, by persistent limits on
every anonymous caller (S1), which never read the tag.

At export, the guest becomes a real account **without changing user id**: Supabase
`updateUser({ email, password })` (email confirmation) or `linkIdentity` (Google). Résumé,
optimization and review rows already belong to that id, so nothing is copied or migrated.

Rejected: a separate "guest optimization" table keyed by a browser id. It duplicates the
résumé, optimization and review tables and their row-level security, and needs a merge at
sign-up. The anonymous session gives the same result with the code that exists.

## Stories (one at a time, each its own branch and PR)

**Order is a hard rule.** S1 (server abuse limits) and S2 (export restrictions) are merged and
tested **before** S3 opens guest entry. Until both are in production and their tests pass, the
middleware keeps redirecting anonymous web sessions to sign-in, and no "Tailor as guest" button
ships. The 2026-10-16 draft had guest entry first; that order would have opened paid AI and export
to web guests before any limit existed.

**S1. Abuse limits on every anonymous caller** (see the CAPTCHA decision). Prerequisite for S3.
- One helper charges the anonymous limits before **every** optimizer run: called from
  `/api/optimize` and from `/api/upload-resume` (which runs the optimizer itself). It applies the
  same 20-a-day IP ceiling and a global daily cap (a `rate_limits` row keyed
  `optimize-anonymous-global`; the value is a founder decision, 200 a day is only the proposal),
  and returns the existing 429 copy. The same ceilings apply to both routes.
- The limits key on `is_anonymous`, never on the web tag, so an edited tag cannot skip them.
- The other paid AI routes (`v1/chat`, `v1/refine-section`, `ats/score`) get a persistent per-IP
  ceiling for anonymous callers in the `rate_limits` table, sized above real use. This covers iOS
  guests, who may still call them, without breaking them.
- Tests first: both optimizer entry points charge the same global counter (the cap + 1st
  anonymous run in a day is refused whichever route it came through); the IP ceiling on
  `upload-resume`; the AI-route IP ceiling; an anonymous caller with an edited or missing tag is
  still limited; a signed-in user is never IP-limited.
- A PostHog alert on anonymous optimize volume and on IP-ceiling hits.

**S2. The account is asked at export, and the guest's work stays.** Prerequisite for S3.
- One server helper, `requireAccountForWebGuest(user)`, returns 403 `{ code: "ACCOUNT_REQUIRED" }`
  for an anonymous user with the web tag. Called from **every** server export path
  (`download/[id]`, `apply-job`, `optimizations/export`) and from the paid AI routes a web guest
  does not need (`v1/chat`, `v1/refine-section`, `ats/score`).
- `src/middleware.ts`: an anonymous session is not redirected away from `/auth/*`, so a guest can
  reach sign-up to convert.
- The optimization page catches that code and shows one prompt: "Create a free account to
  download. Your tailored résumé is kept." (en, he).
- Sign-up page: with an anonymous session it converts (`updateUser` / `linkIdentity`) instead of
  `signUp`, then returns to the download. PostHog `identify` with the same id after conversion.
- Tests first: a web guest gets 403 with the code on each of the six routes; **an untagged
  anonymous user (an iOS guest) still downloads, exports and chats as before**; conversion keeps
  the user id and the optimization stays readable; a signed-in user downloads as before. Web-guest
  test users are created with the tag directly, so S2 is tested without S3.

**S3. Guest entry opens.** Only after S1 and S2 are merged, tested and live, and only with a
separate founder OK to launch.
- `src/middleware.ts`: an anonymous session may open the guest routes (`/dashboard/resume`,
  `/dashboard/optimization-reviews/[id]`, `/dashboard/optimizations/[id]`); history, profile and
  applications still go to sign-in.
- `src/app/[locale]/dashboard/layout.tsx`: same rule.
- `ATSScoreDisplay.tsx`: "Tailor my résumé to this job" starts `signInAnonymously()` when there
  is no session, then opens the upload step with the job text carried over.
- `auth-provider.tsx`: no `posthog.identify` for an anonymous user. Identifying an anonymous
  session splits one guest into two unlinked PostHog people (the rule iOS already follows in
  `AppState.bootstrap`). Identify at conversion.
- The session is started with the web tag (`user_metadata.client = "web"`).
- The AI assistant and section refinement are hidden on the optimization page for a web guest
  (S2 already rejects them on the server).
- Tests first: middleware rules (guest allowed, guest blocked, no redirect loop), identify not
  called for an anonymous user, the tag set at sign-in, and a check that S1's limits and S2's
  403 still fire on the guest path end to end.

**S4. End to end.**
- Playwright on a local dev server: free check, tailor as guest, "Add only if true", export prompt,
  convert with a test account on the local Supabase, download. English and Hebrew.

## The CAPTCHA decision

| Option | What it stops | Cost | Breaks |
|---|---|---|---|
| **A. No CAPTCHA now (recommended).** Keep the 20-a-day IP ceiling, add the global cap and the alert (S1). | Farming from one IP; runaway spend from many | None | Nothing |
| B. Supabase Auth CAPTCHA (Turnstile or hCaptcha) on sign-ins | Bots minting anonymous sessions | Free tier | **Installed iOS builds.** iOS calls `POST /auth/v1/signup` with no captcha token (`ResumeBuilder IOS APP/Core/Auth/AuthService.swift:153`). Turning this on blocks every iOS guest until an iOS build ships a token. |
| C. Vercel BotID on `/api/upload-resume` and `/api/optimize` for anonymous callers | Scripted callers, invisibly, no puzzle | A new npm dependency (`botid`), needs your OK | Nothing for iOS if applied to web callers only |

Why A is enough to start: R1 measured $0.022 per tailoring run (mean, 12 runs, 2026-10-14
gpt-4o and gpt-4o-mini prices) and estimated about $0.81 for one run with every call retried.
With a cap of 200 anonymous runs a day (a proposal, not approved), that gives about $4.40 a day
typical and about $162 a day worst case for **anonymous optimizer runs only**.

That figure is an estimate, not a guarantee. It holds only when all of these are true:
- S1 is live: both optimizer entry points charge one persistent global counter, read and written
  atomically across serverless instances. Before S1 there is no global cap, and `upload-resume`
  (the path the web uses) has no anonymous limit at all.
- The per-run cost stays near R1's: 12 runs is a small sample, and a longer résumé, a model or
  price change, or a new retry path moves it.
- It covers anonymous optimizer runs only. It does not cover the open free check
  (`/api/public/ats-check`), signed-in users, or iOS guests calling chat, refinement and scoring:
  those have per-IP ceilings, and a per-IP ceiling does not cap many IPs together.
- The alert exists only after S1 builds it; it is not live today.

Web guests cannot call chat, refinement or scoring (S2). Traffic today is about 3 arrivals a week
(EXD-029), so a cap of this size would not touch a real user.

Move to C when either happens in a week: anonymous optimizations above 100 a day, or more than
20 IP-ceiling hits a day. B only after an iOS build sends a captcha token.

## Could break

- Redirect loops between `/dashboard` and `/auth/*` for anonymous sessions (S2 and S3 tests cover them).
- The 7-day anonymous free-check carryover (WP-49, `src/lib/anonymous-carryover.ts`): it must still
  attach the free-check result when an anonymous user converts. Covered in S2 tests.
- Anonymous `auth.users` rows accumulate. Supabase does not delete them. A cleanup job is a later
  story (PR #172 purges only anonymous free-check rows).
- PostHog: a guest who converts must stay one person (no identify before conversion).
- iOS: no change. The export gate keys on the web tag, never on `is_anonymous` alone, and the
  new IP ceilings are sized above real use. No auth setting changes in this plan.
- Shipping S3 before S1 and S2: guest entry with no limits and open export. The order rule above
  exists to prevent this.

## Founder decisions

Approved:
1. The direction: anonymous sessions, converted at export, server controls before guest access
   (2026-10-17). Nothing else below is approved.

Still needed, each separately:
2. CAPTCHA: option A now, with the triggers above for C. Or pick another.
3. The global daily cap value (proposal: 200 anonymous runs a day).
4. Should a guest see a history page before converting? Proposal: no.
5. OK to implement each story (S1, S2, S3, S4), one at a time.
6. Any Supabase auth configuration change (none is planned).
7. OK to launch guest entry (S3 in production), only after S1 and S2 are live and tested.
