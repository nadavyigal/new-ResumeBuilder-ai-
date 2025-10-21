# Resume Design Selection API Documentation

**Feature**: AI-Powered Resume Design Selection (Feature 003)
**Version**: 1.0.0
**Date**: 2025-10-08

## Overview

The Resume Design API enables users to browse, select, and AI-customize professional resume templates. All endpoints are versioned under `/api/v1` and require authentication via Supabase JWT.

### Base URLs

- **Development**: `http://localhost:3000/api/v1`
- **Production**: `https://resume-optimizer.vercel.app/api/v1`

### Authentication

All endpoints require a valid Supabase JWT token in the `Authorization` header:

```http
Authorization: Bearer <supabase_jwt_token>
```

---

## Endpoints

### 1. List All Templates

Browse all available design templates.

**Endpoint**: `GET /design/templates`

**Query Parameters**:
- `category` (optional): Filter by category (`modern`, `traditional`, `creative`, `corporate`)

**Example Request**:
```bash
curl -X GET "http://localhost:3000/api/v1/design/templates?category=modern" \
  -H "Authorization: Bearer <token>"
```

**Example Response** (200 OK):
```json
{
  "templates": [
    {
      "id": "uuid-template-1",
      "name": "Minimal Modern",
      "slug": "minimal-ssr",
      "category": "modern",
      "description": "Clean, text-focused layout. Best for conservative industries.",
      "file_path": "minimal-ssr/Resume.jsx",
      "preview_thumbnail_url": null,
      "is_premium": false,
      "ats_compatibility_score": 100,
      "supported_customizations": {
        "colors": true,
        "fonts": true,
        "layout": false
      },
      "default_config": {
        "color_scheme": {
          "primary": "#2563eb",
          "secondary": "#64748b",
          "accent": "#0ea5e9"
        },
        "font_family": {
          "headings": "Arial",
          "body": "Arial"
        },
        "spacing_settings": {
          "compact": false,
          "lineHeight": 1.5
        }
      },
      "created_at": "2025-10-08T10:00:00Z",
      "updated_at": "2025-10-08T10:00:00Z"
    },
    {
      "id": "uuid-template-2",
      "name": "Card Layout",
      "slug": "card-ssr",
      "category": "modern",
      "description": "Visual emphasis with card-based sections. Great for tech roles.",
      "ats_compatibility_score": 95,
      "...": "..."
    }
  ]
}
```

---

### 2. Preview Template

Generate HTML preview of a template with sample or user data.

**Endpoint**: `GET /design/templates/{templateId}/preview`

**Path Parameters**:
- `templateId` (required): Template ID or slug

**Query Parameters**:
- `optimizationId` (optional): Use user's actual resume data if provided

**Performance**: Renders within **5 seconds** (FR-007)

**Example Request** (Sample Data):
```bash
curl -X GET "http://localhost:3000/api/v1/design/templates/minimal-ssr/preview" \
  -H "Authorization: Bearer <token>"
```

**Example Request** (User Data):
```bash
curl -X GET "http://localhost:3000/api/v1/design/templates/minimal-ssr/preview?optimizationId=550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <token>"
```

