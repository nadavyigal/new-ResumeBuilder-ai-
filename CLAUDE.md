# AI Resume Optimizer - Claude Context

## Project Overview
AI Resume Optimizer is a Next.js 15 full-stack web application that enables job seekers to upload resumes, input job descriptions, and receive AI-powered optimized resumes tailored for specific roles with ATS-friendly formatting.

## Technology Stack
- **Frontend**: Next.js 15.5.2, React 19, TypeScript 5.9.2, Tailwind CSS 4
- **Backend**: Next.js API Routes, Supabase Edge Functions
- **Database**: Supabase PostgreSQL with Row Level Security
- **AI**: OpenAI GPT-4 for resume optimization
- **File Processing**: pdf-parse, docx library, Puppeteer for PDF generation
- **Auth**: Supabase Auth with JWT tokens
- **Storage**: Supabase Storage for file uploads
- **Deployment**: Vercel (frontend), Supabase (backend services)

## Core Architecture

### Library-First Approach
Every feature implemented as standalone library in `src/lib/`:
- `resume-parser/` - PDF/DOCX parsing and text extraction
- `job-description-extractor/` - URL scraping and text cleaning
- `ai-optimizer/` - OpenAI integration and prompt management
- `chat-manager/` - **NEW** Conversational AI for resume iteration and amendments
- `template-engine/` - Resume rendering and export generation
- `auth-manager/` - Supabase auth and subscription handling

### Data Model (Supabase)
```sql
-- Core entities with RLS enabled
profiles (user_id, full_name, subscription_tier, optimizations_used)
resumes (id, user_id, filename, parsed_data JSONB, embeddings VECTOR)
job_descriptions (id, user_id, title, extracted_data JSONB, embeddings VECTOR)
optimizations (id, user_id, resume_id, jd_id, match_score, optimization_data JSONB)
templates (key, name, family, is_premium, config JSONB)

-- Chat feature entities (Phase 2 - Feature 002)
chat_sessions (id, user_id, optimization_id, status, last_activity_at, context JSONB)
chat_messages (id, session_id, sender, content, metadata JSONB)
resume_versions (id, optimization_id, session_id, version_number, content JSONB, change_summary)
amendment_requests (id, session_id, message_id, type, target_section, status)
```

### API Endpoints (Next.js App Router)
```
# Core resume optimization
POST /api/upload-resume     → Resume upload and parsing
POST /api/ingest-jd         → Job description processing
POST /api/optimize          → AI resume optimization
GET  /api/score/[id]        → Match score analysis
GET  /api/download/[id]     → Resume export (PDF/DOCX)
GET  /api/templates         → Available templates

# Chat-based resume iteration (v1)
POST   /api/v1/chat                         → Send message, get AI response
GET    /api/v1/chat/sessions                → List user's chat sessions
GET    /api/v1/chat/sessions/[id]           → Get session details
DELETE /api/v1/chat/sessions/[id]           → Delete chat session
GET    /api/v1/chat/sessions/[id]/messages  → Paginated message history
POST   /api/v1/chat/sessions/[id]/apply     → Apply amendment to resume
POST   /api/v1/chat/sessions/[id]/preview   → Preview changes before applying
```

## Key Business Rules

### Freemium Model
- Free tier: 1 optimization per user
- Premium tier: Unlimited optimizations + premium templates
- Quota enforcement in optimization endpoint
- Paywall integration with Stripe

### Processing Constraints
- File uploads: PDF/DOCX ≤ 10MB
- AI optimization: 20-second timeout
- Truthful optimization: No fabricated skills/experience
- ATS-friendly output: Compatible with applicant tracking systems

### Performance Targets
- Resume upload: < 5 seconds
- Job description processing: < 3 seconds
- AI optimization: < 20 seconds (hard limit)
- **Chat AI response: < 7 seconds (target)** - NEW
- **Amendment application: < 10 seconds** - NEW
- File download: < 5 seconds

