# Implementation Plan: History View - Previous Optimizations

**Branch**: `005-history-view-previous` | **Date**: 2025-10-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-history-view-previous/spec.md`

## Summary

The History View feature provides a comprehensive optimization history management interface for ResumeBuilder AI users. Users can view all their previous resume optimizations in a filterable, sortable, paginated table with quick actions for viewing details, downloading PDFs, and applying to jobs directly from the history view. The feature also supports bulk operations (delete, export) for power users.

**Primary Requirement**: Display a dedicated history page at `/dashboard/history` showing all user optimizations with search, filter, sort, and bulk action capabilities.

**Technical Approach**: Leverage existing `optimizations`, `job_descriptions`, and `applications` tables with NO schema changes required. Implement a new GET `/api/optimizations` endpoint with query parameters for filtering/pagination, and build a React table component with shadcn/ui. The feature can be delivered incrementally across 4 prioritized phases (P1-P4).

## Technical Context

**Language/Version**: TypeScript 5.x with Next.js 15.5.2 (App Router)
**Primary Dependencies**:
- @supabase/supabase-js ^2.57.2 (database, auth, RLS)
- React 19 (UI framework)
- shadcn/ui (Table, Input, Select, Button, Calendar components)
- lucide-react ^0.545.0 (icons)

**Storage**: Supabase (PostgreSQL 15) with existing tables:
- `optimizations` (primary data source)
- `job_descriptions` (JOIN for job details)
- `applications` (LEFT JOIN for applied status)

**Testing**:
- Unit: Jest + React Testing Library
- Integration: Supabase RLS policy tests
- E2E: Playwright (existing setup)

**Target Platform**: Web (responsive, desktop-first)

**Project Type**: Web application (Next.js frontend + backend API routes)

**Performance Goals**:
- Page load: <2s for 100 optimizations (SC-001)
- Search filter: <200ms update (SC-002)
- Server filters: <500ms (SC-003)
- Column sort: <300ms (SC-004)
- Apply flow: <10s end-to-end (SC-005)
- PDF download: 95% success rate (SC-006)
- Bulk delete (50 items): <5s (SC-007)
- Bulk export (20 items): <15s (SC-008)

**Constraints**:
- No breaking changes to existing schema
- Maintain RLS policy enforcement
- Support both free and paid tier users
- Mobile-responsive (table scrolls horizontally on small screens)
- Backwards compatible with existing optimization/download/apply APIs

**Scale/Scope**:
- Target: 100-1,000 optimizations per user
- Soft limit: 20 items per page (UX optimized)
- Hard limit: 100 items per page (prevent abuse)
- Bulk operations: Max 50 items at once

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Constitutional Principles Applied**:

1. **Library-First Architecture** ✅
   - Query logic encapsulated in `useOptimizations` hook
   - Filter/search utilities as pure functions
   - Table components reusable across features

2. **Test-First Development** ✅
   - API contract tests before implementation
   - Component tests before integration
   - E2E scenarios defined in spec

3. **Row Level Security (RLS)** ✅
   - All queries respect existing RLS policies
   - User can only access own optimizations
   - No new security surface area

4. **Performance-First** ✅
   - Database indexes planned upfront
   - Pagination prevents large dataset issues
   - Debouncing reduces API calls
   - Client-side caching strategy

5. **Incremental Delivery** ✅
   - P1: MVP view history (independently deployable)
   - P2: Apply functionality (builds on P1)
   - P3: Filters/search (enhances UX)
   - P4: Bulk operations (power users)

**No Constitutional Violations** - Feature follows all existing patterns and principles.

## Project Structure

### Documentation (this feature)

```
specs/005-history-view-previous/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0: Technical research
├── data-model.md        # Phase 1: Database and TypeScript types
├── quickstart.md        # Phase 1: Developer quickstart guide
├── contracts/           # Phase 1: API contracts
│   └── api-optimizations-get.md
└── tasks.md             # Phase 2: Generated via /tasks command (NOT created yet)
```

### Source Code (repository root)

```
resume-builder-ai/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── optimizations/
│   │   │       ├── route.ts              # NEW: GET endpoint (P1)
│   │   │       └── bulk/
│   │   │           └── route.ts          # NEW: DELETE bulk endpoint (P4)
│   │   └── dashboard/
│   │       └── history/
│   │           └── page.tsx              # NEW: History page (P1)
│   ├── components/
│   │   └── history/                      # NEW: History-specific components
│   │       ├── HistoryTable.tsx          # Main table component (P1)
│   │       ├── HistoryTableSkeleton.tsx  # Loading skeleton (P1)
│   │       ├── HistoryFilters.tsx        # Filter panel (P3)
│   │       ├── HistorySearch.tsx         # Search input (P3)
│   │       ├── HistoryPagination.tsx     # Pagination controls (P3)
│   │       ├── BulkActions.tsx           # Bulk operation buttons (P4)
│   │       ├── EmptyState.tsx            # No optimizations state (P1)
│   │       └── OptimizationRow.tsx       # Individual table row (P1)
│   ├── hooks/
│   │   └── useOptimizations.ts           # NEW: Data fetching hook (P1)
│   ├── lib/
│   │   └── history-utils.ts              # NEW: Filter/search utilities (P3)
│   └── types/
│       └── history.ts                    # NEW: TypeScript type definitions (P1)
├── supabase/
│   └── migrations/
│       └── 20251013000000_add_history_indexes.sql  # NEW: Performance indexes (P1)
└── tests/
    ├── unit/
    │   └── history-utils.test.ts         # NEW: Utility tests (P3)
    ├── integration/
    │   └── api-optimizations.test.ts     # NEW: API tests (P1)
    └── e2e/
        └── history.spec.ts               # NEW: E2E tests (P1-P4)
