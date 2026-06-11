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
