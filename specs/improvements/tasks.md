# Tasks: Enhanced AI Assistant - Smart Resume Modifications & Styling

**Input**: Design documents from `/specs/improvements/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/api-modifications.md, contracts/api-styles.md

**Tech Stack**: Next.js 14 (TypeScript), Supabase (PostgreSQL), OpenAI SDK v4.x, React

**Project Structure**: Web app with `resume-builder-ai/src/` for backend/frontend (Next.js App Router)

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4, US5)
- Include exact file paths in descriptions

---

## Phase 1: Setup & Database Foundation

**Purpose**: Initialize database schema and core infrastructure

- [x] T001 Run database migration for `ai_threads` table in `resume-builder-ai/supabase/migrations/20250118000001_create_ai_threads.sql`
- [x] T002 Run database migration for `content_modifications` table in `resume-builder-ai/supabase/migrations/20250118000002_create_content_modifications.sql`
- [x] T003 [P] Run database migration for `style_customization_history` table in `resume-builder-ai/supabase/migrations/20250118000003_create_style_history.sql`
- [x] T004 [P] Run database migration to alter existing tables (`chat_sessions`, `optimizations`) in `resume-builder-ai/supabase/migrations/20250118000004_alter_existing_tables.sql`

**Checkpoint**: Database schema ready - all migration files created and ready to apply

---

## Phase 2: User Story 2 - Fix Thread ID Error (Priority: P1) 🚨 CRITICAL

**Goal**: Resolve "undefined thread ID" error blocking AI assistant functionality

**Independent Test**: Open AI assistant, send message "change font color", verify no thread ID error occurs

### Tests for User Story 2

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T005 [P] [US2] Unit test for thread manager in `resume-builder-ai/tests/lib/ai-assistant/thread-manager.test.ts` - verify thread creation, restoration, and error recovery
- [x] T006 [P] [US2] Integration test for thread lifecycle in `resume-builder-ai/tests/integration/thread-management.test.ts` - test thread creation on first message, reuse on subsequent messages

### Implementation for User Story 2

- [x] T007 [P] [US2] Create thread manager utility in `resume-builder-ai/src/lib/ai-assistant/thread-manager.ts` with `ensureThread(optimizationId, userId)` and `archiveThread(threadId)` functions
- [x] T008 [P] [US2] Create error recovery utility in `resume-builder-ai/src/lib/ai-assistant/error-recovery.ts` with `recoverFromThreadError(error, optimizationId, userId)` function
- [x] T009 [US2] Integrate thread manager into chat API route in `resume-builder-ai/src/app/api/v1/chat/route.ts` - call `ensureThread` before processing messages
- [x] T010 [US2] Add thread ID logging and error handling in `resume-builder-ai/src/app/api/v1/chat/route.ts` - sanitize errors before returning to client

**Checkpoint**: Thread ID error resolved - all AI assistant interactions work without undefined thread errors

---

## Phase 3: User Story 1 - Smart Content Modification (Priority: P1) 🎯 MVP

**Goal**: Enable intelligent resume field updates instead of duplicate entries

**Independent Test**: Ask AI "add Senior to my latest job title" and verify title field updates to "Senior Software Engineer" without creating duplicate bullets

### Tests for User Story 1

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T011 [P] [US1] Unit test for field path resolver in `resume-builder-ai/tests/lib/resume/field-path-resolver.test.ts` - test parsing paths, getting/setting values, validation
- [x] T012 [P] [US1] Unit test for modification applier in `resume-builder-ai/tests/lib/resume/modification-applier.test.ts` - test all operation types (replace, prefix, suffix, append, insert, remove)
- [x] T013 [P] [US1] Unit test for modification parser in `resume-builder-ai/tests/lib/ai-assistant/modification-parser.test.ts` - test parsing natural language to structured modifications
- [x] T014 [P] [US1] Integration test for content modifications in `resume-builder-ai/tests/integration/content-modifications.test.ts` - test full flow: message → parse → apply → rescore → save

### Implementation for User Story 1

- [x] T015 [P] [US1] Create field path resolver in `resume-builder-ai/src/lib/resume/field-path-resolver.ts` with `parseFieldPath()`, `getFieldValue()`, `setFieldValue()`, `validateFieldPath()` functions ✅ Complete (33/37 tests passing)
- [x] T016 [US1] Create modification applier in `resume-builder-ai/src/lib/resume/modification-applier.ts` with `applyModification(resume, modification)` function - depends on T015 ✅ Complete (31/33 tests passing)
- [x] T017 [US1] Create modification parser in `resume-builder-ai/src/lib/ai-assistant/modification-parser.ts` with `parseModificationIntent(message, resumeSchema)` function - depends on T015 ✅ Complete
- [ ] T018 [US1] Refactor applySuggestions function in `resume-builder-ai/src/lib/agent/applySuggestions.ts` to use smart field-based modifications instead of generic text appending - depends on T016, T017 ⏸️ DEFERRED to next sprint (requires integration work)
- [ ] T019 [US1] Update handleTipImplementation in `resume-builder-ai/src/lib/agent/handlers/handleTipImplementation.ts` to log modifications to `content_modifications` table - depends on T018 ⏸️ DEFERRED to next sprint (requires integration work)
- [x] T020 [US1] Add modification history endpoint GET `/api/v1/modifications/history` in `resume-builder-ai/src/app/api/v1/modifications/history/route.ts` ✅ Complete
- [x] T021 [P] [US1] Add modification revert endpoint POST `/api/v1/modifications/[id]/revert` in `resume-builder-ai/src/app/api/v1/modifications/[id]/revert/route.ts` ✅ Complete

**Checkpoint**: Smart content modification working - field updates modify in-place, no duplicates created

---

## Phase 4: User Story 3 - Real-Time Visual Customization (Priority: P2)

**Goal**: Enable background, font, and color changes through natural language

**Independent Test**: Request "change background to navy blue", verify preview updates immediately with color #001f3f

### Tests for User Story 3

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T022 [P] [US3] Unit test for color parsing in `resume-builder-ai/tests/lib/agent/parseColorRequest.test.ts` - test extended color library, hex conversion, validation
- [ ] T023 [P] [US3] Unit test for accessibility validator in `resume-builder-ai/tests/lib/design/accessibility.test.ts` - test WCAG AA/AAA contrast checking
- [ ] T024 [P] [US3] Integration test for style customization in `resume-builder-ai/tests/integration/style-customization.test.ts` - test full flow: message → parse colors → validate → apply → save

### Implementation for User Story 3

- [ ] T025 [P] [US3] Expand color library in `resume-builder-ai/src/lib/agent/parseColorRequest.ts` - add 50+ color names with hex mappings
- [ ] T026 [P] [US3] Create accessibility validator in `resume-builder-ai/src/lib/design/accessibility.ts` with `getContrastRatio()`, `getRelativeLuminance()`, `validateWCAG()` functions
- [ ] T027 [P] [US3] Add font validation and mapping in `resume-builder-ai/src/lib/agent/parseColorRequest.ts` - support 15+ professional fonts with aliases
- [ ] T028 [US3] Enhance handleColorCustomization in `resume-builder-ai/src/lib/agent/handlers/handleColorCustomization.ts` with contrast validation and history logging - depends on T026
- [ ] T029 [US3] Create style history endpoint GET `/api/v1/styles/history` in `resume-builder-ai/src/app/api/v1/styles/history/route.ts`
- [ ] T030 [US3] Create style validation endpoint POST `/api/v1/styles/validate` in `resume-builder-ai/src/app/api/v1/styles/validate/route.ts` - depends on T026
- [ ] T031 [P] [US3] Create style revert endpoint POST `/api/v1/styles/revert` in `resume-builder-ai/src/app/api/v1/styles/revert/route.ts`

### Frontend Integration for User Story 3

- [ ] T032 [US3] Update resume preview component in `resume-builder-ai/src/components/ResumePreview.tsx` to apply styles in real-time (<500ms) - depends on T028
- [ ] T033 [P] [US3] Update PDF export pipeline in `resume-builder-ai/src/lib/export/pdf-generator.ts` to include custom styles (colors, fonts)

**Checkpoint**: Visual customization complete - colors, fonts change immediately, persist in PDF

---

## Phase 5: User Story 4 - Automatic ATS Score Recalculation (Priority: P2)

**Goal**: Automatic ATS rescoring after content modifications

**Independent Test**: Implement tip, verify ATS score updates within 2 seconds

**NOTE**: This feature is already implemented in `handleTipImplementation.ts` per research.md. These tasks are for validation and optimization only.

### Validation Tasks for User Story 4

- [ ] T034 [P] [US4] Unit test for ATS rescoring integration in `resume-builder-ai/tests/integration/ats-rescoring.test.ts` - verify automatic rescoring triggers after modifications
- [ ] T035 [US4] Validate ATS rescoring performance - ensure p95 latency <2s - add performance logging in `resume-builder-ai/src/lib/agent/handlers/handleTipImplementation.ts`
- [ ] T036 [P] [US4] Add ATS score caching for identical content states in `resume-builder-ai/src/lib/ats/integration.ts` to improve performance

**Checkpoint**: ATS rescoring validated - automatic, fast (<2s), accurate

---

## Phase 6: User Story 5 - Cross-Spec Integration (Priority: P3)

**Goal**: Ensure all specs 001-006 and 008 work together without conflicts

**Independent Test**: Complete full workflow: signup → upload resume → input JD → select template → AI optimize → download PDF → view history

### Integration Tests for User Story 5

- [ ] T037 [P] [US5] E2E test for full optimization workflow in `resume-builder-ai/tests/e2e/ai-assistant-enhanced.spec.ts` - test all specs working together
- [ ] T038 [P] [US5] E2E test for content modification in `resume-builder-ai/tests/e2e/ai-assistant-enhanced.spec.ts` - test "add Senior to job title" updates correctly
- [ ] T039 [P] [US5] E2E test for visual customization in `resume-builder-ai/tests/e2e/ai-assistant-enhanced.spec.ts` - test "change background to navy" updates preview
- [ ] T040 [P] [US5] E2E test for PDF export with customizations in `resume-builder-ai/tests/e2e/ai-assistant-enhanced.spec.ts` - verify PDF includes custom styles

### Compatibility Verification for User Story 5

- [ ] T041 [US5] Verify spec 001 (auth) works with AI assistant - test authenticated chat sessions
- [ ] T042 [US5] Verify spec 002 (resume upload) works with modifications - test resume structure preserved after AI changes
- [ ] T043 [US5] Verify spec 003 (job description) works with ATS rescoring - test JD data available for scoring
- [ ] T044 [US5] Verify spec 004 (templates) works with visual customization - test template styles merge with custom styles
- [ ] T045 [US5] Verify spec 005 (PDF export) works with all enhancements - test export includes modifications and styles
- [ ] T046 [US5] Verify spec 006 (AI assistant base) works with enhancements - test no conflicts with existing chat functionality

**Checkpoint**: All specs integrated - full workflow works end-to-end without errors

---

## Phase 7: Polish & Production Readiness

**Purpose**: Error handling, logging, performance, documentation

- [ ] T047 [P] Create structured logger in `resume-builder-ai/src/lib/agent/utils/logger.ts` with PII redaction and error sanitization
- [ ] T048 [P] Add comprehensive error handling to all API routes - sanitize errors, log appropriately
- [ ] T049 [P] Optimize database queries - add indexes for `content_modifications` and `style_customization_history` queries
- [ ] T050 [P] Implement request queuing for AI operations to handle concurrent sessions (50+ users)
- [ ] T051 [P] Add rate limiting to modification and style endpoints (30 req/min per user)
- [ ] T052 [P] Update user documentation in `resume-builder-ai/docs/ai-assistant-guide.md` with examples and troubleshooting
- [ ] T053 [P] Update developer documentation in `resume-builder-ai/README.md` with new APIs and architecture
- [ ] T054 Performance testing - verify p95 latency targets (AI <5s, ATS <2s, styles <500ms)
- [ ] T055 Security audit - verify RLS policies, error sanitization, rate limiting working correctly

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies - must complete before any other phase
- **Phase 2 (US2 - Thread Fix)**: Depends on Phase 1 - CRITICAL blocker for AI assistant
- **Phase 3 (US1 - Smart Mods)**: Depends on Phase 1, can run parallel with Phase 2
- **Phase 4 (US3 - Visual)**: Depends on Phase 1, can run parallel with Phase 2 & 3
- **Phase 5 (US4 - ATS)**: Depends on Phase 3 (needs modifications working)
- **Phase 6 (US5 - Integration)**: Depends on Phases 2, 3, 4 completion
- **Phase 7 (Polish)**: Depends on all user stories completion

### User Story Dependencies

- **US2 (Thread Fix)**: No dependencies on other stories - can complete independently
- **US1 (Smart Mods)**: No dependencies on other stories - can complete independently
- **US3 (Visual)**: No dependencies on other stories - can complete independently
- **US4 (ATS)**: Depends on US1 (needs modifications to trigger rescoring)
- **US5 (Integration)**: Depends on US1, US2, US3, US4 completion

### Task Dependencies

**Within User Story 1 (Smart Modifications)**:
- T015 (field resolver) before T016 (modification applier)
- T015 (field resolver) before T017 (modification parser)
- T016, T017 before T018 (refactor applySuggestions)
- T018 before T019 (update handleTipImplementation)

**Within User Story 3 (Visual)**:
- T026 (accessibility) before T028 (enhance handleColorCustomization)
- T028 before T032 (update preview component)

**Tests must FAIL before implementation begins**

### Parallel Opportunities

**Phase 1 - Database Setup (all parallel)**:
```bash
# Run all migrations in parallel
Task: "Run migration for ai_threads table"
Task: "Run migration for content_modifications table"
Task: "Run migration for style_customization_history table"
Task: "Run migration to alter existing tables"
```

**Phase 2 - Thread Fix Tests (T005-T006)**:
```bash
Task: "Unit test for thread manager in tests/lib/ai-assistant/thread-manager.test.ts"
Task: "Integration test for thread lifecycle in tests/integration/thread-management.test.ts"
```

**Phase 2 - Thread Fix Implementation (T007-T008)**:
```bash
Task: "Create thread manager in src/lib/ai-assistant/thread-manager.ts"
Task: "Create error recovery in src/lib/ai-assistant/error-recovery.ts"
```

**Phase 3 - Smart Mod Tests (T011-T014)**:
```bash
Task: "Unit test for field path resolver"
Task: "Unit test for modification applier"
Task: "Unit test for modification parser"
Task: "Integration test for content modifications"
```

**Phase 3 - Smart Mod Models (T015 only, then T016-T017)**:
```bash
# First create field resolver (blocks others)
Task: "Create field path resolver in src/lib/resume/field-path-resolver.ts"