```

**Structure Decision**: Web application structure with App Router. New routes and components are added to existing `src/app` and `src/components` directories following established patterns. No monorepo or separate packages needed.

## Complexity Tracking

*Feature follows constitutional principles - no violations to justify*

| Aspect | Complexity | Justification |
|--------|------------|---------------|
| Schema Changes | ❌ None | Leverages existing tables |
| New Dependencies | ❌ None | Uses existing stack |
| Breaking Changes | ❌ None | Additive feature only |
| Security Surface | ✅ Minimal | RLS handles authorization |
| Testing Burden | ✅ Standard | Follows existing patterns |

## Phase 0: Research Completed ✅

**Deliverable**: [research.md](./research.md)

**Key Findings**:
1. Existing `optimizations` table has all data needed (no migration required)
2. Can reuse `/api/download/[id]` and `/api/apply-job` endpoints
3. Performance targets achievable with 3 new indexes
4. Search can be client-side (avoids complex full-text setup)
5. Estimated effort: 6-8 days for P1-P3, +2-3 days for P4

**Technology Stack Verified**:
- ✅ Next.js 15 + TypeScript + Supabase confirmed
- ✅ shadcn/ui components available (Table, Input, Select, Calendar)
- ✅ Existing authentication and RLS working
- ✅ PDF generation API tested and stable

**Risk Assessment**: Low-risk feature leveraging 90% existing infrastructure

## Phase 1: Design Artifacts Completed ✅

### Data Model ✅
**Deliverable**: [data-model.md](./data-model.md)

**Key Decisions**:
- No schema changes required
- 3 new indexes for performance (user_id+created_at, match_score, optional full-text)
- Query pattern: Single SELECT with 2 JOINs (optimizations → job_descriptions, applications)
- TypeScript types defined for API requests/responses and frontend state
- Validation rules for query parameters (page, limit, dateFrom, dateTo, minScore, search)

**Performance Estimates**:
- With indexes: 50-150ms for 100 records
- Without indexes: 200-500ms for 100 records
- Meets all SC-001 through SC-012 targets

### API Contracts ✅
**Deliverable**: [contracts/api-optimizations-get.md](./contracts/api-optimizations-get.md)

**Contract Summary**:
- **Endpoint**: `GET /api/optimizations`
- **Auth**: Required (Supabase RLS enforced)
- **Query Params**: page, limit, sort, order, dateFrom, dateTo, minScore, search
- **Response**: `{ success, optimizations[], pagination{} }`
- **Rate Limit**: 60 req/min per user
- **Caching**: 5 min cache with ETag support

**Additional Contracts Needed** (referenced but not created yet):
- `DELETE /api/optimizations/bulk` (P4)
- `POST /api/optimizations/export` (P4)

### Quickstart Guide ✅
**Deliverable**: [quickstart.md](./quickstart.md)

**30-Minute Quickstart**:
1. Create indexes (2 min)
2. Create API route (10 min)
3. Create history page (15 min)
4. Test endpoint (3 min)

**Phased Implementation**:
- Phase 1 (P1): 2-3 days - View history table
- Phase 2 (P2): 1-2 days - Apply Now integration
- Phase 3 (P3): 2-3 days - Filters & search
- Phase 4 (P4): 2-3 days - Bulk operations (optional)

## Phase 2: Task Generation (NOT YET COMPLETE)

**Status**: ⏳ Pending - Run `/tasks` command to generate

**Expected Output**: `tasks.md` file with:
- Dependency-ordered task breakdown
- Story-to-task mapping
- Test requirements per task
- Estimated effort per task
- Acceptance criteria checkpoints

**Task Categories** (preview):
1. **Database Setup** (1 task): Create indexes
2. **Backend API** (3-4 tasks): Implement GET endpoint, validation, filtering, testing
3. **Frontend Components** (10-12 tasks): Page, table, filters, pagination, bulk actions
4. **Integration** (2-3 tasks): Hook up apply flow, PDF download
5. **Testing** (5-6 tasks): Unit, integration, E2E tests
6. **Polish** (2-3 tasks): Error handling, loading states, empty states

## Implementation Roadmap

### Milestone 1: MVP History View (P1) - Week 1
**Goal**: Users can view optimization history and access details

**Tasks**:
1. Create database indexes (10 min)
2. Implement `/api/optimizations` GET endpoint (4 hours)
3. Write API contract tests (2 hours)
4. Create `/dashboard/history` page (2 hours)
5. Build HistoryTable component (4 hours)
6. Add loading skeleton (1 hour)
7. Create EmptyState component (1 hour)
8. Add "View Details" and "Download PDF" actions (2 hours)
9. Write E2E tests for P1 scenarios (2 hours)

**Definition of Done**:
- ✅ Page loads with optimization list
- ✅ Clicking "View Details" navigates to optimization page
- ✅ Clicking "Download PDF" triggers download
- ✅ Empty state shows for new users
- ✅ Loading skeleton displays during fetch
- ✅ E2E tests pass for all P1 acceptance scenarios

### Milestone 2: Quick Apply (P2) - Week 2
**Goal**: Users can apply to jobs directly from history

**Tasks**:
1. Add "Apply Now" button to table rows (1 hour)
2. Integrate with existing `/api/apply-job` (3 hours)
3. Implement success/error toast notifications (1 hour)
4. Add "Applied" badge logic (2 hours)
5. Handle optimistic UI updates (2 hours)
6. Write E2E tests for P2 scenarios (2 hours)

**Definition of Done**:
- ✅ "Apply Now" triggers full apply flow (PDF + application record + tab open)
- ✅ Success toast shows after apply
- ✅ Row shows "Applied" badge after apply
- ✅ Badge persists on page reload
- ✅ E2E tests pass for all P2 acceptance scenarios

### Milestone 3: Filters & Search (P3) - Week 3
**Goal**: Users can find specific optimizations efficiently

**Tasks**:
1. Create search input with debouncing (2 hours)
2. Implement date range picker (shadcn Calendar) (3 hours)
3. Add ATS score filter dropdown (1 hour)
4. Build filter logic (client + server) (3 hours)
5. Add "Clear Filters" button (30 min)
6. Implement column sorting (3 hours)
7. Build pagination controls (2 hours)
8. Sync filters with URL params (2 hours)
9. Write E2E tests for P3 scenarios (3 hours)

**Definition of Done**:
- ✅ Search filters results in real-time (debounced)
- ✅ Date range filter works (past 7/30/90 days, custom)
- ✅ Score filter works (90%+, 80%+, 70%+, all)
- ✅ Multiple filters combine correctly
- ✅ "Clear Filters" resets to default state
- ✅ Column headers toggle sort asc/desc
- ✅ Pagination shows correct page numbers
- ✅ URL reflects current filter state
- ✅ E2E tests pass for all P3 acceptance scenarios

### Milestone 4: Bulk Operations (P4) - Week 4 (Optional)
**Goal**: Power users can manage optimizations efficiently

**Tasks**:
1. Add row checkboxes and selection state (2 hours)
2. Implement "Select All" / "Deselect All" (1 hour)
3. Create `DELETE /api/optimizations/bulk` endpoint (2 hours)
4. Add confirmation dialog with warnings (2 hours)
5. Implement bulk export to ZIP (4 hours)
6. Add progress indicators for bulk ops (1 hour)
7. Write E2E tests for P4 scenarios (2 hours)

**Definition of Done**:
- ✅ Users can select multiple rows via checkboxes
- ✅ "Select All" selects all visible rows
- ✅ Bulk delete shows confirmation with count and warnings
- ✅ Deleted items removed from table
- ✅ Bulk export downloads ZIP with PDFs
- ✅ Progress shown during long operations
- ✅ E2E tests pass for all P4 acceptance scenarios

## Testing Strategy

### Test Pyramid

```
          ┌─────────────┐
          │   E2E (10)  │  ← User journeys (P1-P4 scenarios)
          └─────────────┘
        ┌───────────────────┐
        │  Integration (8)  │  ← API + Database + RLS
        └───────────────────┘
      ┌───────────────────────┐
      │   Unit (15-20)        │  ← Utilities, validation, transforms
      └───────────────────────┘
