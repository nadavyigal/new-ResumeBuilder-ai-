# API Contract: Style Customization

**Feature**: 008-enhance-ai-assistent
**Version**: 1.0
**Base URL**: `/api/v1/styles`

## Overview

This API handles real-time visual customization of resumes through natural language requests. Supports background colors, fonts, text colors, and layout adjustments with immediate preview updates.

## Endpoints

### 1. Apply Style Customization

**Purpose**: Apply visual style changes from natural language requests.

**Endpoint**: `POST /api/v1/styles/apply`

**Authentication**: Required

#### Request

```typescript
interface ApplyStyleRequest {
  optimization_id: string;
  session_id?: string;
  message?: string;              // Natural language: "change background to navy"
  customization_changes?: {       // Or explicit changes
    background_color?: string;
    primary_color?: string;
    accent_color?: string;
    text_color?: string;
    header_color?: string;
    font_family?: string;
    font_size?: string;
  };
  preview?: boolean;             // Return preview without saving (default: false)
}
```

**Example Request**:
```json
{
  "optimization_id": "789e4567-e89b-12d3-a456-426614174000",
  "message": "change background to navy blue and use white text"
}
```

#### Response

**Success (200)**:
```typescript
interface ApplyStyleResponse {
  success: true;
  customization_id: string;
  history_record_id: string;
  applied_changes: {
    background_color?: string;
    primary_color?: string;
    text_color?: string;
    font_family?: {
      heading?: string;
      body?: string;
    };
  };
  preview_url: string;
  preview_image_url?: string; // Generated preview thumbnail
}
```

**Example Success Response**:
```json
{
  "success": true,
  "customization_id": "custom-001",
  "history_record_id": "660e8400-e29b-41d4-a716-446655440000",
  "applied_changes": {
    "background_color": "#001f3f",
    "text_color": "#ffffff",
    "primary_color": "#0074d9"
  },
  "preview_url": "/api/v1/optimizations/789e4567/preview",
  "preview_image_url": "/api/v1/optimizations/789e4567/preview.png"
}
```

**Error Responses**:

**400 Bad Request**:
```json
{
  "success": false,
  "error": "Invalid color format",
  "details": "Color 'banana' is not recognized. Use hex codes (#001f3f) or standard color names (navy, blue, etc.)",
  "invalid_value": "banana"
}
```

**422 Unprocessable Entity**:
```json
{
  "success": false,
  "error": "Accessibility warning",
  "details": "Background/text contrast ratio (2.1:1) is below WCAG AA standard (4.5:1)",
  "suggested_alternatives": {
    "text_color": "#ffffff",
    "background_color": "#001f3f"
  },
  "allow_override": true
}
```

---

### 2. Parse Style Request

**Purpose**: Parse natural language style request without applying (preview mode).

**Endpoint**: `POST /api/v1/styles/parse`

**Authentication**: Required

#### Request

```typescript
interface ParseStyleRequest {
  message: string;
  current_customization?: DesignCustomization;
}
```

**Example**:
```json
{
  "message": "make headers green and use Arial font",
  "current_customization": { /* current design */ }
}
```

#### Response

**Success (200)**:
```typescript
interface ParseStyleResponse {
  success: true;
  parsed_changes: Array<{
    target: 'background' | 'header' | 'text' | 'primary' | 'accent' | 'font';
    property: string;
    value: string;
    original_value?: string;
    confidence: number;
  }>;
  overall_confidence: number;
  requires_clarification: boolean;
  clarification_question?: string;
  preview_mockup?: string; // Data URL or path to preview
}
```

**Example**:
```json
{
  "success": true,
  "parsed_changes": [
    {
      "target": "header",
      "property": "color",
      "value": "#10b981",
      "original_value": "#2563eb",
      "confidence": 95
    },
    {
      "target": "font",
      "property": "font-family",
      "value": "Arial",
      "original_value": "Roboto",
      "confidence": 100
    }
  ],
  "overall_confidence": 97.5,
  "requires_clarification": false
}
```

---

### 3. Get Style History

**Purpose**: Retrieve style customization history for an optimization.

**Endpoint**: `GET /api/v1/styles/history`

**Authentication**: Required

#### Request

**Query Parameters**:
- `optimization_id` (required): UUID
- `limit` (optional): Number of records (default: 20)
- `offset` (optional): Pagination offset (default: 0)

#### Response

**Success (200)**:
```typescript
interface StyleHistoryResponse {
  success: true;
  total_count: number;
  history: StyleCustomizationHistory[];
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
  "total_count": 8,
  "history": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440000",
      "customization_type": "color",
      "changes": {
        "background": "#001f3f",
        "text": "#ffffff"
      },
      "request_text": "change background to navy blue and use white text",
      "created_at": "2025-01-18T10:35:00Z"
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "has_more": false
  }
}
```