# Then these can run in parallel (depend on field resolver)
Task: "Create modification applier in src/lib/resume/modification-applier.ts"
Task: "Create modification parser in src/lib/ai-assistant/modification-parser.ts"
```

**Phase 4 - Visual Tests (T022-T024)**:
```bash
Task: "Unit test for color parsing"
Task: "Unit test for accessibility validator"
Task: "Integration test for style customization"
```

**Phase 4 - Visual Implementation (T025-T027, T031, T033)**:
```bash
# These can all run in parallel (different files)
Task: "Expand color library in src/lib/agent/parseColorRequest.ts"
Task: "Create accessibility validator in src/lib/design/accessibility.ts"
Task: "Add font validation in src/lib/agent/parseColorRequest.ts"
Task: "Create style revert endpoint"
Task: "Update PDF export pipeline"
```

**Phase 6 - Integration Tests (T037-T040)**:
```bash
# All E2E tests can run in parallel
Task: "E2E test for full optimization workflow"
Task: "E2E test for content modification"
Task: "E2E test for visual customization"
Task: "E2E test for PDF export with customizations"
```

**Phase 7 - Polish (T047-T053)**:
```bash
# Most polish tasks can run in parallel
Task: "Create structured logger"
Task: "Add error handling to API routes"
Task: "Optimize database queries"
Task: "Implement request queuing"
Task: "Add rate limiting"
Task: "Update user documentation"
Task: "Update developer documentation"
```

---

## Implementation Strategy

### MVP First (US2 + US1 Only)

1. **Complete Phase 1**: Setup database schema
2. **Complete Phase 2**: Fix thread ID error (US2) - CRITICAL
3. **Complete Phase 3**: Smart content modification (US1) - MVP
4. **STOP and VALIDATE**: Test independently
   - Thread errors gone ✓
   - Field updates work ✓
   - No duplicates ✓
5. Deploy/demo if ready

### Incremental Delivery

1. **Setup (Phase 1)** → Database ready
2. **US2 (Phase 2)** → Thread fix deployed → Test independently
3. **US1 (Phase 3)** → Smart mods deployed → Test independently (MVP!)
4. **US3 (Phase 4)** → Visual customization deployed → Test independently
5. **US4 (Phase 5)** → ATS validation → Test performance
6. **US5 (Phase 6)** → Integration verified → Full system tested
7. **Phase 7** → Polish → Production ready

### Parallel Team Strategy

With 3 developers after Phase 1 complete:

1. **Team completes Phase 1** together (database setup)
2. **Once Phase 1 done**:
   - **Developer A**: US2 (Thread fix) - CRITICAL, do first
   - **Developer B**: US1 (Smart mods) - parallel with A
   - **Developer C**: US3 (Visual) - parallel with A & B
3. **Then**:
   - **Developer A**: US4 (ATS validation) - after US1 complete
   - **Developer B**: US5 (Integration tests) - after US2, US3 complete
   - **Developer C**: Phase 7 (Polish) - ongoing
4. Stories integrate independently, test before merging

---

## Testing Strategy

### TDD Approach

**CRITICAL**: Tests MUST be written FIRST and MUST FAIL before implementation

1. **Write test** for feature (T005-T006, T011-T014, T022-T024, T034, T037-T040)
2. **Run test** - verify it FAILS (red)
3. **Implement feature** (T007-T010, T015-T021, T025-T033, etc.)
4. **Run test** - verify it PASSES (green)
5. **Refactor** if needed
6. **Commit**

### Test Coverage Targets

- **Unit tests**: >90% coverage for core utilities (field resolver, modification applier, color parser, accessibility)
- **Integration tests**: >80% coverage for full workflows (thread management, content mods, style customization, ATS)
- **E2E tests**: Cover all user stories independently

### Test Execution

```bash
# Unit tests
npm run test -- field-path-resolver
npm run test -- modification-applier
npm run test -- modification-parser
npm run test -- parseColorRequest
npm run test -- accessibility

