# Implementation Plan: AI Resume Optimizer

**Branch**: `001-ai-resume-optimizer` | **Date**: September 15, 2025 | **Spec**: [specs/001-ai-resume-optimizer/spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-ai-resume-optimizer/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → ✅ Feature spec loaded successfully
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Project Type: Web application (Next.js 15.5.2 with TypeScript)
   → Structure Decision: Option 2 - Web application (frontend + backend integrated)
3. Evaluate Constitution Check section below
   → ✅ Simplicity principles followed
   → ✅ Architecture aligned with library-first approach
4. Execute Phase 0 → research.md
   → ✅ All technical decisions resolved from existing architecture docs
5. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md
   → ✅ Complete design artifacts generated
6. Re-evaluate Constitution Check section
   → ✅ No violations detected in final design
7. Plan Phase 2 → Task generation approach described
8. ✅ COMPLETE - Ready for /tasks command
```

## Summary
AI Resume Optimizer is a comprehensive web application enabling job seekers to upload resumes and job descriptions, receive AI-powered optimization suggestions, and download ATS-friendly, professionally designed resumes. **Current focus: Epic 1: Resume Ingestion** - implementing file upload, parsing, and preview functionality as the foundational feature. The technical approach leverages Next.js 15 with TypeScript, Supabase for backend services, OpenAI for AI optimization, and supports both PDF and Word export formats.

## Technical Context
**Language/Version**: TypeScript 5.9.2, Node.js (via Next.js 15.5.2)  
**Primary Dependencies**: Next.js, React 19, Supabase (auth/DB), OpenAI API, PDF-parse, DOCX, Puppeteer  
**Storage**: Supabase PostgreSQL with RLS, Supabase Storage for files  
**Testing**: Next.js testing framework, Jest (implied), Playwright for E2E  
**Target Platform**: Web application (desktop/mobile responsive), deployed on Vercel  
**Project Type**: Web - Next.js full-stack application (frontend + API routes)  
**Performance Goals**: <20s AI optimization, <2s file upload, <5s export generation  
**Constraints**: 10MB file limit, ATS-compatible output, truthful optimization only  
**Scale/Scope**: 10k+ users, freemium model, 6 core epics, 28 functional requirements

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**:
- Projects: 1 (Next.js full-stack app - frontend/backend integrated)
- Using framework directly? ✅ (Next.js Route Handlers, React components)
- Single data model? ✅ (Supabase schema with clear entity relationships)
- Avoiding patterns? ✅ (Direct Supabase client, no Repository/UoW overhead)

**Architecture**:
- EVERY feature as library? ✅ Libraries planned:
  - `resume-parser` - PDF/DOCX parsing + text extraction
  - `job-description-extractor` - URL scraping + text cleaning  
  - `ai-optimizer` - OpenAI integration + prompt management
  - `template-engine` - Resume rendering + export generation
  - `auth-manager` - Supabase auth + subscription handling
- CLI per library: ✅ Commands planned with --help/--version/--format
- Library docs: ✅ llms.txt format planned for each library

**Testing (NON-NEGOTIABLE)**:
- RED-GREEN-Refactor cycle enforced? ✅ (contract tests first, then implementation)
- Git commits show tests before implementation? ✅ (planned workflow)
- Order: Contract→Integration→E2E→Unit strictly followed? ✅ 
- Real dependencies used? ✅ (actual Supabase, OpenAI API in integration tests)
- Integration tests for: ✅ New libraries, API contracts, file processing, AI optimization
- FORBIDDEN: ✅ No implementation before tests

**Observability**:
- Structured logging included? ✅ (console.log structured JSON, Next.js logging)
- Frontend logs → backend? ✅ (error tracking via API routes)
- Error context sufficient? ✅ (file names, user IDs, operation types)

**Versioning**:
- Version number assigned? ✅ (0.1.0 from package.json → 1.0.0 for MVP)
- BUILD increments on every change? ✅ (automated via CI/CD)
- Breaking changes handled? ✅ (Supabase migrations, API versioning)

## Project Structure

### Documentation (this feature)
```
specs/001-ai-resume-optimizer/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Option 2: Web application (Next.js full-stack)
resume-builder-ai/
├── src/
│   ├── app/                 # Next.js 15 App Router
│   │   ├── api/            # API routes (backend)
│   │   ├── dashboard/      # Protected user pages
│   │   ├── auth/          # Authentication pages
│   │   └── page.tsx       # Landing page
│   ├── components/         # React components
│   │   ├── ui/            # shadcn/ui components
│   │   ├── auth/          # Auth-related components
│   │   ├── templates/     # Resume templates
│   │   └── layout/        # Layout components
│   ├── lib/               # Core libraries
│   │   ├── resume-parser/
│   │   ├── ai-optimizer/
│   │   ├── template-engine/
│   │   └── utils/
│   └── types/             # TypeScript definitions
└── tests/
    ├── contract/          # API contract tests
    ├── integration/       # Feature integration tests
    └── unit/             # Library unit tests
```

**Structure Decision**: Option 2 - Web application (Next.js integrates frontend + backend)

## Phase 0: Outline & Research
*✅ COMPLETE*

### Research Findings

**Decision**: Next.js 15 full-stack architecture with TypeScript
**Rationale**: 
- Existing codebase already established with Next.js 15.5.2
- App Router provides modern file-based routing
- API Routes eliminate need for separate backend
- TypeScript ensures type safety across full stack
**Alternatives considered**: Separate Express backend (rejected - adds complexity)

**Decision**: Supabase for backend services (auth, database, storage)
**Rationale**:
- Already configured in existing project
- PostgreSQL with RLS provides security
- Built-in auth with social providers
- Storage for file uploads
**Alternatives considered**: Firebase (rejected - already committed to Supabase)

**Decision**: OpenAI GPT-4 for resume optimization
**Rationale**:
- High-quality text generation and analysis
- Existing integration in codebase
- Reliable API with good documentation
**Alternatives considered**: Claude, local LLMs (rejected - OpenAI already integrated)

**Decision**: PDF-parse + DOCX libraries for file processing
**Rationale**:
- Already in dependencies
- Pure JavaScript implementations
- Good reliability for common resume formats
**Alternatives considered**: External OCR services (rejected - adds latency/cost)

**Decision**: Puppeteer for PDF generation
**Rationale**:
- Already in dependencies  
- High-quality PDF output from HTML
- Consistent cross-platform rendering
**Alternatives considered**: jsPDF (rejected - limited styling), server-side libraries (rejected - deployment complexity)

## Phase 1: Design & Contracts
*✅ COMPLETE*

All design artifacts have been generated:
- ✅ data-model.md - Complete database schema and entity relationships
- ✅ contracts/ - OpenAPI specifications for all API endpoints
- ✅ quickstart.md - User story validation scenarios  
- ✅ CLAUDE.md - AI assistant context file updated

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `/templates/tasks-template.md` as base structure
- **PRIORITY: Epic 1 Resume Ingestion tasks first** (FR-001 to FR-005)
- Generate tasks from Phase 1 design artifacts (28 functional requirements)
- Each API contract → contract test task [P] (6 endpoints)
- Each library → CLI + tests (5 libraries)
- Each user story → integration test (6 scenarios)
- Implementation tasks to make tests pass

**Ordering Strategy**:
- TDD order: Contract tests → Integration tests → Implementation
- Dependency order: Libraries → API routes → UI components
- **Epic 1 Critical Path**: Resume parser library → Upload API → File preview UI
- Epic 1 requirements (FR-001 to FR-005) implemented before other epics
- Mark [P] for parallel execution (independent libraries/components)

**Estimated Output**: 35-40 numbered, ordered tasks in tasks.md covering:
1. **Epic 1 Priority**: Resume Ingestion (8-10 tasks first)
   - Resume parser library + CLI + tests
   - Upload API contract tests
   - File preview UI components
   - Integration scenarios for FR-001 to FR-005
2. Contract tests (6 tasks total)
3. Library development (15 tasks - 3 per library)
4. Integration tests (6 tasks)
5. UI implementation (12 tasks)
6. E2E scenarios (6 tasks)

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*No constitutional violations detected - all simplicity principles followed*

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none required)

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*