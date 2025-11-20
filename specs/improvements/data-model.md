# Data Model: Enhanced AI Assistant

**Feature**: 008-enhance-ai-assistent
**Date**: 2025-01-18
**Version**: 1.0

## Overview

This document defines the data models and database schema for the enhanced AI assistant feature. The models support thread management, content modification tracking, and style customization persistence.

## Database Schema

### New Tables

#### 1. `ai_threads` (Optional - Only if implementing OpenAI Assistants API)

Tracks OpenAI Assistant thread IDs for maintaining conversation context.

```sql
CREATE TABLE IF NOT EXISTS ai_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  optimization_id UUID NOT NULL REFERENCES optimizations(id) ON DELETE CASCADE,
  session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
  openai_thread_id VARCHAR(255) NOT NULL UNIQUE,
  openai_assistant_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'error')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  archived_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT unique_active_thread_per_optimization
    UNIQUE (optimization_id, status)
    WHERE status = 'active'
);

-- Indexes
CREATE INDEX idx_ai_threads_user_id ON ai_threads(user_id);
CREATE INDEX idx_ai_threads_optimization_id ON ai_threads(optimization_id);
CREATE INDEX idx_ai_threads_session_id ON ai_threads(session_id);
CREATE INDEX idx_ai_threads_openai_thread_id ON ai_threads(openai_thread_id);
CREATE INDEX idx_ai_threads_status ON ai_threads(status);

-- Row Level Security
ALTER TABLE ai_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own threads"
  ON ai_threads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own threads"
  ON ai_threads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own threads"
  ON ai_threads FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own threads"
  ON ai_threads FOR DELETE
  USING (auth.uid() = user_id);
```

#### 2. `content_modifications`

Tracks all AI-driven resume content changes for audit trail and undo/redo functionality.

```sql
CREATE TABLE IF NOT EXISTS content_modifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  optimization_id UUID NOT NULL REFERENCES optimizations(id) ON DELETE CASCADE,
  session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
  message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,

  -- Modification details
  operation VARCHAR(50) NOT NULL CHECK (operation IN ('replace', 'prefix', 'suffix', 'append', 'insert', 'remove')),
  field_path VARCHAR(500) NOT NULL, -- JSON path: "experiences[0].title"
  old_value TEXT,
  new_value TEXT,

  -- Context
  reason TEXT, -- User request or tip implementation
  intent VARCHAR(100), -- tip_implementation, content_edit, etc.

  -- ATS Impact
  ats_score_before DECIMAL(5,2),
  ats_score_after DECIMAL(5,2),
  score_change DECIMAL(5,2) GENERATED ALWAYS AS (ats_score_after - ats_score_before) STORED,

  -- Metadata
  applied_by VARCHAR(50) DEFAULT 'ai_assistant' CHECK (applied_by IN ('ai_assistant', 'user', 'system')),
  is_reverted BOOLEAN DEFAULT FALSE,
  reverted_at TIMESTAMP WITH TIME ZONE,
  reverted_by_modification_id UUID REFERENCES content_modifications(id),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT valid_score_range CHECK (
    (ats_score_before IS NULL OR (ats_score_before >= 0 AND ats_score_before <= 100)) AND
    (ats_score_after IS NULL OR (ats_score_after >= 0 AND ats_score_after <= 100))
  )
);

-- Indexes
CREATE INDEX idx_content_mods_user_id ON content_modifications(user_id);
CREATE INDEX idx_content_mods_optimization_id ON content_modifications(optimization_id);
CREATE INDEX idx_content_mods_session_id ON content_modifications(session_id);
CREATE INDEX idx_content_mods_field_path ON content_modifications(field_path);
CREATE INDEX idx_content_mods_created_at ON content_modifications(created_at DESC);
CREATE INDEX idx_content_mods_is_reverted ON content_modifications(is_reverted) WHERE is_reverted = FALSE;

-- Row Level Security
ALTER TABLE content_modifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own modifications"
  ON content_modifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own modifications"
  ON content_modifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own modifications"
  ON content_modifications FOR UPDATE
  USING (auth.uid() = user_id);
```

#### 3. `style_customization_history`

Tracks visual customization changes for versioning and rollback.

