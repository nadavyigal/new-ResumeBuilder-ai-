# Implementation Plan: AI Resume Assistant

**Branch**: `006-ai-resume-assistant` | **Date**: 2025-10-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-ai-resume-assistant/spec.md`

## Summary

Feature 006 (AI Resume Assistant) is **an integration project**, not a greenfield build. Research shows that **80% of required functionality already exists** in Features 002 (Chat Resume Iteration), 003 (Design Selection & Customization), and 005 (History View - Previous Optimizations).

**Primary Work**: Unified UI components + enhanced AI prompts + minor enhancements
**Estimated Effort**: 1-2 weeks (vs. 4-6 weeks if built from scratch)

**Key Finding**: All database tables, API endpoints, and business logic already exist. The work involves:
1. Building a unified "AI Assistant" sidebar that combines chat (content) and design (visual) panels
2. Enhancing OpenAI prompts for more conversational, supportive tone
3. Adding minor features like duplicate application detection
4. Comprehensive E2E testing for the integrated experience

---

## Technical Context

**Language/Version**: TypeScript 5.x with Next.js 14 (App Router)
**Primary Dependencies**:
- Next.js 14 (App Router, Server Components)
- React 18
- shadcn/ui (component library)
- Tailwind CSS
- Supabase Client (PostgreSQL + Auth + Storage)
- OpenAI SDK (GPT-4 for chat and design recommendations)

**Storage**: Supabase PostgreSQL with Row Level Security (RLS)
**Testing**: Vitest (unit), Playwright (E2E), Contract tests (existing)
**Target Platform**: Web (responsive design for desktop + mobile)
**Project Type**: Web application (Next.js frontend + API routes backend)

**Performance Goals**:
- Chat response time: <3s (p95)
- Design preview rendering: <2s (p95)
- Full optimization session: <10 minutes (SC-001)

**Constraints**:
- Must reuse existing APIs (no breaking changes)
- Must maintain truthfulness (no AI fabrication - SC-006)
- Must support freemium model (1 optimization free, unlimited premium)
- OpenAI rate limits: ~3500 requests/min (sufficient for MVP)

**Scale/Scope**:
- Target: 10k users in first 6 months
- Expected usage: ~100 chat messages/day, ~50 design changes/day
- Database: Existing schema handles millions of records (proven in Features 002/003)

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Constitution File**: `.specify/memory/constitution.md` (template placeholder - no strict rules enforced)

**Architectural Principles** (project conventions from CLAUDE.md):
1. ✅ **Library-First Architecture**: All features implemented as standalone libraries in `src/lib/` before API integration
   - **Status**: Feature 002 (`chat-manager/`) and Feature 003 (`design-manager/`) already follow this
   - **Compliance**: ✅ Existing libraries will be reused
2. ✅ **Test-Driven Development (TDD)**: Contract tests → Integration tests → Implementation
   - **Status**: Feature 002 and 003 have comprehensive tests
   - **Compliance**: ✅ Will add E2E tests for integrated experience
3. ✅ **API Versioning**: All new endpoints under `/api/v1/` namespace
   - **Status**: Existing endpoints already versioned
   - **Compliance**: ✅ No new endpoints needed
4. ✅ **Row Level Security (RLS)**: All Supabase queries respect user permissions
   - **Status**: All tables have RLS policies
   - **Compliance**: ✅ No new tables, existing RLS applies

**Violations**: None - Feature 006 reuses existing, compliant infrastructure.

---

## Project Structure

### Documentation (this feature)

```
specs/006-ai-resume-assistant/
├── plan.md              # This file
├── spec.md              # Feature specification (user stories)
├── research.md          # Research findings (shows 80% exists)
├── data-model.md        # Entity relationships (existing schema)
├── quickstart.md        # 1-2 week integration guide
└── contracts/           # API contract documentation
    └── api-ai-assistant.md  # Chat + Design + Application endpoints