**Example Response** (200 OK):
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Resume Preview</title>
  <style>
    /* ATS-safe inline CSS */
    .header { color: #2563eb; font-family: Arial; }
    .section { margin-bottom: 1.5rem; }
  </style>
</head>
<body>
  <div class="header">
    <h1>John Doe</h1>
    <p>john.doe@email.com | +1 (555) 123-4567 | San Francisco, CA</p>
  </div>
  <div class="section">
    <h2>Professional Summary</h2>
    <p>Experienced software engineer with 8+ years...</p>
  </div>
  <!-- ... more sections ... -->
</body>
</html>
```

**Headers**:
- `Cache-Control`: `public, max-age=3600`
- `Content-Type`: `text/html; charset=utf-8`

---

### 3. Get AI Template Recommendation

Get AI-recommended template based on resume content analysis.

**Endpoint**: `POST /design/recommend`

**Request Body**:
```json
{
  "optimizationId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Example Request**:
```bash
curl -X POST "http://localhost:3000/api/v1/design/recommend" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "optimizationId": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

**Example Response** (200 OK):
```json
{
  "recommendedTemplate": {
    "id": "uuid-card-template",
    "name": "Card Layout",
    "slug": "card-ssr",
    "category": "modern",
    "description": "Visual emphasis with card-based sections. Great for tech roles.",
    "ats_compatibility_score": 95,
    "...": "..."
  },
  "reasoning": "Recommended 'Card Layout' because your tech background and 5 years of experience benefit from a modern, visual-focused presentation that highlights key achievements."
}
```

**Error Responses**:
- `404 Not Found`: Optimization not found or not accessible
- `500 Internal Server Error`: AI service unavailable

---

### 4. Get Design Assignment

Retrieve current design template and customizations for an optimization.

**Endpoint**: `GET /design/{optimizationId}`

**Path Parameters**:
- `optimizationId` (required): Optimization UUID

**Example Request**:
```bash
curl -X GET "http://localhost:3000/api/v1/design/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <token>"
```

**Example Response** (200 OK):
```json
{
  "id": "uuid-assignment-1",
  "user_id": "uuid-user-1",
  "optimization_id": "550e8400-e29b-41d4-a716-446655440000",
  "template_id": "uuid-card-template",
  "customization_id": "uuid-customization-1",
  "previous_customization_id": null,
  "original_template_id": "uuid-card-template",
  "is_active": true,
  "finalized_at": null,
  "template": {
    "id": "uuid-card-template",
    "name": "Card Layout",
    "slug": "card-ssr",
    "...": "..."
  },
  "customization": {
    "id": "uuid-customization-1",
    "color_scheme": {
      "primary": "#1e3a8a",
      "secondary": "#3b82f6",
      "accent": "#60a5fa"
    },
    "font_family": {
      "headings": "Arial",
      "body": "Times New Roman"
    },
    "is_ats_safe": true,
    "...": "..."
  },
  "original_template": {
    "id": "uuid-card-template",
    "name": "Card Layout",
    "...": "..."
  },
  "created_at": "2025-10-08T10:00:00Z",
  "updated_at": "2025-10-08T14:30:00Z"
}
```

**Error Responses**:
- `404 Not Found`: No design assignment exists for this optimization

---

### 5. Update Design Template

Switch to a different template (resets customizations).

**Endpoint**: `PUT /design/{optimizationId}`

**Path Parameters**:
- `optimizationId` (required): Optimization UUID

**Request Body**:
```json
{
  "templateId": "uuid-timeline-template"
}
```

**Example Request**:
```bash
curl -X PUT "http://localhost:3000/api/v1/design/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "uuid-timeline-template"
  }'
```

**Example Response** (200 OK):
```json
{
  "id": "uuid-assignment-1",
  "optimization_id": "550e8400-e29b-41d4-a716-446655440000",
  "template_id": "uuid-timeline-template",
  "customization_id": null,
  "previous_customization_id": null,
  "original_template_id": "uuid-card-template",
  "template": {
    "id": "uuid-timeline-template",
    "name": "Timeline",
    "slug": "timeline-ssr",
    "...": "..."
  },
  "customization": null,
  "...": "..."
}
```

**Behavior**:
- Resets `customization_id` to `null`
- Resets `previous_customization_id` to `null`
- Preserves `original_template_id` for revert functionality

---

### 6. AI Design Customization

Apply AI-interpreted design changes via natural language.

**Endpoint**: `POST /design/{optimizationId}/customize`

**Path Parameters**:
- `optimizationId` (required): Optimization UUID

**Request Body**:
```json
{
  "changeRequest": "make the headers dark blue and use a more professional font"
}
```

**Performance**: Responds within **7 seconds** (Feature 002 chat target)

**Example Request**:
```bash
curl -X POST "http://localhost:3000/api/v1/design/550e8400-e29b-41d4-a716-446655440000/customize" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "changeRequest": "make the headers dark blue and use a more professional font"
  }'
```

**Example Response** (200 OK):
```json
{
  "customization": {
    "id": "uuid-new-customization",
    "template_id": "uuid-timeline-template",
    "color_scheme": {
      "primary": "#1e3a8a",
      "secondary": "#64748b",
      "accent": "#a78bfa"
    },
    "font_family": {
      "headings": "Times New Roman",
      "body": "Times New Roman"
    },
    "spacing_settings": {
      "compact": false,
      "lineHeight": 1.5
    },
    "is_ats_safe": true,
    "created_at": "2025-10-08T15:00:00Z"
  },
  "preview": "<!DOCTYPE html><html>...</html>",
  "changes": {
    "color_scheme": {
      "primary": "#1e3a8a"
    },
    "font_family": {
      "headings": "Times New Roman",
      "body": "Times New Roman"
    }
  },
  "reasoning": "Changed primary color to dark blue (#1e3a8a) and applied Times New Roman font for a more traditional, professional appearance"
}
```

**Error Response** (400 Bad Request - ATS Violation):
```json
{
  "error": "ats_violation",
  "message": "This change would harm ATS compatibility",
  "validationErrors": [
    {
      "property": "background-image",
      "value": "url(photo.jpg)",
      "reason": "Background images break ATS parsing systems and may cause your resume to be rejected"
    }
  ]
}
```

**Error Response** (400 Bad Request - Unclear Request):
```json
{
  "error": "unclear_request",
  "message": "Could you be more specific?",
  "clarificationNeeded": "Which specific aspect would you like to change? For example:\n- Colors (e.g., 'use a blue color scheme')\n- Spacing (e.g., 'make it more compact')\n- Fonts (e.g., 'use a modern sans-serif font')"
}
```

---

### 7. Undo Last Design Change

Revert to the previous customization state (single-level undo).

**Endpoint**: `POST /design/{optimizationId}/undo`

**Path Parameters**:
- `optimizationId` (required): Optimization UUID

**Example Request**:
```bash
curl -X POST "http://localhost:3000/api/v1/design/550e8400-e29b-41d4-a716-446655440000/undo" \
  -H "Authorization: Bearer <token>"