### Chat Session Management
- **One active session per resume optimization** - Enforced by DB unique constraint
- **30-day retention** - Closed sessions auto-deleted after 30 days
- **Session persistence** - Chat history preserved on reload
- **Fabrication prevention** - Detects and blocks requests for false information

## Development Principles

### Testing Strategy (TDD Enforced)
1. **Contract Tests**: API endpoint schemas and responses
2. **Integration Tests**: Library interactions and database operations
3. **E2E Tests**: Complete user workflows
4. **Unit Tests**: Individual function validation

### Code Organization
```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API route handlers
│   ├── dashboard/         # Protected user pages
│   └── auth/              # Authentication pages
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── templates/        # Resume template components
│   └── auth/             # Auth-related components
├── lib/                  # Core libraries (library-first)
│   ├── resume-parser/    # PDF/DOCX processing
│   ├── ai-optimizer/     # OpenAI integration
│   ├── template-engine/  # Export generation
│   └── utils/            # Shared utilities
└── types/                # TypeScript definitions
```

## Recent Changes

### Phase 2 - Chat Resume Iteration (Latest)
- ✅ Chat-manager library implemented with OpenAI GPT-4 integration
- ✅ 7 API routes for chat sessions, messages, and amendments
- ✅ 4 React components: ChatMessage, ChatInput, ChangeDiff, ChatSidebar
- ✅ Database schema with 4 new entities (sessions, messages, versions, amendments)
- ✅ Error handling: Retry logic, timeout handling, rate limit management
- ✅ Input validation: Content sanitization, fabrication detection, spam prevention
- ✅ Integrated ChatSidebar as floating button on optimization page

### Key Files Added (Feature 002)
- `src/lib/chat-manager/` - Chat processing library (ai-client, processor, session, versioning)
- `src/app/api/v1/chat/` - Chat API routes (7 endpoints)
- `src/components/chat/` - Chat UI components (4 components)
- `src/lib/supabase/chat-*.ts` - Database wrappers for chat entities
- `specs/002-when-user-optimized/` - Chat feature specification and planning docs

### Phase 1 Implementation (Completed)
- ✅ Feature specification completed (28 functional requirements)
- ✅ Data model designed (5 core entities with RLS)
- ✅ API contracts defined (OpenAPI 3.0 specification)
- ✅ Integration test scenarios documented

## Current Sprint Focus

### MVP Epic Priorities
1. **Resume Ingestion** - File upload, parsing, preview (FR-001 to FR-005)
2. **Job Description Processing** - Text/URL input, extraction (FR-006 to FR-009) 
3. **AI Optimization** - OpenAI integration, match scoring (FR-010 to FR-014)
4. **Template & Export** - ATS-safe template, PDF/DOCX generation (FR-015 to FR-019)
5. **User Management** - Auth, freemium model, paywall (FR-020 to FR-024)

### Next Actions
- Execute `/tasks` command to generate implementation tasks
- Begin TDD cycle: Contract tests → Integration tests → Implementation
- Focus on library development with CLI interfaces
- Maintain constitutional compliance (simplicity, testing-first, observability)

## Configuration Notes

### Environment Variables Required
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# OpenAI
OPENAI_API_KEY=

# Stripe (for payments)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

### Dependencies Status
- ✅ All core dependencies installed (Next.js, Supabase, OpenAI, pdf-parse, docx, puppeteer)
- ✅ TypeScript configuration complete
- ✅ Tailwind CSS configured with shadcn/ui
- 🔄 Database migrations pending
- 🔄 API route implementations pending

## Debug and Development

### Common Issues
- File parsing errors: Check pdf-parse compatibility with uploaded files
- OpenAI timeouts: Implement proper error handling and retries
- Supabase RLS: Ensure user context passed correctly in all queries
- Puppeteer PDF generation: Handle memory limits in serverless environment

### Testing Commands
```bash
npm run dev          # Development server
npm run test         # Run test suite
npm run build        # Production build
npm run lint         # ESLint check
```

---
*Updated: September 15, 2025 - Phase 1 Design Complete*