---

### 4. Revert Style Change

**Purpose**: Revert to a previous style customization.

**Endpoint**: `POST /api/v1/styles/revert`

**Authentication**: Required

#### Request

```typescript
interface RevertStyleRequest {
  optimization_id: string;
  history_record_id: string; // Revert to this state
}
```

#### Response

**Success (200)**:
```typescript
interface RevertStyleResponse {
  success: true;
  customization_id: string;
  reverted_to: StyleCustomizationHistory;
  preview_url: string;
}
```

---

### 5. Validate Style Changes

**Purpose**: Check if proposed style changes meet accessibility and template constraints.

**Endpoint**: `POST /api/v1/styles/validate`

**Authentication**: Required

#### Request

```typescript
interface ValidateStyleRequest {
  optimization_id: string;
  proposed_changes: {
    background_color?: string;
    text_color?: string;
    primary_color?: string;
  };
  template_id?: string;
}
```

#### Response

**Success (200)**:
```typescript
interface ValidateStyleResponse {
  success: true;
  valid: boolean;
  warnings: Array<{
    type: 'accessibility' | 'template_constraint' | 'readability';
    severity: 'error' | 'warning' | 'info';
    message: string;
    suggested_fix?: any;
  }>;
  accessibility_scores: {
    contrast_ratio: number;
    wcag_aa_compliant: boolean;
    wcag_aaa_compliant: boolean;
  };
}
```

**Example**:
```json
{
  "success": true,
  "valid": false,
  "warnings": [
    {
      "type": "accessibility",
      "severity": "error",
      "message": "Contrast ratio 2.1:1 is below WCAG AA requirement of 4.5:1",
      "suggested_fix": {
        "text_color": "#ffffff",
        "background_color": "#001f3f"
      }
    }
  ],
  "accessibility_scores": {
    "contrast_ratio": 2.1,
    "wcag_aa_compliant": false,
    "wcag_aaa_compliant": false
  }
}
```

---

## Color Parsing Logic

### Supported Color Formats

**1. Hex Codes**:
- `#001f3f` (6-digit)
- `#03f` (3-digit, expands to `#0033ff`)

**2. RGB/RGBA**:
- `rgb(0, 31, 63)`
- `rgba(0, 31, 63, 0.9)`

**3. HSL/HSLA**:
- `hsl(210, 100%, 12%)`
- `hsla(210, 100%, 12%, 0.9)`

**4. Named Colors**:
```typescript
const colorNameMap: Record<string, string> = {
  // Blues
  'navy': '#001f3f',
  'navy blue': '#001f3f',
  'blue': '#0074d9',
  'light blue': '#7fdbff',
  'dark blue': '#002b5c',
  'sky blue': '#87ceeb',

  // Greens
  'green': '#2ecc40',
  'dark green': '#0d5e2a',
  'light green': '#90ee90',
  'mint': '#98ff98',
  'emerald': '#50c878',

  // Reds
  'red': '#ff4136',
  'dark red': '#8b0000',
  'light red': '#ffb3b3',
  'crimson': '#dc143c',

  // Grays
  'gray': '#aaa',
  'grey': '#aaa',
  'light gray': '#ddd',
  'dark gray': '#555',
  'charcoal': '#36454f',
  'slate': '#708090',

  // Neutrals
  'white': '#ffffff',
  'black': '#000000',
  'off-white': '#fafafa',
  'ivory': '#fffff0',
  'cream': '#fffdd0',

  // Professional colors
  'professional blue': '#2c3e50',
  'corporate gray': '#34495e',
  'executive navy': '#1a2332',
  'business burgundy': '#800020',
};
```

### Font Parsing

**Supported Fonts**:
```typescript
const supportedFonts = [
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Georgia',
  'Courier New',
  'Verdana',
  'Roboto',
  'Open Sans',
  'Lato',
  'Montserrat',
  'Raleway',
  'Poppins',
  'Inter',
];
```

**Font Family Mapping**:
```typescript
const fontAliases: Record<string, string> = {
  'arial': 'Arial',
  'roboto': 'Roboto',
  'times': 'Times New Roman',
  'times new roman': 'Times New Roman',
  'georgia': 'Georgia',
  'courier': 'Courier New',
  'courier new': 'Courier New',
  'verdana': 'Verdana',
  'helvetica': 'Helvetica',
};
```

---

## Accessibility Validation

### Contrast Ratio Calculation

```typescript
function getContrastRatio(color1: string, color2: string): number {
  const lum1 = getRelativeLuminance(color1);
  const lum2 = getRelativeLuminance(color2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

function getRelativeLuminance(hexColor: string): number {
  const rgb = hexToRgb(hexColor);
  const [r, g, b] = rgb.map(val => {
    const sRGB = val / 255;
    return sRGB <= 0.03928
      ? sRGB / 12.92
      : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
```

