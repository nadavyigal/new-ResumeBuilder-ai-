# Plan: G1c-2, guest tailoring on the web (and the CAPTCHA decision)

Status: **proposal for founder approval.** No code until approved. Written 2026-10-16.
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
which have no tag, keep today's behaviour. The tag is user-editable, so it only enforces the
product prompt. Spend is protected separately, by persistent limits on every anonymous caller
(S3), which does not depend on the tag.

At export, the guest becomes a real account **without changing user id**: Supabase
`updateUser({ email, password })` (email confirmation) or `linkIdentity` (Google). Résumé,
optimization and review rows already belong to that id, so nothing is copied or migrated.

Rejected: a separate "guest optimization" table keyed by a browser id. It duplicates the
résumé, optimization and review tables and their row-level security, and needs a merge at
sign-up. The anonymous session gives the same result with the code that exists.

## Stories (one at a time, each its own branch and PR)

**S1. Guest can enter the tailoring flow.**
- `src/middleware.ts`: an anonymous session may open the guest routes (`/dashboard/resume`,
  `/dashboard/optimization-reviews/[id]`, `/dashboard/optimizations/[id]`); history, profile and
  applications still go to sign-in. An anonymous session is not redirected away from `/auth/*`.
- `src/app/[locale]/dashboard/layout.tsx`: same rule.
- `ATSScoreDisplay.tsx`: "Tailor my résumé to this job" starts `signInAnonymously()` when there
  is no session, then opens the upload step with the job text carried over.
- `auth-provider.tsx`: no `posthog.identify` for an anonymous user. Identifying an anonymous
  session splits one guest into two unlinked PostHog people (the rule iOS already follows in
  `AppState.bootstrap`). Identify at conversion.
- The session is started with the web tag (`user_metadata.client = "web"`).
- `upload-resume`: the same per-IP ceiling for anonymous callers as optimize, since it runs
  the optimizer itself.
- The AI assistant and section refinement are hidden on the optimization page for a web guest
  (S2 rejects them on the server too).
- Tests first: middleware rules (guest allowed, guest blocked, no redirect loop), the upload IP
  limit, identify not called for an anonymous user, the tag set at sign-in.

**S2. The account is asked at export, and the guest's work stays.**
- One server helper, `requireAccountForWebGuest(user)`, returns 403 `{ code: "ACCOUNT_REQUIRED" }`
  for an anonymous user with the web tag. Called from **every** server export path
  (`download/[id]`, `apply-job`, `optimizations/export`) and from the paid AI routes a web guest
  does not need (`v1/chat`, `v1/refine-section`, `ats/score`).
- The optimization page catches that code and shows one prompt: "Create a free account to
  download. Your tailored résumé is kept." (en, he).
- Sign-up page: with an anonymous session it converts (`updateUser` / `linkIdentity`) instead of
  `signUp`, then returns to the download. PostHog `identify` with the same id after conversion.
- Tests first: a web guest gets 403 with the code on each of the six routes; **an untagged
  anonymous user (an iOS guest) still downloads, exports and chats as before**; conversion keeps
  the user id and the optimization stays readable; a signed-in user downloads as before.

**S3. Abuse ceiling and alert** (see the CAPTCHA decision).
- One helper charges the anonymous limits before **every** optimizer run: called from
  `/api/optimize` and from `/api/upload-resume` (which runs the optimizer itself). It applies the
  20-a-day IP ceiling and a global daily cap (a `rate_limits` row keyed
  `optimize-anonymous-global`, default 200 a day), and returns the existing 429 copy.
- The other paid AI routes (`v1/chat`, `v1/refine-section`, `ats/score`) get a persistent per-IP
  ceiling for anonymous callers in the `rate_limits` table, sized above real use. This covers iOS
  guests, who may still call them, without breaking them.
- Tests first: both optimizer entry points charge the same global counter (the 201st anonymous
  run in a day is refused whichever route it came through); the AI-route IP ceiling; a
  signed-in user is never IP-limited.
- A PostHog alert on anonymous optimize volume and on IP-ceiling hits.

**S4. End to end.**
- Playwright on a local dev server: free check, tailor as guest, "Add only if true", export prompt,
  convert with a test account on the local Supabase, download. English and Hebrew.

## The CAPTCHA decision

| Option | What it stops | Cost | Breaks |
|---|---|---|---|
| **A. No CAPTCHA now (recommended).** Keep the 20-a-day IP ceiling, add the global cap and the alert (S3). | Farming from one IP; runaway spend from many | None | Nothing |
| B. Supabase Auth CAPTCHA (Turnstile or hCaptcha) on sign-ins | Bots minting anonymous sessions | Free tier | **Installed iOS builds.** iOS calls `POST /auth/v1/signup` with no captcha token (`ResumeBuilder IOS APP/Core/Auth/AuthService.swift:153`). Turning this on blocks every iOS guest until an iOS build ships a token. |
| C. Vercel BotID on `/api/upload-resume` and `/api/optimize` for anonymous callers | Scripted callers, invisibly, no puzzle | A new npm dependency (`botid`), needs your OK | Nothing for iOS if applied to web callers only |

Why A is enough to start: R1 measured $0.022 per tailoring run (mean, 12 runs) and about $0.81
in the worst case with every call retried. Once S3 charges both optimizer entry points, a cap of
200 anonymous runs a day bounds typical tailoring spend near $4.40 a day and the theoretical worst
near $162 a day, and the alert fires long before that. Chat, refinement and scoring are not in
that bound: web guests cannot call them (S2), and iOS guests are held to the per-IP ceiling. Traffic today is about 3 arrivals a week (EXD-029), so the cap will not touch a real user.

Move to C when either happens in a week: anonymous optimizations above 100 a day, or more than
20 IP-ceiling hits a day. B only after an iOS build sends a captcha token.

## Could break

- Redirect loops between `/dashboard` and `/auth/*` for anonymous sessions (S1 tests cover them).
- The 7-day anonymous free-check carryover (WP-49, `src/lib/anonymous-carryover.ts`): it must still
  attach the free-check result when an anonymous user converts. Covered in S2 tests.
- Anonymous `auth.users` rows accumulate. Supabase does not delete them. A cleanup job is a later
  story (PR #172 purges only anonymous free-check rows).
- PostHog: a guest who converts must stay one person (no identify before conversion).
- iOS: no change. The export gate keys on the web tag, never on `is_anonymous` alone, and the
  new IP ceilings are sized above real use. No auth setting changes in this plan.

## Founder decisions needed

1. Approve the approach (anonymous sessions, converted at export).
2. CAPTCHA: option A now, with the triggers above for C. Or pick another.
3. The global daily cap (default 200 anonymous runs a day).
4. Should a guest see a history page before converting? Default: no.