```

### Test Coverage Targets

| Layer | Target | Focus Areas |
|-------|--------|-------------|
| Unit | 80%+ | Validation, filtering, sorting, transforms |
| Integration | 70%+ | API routes, database queries, RLS policies |
| E2E | 100% | All acceptance scenarios from spec |

### Critical Test Scenarios

**P1 Tests** (Must Pass):
1. View history page with multiple optimizations
2. Empty state displays for new users
3. "View Details" navigates correctly
4. "Download PDF" triggers download
5. Loading skeleton shows during fetch

**P2 Tests** (Must Pass):
1. "Apply Now" creates application record
2. "Apply Now" downloads PDF
3. "Apply Now" opens job URL in new tab (if available)
4. "Applied" badge appears after apply
5. Cannot apply twice without warning

**P3 Tests** (Must Pass):
1. Search filters by job title and company
2. Date range filters correctly
3. Score filter works with thresholds
4. Multiple filters combine (AND logic)
5. Column sorting works (date, score, company)
6. Pagination calculates pages correctly
7. URL updates with filter state

**P4 Tests** (Optional):
1. Select/deselect all rows
2. Bulk delete confirms before deletion
3. Bulk export generates ZIP with PDFs
4. Progress shown during operations

## Performance Optimization Plan

### Database Optimization
1. **Indexes** (immediate impact):
   ```sql
   CREATE INDEX idx_optimizations_user_created ON optimizations(user_id, created_at DESC);
   CREATE INDEX idx_optimizations_score ON optimizations(match_score);
   ```

2. **Query Optimization** (if needed):
   - Consider materialized view for 1000+ optimizations per user
   - Add query timeout (10s) to prevent runaway queries

### Frontend Optimization
1. **Debouncing**: 300ms for search, 500ms for filters
2. **Caching**: React Query with 5min stale time
3. **Pagination**: Client-side cache for visited pages
4. **Virtual Scrolling**: If >100 visible items (future enhancement)

### Monitoring
- Track P95 response times for `/api/optimizations`
- Alert if >2s for 100 items (violates SC-001)
- Monitor search query length distribution

## Rollout Plan

### Phase 1: Internal Testing (Day 1-2)
- Deploy to staging environment
- Test with real data (100-500 optimizations)
- Verify performance targets met
- Fix any critical bugs

### Phase 2: Beta Release (Day 3-5)
- Enable for 10% of users (feature flag)
- Monitor error rates and performance
- Gather user feedback
- Iterate on UX issues

### Phase 3: Full Release (Day 6-7)
- Enable for 100% of users
- Monitor traffic and database load
- Prepare hotfix if needed

### Phase 4: Post-Launch (Week 2)
- Analyze usage patterns
- Prioritize P4 based on demand
- Consider enhancements (CSV export, saved searches)

## Success Metrics

**Adoption Metrics**:
- 70% of users visit history page within 7 days
- Average 3+ visits per week per active user
- 80% of applies happen from history (vs optimization page)

**Performance Metrics** (from spec SC-001 through SC-012):
- Page load <2s for 100 optimizations (SC-001) ✅
- Search filter <200ms (SC-002) ✅
- Date/score filter <500ms (SC-003) ✅
- Column sort <300ms (SC-004) ✅
- Apply flow <10s (SC-005) ✅
- PDF success rate 95% (SC-006) ✅
- Bulk delete <5s for 50 items (SC-007) ✅
- Bulk export <15s for 20 items (SC-008) ✅
- Find optimization <10s (usability test) (SC-009) ✅
- Empty state conversion 80% (SC-010) ✅
- Zero data races (SC-011) ✅
- Pagination <1s (SC-012) ✅

**Quality Metrics**:
- Zero critical bugs in first week
- <5% error rate on API calls
- 95% test coverage on new code
- Zero RLS policy violations

## Dependencies & Risks

### External Dependencies
- ✅ Supabase uptime (99.9% SLA)
- ✅ Existing PDF generation API
- ✅ Existing apply-job API

### Internal Dependencies
- ✅ Feature 001: Core optimization infrastructure (COMPLETE)
- ✅ Feature 004: Applications tracking (COMPLETE, referenced in P2)

### Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Performance degradation with large datasets | Medium | High | Add indexes, pagination, caching |
| Search complexity | Low | Medium | Start simple (client-side), upgrade if needed |
| Bulk operation abuse | Low | Medium | Rate limiting, confirmation dialogs |
| Missing job description data | Medium | Low | Graceful null handling, show "N/A" |

## Open Questions & Decisions

### Resolved
1. ✅ **Schema Changes**: NONE - use existing tables
2. ✅ **Search Type**: Client-side partial match (not full-text)
3. ✅ **Sort Persistence**: No - URL state only
4. ✅ **Premium Feature**: Bulk ops available to all users

### Pending (for Implementation)
1. **Date Picker Library**: Use shadcn Calendar or alternative?
   - **Recommendation**: shadcn Calendar (already in ui/)

2. **Export Format**: PDFs only or include metadata JSON?
   - **Recommendation**: PDFs only for P4, add manifest.txt optional

3. **Archive Strategy**: Should old optimizations be archived?
   - **Recommendation**: No archiving in v1, revisit if performance issues

## Progress Tracking

**Current Status**: Phase 1 Complete ✅ (Design Artifacts Ready)

### Phase 0: Research ✅
- [x] Technology stack analysis
- [x] Database schema assessment
- [x] Performance planning
- [x] Risk assessment
- [x] Dependencies identified

### Phase 1: Design ✅
- [x] Data model defined
- [x] API contracts written
- [x] Quickstart guide created
- [x] TypeScript types defined
- [x] Query patterns documented

### Phase 2: Tasks (Pending)
- [ ] Run `/tasks` command
- [ ] Generate tasks.md
- [ ] Review task dependencies
- [ ] Assign estimates
- [ ] Begin implementation

### Implementation Phases (Future)
- [ ] P1: MVP History View (2-3 days)
- [ ] P2: Quick Apply (1-2 days)
- [ ] P3: Filters & Search (2-3 days)
- [ ] P4: Bulk Operations (2-3 days, optional)

## Related Documentation

- **Feature Spec**: [spec.md](./spec.md) - Requirements and user stories
- **Research**: [research.md](./research.md) - Technical research and findings
- **Data Model**: [data-model.md](./data-model.md) - Database schema and types
- **API Contract**: [contracts/api-optimizations-get.md](./contracts/api-optimizations-get.md)
- **Quickstart**: [quickstart.md](./quickstart.md) - 30-min setup guide
- **Tasks**: tasks.md - Task breakdown (generate with `/tasks`)
- **Project Instructions**: [CLAUDE.md](../../CLAUDE.md) - High-level architecture

## Next Steps

1. ✅ Complete this planning document
2. ⏳ **Run `/tasks` command** to generate task breakdown
3. ⏳ Review tasks with team
4. ⏳ Begin implementation with P1 (MVP)
5. ⏳ Deploy to staging and test
6. ⏳ Beta release with 10% rollout
7. ⏳ Full release after validation

---

**Plan Version**: 1.0
**Last Updated**: 2025-10-13
**Status**: Design Complete, Ready for Task Generation