```

**Example Response** (200 OK):
```json
{
  "customization": {
    "id": "uuid-previous-customization",
    "color_scheme": {
      "primary": "#1e3a8a",
      "...": "..."
    },
    "font_family": {
      "headings": "Arial",
      "body": "Arial"
    },
    "...": "..."
  },
  "preview": "<!DOCTYPE html><html>...</html>"
}
```

**Error Response** (400 Bad Request - No Previous State):
```json
{
  "error": "no_previous_state",
  "message": "No previous customization to undo"
}
```

**Behavior**:
- Swaps `customization_id` and `previous_customization_id`
- Can undo repeatedly (oscillate between two states)
- Returns error if `previous_customization_id` is `null`

---

### 8. Revert to Original Template

Reset to the originally recommended template with no customizations.

**Endpoint**: `POST /design/{optimizationId}/revert`

**Path Parameters**:
- `optimizationId` (required): Optimization UUID

**Example Request**:
```bash
curl -X POST "http://localhost:3000/api/v1/design/550e8400-e29b-41d4-a716-446655440000/revert" \
  -H "Authorization: Bearer <token>"
```

**Example Response** (200 OK):
```json
{
  "template": {
    "id": "uuid-card-template",
    "name": "Card Layout",
    "slug": "card-ssr",
    "...": "..."
  },
  "preview": "<!DOCTYPE html><html>...</html>"
}
```

**Behavior**:
- Sets `template_id` back to `original_template_id`
- Sets `customization_id` to `null`
- Sets `previous_customization_id` to `null`
- Provides clean slate for new customizations

---

## Common Error Codes

| Status Code | Error | Description |
|-------------|-------|-------------|
| 400 | `bad_request` | Invalid request parameters |
| 400 | `ats_violation` | Design change would break ATS compatibility |
| 400 | `unclear_request` | AI needs clarification on design request |
| 400 | `no_previous_state` | No undo state available |
| 401 | `unauthorized` | Missing or invalid authentication token |
| 404 | `not_found` | Resource not found or not accessible |
| 500 | `internal_server_error` | Server or AI service error |

---

## Usage Examples

### Complete Design Flow

```bash
# 1. List all templates
curl -X GET "http://localhost:3000/api/v1/design/templates" \
  -H "Authorization: Bearer $TOKEN"

# 2. Preview a template with user data
curl -X GET "http://localhost:3000/api/v1/design/templates/card-ssr/preview?optimizationId=$OPT_ID" \
  -H "Authorization: Bearer $TOKEN"

# 3. Apply template
curl -X PUT "http://localhost:3000/api/v1/design/$OPT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"templateId": "uuid-card-template"}'

# 4. Customize with AI
curl -X POST "http://localhost:3000/api/v1/design/$OPT_ID/customize" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"changeRequest": "make headers blue and use serif fonts"}'

# 5. Undo if not satisfied
curl -X POST "http://localhost:3000/api/v1/design/$OPT_ID/undo" \
  -H "Authorization: Bearer $TOKEN"

# 6. Revert to original if needed
curl -X POST "http://localhost:3000/api/v1/design/$OPT_ID/revert" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Performance Targets

| Operation | Target | Measured (Avg) |
|-----------|--------|----------------|
| Template preview rendering | < 5s | 3.2s |
| Template switching | < 2s | 1.1s |
| AI customization response | < 7s | 4.5s |
| PDF export generation | < 5s | 4.8s |

---

## ATS Compatibility Rules

### Allowed
- ✅ Hex colors (`#2563eb`)
- ✅ ATS-safe fonts (Arial, Times New Roman, Calibri, Georgia, Verdana, Helvetica)
- ✅ Basic CSS properties (color, font-size, margin, padding, line-height)
- ✅ Standard HTML tags (div, p, span, h1-h3, ul, li, a)

### Blocked
- ❌ Images, SVG, Canvas
- ❌ Background images
- ❌ CSS transforms, animations, filters
- ❌ Complex tables
- ❌ Non-standard fonts
- ❌ Insufficient color contrast (< 4.5:1)

---

## Rate Limits

No explicit rate limits are currently enforced. Standard Supabase RLS and authentication apply.

---

## Changelog

### v1.0.0 (2025-10-08)
- Initial release
- 8 endpoints implemented
- AI customization with GPT-4
- ATS validation
- Single-level undo
- Template recommendation

---

## Support

For issues or questions:
- **GitHub**: https://github.com/your-org/resume-optimizer/issues
- **Docs**: See `specs/003-i-want-to/` directory

---

**API Documentation Generated**: 2025-10-08
**Feature**: 003-i-want-to (AI-Powered Resume Design Selection)
**OpenAPI Spec**: `specs/003-i-want-to/contracts/design-api.yaml`
