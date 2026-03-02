# Technical Research: History View - Previous Optimizations

**Feature**: 005-history-view-previous
**Date**: 2025-10-13
**Research Phase**: Phase 0

## Executive Summary

The History View feature adds a comprehensive optimization history management interface to the existing ResumeBuilder AI application. This feature builds on the existing optimization tracking infrastructure and extends it with advanced filtering, search, sorting, pagination, and bulk operations.

**Key findings:**
- Existing `optimizations` table already contains all base data needed
- Applications tracking feature (004) provides integration points for "Apply Now" functionality
- No breaking changes required to existing schema
- Can reuse existing PDF download and apply-job API endpoints
- Primary implementation focus: Frontend UI + new GET endpoint with query parameters

## Technology Stack Analysis

### Current Stack (Verified)
- **Framework**: Next.js 15.5.2 with App Router
- **Language**: TypeScript (strict mode)
- **Database**: Supabase (PostgreSQL with RLS)
- **UI**: React 19 + Tailwind CSS + shadcn/ui
- **Authentication**: Supabase Auth with RLS policies
- **State Management**: React hooks + Server Components
- **PDF Generation**: Existing in `/api/download/[id]/route.ts`

### Dependencies (package.json)
- `@supabase/supabase-js`: ^2.57.2
- `@supabase/ssr`: ^0.7.0
- `next`: 15.5.2
- `react`: ^19.0.0
- `lucide-react`: ^0.545.0 (for icons)
- `clsx`: ^2.1.1 (for conditional classes)

### Existing Infrastructure to Leverage

#### 1. Database Schema
The `optimizations` table already exists with structure:
```sql
- id (bigint, PK)
- user_id (uuid, FK to auth.users)
- resume_id (bigint, FK to resumes)
- jd_id (bigint, FK to job_descriptions)
- match_score (real)
- template_key (text)
- status (text)
- created_at (timestamp)
```

Related joins available:
- `job_descriptions` table provides: `title`, `company`, `source_url`
- `applications` table provides: application status tracking
- `resumes` table provides: original resume metadata

#### 2. Existing API Endpoints (Reusable)
- **GET `/api/download/[id]`**: PDF generation for optimizations
- **POST `/api/apply-job`**: Application creation flow
- **GET `/api/applications`**: Fetch applications (for checking applied status)

#### 3. UI Components (shadcn/ui available)
- Table component with sorting
- Input for search
- Select for filters
- Button, Checkbox, Dialog components
- Loading skeletons
- Toast notifications

## Database Design Assessment

### Schema Changes Required
**NONE** - The existing schema fully supports the history view feature.

### New Indexes Recommended
```sql
-- Optimize history queries (user + date sorting)
CREATE INDEX IF NOT EXISTS idx_optimizations_user_created
ON optimizations(user_id, created_at DESC);

-- Optimize search queries (if full-text search implemented)
CREATE INDEX IF NOT EXISTS idx_jd_title_company_gin
ON job_descriptions USING gin(to_tsvector('english', title || ' ' || company));
```

### Query Patterns Analysis

#### Primary Query: Fetch History with Filters
```typescript
// Base query
const query = supabase
  .from('optimizations')
  .select(`
    id,
    created_at,
    match_score,
    status,
    template_key,
    job_descriptions (
      id,
      title,
      company,
      source_url
    ),
    applications (
      id,
      status,
      applied_date
    )
  `)
  .eq('user_id', user.id)
  .order('created_at', { ascending: false });

// With filters
if (searchText) {
  // Option 1: Client-side filtering (simpler, works with RLS)
  // Option 2: Filter after fetch
}

if (dateRange) {
  query.gte('created_at', startDate)
      .lte('created_at', endDate);
}

if (minScore) {
  query.gte('match_score', minScore);
}

// Pagination
query.range(offset, offset + limit - 1);
```

**Performance Estimate**:
- Without indexes: ~200-500ms for 100 records
- With indexes: ~50-150ms for 100 records
- Meets SC-001 requirement (<2s for 100 optimizations)

## API Contract Design

### New Endpoint: GET `/api/optimizations`

**Purpose**: Fetch paginated, filtered, sorted optimization history