```sql
CREATE TABLE IF NOT EXISTS style_customization_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  optimization_id UUID NOT NULL REFERENCES optimizations(id) ON DELETE CASCADE,
  session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
  message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,

  -- Style changes
  customization_type VARCHAR(50) NOT NULL CHECK (customization_type IN ('color', 'font', 'spacing', 'layout', 'mixed')),
  changes JSONB NOT NULL, -- { "background": "#001f3f", "font": "Arial", ... }

  -- Previous state
  previous_customization JSONB,

  -- Context
  request_text TEXT, -- User's natural language request
  applied_by VARCHAR(50) DEFAULT 'ai_assistant',

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_style_history_user_id ON style_customization_history(user_id);
CREATE INDEX idx_style_history_optimization_id ON style_customization_history(optimization_id);
CREATE INDEX idx_style_history_created_at ON style_customization_history(created_at DESC);
CREATE INDEX idx_style_history_type ON style_customization_history(customization_type);

-- Row Level Security
ALTER TABLE style_customization_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own style history"
  ON style_customization_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own style history"
  ON style_customization_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

### Modified Tables

#### 1. `chat_sessions` (Add thread ID reference)

```sql
-- Add column for OpenAI thread ID (if using Assistants API)
ALTER TABLE chat_sessions
  ADD COLUMN IF NOT EXISTS openai_thread_id VARCHAR(255) UNIQUE;

CREATE INDEX IF NOT EXISTS idx_chat_sessions_openai_thread_id
  ON chat_sessions(openai_thread_id);
```

#### 2. `chat_messages` (Enhance metadata)

```sql
-- metadata JSONB column already exists, but we'll use enhanced structure:
-- {
--   "intent": "tip_implementation",
--   "operation": "field_update",
--   "field_path": "experiences[0].title",
--   "modification_id": "uuid",
--   "style_change_id": "uuid",
--   "error": null
-- }
```

#### 3. `optimizations` (Add modification counter)

```sql
-- Add counter for tracking number of AI modifications
ALTER TABLE optimizations
  ADD COLUMN IF NOT EXISTS ai_modification_count INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_optimizations_modification_count
  ON optimizations(ai_modification_count);
```

## TypeScript Interfaces

### Core Types

```typescript
/**
 * OpenAI Assistant Thread tracking
 */
export interface AIThread {
  id: string;
  user_id: string;
  optimization_id: string;
  session_id: string | null;
  openai_thread_id: string;
  openai_assistant_id: string | null;
  status: 'active' | 'archived' | 'error';
  metadata: Record<string, any>;
  created_at: string;
  last_message_at: string;
  archived_at: string | null;
}

/**
 * Content modification operation types
 */
export type ModificationOperation =
  | 'replace'   // Completely replace field value
  | 'prefix'    // Add text before existing value
  | 'suffix'    // Add text after existing value
  | 'append'    // Add item to array
  | 'insert'    // Insert item at specific array index
  | 'remove';   // Remove field or array item

/**
 * Content modification record
 */
export interface ContentModification {
  id: string;
  user_id: string;
  optimization_id: string;
  session_id: string | null;
  message_id: string | null;

  operation: ModificationOperation;
  field_path: string; // JSON path: "experiences[0].title"
  old_value: string | null;
  new_value: string | null;

  reason: string | null;
  intent: string | null;

  ats_score_before: number | null;
  ats_score_after: number | null;
  score_change: number | null; // Computed

  applied_by: 'ai_assistant' | 'user' | 'system';
  is_reverted: boolean;
  reverted_at: string | null;
  reverted_by_modification_id: string | null;

  created_at: string;
}

/**
 * Style customization change tracking
 */
export interface StyleCustomizationHistory {
  id: string;
  user_id: string;
  optimization_id: string;
  session_id: string | null;
  message_id: string | null;

  customization_type: 'color' | 'font' | 'spacing' | 'layout' | 'mixed';
  changes: {
    background?: string;
    primary?: string;
    accent?: string;
    text?: string;
    font_family?: {
      heading?: string;
      body?: string;
    };
    spacing?: Record<string, string>;
    layout?: string;
  };

  previous_customization: Record<string, any> | null;
  request_text: string | null;
  applied_by: string;

  created_at: string;
}

/**
 * Resume field path components
 */
export interface FieldPath {
  root: string; // 'experiences', 'skills', 'summary', etc.
  indices: number[]; // Array indices if applicable
  property: string | null; // 'title', 'company', etc.
  fullPath: string; // 'experiences[0].title'
}

