# Tasks: AI Resume Optimizer

**Input**: Design documents from `/specs/001-ai-resume-optimizer/`
**Prerequisites**: plan.md (✅), data-model.md (✅), contracts/ (✅), quickstart.md (✅)

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → ✅ Next.js 15.5.2, TypeScript, 5 libraries planned
2. Load design documents:
   → ✅ data-model.md: 5 entities extracted
   → ✅ contracts/: 6 API endpoints identified
   → ✅ quickstart.md: 6 test scenarios available
3. Generate tasks by category:
   → Setup: Next.js project, dependencies, TypeScript
   → Tests: 6 contract tests, 6 integration tests, library tests
   → Core: 5 libraries, 6 API endpoints, 5 database models
   → Integration: Supabase, OpenAI, file storage
   → Polish: unit tests, performance validation, docs
4. Apply task rules:
   → Libraries marked [P] for parallel development
   → Contract tests marked [P] (different files)
   → API endpoints sequential (shared route handlers)
5. Tasks T001-T046 numbered sequentially
6. Epic 1: Resume Ingestion prioritized (T008-T020)
7. Dependencies mapped: Tests → Implementation → Polish
8. ✅ All 6 contracts have tests, all 5 entities have models
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in task descriptions
- **PRIORITY**: Epic 1 Resume Ingestion tasks (T008-T020) before other epics

## Path Conventions
Next.js 15 full-stack structure:
- **Source**: `src/app/`, `src/components/`, `src/lib/`
- **Tests**: `tests/contract/`, `tests/integration/`, `tests/unit/`
- **API Routes**: `src/app/api/*/route.ts`

## Phase 3.1: Setup
- [ ] T001 Create Next.js 15 project structure with TypeScript and required directories (src/lib/, tests/)
- [ ] T002 Install dependencies: next@15.5.2, react@19, typescript@5.9.2, @supabase/supabase-js, openai, pdf-parse, docx, puppeteer
- [ ] T003 [P] Configure TypeScript strict mode and path aliases in tsconfig.json
- [ ] T004 [P] Configure ESLint, Prettier, and Tailwind CSS setup
- [ ] T005 [P] Set up Supabase client configuration in src/lib/supabase.ts
- [ ] T006 [P] Configure environment variables template (.env.example) for Supabase and OpenAI
- [ ] T007 [P] Set up test framework (Jest/Vitest) configuration for Next.js

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Epic 1: Resume Ingestion Priority Tests
- [ ] T008 [P] Contract test POST /api/upload-resume in tests/contract/test_upload_resume.spec.ts
- [ ] T009 [P] Contract test GET /api/resumes/[id] in tests/contract/test_get_resume.spec.ts
- [ ] T010 [P] Integration test resume upload flow in tests/integration/test_resume_upload.spec.ts
- [ ] T011 [P] Integration test file parsing validation in tests/integration/test_file_parsing.spec.ts

### Other API Contract Tests
- [ ] T012 [P] Contract test POST /api/ingest-jd in tests/contract/test_ingest_jd.spec.ts
- [ ] T013 [P] Contract test POST /api/optimize in tests/contract/test_optimize.spec.ts
- [ ] T014 [P] Contract test GET /api/score/[id] in tests/contract/test_score.spec.ts
- [ ] T015 [P] Contract test GET /api/download/[id] in tests/contract/test_download.spec.ts
- [ ] T016 [P] Contract test GET /api/templates in tests/contract/test_templates.spec.ts

### Library-Level Tests
- [ ] T017 [P] Integration test resume-parser library CLI in tests/integration/test_resume_parser_lib.spec.ts
- [ ] T018 [P] Integration test job-description-extractor library in tests/integration/test_jd_extractor_lib.spec.ts
- [ ] T019 [P] Integration test ai-optimizer library in tests/integration/test_ai_optimizer_lib.spec.ts
- [ ] T020 [P] Integration test template-engine library in tests/integration/test_template_engine_lib.spec.ts

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Epic 1: Resume Ingestion Priority Implementation
- [ ] T021 [P] Resume parser library with CLI in src/lib/resume-parser/index.ts
- [ ] T022 [P] Resume parser PDF handler in src/lib/resume-parser/pdf-handler.ts
- [ ] T023 [P] Resume parser DOCX handler in src/lib/resume-parser/docx-handler.ts
- [ ] T024 [P] Resume parser CLI interface in src/lib/resume-parser/cli.ts
- [ ] T025 POST /api/upload-resume endpoint in src/app/api/upload-resume/route.ts
- [ ] T026 File upload validation and storage integration in src/lib/file-upload.ts

### Database Models (Supabase Schema)
- [ ] T027 [P] User profile model and types in src/types/profile.ts
- [ ] T028 [P] Resume model and types in src/types/resume.ts
- [ ] T029 [P] Job description model and types in src/types/job-description.ts
- [ ] T030 [P] Optimization model and types in src/types/optimization.ts
- [ ] T031 [P] Template model and types in src/types/template.ts

