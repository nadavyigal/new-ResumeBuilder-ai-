# Tasks: AI Chat Resume Iteration

**Input**: Design documents from `specs/002-when-user-optimized/`
**Prerequisites**: plan.md, research.md, data-model.md

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → ✅ Loaded: Tech stack (TypeScript, Next.js, React, Supabase, OpenAI)
2. Load optional design documents:
   → ✅ data-model.md: 4 entities (chat_sessions, chat_messages, resume_versions, amendment_requests)
   → ✅ research.md: 6 technical decisions documented
3. Generate tasks by category:
   → Setup: Database migrations, library scaffolding, dependencies
   → Tests: Contract tests (API), integration tests (workflows), unit tests
   → Core: chat-manager library, session management, AI integration
   → Integration: API routes, database queries, React components
   → Polish: Error handling, performance optimization, documentation
4. Apply task rules:
   → Different files = mark [P] for parallel execution
   → Same file = sequential (no [P])
   → Tests before implementation (TDD red-green-refactor)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate completeness:
   → ✅ All entities have migrations and models
   → ✅ All API endpoints have contract tests
   → ✅ All user scenarios have integration tests
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
Using Next.js web app structure:
- **Source**: `src/` at repository root
- **Tests**: `tests/` at repository root
- **Database**: `supabase/migrations/` for schema changes

---

## Phase 3.1: Setup

- [ ] T001 Create database migration for chat schema in supabase/migrations/20251006_chat_schema.sql
- [ ] T002 Create chat-manager library directory structure at src/lib/chat-manager/ with index.ts, cli.ts, processor.ts, ai-client.ts, session.ts, versioning.ts
- [ ] T003 [P] Install dependencies: npm install openai react-diff-viewer diff-match-patch @types/diff-match-patch
- [ ] T004 [P] Create TypeScript type definitions in src/types/chat.ts for ChatSession, ChatMessage, ResumeVersion, AmendmentRequest
- [ ] T005 [P] Configure ESLint and Prettier for new library files

---

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests (API Endpoints)
- [x] T006 [P] Contract test POST /api/v1/chat in tests/contract/chat-send-message.test.ts
- [x] T007 [P] Contract test GET /api/v1/chat/sessions in tests/contract/chat-list-sessions.test.ts
- [x] T008 [P] Contract test GET /api/v1/chat/sessions/{id} in tests/contract/chat-get-session.test.ts
- [x] T009 [P] Contract test DELETE /api/v1/chat/sessions/{id} in tests/contract/chat-delete-session.test.ts
- [x] T010 [P] Contract test GET /api/v1/chat/sessions/{id}/messages in tests/contract/chat-get-messages.test.ts
- [x] T011 [P] Contract test POST /api/v1/chat/sessions/{id}/apply in tests/contract/chat-apply-amendment.test.ts
- [x] T012 [P] Contract test POST /api/v1/chat/sessions/{id}/preview in tests/contract/chat-preview-amendment.test.ts

### Integration Tests (User Workflows)
- [x] T013 [P] Integration test: Chat flow (open chat → send message → receive AI response → view history) in tests/integration/chat-flow.test.ts
- [x] T014 [P] Integration test: Amendment workflow (request change → preview diff → apply → verify new version) in tests/integration/amendment-workflow.test.ts
- [x] T015 [P] Integration test: Undo operation (apply amendment → undo → revert to previous version) in tests/integration/undo-workflow.test.ts
- [x] T016 [P] Integration test: Session persistence (close chat → reopen → conversation history preserved) in tests/integration/session-persistence.test.ts
- [x] T017 [P] Integration test: 30-day retention (simulate old session → verify auto-deletion logic) in tests/integration/retention-policy.test.ts
- [x] T018 [P] Integration test: Fabrication prevention (request fabricated experience → AI declines with explanation) in tests/integration/fabrication-prevention.test.ts

### Unit Test Stubs (Library Functions)
- [x] T019 [P] Unit test stub for message processor in tests/unit/chat-manager/processor.test.ts
- [x] T020 [P] Unit test stub for AI client in tests/unit/chat-manager/ai-client.test.ts
- [x] T021 [P] Unit test stub for session manager in tests/unit/chat-manager/session.test.ts
- [x] T022 [P] Unit test stub for versioning system in tests/unit/chat-manager/versioning.test.ts

---

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Database Layer
- [x] T023 Run database migration: npx supabase db push to apply chat schema (depends on T001)
- [x] T024 [P] Create Supabase client wrapper for chat_sessions table in src/lib/supabase/chat-sessions.ts
- [x] T025 [P] Create Supabase client wrapper for chat_messages table in src/lib/supabase/chat-messages.ts
- [x] T026 [P] Create Supabase client wrapper for resume_versions table in src/lib/supabase/resume-versions.ts
- [x] T027 [P] Create Supabase client wrapper for amendment_requests table in src/lib/supabase/amendment-requests.ts

