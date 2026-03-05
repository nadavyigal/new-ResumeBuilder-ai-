# API Contract: Chat Enhancements for Tip Implementation

## Overview
Enhanced chat API to support numbered ATS tip implementation and color customization.

---

## 1. Send Chat Message (Enhanced)

### Endpoint
```
POST /api/v1/chat
```

### Request Body

```typescript
{
  "session_id": "uuid-string" | null,           // Optional: existing session
  "optimization_id": "uuid-string",             // Required: optimization ID
  "message": "implement tip 1 and 3",           // Required: user message
  
  // NEW: Tip context for numbered implementation
  "tip_context": {
    "tip_numbers": [1, 3],                      // Tips referenced in message
    "tip_suggestions": [                        // Full suggestion objects
      {
        "id": "suggestion-1",
        "text": "Add Python keyword 5 more times",
        "estimated_gain": 8,
        "category": "keywords",
        "quick_win": true,
        "targets": ["keyword_exact"]
      }
    ]
  }
}
```

### Response

```typescript
{
  "session_id": "uuid-string",
  "message": {
    "id": "message-uuid",
    "session_id": "session-uuid",
    "sender": "assistant",
    "content": "Applied tips 1 and 3. Your ATS score increased by 12 points!",
    "created_at": "2025-11-06T10:30:00Z"
  },
  
  // NEW: Tip application results
  "tips_applied": {
    "tip_numbers": [1, 3],
    "score_change": 12,
    "updated_sections": ["skills", "experience"],
    "new_ats_score": 86
  },
  
  // NEW: Color customization (if color change requested)
  "color_customization": {
    "background_color": "#f5f3f0",
    "header_color": "#2563eb",
    "text_color": "#1f2937"
  },
  
  // Existing: Design customization
  "design_customization": {
    "colors": {
      "background": "#f5f3f0",
      "primary": "#2563eb"
    }
  }
}
```

### Error Responses

#### 400 Bad Request - Invalid Tip Numbers
```json
{
  "error": "Invalid tip numbers",
  "details": {
    "invalid_tips": [5, 7],
    "available_tips": [1, 2, 3, 4],
    "message": "Tips 5 and 7 do not exist. Available tips: 1-4"
  }
}
```

#### 400 Bad Request - Invalid Color
```json
{
  "error": "Invalid color value",
  "details": {
    "color": "notacolor",
    "message": "Color must be a hex code (#RRGGBB), rgb value, or named color"
  }
}
```

#### 500 Internal Server Error - Application Failed
```json
{
  "error": "Failed to apply tips",
  "details": {
    "tip_numbers": [1, 3],
    "reason": "Resume content update failed",
    "retry": true
  }
}
```

---

## 2. Agent Intent Detection (Internal)

### New Intent Handlers

#### handleTipImplementation

**Input:**
```typescript
{
  message: "implement tip 1, 2 and 4",
  optimizationId: "uuid",
  atsSuggestions: Suggestion[],
  numberedTips: NumberedTip[]
}
```

**Processing:**
1. Parse tip numbers from message using regex
2. Validate tip numbers against available tips
3. Fetch current resume data
4. Apply each tip's suggestion to resume content
5. Recalculate ATS score
6. Update optimization record
7. Return results

**Output:**
```typescript
{
  intent: "tip_implementation",
  tip_numbers: [1, 2, 4],
  updated_content: OptimizedResume,
  score_before: 74,
  score_after: 86,
  sections_modified: ["skills", "summary", "experience"]
}
```

#### handleColorCustomization

**Input:**
```typescript
{
  message: "change background to blue",
  optimizationId: "uuid",
  currentDesign: DesignAssignment
}
```

**Processing:**
1. Extract color intent (background, header, text, etc.)
2. Parse color value (named color, hex, rgb)
3. Validate color format
4. Create design customization object
5. Apply to design assignment
6. Return customization for preview

**Output:**
```typescript
{
  intent: "color_customization",
  target: "background",
  color: "#3b82f6",  // Converted named color to hex
  customization: {
    colors: {
      background: "#3b82f6"
    }
  },
  preview: true
}
```

---

## 3. Resume Update After Tip Application

### Internal Flow

