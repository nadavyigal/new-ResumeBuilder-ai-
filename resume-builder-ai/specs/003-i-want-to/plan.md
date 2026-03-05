
# Implementation Plan: AI-Powered Resume Design Selection

**Branch**: `003-i-want-to` | **Date**: 2025-10-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/003-i-want-to/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path ✓
   → Feature spec loaded and validated
2. Fill Technical Context ✓
   → Next.js 15 web application with Supabase backend
   → React SSR templates from external library integration needed
3. Fill the Constitution Check section ✓
4. Evaluate Constitution Check section
   → In progress - evaluating library-first compliance
5. Execute Phase 0 → research.md
   → Pending
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md
   → Pending
7. Re-evaluate Constitution Check section
   → Pending
8. Plan Phase 2 → Describe task generation approach
   → Pending
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 8. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
This feature enables users to select and customize resume designs after optimization. Users see their resume rendered with one AI-recommended design by default, can browse all available templates from an external library (minimal, card, timeline, sidebar styles), and customize design aspects (colors, fonts, layout) through natural language AI chat. Changes apply immediately with undo/revert capabilities. The system leverages existing chat infrastructure (Feature 002) and integrates React SSR templates from the resume-style-bank library.

## Technical Context
**Language/Version**: TypeScript 5.9.2, Next.js 15.5.2, React 19.1.0
**Primary Dependencies**: OpenAI GPT-4 (chat), React SSR (template rendering), Supabase PostgreSQL (storage), Puppeteer (PDF export)
**Storage**: Supabase PostgreSQL with Row Level Security (design templates, customizations, assignments)
**Testing**: Jest/Vitest for unit tests, integration tests for API contracts, E2E tests for user flows
**Target Platform**: Web (Next.js SSR + client-side React), serverless Edge Functions
**Project Type**: Web application (frontend + backend)
**Performance Goals**:
- Design preview rendering: < 5 seconds (FR-007)
- AI chat design modification: < 7 seconds (existing chat infrastructure target)
- Template switching: < 2 seconds (client-side React re-render)
**Constraints**:
- ATS compatibility must be maintained (no images, complex tables, or graphics)
- External template library compatibility with existing resume data schema
- Immediate application with single-level undo (only last change)
- Single active design version storage (no version history)
**Scale/Scope**:
- 4 initial design templates (minimal, card-based, timeline, sidebar)
- Unlimited design iterations for all tiers (no rate limiting initially)
- Available to both free and premium users

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Verify compliance with all constitutional principles from `.specify/memory/constitution.md`:

- [x] **Library-First**: Feature designed as standalone library in `src/lib/design-manager/`
- [x] **CLI Interface**: Library exposes CLI for template rendering and customization testing
- [x] **TDD**: Test scenarios defined before implementation (contract tests for API endpoints)
- [x] **Integration Testing**: Template rendering, AI chat integration, export pipeline integration tested
- [x] **Observability**: Structured logging for template rendering failures, AI chat errors, customization validation
- [x] **Versioning**: API versioned at `/api/v1/design/*` following existing pattern
- [x] **Simplicity**: Reuses existing chat infrastructure (Feature 002), no new abstractions for undo (single state storage)

**Performance Verification**:
- [x] Response time targets defined: 5s preview rendering, 2s template switching
- [x] Resource constraints identified: External template library integration, React SSR memory limits

**Status**: ✅ PASS - No constitutional violations. Leverages existing infrastructure and follows library-first pattern.

## Project Structure

