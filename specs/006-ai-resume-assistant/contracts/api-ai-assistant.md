# API Contract: AI Resume Assistant

**Feature**: 006-ai-resume-assistant
**API Version**: v1
**Base Path**: `/api/v1`
**Created**: 2025-10-15

## Overview

This document specifies the API contracts for the AI Resume Assistant feature, which integrates existing chat (content editing) and design (visual customization) endpoints into a unified experience.

**Note**: All endpoints documented here **already exist** in the codebase (Features 002 and 003). This contract serves as a reference for the integration work.

---

## Authentication

**All endpoints require authentication** via Supabase Auth session cookie.

**Unauthorized Response** (401):
```json
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

---

## User Story 1: Interactive Content Editing (Chat Endpoints)

### POST /api/v1/chat

**Purpose**: Send a message to the AI assistant and receive a response

**Request Body**:
```typescript
{
  session_id?: string;        // Optional: resume existing session
  optimization_id: string;    // Required: which optimization to edit
  message: string;            // Required: user's message (1-2000 chars)
}
```

**Success Response** (200):
```typescript
{
  session_id: string;                    // Chat session ID
  message_id: string;                    // ID of user's message
  ai_response: string;                   // AI's response text
  amendments?: AmendmentRequest[];       // Extracted amendments (if any)
  requires_clarification?: boolean;      // True if AI needs more info
}

interface AmendmentRequest {
  id: string;
  type: 'add' | 'modify' | 'remove' | 'clarify';
  target_section: string | null;        // e.g., 'experience[0].bullets[2]'
  status: 'pending' | 'applied' | 'rejected' | 'needs_clarification';
}
```

**Error Responses**:
- **400**: Invalid request body
  ```json
  {
    "error": "Invalid request",
    "message": "optimization_id is required"
  }
  ```
- **404**: Optimization not found
  ```json
  {
    "error": "Not found",
    "message": "Optimization not found or access denied"
  }
  ```
- **429**: Rate limit exceeded (20 requests/min per user)
  ```json
  {
    "error": "Too many requests",
    "message": "Rate limit exceeded. Please try again in 30 seconds.",
    "retryAfter": 30
  }
  ```

**Example Request**:
```bash
curl -X POST https://api.example.com/api/v1/chat \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-access-token=..." \
  -d '{
    "optimization_id": "550e8400-e29b-41d4-a716-446655440000",
    "message": "Make my second bullet point more impactful"
  }'
```

**Example Response**:
```json
{
  "session_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "message_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "ai_response": "I can help you make that bullet point more impactful! Here are three options:\n\n1. **Led cross-functional team of 8 engineers** to deliver $2M revenue-generating feature, reducing time-to-market by 40%\n2. **Spearheaded development of high-impact feature** that drove $2M in new revenue and accelerated delivery by 40%\n3. **Directed team of 8 engineers** in building revenue-critical feature, achieving 40% faster launch and $2M ARR\n\nWhich version resonates most with you?",
  "amendments": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "type": "modify",
      "target_section": "experience[0].bullets[1]",
      "status": "pending"
    }
  ],
  "requires_clarification": false
}
```

**Business Rules**:
1. If `session_id` is not provided:
   - Check for active session for (user_id, optimization_id)
   - If exists: resume that session
   - If not: create new session with status='active'
2. AI response must maintain truthfulness (no fabrication)
3. Amendments are extracted from AI response and stored as `pending`
4. If AI cannot determine user intent, set `requires_clarification=true`

---

### GET /api/v1/chat/sessions

**Purpose**: List user's chat sessions

**Query Parameters**:
```typescript
{
  optimization_id?: string;   // Filter by specific optimization
  status?: 'active' | 'closed';
  page?: number;              // Default: 1
  limit?: number;             // Default: 20, max: 100
}
```

**Success Response** (200):
```typescript
{
  sessions: ChatSession[];
  total: number;
  page: number;
  limit: number;
}

