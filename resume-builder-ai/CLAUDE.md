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
5. **Chat Resume Iteration** - Conversational AI for iterative resume improvements (Feature 002)
6. **Design Selection** - AI-recommended templates with customization via chat (Feature 003)
7. **History View** - Browse, filter, search, and manage all previous optimizations (Feature 005 - NEW)
8. **Template Rendering** - Applies optimized content to professional templates
9. **Export** - Generate PDF/DOCX downloads with selected designs

### Directory Structure
```
src/
├── app/                    # Next.js App Router pages
│   ├── api/v1/            # API routes (versioned)
│   │   ├── chat/         # Chat endpoints (Feature 002)
│   │   └── design/       # Design endpoints (Feature 003 - NEW)
│   ├── auth/              # Authentication pages (signin, signup)
│   ├── dashboard/         # Main app dashboard
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Landing page
├── components/            # React components
│   ├── auth/             # Auth-related components
│   ├── chat/             # Chat UI components (Feature 002)
│   ├── design/           # Design browser & customizer (Feature 003)
│   ├── history/          # History view components (Feature 005 - NEW)
│   ├── layout/           # Layout components
│   ├── providers/        # Context providers
│   └── ui/               # shadcn/ui components
├── lib/                  # Utilities and configurations (Library-First Architecture)
│   ├── ai-optimizer/     # AI optimization library
│   ├── chat-manager/     # Chat session management (Feature 002)
│   ├── design-manager/   # Design selection & customization (Feature 003 - NEW)
│   ├── template-engine/  # Resume template rendering
│   ├── templates/        # Template library
│   │   └── external/    # Synced from resume-style-bank (Feature 003 - NEW)
│   ├── supabase/         # Supabase database wrappers
│   ├── constants.ts      # App constants (routes, config)
│   └── utils.ts          # Utility functions
└── types/                # TypeScript type definitions
```

### Database Schema (Supabase)
**Core tables:**
- `profiles` - User profiles with plan type and optimization counts
- `resumes` - Uploaded resumes with parsed data and embeddings
- `job_descriptions` - Job postings with extracted requirements
- `optimizations` - Results linking resumes + job descriptions with AI-generated improvements
- `events` - Analytics tracking

**Chat tables (Feature 002):**
- `chat_sessions` - Chat sessions for resume iteration
- `chat_messages` - Message history with sender and metadata
- `resume_versions` - Resume versions created during chat
- `amendment_requests` - Amendment tracking for changes

**Design tables (Feature 003 - NEW):**
- `design_templates` - Available design templates (minimal, card, timeline, sidebar)
- `design_customizations` - User-specific design modifications (colors, fonts, layout)
- `resume_design_assignments` - Links optimizations to templates with customizations (1:1)

**Important:** All tables use Row Level Security (RLS) - users can only access their own data.

### API Routes Structure
**Core endpoints:**
- `/api/upload-resume` - Handle resume file uploads
- `/api/ingest-jd` - Process job description input
- `/api/optimize` - Trigger AI optimization process
- `/api/score` - Calculate ATS match scores
- `/api/download` - Generate export files

**Chat endpoints (Feature 002):**
- `/api/v1/chat` - Send message, get AI response
- `/api/v1/chat/sessions` - List/create chat sessions
- `/api/v1/chat/sessions/[id]/messages` - Message history
- `/api/v1/chat/sessions/[id]/apply` - Apply amendment to resume
- `/api/v1/chat/sessions/[id]/preview` - Preview changes

**Design endpoints (Feature 003):**
- `/api/v1/design/templates` - List all design templates
- `/api/v1/design/templates/[id]/preview` - Preview template with user data
- `/api/v1/design/recommend` - Get AI-recommended template
- `/api/v1/design/[optimizationId]` - Get/update design assignment
- `/api/v1/design/[optimizationId]/customize` - AI design customization
- `/api/v1/design/[optimizationId]/undo` - Undo last design change
- `/api/v1/design/[optimizationId]/revert` - Revert to original template

**History endpoints (Feature 005 - NEW):**
- `/api/optimizations` - List optimizations with filtering, sorting, pagination
- `/api/optimizations/bulk` - Bulk delete optimizations (max 50)
- `/api/optimizations/export` - Bulk export optimizations to ZIP (max 20)

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
- **Library-First Architecture** - All features implemented as standalone libraries in `src/lib/` before API integration
- **Test-Driven Development (TDD)** - Contract tests → Integration tests → Implementation (required by constitution)
- **TypeScript** with strict configuration for type safety
- **Tailwind CSS** for styling with shadcn/ui component library
- **Server Components** - Next.js 15 App Router with React Server Components
- **Row Level Security (RLS)** - All Supabase queries respect user permissions
- **API Versioning** - All new endpoints under `/api/v1/` namespace
- **Path aliases** configured (`@/*` maps to `src/*`)

### Recent Changes

**Feature 003 - Design Selection:**
- Added `src/lib/design-manager/` library for template selection and AI customization
- Added `src/lib/templates/external/` for synced templates from resume-style-bank
- Created 3 new database tables: `design_templates`, `design_customizations`, `resume_design_assignments`
- Added 7 new API endpoints under `/api/v1/design/`
- Integrated AI chat for design modification requests (reuses Feature 002 chat infrastructure)
- Template sync script: `scripts/sync-external-templates.ts` (run before build)
- Performance targets: <5s preview rendering, <2s template switching

**Feature 005 - History View (NEW):**
- Full optimization history management at `/dashboard/history`
- Advanced filtering: search by job title/company, date range (Last 7/30/90 days), ATS score (90%+, 80%+, 70%+)
- Column sorting: date, company, ATS match score (ascending/descending)
- Pagination: 20/50/100 items per page with smooth navigation
- Bulk actions: select multiple optimizations, bulk delete (max 50), bulk export to ZIP (max 20)
- "Apply Now" workflow: one-click PDF download + job URL opening + application tracking
- URL state synchronization: bookmarkable filtered views
- Performance optimizations: database indexes, React.memo, debounced search (300ms), debounced filters (500ms)
- Error boundary with user-friendly error handling and retry
- Components: `HistoryTable`, `OptimizationRow`, `HistorySearch`, `HistoryFilters`, `HistoryPagination`, `BulkActions`, `ErrorBoundary`
- API routes: `GET /api/optimizations`, `DELETE /api/optimizations/bulk`, `POST /api/optimizations/export`
- Performance targets: <2s page load for 100 optimizations, <200ms search updates, <500ms filter application