**Query Parameters**:
```typescript
interface OptimizationsQueryParams {
  page?: number;           // Default: 1
  limit?: number;          // Default: 20, max: 100
  sort?: 'date' | 'score'; // Default: 'date'
  order?: 'asc' | 'desc';  // Default: 'desc'
  dateFrom?: string;       // ISO date
  dateTo?: string;         // ISO date
  minScore?: number;       // 0-1 scale
  search?: string;         // Search in title/company
}
```

**Response**:
```typescript
interface OptimizationsResponse {
  success: boolean;
  optimizations: OptimizationHistoryEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

interface OptimizationHistoryEntry {
  id: number;
  createdAt: string;
  jobTitle: string | null;
  company: string | null;
  matchScore: number;
  status: string;
  jobUrl: string | null;
  hasApplication: boolean;
  applicationStatus?: string;
  applicationDate?: string;
}
```

### Existing Endpoints to Extend

**POST `/api/apply-job`**: No changes needed, already supports:
```typescript
{
  optimizationId: number;
  jobTitle: string;
  companyName: string;
  jobUrl?: string;
  status?: string;
}
```

**GET `/api/download/[id]`**: No changes needed, already generates PDFs

### Bulk Operations API (P4 - Optional)

**DELETE `/api/optimizations/bulk`**:
```typescript
// Request
{
  ids: number[];
}

// Response
{
  success: boolean;
  deleted: number;
  preserved: {
    applications: number;
  };
}
```

**POST `/api/optimizations/export`**:
```typescript
// Request
{
  ids: number[];
}

// Response: ZIP file stream
Content-Type: application/zip
Content-Disposition: attachment; filename="optimizations-export.zip"
```

## Performance Considerations

### Database Query Optimization
1. **Index Strategy**:
   - Primary index on `(user_id, created_at DESC)` for default sorting
   - Consider GIN index for full-text search if search becomes complex

2. **Query Limits**:
   - Hard limit: 100 records per request (prevents abuse)
   - Soft limit: 20 records default (optimal UX)
   - Total scan limit: Consider limiting to last 1000 optimizations for free tier

3. **Join Optimization**:
   - Use Supabase's select joins (single query vs N+1)
   - LEFT JOIN on applications (optional relationship)
   - INNER JOIN on job_descriptions (required relationship)

### Frontend Performance
1. **Search Debouncing**: 300ms delay before API call
2. **Filter Debouncing**: 500ms delay for multiple filter changes
3. **Pagination**: Client-side cache for visited pages
4. **Loading States**: Skeleton UI during fetch