/**
 * Modification request (before applying)
 */
export interface ModificationRequest {
  operation: ModificationOperation;
  targetPath: string;
  value: any;
  context: string; // User's original message
  reason?: string;
  intent?: string;
}

/**
 * Modification result (after applying)
 */
export interface ModificationResult {
  success: boolean;
  modification: ContentModification | null;
  updatedResume: OptimizedResume;
  atsScoreChange: number | null;
  error: string | null;
}
```

### Request/Response Types

```typescript
/**
 * Request to apply content modification
 */
export interface ApplyModificationRequest {
  optimization_id: string;
  session_id?: string;
  modifications: ModificationRequest[];
  auto_rescore?: boolean; // Default true
}

/**
 * Response from applying modifications
 */
export interface ApplyModificationResponse {
  success: boolean;
  modifications_applied: ContentModification[];
  updated_resume: OptimizedResume;
  ats_score_before: number;
  ats_score_after: number;
  score_change: number;
  errors: string[];
}

/**
 * Request to apply style customization
 */
export interface ApplyStyleRequest {
  optimization_id: string;
  session_id?: string;
  customization_changes: {
    background_color?: string;
    primary_color?: string;
    accent_color?: string;
    text_color?: string;
    font_family?: string;
    font_size?: string;
  };
  request_text?: string; // Original user message
}

/**
 * Response from applying style
 */
export interface ApplyStyleResponse {
  success: boolean;
  customization_id: string;
  history_record_id: string;
  applied_changes: Record<string, any>;
  preview_url?: string;
  error: string | null;
}

/**
 * Thread management
 */
export interface CreateThreadRequest {
  optimization_id: string;
  session_id?: string;
  assistant_id?: string;
}

export interface CreateThreadResponse {
  success: boolean;
  thread_id: string; // Our database ID
  openai_thread_id: string; // OpenAI's thread ID
  session_id: string;
  error: string | null;
}

export interface GetThreadRequest {
  optimization_id: string;
  session_id?: string;
}

export interface GetThreadResponse {
  success: boolean;
  thread: AIThread | null;
  error: string | null;
}
```

## Data Validation Rules

### Content Modifications

1. **Field Path Validation**
   - Must match existing resume schema structure
   - Array indices must be within bounds
   - Property names must exist in schema

2. **Value Type Validation**
   - String fields accept only strings
   - Array operations must specify valid array items
   - Dates must be valid ISO format or "Present"

3. **ATS Score Validation**
   - Scores must be between 0 and 100
   - Score changes should be within reasonable range (-20 to +20 per modification)

### Style Customizations

1. **Color Validation**
   - Hex colors: `/^#[0-9A-Fa-f]{6}$/`
   - RGB: `/^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/`
   - Named colors: Must exist in color map

2. **Font Validation**
   - Must be in supported fonts list
   - Font size must be between 8pt and 24pt

3. **Accessibility Validation**
   - Background/text contrast ratio ≥ 4.5:1 (WCAG AA)
   - Font size ≥ 10pt for body text

## Migration Scripts

### Migration 1: Create New Tables

```sql
-- File: supabase/migrations/20250118000001_create_ai_threads.sql

BEGIN;

-- Create ai_threads table
CREATE TABLE IF NOT EXISTS ai_threads (
  -- (full schema from above)
);

-- Create indexes
-- (indexes from above)

-- Enable RLS and create policies
-- (policies from above)

COMMIT;
```

### Migration 2: Create Content Modifications Table

```sql
-- File: supabase/migrations/20250118000002_create_content_modifications.sql

BEGIN;

-- Create content_modifications table
-- (full schema from above)

COMMIT;
```

### Migration 3: Create Style History Table

```sql
-- File: supabase/migrations/20250118000003_create_style_history.sql

BEGIN;

-- Create style_customization_history table
-- (full schema from above)

COMMIT;
```

### Migration 4: Alter Existing Tables

```sql
-- File: supabase/migrations/20250118000004_alter_existing_tables.sql

BEGIN;

-- Add openai_thread_id to chat_sessions
ALTER TABLE chat_sessions
  ADD COLUMN IF NOT EXISTS openai_thread_id VARCHAR(255) UNIQUE;

CREATE INDEX IF NOT EXISTS idx_chat_sessions_openai_thread_id
  ON chat_sessions(openai_thread_id);

-- Add modification counter to optimizations
ALTER TABLE optimizations
  ADD COLUMN IF NOT EXISTS ai_modification_count INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_optimizations_modification_count
  ON optimizations(ai_modification_count);

COMMIT;
```

