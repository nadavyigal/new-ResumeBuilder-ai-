# ResumeBuilder — Project Context

> Living document. Update when architecture decisions are made or scope changes.
> Read at session start alongside CLAUDE.md and tasks/lessons.md.

---

## Product Name
ResumeBuilder (AI Resume Optimizer)

## Product Vision
Help job seekers fit their resume to a specific job: paste the job, see what is missing, fix it. Resumely makes no promise about ATS results or interviews (EXD-012); the Resumely Match Score is an estimate of fit, not any employer's score. (Corrected 2026-10-15, market-play plan G1a.)

## Target Users

| Persona | Key Job to Be Done |
|---------|-------------------|
| **Active Job Seeker** | "Tailor my resume to this specific job posting without spending hours rewriting it." |
| **Career Changer** | "Show me what skills I'm missing and how to position my experience for a new industry." |

## Core User Problems
1. Job seekers send the same resume to every job and cannot see what a specific posting asks for that their resume does not show
2. Manual tailoring is time-consuming and requires copywriting skill most people don't have
3. Job seekers don't know which keywords matter for a specific role

## Current Scope

### In Scope
- Resume upload (PDF; the free web check accepts PDF only)
- Job description ingestion (text paste or URL)
- AI-powered resume optimization against the JD
- Resumely Match Score (keyword and formatting fit against the pasted job, an estimate)
- Professional template rendering
- PDF/DOCX export
- No charge before the StoreKit gate: monetization is off (`MONETIZATION_ENABLED`, default off). Pricing is decided, not built (see Business Model)
- Supabase auth (email/password)

### Out of Scope (Backlog)
- LinkedIn profile import
- Cover letter generation
- Interview prep coaching
- Team/recruiter features
- Bulk processing

## Business Model
Updated 2026-10-29: pricing v2, founder-approved plan `plans/resumely-pricing-v2.md` in ResumeBuilder-IOS-APP (v3). Supersedes the 2026-10-14 D1 shape ($3.99/1, $12.99/5, $19.99/10, no subscription).
- Today: free. No paywall, no charge, no visible "Premium" before the StoreKit gate (EXD-009, EXD-029, EXD-018).
- Decided shape (iOS only): the Match Score is free and unlimited for everyone; only PDF exports are paid. Every real account gets 3 free PDF exports once (`welcome_export_grant()`). Packs `resumely.exports.5.v2` ($3.99, 5 exports) and `resumely.exports.14` ($7.99, 14 exports); monthly subscription `resumely.pro.monthly` ($9.99, unlimited exports, fair use 40 per billing period, `subscription_export_cap()`). The v1 packs are retired from sale but a paid v1 transaction is still honored. Credits never expire.
- Server side: `supabase/migrations/20261029120000_pricing_v2.sql` (welcome grant, subscriptions, fair use in `unlock_export`), `/api/v1/iap/verify` and `/api/v1/iap/notifications` handle the subscription, `/api/v1/credits` returns the plan state.
- Built only when all four StoreKit gate conditions hold (plan, Track 2). Stripe code still exists in the repo (`src/app/api/upgrade/route.ts`) but is not the pricing plan.

## Main Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js (App Router) + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Database + Auth | Supabase (PostgreSQL + RLS) |
| AI | OpenAI (GPT-4o or GPT-4o-mini depending on cost/quality trade-off) |
| Storage | Supabase Storage (resume files) |
| Payments | None live. Planned: Apple in-app purchase (StoreKit), gated |
| Deployment | Vercel |

## Repository Layout

```
new-ResumeBuilder-ai-/       ← repo root, the Next.js app (run all commands from here)
├── src/
│   ├── app/                 # App Router pages + API routes
│   ├── components/          # React components
│   ├── lib/                 # Supabase clients, utils
│   └── types/
├── docs/
│   ├── agent-os/            # This file + future ADRs
│   └── *.md                 # Deployment and rollout plans
└── tasks/
    └── lessons.md           # Recurring bug memory
```

## Key Integrations

| Integration | Purpose | Notes |
|-------------|---------|-------|
| Supabase | Auth, DB, file storage | RLS on all tables |
| OpenAI | Resume optimization, Match Score | Rate limit all routes |
| Stripe | Legacy upgrade route only, not the pricing plan | Webhook secret must match endpoint if it is ever used |
| Vercel | Hosting | Connect to GitHub for auto-deploy |

## Known Risks
- OpenAI latency on long resumes → use streaming + `maxDuration = 60`
- Stripe webhook secret misconfiguration → common cause of payment failures
- Supabase RLS gaps → test with non-service-role client before shipping
- PDF parsing quality → third-party parsers vary; test with real resume samples

## Open Questions

- [OPEN QUESTION] Which OpenAI model to use in production: GPT-4o (quality) vs GPT-4o-mini (cost)
- [OPEN QUESTION] LinkedIn import — timeline and API access approach
- [OPEN QUESTION] Cover letter generation — separate product or same app
- Pricing: answered 2026-10-14 (D1), revised 2026-10-29 (pricing v2): see Business Model

---

## Architecture Decision Records

### ADR-001: Supabase for auth + DB (not Clerk, not PlanetScale)

**Decision:** Use Supabase for both auth and database. No separate auth provider.

**Reason:** Single platform reduces complexity for a solo founder. Supabase Auth + RLS means authorization is enforced at the database layer without writing middleware.

**Consequences:**
- Always use `.maybeSingle()` not `.single()` unless row is guaranteed
- Use `supabase-server.ts` (service role) only in Route Handlers, never expose to client
- Test RLS by querying as a regular user, not as the service role

### ADR-002: Freemium via Stripe (not usage-based billing)

**Superseded 2026-10-14** by founder decision D1 (iOS credit packs, StoreKit, gated). Kept for history.

**Decision:** Simple free/premium tier with Stripe Checkout. One free optimization per user enforced by checking `optimizations` table count in the API route before calling OpenAI.

**Reason:** Simplest implementation. No Stripe metering needed.

**Consequences:**
- Gate check lives in `/api/optimize` before the OpenAI call
- Stripe webhook updates a `is_premium` flag on the `profiles` table
- Webhook secret must be set correctly — this is a recurring misconfiguration risk