### Bulk Operations Performance
1. **Bulk Delete**: Batch operations in chunks of 50
2. **Bulk Export**: Stream PDFs as they generate (don't load all in memory)
3. **Rate Limiting**: Max 3 bulk operations per minute per user

## Security & Authorization

### Row Level Security (RLS)
Existing RLS policies on `optimizations` table already enforce:
```sql
-- Users can only read their own optimizations
CREATE POLICY "Users can read own optimizations"
ON optimizations FOR SELECT
USING (auth.uid() = user_id);

-- Users can delete their own optimizations
CREATE POLICY "Users can delete own optimizations"
ON optimizations FOR DELETE
USING (auth.uid() = user_id);
```

### Input Sanitization
1. **Search Query**: Sanitize to prevent SQL injection (use parameterized queries)
2. **Date Filters**: Validate ISO date format
3. **Score Filters**: Validate range 0-1
4. **Pagination**: Validate positive integers, enforce max limits

### Authorization Checks
- Verify `user_id` matches authenticated user (handled by RLS)
- Validate optimization ownership before bulk operations
- Rate limit bulk operations to prevent abuse

## UI/UX Design Patterns

### Component Architecture
```
/dashboard/history (page.tsx)
├── <HistoryHeader />           # Search, filters, actions
│   ├── <SearchInput />         # Debounced search
│   ├── <FilterPanel />         # Date, score filters
│   └── <BulkActions />         # Delete, export buttons
├── <OptimizationsTable />      # Main data table
│   ├── <TableHeader />         # Sortable columns
│   ├── <TableBody />           # Data rows
│   │   └── <OptimizationRow /> # Individual row with actions
│   └── <TableFooter />         # Pagination
└── <EmptyState />              # When no optimizations
```

### State Management Strategy
```typescript
interface HistoryPageState {
  // Data
  optimizations: OptimizationHistoryEntry[];
  selectedIds: Set<number>;

  // Filters
  filters: {
    search: string;
    dateRange: { from: Date; to: Date } | null;
    minScore: number | null;
  };

  // Pagination
  pagination: {
    page: number;
    limit: number;
    total: number;
  };

  // UI State
  isLoading: boolean;
  error: string | null;
  sortColumn: 'date' | 'score' | 'company';
  sortDirection: 'asc' | 'desc';
}
```

**State Management Approach**: React hooks + URL state
- Use `useOptimizations` custom hook for data fetching
- Sync filters/pagination with URL search params (for bookmarking)
- Local state for selections and UI state

### Loading & Error States
1. **Initial Load**: Full-page skeleton (table structure with shimmer)
2. **Filter Change**: Table skeleton overlay
3. **Pagination**: Row-level loading indicators
4. **Error**: Banner at top with retry button
5. **Empty State**: Helpful illustration + CTA to create optimization

## Technical Dependencies & Constraints

### New NPM Dependencies
**NONE REQUIRED** - All functionality can be built with existing dependencies:
- Table: shadcn/ui Table component
- Date picker: shadcn/ui Calendar + Popover (if not already installed)
- Icons: lucide-react (already installed)
- ZIP generation (P4): `jszip` (only if bulk export implemented)

### Browser Requirements
- Modern browsers with ES2020 support (matches Next.js 15 requirements)
- No special APIs required
- PDF download uses standard `window.open()` or `<a download>`

### Backwards Compatibility
- No breaking changes to existing features
- Existing optimization creation flow unchanged
- Existing download/apply endpoints unchanged
- Database schema unchanged

## Risk Assessment

### High-Priority Risks

**Risk 1: Performance degradation with large datasets**
- **Likelihood**: Medium (power users may have 500+ optimizations)
- **Impact**: High (SC-001 violated, poor UX)
- **Mitigation**:
  - Implement database indexes
  - Add pagination with reasonable limits
  - Consider archiving strategy for old optimizations

**Risk 2: Search/filter complexity**
- **Likelihood**: Low (requirements are clear)
- **Impact**: Medium (users can't find optimizations)
- **Mitigation**:
  - Start with simple client-side filtering (P1)
  - Upgrade to server-side if performance issues arise
  - Test with realistic data volumes

### Medium-Priority Risks

**Risk 3: Bulk operations abuse**
- **Likelihood**: Low (authenticated users only)
- **Impact**: Medium (performance issues, accidental data loss)
- **Mitigation**:
  - Rate limiting (max 3 operations/minute)
  - Confirmation dialogs with item counts
  - Soft delete with recovery period (optional)

**Risk 4: Missing job description data**
- **Likelihood**: Medium (old optimizations may have incomplete JD data)
- **Impact**: Low (display "N/A", feature still usable)
- **Mitigation**:
  - Graceful null handling in UI
  - Data migration script to backfill missing titles/companies (optional)

## Testing Strategy

### Unit Tests
1. **API Route Tests**: `/api/optimizations` query parameter parsing
2. **Filter Logic Tests**: Date range, score threshold calculations
3. **Component Tests**: Search input debouncing, filter state

### Integration Tests
1. **Database Queries**: Verify correct data with RLS enabled
2. **Pagination Tests**: Page boundaries, edge cases
3. **Filter Combinations**: Search + date + score together

### E2E Tests (Priority)
1. **P1**: View history table, click "View Details", verify navigation
2. **P1**: Empty state displays correctly for new users
3. **P2**: Click "Apply Now", verify PDF download + navigation
4. **P3**: Search by job title, verify filtered results
5. **P3**: Apply date range filter, verify filtered results

### Performance Tests
1. Load page with 100 optimizations: <2s (SC-001)
2. Search filter update: <200ms (SC-002)
3. Date/score filter update: <500ms (SC-003)
4. Column sort: <300ms (SC-004)

## Implementation Approach

### Phased Rollout (by Priority)

**Phase 1 (P1): MVP - View History**
- Duration: 2-3 days
- Deliverables:
  - `/dashboard/history` page route
  - GET `/api/optimizations` endpoint
  - Basic table with date, job, company, score, actions
  - "View Details" and "Download PDF" buttons
  - Empty state
  - Loading states

**Phase 2 (P2): Quick Apply**
- Duration: 1-2 days
- Deliverables:
  - "Apply Now" button on each row
  - Integration with existing `/api/apply-job`
  - Success/error toast notifications
  - "Applied" badge for completed applications

**Phase 3 (P3): Filters & Search**
- Duration: 2-3 days
- Deliverables:
  - Search input with debouncing
  - Date range picker
  - ATS score filter dropdown
  - "Clear Filters" button
  - Column sorting (date, company, score)
  - Pagination controls

**Phase 4 (P4): Bulk Operations (Optional)**
- Duration: 2-3 days
- Deliverables:
  - Row checkboxes
  - Bulk delete with confirmation
  - Bulk export to ZIP
  - Select all / deselect all

### Development Order
1. Backend: `/api/optimizations` endpoint (1 day)
2. Frontend: Basic table + routing (1 day)
3. Frontend: Actions (View, Download) (0.5 day)
4. Frontend: Empty state + loading (0.5 day)
5. Frontend: Apply Now integration (1 day)
6. Frontend: Search/filter UI (1 day)
7. Frontend: Filter logic + URL state (1 day)
8. Frontend: Bulk operations (2 days, if P4 prioritized)

## Open Questions & Assumptions

### Assumptions
1. ✓ Optimization records persist indefinitely (no auto-deletion)
2. ✓ PDF generation logic is already stable and tested
3. ✓ Applications table relationship is 1:many with optimizations (one opt can have multiple applications)
4. ✓ Free tier users see all their optimizations regardless of quota
5. ✓ Search is case-insensitive partial match (not full-text search)

### Open Questions
1. **Data Retention**: Should old optimizations be archived after 90 days?
   - **Decision**: No, keep all records for free/paid users

2. **Export Format**: Should bulk export include metadata JSON or just PDFs?
   - **Decision**: PDFs only for P4, can add manifest.txt with details

3. **Sort Persistence**: Should sort/filter preferences persist across sessions?
   - **Decision**: No persistence in P1-P3, URL state only

4. **Premium Feature**: Should bulk operations be premium-only?
   - **Decision**: No, available to all users with rate limiting

## Dependencies on Other Features

### Upstream Dependencies (Required)
- ✓ Feature 001: Core optimization infrastructure (COMPLETE)
- ✓ Feature 004: Applications tracking (referenced in P2)
- ✓ PDF download API (COMPLETE)

### Downstream Dependencies (Optional)
- Feature 006 (Future): Analytics/insights could leverage history data
- Feature 007 (Future): AI-powered optimization suggestions based on history

## Success Metrics Validation

### Measurable Against Spec
- **SC-001**: Load <2s for 100 records → Achievable with indexes
- **SC-002**: Search <200ms → Debouncing + client-side filtering
- **SC-003**: Filter <500ms → Server-side query optimization
- **SC-004**: Sort <300ms → Client-side sorting (data already fetched)
- **SC-005**: Apply flow <10s → Reuses existing tested endpoint
- **SC-006**: PDF success 95% → Depends on existing download reliability
- **SC-007**: Bulk delete <5s → Batching + parallel deletes
- **SC-008**: Bulk export <15s → Streaming + parallel PDF generation
- **SC-009**: Find optimization <10s → UX testing required
- **SC-010**: Empty state conversion 80% → A/B testing required
- **SC-011**: Zero data races → RLS + optimistic locking
- **SC-012**: Pagination <1s → Client-side page transitions

## Conclusion

The History View feature is **low-risk and high-value**, leveraging 90% existing infrastructure. Primary work involves:
1. New API endpoint with query parameters (straightforward)
2. Frontend table UI with filters (standard CRUD pattern)
3. Integration with existing apply/download flows (already tested)

**Recommendation**: Proceed with phased implementation (P1 → P2 → P3), defer P4 based on user demand.

**Estimated Total Effort**: 6-8 days for P1-P3, +2-3 days for P4 if needed.
