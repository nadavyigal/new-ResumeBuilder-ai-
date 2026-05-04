# CLAUDE.md — ResumeBuilder

> Global rules and skills catalog: `~/.claude/CLAUDE.md` (auto-loaded every session).
> Read `docs/agent-os/project-context.md` and `tasks/lessons.md` at session start.
> Follow the planning protocol for any task touching more than 2 files: plan, get approval, implement one story at a time.

---

## Operating Mode

Plan before code. One story at a time. Lint + tests before done.

Source of truth hierarchy:
1. `docs/agent-os/project-context.md` — scope, decisions, open questions
2. `docs/` plan files — `plan.contracts.md`, `plan.deploy.md`, `plan.rollout.md`
3. This file — commands and architecture
4. The code

---

## Development Commands

Run from the `resume-builder-ai/` subdirectory (the actual Next.js app):

```bash
npm run dev      # Start dev server at http://localhost:3000
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

Package manager: npm. If a yarn.lock exists, still prefer npm.

**Before declaring any task done (run in order):**
```bash
npm run lint
npx tsc --noEmit
npm run build
```

---

## Architecture Overview

AI Resume Optimizer — a Next.js application that analyzes resumes against job descriptions, generates AI-powered improvements, and scores ATS compatibility.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js (App Router) + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Database + Auth | Supabase (PostgreSQL + RLS + Auth) |
| AI | OpenAI |
| Storage | Supabase Storage |
| Payments | Stripe (freemium) |

### Core Data Flow

1. **Resume Ingestion** → parse PDF/DOCX → structured JSON
2. **Job Description Input** → paste text or URL → clean/structure
3. **AI Optimization** → GPT analyzes resume vs JD → generates improvements
4. **ATS Scoring** → keyword match % using embeddings
5. **Template Rendering** → professional output templates
6. **Export** → PDF/DOCX download

### Directory Structure

```
resume-builder-ai/          ← run all commands from here
└── src/
    ├── app/                # Next.js App Router
    │   ├── auth/           # Signin, signup pages
    │   ├── dashboard/      # Main app
    │   ├── layout.tsx
    │   └── page.tsx        # Landing page
    ├── components/
    │   ├── auth/
    │   ├── layout/
    │   ├── providers/
    │   └── ui/             # shadcn/ui components
    ├── lib/
    │   ├── constants.ts
    │   ├── supabase.ts     # Browser Supabase client
    │   ├── supabase-server.ts  # Server Supabase client
    │   └── utils.ts
    └── types/
```

### API Routes

- `POST /api/upload-resume` — parse and store resume
- `POST /api/ingest-jd` — parse job description
- `POST /api/optimize` — run AI optimization
- `POST /api/score` — compute ATS score
- `GET /api/download` — export PDF/DOCX
- `GET /api/templates` — list available templates

### Database Tables (Supabase)

`profiles`, `resumes`, `job_descriptions`, `optimizations`, `templates`, `events`

All tables use Row Level Security (RLS). Never query without considering RLS. Use `.maybeSingle()` not `.single()` unless the row is guaranteed to exist.

### Business Model

- **Free tier:** 1 optimization per user
- **Premium:** unlimited optimizations + premium templates
- Stripe handles payment; check `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are set

### Environment Variables Required

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
```

### Development Patterns

- TypeScript strict mode
- Path alias: `@/*` → `src/*`
- Server vs browser Supabase clients: use `supabase-server.ts` in Route Handlers, `supabase.ts` in client components
- Rate limiting required on all AI routes (OpenAI calls)
- shadcn/ui for all new UI components

---

## Do NOT Rules

- Do not modify `.env*` files or commit secrets
- Do not add npm dependencies without asking
- Do not change Supabase migrations or RLS policies without explicit instruction
- Do not call OpenAI in a new route without adding rate limiting
- Do not refactor unrelated code during a bug fix
- Do not leave `console.log` in production code paths

---

## Known Issues / Lessons

See `tasks/lessons.md` when it exists. Until then, known patterns:

- **Supabase 406:** `.single()` on 0 or multiple rows → use `.maybeSingle()`
- **Wrong Supabase project:** verify `NEXT_PUBLIC_SUPABASE_URL` subdomain matches your dashboard
- **Stripe webhook failures:** verify `STRIPE_WEBHOOK_SECRET` matches the webhook endpoint secret in Stripe Dashboard, not the API key
- **OpenAI timeout:** streaming responses need `export const maxDuration = 60` in the route file
