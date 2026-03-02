# Implementation Plan: History View - Previous Optimizations

**Branch**: `005-history-view-previous` | **Date**: 2025-10-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-history-view-previous/spec.md`

## Summary

This feature implements a comprehensive history view for users to manage their resume optimization history. The primary requirement is a dedicated `/dashboard/history` page that displays all previous optimizations in a table format with filtering, searching, sorting, and bulk action capabilities. The technical approach leverages the existing Next.js App Router architecture with client-side state management for filters and pagination, integrating with the existing `/api/optimizations` endpoint (which requires refinement) and Supabase database.

**Core Capabilities**:
- View all optimizations in a sortable, filterable table
- Quick apply functionality from history (already working)
- Advanced search and filtering (date range, ATS score, text search)
- Bulk actions (delete, export) with proper confirmations
- Client-side pagination for performance

## Technical Context

**Language/Version**: TypeScript 5.x with Next.js 14 (App Router)
**Primary Dependencies**: Next.js, React 18, shadcn/ui, Tailwind CSS, Supabase Client, date-fns
**Storage**: Supabase PostgreSQL (tables: `optimizations`, `applications`, `resumes`, `job_descriptions`)
**Testing**: Jest + React Testing Library for components, Playwright for E2E
**Target Platform**: Web (modern browsers, responsive design)
**Project Type**: Web application (Next.js full-stack)
**Performance Goals**: <2s initial page load for 100 optimizations, <200ms search filter updates, <300ms sorting
**Constraints**: Client-side pagination (fetch all, paginate in browser), RLS policies for multi-tenant data isolation
**Scale/Scope**: Support up to 100 optimizations per user initially, expand to 500+ with server-side pagination in future

## Constitution Check

*GATE: Constitution file is a template placeholder - no specific constraints defined. Proceeding with Next.js/React best practices.*

**Default Principles Applied**:
- **Component Modularity**: Build reusable UI components for table, filters, actions
- **Type Safety**: Strict TypeScript for all data structures and API contracts
- **Performance First**: Debounced search, optimistic UI updates, skeleton loading states
- **Accessibility**: ARIA labels, keyboard navigation, screen reader support
- **Testing**: Unit tests for utilities, integration tests for API endpoints, E2E for critical flows

## Project Structure

### Documentation (this feature)

```
specs/005-history-view-previous/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output (technical research)
├── data-model.md        # Phase 1 output (database schema & types)
├── quickstart.md        # Phase 1 output (setup & testing guide)
└── contracts/           # Phase 1 output (API contracts, type definitions)
    ├── api-optimizations.md
    ├── history-types.ts
    └── filter-types.ts
```

### Source Code (repository root)

```
resume-builder-ai/
├── src/
│   ├── app/
│   │   └── dashboard/
│   │       └── history/
│   │           ├── page.tsx                    # Main history page component
│   │           ├── loading.tsx                 # Loading state
│   │           └── error.tsx                   # Error boundary
│   ├── components/
│   │   └── history/
│   │       ├── HistoryTable.tsx               # Main table component
│   │       ├── HistoryFilters.tsx             # Search & filter controls
│   │       ├── HistoryPagination.tsx          # Client-side pagination
│   │       ├── OptimizationRow.tsx            # Individual table row
│   │       ├── BulkActions.tsx                # Bulk delete/export toolbar
│   │       ├── EmptyState.tsx                 # No optimizations state
│   │       └── HistoryTableSkeleton.tsx       # Loading skeleton
│   ├── lib/
│   │   ├── api/
│   │   │   └── optimizations.ts               # Client-side API calls
│   │   └── utils/
│   │       ├── history-filters.ts             # Filter & sort utilities
│   │       ├── history-export.ts              # ZIP generation for bulk export
│   │       └── history-pagination.ts          # Pagination logic
│   └── types/
│       └── history.ts                         # TypeScript type definitions
├── supabase/
│   └── migrations/
│       └── [timestamp]_add_applications_table.sql  # Applications table migration (if needed)
└── tests/
    ├── components/
    │   └── history/
    │       ├── HistoryTable.test.tsx
    │       ├── HistoryFilters.test.tsx
    │       └── BulkActions.test.tsx
    ├── integration/
    │   └── api/
    │       └── optimizations.test.ts
    └── e2e/
        └── history-view.spec.ts