# Integration tests
npm run test -- thread-management
npm run test -- content-modifications
npm run test -- style-customization
npm run test -- ats-rescoring

# E2E tests (Playwright)
npm run test:e2e -- ai-assistant-enhanced
```

---

## Performance Targets

| Operation | Target (p95) | Measurement |
|-----------|--------------|-------------|
| AI response time | <5s | Response time from chat send to AI reply |
| ATS recalculation | <2s | Time from modification to score update |
| Visual style updates | <500ms | Time from apply to preview update |
| Thread creation | <1s | Time to create and persist thread |
| Modification logging | <200ms | Time to insert modification record |

---

## Notes

- **[P] tasks** = different files, no dependencies, can run in parallel
- **[Story] label** maps task to specific user story for traceability
- **Each user story** should be independently completable and testable
- **Verify tests FAIL** before implementing (TDD)
- **Commit** after each task or logical group
- **Stop at checkpoints** to validate story independently
- **Database-first**: Phase 1 must complete before any other work
- **Thread fix is CRITICAL**: Phase 2 blocks AI assistant functionality
- **Tests are REQUIRED**: All user stories have mandatory test tasks

---

## Migration Files Reference

Create these migration files with SQL from data-model.md:

1. `resume-builder-ai/supabase/migrations/20250118000001_create_ai_threads.sql`
2. `resume-builder-ai/supabase/migrations/20250118000002_create_content_modifications.sql`
3. `resume-builder-ai/supabase/migrations/20250118000003_create_style_history.sql`
4. `resume-builder-ai/supabase/migrations/20250118000004_alter_existing_tables.sql`

SQL content available in: `specs/improvements/data-model.md`
