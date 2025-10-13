# Tasks: History View - Previous Optimizations

**Input**: Design documents from `/specs/005-history-view-previous/`
**Prerequisites**: ✅ plan.md, ✅ spec.md, ✅ research.md, ✅ data-model.md, ✅ contracts/

**Feature Branch**: `005-history-view-previous`
**Estimated Total Effort**: 6-8 days for P1-P3 (MVP + core features), +2-3 days for P4 (optional)

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions
Web application structure (Next.js App Router):
- Frontend pages: `resume-builder-ai/src/app/dashboard/history/`
- API routes: `resume-builder-ai/src/app/api/optimizations/`
- Components: `resume-builder-ai/src/components/history/`
- Hooks: `resume-builder-ai/src/hooks/`
- Types: `resume-builder-ai/src/types/`
- Tests: `resume-builder-ai/tests/`
- Database: `supabase/migrations/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database optimization and project structure preparation

- [x] **T001** [P] Create database indexes migration file at `supabase/migrations/20251013000000_add_history_indexes.sql` with indexes for `optimizations(user_id, created_at DESC)` and `optimizations(match_score)`
- [x] **T002** [P] Create TypeScript type definitions file at `resume-builder-ai/src/types/history.ts` with `OptimizationsQueryParams`, `OptimizationsResponse`, `OptimizationHistoryEntry`, `PaginationMeta`, `HistoryPageState`, `HistoryFilters`, `SortConfig`, `BulkOperationState` interfaces
- [x] **T003** [P] Create directory structure: `resume-builder-ai/src/components/history/`, `resume-builder-ai/src/hooks/`, and `resume-builder-ai/tests/e2e/history/`

**Checkpoint**: Infrastructure ready - user story implementation can begin

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core API endpoint and data fetching hook that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] **T004** Implement GET `/api/optimizations` route handler at `resume-builder-ai/src/app/api/optimizations/route.ts` with query parameter parsing, authentication check, Supabase query with joins (optimizations → job_descriptions, applications), filtering (date, score), sorting, pagination, and response transformation per API contract
- [x] **T005** Create custom React hook `useOptimizations` at `resume-builder-ai/src/hooks/useOptimizations.ts` for data fetching with React Query/SWR, query parameter management, loading/error states, and cache invalidation helpers
- [x] **T006** [P] Write API contract tests at `resume-builder-ai/tests/integration/api-optimizations.test.ts` covering: default request returns 200 with valid structure, pagination parameters respected, date range filtering, score filtering, unauthorized returns 401, invalid params return 400, RLS enforcement (user A cannot see user B's data)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - View All Previous Optimizations (Priority: P1) 🎯 MVP

**Goal**: Users can view comprehensive list of all optimizations with key details in a table

**Independent Test**: Navigate to `/dashboard/history` and verify table displays with Date Created, Job Title, Company, ATS Match %, Status, and Actions columns

### Implementation for User Story 1

- [x] **T007** [P] [US1] Create history page at `resume-builder-ai/src/app/dashboard/history/page.tsx` with page layout, heading, and Suspense wrapper for HistoryTable component
- [x] **T008** [P] [US1] Create HistoryTableSkeleton component at `resume-builder-ai/src/components/history/HistoryTableSkeleton.tsx` with loading skeleton UI using shadcn/ui Table component showing shimmer effect for 5 placeholder rows
- [x] **T009** [P] [US1] Create EmptyState component at `resume-builder-ai/src/components/history/EmptyState.tsx` with helpful illustration, message "You haven't created any optimizations yet", and CTA button linking to `/dashboard/resume`
- [x] **T010** [US1] Create HistoryTable component at `resume-builder-ai/src/components/history/HistoryTable.tsx` with `useOptimizations` hook integration, Table component (shadcn/ui), columns for Date, Job Title, Company, ATS Match %, Status, conditional rendering (loading skeleton, empty state, error banner, data table)
- [x] **T011** [US1] Create OptimizationRow component at `resume-builder-ai/src/components/history/OptimizationRow.tsx` with TableRow (shadcn/ui), formatted date display, job title/company (with "N/A" fallback), formatted match score percentage, status badge, action buttons container
- [x] **T012** [US1] Add "View Details" action to OptimizationRow: Link button using Next.js Link component navigating to `/dashboard/optimizations/[id]`
- [x] **T013** [US1] Add "Download PDF" action to OptimizationRow: Button that calls existing `/api/download/[id]` endpoint and triggers browser download using `window.open()` or `<a download>`
- [x] **T014** [P] [US1] Write E2E tests at `resume-builder-ai/tests/e2e/history/view-history.spec.ts` covering: navigate to history page, verify table displays multiple optimizations sorted by date desc, verify empty state shows for new users, click "View Details" navigates to optimization page, click "Download PDF" triggers download, loading skeleton displays during fetch

**Checkpoint**: User Story 1 is fully functional - users can view optimization history and access details independently

---

## Phase 4: User Story 2 - Quick Apply from History (Priority: P2)

**Goal**: Users can apply to jobs directly from history view with one click

**Independent Test**: Click "Apply Now" on a history table row and verify PDF downloads, job URL opens, application record created, success toast shown

### Implementation for User Story 2

- [x] **T015** [US2] Add "Apply Now" button to OptimizationRow component: Button component that triggers apply flow (disabled if no job URL), loading state during apply, disabled state after apply with "Applied" label
- [x] **T016** [US2] Implement apply flow handler in HistoryTable component: Function that calls `POST /api/applications` (existing endpoint) with optimization data, triggers `GET /api/download/[id]` for PDF download, opens job URL in new tab using `window.open(jobUrl, '_blank')`, shows success toast notification, updates local state to show "Applied" badge, handles errors with error toast
- [x] **T017** [US2] Add "Applied" badge logic to OptimizationRow: Check if `hasApplication` is true, display Badge component (shadcn/ui) with "Applied" text and application status color, show application date on hover (Tooltip component)
- [x] **T018** [US2] Add toast notifications using shadcn/ui Toast: Success toast on successful apply, error toast on API failures with retry option, warning toast if applying to already-applied optimization
- [x] **T019** [US2] Implement optimistic UI updates: Update row state immediately on "Apply Now" click, revert if API call fails, invalidate React Query cache after successful apply to refresh data
- [x] **T020** [P] [US2] Write E2E tests at `resume-builder-ai/tests/e2e/history/quick-apply.spec.ts` covering: click "Apply Now" on row with job URL downloads PDF, job URL opens in new tab, application record created in database, success toast displayed, "Applied" badge appears on row, badge persists after page reload, apply to optimization without job URL only downloads PDF, warning shown when applying to already-applied optimization

**Checkpoint**: User Stories 1 AND 2 both work independently - users can view history and apply to jobs

---

## Phase 5: User Story 3 - Filter and Search Optimizations (Priority: P3)

**Goal**: Users can filter history by date range, company, ATS score, and search by job title/company name

**Independent Test**: Type in search box, apply date range filter, apply score filter, verify table updates with filtered results only

### Implementation for User Story 3

- [x] **T021** [P] [US3] Create HistorySearch component at `resume-builder-ai/src/components/history/HistorySearch.tsx` with Input component (shadcn/ui) with search icon, debounced onChange handler (300ms), clear button (X icon), placeholder "Search by job title or company..."
- [x] **T022** [P] [US3] Create HistoryFilters component at `resume-builder-ai/src/components/history/HistoryFilters.tsx` with date range picker using shadcn/ui Calendar + Popover (options: Last 7 days, Last 30 days, Last 90 days, Custom range), ATS score filter dropdown using Select component (options: All, 90%+, 80%+, 70%+), "Clear Filters" button that resets all filters
- [x] **T023** [P] [US3] Create HistoryPagination component at `resume-builder-ai/src/components/history/HistoryPagination.tsx` with Pagination component (shadcn/ui) or custom pagination controls, page numbers with Previous/Next buttons, items per page selector (20, 50, 100), total count display
- [x] **T024** [P] [US3] Create filter utility functions at `resume-builder-ai/src/lib/history-utils.ts` with `applySearchFilter(optimizations, searchText)` for client-side filtering, `buildQueryParams(filters, sort, pagination)` to construct URL params, `parseQueryParams(searchParams)` to extract filters from URL, `sanitizeSearchQuery(query)` to prevent XSS
- [x] **T025** [US3] Integrate HistorySearch into HistoryTable: Add HistorySearch component above table, connect to filter state, update URL params on search change, debounce API calls (300ms)
- [x] **T026** [US3] Integrate HistoryFilters into HistoryTable: Add HistoryFilters component above table, connect to filter state, trigger API refetch on filter change (debounced 500ms), update URL params on filter change, show active filter count badge
- [x] **T027** [US3] Integrate HistoryPagination into HistoryTable: Add HistoryPagination component below table, connect to pagination state from API response, update URL params on page change, handle page change without full page reload
- [x] **T028** [US3] Implement column sorting in HistoryTable: Add sort icons to column headers (Date, Company, ATS Match %), toggle sort direction on header click (asc/desc), update URL params with sort state, highlight active sort column
- [x] **T029** [US3] Implement URL state synchronization: Use Next.js `useRouter` and `useSearchParams`, sync filters/pagination/sort with URL query params, parse URL params on page load to restore state, enable bookmarking of filtered views
- [x] **T030** [US3] Add "No results" state: Show message when filters result in empty list, display "No optimizations match your filters. Try adjusting your search criteria.", provide "Clear Filters" button in empty state
- [x] **T031** [P] [US3] Write utility function tests at `resume-builder-ai/tests/unit/history-utils.test.ts` covering: search filter matches job title (case-insensitive), search filter matches company name, search query sanitization prevents XSS, query param building with all filters, query param parsing from URL
- [x] **T032** [P] [US3] Write E2E tests at `resume-builder-ai/tests/e2e/history/filters-search.spec.ts` covering: type in search box filters results in real-time, select "Last 7 days" shows only recent optimizations, select "80%+" shows only high-scoring optimizations, combine multiple filters (search + date + score), click "Clear Filters" resets to default state, click column header sorts ascending, click again sorts descending, pagination shows correct page numbers, navigate to page 2 shows next 20 items, URL updates with filter state, reload page with URL params restores filters, "No results" state shows with impossible filters

**Checkpoint**: User Stories 1, 2, AND 3 all work independently - full-featured history with search/filter/sort

---

## Phase 6: User Story 4 - Bulk Actions on Optimizations (Priority: P4) ⚠️ OPTIONAL

**Goal**: Power users can select multiple optimizations and perform bulk delete or export operations

**Independent Test**: Select multiple rows via checkboxes, click "Delete Selected", verify confirmation dialog, confirm deletion removes rows from table

### Implementation for User Story 4

- [x] **T033** [P] [US4] Create BulkActions component at `resume-builder-ai/src/components/history/BulkActions.tsx` with "Delete Selected" button (disabled when no selections), "Export Selected" button (disabled when no selections), selection count display, "Select All" / "Deselect All" toggle button
- [x] **T034** [US4] Add checkbox column to HistoryTable: Checkbox in table header for "Select All", checkbox in each OptimizationRow, manage selection state in HistoryTable (Set<number>), render BulkActions when selections exist, sync selection state across pagination
- [x] **T035** [US4] Implement "Select All" / "Deselect All" logic: Header checkbox toggles all visible rows, update selection Set when individual checkboxes change, disable bulk actions when no selections, show selected count in BulkActions component
- [x] **T036** [P] [US4] Create bulk delete API route at `resume-builder-ai/src/app/api/optimizations/bulk/route.ts` with DELETE method, validate request body (array of IDs, max 50), verify ownership via RLS, delete optimizations in transaction, return deleted count and preserved applications count, handle partial failures
- [x] **T037** [US4] Add bulk delete confirmation dialog: Show Dialog component (shadcn/ui) when "Delete Selected" clicked, display count of items to be deleted, show warning if any have associated applications ("X of the selected optimizations have associated applications. These application records will be preserved."), require explicit confirmation (type "DELETE" or click confirm), show loading state during deletion
- [x] **T038** [US4] Implement bulk delete flow: Call `DELETE /api/optimizations/bulk` with selected IDs, show progress indicator during deletion, remove deleted rows from table on success, show success toast with deleted count, handle errors with error toast and retry option, clear selection after deletion
- [x] **T039** [P] [US4] Create bulk export API route at `resume-builder-ai/src/app/api/optimizations/export/route.ts` with POST method, validate request body (array of IDs, max 20), fetch optimization PDFs from storage or generate on-demand, create ZIP archive using JSZip library, include manifest.txt with optimization metadata, stream ZIP file as response, handle missing PDFs gracefully
- [x] **T040** [US4] Add JSZip dependency: Run `npm install jszip @types/jszip` in resume-builder-ai directory, add to package.json dependencies
- [x] **T041** [US4] Implement bulk export flow: Call `POST /api/optimizations/export` with selected IDs, show progress indicator with percentage (X of Y PDFs processed), trigger ZIP download when complete, show success toast with file count, handle errors (missing PDFs, timeout) with error toast, include failed items list in manifest.txt
- [x] **T042** [P] [US4] Write E2E tests at `resume-builder-ai/tests/e2e/history/bulk-actions.spec.ts` covering: click header checkbox selects all visible rows, click individual checkboxes updates selection, "Select All" button selects all rows on current page, "Deselect All" clears all selections, click "Delete Selected" shows confirmation dialog, confirmation dialog displays correct count and warnings, confirm deletion removes rows from table, success toast shows deleted count, bulk delete preserves application records, click "Export Selected" triggers ZIP download, ZIP contains correct number of PDFs, manifest.txt lists all optimizations, export handles missing PDFs gracefully, progress shown during long operations

**Checkpoint**: All user stories independently functional - full history management with bulk operations

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Performance optimization, error handling, and final polish

- [x] **T043** [P] Add error boundary to history page: Create ErrorBoundary component wrapping HistoryTable, show user-friendly error message with retry button, log errors to console/monitoring service
- [ ] **T044** [P] Add rate limiting to API endpoints: Implement rate limiting middleware (60 req/min per user), return 429 status with `X-RateLimit-Remaining` header, show rate limit error toast in UI
- [x] **T045** [P] Performance optimization - Database indexes: Apply indexes migration to staging/production, verify query performance <2s for 100 optimizations, monitor slow query logs
- [x] **T046** [P] Performance optimization - Frontend: Verify search debounce (300ms), verify filter debounce (500ms), add React.memo to OptimizationRow component, optimize re-renders with useMemo/useCallback
- [x] **T047** [P] Accessibility improvements: Add ARIA labels to interactive elements, ensure keyboard navigation works (Tab, Enter, Esc), test with screen reader, add focus indicators, ensure color contrast meets WCAG AA
- [ ] **T048** [P] Mobile responsive design: Test table on mobile (< 768px), implement horizontal scroll for table on small screens, optimize filter UI for mobile (collapsible panel), test touch interactions for checkboxes/buttons
- [ ] **T049** Verify quickstart.md instructions: Follow 30-minute quickstart guide from scratch, verify all file paths correct, verify commands work, update quickstart if any issues found
- [x] **T050** [P] Documentation updates: Update CLAUDE.md with history feature description, add inline code comments for complex logic, document API endpoint in OpenAPI/Swagger format (optional)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (T001-T003) completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Phase 2 (T004-T006) completion - No dependencies on other stories
- **User Story 2 (Phase 4)**: Depends on Phase 2 (T004-T006) completion AND Phase 3 (T007-T014) for OptimizationRow component
- **User Story 3 (Phase 5)**: Depends on Phase 2 (T004-T006) completion AND Phase 3 (T007-T014) for HistoryTable component
- **User Story 4 (Phase 6)**: Depends on Phase 2 AND Phase 3 AND Phase 5 (T034 depends on HistoryTable with pagination)
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (T004-T006) - Independently testable
- **User Story 2 (P2)**: Can start after US1 (shares OptimizationRow) - Independently testable once integrated
- **User Story 3 (P3)**: Can start after US1 (extends HistoryTable) - Independently testable
- **User Story 4 (P4)**: Can start after US1 + US3 (needs table + pagination) - Independently testable

### Within Each User Story

- Tests can run in parallel (all marked [P])
- Components that don't share files can run in parallel (marked [P])
- Components that extend same file must run sequentially
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

**Phase 1 (All parallel)**:
```bash
Task: T001 [P] Create database indexes migration
Task: T002 [P] Create TypeScript type definitions
Task: T003 [P] Create directory structure
```

**Phase 2 (Tests parallel with foundational)**:
```bash
# After T004-T005 complete:
Task: T006 [P] API contract tests
```

**Phase 3 - User Story 1 (Initial components parallel)**:
```bash
Task: T007 [P] Create history page
Task: T008 [P] Create HistoryTableSkeleton
Task: T009 [P] Create EmptyState
# Then sequential: T010 → T011 → T012 → T013 → T014
```

**Phase 5 - User Story 3 (Filter components parallel)**:
```bash
Task: T021 [P] Create HistorySearch component
Task: T022 [P] Create HistoryFilters component
Task: T023 [P] Create HistoryPagination component
Task: T024 [P] Create filter utility functions
# Then sequential: T025 → T026 → T027 → T028 → T029 → T030
Task: T031 [P] Utility function tests
Task: T032 [P] E2E filter tests
```

**Phase 7 - Polish (All parallel)**:
```bash
Task: T043 [P] Add error boundary
Task: T044 [P] Add rate limiting
Task: T045 [P] Database performance
Task: T046 [P] Frontend performance
Task: T047 [P] Accessibility
Task: T048 [P] Mobile responsive
Task: T050 [P] Documentation updates
```

---

## Implementation Strategy

### MVP First (User Story 1 Only) - ~3 days

1. Complete Phase 1: Setup (T001-T003) - 1 hour
2. Complete Phase 2: Foundational (T004-T006) - 1 day
3. Complete Phase 3: User Story 1 (T007-T014) - 1.5 days
4. **STOP and VALIDATE**: Test User Story 1 independently
   - Navigate to `/dashboard/history`
   - Verify table loads with optimization data
   - Test "View Details" navigation
   - Test "Download PDF" functionality
   - Verify empty state for new users
5. Deploy/demo if ready

### Incremental Delivery (P1 + P2) - ~5 days

1. Complete Setup + Foundational (T001-T006) - 1.5 days
2. Complete User Story 1 (T007-T014) - 1.5 days → Test independently → Deploy (MVP!)
3. Complete User Story 2 (T015-T020) - 1.5 days → Test independently → Deploy
4. **VALIDATE BOTH**: Test that both stories work independently and together
5. Skip to Polish (T043-T050) if US3/US4 not needed yet

### Full Feature (P1 + P2 + P3) - ~8 days

1. Complete Setup + Foundational + US1 + US2 (as above) - 5 days
2. Complete User Story 3 (T021-T032) - 2.5 days → Test independently → Deploy
3. Complete Polish (T043-T050) - 0.5 day
4. **FINAL VALIDATION**: Test all user stories independently and integrated
5. Production deployment

### Optional Bulk Operations (Add P4) - +3 days

1. Complete P1+P2+P3 first (8 days)
2. Add User Story 4 (T033-T042) - 2.5 days → Test independently → Deploy
3. Update Polish tasks as needed - 0.5 day

### Parallel Team Strategy (if multiple developers available)

**Week 1**: Foundation + US1 (Everyone together)
- Day 1-2: Setup + Foundational (T001-T006) - Team effort
- Day 3-4: User Story 1 (T007-T014) - Team effort
- Day 5: Validate US1, deploy MVP

**Week 2**: Parallel development
- Developer A: User Story 2 (T015-T020) - 2 days
- Developer B: User Story 3 (T021-T032) - 2.5 days
- Developer C: Polish (T043-T050) - 1 day, then help with US4
- Day 4-5: Integration testing, deployment

**Week 3** (Optional): Bulk operations
- Developer A or B: User Story 4 (T033-T042) - 2.5 days
- Day 4-5: Final testing, production deployment

---

## Task Estimates

| Phase | Tasks | Estimated Time | Critical Path |
|-------|-------|----------------|---------------|
| Phase 1: Setup | T001-T003 | 1 hour | No |
| Phase 2: Foundational | T004-T006 | 1 day | **YES** (blocks all stories) |
| Phase 3: US1 (P1) | T007-T014 | 1.5 days | **YES** (MVP) |
| Phase 4: US2 (P2) | T015-T020 | 1.5 days | **YES** (core feature) |
| Phase 5: US3 (P3) | T021-T032 | 2.5 days | No (enhancement) |
| Phase 6: US4 (P4) | T033-T042 | 2.5 days | No (optional) |
| Phase 7: Polish | T043-T050 | 0.5 day | No (quality) |
| **Total (P1-P3)** | **T001-T050** | **6-8 days** | - |
| **Total (P1-P4)** | **T001-T050** | **9-11 days** | - |

---

## Notes

- **[P] tasks** = different files, no dependencies, can run in parallel
- **[Story] label** = maps task to specific user story for traceability
- **Each user story** should be independently completable and testable
- **TDD approach**: Write tests before implementation (T006, T014, T020, T032, T042)
- **Commit frequently**: After each task or logical group
- **Stop at checkpoints**: Validate each story independently before moving on
- **Avoid**: Vague tasks, same file conflicts, cross-story dependencies that break independence
- **Performance targets**: All SC-001 through SC-012 must be met (see spec.md)
- **RLS enforcement**: All database queries must respect Row Level Security policies

---

## Success Criteria Checkpoints

After completing each phase, verify these success criteria:

### After Phase 3 (US1 - MVP):
- ✅ SC-001: Page loads in <2s for 100 optimizations
- ✅ SC-006: PDF downloads work 95% of the time
- ✅ SC-010: Empty state converts 80% of users to create optimization

### After Phase 4 (US2):
- ✅ SC-005: Apply Now flow completes in <10s
- ✅ SC-006: PDF downloads work 95% of the time

### After Phase 5 (US3):
- ✅ SC-002: Search filter updates in <200ms
- ✅ SC-003: Date/score filters apply in <500ms
- ✅ SC-004: Column sort completes in <300ms
- ✅ SC-009: Users find optimizations in <10s
- ✅ SC-012: Pagination loads pages in <1s

### After Phase 6 (US4):
- ✅ SC-007: Bulk delete (50 items) completes in <5s
- ✅ SC-008: Bulk export (20 items) completes in <15s

### After Phase 7 (Polish):
- ✅ SC-011: Zero data races across tabs
- ✅ All accessibility standards met (WCAG AA)
- ✅ Mobile responsive design validated

---

**Generated**: 2025-10-13
**Status**: Ready for implementation
**Next Step**: Begin with Phase 1 (T001-T003)