### Documentation (this feature)
```
specs/003-i-want-to/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
│   ├── design-templates-api.yaml
│   ├── design-customization-api.yaml
│   └── design-chat-api.yaml
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
resume-builder-ai/
├── src/
│   ├── lib/
│   │   ├── design-manager/              # NEW: Design selection & customization library
│   │   │   ├── index.ts                 # Public API exports
│   │   │   ├── template-loader.ts       # Load and validate external templates
│   │   │   ├── template-renderer.ts     # SSR rendering of React templates
│   │   │   ├── design-recommender.ts    # AI-based template recommendation
│   │   │   ├── customization-engine.ts  # Apply color/font/layout changes
│   │   │   ├── undo-manager.ts          # Single-level undo state management
│   │   │   ├── ats-validator.ts         # Ensure ATS compatibility
│   │   │   └── cli.ts                   # CLI interface for testing
│   │   ├── chat-manager/                # EXISTING: Reuse for design iteration
│   │   ├── template-engine/             # EXISTING: Integrate with design output
│   │   └── supabase/                    # EXISTING: Add design-specific DB wrappers
│   │       ├── design-templates.ts      # NEW: Design template CRUD
│   │       ├── design-customizations.ts # NEW: Customization storage
│   │       └── resume-designs.ts        # NEW: Resume-design assignments
│   ├── app/
│   │   └── api/
│   │       └── v1/
│   │           ├── design/              # NEW: Design API routes
│   │           │   ├── templates/
│   │           │   │   └── route.ts     # GET all templates, GET :id preview
│   │           │   ├── [optimizationId]/
│   │           │   │   ├── route.ts     # GET current design, PUT update design
│   │           │   │   ├── customize/
│   │           │   │   │   └── route.ts # POST AI customization request
│   │           │   │   ├── undo/
│   │           │   │   │   └── route.ts # POST undo last change
│   │           │   │   └── revert/
│   │           │   │       └── route.ts # POST revert to original template
│   │           │   └── recommend/
│   │           │       └── route.ts     # POST get AI-recommended template
│   │           └── chat/                # EXISTING: Extend for design chat
│   └── components/
│       ├── design/                      # NEW: Design UI components
│       │   ├── DesignBrowser.tsx        # Browse all templates
│       │   ├── DesignPreview.tsx        # Full-page template preview
│       │   ├── DesignCustomizer.tsx     # Chat interface for customization
│       │   ├── TemplateCard.tsx         # Individual template thumbnail
│       │   └── UndoControls.tsx         # Undo/revert buttons
│       └── templates/                   # EXISTING: May need updates for design integration
├── tests/
│   ├── contract/
│   │   └── design-api.test.ts           # API contract tests
│   ├── integration/
│   │   ├── design-rendering.test.ts     # Template rendering integration
│   │   ├── design-chat.test.ts          # Chat-based customization flow
│   │   └── design-export.test.ts        # Export with custom designs
│   └── unit/
│       └── lib/
│           └── design-manager/          # Unit tests for library functions
└── supabase/
    └── migrations/
        └── 20251008_add_design_tables.sql   # NEW: Database schema for designs
```

**Structure Decision**: Web application structure selected. Feature follows library-first pattern with `src/lib/design-manager/` as the core library, API routes in `src/app/api/v1/design/`, and UI components in `src/components/design/`. Reuses existing chat infrastructure from Feature 002 and integrates with existing template engine for export.

## Phase 0: Outline & Research
*Status: Pending execution*

### Research Tasks Identified

1. **External Template Library Integration**
   - Task: Research React SSR template loading from external file system paths
   - Context: Templates located at `C:\Users\nadav\OneDrive\מסמכים\AI\cursor\cursor playground\AI Travel Club\resume-style-bank`
   - Questions: How to dynamically import React components from external paths? Security implications? Module resolution strategies?
   - Output: Decision on template loading mechanism (dynamic import vs. copy to project)

2. **React SSR Rendering in Next.js 15**
   - Task: Find best practices for server-side rendering React components to HTML/PDF
   - Context: Need to render resume-style-bank React templates with user data
   - Questions: Use Next.js SSR, Puppeteer with static HTML, or hybrid approach? Performance implications?
   - Output: Rendering architecture decision with performance benchmarks

3. **Undo State Management**
   - Task: Research single-level undo patterns for immediate application with rollback
   - Context: Changes apply immediately, undo reverts to previous state (not full history)
   - Questions: Store previous state in memory vs. database? Session-based vs. persistent?
   - Output: Undo implementation strategy (likely in-memory during session, DB on finalization)

4. **AI Template Recommendation**
   - Task: Research AI-based design recommendation strategies
   - Context: Recommend 1 template based on resume content, industry, role
   - Questions: Use GPT-4 with template descriptions? Rule-based heuristics? Embeddings similarity?
   - Output: Recommendation algorithm design

5. **ATS Compatibility Validation**
   - Task: Research ATS-safe design constraints and validation rules
   - Context: Must prevent users from applying non-ATS-safe customizations
   - Questions: Which CSS properties break ATS parsing? How to validate generated HTML?
   - Output: ATS validation rules and implementation approach

6. **Design Customization Interpretation**
   - Task: Research GPT-4 prompt engineering for design modification requests
   - Context: Interpret "make headers blue" → CSS color changes, "more compact" → spacing adjustments
   - Questions: How to structure prompts for reliable CSS output? Validation of AI-generated styles?
   - Output: Prompt templates and validation strategy

**Output**: `research.md` with all decisions documented (see Phase 0 execution below)

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

### Entities (data-model.md)

