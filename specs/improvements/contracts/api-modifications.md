# API Contract: Content Modifications

**Feature**: 008-enhance-ai-assistent
**Version**: 1.0
**Base URL**: `/api/v1/modifications`

## Overview

This API handles intelligent resume content modifications through natural language requests. It provides field-specific updates, maintains resume structure integrity, and triggers automatic ATS rescoring.

## Endpoints

### 1. Apply Modification

**Purpose**: Apply intelligent modifications to resume content based on natural language requests.

**Endpoint**: `POST /api/v1/modifications/apply`

**Authentication**: Required (Bearer token)

**Rate Limit**: 30 requests per minute per user

#### Request

```typescript
interface ApplyModificationRequest {
  optimization_id: string;      // UUID of the optimization
  session_id?: string;           // Optional chat session ID
  message: string;               // Natural language request
  modifications?: ModificationRequest[]; // Pre-parsed modifications (optional)
  auto_rescore?: boolean;        // Trigger ATS rescoring (default: true)
}

interface ModificationRequest {
  operation: 'replace' | 'prefix' | 'suffix' | 'append' | 'insert' | 'remove';
  target_path: string;           // JSON path: "experiences[0].title"
  value: any;
  reason?: string;
}
```

**Example Request**:
```json
{
  "optimization_id": "789e4567-e89b-12d3-a456-426614174000",
  "session_id": "456e8400-e29b-41d4-a716-446655440000",
  "message": "add Senior to my latest job title",
  "auto_rescore": true
}
```

#### Response

**Success (200)**:
```typescript
interface ApplyModificationResponse {
  success: true;
  modifications_applied: ContentModification[];
  updated_resume: OptimizedResume;
  ats_score_before: number;
  ats_score_after: number;
  score_change: number;
  preview_url?: string;
}
```

**Example Success Response**:
```json
{
  "success": true,
  "modifications_applied": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "operation": "prefix",
      "field_path": "experiences[0].title",
      "old_value": "Software Engineer",
      "new_value": "Senior Software Engineer",
      "ats_score_before": 72.5,
      "ats_score_after": 78.3,
      "score_change": 5.8,
      "created_at": "2025-01-18T10:30:00Z"
    }
  ],
  "updated_resume": { /* full resume JSON */ },
  "ats_score_before": 72.5,
  "ats_score_after": 78.3,
  "score_change": 5.8,
  "preview_url": "/api/v1/optimizations/789e4567/preview"
}
```

**Error Responses**:

**400 Bad Request** - Invalid request format
```json
{
  "success": false,
  "error": "Invalid field path",
  "details": "Field 'experiences[10].title' does not exist in resume",
  "field_path": "experiences[10].title"
}
```

**404 Not Found** - Optimization not found
```json
{
  "success": false,
  "error": "Optimization not found",
  "optimization_id": "789e4567-e89b-12d3-a456-426614174000"
}
```

**422 Unprocessable Entity** - Cannot parse modification request
```json
{
  "success": false,
  "error": "Could not understand modification request",
  "details": "Please specify which field to modify (e.g., 'add Senior to my job title')",
  "message": "make it better"
}
```

**500 Internal Server Error** - Server error
```json
{
  "success": false,
  "error": "Failed to apply modification",
  "details": "Database update failed",
  "retry": true
}
```

---

### 2. Parse Modification

**Purpose**: Parse natural language request into structured modification operations without applying them (preview mode).

**Endpoint**: `POST /api/v1/modifications/parse`

**Authentication**: Required

#### Request

```typescript
interface ParseModificationRequest {
  message: string;               // Natural language request
  resume_schema?: OptimizedResume; // Current resume for context
}
```

**Example Request**:
```json
{
  "message": "change my job title to Senior Software Engineer and add React to my skills",
  "resume_schema": { /* current resume */ }
}
```

#### Response

**Success (200)**:
```typescript
interface ParseModificationResponse {
  success: true;
  parsed_modifications: ParsedModification[];
  confidence: number; // 0-100
  requires_clarification: boolean;
  clarification_question?: string;
}

interface ParsedModification {
  operation: ModificationOperation;
  target_path: string;
  current_value: any;
  proposed_value: any;
  confidence: number;
  reason: string;
}
```

