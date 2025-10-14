# API Contract: GET /api/optimizations

**Endpoint**: `GET /api/optimizations`
**Feature**: 005-history-view-previous
**Purpose**: Fetch paginated, filtered, sorted optimization history for the authenticated user

## Authentication

**Required**: Yes (Supabase Auth)

```typescript
// Auth header automatically handled by Supabase client
// RLS policies enforce user_id matching
```

## Request

### Query Parameters

| Parameter | Type | Required | Default | Constraints | Description |
|-----------|------|----------|---------|-------------|-------------|
| `page` | number | No | 1 | >= 1 | Page number (1-indexed) |
| `limit` | number | No | 20 | 1-100 | Items per page |
| `sort` | string | No | 'date' | 'date' \| 'score' \| 'company' | Sort field |
| `order` | string | No | 'desc' | 'asc' \| 'desc' | Sort direction |
| `dateFrom` | string | No | - | ISO 8601 | Start date filter (inclusive) |
| `dateTo` | string | No | - | ISO 8601 | End date filter (inclusive) |
| `minScore` | number | No | - | 0-1 | Minimum match score filter |
| `search` | string | No | - | <= 100 chars | Search query for title/company |

### Example Requests

**Basic request (defaults)**:
```
GET /api/optimizations
```

**With pagination**:
```
GET /api/optimizations?page=2&limit=50
```

**With filters**:
```
GET /api/optimizations?dateFrom=2025-10-01&dateTo=2025-10-13&minScore=0.8&search=google
```

**With sorting**:
```
GET /api/optimizations?sort=score&order=asc
```

## Response

### Success Response (200 OK)

```typescript
{
  "success": true,
  "optimizations": OptimizationHistoryEntry[],
  "pagination": {
    "page": number,
    "limit": number,
    "total": number,
    "hasMore": boolean,
    "totalPages": number
  }
}
```

#### OptimizationHistoryEntry

```typescript
{
  "id": number,                    // Optimization ID
  "createdAt": string,             // ISO 8601 timestamp
  "jobTitle": string | null,       // From job_descriptions
  "company": string | null,        // From job_descriptions
  "matchScore": number,            // 0-1 scale
  "status": string,                // Optimization status
  "jobUrl": string | null,         // Source job posting URL
  "templateKey": string | null,    // Template used
  "hasApplication": boolean,       // Whether applied
  "applicationStatus"?: string,    // If applied: status
  "applicationDate"?: string,      // If applied: date (ISO 8601)
  "applicationId"?: number         // If applied: application ID
}
```

### Example Success Response

```json
{
  "success": true,
  "optimizations": [
    {
      "id": 123,
      "createdAt": "2025-10-13T10:30:00Z",
      "jobTitle": "Senior Software Engineer",
      "company": "Google",
      "matchScore": 0.87,
      "status": "completed",
      "jobUrl": "https://careers.google.com/jobs/...",
      "templateKey": "ats-safe",
      "hasApplication": true,
      "applicationStatus": "applied",
      "applicationDate": "2025-10-13T11:00:00Z",
      "applicationId": 456
    },
    {
      "id": 122,
      "createdAt": "2025-10-12T14:20:00Z",
      "jobTitle": "Frontend Developer",
      "company": "Meta",
      "matchScore": 0.92,
      "status": "completed",
      "jobUrl": "https://www.metacareers.com/jobs/...",
      "templateKey": "minimal-ssr",
      "hasApplication": false
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "hasMore": true,
    "totalPages": 3
  }
}
```

### Error Responses

#### 401 Unauthorized
```json
{
  "success": false,
  "error": "Unauthorized",
  "code": "UNAUTHORIZED"
}
```

#### 400 Bad Request (Invalid Parameters)
```json
{
  "success": false,
  "error": "Invalid query parameters",
  "details": "page must be a positive integer",
  "code": "INVALID_PARAMS"
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Failed to fetch optimizations",
  "details": "Database connection error",
  "code": "SERVER_ERROR"
}
```

## Behavior

### Filtering Logic

1. **Date Range**: Applied at database level (WHERE clause)
   - `dateFrom`: `created_at >= dateFrom`
   - `dateTo`: `created_at <= dateTo`
   - Both are inclusive