```

### Source Code (repository root)

**Web Application Structure (Next.js App Router)**:

```
resume-builder-ai/
├── src/
│   ├── app/                         # Next.js App Router pages
│   │   ├── api/                     # API routes
│   │   │   ├── v1/                  # Versioned API
│   │   │   │   ├── chat/           # Chat endpoints (EXISTING - Feature 002)
│   │   │   │   │   ├── route.ts             # POST /api/v1/chat
│   │   │   │   │   └── sessions/
│   │   │   │   │       ├── route.ts         # GET /api/v1/chat/sessions
│   │   │   │   │       └── [id]/
│   │   │   │   │           ├── route.ts     # GET/DELETE /api/v1/chat/sessions/:id
│   │   │   │   │           ├── messages/    # Message history
│   │   │   │   │           ├── apply/       # Apply amendment
│   │   │   │   │           └── preview/     # Preview changes
│   │   │   │   └── design/         # Design endpoints (EXISTING - Feature 003)
│   │   │   │       ├── templates/
│   │   │   │       │   ├── route.ts         # GET /api/v1/design/templates
│   │   │   │       │   └── [id]/
│   │   │   │       │       └── preview/     # Preview template
│   │   │   │       ├── recommend/           # AI recommendation
│   │   │   │       └── [optimizationId]/
│   │   │   │           ├── route.ts         # GET/PUT design assignment
│   │   │   │           ├── customize/       # AI customization
│   │   │   │           ├── undo/            # Undo last change
│   │   │   │           └── revert/          # Revert to template
│   │   │   ├── optimizations/      # History endpoints (EXISTING - Feature 005)
│   │   │   │   ├── route.ts                 # GET /api/optimizations
│   │   │   │   ├── bulk/                    # Bulk delete
│   │   │   │   └── export/                  # Bulk export
│   │   │   └── applications/       # Application tracking (EXISTING - Feature 005)
│   │   │       └── route.ts                 # POST /api/applications
│   │   ├── dashboard/               # Main application
│   │   │   ├── optimizations/
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx    # **ADD AI Assistant button here (NEW)**
│   │   │   └── history/
│   │   │       └── page.tsx        # History view (EXISTING - Feature 005)
│   │   └── globals.css
│   ├── components/                  # React components
│   │   ├── ai-assistant/           # **NEW - AI Assistant UI**
│   │   │   ├── AIAssistantSidebar.tsx   # Main sidebar (NEW)
│   │   │   ├── ChatPanel.tsx            # Content editing panel (NEW)
│   │   │   ├── DesignPanel.tsx          # Visual customization panel (NEW)
│   │   │   └── index.ts
│   │   ├── chat/                   # EXISTING - Feature 002 components
│   │   ├── design/                 # EXISTING - Feature 003 components
│   │   ├── history/                # EXISTING - Feature 005 components
│   │   └── ui/                     # shadcn/ui components (EXISTING)
│   ├── hooks/
│   │   ├── useChatSession.ts       # **NEW - Hook for chat API**
│   │   ├── useDesignCustomization.ts # **NEW - Hook for design API**
│   │   └── useOptimizations.ts     # EXISTING - Feature 005
│   ├── lib/                        # Utilities and configurations
│   │   ├── chat-manager/           # EXISTING - Feature 002 library
│   │   │   ├── processor.ts                 # Amendment processing
│   │   │   ├── ai-client.ts                 # OpenAI integration
│   │   │   ├── session.ts                   # Session management
│   │   │   └── versioning.ts                # Resume version control
│   │   ├── design-manager/         # EXISTING - Feature 003 library
│   │   │   ├── customization-engine.ts      # Apply design modifications
│   │   │   ├── design-recommender.ts        # AI template recommendation
│   │   │   └── ats-validator.ts             # Validate ATS compliance
│   │   ├── prompts/
│   │   │   └── resume-optimizer.ts # **UPDATE - Enhanced conversational prompts**
│   │   ├── supabase/               # EXISTING - Database wrappers
│   │   │   ├── chat-sessions.ts
│   │   │   ├── chat-messages.ts
│   │   │   ├── resume-versions.ts
│   │   │   └── amendment-requests.ts
│   │   └── utils/                  # Utilities
│   │       └── rate-limit.ts       # EXISTING - Feature 005
│   └── types/
│       ├── chat.ts                 # EXISTING - Feature 002 types
│       ├── design.ts               # EXISTING - Feature 003 types (if exists)
│       └── history.ts              # EXISTING - Feature 005 types
├── tests/
│   ├── e2e/
│   │   └── ai-assistant/           # **NEW - E2E tests**
│   │       ├── full-flow.spec.ts            # Complete user journey
│   │       ├── chat-panel.spec.ts           # Chat functionality
│   │       └── design-panel.spec.ts         # Design functionality
│   ├── integration/                # EXISTING - Feature 002/003 tests
│   ├── unit/                       # EXISTING - Feature 002/003 tests
│   └── contract/                   # EXISTING - Feature 002/003 tests
└── supabase/
    └── migrations/                 # EXISTING - All tables already created
        ├── 20251006104316_chat_schema.sql           # Feature 002
        ├── 20251008_add_design_tables.sql           # Feature 003
        └── 20251014000000_add_applications_table.sql # Feature 005