**Design Template**
- `id`: UUID (primary key)
- `name`: String (e.g., "Minimal Modern", "Card Layout")
- `slug`: String (unique, URL-safe, e.g., "minimal-modern")
- `category`: Enum (modern, traditional, creative, corporate)
- `description`: Text (short description for browsing)
- `file_path`: String (path to template React component in external library)
- `preview_thumbnail_url`: String (Supabase Storage URL for thumbnail)
- `is_premium`: Boolean (false for MVP - all free)
- `ats_compatibility_score`: Integer (1-100, all should be high for MVP)
- `supported_customizations`: JSONB ({colors: true, fonts: true, layout: true})
- `default_config`: JSONB (default color scheme, fonts, spacing)
- `created_at`: Timestamp
- `updated_at`: Timestamp

**Design Customization**
- `id`: UUID (primary key)
- `template_id`: UUID (foreign key → design_templates.id)
- `color_scheme`: JSONB ({primary: "#hex", secondary: "#hex", accent: "#hex"})
- `font_family`: JSONB ({headings: "Font Name", body: "Font Name"})
- `spacing_settings`: JSONB ({compact: boolean, lineHeight: number})
- `layout_variant`: String (nullable, e.g., "two-column", "sidebar-left")
- `custom_css`: Text (nullable, validated AI-generated CSS)
- `is_ats_safe`: Boolean (validation result)
- `created_at`: Timestamp

**Resume Design Assignment**
- `id`: UUID (primary key)
- `user_id`: UUID (foreign key → profiles.user_id)
- `optimization_id`: UUID (foreign key → optimizations.id, unique)
- `template_id`: UUID (foreign key → design_templates.id)
- `customization_id`: UUID (nullable, foreign key → design_customizations.id)
- `previous_customization_id`: UUID (nullable, for undo - single level)
- `original_template_id`: UUID (foreign key → design_templates.id, for revert)
- `is_active`: Boolean (always true for single version storage)
- `finalized_at`: Timestamp (nullable, when user exits design session)
- `created_at`: Timestamp
- `updated_at`: Timestamp