**Example Success Response**:
```json
{
  "success": true,
  "parsed_modifications": [
    {
      "operation": "replace",
      "target_path": "experiences[0].title",
      "current_value": "Software Engineer",
      "proposed_value": "Senior Software Engineer",
      "confidence": 95,
      "reason": "User explicitly requested title change"
    },
    {
      "operation": "append",
      "target_path": "skills.technical",
      "current_value": ["JavaScript", "Python"],
      "proposed_value": ["JavaScript", "Python", "React"],
      "confidence": 90,
      "reason": "Adding React to technical skills"
    }
  ],
  "confidence": 92.5,
  "requires_clarification": false
}
```

**Low Confidence Response**:
```json
{
  "success": true,
  "parsed_modifications": [],
  "confidence": 35,
  "requires_clarification": true,
  "clarification_question": "Which field would you like to modify? For example: job title, company name, skills, or achievements?"
}
```

---

### 3. Get Modification History

**Purpose**: Retrieve modification history for an optimization.

**Endpoint**: `GET /api/v1/modifications/history`

**Authentication**: Required

#### Request

**Query Parameters**:
- `optimization_id` (required): UUID
- `limit` (optional): Number of records (default: 20, max: 100)
- `offset` (optional): Pagination offset (default: 0)
- `include_reverted` (optional): Include reverted modifications (default: false)

**Example**:
```
GET /api/v1/modifications/history?optimization_id=789e4567&limit=10&include_reverted=false
```

#### Response

**Success (200)**:
```typescript
interface ModificationHistoryResponse {
  success: true;
  total_count: number;
  modifications: ContentModification[];
  pagination: {
    limit: number;
    offset: number;
    has_more: boolean;
  };
}
```

**Example**:
```json
{
  "success": true,
  "total_count": 15,
  "modifications": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "operation": "prefix",
      "field_path": "experiences[0].title",
      "old_value": "Software Engineer",
      "new_value": "Senior Software Engineer",
      "ats_score_change": 5.8,
      "created_at": "2025-01-18T10:30:00Z"
    }
  ],
  "pagination": {
    "limit": 10,
    "offset": 0,
    "has_more": true
  }
}
```

---

### 4. Revert Modification

**Purpose**: Undo a specific modification and restore previous value.

**Endpoint**: `POST /api/v1/modifications/{modification_id}/revert`

**Authentication**: Required

#### Request

```typescript
interface RevertModificationRequest {
  auto_rescore?: boolean; // Re-calculate ATS score (default: true)
}
```

#### Response

**Success (200)**:
```typescript
interface RevertModificationResponse {
  success: true;
  reverted_modification_id: string;
  new_modification_id: string; // The revert operation itself is a modification
  updated_resume: OptimizedResume;
  ats_score_before: number;
  ats_score_after: number;
  score_change: number;
}
```

**Example**:
```json
{
  "success": true,
  "reverted_modification_id": "550e8400-e29b-41d4-a716-446655440000",
  "new_modification_id": "660e8400-e29b-41d4-a716-446655440000",
  "updated_resume": { /* resume with original value restored */ },
  "ats_score_before": 78.3,
  "ats_score_after": 72.5,
  "score_change": -5.8
}
```

---

## Implementation Details

### Field Path Resolution

**Supported Paths**:
- `summary` - Resume summary/objective
- `personalInfo.name` - Full name
- `personalInfo.email` - Email address
- `experiences[0].title` - Job title of first experience
- `experiences[0].company` - Company name
- `experiences[0].achievements[0]` - First achievement bullet
- `skills.technical` - Technical skills array
- `skills.soft` - Soft skills array
- `education[0].degree` - Degree name

**Path Validation**:
1. Parse path into components (root, indices, property)
2. Validate root exists in schema
3. Check array indices are within bounds
4. Verify property exists on target object

### Operation Types