### WCAG Standards

| Standard | Minimum Contrast Ratio | Use Case |
|----------|------------------------|----------|
| WCAG AA (Normal Text) | 4.5:1 | Body text, descriptions |
| WCAG AA (Large Text) | 3:1 | Headings (18pt+, 14pt+ bold) |
| WCAG AAA (Normal Text) | 7:1 | Enhanced accessibility |
| WCAG AAA (Large Text) | 4.5:1 | Enhanced large text |

---

## Template Constraints

### Template-Specific Overrides

Some templates may have restrictions on customization:

```typescript
interface TemplateConstraints {
  template_id: string;
  allow_background_change: boolean;
  allow_font_change: boolean;
  allow_primary_color_change: boolean;
  fixed_layout: boolean;
  min_font_size: number;
  max_font_size: number;
  allowed_color_schemes?: string[]; // Predefined schemes only
}
```

**Example**:
```json
{
  "template_id": "professional-ats",
  "allow_background_change": true,
  "allow_font_change": false, // Font is fixed for ATS compatibility
  "allow_primary_color_change": true,
  "fixed_layout": true,
  "min_font_size": 10,
  "max_font_size": 14
}
```

---

## PDF Export Integration

### Style Application to PDF

When generating PDF with custom styles:

1. **Color Conversion**: Convert web colors to CMYK for print
2. **Font Embedding**: Ensure custom fonts are embedded
3. **Layout Validation**: Check styles don't break template layout
4. **Accessibility Tags**: Include PDF/UA tags for screen readers

**API Call**:
```typescript
POST /api/v1/optimizations/{id}/export
{
  "format": "pdf",
  "include_customization": true, // Apply custom styles
  "print_optimized": true // Convert to CMYK
}
```

---

## Implementation Details

### Real-Time Preview

**WebSocket Updates** (Optional):
```typescript
// Client subscribes to optimization updates
ws.subscribe(`optimization:${optimizationId}:styles`);

// Server broadcasts style changes
ws.broadcast({
  type: 'style_update',
  optimization_id: optimizationId,
  changes: { background_color: '#001f3f' },
  preview_url: '/api/v1/optimizations/.../preview'
});
```

**Polling Alternative**:
```typescript
// Client polls for latest customization
GET /api/v1/styles/current?optimization_id=789e4567

// Response includes last updated timestamp
{
  "customization_id": "custom-001",
  "last_updated": "2025-01-18T10:35:00Z",
  "changes": { /* ... */ }
}
```

### Optimistic UI Updates

Client applies style changes immediately, then confirms with server:

```typescript
// 1. Apply to UI immediately
applyStyleToPreview(proposedChanges);

// 2. Send to server
const response = await fetch('/api/v1/styles/apply', {
  method: 'POST',
  body: JSON.stringify({ /* ... */ })
});

// 3. Rollback if server rejects
if (!response.success) {
  revertStyleChanges();
  showError(response.error);
}
```

---

## Examples

### Example 1: Simple Background Change

**Request**:
```json
{
  "optimization_id": "789e4567",
  "message": "change background to light blue"
}
```

**Response**:
```json
{
  "success": true,
  "applied_changes": {
    "background_color": "#7fdbff"
  },
  "preview_url": "/api/v1/optimizations/789e4567/preview"
}
```

### Example 2: Multiple Style Changes

**Request**:
```json
{
  "optimization_id": "789e4567",
  "message": "use navy background, white text, and Roboto font"
}
```

**Response**:
```json
{
  "success": true,
  "applied_changes": {
    "background_color": "#001f3f",
    "text_color": "#ffffff",
    "font_family": {
      "heading": "Roboto",
      "body": "Roboto"
    }
  },
  "preview_url": "/api/v1/optimizations/789e4567/preview"
}
```

### Example 3: Accessibility Warning

**Request**:
```json
{
  "optimization_id": "789e4567",
  "customization_changes": {
    "background_color": "#ffff00",  // Yellow
    "text_color": "#ffffff"          // White
  }
}
```

**Response** (422):
```json
{
  "success": false,
  "error": "Accessibility warning",
  "details": "Contrast ratio 1.07:1 is critically below WCAG AA standard",
  "accessibility_scores": {
    "contrast_ratio": 1.07,
    "wcag_aa_compliant": false
  },
  "suggested_alternatives": {
    "text_color": "#000000" // Black text on yellow background
  }
}
```

---

**API Version**: 1.0
**Status**: ✅ Ready for Implementation
**Dependencies**: Design System, PDF Generator, Accessibility Validator
