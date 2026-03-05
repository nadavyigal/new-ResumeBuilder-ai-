# Data Model: Optimization Page Improvements

## Overview
This document defines the data structures, state management, and persistence requirements for the optimization page improvements.

## State Changes

### Frontend State (React Components)

#### 1. ChatSidebar Component State
**Location:** `src/components/chat/ChatSidebar.tsx`

```typescript
interface ChatSidebarState {
  // Existing state...
  messages: ChatMessageType[];
  sessionId: string | null;
  isLoading: boolean;
  error: string | null;
  
  // NEW: Track numbered tips
  numberedTips: NumberedTip[];
  appliedTipIds: string[];
}

interface NumberedTip {
  number: number;           // Display number (1, 2, 3...)
  suggestionId: string;     // Original suggestion ID
  text: string;             // Suggestion text
  estimatedGain: number;    // Points gain
  category: string;         // Category
  quickWin: boolean;        // Is quick win
  applied: boolean;         // Has been applied
}
```

#### 2. AtsTipsPanel Component (New Props)
**Location:** `src/components/chat/ChatSidebar.tsx` (inline component)

```typescript
interface AtsTipsPanelProps {
  suggestions: Suggestion[];
  onTipSelect?: (tipNumber: number) => void;
  appliedTips?: number[];
}
```

#### 3. Optimization Page State
**Location:** `src/app/dashboard/optimizations/[id]/page.tsx`

```typescript
interface OptimizationPageState {
  // Existing state...
  
  // NEW: Track applied tips for UI feedback
  appliedTipNumbers: number[];
  tipApplicationHistory: TipApplication[];
}

interface TipApplication {
  tipNumber: number;
  suggestionId: string;
  appliedAt: Date;
  scoreBeforeApply: number;
  scoreAfterApply: number;
}
```

## API Contract Changes

### 1. Chat Message Request (Enhanced)

**Endpoint:** `POST /api/v1/chat`

```typescript
interface ChatMessageRequest {
  session_id?: string;
  optimization_id: string;
  message: string;
  
  // NEW: Context for tip implementation
  tip_context?: {
    tip_numbers: number[];
    tip_suggestions: Suggestion[];
  };
}
```

### 2. Chat Message Response (Enhanced)

```typescript
interface ChatMessageResponse {
  session_id: string;
  message: ChatMessage;
  
  // Existing fields...
  design_customization?: any;
  
  // NEW: Tip application results
  tips_applied?: {
    tip_numbers: number[];
    score_change: number;
    updated_sections: string[];
  };
  
  // NEW: Color customization preview
  color_customization?: {
    background_color?: string;
    header_color?: string;
    text_color?: string;
    accent_color?: string;
  };
}
```

## Agent Intent Detection

### New Intent Patterns

**Location:** `src/lib/agent/intents.ts`

```typescript
// NEW: Tip implementation intent
export const TIP_IMPLEMENTATION_INTENT = {
  patterns: [
    /implement tip (\d+(?:,?\s*(?:and\s+)?\d+)*)/i,
    /apply tip (\d+(?:,?\s*(?:and\s+)?\d+)*)/i,
    /use suggestion (\d+(?:,?\s*(?:and\s+)?\d+)*)/i,
    /do tip (\d+(?:,?\s*(?:and\s+)?\d+)*)/i,
  ],
  handler: 'handleTipImplementation',
  priority: 'high',
};

// NEW: Color customization intent
export const COLOR_CUSTOMIZATION_INTENT = {
  patterns: [
    /(?:change|make|set|update)\s+(?:the\s+)?(?:background|bg)\s+(?:color\s+)?(?:to\s+)?(\w+)/i,
    /(?:change|make|set|update)\s+(?:the\s+)?header\s+(?:color\s+)?(?:to\s+)?(\w+)/i,
    /(?:change|make|set|update)\s+(?:the\s+)?(?:text|font)\s+color\s+(?:to\s+)?(\w+)/i,
  ],
  handler: 'handleColorCustomization',
  priority: 'high',
};
```

## Database Schema Changes

