# ResumeBuilder — Decision Log

Project-specific architectural and product decisions. Read at the start of every ResumeBuilder session.

## Format
```
## YYYY-MM-DD — [Decision title]
**Decided:** [What was chosen]
**Why:** [The reasoning]
**Rejected:** [Alternatives considered and why ruled out]
```

---

## 2026-06-23 — WP-12 Story 0: Fit block on public ATS check

### Session summary
Implemented Story 0 of the Fit-First Triage wedge for the web repo only.

**Completed:**
- Added additive `fit` response data for `POST /api/public/ats-check`: `verdict` from locked bands (`>=75 Strong`, `50-74 Stretch`, `<50 Skip`), `scoreNote`, `topGaps`, and `missingKeywords`.
- Derived gaps from the existing must-have requirement matching path and left `score`, `preview`, `quickWins`, and `checksRemaining` unchanged.
- Rendered the server-owned verdict band above the existing score/quick-wins result panel on the free ATS checker page.
- Added focused response-shape coverage in `tests/api/ats-check-format-response.test.ts`.

**Validation:**
- `npx eslint src/app/api/public/ats-check/route.ts src/lib/ats/public-ats-check-response.ts src/components/landing/FreeATSChecker.tsx src/components/landing/ATSScoreDisplay.tsx tests/api/ats-check-format-response.test.ts` passed.
- `npm run check:i18n` passed with 0 missing HE strings and 0 invalid strings.
- Direct `tsx` assertions for the new response builder passed.
- `npx tsc --noEmit` still fails on the known pre-existing test typing errors outside touched files (same class as prior sessions).
- `npm test -- tests/api/ats-check-format-response.test.ts --runInBand`, a known existing unit test, and direct `ts-jest` all hung before diagnostics; `npm run build` also hung in `next build` after template sync and was stopped after several silent minutes.

**Not done:**
- Did not start iOS Stories 1-4.
- Did not add Supabase columns, RLS changes, dependencies, or rate-limit changes.

## 2026-05-20 — Agentic OS Setup
**Decided:** Added MEMORY.md and ERRORS.md to Claude Code setup for this project
**Why:** To eliminate re-explaining context and re-proposing failed approaches between sessions
**Rejected:** Minimal patch — structural enforcement requires the full system

---

## 2026-06-08 — Monetization sprint + monitization branch

### Session summary
Worked on: Full Resumely pre-launch monetization foundation.

**Completed:**
- Plan 1 (ASO + Launch Assets): 5 content files committed and on main — `launch-assets/aso/en-metadata.md`, `he-metadata.md`, `screenshot-briefs.md`, `launch-assets/linkedin/content-calendar.md`, `launch-day-posts.md`. All App Store character limits validated.
- Plan 2 (Web ATS Tool): `/ats-checker` + `/he/ats-checker` standalone SEO page — live on Vercel. EN and HE routes both return 200, correct canonical, RTL for Hebrew. Commits `aeb5ebf`, `f216e7b`.
- Plan 3 (StoreKit Paywall — skeleton): Supabase migration (`user_credits`, `iap_purchases` tables + RLS), `supabase/functions/storekit-verify/index.ts` skeleton, iOS `Payments/` group (PurchaseTier.swift complete, StoreManager/PaywallView/CreditManager stubs). Web PR #67, iOS PR #52.
- Plan 4 (Ambassador Flow — skeleton): Supabase migration (`user_exports` ambassador columns, `ambassador_notifications` table), `supabase/functions/ambassador-reward/index.ts` skeleton, iOS `Ambassador/` group (AmbassadorManager/Banner/SuccessView stubs, LinkedInShareComposer complete EN+HE). Web PR #68, iOS PR #53.
- `monitization` consolidation branch pushed to both repos (web + iOS) — all plan branches merged in.
- Obsidian updated: `Decisions/Monetization Branch Tracker.md` (new), `Strategy/Growth-Pricing-Design.md` (updated), `02-Products/ResumeBuilder/ResumeBuilder.md` (updated), `2026-06-08.md` daily note.
- Pipeline fix landed on main (separate branch by Nadav): 120s timeout, two-pass runOptimizePipeline, DOCX support, tsconfig fix for Deno edge functions.

**In progress / not done:**
- PDF/DOCX upload smoke-test — planned for today, NOT done. Still #1 risk before App Store approval.
- `APP_STORE_URL` in `src/app/[locale]/ats-checker/page.tsx` still has placeholder `id000000000`.

**Decisions:**
- Plans 3+4 are gated skeletons — do not apply migrations or deploy edge functions until Gate A opens (CFO price validation + D7 activation data per EXD-009).
- `user_credits` table (Plan 3) may need reconciliation with existing `profiles.credit_balance` + `credit_transactions` — flag at Gate A.
- `user_exports` table did not exist in schema; Plan 4 migration creates it with `IF NOT EXISTS` guard.

**Next session start:**
1. Smoke-test PDF + DOCX upload end-to-end on both iOS and web.
2. Check App Store Connect for Apple's response.
3. If approved: update `APP_STORE_URL`, paste ASO content, launch community posts.