```

**Structure Decision**:
Web application structure selected based on existing Next.js App Router setup. The project follows a feature-based organization where:
- **Backend**: API routes in `src/app/api/v1/` (already versioned)
- **Frontend**: Components in `src/components/` organized by feature
- **Business Logic**: Standalone libraries in `src/lib/` (Library-First Architecture)
- **Database**: Supabase migrations in `supabase/migrations/`

**NEW files for Feature 006**: ~8 files (3 React components + 2 hooks + 3 test files + prompt updates)
**REUSED files**: ~40+ files (all backend logic, database schema, existing components)

---

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

**No violations** - Feature 006 reuses existing, compliant architecture. No new complexity introduced.

---

## Architecture Overview

### High-Level Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                   User Interface (Next.js)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │       Optimization Detail Page                           │  │
│  │       /dashboard/optimizations/[id]                      │  │
│  │                                                          │  │
│  │  ┌────────────────┐                                     │  │
│  │  │  Resume Preview│                                     │  │
│  │  │                │        ┌──────────────────────────┐ │  │
│  │  │  (existing)    │        │  AI Assistant Sidebar    │ │  │
│  │  │                │        │  (NEW)                   │ │  │
│  │  │                │        │                          │ │  │
│  │  └────────────────┘        │  ┌────────────────────┐  │ │  │
│  │                            │  │   Content Tab      │  │ │  │
│  │  ┌────────────────┐        │  │   (ChatPanel)      │  │ │  │
│  │  │ [Open AI       │        │  │                    │  │ │  │
│  │  │  Assistant]    │────────┼─>│  - Message history │  │ │  │
│  │  └────────────────┘        │  │  - Input field     │  │ │  │
│  │                            │  │  - Send button     │  │ │  │
│  │                            │  └────────────────────┘  │ │  │
│  │                            │                          │ │  │
│  │                            │  ┌────────────────────┐  │ │  │
│  │                            │  │   Design Tab       │  │ │  │
│  │                            │  │   (DesignPanel)    │  │ │  │
│  │                            │  │                    │  │ │  │
│  │                            │  │  - Template select │  │ │  │
│  │                            │  │  - NL input        │  │ │  │
│  │                            │  │  - Suggestions     │  │ │  │
│  │                            │  └────────────────────┘  │ │  │
│  │                            └──────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                             │
                             │ API Calls
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│               API Layer (Next.js Route Handlers)                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  /api/v1/chat/*           /api/v1/design/*    /api/applications│
│  (EXISTING - Feature 002) (EXISTING - F003)   (EXISTING - F005)│
│                                                                 │
│  ┌─────────────────────┐  ┌─────────────────┐  ┌─────────────┐│
│  │ POST /chat          │  │ GET /templates  │  │ POST /apps  ││
│  │ GET /sessions       │  │ GET /preview    │  │ GET /apps   ││
│  │ POST /apply         │  │ POST /customize │  └─────────────┘│
│  │ POST /preview       │  │ POST /undo      │                 │
│  └─────────────────────┘  └─────────────────┘                 │
│           │                        │                           │
│           ▼                        ▼                           │
│  ┌─────────────────────┐  ┌─────────────────┐                 │
│  │  chat-manager lib   │  │ design-manager  │                 │
│  │  (EXISTING)         │  │ lib (EXISTING)  │                 │
│  │                     │  │                 │                 │
│  │ - processor.ts      │  │ - customization │                 │
│  │ - ai-client.ts      │  │   -engine.ts    │                 │
│  │ - session.ts        │  │ - design-       │                 │
│  │ - versioning.ts     │  │   recommender.ts│                 │
│  └─────────────────────┘  └─────────────────┘                 │
│           │                        │                           │
│           └────────────┬───────────┘                           │
│                        │                                       │
│                        ▼                                       │
│           ┌────────────────────────┐                           │
│           │   OpenAI API (GPT-4)   │                           │
│           └────────────────────────┘                           │
│                        │                                       │
└────────────────────────┼───────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              Data Layer (Supabase PostgreSQL)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │chat_sessions │  │design_       │  │applications  │          │
│  │chat_messages │  │templates     │  │              │          │
│  │resume_       │  │design_       │  └──────────────┘          │
│  │versions      │  │customizations│                            │
│  │amendment_    │  │resume_design_│                            │
│  │requests      │  │assignments   │                            │
│  └──────────────┘  └──────────────┘                            │
│                                                                 │
│  (ALL TABLES EXIST - Features 002, 003, 005)                   │
│  (RLS Policies Enforce User Isolation)                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Strategy

### Phase 0: Research ✅ **COMPLETE**

**Duration**: Completed 2025-10-15

**Deliverables**:
- ✅ `research.md` - Documents that 80% of functionality already exists
- ✅ Analysis of Features 002, 003, 005 (chat, design, history)
- ✅ Gap analysis: identified missing features (duplicate detection, enhanced prompts, UI integration)

**Key Findings**:
- All database tables exist (`chat_sessions`, `chat_messages`, `resume_versions`, `amendment_requests`, `design_templates`, `design_customizations`, `resume_design_assignments`, `applications`)
- All API endpoints operational (`/api/v1/chat`, `/api/v1/design`, `/api/applications`)
- All business logic libraries exist (`src/lib/chat-manager/`, `src/lib/design-manager/`)

---

### Phase 1: Design ✅ **COMPLETE**

**Duration**: Completed 2025-10-15

**Deliverables**:
- ✅ `data-model.md` - Documents existing entity relationships
- ✅ `contracts/api-ai-assistant.md` - API contract reference for existing endpoints
- ✅ `quickstart.md` - 1-2 week integration guide

**Artifacts Generated**:
- Data model with ER diagram
- API contracts for 15+ endpoints (all existing)
- Quickstart with 4-hour MVP guide

---

### Phase 2: UI Integration (Week 1 - Days 1-5)

**Duration**: 5 days

**Goal**: Build unified AI Assistant interface combining chat and design panels

#### Day 1-2: Core Components

**Tasks**:
1. Create `AIAssistantSidebar.tsx`
   - Sidebar container with tabs (Content + Design)
   - Header with close button
   - Tab switching logic
   - Responsive layout (collapsible on mobile)

2. Create `ChatPanel.tsx`
   - Message history display with scroll
   - User/AI message bubbles
   - Input field with send button
   - Empty state with example prompts
   - Loading states
   - Error handling

3. Create `DesignPanel.tsx`
   - Current template display
   - Natural language input field
   - Suggestion buttons
   - Loading states
   - Success/error toasts

**Acceptance Criteria**:
- ✅ Sidebar opens/closes smoothly
- ✅ Tabs switch without errors
- ✅ All components render correctly
- ✅ Responsive design works on mobile

**Files Created**:
- `src/components/ai-assistant/AIAssistantSidebar.tsx`
- `src/components/ai-assistant/ChatPanel.tsx`
- `src/components/ai-assistant/DesignPanel.tsx`
- `src/components/ai-assistant/index.ts`

---

#### Day 3: API Integration

**Tasks**:
1. Create `useChatSession` hook
   - Fetch/create chat session
   - Send messages to `/api/v1/chat`
   - Handle responses (AI message + amendments)
   - Manage loading/error states
   - Cache with React Query

2. Create `useDesignCustomization` hook
   - Fetch current design assignment
   - Send customization requests to `/api/v1/design/[id]/customize`
   - Handle responses (success + warnings)
   - Manage loading/error states
   - Cache with React Query

3. Wire up components to hooks
   - Connect `ChatPanel` to `useChatSession`
   - Connect `DesignPanel` to `useDesignCustomization`
   - Handle errors gracefully
   - Show loading states

**Acceptance Criteria**:
- ✅ Chat messages send successfully
- ✅ AI responses appear within 3s
- ✅ Design customizations apply correctly
- ✅ Errors show user-friendly messages

**Files Created**:
- `src/hooks/useChatSession.ts`
- `src/hooks/useDesignCustomization.ts`

---

#### Day 4: Enhanced Prompts

**Tasks**:
1. Update `src/lib/prompts/resume-optimizer.ts`
   - Change tone from functional to conversational
   - Add encouraging language ("Let's make this bullet pop!")
   - Structure prompts for clarity
   - Version prompts (v1_functional, v2_conversational)

2. Add clarifying question logic
   - Detect vague requests ("make it better")
   - Return clarifying questions in AI response
   - Set `requires_clarification: true` flag
   - Handle follow-up clarifications

3. Test prompt changes
   - Run existing integration tests
   - Manually test 10 common requests
   - Verify no regressions
   - Deploy to staging with v2

**Acceptance Criteria**:
- ✅ AI responses feel conversational
- ✅ Clarifying questions appear when request is vague
- ✅ Existing tests still pass
- ✅ No fabrication in responses

**Files Modified**:
- `src/lib/prompts/resume-optimizer.ts`
- `src/lib/chat-manager/processor.ts` (add clarifying question logic)

---

#### Day 5: Duplicate Detection

**Tasks**:
1. Add duplicate check to `POST /api/applications`
   - Query `applications` table for matching (user_id, job_title, company, DATE(applied_date))
   - If duplicate found, return 409 with `confirm_required: true`
   - If `?confirm=true` query param, bypass check and create
   - Return helpful error message

2. Add confirmation dialog in UI
   - Show modal when 409 received
   - Display duplicate warning message
   - "Cancel" or "Proceed Anyway" buttons
   - Retry with `?confirm=true` on proceed

**Acceptance Criteria**:
- ✅ Duplicate detection works correctly
- ✅ User can confirm and proceed
- ✅ No duplicates created without confirmation

**Files Modified**:
- `src/app/api/applications/route.ts`
- Component calling `/api/applications` (likely in history or optimization detail page)

---

### Phase 3: Testing & Polish (Week 2 - Days 6-10)

**Duration**: 5 days

#### Day 6-7: E2E Tests

**Tasks**:
1. Write full flow test
   - Upload resume and job description
   - Open AI Assistant
   - Send chat message → verify AI response
   - Apply content change → verify preview updates
   - Switch to design tab
   - Request design change → verify preview updates
   - Close AI Assistant
   - Download PDF → verify changes persisted

2. Write chat panel tests
   - Send various message types (clear, vague, complex)
   - Verify AI responses are conversational
   - Verify clarifying questions appear correctly
   - Verify error handling

3. Write design panel tests
   - Request various design changes (color, font, layout)
   - Verify changes apply correctly
   - Verify ATS warnings appear when needed
   - Verify undo/revert functionality

**Acceptance Criteria**:
- ✅ All E2E tests pass
- ✅ Full flow completes in <10 minutes
- ✅ No errors in console
- ✅ Performance targets met

**Files Created**:
- `tests/e2e/ai-assistant/full-flow.spec.ts`
- `tests/e2e/ai-assistant/chat-panel.spec.ts`
- `tests/e2e/ai-assistant/design-panel.spec.ts`

---

#### Day 8-9: UI Polish

**Tasks**:
1. Responsive design
   - Test on mobile (360px, 768px, 1024px)
   - Collapsible sidebar on small screens
   - Touch-friendly buttons (44px min)
   - Horizontal scroll for long messages

2. Loading states
   - Skeleton screens while loading
   - Progress indicators for chat/design requests
   - Disable inputs during processing
   - Optimistic updates where possible

3. Error handling
   - User-friendly error messages
   - Retry buttons for failed requests
   - Network error detection
   - Rate limit warnings

4. Accessibility
   - Keyboard navigation (Tab, Enter, Esc)
   - ARIA labels on interactive elements
   - Screen reader support
   - Focus indicators
   - Color contrast (WCAG AA)

**Acceptance Criteria**:
- ✅ Works on mobile and desktop
- ✅ Loading states are clear
- ✅ Errors are user-friendly
- ✅ Accessible to screen readers

**Files Modified**: All components in `src/components/ai-assistant/`

---

#### Day 10: Documentation & Deployment

**Tasks**:
1. Update CLAUDE.md
   - Add AI Assistant feature description
   - Document new components and hooks
   - Update directory structure
   - Add development patterns

2. Add inline comments
   - Document prompt logic
   - Explain complex state management
   - Add JSDoc comments to hooks

3. Create user guide
   - Help tooltip in AI Assistant
   - Example prompts
   - Troubleshooting tips

4. Deploy to staging
   - Run full test suite
   - Deploy with feature flag
   - Monitor for errors
   - Gather feedback from team

5. Deploy to production
   - Enable for 10% of users
   - Monitor success criteria
   - Roll out to 50%, then 100%
   - Announce feature

**Acceptance Criteria**:
- ✅ Documentation updated
- ✅ User guide available
- ✅ Deployed to production
- ✅ No critical bugs

**Files Modified**:
- `CLAUDE.md`
- Components (add inline comments)
- Help content in UI

---

## Testing Strategy

### Unit Tests

**Coverage Target**: 80% for new components

**Test Files**:
- `tests/unit/ai-assistant/ChatPanel.test.tsx`
- `tests/unit/ai-assistant/DesignPanel.test.tsx`
- `tests/unit/hooks/useChatSession.test.ts`
- `tests/unit/hooks/useDesignCustomization.test.ts`

**Focus Areas**:
- Component rendering (empty states, with data)
- User interactions (click, type, send)
- Error handling (API failures, network errors)
- State management (loading, error, success)

---

### Integration Tests

**Reuse Existing Tests**: Features 002 and 003 have comprehensive integration tests

**New Tests**:
- Chat + Design interaction (ensure state consistency)
- Duplicate application detection
- Enhanced prompts (verify conversational tone)

**Test Files**:
- `tests/integration/ai-assistant-flow.test.ts`
- `tests/integration/duplicate-detection.test.ts`

---

### E2E Tests

**Priority 1**: Full user journey
**Priority 2**: Error scenarios
**Priority 3**: Performance benchmarks

**Test Files**:
- `tests/e2e/ai-assistant/full-flow.spec.ts` (high priority)
- `tests/e2e/ai-assistant/chat-panel.spec.ts`
- `tests/e2e/ai-assistant/design-panel.spec.ts`

---

### Performance Tests

**Benchmarks**:
- Chat response time: <3s (p95)
- Design preview rendering: <2s (p95)
- Full optimization session: <10 minutes
- Page load with AI Assistant: <2s additional overhead

**Tools**: Lighthouse, Playwright performance API

---

## Success Criteria Tracking

| Criteria | Target | Measurement Method | Status |
|----------|--------|-------------------|--------|
| **SC-001**: Full session <10 min | <10 min | Time full flow (upload → export) | To be measured |
| **SC-002**: 90% acceptance rate | ≥90% | `COUNT(status='applied') / COUNT(*)` in `amendment_requests` | Add tracking |
| **SC-003**: Design preview <2s | <2s p95 | `performance.now()` before/after preview API call | To be measured |
| **SC-004**: Clarifying questions <20% | <20% | `COUNT(requires_clarification=true) / COUNT(*)` | Add tracking |
| **SC-005**: 100% history accuracy | 100% | Manual verification of 100 saved applications | To be verified |
| **SC-006**: Zero fabrication | 0 instances | Manual audit of 100 chat amendments | To be audited |
| **SC-007**: 85% complete apply | ≥85% | `COUNT(applications) / COUNT(unique users)` | Add tracking |
| **SC-008**: 100% error handling | No crashes | E2E tests + production monitoring | To be verified |

---

## Risk Management

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Prompt regression** (changing prompts breaks functionality) | Medium | High | Version prompts, A/B test, comprehensive tests |
| **Scope creep** (treating as new feature) | High | High | This plan document; strictly integration work only |
| **Performance degradation** | Low | Medium | Benchmark before/after; lazy load AI Assistant |
| **OpenAI rate limits** | Low | Medium | Implement client-side debouncing; monitor usage |
| **User confusion** (two tabs unclear) | Medium | Low | Clear labels, help tooltips, onboarding tour |

---

## Dependencies

### External Services
- ✅ OpenAI API (GPT-4) - Already configured
- ✅ Supabase (PostgreSQL + Auth + Storage) - Operational

### Internal Features
- ✅ Feature 002 (Chat Resume Iteration) - Production-ready
- ✅ Feature 003 (Design Selection & Customization) - Production-ready
- ✅ Feature 005 (History View) - Production-ready

### NPM Packages (All Existing)
- ✅ Next.js 14
- ✅ React 18
- ✅ shadcn/ui
- ✅ Tailwind CSS
- ✅ Supabase Client
- ✅ OpenAI SDK

**No new dependencies required.**

---

## Rollback Plan

### If Critical Issues Found

**Severity 1** (Feature breaks existing functionality):
1. Disable feature via feature flag
2. Revert to previous stable version
3. Investigate and fix
4. Re-deploy with fix

**Severity 2** (New feature doesn't work but existing features OK):
1. Disable AI Assistant button in UI (hide from users)
2. Leave backend operational for debugging
3. Fix issues in hotfix branch
4. Re-enable after verification

**Rollback Commands**:
```bash
# Disable feature flag
# (Assuming feature flag in environment variable)
export ENABLE_AI_ASSISTANT=false