**replace**: Complete field replacement
```typescript
// "change my job title to Senior Engineer"
{
  operation: 'replace',
  target_path: 'experiences[0].title',
  value: 'Senior Engineer'
}
```

**prefix**: Add text before existing value
```typescript
// "add Senior to my job title"
{
  operation: 'prefix',
  target_path: 'experiences[0].title',
  value: 'Senior '
}
// Result: "Senior Software Engineer"
```

**suffix**: Add text after existing value
```typescript
// "add (Remote) to my job title"
{
  operation: 'suffix',
  target_path: 'experiences[0].title',
  value: ' (Remote)'
}
// Result: "Software Engineer (Remote)"
```

**append**: Add item to array
```typescript
// "add React to my skills"
{
  operation: 'append',
  target_path: 'skills.technical',
  value: 'React'
}
```

**insert**: Insert item at specific array position
```typescript
// "add a new achievement as the first bullet"
{
  operation: 'insert',
  target_path: 'experiences[0].achievements',
  value: 'Led team of 5 engineers',
  index: 0
}
```

**remove**: Delete field or array item
```typescript
// "remove Python from my skills"
{
  operation: 'remove',
  target_path: 'skills.technical',
  value: 'Python' // Item to remove from array
}
```

### ATS Rescoring Trigger

When `auto_rescore: true`:
1. Apply all modifications to resume JSON
2. Call ATS scoring engine with updated resume
3. Update `ats_score_optimized`, `ats_subscores`, `ats_suggestions`
4. Record score changes in `content_modifications` table
5. Return updated scores to client

### Error Handling

**Graceful Degradation**:
- If ATS rescoring fails, apply modification but return estimated score
- If modification partially fails, return what succeeded + detailed error
- Always save modification record for audit trail

**Rollback Strategy**:
- Modifications are atomic (all-or-nothing per request)
- If database update fails after applying to JSON, rollback transaction
- Provide revert endpoint for user-initiated undo

### Security

**Authorization**:
- Verify user owns the optimization
- Check RLS policies on all database operations
- Sanitize error messages (remove PII)

**Input Validation**:
- Validate all field paths against schema
- Sanitize string values (prevent XSS)
- Limit modification batch size (max 10 per request)

**Rate Limiting**:
- 30 requests per minute per user
- 100 total modifications per optimization per day
- Block suspicious patterns (rapid identical requests)

---

## Examples

### Example 1: Simple Title Update

**Request**:
```bash
curl -X POST https://api.example.com/api/v1/modifications/apply \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "optimization_id": "789e4567-e89b-12d3-a456-426614174000",
    "message": "add Senior to my latest job title"
  }'
```

**Response**:
```json
{
  "success": true,
  "modifications_applied": [{
    "operation": "prefix",
    "field_path": "experiences[0].title",
    "old_value": "Software Engineer",
    "new_value": "Senior Software Engineer"
  }],
  "ats_score_before": 72.5,
  "ats_score_after": 78.3,
  "score_change": 5.8
}
```

### Example 2: Multiple Skills Addition

**Request**:
```json
{
  "optimization_id": "789e4567",
  "message": "add React, TypeScript, and Node.js to my technical skills"
}
```

**Response**:
```json
{
  "success": true,
  "modifications_applied": [
    {
      "operation": "append",
      "field_path": "skills.technical",
      "old_value": ["JavaScript", "Python"],
      "new_value": ["JavaScript", "Python", "React", "TypeScript", "Node.js"]
    }
  ],
  "ats_score_change": 8.2
}
```

### Example 3: Ambiguous Request (Requires Clarification)

**Request**:
```json
{
  "optimization_id": "789e4567",
  "message": "make my resume better"
}
```

**Response** (422):
```json
{
  "success": false,
  "error": "Request too vague",
  "details": "Please specify which part of your resume to improve",
  "suggestions": [
    "Add specific skills or keywords",
    "Update job titles or companies",
    "Enhance achievement descriptions",
    "Modify summary or objective"
  ]
}
```

---

**API Version**: 1.0
**Status**: ✅ Ready for Implementation
**Dependencies**: ATS Scoring Engine, Resume Schema Validator