### chat-manager Library Core
- [x] T028 [P] Implement AI client module in src/lib/chat-manager/ai-client.ts (OpenAI GPT-4 integration, streaming support)
- [x] T029 [P] Implement message processor in src/lib/chat-manager/processor.ts (extract amendment requests from user messages)
- [x] T030 Implement session manager in src/lib/chat-manager/session.ts (create, resume, close sessions - depends on T024, T025)
- [x] T031 Implement versioning system in src/lib/chat-manager/versioning.ts (create snapshots, track changes - depends on T026)
- [x] T032 Implement CLI interface in src/lib/chat-manager/cli.ts for standalone testing (stdin/stdout protocol - depends on T028-T031)
- [x] T033 Create library public API in src/lib/chat-manager/index.ts (export main functions)

---

## Phase 3.4: Integration (API Routes & UI)

### API Route Implementation
- [x] T034 Implement POST /api/v1/chat in src/app/api/v1/chat/route.ts (send message, get AI response - depends on T028, T029, T030)
- [x] T035 Implement GET /api/v1/chat/sessions in src/app/api/v1/chat/sessions/route.ts (list user's chat sessions - depends on T024)
- [x] T036 Implement GET /api/v1/chat/sessions/[id] in src/app/api/v1/chat/sessions/[id]/route.ts (get session details - depends on T024, T025)
- [x] T037 Implement DELETE /api/v1/chat/sessions/[id] in src/app/api/v1/chat/sessions/[id]/route.ts (delete session before 30-day expiry - depends on T024)
- [x] T038 Implement GET /api/v1/chat/sessions/[id]/messages in src/app/api/v1/chat/sessions/[id]/messages/route.ts (paginated message history - depends on T025)
- [x] T039 Implement POST /api/v1/chat/sessions/[id]/apply in src/app/api/v1/chat/sessions/[id]/apply/route.ts (apply amendment to resume - depends on T029, T031)
- [x] T040 Implement POST /api/v1/chat/sessions/[id]/preview in src/app/api/v1/chat/sessions/[id]/preview/route.ts (preview amendment without applying - depends on T029)

### React UI Components
- [x] T041 [P] Create ChatMessage component in src/components/chat/ChatMessage.tsx (render user/AI messages with timestamps)
- [x] T042 [P] Create ChatInput component in src/components/chat/ChatInput.tsx (message input field with loading states)
- [x] T043 [P] Create ChangeDiff component in src/components/chat/ChangeDiff.tsx (resume change visualization using react-diff-viewer)
- [x] T044 Create ChatSidebar component in src/components/chat/ChatSidebar.tsx (main chat interface with message list, input, open/close state - depends on T041, T042)
- [x] T045 Integrate ChatSidebar into resume view page in src/app/dashboard/optimizations/[id]/page.tsx (add chat sidebar as floating button - depends on T044)

---

## Phase 3.5: Polish

### Error Handling & Validation
- [x] T046 [P] Add error handling to AI client in src/lib/chat-manager/ai-client.ts (retry logic, timeout handling, rate limits)
- [x] T047 [P] Add input validation to message processor in src/lib/chat-manager/processor.ts (content length limits, sanitization)
- [x] T048 [P] Add fabrication detection logic in src/lib/chat-manager/processor.ts (reject requests for false information per FR-022)
- [x] T049 Add comprehensive error messages to API routes in src/app/api/v1/chat/**/*.ts (actionable context per constitutional observability principle)

### Unit Tests (Now That Implementation Exists)
- [ ] T050 [P] Complete unit tests for message processor in tests/unit/chat-manager/processor.test.ts (test amendment extraction, validation)
- [ ] T051 [P] Complete unit tests for AI client in tests/unit/chat-manager/ai-client.test.ts (test streaming, error handling, timeouts)
- [ ] T052 [P] Complete unit tests for session manager in tests/unit/chat-manager/session.test.ts (test create, resume, close, unique session enforcement)
- [ ] T053 [P] Complete unit tests for versioning system in tests/unit/chat-manager/versioning.test.ts (test snapshot creation, version numbering, undo logic)

### Performance & Optimization
- [ ] T054 [P] Add performance logging to chat API routes (measure and log response times, ensure 7-second target met)
- [ ] T055 [P] Implement Server-Sent Events (SSE) for streaming AI responses in src/app/api/v1/chat/route.ts
- [ ] T056 [P] Add caching for session data in ChatSidebar component (reduce unnecessary API calls)

### Documentation & Final Touches
- [x] T057 [P] Update CLAUDE.md with chat feature context (add chat-manager library, new API endpoints, performance targets)
- [x] T058 [P] Create quickstart.md manual testing scenarios in specs/002-when-user-optimized/quickstart.md
- [ ] T059 [P] Add JSDoc comments to chat-manager library public API in src/lib/chat-manager/index.ts
- [ ] T060 Run full test suite and verify all tests pass (contract, integration, unit tests green)

---

## Dependencies

### Critical Path
```
T001 (migration) → T023 (apply migration) → T024-T027 (DB wrappers) → T030-T031 (session/versioning) → T034-T040 (API routes)
T002 (lib structure) → T028-T029 (AI/processor) → T032 (CLI) → T033 (public API)
T003 (deps) → T041-T043 (UI components) → T044 (ChatSidebar) → T045 (integration)
T006-T022 (tests) MUST complete and FAIL before T023-T045 (implementation)
```

### Dependency Graph
- **T023** blocks: T024, T025, T026, T027 (need schema to exist)
- **T024, T025** block: T030 (session manager needs DB access)
- **T026** blocks: T031 (versioning needs DB access)
- **T028, T029, T030** block: T034 (API route needs core logic)
- **T029, T031** block: T039, T040 (amendment endpoints need processor + versioning)
- **T041, T042** block: T044 (ChatSidebar uses these components)
- **T044** blocks: T045 (page integration needs component)
- **T028-T045** block: T050-T053 (unit tests need implementation to test against)

---

## Parallel Example

### Parallel Test Generation (After T001-T005 Setup)
```
# Launch T006-T022 together (all contract and integration tests):
Task: "Write contract test POST /api/v1/chat in tests/contract/chat-send-message.test.ts"
Task: "Write contract test GET /api/v1/chat/sessions in tests/contract/chat-list-sessions.test.ts"
Task: "Write integration test for chat flow in tests/integration/chat-flow.test.ts"
Task: "Write integration test for amendment workflow in tests/integration/amendment-workflow.test.ts"
... (all test tasks in parallel)
```

### Parallel DB Wrapper Creation (After T023 Migration Applied)
```
# Launch T024-T027 together:
Task: "Create Supabase client wrapper for chat_sessions in src/lib/supabase/chat-sessions.ts"
Task: "Create Supabase client wrapper for chat_messages in src/lib/supabase/chat-messages.ts"
Task: "Create Supabase client wrapper for resume_versions in src/lib/supabase/resume-versions.ts"
Task: "Create Supabase client wrapper for amendment_requests in src/lib/supabase/amendment-requests.ts"
```

### Parallel Core Library Development (After DB Wrappers)
```
# Launch T028-T029 together (independent modules):
Task: "Implement AI client with OpenAI GPT-4 integration in src/lib/chat-manager/ai-client.ts"
Task: "Implement message processor for amendment extraction in src/lib/chat-manager/processor.ts"
```

### Parallel UI Component Creation (After T003 Dependencies)
```
# Launch T041-T043 together:
Task: "Create ChatMessage component in src/components/chat/ChatMessage.tsx"
Task: "Create ChatInput component in src/components/chat/ChatInput.tsx"
Task: "Create ChangeDiff component with react-diff-viewer in src/components/chat/ChangeDiff.tsx"
```

### Parallel Polish Tasks (After Implementation Complete)
```
# Launch T050-T053, T054-T056, T057-T059 together:
Task: "Complete unit tests for message processor in tests/unit/chat-manager/processor.test.ts"
Task: "Add performance logging to chat API routes"
Task: "Update CLAUDE.md with chat feature documentation"
... (all polish tasks in parallel)
```

---

## Notes

### TDD Enforcement
- ✅ Tests (T006-T022) before implementation (T023-T045)
- ✅ Verify tests fail before implementing (red phase)
- ✅ Implement minimum code to make tests pass (green phase)
- ✅ Refactor with tests green

### Parallel Execution Guidelines
- **[P] tasks** = different files, no dependencies → safe to run concurrently
- **No [P]** = same file or direct dependency → must run sequentially
- Maximize parallel execution in Setup (T003-T005), Tests (T006-T022), DB Wrappers (T024-T027), UI Components (T041-T043), Polish (T050-T059)

### Commit Strategy
- Commit after each task completion
- Phase 3.2 (tests): One commit per test file or logical group
- Phase 3.3-3.4 (implementation): One commit per feature/endpoint
- Phase 3.5 (polish): One commit per category (error handling, unit tests, perf, docs)

### Constitutional Compliance
- ✅ Library-first: chat-manager library independent of API routes
- ✅ CLI interface: T032 provides standalone testing capability
- ✅ TDD: Phase 3.2 tests before Phase 3.3 implementation
- ✅ Integration testing: T013-T018 cover all user workflows
- ✅ Observability: T049 ensures actionable error messages, T054 adds performance logging
- ✅ Simplicity: Direct OpenAI integration (no custom NLP), full snapshots vs. complex diffs

---

## Validation Checklist
*GATE: Checked before marking tasks.md as complete*

- [x] All data model entities have migration tasks (T001: 4 tables)
- [x] All entities have DB wrapper tasks (T024-T027)
- [x] All API endpoints have contract test tasks (T006-T012: 7 endpoints)
- [x] All user scenarios have integration test tasks (T013-T018: 6 workflows)
- [x] All tests come before implementation (Phase 3.2 before 3.3)
- [x] Parallel tasks truly independent ([P] = different files)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] Dependency graph complete and acyclic
- [x] Constitutional principles enforced through task structure

---

**Total Tasks**: 60
**Estimated Completion**: 5-7 days for one developer following TDD cycle
**Blocking Tasks**: T001, T023 (migrations must complete first)
**Highly Parallelizable Phases**: Setup (T003-T005), Tests (T006-T022), DB Wrappers (T024-T027), UI Components (T041-T043), Polish (T050-T059)