```

**Structure Decision**: Using Next.js App Router structure with feature-based organization. All history-related components live in `src/components/history/`, with the main page at `src/app/dashboard/history/page.tsx`. This aligns with the existing dashboard structure and keeps related code colocated.

## Complexity Tracking

*No constitutional violations - using standard Next.js patterns.*

## Phase 0: Research

*See [research.md](./research.md) for detailed findings.*

**Key Research Areas**:
1. ✅ API endpoint `/api/optimizations` exists but needs refinement for required fields
2. ✅ Database schema review for `optimizations`, `applications` tables
3. ✅ Existing "Apply Now" functionality analysis (already working - exclude from tasks)
4. ✅ shadcn/ui components available: Table, Button, Input, Select, Dialog, Badge
5. ✅ Client-side filtering/sorting patterns in Next.js
6. ✅ Bulk export with JSZip library for ZIP generation

## Phase 1: Design

### Data Model

*See [data-model.md](./data-model.md) for complete schema.*

**Primary Types**:
```typescript
interface OptimizationHistoryEntry {
  id: string
  user_id: string
  resume_id: string
  job_description_id: string
  created_at: string
  job_title: string
  company_name: string
  ats_match_score: number
  status: 'pending' | 'completed' | 'failed'
  job_url?: string | null
  application?: ApplicationRecord | null
}

interface FilterState {
  searchText: string
  dateRange: 'all' | 'last7days' | 'last30days' | 'last90days' | 'custom'
  customDateStart?: string
  customDateEnd?: string
  atsScoreMin: number  // 0, 70, 80, 90
  sortBy: 'date' | 'company' | 'ats_score'
  sortDirection: 'asc' | 'desc'
}

interface BulkSelectionState {
  selectedIds: Set<string>
  isAllSelected: boolean
}
```

### API Contracts

*See [contracts/api-optimizations.md](./contracts/api-optimizations.md) for full specification.*

**Endpoint: GET /api/optimizations**
- **Purpose**: Fetch all optimizations for authenticated user
- **Query Params**: None (client-side filtering)
- **Response**: `{ optimizations: OptimizationHistoryEntry[], total: number }`
- **Required Refinements**: Include job_title, company_name, job_url, application status

**Endpoint: POST /api/optimizations/bulk-delete**
- **Purpose**: Delete multiple optimizations
- **Body**: `{ optimization_ids: string[] }`
- **Response**: `{ deleted: number, preserved_applications: number }`

**Endpoint: POST /api/optimizations/bulk-export**
- **Purpose**: Generate ZIP of multiple optimization PDFs
- **Body**: `{ optimization_ids: string[] }`
- **Response**: ZIP file download

### Component Architecture

```
HistoryPage (Server Component)
├── HistoryTable (Client Component)
│   ├── HistoryFilters (search, date range, ATS filter, sort)
│   ├── BulkActions (delete, export, select all/none)
│   ├── OptimizationRow[] (view, download, apply actions)
│   └── HistoryPagination (client-side, 20 per page)
└── EmptyState (when no optimizations)
```

## Phase 2: Implementation Tasks

*Tasks will be generated via `/tasks` command after design artifacts are complete.*

**Task Categories** (preview):
1. **API Refinement**: Update `/api/optimizations` endpoint to return required fields
2. **Core UI**: Build HistoryTable, OptimizationRow, EmptyState components
3. **Filtering**: Implement search, date range, ATS score filters with debouncing
4. **Pagination**: Client-side pagination logic
5. **Bulk Actions**: Delete and export functionality with confirmations
6. **Testing**: Unit, integration, E2E test coverage
7. **Polish**: Loading states, error handling, accessibility

## Progress Tracking

- [x] Phase 0: Research completed
- [x] Phase 1: Design artifacts generated (data-model.md, contracts/, quickstart.md)
- [ ] Phase 2: Tasks generated (run `/tasks` command)
- [ ] Phase 3: Implementation & testing
- [ ] Phase 4: Code review & deployment

## Dependencies & Risks

**External Dependencies**:
- shadcn/ui components (already in project)
- JSZip for bulk PDF export (npm install required)
- date-fns for date filtering (already in project)

**Risks**:
1. **API Performance**: Fetching 100+ optimizations may be slow - mitigated by loading states and future server-side pagination
2. **PDF Availability**: Bulk export may fail if PDFs missing - mitigated by manifest.txt in ZIP
3. **Browser Memory**: Large datasets with client-side filtering - mitigated by 20-item pagination

**Mitigation Strategies**:
- Implement skeleton loading states for perceived performance
- Add retry logic for failed PDF downloads
- Monitor bundle size and optimize with code splitting if needed

## Next Steps

1. Generate Phase 0 research artifact: `research.md`
2. Generate Phase 1 design artifacts: `data-model.md`, `contracts/`, `quickstart.md`
3. Run `/tasks` command to generate actionable task breakdown
4. Begin implementation starting with P1 user stories