### Remaining Libraries
- [ ] T032 [P] Job description extractor library in src/lib/job-description-extractor/index.ts
- [ ] T033 [P] AI optimizer library with OpenAI integration in src/lib/ai-optimizer/index.ts
- [ ] T034 [P] Template engine library in src/lib/template-engine/index.ts
- [ ] T035 [P] Auth manager library with Supabase in src/lib/auth-manager/index.ts

### API Endpoints Implementation
- [ ] T036 POST /api/ingest-jd endpoint in src/app/api/ingest-jd/route.ts
- [ ] T037 POST /api/optimize endpoint in src/app/api/optimize/route.ts
- [ ] T038 GET /api/score/[id] endpoint in src/app/api/score/[id]/route.ts
- [ ] T039 GET /api/download/[id] endpoint in src/app/api/download/[id]/route.ts
- [ ] T040 GET /api/templates endpoint in src/app/api/templates/route.ts

## Phase 3.4: Integration
- [ ] T041 Database schema migration scripts for Supabase in supabase/migrations/
- [ ] T042 Row Level Security (RLS) policies for all tables in supabase/migrations/
- [ ] T043 Authentication middleware for protected routes in src/middleware.ts
- [ ] T044 File storage integration with Supabase Storage in src/lib/storage.ts
- [ ] T045 Error handling and structured logging across all API routes

## Phase 3.5: Polish
- [ ] T046 [P] Unit tests for validation helpers in tests/unit/test_validation.spec.ts
- [ ] T047 [P] Unit tests for utility functions in tests/unit/test_utils.spec.ts
- [ ] T048 Performance tests for file upload (<5s) in tests/performance/test_upload_performance.spec.ts
- [ ] T049 Performance tests for AI optimization (<20s) in tests/performance/test_optimization_performance.spec.ts
- [ ] T050 [P] Update library documentation (llms.txt format) for each library
- [ ] T051 End-to-end test scenarios from quickstart.md in tests/e2e/test_user_journeys.spec.ts
- [ ] T052 Manual testing validation using quickstart.md scenarios

## Dependencies

### Critical Path (Epic 1 Priority)
- Setup (T001-T007) → Epic 1 Tests (T008-T011) → Epic 1 Implementation (T021-T026)
- T021 (resume-parser) blocks T025 (upload endpoint)
- T027-T028 (models) block T025 (upload endpoint)

### General Dependencies
- All Tests (T008-T020) before Implementation (T021-T040)
- Models (T027-T031) before API endpoints (T025, T036-T040)
- Libraries (T021-T024, T032-T035) before API endpoints that use them
- Core implementation (T021-T040) before Integration (T041-T045)
- Integration (T041-T045) before Polish (T046-T052)

### Parallel Execution Blocks
- **Block 1**: T003, T004, T005, T006, T007 (setup tasks)
- **Block 2**: T008-T020 (all test tasks - different files)
- **Block 3**: T021-T024, T027-T031, T032-T035 (libraries and models)
- **Block 4**: T046, T047, T050 (unit tests and docs)

## Parallel Example
```bash
# Epic 1 Priority - Launch resume ingestion tests together:
Task: "Contract test POST /api/upload-resume in tests/contract/test_upload_resume.spec.ts"
Task: "Contract test GET /api/resumes/[id] in tests/contract/test_get_resume.spec.ts"
Task: "Integration test resume upload flow in tests/integration/test_resume_upload.spec.ts"
Task: "Integration test file parsing validation in tests/integration/test_file_parsing.spec.ts"

# Libraries and models can be developed in parallel:
Task: "Resume parser library with CLI in src/lib/resume-parser/index.ts"
Task: "Resume model and types in src/types/resume.ts"
Task: "User profile model and types in src/types/profile.ts"
```

## Epic 1: Resume Ingestion Focus
**Priority Tasks (Complete First)**: T008-T011, T021-T026, T027-T028
- These tasks implement FR-001 to FR-005 (file upload, parsing, preview)
- Must be completed and tested before other epics
- Critical path: Tests → Parser library → Upload API → Models

## Notes
- [P] tasks = different files, no dependencies
- Verify tests fail before implementing (TDD requirement)
- Commit after each task completion
- Epic 1 tasks take priority over other features
- All file paths are relative to repository root
- Supabase migrations must include RLS policies

## Validation Checklist
*GATE: All items must be checked before tasks are considered complete*

- [✅] All 6 contracts have corresponding test tasks (T008-T016)
- [✅] All 5 entities have model creation tasks (T027-T031)
- [✅] All tests come before implementation (Phase 3.2 before 3.3)
- [✅] Parallel tasks are truly independent (different files)
- [✅] Each task specifies exact file path
- [✅] No [P] task modifies same file as another [P] task
- [✅] Epic 1 Resume Ingestion prioritized (T008-T026)
- [✅] Constitutional compliance: Library-first, CLI interfaces, TDD enforced