### No Direct Database Changes Required

The improvements use existing tables:
- `optimizations` table (already stores `rewrite_data`, `ats_score_optimized`)
- `chat_sessions` and `chat_messages` tables (existing)
- `design_assignments` table (for color customizations)

### Optional: Track Tip Applications (Future Enhancement)

```sql
-- OPTIONAL: For analytics and undo functionality
CREATE TABLE IF NOT EXISTS tip_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  optimization_id UUID NOT NULL REFERENCES optimizations(id) ON DELETE CASCADE,
  tip_number INTEGER NOT NULL,
  suggestion_id TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  score_before INTEGER NOT NULL,
  score_after INTEGER NOT NULL,
  content_changes JSONB NOT NULL,
  
  CONSTRAINT tip_applications_optimization_id_fkey 
    FOREIGN KEY (optimization_id) REFERENCES optimizations(id) ON DELETE CASCADE
);

CREATE INDEX idx_tip_applications_optimization_id 
  ON tip_applications(optimization_id);
```

## Type Definitions

### New Type Exports

**Location:** `src/types/chat.ts`

```typescript
export interface NumberedTip {
  number: number;
  suggestionId: string;
  text: string;
  estimatedGain: number;
  category: string;
  quickWin: boolean;
  applied: boolean;
}

export interface TipImplementationContext {
  tip_numbers: number[];
  tip_suggestions: Suggestion[];
}

export interface ColorCustomization {
  background_color?: string;
  header_color?: string;
  text_color?: string;
  accent_color?: string;
}
```

## Component Props Changes

### SuggestionsList Component

**Location:** `src/components/ats/SuggestionsList.tsx`

```typescript
interface SuggestionsListProps {
  suggestions: Suggestion[];
  onApplySuggestion?: (suggestion: Suggestion) => void;
  maxSuggestions?: number;
  title?: string;
  
  // NEW: Show numbers and track applied
  showNumbers?: boolean;
  appliedSuggestionIds?: string[];
  onNumberClick?: (number: number, suggestion: Suggestion) => void;
}
```

## Design Customization Storage

### Enhanced Customization Object

**Location:** `design_assignments.customization` (JSONB column)

```typescript
interface DesignCustomization {
  // Existing fields...
  fonts?: {
    heading?: string;
    body?: string;
  };
  
  // ENHANCED: Color palette
  colors?: {
    background?: string;      // NEW: Support for background color
    primary?: string;
    secondary?: string;
    accent?: string;
    text?: string;           // NEW: Text color
    heading?: string;        // NEW: Heading color
    border?: string;
  };
  
  spacing?: {
    section?: number;
    line?: number;
  };
}
```

## Migration Path

No database migrations required. All changes are:
1. Frontend state additions
2. API contract enhancements (backward compatible)
3. Agent intent additions
4. Type definition extensions

## Validation Rules

### Tip Number Validation
```typescript
function validateTipNumbers(
  tipNumbers: number[], 
  availableTips: NumberedTip[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const maxTipNumber = availableTips.length;
  
  for (const num of tipNumbers) {
    if (num < 1 || num > maxTipNumber) {
      errors.push(`Tip ${num} does not exist (available: 1-${maxTipNumber})`);
    }
  }
  
  return { valid: errors.length === 0, errors };
}
```

### Color Validation
```typescript
function validateColor(color: string): boolean {
  // Support hex, rgb, named colors
  const hexPattern = /^#[0-9A-Fa-f]{3,6}$/;
  const rgbPattern = /^rgb\(\d{1,3},\s*\d{1,3},\s*\d{1,3}\)$/;
  const namedColors = ['red', 'blue', 'green', 'black', 'white', /* ... */];
  
  return (
    hexPattern.test(color) ||
    rgbPattern.test(color) ||
    namedColors.includes(color.toLowerCase())
  );
}
```

## Rollback Considerations

All changes are additive and backward compatible:
- New state fields are optional
- Existing API contracts remain unchanged
- New intent patterns don't interfere with existing ones
- UI changes don't affect existing functionality