interface ChatSession {
  id: string;
  optimization_id: string;
  status: 'active' | 'closed';
  created_at: string;         // ISO 8601
  last_activity_at: string;   // ISO 8601
  message_count: number;      // Derived field
}
```

**Example Response**:
```json
{
  "sessions": [
    {
      "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "optimization_id": "550e8400-e29b-41d4-a716-446655440000",
      "status": "active",
      "created_at": "2025-10-15T10:30:00Z",
      "last_activity_at": "2025-10-15T11:45:00Z",
      "message_count": 12
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}
```

---

### GET /api/v1/chat/sessions/:id

**Purpose**: Get chat session details with message history

**Path Parameters**:
- `id` (UUID): Chat session ID

**Success Response** (200):
```typescript
{
  session: ChatSession;
  messages: ChatMessage[];
  total_messages: number;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  content: string;
  created_at: string;         // ISO 8601
  metadata?: {
    amendment_type?: string;
    section_affected?: string;
    processing_time_ms?: number;
  };
}
```

**Example Response**:
```json
{
  "session": {
    "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "optimization_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "active",
    "created_at": "2025-10-15T10:30:00Z",
    "last_activity_at": "2025-10-15T11:45:00Z"
  },
  "messages": [
    {
      "id": "msg-1",
      "sender": "user",
      "content": "Make my second bullet point more impactful",
      "created_at": "2025-10-15T10:30:15Z"
    },
    {
      "id": "msg-2",
      "sender": "ai",
      "content": "I can help you make that bullet point more impactful! Here are three options...",
      "created_at": "2025-10-15T10:30:18Z",
      "metadata": {
        "processing_time_ms": 2341
      }
    }
  ],
  "total_messages": 2
}
```

---

### POST /api/v1/chat/sessions/:id/preview

**Purpose**: Preview amendment changes before applying

**Path Parameters**:
- `id` (UUID): Chat session ID

**Request Body**:
```typescript
{
  message: string;            // User's request to preview
}
```

**Success Response** (200):
```typescript
{
  original_content: Record<string, unknown>;     // Current resume data
  proposed_content: Record<string, unknown>;     // Resume data with changes
  diff: DiffResult[];                            // Line-by-line changes
  change_summary: string;                        // Human-readable summary
}

interface DiffResult {
  type: 'added' | 'removed' | 'unchanged';
  value: string;
  line_number?: number;
}
```

**Example Response**:
```json
{
  "original_content": {
    "experience": [
      {
        "title": "Senior Software Engineer",
        "bullets": [
          "Developed features",
          "Managed team of 8 engineers to build feature"
        ]
      }
    ]
  },
  "proposed_content": {
    "experience": [
      {
        "title": "Senior Software Engineer",
        "bullets": [
          "Developed features",
          "Led cross-functional team of 8 engineers to deliver $2M revenue-generating feature, reducing time-to-market by 40%"
        ]
      }
    ]
  },
  "diff": [
    {
      "type": "unchanged",
      "value": "Developed features",
      "line_number": 1
    },
    {
      "type": "removed",
      "value": "Managed team of 8 engineers to build feature",
      "line_number": 2
    },
    {
      "type": "added",
      "value": "Led cross-functional team of 8 engineers to deliver $2M revenue-generating feature, reducing time-to-market by 40%",
      "line_number": 2
    }
  ],
  "change_summary": "Updated second bullet point in experience section to emphasize leadership impact and quantify results"
}
```

---

### POST /api/v1/chat/sessions/:id/apply

**Purpose**: Apply amendment to resume (create new version)

**Path Parameters**:
- `id` (UUID): Chat session ID

**Request Body**:
```typescript
{
  amendment_id: string;       // ID of amendment to apply
}
```

**Success Response** (200):
```typescript
{
  version_id: string;
  version_number: number;
  change_summary: string;
  updated_content: Record<string, unknown>;
}
```

**Example Response**:
```json
{
  "version_id": "v-123abc",
  "version_number": 3,
  "change_summary": "Updated second bullet point in experience section",
  "updated_content": {
    "experience": [
      {
        "title": "Senior Software Engineer",
        "bullets": [
          "Developed features",
          "Led cross-functional team of 8 engineers to deliver $2M revenue-generating feature"
        ]
      }
    ]
  }
}
```

**Business Rules**:
1. Creates new `resume_version` with incremented `version_number`
2. Updates `amendment_requests.status` to 'applied'
3. Sets `amendment_requests.processed_at` to NOW()
4. Updates `optimizations.optimized_data` with new content

---

## User Story 2: Visual Design Customization (Design Endpoints)

### GET /api/v1/design/templates

**Purpose**: List available design templates

**Query Parameters**:
```typescript
{
  category?: 'professional' | 'creative' | 'modern';
  is_premium?: boolean;
}
```

**Success Response** (200):
```typescript
{
  templates: DesignTemplate[];
}

interface DesignTemplate {
  id: string;
  name: string;                 // 'minimal', 'card', 'timeline', 'sidebar'
  display_name: string;
  description: string;
  category: string;
  thumbnail_url: string;
  is_premium: boolean;
  config: {
    colors: { primary: string; secondary: string; accent: string };
    fonts: { heading: string; body: string; accent?: string };
    layout: { columns: number; margins: string; spacing: string };
  };
}
```

**Example Response**:
```json
{
  "templates": [
    {
      "id": "tpl-minimal",
      "name": "minimal",
      "display_name": "Minimal Professional",
      "description": "Clean, ATS-friendly single-column layout",
      "category": "professional",
      "thumbnail_url": "https://cdn.example.com/thumbnails/minimal.png",
      "is_premium": false,
      "config": {
        "colors": {
          "primary": "#1e40af",
          "secondary": "#64748b",
          "accent": "#3b82f6"
        },
        "fonts": {
          "heading": "Inter",
          "body": "Inter"
        },
        "layout": {
          "columns": 1,
          "margins": "normal",
          "spacing": "comfortable"
        }
      }
    }
  ]
}
```

---

### GET /api/v1/design/templates/:id/preview

**Purpose**: Preview template with user's resume data

**Path Parameters**:
- `id` (string): Template name (e.g., 'minimal', 'card')

**Query Parameters**:
```typescript
{
  optimization_id: string;    // Required: which resume to preview
  customization_id?: string;  // Optional: apply specific customizations
}
```

**Success Response** (200):
```typescript
{
  html: string;               // Rendered HTML preview
  css: string;                // Template CSS
  metadata: {
    template_name: string;
    render_time_ms: number;
    ats_score: number;        // 0-1 scale
  };
}
```

**Example Response**:
```json
{
  "html": "<!DOCTYPE html><html><head>...</head><body><div class='resume'>...</div></body></html>",
  "css": ".resume { font-family: Inter; color: #1e40af; }",
  "metadata": {
    "template_name": "minimal",
    "render_time_ms": 147,
    "ats_score": 0.95
  }
}
```

**Business Rules**:
1. Render time must be <5s (SC-003 equivalent for design)
2. ATS score must be >0.7 (warn user if lower)
3. Customizations overlay template defaults (merge, not replace)

---

### POST /api/v1/design/recommend

**Purpose**: Get AI-recommended template based on resume content and job

**Request Body**:
```typescript
{
  optimization_id: string;    // Required: which optimization
}
```

**Success Response** (200):
```typescript
{
  recommended_template: string;         // Template name
  confidence: number;                   // 0-1 scale
  reasoning: string;                    // Why this template
  alternatives: string[];               // Other good options
}
```

**Example Response**:
```json
{
  "recommended_template": "timeline",
  "confidence": 0.87,
  "reasoning": "Your resume emphasizes career progression with 15 years of experience. The timeline template visually showcases growth and is ATS-friendly for senior roles.",
  "alternatives": ["sidebar", "minimal"]
}
```

---

### GET /api/v1/design/:optimizationId

**Purpose**: Get current design assignment for optimization

**Path Parameters**:
- `optimizationId` (UUID): Optimization ID

**Success Response** (200):
```typescript
{
  template_key: string;
  customization_id: string | null;
  customization?: {
    colors?: { primary?: string; secondary?: string; accent?: string };
    fonts?: { heading?: string; body?: string; accent?: string };
    layout?: { columns?: number; margins?: string; spacing?: string };
  };
}
```

**Example Response**:
```json
{
  "template_key": "minimal",
  "customization_id": "cust-abc123",
  "customization": {
    "colors": {
      "primary": "#0000FF"
    }
  }
}
```

---

### PUT /api/v1/design/:optimizationId

**Purpose**: Update design assignment (change template)

**Path Parameters**:
- `optimizationId` (UUID): Optimization ID

**Request Body**:
```typescript
{
  template_key: string;       // New template to assign
}
```

**Success Response** (200):
```typescript
{
  template_key: string;
  customization_id: null;     // Reset when template changes
  message: string;
}
```

**Example Response**:
```json
{
  "template_key": "card",
  "customization_id": null,
  "message": "Template changed successfully. Previous customizations cleared."
}
```

---

### POST /api/v1/design/:optimizationId/customize

**Purpose**: AI-powered design customization via natural language

**Path Parameters**:
- `optimizationId` (UUID): Optimization ID

**Request Body**:
```typescript
{
  message: string;            // Natural language request (e.g., "make header blue")
}
```

**Success Response** (200):
```typescript
{
  customization_id: string;
  applied_changes: {
    colors?: Record<string, string>;
    fonts?: Record<string, string>;
    layout?: Record<string, unknown>;
  };
  message: string;            // Confirmation message from AI
  ats_warning?: string;       // Warning if ATS score drops
}
```

**Example Response**:
```json
{
  "customization_id": "cust-xyz789",
  "applied_changes": {
    "colors": {
      "primary": "#0000FF"
    }
  },
  "message": "I've changed the header color to blue! Your resume now has a fresh, professional look.",
  "ats_warning": null
}
```

**Error Responses**:
- **400**: Unsupported design request
  ```json
  {
    "error": "Unsupported request",
    "message": "Sorry, I can't add animations to your resume. Would you like to try changing colors, fonts, or layout instead?"
  }
  ```

**Business Rules**:
1. AI parses natural language to extract design changes
2. Validates ATS compliance before applying
3. If ATS score drops >10%, return warning (but still apply)
4. Unsupported requests return helpful alternatives

---

### POST /api/v1/design/:optimizationId/undo

**Purpose**: Undo last design change

**Path Parameters**:
- `optimizationId` (UUID): Optimization ID

**Success Response** (200):
```typescript
{
  customization_id: string | null;
  previous_state: Record<string, unknown>;
  message: string;
}
```

**Example Response**:
```json
{
  "customization_id": "cust-abc123",
  "previous_state": {
    "colors": {
      "primary": "#1e40af"
    }
  },
  "message": "Design change undone successfully"
}
```

---

### POST /api/v1/design/:optimizationId/revert

**Purpose**: Revert to original template defaults (remove all customizations)

**Path Parameters**:
- `optimizationId` (UUID): Optimization ID

**Success Response** (200):
```typescript
{
  template_key: string;
  customization_id: null;
  message: string;
}
```

**Example Response**:
```json
{
  "template_key": "minimal",
  "customization_id": null,
  "message": "All customizations removed. Resume reverted to template defaults."
}
```

---

## User Story 3: Application History (Application Endpoints)

### POST /api/applications

**Purpose**: Create application record when user clicks "Apply Resume"

**Request Body**:
```typescript
{
  optimization_id: string;    // Required
  job_title?: string;         // Optional but recommended
  company?: string;           // Optional but recommended
  job_url?: string;           // Optional
  notes?: string;             // Optional
}
```

**Success Response** (201):
```typescript
{
  id: string;
  optimization_id: string;
  status: 'applied';
  applied_date: string;       // ISO 8601
  job_title: string | null;
  company: string | null;
  job_url: string | null;
}
```

**Example Response**:
```json
{
  "id": "app-123abc",
  "optimization_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "applied",
  "applied_date": "2025-10-15T14:30:00Z",
  "job_title": "Senior Software Engineer",
  "company": "Acme Corp",
  "job_url": "https://example.com/jobs/123"
}
```

**Error Responses**:
- **409**: Duplicate application warning
  ```json
  {
    "error": "Duplicate detected",
    "message": "You've already applied to Senior Software Engineer at Acme Corp today. Are you sure you want to create another application?",
    "existing_application_id": "app-previous",
    "confirm_required": true
  }
  ```
  **Note**: Client should prompt user to confirm, then resend with `?confirm=true` query parameter

**Business Rules**:
1. Check for duplicates: (user_id, job_title, company, DATE(applied_date))
2. If duplicate found, return 409 with `confirm_required=true`
3. If `?confirm=true` query param, bypass duplicate check and create
4. Default status is 'applied'

---

### GET /api/optimizations

**Purpose**: List optimizations with application status (for history dashboard)

**Query Parameters**:
```typescript
{
  page?: number;              // Default: 1
  limit?: number;             // Default: 20, max: 100
  search?: string;            // Search job title/company
  dateFrom?: string;          // ISO 8601 date
  dateTo?: string;            // ISO 8601 date
  minScore?: number;          // 0-1 scale
  sort?: 'date' | 'score' | 'company';
  order?: 'asc' | 'desc';     // Default: 'desc'
}
```

**Success Response** (200):
```typescript
{
  optimizations: OptimizationWithApplication[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
    totalPages: number;
  };
}

interface OptimizationWithApplication {
  id: string;
  createdAt: string;
  jobTitle: string | null;
  company: string | null;
  matchScore: number | null;
  status: string;
  jobUrl: string | null;
  templateKey: string;
  hasApplication: boolean;              // TRUE if application exists
  applicationStatus?: string;           // 'applied', 'interviewing', etc.
  applicationDate?: string;             // ISO 8601
  applicationId?: string;
}
```

**Example Response**:
```json
{
  "optimizations": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "createdAt": "2025-10-15T10:00:00Z",
      "jobTitle": "Senior Software Engineer",
      "company": "Acme Corp",
      "matchScore": 0.87,
      "status": "completed",
      "jobUrl": "https://example.com/jobs/123",
      "templateKey": "minimal",
      "hasApplication": true,
      "applicationStatus": "applied",
      "applicationDate": "2025-10-15T14:30:00Z",
      "applicationId": "app-123abc"
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

---

## Rate Limiting

**Default Rate Limits** (per user):
- `/api/v1/chat`: 20 requests/min
- `/api/v1/design/*`: 30 requests/min
- `/api/applications`: 10 requests/min
- `/api/optimizations`: 100 requests/min

**Rate Limit Headers** (included in all responses):
```
X-RateLimit-Limit: 20
X-RateLimit-Remaining: 15
X-RateLimit-Reset: 1634567890
```

**Rate Limit Exceeded** (429):
```json
{
  "error": "Too many requests",
  "message": "Rate limit exceeded. Please try again in 30 seconds.",
  "retryAfter": 30
}
```

---

## Error Handling

### Standard Error Response Format

```typescript
{
  error: string;              // Error type (e.g., "Unauthorized")
  message: string;            // Human-readable message
  code?: string;              // Optional error code
  details?: unknown;          // Optional additional context
}
```

### HTTP Status Codes

| Code | Meaning | When Used |
|------|---------|-----------|
| 200 | OK | Successful GET/POST/PUT request |
| 201 | Created | Successful POST creating resource |
| 400 | Bad Request | Invalid request body/parameters |
| 401 | Unauthorized | Missing/invalid authentication |
| 403 | Forbidden | User lacks permission |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate resource (e.g., duplicate application) |
| 422 | Unprocessable Entity | Valid request but business logic error |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server-side error |

---

## Testing Requirements

### Contract Tests

**Must verify**:
1. Request/response schemas match TypeScript types
2. Required fields are enforced
3. Optional fields are truly optional
4. Enum values are validated
5. Foreign key relationships respected (404 when parent doesn't exist)

### Integration Tests

**Must verify**:
1. **Chat Flow**: Send message → Get response → Preview → Apply → Verify version created
2. **Design Flow**: Get templates → Recommend → Customize → Undo → Revert
3. **Application Flow**: Create application → Check for duplicate → View in history
4. **Cross-Feature**: Chat + Design in same session (ensure state consistency)

### E2E Tests

**Must verify**:
1. User completes full optimization session (upload → chat → design → apply) in <10 min
2. AI responses feel conversational and supportive
3. Design changes render within 2s
4. Duplicate detection warns correctly
5. Application history persists correctly

---

## Performance SLAs

| Endpoint | Target | Measurement |
|----------|--------|-------------|
| POST /api/v1/chat | <3s | p95 response time |
| POST /api/v1/design/[id]/customize | <2s | p95 response time |
| GET /api/v1/design/templates/[id]/preview | <5s | p95 render time |
| GET /api/optimizations | <2s | 100 items, p95 |
| POST /api/applications | <500ms | p95 response time |

---

## Deprecation Policy

**No endpoints deprecated** - All endpoints are newly integrated for Feature 006.

**Future breaking changes**:
- API version will increment (v1 → v2)
- v1 endpoints supported for 6 months after v2 release
- Deprecation warnings returned in `X-API-Version-Deprecated` header

---

## Conclusion

This contract documents **existing, production-ready APIs** from Features 002 (Chat) and 003 (Design). No new endpoints needed for Feature 006 - only frontend integration work.

**Key Takeaways**:
1. All endpoints exist and are tested
2. Rate limiting already in place
3. Error handling standardized
4. Performance targets met or exceeded
5. RLS policies enforce security

**Implementation Focus**: Build unified UI that calls these existing endpoints.