```
1. User sends: "implement tip 1 and 3"
2. ChatSidebar extracts tip numbers → [1, 3]
3. POST /api/v1/chat with tip_context
4. Agent detects TIP_IMPLEMENTATION intent
5. Agent retrieves suggestions for tips 1 and 3
6. Agent calls applyTipSuggestions(resume, suggestions)
7. Resume content updated (e.g., add keywords, metrics)
8. ATS score recalculated
9. Update optimizations.rewrite_data, ats_score_optimized
10. Return success response with new score
11. ChatSidebar triggers parent refresh
12. OptimizationPage re-fetches data
13. UI shows updated resume + new ATS score
```

### Database Updates

**Table:** `optimizations`

```sql
UPDATE optimizations
SET 
  rewrite_data = $1,              -- Updated resume content
  ats_score_optimized = $2,        -- New ATS score
  ats_subscores = $3,              -- Updated subscores
  updated_at = NOW()
WHERE id = $4;
```

---

## 4. Color Customization Flow

### Internal Flow

```
1. User sends: "make headers blue"
2. ChatSidebar sends message to /api/v1/chat
3. Agent detects COLOR_CUSTOMIZATION intent
4. Agent extracts: { target: "header", color: "blue" }
5. Agent converts color to hex: "#3b82f6"
6. Agent creates customization object
7. POST /api/v1/design/:optimizationId with customization
8. design_assignments.customization updated
9. Return color_customization in chat response
10. ChatSidebar calls onDesignPreview(customization)
11. OptimizationPage applies ephemeral preview
12. DesignRenderer re-renders with new colors
```

### Design Assignment Update

**Table:** `design_assignments`

```sql
-- Upsert customization
INSERT INTO design_assignments (
  optimization_id,
  template_id,
  customization,
  created_at,
  updated_at
)
VALUES ($1, $2, $3, NOW(), NOW())
ON CONFLICT (optimization_id)
DO UPDATE SET
  customization = design_assignments.customization || $3,
  updated_at = NOW();
```

**Customization Object:**
```json
{
  "colors": {
    "background": "#f5f3f0",
    "primary": "#2563eb",
    "heading": "#1e40af",
    "text": "#1f2937"
  }
}
```

---

## 5. Testing Contracts

### Test Case 1: Implement Single Tip

**Request:**
```bash
curl -X POST http://localhost:3001/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "optimization_id": "893c7c00-1ed1-445d-b9e8-3aef77563679",
    "message": "implement tip 1",
    "tip_context": {
      "tip_numbers": [1],
      "tip_suggestions": [{ 
        "id": "tip-1", 
        "text": "Add Python keyword", 
        "estimated_gain": 8 
      }]
    }
  }'
```

**Expected Response:**
```json
{
  "session_id": "...",
  "message": { "content": "Applied tip 1..." },
  "tips_applied": {
    "tip_numbers": [1],
    "score_change": 8,
    "new_ats_score": 82
  }
}
```

### Test Case 2: Change Background Color

**Request:**
```bash
curl -X POST http://localhost:3001/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "optimization_id": "893c7c00-1ed1-445d-b9e8-3aef77563679",
    "message": "change background to light blue"
  }'
```

**Expected Response:**
```json
{
  "session_id": "...",
  "message": { "content": "Changed background to light blue" },
  "color_customization": {
    "background_color": "#bfdbfe"
  }
}
```

### Test Case 3: Invalid Tip Number

**Request:**
```bash
curl -X POST http://localhost:3001/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "optimization_id": "893c7c00-1ed1-445d-b9e8-3aef77563679",
    "message": "implement tip 99",
    "tip_context": {
      "tip_numbers": [99],
      "tip_suggestions": []
    }
  }'
```

**Expected Response:**
```json
{
  "error": "Invalid tip numbers",
  "details": {
    "invalid_tips": [99],
    "available_tips": [1, 2, 3]
  }
}
```

---

## 6. Confidence Levels

| Endpoint | Scenario | Expected CL% |
|----------|----------|-------------|
| POST /api/v1/chat | Single tip implementation | 95% |
| POST /api/v1/chat | Multiple tips (2-3) | 90% |
| POST /api/v1/chat | Color change (named color) | 95% |
| POST /api/v1/chat | Color change (hex) | 90% |
| POST /api/v1/chat | Invalid tip number | 100% (error) |
| POST /api/v1/chat | Ambiguous color | 70% |

---

## 7. Backward Compatibility

**All changes are backward compatible:**
- `tip_context` is optional in request
- `tips_applied` and `color_customization` only included when relevant
- Existing chat functionality unchanged
- Old clients continue to work without modifications




