# ResumeBuilder — Project Context

> Living document. Update when architecture decisions are made or scope changes.
> Read at session start alongside CLAUDE.md and tasks/lessons.md.

---

## Product Name
ResumeBuilder (AI Resume Optimizer)

## Product Vision
Help job seekers optimize their resumes for specific job descriptions using AI, improving ATS pass rates and interview callback rates.

## Target Users

| Persona | Key Job to Be Done |
|---------|-------------------|
| **Active Job Seeker** | "Tailor my resume to this specific job posting without spending hours rewriting it." |
| **Career Changer** | "Show me what skills I'm missing and how to position my experience for a new industry." |

## Core User Problems
1. Generic resumes fail ATS filters before a human ever reads them
2. Manual tailoring is time-consuming and requires copywriting skill most people don't have
3. Job seekers don't know which keywords matter for a specific role

## Current Scope

### In Scope
- Resume upload (PDF/DOCX parsing)
- Job description ingestion (text paste or URL)
- AI-powered resume optimization against the JD
- ATS keyword scoring
- Professional template rendering
- PDF/DOCX export
- Stripe freemium model (1 free optimization, paid for more)
- Supabase auth (email/password)

### Out of Scope (Backlog)
- LinkedIn profile import
- Cover letter generation
- Interview prep coaching
- Team/recruiter features
- Bulk processing

## Business Model
- Free tier: 1 optimization per registered user
- Premium: unlimited optimizations + premium templates
- Payment: Stripe (checkout + webhooks)

## Main Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js (App Router) + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Database + Auth | Supabase (PostgreSQL + RLS) |
| AI | OpenAI (GPT-4o or GPT-4o-mini depending on cost/quality trade-off) |
| Storage | Supabase Storage (resume files) |
| Payments | Stripe |
| Deployment | Vercel |

## Repository Layout

```
new-ResumeBuilder-ai-/       ← repo root
├── resume-builder-ai/       ← Next.js app (run all commands from here)
│   └── src/
│       ├── app/             # App Router pages + API routes
│       ├── components/      # React components
│       ├── lib/             # Supabase clients, utils
│       └── types/
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
| OpenAI | Resume optimization, ATS scoring | Rate limit all routes |
| Stripe | Payments, subscription gating | Webhook secret must match endpoint |
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
- [OPEN QUESTION] Pricing: monthly vs per-optimization vs credit-based

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

**Decision:** Simple free/premium tier with Stripe Checkout. One free optimization per user enforced by checking `optimizations` table count in the API route before calling OpenAI.

**Reason:** Simplest implementation. No Stripe metering needed.

**Consequences:**
- Gate check lives in `/api/optimize` before the OpenAI call
- Stripe webhook updates a `is_premium` flag on the `profiles` table
- Webhook secret must be set correctly — this is a recurring misconfiguration risk
