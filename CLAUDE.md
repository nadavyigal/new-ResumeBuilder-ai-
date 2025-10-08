# CLAUDE.md

This file provides guidance to Claude/Code or similar assistants when working with this repository.

## Development Commands

Run from the `resume-builder-ai` directory:

- `npm run dev` - Start development server at http://localhost:3000
- `npm run build` - Build production version
- `npm run start` - Start production server
- `npm run lint` - Run ESLint checks

Package manager: npm (package-lock.json present). Yarn lock may exist; prefer npm.

## High-Level Architecture

This is an AI Resume Optimizer - a Next.js application that helps users optimize resumes for specific job descriptions using AI.

### Tech Stack
- Frontend: Next.js with TypeScript, Tailwind CSS, shadcn/ui
- Backend: Next.js Route Handlers + Supabase Edge Functions
- Database: Supabase (PostgreSQL with Row Level Security)
- Authentication: Supabase Auth
- AI: OpenAI
- Storage: Supabase Storage
- Payments: Stripe (freemium model)

### Core Features & Data Flow
1. Resume Ingestion → parse PDF/DOCX to structured JSON
2. Job Description Input → paste text/URL and clean/structure
3. AI Optimization → analyze resume vs JD and generate improvements
4. ATS Scoring → match percentage using keywords and embeddings
5. Template Rendering → professional templates
6. Export → PDF/DOCX downloads

### Directory Structure
```
src/
├── app/                    # Next.js App Router pages
│   ├── auth/              # Authentication pages (signin, signup)
│   ├── dashboard/         # Main app dashboard
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Landing page
├── components/            # React components
│   ├── auth/             # Auth-related components
│   ├── layout/           # Layout components
│   ├── providers/        # Context providers
│   └── ui/               # shadcn/ui components
├── lib/                  # Utilities and configurations
│   ├── constants.ts      # App constants (routes, config)
│   ├── supabase.ts       # Supabase client (browser)
│   ├── supabase-server.ts # Supabase client (server)
│   └── utils.ts          # Utility functions
└── types/                # TypeScript type definitions
```

### Database Schema (Supabase)
Key tables:
- `profiles`, `resumes`, `job_descriptions`, `optimizations`, `templates`, `events`
All tables use Row Level Security (RLS).

### API Routes Structure
- `/api/upload-resume`, `/api/ingest-jd`, `/api/optimize`, `/api/score`, `/api/download`, `/api/templates`

### Environment Setup
Environment variables required:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, plus OpenAI/Stripe as needed

### Business Model
- Free tier: 1 optimization per user
- Premium: unlimited optimizations + premium templates

### Development Patterns
- TypeScript strict, Tailwind + shadcn/ui, server/client Supabase clients, path aliases (`@/*` → `src/*`), ESLint