## Data Flow Diagrams

### Flow 1: Content Modification

```
User Message
    ↓
Intent Detection
    ↓
Parse Field Path & Operation
    ↓
Validate Against Schema
    ↓
Apply Modification to Resume JSON
    ↓
Insert content_modifications record
    ↓
Trigger ATS Rescoring
    ↓
Update optimizations.rewrite_data
    ↓
Update optimizations.ats_score_optimized
    ↓
Increment optimizations.ai_modification_count
    ↓
Return Updated Resume + Score
```

### Flow 2: Style Customization

```
User Message ("change background to navy")
    ↓
Parse Color Request
    ↓
Validate Color Value
    ↓
Get Current Design Assignment
    ↓
Merge with Existing Customization
    ↓
Insert style_customization_history record
    ↓
Upsert design_customizations
    ↓
Update design_assignments.customization_id
    ↓
Trigger Preview Regeneration
    ↓
Return Preview URL
```

### Flow 3: Thread Management

```
First Chat Message
    ↓
Check for Existing Thread (optimization_id)
    ↓
If Not Found: Create OpenAI Thread
    ↓
Insert ai_threads record
    ↓
Link to chat_session
    ↓
Store thread_id in session metadata
    ↓
Use thread_id for subsequent messages
    ↓
Update last_message_at on each message
```

## Indexes Strategy

### Query Patterns

1. **Get modifications for optimization**: Index on `optimization_id`
2. **Get user's modification history**: Index on `user_id`, `created_at DESC`
3. **Find active thread for optimization**: Index on `optimization_id`, `status`
4. **Audit trail for specific field**: Index on `field_path`
5. **Recent style changes**: Index on `created_at DESC`, `customization_type`

### Composite Indexes

```sql
-- Most common query: recent modifications for user's optimization
CREATE INDEX idx_content_mods_user_opt_date
  ON content_modifications(user_id, optimization_id, created_at DESC);

-- Active modifications (not reverted) for optimization
CREATE INDEX idx_content_mods_active_opt
  ON content_modifications(optimization_id, created_at DESC)
  WHERE is_reverted = FALSE;

-- Thread lookup by optimization and status
CREATE INDEX idx_ai_threads_opt_status
  ON ai_threads(optimization_id, status)
  WHERE status = 'active';
```

## Sample Data

### Content Modification Example

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "123e4567-e89b-12d3-a456-426614174000",
  "optimization_id": "789e4567-e89b-12d3-a456-426614174000",
  "session_id": "456e8400-e29b-41d4-a716-446655440000",
  "message_id": "321e8400-e29b-41d4-a716-446655440000",
  "operation": "prefix",
  "field_path": "experiences[0].title",
  "old_value": "Software Engineer",
  "new_value": "Senior Software Engineer",
  "reason": "User requested to add 'Senior' to latest job title",
  "intent": "tip_implementation",
  "ats_score_before": 72.5,
  "ats_score_after": 78.3,
  "score_change": 5.8,
  "applied_by": "ai_assistant",
  "is_reverted": false,
  "reverted_at": null,
  "reverted_by_modification_id": null,
  "created_at": "2025-01-18T10:30:00Z"
}
```

### Style Customization Example

```json
{
  "id": "660e8400-e29b-41d4-a716-446655440000",
  "user_id": "123e4567-e89b-12d3-a456-426614174000",
  "optimization_id": "789e4567-e89b-12d3-a456-426614174000",
  "session_id": "456e8400-e29b-41d4-a716-446655440000",
  "message_id": "321e8400-e29b-41d4-a716-446655440000",
  "customization_type": "color",
  "changes": {
    "background": "#001f3f",
    "primary": "#0074d9",
    "text": "#ffffff"
  },
  "previous_customization": {
    "background": "#ffffff",
    "primary": "#2563eb",
    "text": "#1e293b"
  },
  "request_text": "change background to navy blue and use white text",
  "applied_by": "ai_assistant",
  "created_at": "2025-01-18T10:35:00Z"
}
```

---

**Data Model Version**: 1.0
**Status**: ✅ Ready for Implementation
**Next Step**: API Contracts Definition