2. **Score Filter**: Applied at database level (WHERE clause)
   - `minScore`: `match_score >= minScore`
   - Only considers optimizations with non-null scores

3. **Search Filter**: Applied client-side (post-fetch)
   - Case-insensitive
   - Partial match on `jobTitle` OR `company`
   - Empty/null values excluded from match

### Sorting Logic

| Sort Field | SQL Order By | Null Handling |
|------------|--------------|---------------|
| `date` | `created_at DESC/ASC` | N/A (required field) |
| `score` | `match_score DESC/ASC` | NULLS LAST |
| `company` | `company DESC/ASC` | NULLS LAST |

### Pagination Logic

- **Offset-based**: `offset = (page - 1) * limit`
- **Range query**: `.range(offset, offset + limit - 1)`
- **Total count**: Separate COUNT(*) query (cached)
- **hasMore**: `total > (page * limit)`

### Join Strategy

```typescript
// Single query with joins (optimized)
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
`)
```

## Performance Characteristics

| Metric | Target | Typical |
|--------|--------|---------|
| Response time (20 items) | <500ms | <200ms |
| Response time (100 items) | <2s | <500ms |
| With filters | <500ms | <300ms |
| Cache hit | <50ms | <30ms |

## Rate Limiting

- **Limit**: 60 requests per minute per user
- **Response Header**: `X-RateLimit-Remaining`
- **Exceeded Response**: 429 Too Many Requests

## Caching

- **Cache-Control**: `private, max-age=300` (5 minutes)
- **ETag**: Based on last_modified of optimizations
- **Stale-While-Revalidate**: Enabled

## Security

### RLS Enforcement
```sql
-- Automatically applied by Supabase
WHERE user_id = auth.uid()
```

### Input Sanitization
- URL params decoded and sanitized
- Search query escaped for LIKE/ILIKE
- SQL injection prevented via parameterized queries

### Data Exposure
- Only user's own optimizations returned
- No sensitive data in response (passwords, tokens, etc.)

## Testing

### Test Cases

1. **Default request**: Returns first 20 items sorted by date desc
2. **Pagination**: Correct offset calculation
3. **Filters**: Each filter works independently and combined
4. **Sort**: Each sort field works with asc/desc
5. **Empty result**: Returns empty array, not error
6. **Invalid params**: Returns 400 with details
7. **Unauthorized**: Returns 401 without data
8. **RLS enforcement**: User A cannot see User B's data

### Contract Tests

```typescript
describe('GET /api/optimizations', () => {
  it('returns 200 with valid structure', async () => {
    const response = await fetch('/api/optimizations');
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toMatchObject({
      success: true,
      optimizations: expect.any(Array),
      pagination: {
        page: expect.any(Number),
        limit: expect.any(Number),
        total: expect.any(Number),
        hasMore: expect.any(Boolean),
        totalPages: expect.any(Number),
      },
    });
  });

  it('respects pagination parameters', async () => {
    const response = await fetch('/api/optimizations?page=2&limit=10');
    const data = await response.json();

    expect(data.optimizations.length).toBeLessThanOrEqual(10);
    expect(data.pagination.page).toBe(2);
    expect(data.pagination.limit).toBe(10);
  });

  it('filters by date range', async () => {
    const dateFrom = '2025-10-01';
    const dateTo = '2025-10-13';
    const response = await fetch(
      `/api/optimizations?dateFrom=${dateFrom}&dateTo=${dateTo}`
    );
    const data = await response.json();

    data.optimizations.forEach(opt => {
      const created = new Date(opt.createdAt);
      expect(created >= new Date(dateFrom)).toBe(true);
      expect(created <= new Date(dateTo)).toBe(true);
    });
  });

  it('returns 401 without authentication', async () => {
    const response = await fetch('/api/optimizations', {
      headers: { Authorization: '' },
    });
    expect(response.status).toBe(401);
  });
});
```

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-10-13 | Initial contract definition |

## Related Contracts

- [POST /api/apply-job](./api-apply-job-post.md) - Apply to job from history
- [GET /api/download/[id]](./api-download-get.md) - Download optimization PDF
- [DELETE /api/optimizations/bulk](./api-optimizations-bulk-delete.md) - Bulk delete (P4)
- [POST /api/optimizations/export](./api-optimizations-export-post.md) - Bulk export (P4)