**Design Change Request** (extends chat_messages from Feature 002)
- Stored as `chat_messages` with `metadata.type = "design_change"`
- `metadata.requested_change`: String (user's natural language request)
- `metadata.interpreted_params`: JSONB (parsed customization parameters)
- `metadata.applied_customization_id`: UUID (resulting customization)
- `metadata.validation_status`: Enum (valid, ats_violation, unclear)

**Relationships**
- `design_templates` 1:N `design_customizations` (one template, many custom variants)
- `design_templates` 1:N `resume_design_assignments` (one template, many resumes)
- `optimizations` 1:1 `resume_design_assignments` (each optimization has one design)
- `resume_design_assignments` N:1 `design_customizations` (many assignments can share customizations)
- `chat_sessions` 1:N `design_change_requests` (via chat_messages table)

### API Contracts (contracts/ directory)

**Design Templates API** (`contracts/design-templates-api.yaml`)
```yaml
GET /api/v1/design/templates
- Response: Array of DesignTemplate objects with preview URLs
- Query params: category (optional filter)

GET /api/v1/design/templates/:templateId/preview
- Response: Rendered HTML preview with sample data
- Query params: optimizationId (optional, use user's actual data)

POST /api/v1/design/recommend
- Request: { optimizationId: UUID, resumeData: ResumeJSON }
- Response: { recommendedTemplateId: UUID, reasoning: String }
```

**Design Assignment API** (`contracts/design-assignment-api.yaml`)
```yaml
GET /api/v1/design/:optimizationId
- Response: Current ResumeDesignAssignment with template and customization details

PUT /api/v1/design/:optimizationId
- Request: { templateId: UUID }
- Response: Updated ResumeDesignAssignment
- Action: Switches template, resets customizations

POST /api/v1/design/:optimizationId/customize
- Request: { changeRequest: String (natural language) }
- Response: { customizationId: UUID, preview: String, changes: CustomizationDiff }
- Action: Uses AI to interpret request, generates customization, applies immediately

POST /api/v1/design/:optimizationId/undo
- Request: {}
- Response: { customizationId: UUID (previous), preview: String }
- Action: Reverts to previous_customization_id

POST /api/v1/design/:optimizationId/revert
- Request: {}
- Response: { templateId: UUID (original), preview: String }
- Action: Resets to original_template_id with no customizations
```

### Contract Tests (tests/contract/)

One test file per endpoint group:
- `design-templates.contract.test.ts` - Tests GET /templates, GET /templates/:id/preview, POST /recommend
- `design-assignment.contract.test.ts` - Tests GET/PUT /:optimizationId, POST /customize, POST /undo, POST /revert

Tests must:
1. Validate request/response schemas against OpenAPI specs
2. Assert correct HTTP status codes (200, 400, 404, 500)
3. Verify authentication/authorization (RLS enforcement)
4. Initially fail (no implementation yet)

### Integration Test Scenarios (tests/integration/)

**Design Rendering Integration** (`design-rendering.test.ts`)
- Load external template from resume-style-bank
- Render with user's resume data
- Assert HTML output contains expected content
- Verify rendering completes within 5 seconds

**Design Chat Integration** (`design-chat.test.ts`)
- Create chat session for design customization
- Send natural language design change request
- Assert AI interprets request correctly
- Assert customization applies immediately
- Verify undo reverts to previous state

**Design Export Integration** (`design-export.test.ts`)
- Select custom design for optimization
- Apply customizations (colors, fonts)
- Export to PDF
- Assert PDF reflects custom design
- Verify ATS compatibility maintained

### Quickstart Scenario (quickstart.md)

User story validation test:
1. User completes resume optimization (dependency: Feature 001)
2. System automatically applies recommended design template
3. User browses all available templates
4. User selects "Card Layout" template
5. User opens design chat, requests "make headers dark blue"
6. System applies change immediately, user sees preview
7. User requests "use a more professional font"
8. System applies font change
9. User clicks undo, system reverts font change
10. User finalizes design, exports to PDF
11. Verify exported PDF has Card Layout with blue headers

**Output**: data-model.md, /contracts/*, failing contract tests, quickstart.md

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs:
  - **Database migration**: Create design_templates, design_customizations, resume_design_assignments tables
  - **Seed data**: Import 4 initial templates from resume-style-bank
  - **Library implementation**: design-manager library with all modules (template-loader, renderer, customization-engine, etc.)
  - **API routes**: 7 endpoints for template browsing, assignment, customization, undo/revert
  - **UI components**: DesignBrowser, DesignPreview, DesignCustomizer, UndoControls
  - **Chat integration**: Extend chat-manager for design change interpretation
  - **Export integration**: Update template-engine to use selected designs
  - **Contract tests**: Implement failing tests from Phase 1
  - **Integration tests**: Implement design rendering, chat, and export integration tests
  - **CLI testing**: Implement CLI for template rendering and customization testing

**Ordering Strategy** (TDD order):
1. **[P]** Database migration (independent)
2. **[P]** Seed design templates from external library (independent)
3. Contract tests for templates API (test first)
4. Template loader library implementation
5. Template renderer library implementation
6. Templates API routes implementation (make tests pass)
7. Contract tests for design assignment API
8. Design assignment library implementation
9. Design assignment API routes
10. **[P]** AI design recommendation research & implementation
11. Contract tests for customization API
12. Customization engine library implementation
13. ATS validator library implementation
14. Chat integration for design changes
15. Customization API routes implementation
16. Undo manager library implementation
17. Undo/revert API routes
18. **[P]** UI components (DesignBrowser, DesignPreview, TemplateCard)
19. DesignCustomizer component (chat interface)
20. UndoControls component
21. Integration tests - design rendering
22. Integration tests - design chat flow
23. Export integration (template-engine updates)
24. Integration tests - export with custom designs
25. CLI implementation and testing
26. Quickstart scenario execution
27. Performance validation (5s preview, 2s switching)

**Estimated Output**: ~27 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles)
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |

**Status**: No constitutional violations. Design follows library-first pattern, reuses existing chat infrastructure, and maintains simplicity with single-level undo.

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command) ✅
- [x] Phase 1: Design complete (/plan command) ✅
- [x] Phase 2: Task planning complete (/plan command - describe approach only) ✅
- [x] Phase 3: Tasks generated (/tasks command) ✅
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved: YES (research.md complete)
- [x] Complexity deviations documented: N/A (no violations)

**Phase 1 Artifacts Generated**:
- [x] research.md (6 research decisions documented)
- [x] data-model.md (4 entities, relationships, migrations)
- [x] contracts/design-api.yaml (OpenAPI 3.0 spec, 7 endpoints)
- [x] quickstart.md (12-step end-to-end test scenario)
- [x] CLAUDE.md updated (Feature 003 context added)

**Phase 3 Artifacts Generated**:
- [x] tasks.md (50 tasks in TDD order, parallel execution markers)
- [x] Task dependencies documented (critical path + blocking dependencies)
- [x] Parallel execution examples provided (3 examples)
- [x] Estimated completion time: 20-24 hours with parallelization

---
*Based on Constitution v1.0.0 - See `.specify/memory/constitution.md`*
