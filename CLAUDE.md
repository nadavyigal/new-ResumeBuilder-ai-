# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Essential commands to run from the `resume-builder-ai` directory:**

- `npm run dev` - Start development server at http://localhost:3000
- `npm run build` - Build production version
- `npm run start` - Start production server
- `npm run lint` - Run ESLint checks

**Package manager:** This project uses npm (package-lock.json present, yarn.lock also exists but npm should be preferred based on package-lock.json being more recent)

## High-Level Architecture

This is an **AI Resume Optimizer** - a Next.js 14 application that helps users optimize their resumes for specific job descriptions using AI.

### Tech Stack
- **Frontend:** Next.js 14 with TypeScript, Tailwind CSS, shadcn/ui components
- **Backend:** Next.js Route Handlers + Supabase Edge Functions  
- **Database:** Supabase (PostgreSQL with Row Level Security)
- **Authentication:** Supabase Auth
- **AI:** OpenAI (for resume optimization and embeddings)
- **Storage:** Supabase Storage (for file uploads)
- **Payments:** Stripe (freemium model)

### Core Features & Data Flow
1. **Resume Ingestion** - Users upload PDF/DOCX resumes → parsed to structured JSON
2. **Job Description Input** - Users paste job descriptions or URLs → cleaned and structured
3. **AI Optimization** - OpenAI analyzes resume against job description → generates optimized version
4. **ATS Scoring** - Calculates match percentage using keywords and embeddings
5. **Template Rendering** - Applies optimized content to professional templates
6. **Export** - Generate PDF/DOCX downloads

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
**Key tables:**
- `profiles` - User profiles with plan type and optimization counts
- `resumes` - Uploaded resumes with parsed data and embeddings  
- `job_descriptions` - Job postings with extracted requirements
- `optimizations` - Results linking resumes + job descriptions with AI-generated improvements
- `templates` - Resume design templates (ATS-safe, Modern)
- `events` - Analytics tracking

**Important:** All tables use Row Level Security (RLS) - users can only access their own data.

### API Routes Structure
Based on constants.ts, the planned API endpoints are:
- `/api/upload-resume` - Handle resume file uploads
- `/api/ingest-jd` - Process job description input
- `/api/optimize` - Trigger AI optimization process  
- `/api/score` - Calculate ATS match scores
- `/api/download` - Generate export files
- `/api/templates` - Fetch available templates

### Environment Setup
Requires these environment variables:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- Additional variables likely needed for OpenAI API and Stripe

### Business Model
- **Free tier:** 1 optimization per user
- **Premium tier:** Unlimited optimizations + premium templates
- Freemium conversion strategy with Stripe integration

### Development Patterns
- Uses TypeScript with strict configuration
- Tailwind CSS for styling with shadcn/ui component library
- Server-side and client-side Supabase clients for different contexts
- Path aliases configured (`@/*` maps to `src/*`)
- ESLint configured with Next.js and TypeScript rules