# Or revert commit
git revert <commit-hash>
git push origin 006-ai-resume-assistant --force
```

---

## Monitoring & Observability

### Metrics to Track

**User Engagement**:
- AI Assistant open rate (% of users who open sidebar)
- Average messages per session
- Average design changes per session
- Time to first "Apply Resume" action

**Performance**:
- Chat response time (p50, p95, p99)
- Design preview render time (p50, p95, p99)
- API error rates
- Rate limit hit rate

**Success Criteria**:
- Amendment acceptance rate (SC-002)
- Clarifying question rate (SC-004)
- Application completion rate (SC-007)

**Tools**:
- Supabase Analytics (built-in)
- OpenAI Usage Dashboard
- Next.js Analytics
- Custom event tracking in `events` table

---

## Maintenance & Future Work

### Post-Launch Maintenance

**Week 1-2 Post-Launch**:
- Monitor error rates and performance
- Gather user feedback via in-app survey
- Triage and fix high-priority bugs
- Adjust prompts based on feedback

**Month 1-3 Post-Launch**:
- Analyze success criteria metrics
- A/B test prompt variations
- Optimize performance bottlenecks
- Plan enhancements based on usage patterns

---

### Future Enhancements (Not in Scope for Feature 006)

**P1 - High Priority**:
- Voice input for chat messages (accessibility)
- Side-by-side diff view for content changes (better UX)
- Design template recommendations based on industry (smarter AI)

**P2 - Medium Priority**:
- Saved chat sessions (resume conversations later)
- Export chat transcript (for user records)
- Design history (undo multiple steps)

**P3 - Low Priority**:
- Collaborative resume editing (share with career coaches)
- AI-generated cover letters (new feature)
- Video tutorials in AI Assistant (help content)

---

## Progress Tracking

### Phase 0: Research ✅ **COMPLETE** (2025-10-15)
- ✅ Analyzed existing Features 002, 003, 005
- ✅ Identified gap: 80% exists, 20% integration work
- ✅ Documented findings in `research.md`

### Phase 1: Design ✅ **COMPLETE** (2025-10-15)
- ✅ Documented data model (`data-model.md`)
- ✅ Documented API contracts (`contracts/api-ai-assistant.md`)
- ✅ Created quickstart guide (`quickstart.md`)

### Phase 2: Implementation ⏳ **PENDING**
- ⏳ Week 1: UI Integration (Days 1-5)
  - ⏳ Day 1-2: Core Components
  - ⏳ Day 3: API Integration
  - ⏳ Day 4: Enhanced Prompts
  - ⏳ Day 5: Duplicate Detection
- ⏳ Week 2: Testing & Polish (Days 6-10)
  - ⏳ Day 6-7: E2E Tests
  - ⏳ Day 8-9: UI Polish
  - ⏳ Day 10: Documentation & Deployment

---

## Conclusion

Feature 006 (AI Resume Assistant) is a **1-2 week integration project** that unifies existing chat (Feature 002) and design (Feature 003) systems under a single, intuitive "AI Assistant" interface.

**Key Success Factors**:
1. **Reuse existing infrastructure** - 80% of functionality already built
2. **Focus on UX** - Unified sidebar with clear tabs
3. **Enhance prompts** - Conversational, supportive AI tone
4. **Comprehensive testing** - E2E tests for integrated experience
5. **Incremental rollout** - Feature flag + gradual deployment

**Estimated Effort**: 10 days (1-2 weeks)
**Confidence**: High - Well-defined scope, proven components, clear plan

**Next Step**: Begin Phase 2 (UI Integration) - Start with Day 1-2 (Core Components).
