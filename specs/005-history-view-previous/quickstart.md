# Quickstart Guide: History View Implementation

**Feature**: 005-history-view-previous
**Estimated Time**: 6-8 days (P1-P3)
**Phase**: Phase 1 - Design

## Prerequisites

✅ Existing Next.js 15 + Supabase + TypeScript setup
✅ shadcn/ui components installed
✅ Existing optimizations table with data
✅ Authentication working (Supabase Auth)
✅ PDF download API operational (`/api/download/[id]`)

## Quick Start (30 minutes)

### Step 1: Create Database Indexes (2 min)

```sql
-- Run in Supabase SQL Editor
CREATE INDEX IF NOT EXISTS idx_optimizations_user_created
  ON optimizations(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_optimizations_score
  ON optimizations(match_score)
  WHERE match_score IS NOT NULL;
```

### Step 2: Create API Route (10 min)

```typescript
// src/app/api/optimizations/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const supabase = await createRouteHandlerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse query parameters
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
  const sort = searchParams.get('sort') || 'date';
  const order = searchParams.get('order') || 'desc';

  // Calculate offset
  const offset = (page - 1) * limit;

  // Build query
  let query = supabase
    .from('optimizations')
    .select(`
      id,
      created_at,
      match_score,
      status,
      template_key,
      job_descriptions!jd_id (
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
    `, { count: 'exact' })
    .eq('user_id', user.id);

  // Apply sorting
  const sortField = sort === 'date' ? 'created_at' : sort === 'score' ? 'match_score' : 'created_at';
  query = query.order(sortField, { ascending: order === 'asc' });

  // Apply pagination
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Transform data
  const optimizations = data?.map(opt => ({
    id: opt.id,
    createdAt: opt.created_at,
    jobTitle: opt.job_descriptions?.title || null,
    company: opt.job_descriptions?.company || null,
    matchScore: opt.match_score,
    status: opt.status,
    jobUrl: opt.job_descriptions?.source_url || null,
    templateKey: opt.template_key,
    hasApplication: opt.applications && opt.applications.length > 0,
    applicationStatus: opt.applications?.[0]?.status,
    applicationDate: opt.applications?.[0]?.applied_date,
    applicationId: opt.applications?.[0]?.id,
  })) || [];

  return NextResponse.json({
    success: true,
    optimizations,
    pagination: {
      page,
      limit,
      total: count || 0,
      hasMore: (count || 0) > (page * limit),
      totalPages: Math.ceil((count || 0) / limit),
    },
  });
}
```

### Step 3: Create History Page (15 min)

```typescript
// src/app/dashboard/history/page.tsx
import { Suspense } from 'react';
import HistoryTable from '@/components/history/HistoryTable';
import HistoryTableSkeleton from '@/components/history/HistoryTableSkeleton';

export default function HistoryPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Optimization History</h1>
      <Suspense fallback={<HistoryTableSkeleton />}>
        <HistoryTable />
      </Suspense>
    </div>
  );
}
```

### Step 4: Test Endpoint (3 min)

```bash
# Test in browser or curl
curl http://localhost:3000/api/optimizations \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected: JSON with optimizations array
```

## Development Phases

### Phase 1: MVP - View History (2-3 days)

**Day 1: Backend + Basic UI**
1. ✅ Create database indexes (10 min)
2. ✅ Implement `/api/optimizations` route (2 hours)
3. ✅ Write API contract tests (1 hour)
4. ✅ Create `/dashboard/history` page route (30 min)
5. ✅ Create basic table component (2 hours)
6. ✅ Add loading skeleton (1 hour)

**Day 2: Actions + Polish**
1. ✅ Add "View Details" link (1 hour)
2. ✅ Add "Download PDF" button (1 hour)
3. ✅ Create empty state component (1 hour)
4. ✅ Add error boundary (1 hour)
5. ✅ Style and polish UI (2 hours)
6. ✅ Write E2E tests for P1 (2 hours)

**Deliverable**: Working history page with view/download actions

### Phase 2: Quick Apply (1-2 days)

**Day 3: Apply Integration**
1. ✅ Add "Apply Now" button to table rows (1 hour)
2. ✅ Integrate with existing `/api/apply-job` (2 hours)
3. ✅ Add success/error toast notifications (1 hour)
4. ✅ Implement "Applied" badge logic (1 hour)
5. ✅ Update table after apply (optimistic updates) (2 hours)
6. ✅ Write E2E tests for P2 (1 hour)

**Deliverable**: One-click apply from history

### Phase 3: Filters & Search (2-3 days)

**Day 4-5: Search + Filters**
1. ✅ Create search input with debouncing (2 hours)
2. ✅ Add date range picker (shadcn/ui Calendar) (2 hours)
3. ✅ Add ATS score filter dropdown (1 hour)
4. ✅ Implement filter logic (client + server) (2 hours)
5. ✅ Add "Clear Filters" button (30 min)
6. ✅ Implement column sorting (2 hours)
7. ✅ Add pagination controls (2 hours)
8. ✅ Sync filters with URL params (1 hour)
9. ✅ Write E2E tests for P3 (2 hours)

**Deliverable**: Full-featured history with search/filter/sort

### Phase 4: Bulk Operations (Optional, 2-3 days)

**Day 6-7: Bulk Actions**
1. ✅ Add row checkboxes + selection state (2 hours)
2. ✅ Implement "Select All" / "Deselect All" (1 hour)
3. ✅ Create bulk delete API route (2 hours)
4. ✅ Add confirmation dialog (1 hour)
5. ✅ Implement bulk export to ZIP (3 hours)
6. ✅ Add progress indicators (1 hour)
7. ✅ Write E2E tests for P4 (2 hours)

**Deliverable**: Bulk delete and export functionality

## File Structure

```
resume-builder-ai/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── optimizations/
│   │   │       ├── route.ts              # GET endpoint (P1)
│   │   │       └── bulk/
│   │   │           └── route.ts          # DELETE bulk (P4)
│   │   └── dashboard/
│   │       └── history/
│   │           └── page.tsx              # History page
│   ├── components/
│   │   └── history/
│   │       ├── HistoryTable.tsx          # Main table (P1)
│   │       ├── HistoryTableSkeleton.tsx  # Loading state (P1)
│   │       ├── HistoryFilters.tsx        # Filters panel (P3)
│   │       ├── HistorySearch.tsx         # Search input (P3)
│   │       ├── HistoryPagination.tsx     # Pagination (P3)
│   │       ├── BulkActions.tsx           # Bulk operations (P4)
│   │       └── EmptyState.tsx            # No optimizations (P1)
│   ├── hooks/
│   │   └── useOptimizations.ts           # Data fetching hook
│   └── types/
│       └── history.ts                    # TypeScript types
├── supabase/
│   └── migrations/
│       └── YYYYMMDDHHMMSS_add_history_indexes.sql
└── tests/
    └── e2e/
        └── history.spec.ts               # E2E tests
```

## Testing Checklist

### Unit Tests
- [ ] API route parameter validation
- [ ] Filter logic (date, score, search)
- [ ] Pagination calculations
- [ ] Data transformation

### Integration Tests
- [ ] Database query with RLS
- [ ] Join correctness (optimizations + job_descriptions + applications)
- [ ] Filter combinations

### E2E Tests
- [ ] **P1**: View history, empty state, view details, download PDF
- [ ] **P2**: Apply now flow, toast notifications, badge updates
- [ ] **P3**: Search, date filter, score filter, clear filters, sort, pagination
- [ ] **P4**: Bulk select, bulk delete confirmation, bulk export

### Performance Tests
- [ ] Page load <2s for 100 optimizations (SC-001)
- [ ] Search debounce <200ms (SC-002)
- [ ] Filter update <500ms (SC-003)
- [ ] Sort <300ms (SC-004)

## Common Pitfalls

### 1. RLS Policy Issues
**Problem**: Query returns empty even with data
**Solution**: Verify RLS policies allow SELECT for own user_id
```sql
-- Check existing policies
SELECT * FROM pg_policies WHERE tablename = 'optimizations';
```

### 2. Join Performance
**Problem**: Slow queries with multiple joins
**Solution**: Ensure indexes exist on foreign keys
```sql
CREATE INDEX IF NOT EXISTS idx_optimizations_jd_id ON optimizations(jd_id);
CREATE INDEX IF NOT EXISTS idx_applications_optimization_id ON applications(optimization_id);
```

### 3. Search Filtering
**Problem**: Search not working with special characters
**Solution**: Sanitize and escape search query
```typescript
const sanitized = search.replace(/[%_]/g, '\\$&');
```

### 4. Pagination Off-by-One
**Problem**: Incorrect page counts or missing last item
**Solution**: Use `.range(offset, offset + limit - 1)` (inclusive end)

### 5. Stale Data After Apply
**Problem**: "Apply Now" doesn't update table
**Solution**: Invalidate cache or optimistic update
```typescript
mutate('/api/optimizations'); // Revalidate SWR cache
```

## Debugging Commands

```bash
# Check database indexes
psql -c "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'optimizations';"

# Test API directly
curl -X GET "http://localhost:3000/api/optimizations?page=1&limit=5" \
  -H "Authorization: Bearer $(supabase auth get-session --project-ref YOUR_REF)"

# Check RLS policies
psql -c "SELECT * FROM pg_policies WHERE tablename IN ('optimizations', 'job_descriptions', 'applications');"

# Monitor query performance
-- In Supabase SQL Editor
EXPLAIN ANALYZE
SELECT * FROM optimizations
WHERE user_id = 'USER_ID'
ORDER BY created_at DESC
LIMIT 20;
```

## Performance Optimization Tips

1. **Use Indexes**: Apply all recommended indexes
2. **Limit Joins**: Only select needed columns
3. **Cache Strategy**: Use SWR or React Query with 5min cache
4. **Debounce Search**: 300ms delay before API call
5. **Virtual Scrolling**: Consider for 1000+ items (react-virtual)
6. **Lazy Loading**: Load images/avatars on scroll

## Next Steps

After completing this feature:
1. Monitor performance metrics in production
2. Gather user feedback on UX
3. Consider premium features (saved searches, advanced filters)
4. Implement analytics (most viewed, downloaded)
5. Add export to CSV/Excel (if requested)

## Support Resources

- **Data Model**: `specs/005-history-view-previous/data-model.md`
- **API Contract**: `specs/005-history-view-previous/contracts/api-optimizations-get.md`
- **Research**: `specs/005-history-view-previous/research.md`
- **Tasks**: `specs/005-history-view-previous/tasks.md` (generated via `/tasks`)

## Estimated Effort Summary

| Phase | Priority | Estimated Days | Key Deliverables |
|-------|----------|----------------|------------------|
| P1 | High | 2-3 | View history, basic table, actions |
| P2 | High | 1-2 | Apply Now integration |
| P3 | Medium | 2-3 | Search, filters, sort, pagination |
| P4 | Low | 2-3 | Bulk operations |
| **Total** | - | **6-11 days** | Full history management |

**Recommended**: Start with P1+P2 (3-5 days) for MVP, then evaluate P3/P4 based on feedback.
