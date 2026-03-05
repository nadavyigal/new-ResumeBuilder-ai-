
# Implementation Plan: AI Chat Resume Iteration

**Branch**: `002-when-user-optimized` | **Date**: 2025-10-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/002-when-user-optimized/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → ✅ Spec loaded from specs/002-when-user-optimized/spec.md
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detected web application type (Next.js frontend + backend)
   → AI model selection deferred to Phase 0 research
3. Fill the Constitution Check section based on the constitution document
   → ✅ Constitution Check completed below
4. Evaluate Constitution Check section below
   → ✅ PASS - All gates satisfied, no violations
   → Update Progress Tracking: Initial Constitution Check ✅
5. Execute Phase 0 → research.md
   → ✅ Research completed (see Phase 0 section)
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md
   → ✅ Design artifacts generated (see Phase 1 section)
7. Re-evaluate Constitution Check section
   → ✅ PASS - Post-design validation confirms compliance
   → Update Progress Tracking: Post-Design Constitution Check ✅
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
   → ✅ Task generation strategy documented (see Phase 2 section)
9. STOP - Ready for /tasks command
   → ✅ Plan complete, awaiting /tasks execution
```

**IMPORTANT**: The /plan command STOPS at step 9. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary

The AI Chat Resume Iteration feature adds conversational AI capabilities to the resume optimization workflow, enabling users to refine their optimized resumes through natural language requests. After receiving an AI-optimized resume, users can open a sidebar chat interface to request amendments like adding skills, rewording experiences, or adjusting formatting without manual editing or re-uploading.

**Technical Approach**: Implement as standalone library (`src/lib/chat-manager/`) with OpenAI integration for natural language processing, Supabase for chat persistence and resume versioning, and React components for the sidebar UI. Follow library-first architecture with CLI interface for testing and TDD methodology for all code.

## Technical Context
**Language/Version**: TypeScript 5.9.2, Next.js 15.5.2, React 19
**Primary Dependencies**: OpenAI SDK (GPT-4), Supabase client, React, Tailwind CSS 4, diff library (for change visualization)
**Storage**: Supabase PostgreSQL (chat sessions, messages, resume versions with RLS)
**Testing**: Vitest for unit/integration tests, React Testing Library for components, Playwright for E2E
**Target Platform**: Web (Next.js App Router), Vercel deployment
**Project Type**: Web application (Next.js frontend + API routes backend)
**Performance Goals**: 7-second chat response time, < 10 seconds for resume amendment application
**Constraints**: 30-day chat history retention, maintain factual accuracy (no fabrication), ATS-friendly resume output
**Scale/Scope**: Handle concurrent chat sessions per user, support multiple resume versions, 100+ messages per session

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Verify compliance with all constitutional principles from `.specify/memory/constitution.md`:

- [x] **Library-First**: Chat functionality designed as `src/lib/chat-manager/` library (not API-only)
- [x] **CLI Interface**: Library exposes CLI for testing chat processing (stdin/stdout protocol)
- [x] **TDD**: Test scenarios defined in Phase 1 (contract tests for chat API, integration tests for amendment flow)
- [x] **Integration Testing**: Chat-to-OpenAI, database persistence, resume versioning identified for testing
- [x] **Observability**: Structured logging for chat requests, AI calls, resume changes; error context included
- [x] **Versioning**: API endpoints follow `/api/v1/chat/*` pattern for future versioning
- [x] **Simplicity**: Direct OpenAI integration (no custom NLP), simple diff algorithm for change visualization

**Performance Verification**:
- [x] Response time targets defined (7s chat response, 10s amendment application)
- [x] Resource constraints identified (30-day retention, session concurrency limits)

**Initial Gate Status**: ✅ PASS - All constitutional principles satisfied, no complexity violations

## Project Structure

### Documentation (this feature)
```
specs/002-when-user-optimized/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
│   └── openapi.yaml     # Chat API contract
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Web application structure (Next.js)
resume-builder-ai/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── api/v1/chat/         # Chat API endpoints
│   │   │   ├── route.ts         # POST /api/v1/chat - send message
│   │   │   ├── sessions/
│   │   │   │   └── route.ts     # GET /api/v1/chat/sessions - list sessions
│   │   │   └── [sessionId]/
│   │   │       ├── route.ts     # GET /DELETE - session details/delete
│   │   │       └── messages/
│   │   │           └── route.ts # GET - message history
│   │   ├── dashboard/
│   │   │   └── resume/[id]/     # Resume view page with chat sidebar
│   │   │       └── page.tsx
│   │   └── ...
│   ├── components/              # React components
│   │   ├── chat/
│   │   │   ├── ChatSidebar.tsx  # Main chat interface
│   │   │   ├── ChatMessage.tsx  # Individual message
│   │   │   ├── ChatInput.tsx    # Message input field
│   │   │   └── ChangeDiff.tsx   # Resume change visualization
│   │   └── ...
│   ├── lib/                     # Core libraries (library-first)
│   │   ├── chat-manager/        # NEW: Chat processing library
│   │   │   ├── index.ts         # Public API
│   │   │   ├── cli.ts           # CLI interface for testing
│   │   │   ├── processor.ts     # Message processing logic
│   │   │   ├── ai-client.ts     # OpenAI integration
│   │   │   ├── session.ts       # Session management
│   │   │   └── versioning.ts    # Resume version tracking
│   │   ├── resume-parser/       # Existing from 001
│   │   ├── ai-optimizer/        # Existing from 001
│   │   └── ...
│   └── types/                   # TypeScript definitions
│       └── chat.ts              # Chat-related types
├── tests/
│   ├── contract/
│   │   └── chat-api.test.ts     # API contract tests
│   ├── integration/
│   │   ├── chat-flow.test.ts    # End-to-end chat scenarios
│   │   └── amendment.test.ts    # Resume amendment workflow
│   └── unit/
│       └── chat-manager/        # Library unit tests
│           ├── processor.test.ts
│           └── versioning.test.ts
└── supabase/
    └── migrations/
        └── 20251006_chat_schema.sql  # Chat tables migration
```

**Structure Decision**: Using existing Next.js web application structure. Chat functionality added as new library (`src/lib/chat-manager/`) following library-first principle, with API routes in `src/app/api/v1/chat/` and React components in `src/components/chat/`. Database schema additions via Supabase migrations.

## Phase 0: Outline & Research

### Research Questions
1. **AI Model Selection** - Same OpenAI model as optimization (GPT-4) or different (GPT-3.5-turbo for cost)?
2. **Diff Algorithm** - Best library for resume change visualization (diff-match-patch, react-diff-viewer, custom)?
3. **Real-time Updates** - WebSocket for live resume updates or polling?
4. **Session Management** - How to handle concurrent chat sessions on multiple resumes?
5. **Chat History Search** - Index messages for search or simple chronological display?

### Research Findings

#### Decision 1: AI Model Selection
**Chosen**: GPT-4 (same as optimization for consistency)
**Rationale**:
- Consistency in resume quality and tone across optimization and chat amendments
- Better understanding of complex amendment requests (e.g., "make more leadership-focused")
- Higher accuracy in maintaining factual boundaries (prevents fabrication)
- Cost acceptable given freemium model limits usage

**Alternatives Considered**:
- GPT-3.5-turbo: Lower cost but less accurate for nuanced resume modifications, higher risk of tone inconsistencies

#### Decision 2: Diff Algorithm
**Chosen**: react-diff-viewer + diff-match-patch
**Rationale**:
- react-diff-viewer provides ready-made React component with line-by-line visualization
- diff-match-patch algorithm optimized for text comparison
- Built-in styling for additions (green), deletions (red), modifications (yellow)
- Accessible keyboard navigation support

**Alternatives Considered**:
- Custom diff: Reinventing wheel, violates YAGNI principle
- Simple highlight: Doesn't show removed content clearly

#### Decision 3: Real-time Updates
**Chosen**: Server-sent events (SSE) for AI streaming, React state for UI updates
**Rationale**:
- SSE simpler than WebSockets for one-way server-to-client streaming
- OpenAI SDK supports streaming responses natively
- React state sufficient for local resume preview updates
- No need for bidirectional communication

**Alternatives Considered**:
- WebSockets: Overcomplicated for one-way streaming, harder to deploy on Vercel
- Polling: Poor UX, unnecessary server load

#### Decision 4: Session Management
**Chosen**: One active session per optimization_id, stored in Supabase with user_id + optimization_id unique constraint
**Rationale**:
- Natural boundary: one conversation per resume optimization
- Database enforces single active session per resume
- User can have multiple sessions across different resumes (tracked by optimization_id)

**Alternatives Considered**:
- Multiple sessions per resume: Confusing UX, unclear which session applies changes
- Global single session: Can't refine multiple resumes in parallel

#### Decision 5: Chat History Search
**Chosen**: Chronological display only (no search in MVP)
**Rationale**:
- YAGNI: No user story requires searching old messages
- 30-day retention limits history size
- Sessions tied to specific resume, naturally scoped
- Can add Postgres full-text search later if needed

**Alternatives Considered**:
- Full-text search: Premature optimization, adds complexity

**Output**: All research decisions documented above, no remaining NEEDS CLARIFICATION blockers

## Phase 1: Design & Contracts

### Data Model

**See `data-model.md` for complete entity definitions**

#### New Entities
1. **chat_sessions** table
   - Links to optimizations.id (parent resume optimization)
   - Tracks active/closed status, last_activity for 30-day retention
   - Unique constraint on (user_id, optimization_id) for single session per resume

2. **chat_messages** table
   - Links to chat_sessions.id
   - Stores sender (user/ai), message text, timestamps
   - Optional metadata JSONB (amendment_type, section_affected)

3. **resume_versions** table (extension of existing resumes table concept)
   - Links to chat_sessions.id for traceability
   - Stores version_number, change_summary
   - Full resume content snapshot for undo capability

4. **amendment_requests** table
   - Extracted structured data from chat messages
   - Categorized by type (add, modify, remove)
   - Processing status tracking (pending, applied, rejected)

### API Contracts

**See `contracts/openapi.yaml` for complete OpenAPI 3.0 specification**

#### Endpoints
- `POST /api/v1/chat` - Send message, receive AI response
- `GET /api/v1/chat/sessions` - List user's chat sessions
- `GET /api/v1/chat/sessions/{id}` - Get session details and messages
- `DELETE /api/v1/chat/sessions/{id}` - Delete session before 30-day expiry
- `GET /api/v1/chat/sessions/{id}/messages` - Paginated message history
- `POST /api/v1/chat/sessions/{id}/apply` - Apply amendment to resume
- `POST /api/v1/chat/sessions/{id}/preview` - Preview amendment without applying

### Contract Tests

Generated in Phase 1, located in `tests/contract/chat-api.test.ts`:
- Schema validation for all endpoints
- Authentication/authorization checks (RLS enforcement)
- Error response formats (400, 401, 403, 404, 500)
- Rate limiting behavior (if applicable)

### Integration Test Scenarios

**See `quickstart.md` for manual testing scenarios**

#### Automated Integration Tests (`tests/integration/`)
1. **Chat Flow Test**: User opens chat → sends message → receives AI response → sees message history
2. **Amendment Test**: User requests skill addition → previews change → applies → verifies new resume version
3. **Undo Test**: User applies amendment → uses undo → resumes reverts to previous version
4. **Session Persistence**: User closes chat → reopens → conversation history preserved
5. **30-Day Retention**: Simulate old session → verify auto-deletion logic
6. **Fabrication Prevention**: User requests fabricated experience → AI declines with explanation

### Agent Context Update

**Update CLAUDE.md** with chat feature context:
- Add chat-manager library to Core Architecture section
- Document new API endpoints
- Update Recent Changes section
- Add chat session management to Key Business Rules
- Include 7-second response time in Performance Targets

Incremental update preserves existing content, adds only new information about chat feature.

**Output**:
- ✅ data-model.md created with 4 new entities
- ✅ contracts/openapi.yaml created with 7 endpoints
- ✅ Contract tests generated (failing as expected - TDD red phase)
- ✅ quickstart.md created with 6 test scenarios
- ✅ CLAUDE.md updated incrementally

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
1. Load `.specify/templates/tasks-template.md` as base template
2. Generate tasks from Phase 1 design artifacts:
   - Each OpenAPI endpoint → contract test task [P]
   - Each entity in data-model.md → migration + model creation task [P]
   - Each integration scenario in quickstart.md → integration test task [P]
   - Implementation tasks to make tests pass (TDD green phase)
3. Library tasks for `src/lib/chat-manager/`:
   - CLI interface for standalone testing
   - Message processor with OpenAI integration
   - Session management logic
   - Resume versioning system
4. UI component tasks:
   - ChatSidebar.tsx with open/close state management
   - ChatMessage.tsx with sender differentiation
   - ChatInput.tsx with loading states
   - ChangeDiff.tsx with react-diff-viewer integration
5. API route implementation tasks (after tests written)

**Ordering Strategy**:
- **TDD Order**: Tests before implementation (contract → integration → unit → implementation)
- **Dependency Order**:
  - Database migrations before models
  - Models before services
  - Services before API routes
  - API routes before UI components
- **Mark [P] for parallel execution**: Independent test files, different entities, separate UI components

**Estimated Output**: 35-40 numbered, dependency-ordered tasks in tasks.md

**Categories**:
- Phase 3.1 Setup: Database migrations, library scaffolding (5 tasks)
- Phase 3.2 Tests First: Contract tests, integration tests, unit test stubs (12 tasks) [MUST FAIL]
- Phase 3.3 Core Implementation: chat-manager library, session management (10 tasks)
- Phase 3.4 Integration: API routes, database queries, OpenAI calls (8 tasks)
- Phase 3.5 Polish: UI components, error handling, performance optimization (8 tasks)

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles, TDD red-green-refactor)
**Phase 5**: Validation (run contract tests, integration tests, execute quickstart.md manual scenarios, verify performance targets)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

**No violations detected** - Feature design fully complies with all constitutional principles:
- Library-first architecture maintained
- CLI interface planned for chat-manager library
- TDD enforced with test-first approach
- Integration testing identified for all boundaries
- Observability through structured logging
- API versioning strategy defined
- Simplicity maintained (direct OpenAI integration, no custom NLP)

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning approach described (/plan command)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved (AI model selection → GPT-4)
- [x] Complexity deviations documented (none - no violations)

**Artifact Generation**:
- [x] research.md - Phase 0 decisions documented
- [x] data-model.md - 4 new entities defined
- [x] contracts/openapi.yaml - 7 endpoints specified
- [x] quickstart.md - 6 test scenarios created
- [x] CLAUDE.md - Updated with chat feature context
- [ ] tasks.md - Awaiting /tasks command execution

---
*Based on Constitution v1.0.0 - See `.specify/memory/constitution.md`*
