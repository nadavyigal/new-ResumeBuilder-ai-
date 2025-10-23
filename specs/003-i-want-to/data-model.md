# Data Model: AI-Powered Resume Design Selection

**Feature**: 003-i-want-to
**Date**: 2025-10-08
**Status**: Phase 1 Complete

This document defines the database schema, entity relationships, and validation rules for the resume design feature.

---

## Entity Relationship Diagram

```
┌─────────────────────┐
│  profiles           │
│  (existing)         │
└──────┬──────────────┘
       │
       │ 1:N
       │
┌──────▼──────────────┐         ┌──────────────────────┐
│  optimizations      │         │  design_templates    │
│  (existing)         │         │  (new)               │
└──────┬──────────────┘         └─────────┬────────────┘
       │                                   │
       │ 1:1                               │ 1:N
       │                                   │
┌──────▼──────────────────────────────────▼────────────┐
│  resume_design_assignments (new)                     │
│  - Unique per optimization (1:1)                     │
│  - References template + current/previous custom     │
└──────┬───────────────────────────────────────────────┘
       │
       │ N:1
       │
┌──────▼──────────────┐
│  design_            │
│  customizations     │
│  (new)              │
└─────────────────────┘

┌─────────────────────┐         ┌──────────────────────┐
│  chat_sessions      │         │  chat_messages       │
│  (existing)         │◄────────┤  (existing)          │
└─────────────────────┘   1:N   │  + design metadata   │
                                 └──────────────────────┘
```

---

## Database Schema (PostgreSQL)

### design_templates

Stores available resume design templates from external library.

```sql
CREATE TABLE design_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  category VARCHAR(50) NOT NULL CHECK (category IN ('modern', 'traditional', 'creative', 'corporate')),
  description TEXT NOT NULL,
  file_path VARCHAR(500) NOT NULL, -- Path to React component in external library
  preview_thumbnail_url TEXT, -- Supabase Storage URL
  is_premium BOOLEAN NOT NULL DEFAULT false,
  ats_compatibility_score INTEGER NOT NULL DEFAULT 100 CHECK (ats_compatibility_score BETWEEN 0 AND 100),
  supported_customizations JSONB NOT NULL DEFAULT '{
    "colors": true,
    "fonts": true,
    "layout": true
  }'::jsonb,
  default_config JSONB NOT NULL DEFAULT '{
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
  }'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_design_templates_category ON design_templates(category);
CREATE INDEX idx_design_templates_slug ON design_templates(slug);
CREATE INDEX idx_design_templates_premium ON design_templates(is_premium);

-- Row Level Security (RLS)
ALTER TABLE design_templates ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read templates (FR-023: available to all tiers)
CREATE POLICY "Templates are viewable by all authenticated users"
  ON design_templates
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only service role can insert/update templates (admin operation)
CREATE POLICY "Templates are manageable by service role only"
  ON design_templates
  FOR ALL
  USING (auth.role() = 'service_role');

-- Trigger to update updated_at
CREATE TRIGGER update_design_templates_updated_at
  BEFORE UPDATE ON design_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**Validation Rules**:
- `name`: Unique, human-readable (e.g., "Minimal Modern")
- `slug`: URL-safe, unique (e.g., "minimal-modern")
- `category`: One of 4 predefined categories
- `file_path`: Must exist in external library (validated by sync script)
- `ats_compatibility_score`: 0-100, templates with <80 should show warning
- `supported_customizations`: JSONB with boolean flags for each customization type
- `default_config`: JSONB with default color scheme, fonts, and spacing

---

### design_customizations

Stores user-specific design modifications to base templates.

```sql
CREATE TABLE design_customizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES design_templates(id) ON DELETE CASCADE,
  color_scheme JSONB NOT NULL DEFAULT '{
    "primary": "#2563eb",
    "secondary": "#64748b",
    "accent": "#0ea5e9"
  }'::jsonb,
  font_family JSONB NOT NULL DEFAULT '{
    "headings": "Arial",
    "body": "Arial"
  }'::jsonb,
  spacing_settings JSONB NOT NULL DEFAULT '{
    "compact": false,
    "lineHeight": 1.5
  }'::jsonb,
  layout_variant VARCHAR(100), -- e.g., "two-column", "sidebar-left", null = default
  custom_css TEXT, -- AI-generated CSS (validated before storage)
  is_ats_safe BOOLEAN NOT NULL DEFAULT true,
  ats_validation_errors JSONB, -- Array of validation error messages if is_ats_safe = false
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_design_customizations_template ON design_customizations(template_id);
CREATE INDEX idx_design_customizations_ats_safe ON design_customizations(is_ats_safe);

-- Row Level Security (RLS)
ALTER TABLE design_customizations ENABLE ROW LEVEL SECURITY;

-- Users can read customizations linked to their resume_design_assignments
CREATE POLICY "Customizations viewable by assignment owner"
  ON design_customizations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM resume_design_assignments rda
      WHERE rda.customization_id = design_customizations.id
        AND rda.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM resume_design_assignments rda
      WHERE rda.previous_customization_id = design_customizations.id
        AND rda.user_id = auth.uid()
    )
  );

-- Users can insert customizations (via design customization flow)
CREATE POLICY "Customizations insertable by authenticated users"
  ON design_customizations
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Users cannot update/delete customizations (immutable after creation)
-- If user makes new changes, a new customization record is created
```

**Validation Rules**:
- `color_scheme`: Must contain `primary`, `secondary`, `accent` hex colors
- `font_family`: Must contain `headings`, `body` font names from ATS-safe list
- `spacing_settings`: `compact` (boolean), `lineHeight` (1.0-2.0)
- `layout_variant`: Optional, template-specific variants
- `custom_css`: Optional, must pass ATS validation before storage
- `is_ats_safe`: Automatically set based on validation results
- `ats_validation_errors`: Array of error messages if validation fails

**ATS Validation**:
```typescript
interface ATSValidationError {
  property: string;
  value: string;
  reason: string;
}

// Example:
{
  "property": "background-image",
  "value": "url(image.jpg)",
  "reason": "Background images break ATS parsing"
}
```

---

### resume_design_assignments

Links optimizations to design templates with customizations. One assignment per optimization (1:1 relationship).

```sql
CREATE TABLE resume_design_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  optimization_id UUID NOT NULL UNIQUE REFERENCES optimizations(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES design_templates(id) ON DELETE RESTRICT,
  customization_id UUID REFERENCES design_customizations(id) ON DELETE SET NULL,
  previous_customization_id UUID REFERENCES design_customizations(id) ON DELETE SET NULL,
  original_template_id UUID NOT NULL REFERENCES design_templates(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  finalized_at TIMESTAMPTZ, -- When user exits design session
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE UNIQUE INDEX idx_resume_design_assignments_optimization ON resume_design_assignments(optimization_id);
CREATE INDEX idx_resume_design_assignments_user ON resume_design_assignments(user_id);
CREATE INDEX idx_resume_design_assignments_template ON resume_design_assignments(template_id);
CREATE INDEX idx_resume_design_assignments_finalized ON resume_design_assignments(finalized_at);

-- Row Level Security (RLS)
ALTER TABLE resume_design_assignments ENABLE ROW LEVEL SECURITY;

-- Users can only view their own assignments
CREATE POLICY "Assignments viewable by owner"
  ON resume_design_assignments
  FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own assignments
CREATE POLICY "Assignments insertable by owner"
  ON resume_design_assignments
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own assignments
CREATE POLICY "Assignments updatable by owner"
  ON resume_design_assignments
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Trigger to update updated_at
CREATE TRIGGER update_resume_design_assignments_updated_at
  BEFORE UPDATE ON resume_design_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**Validation Rules**:
- `optimization_id`: UNIQUE constraint enforces 1:1 relationship (FR-015)
- `template_id`: Current selected template
- `customization_id`: Current active customization (nullable)
- `previous_customization_id`: Single-level undo (nullable)
- `original_template_id`: For revert functionality (FR-018)
- `is_active`: Always true (single version storage, FR-015)
- `finalized_at`: Timestamp when user saves final design (undo no longer available)

**State Transitions**:
1. **Initial**: `template_id = recommended`, `customization_id = null`, `previous_customization_id = null`
2. **After Customization**: `customization_id = new_id`, `previous_customization_id = old_id`
3. **After Undo**: Swap `customization_id ↔ previous_customization_id`
4. **After Revert**: `template_id = original_template_id`, `customization_id = null`, `previous_customization_id = null`

---

### chat_messages Extension (Existing Table)

Design change requests are stored as chat messages with `metadata.type = "design_change"`.

**No new table needed** - extends existing `chat_messages` from Feature 002.

```sql
-- Existing chat_messages schema:
-- CREATE TABLE chat_messages (
--   id UUID PRIMARY KEY,
--   session_id UUID REFERENCES chat_sessions(id),
--   sender ENUM('user', 'assistant'),
--   content TEXT,
--   metadata JSONB,
--   created_at TIMESTAMPTZ
-- );

-- Design-specific metadata structure for chat_messages:
-- {
--   "type": "design_change",
--   "requested_change": "make headers dark blue",
--   "interpreted_params": {
--     "color_scheme": {
--       "primary": "#1e3a8a"
--     }
--   },
--   "applied_customization_id": "uuid",
--   "validation_status": "valid" | "ats_violation" | "unclear",
--   "validation_errors": [...]
-- }
```

**Query Pattern**:
```sql
-- Get design change history for a session
SELECT * FROM chat_messages
WHERE session_id = $1
  AND metadata->>'type' = 'design_change'
ORDER BY created_at DESC;
```

---

## Data Relationships

### 1. Profile → Optimizations → Design Assignment (1:N:1)
```
profiles.user_id
  ├── optimizations.id (many)
  │     └── resume_design_assignments.optimization_id (one)
```

**Enforcement**: UNIQUE constraint on `resume_design_assignments.optimization_id`

### 2. Design Template → Design Assignment (1:N)
```
design_templates.id
  └── resume_design_assignments.template_id (many)
```

**Enforcement**: Foreign key with RESTRICT (cannot delete template if assignments exist)

### 3. Design Template → Customizations (1:N)
```
design_templates.id
  └── design_customizations.template_id (many)
```

**Enforcement**: Foreign key with CASCADE (deleting template deletes its customizations)

### 4. Design Assignment → Customizations (N:1)
```
resume_design_assignments
  ├── .customization_id → design_customizations.id
  └── .previous_customization_id → design_customizations.id
```

**Enforcement**: Foreign keys with SET NULL (deleting customization nullifies reference)

### 5. Chat Session → Design Change Messages (1:N)
```
chat_sessions.id
  └── chat_messages.session_id (many)
        WHERE metadata->>'type' = 'design_change'
```

**Enforcement**: Existing chat infrastructure (Feature 002)

---

## Seed Data (Initial Templates)

```sql
-- Insert 4 initial templates from resume-style-bank
INSERT INTO design_templates (name, slug, category, description, file_path, ats_compatibility_score, default_config) VALUES
(
  'Minimal Modern',
  'minimal-ssr',
  'traditional',
  'Clean, text-focused layout. Best for conservative industries like finance, law, and government.',
  'minimal-ssr/Resume.jsx',
  100,
  '{
    "color_scheme": {"primary": "#111827", "secondary": "#6b7280", "accent": "#3b82f6"},
    "font_family": {"headings": "Arial", "body": "Arial"},
    "spacing_settings": {"compact": false, "lineHeight": 1.5}
  }'::jsonb
),
(
  'Card Layout',
  'card-ssr',
  'modern',
  'Modern card-based sections. Best for tech, creative, and visual-heavy roles.',
  'card-ssr/Resume.jsx',
  95,
  '{
    "color_scheme": {"primary": "#2563eb", "secondary": "#64748b", "accent": "#0ea5e9"},
    "font_family": {"headings": "Arial", "body": "Arial"},
    "spacing_settings": {"compact": false, "lineHeight": 1.5}
  }'::jsonb
),
(
  'Sidebar Professional',
  'sidebar-ssr',
  'corporate',
  'Sidebar for contact and skills. Best for experienced professionals with dense content.',
  'sidebar-ssr/Resume.jsx',
  90,
  '{
    "color_scheme": {"primary": "#1e40af", "secondary": "#475569", "accent": "#06b6d4"},
    "font_family": {"headings": "Arial", "body": "Arial"},
    "spacing_settings": {"compact": true, "lineHeight": 1.4}
  }'::jsonb
),
(
  'Timeline',
  'timeline-ssr',
  'creative',
  'Chronological timeline emphasis. Best for career progressors, educators, and consultants.',
  'timeline-ssr/Resume.jsx',
  85,
  '{
    "color_scheme": {"primary": "#7c3aed", "secondary": "#64748b", "accent": "#a78bfa"},
    "font_family": {"headings": "Arial", "body": "Arial"},
    "spacing_settings": {"compact": false, "lineHeight": 1.6}
  }'::jsonb
);
```

---

## TypeScript Interfaces

### DesignTemplate
```typescript
export interface DesignTemplate {
  id: string;
  name: string;
  slug: string;
  category: 'modern' | 'traditional' | 'creative' | 'corporate';
  description: string;
  file_path: string;
  preview_thumbnail_url?: string;
  is_premium: boolean;
  ats_compatibility_score: number;
  supported_customizations: {
    colors: boolean;
    fonts: boolean;
    layout: boolean;
  };
  default_config: DesignConfig;
  created_at: string;
  updated_at: string;
}
```

### DesignConfig
```typescript
export interface DesignConfig {
  color_scheme: {
    primary: string; // Hex color
    secondary: string;
    accent: string;
  };
  font_family: {
    headings: string; // Font name
    body: string;
  };
  spacing_settings: {
    compact: boolean;
    lineHeight: number; // 1.0 - 2.0
  };
  layout_variant?: string;
}
```

### DesignCustomization
```typescript
export interface DesignCustomization {
  id: string;
  template_id: string;
  color_scheme: DesignConfig['color_scheme'];
  font_family: DesignConfig['font_family'];
  spacing_settings: DesignConfig['spacing_settings'];
  layout_variant?: string;
  custom_css?: string;
  is_ats_safe: boolean;
  ats_validation_errors?: ATSValidationError[];
  created_at: string;
}

export interface ATSValidationError {
  property: string;
  value: string;
  reason: string;
}
```

### ResumeDesignAssignment
```typescript
export interface ResumeDesignAssignment {
  id: string;
  user_id: string;
  optimization_id: string;
  template_id: string;
  customization_id?: string;
  previous_customization_id?: string;
  original_template_id: string;
  is_active: boolean;
  finalized_at?: string;
  created_at: string;
  updated_at: string;
}
```

### DesignChangeMetadata (chat_messages.metadata)
```typescript
export interface DesignChangeMetadata {
  type: 'design_change';
  requested_change: string;
  interpreted_params: Partial<DesignConfig>;
  applied_customization_id?: string;
  validation_status: 'valid' | 'ats_violation' | 'unclear';
  validation_errors?: ATSValidationError[];
}
```

---

## Database Functions

### Function: assign_recommended_template()
```sql
CREATE OR REPLACE FUNCTION assign_recommended_template(
  p_user_id UUID,
  p_optimization_id UUID,
  p_template_id UUID
) RETURNS resume_design_assignments
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_assignment resume_design_assignments;
BEGIN
  -- Validate template exists
  IF NOT EXISTS (SELECT 1 FROM design_templates WHERE id = p_template_id) THEN
    RAISE EXCEPTION 'Template not found: %', p_template_id;
  END IF;

  -- Insert assignment
  INSERT INTO resume_design_assignments (
    user_id,
    optimization_id,
    template_id,
    original_template_id
  ) VALUES (
    p_user_id,
    p_optimization_id,
    p_template_id,
    p_template_id -- Original = initial recommended
  )
  RETURNING * INTO v_assignment;

  RETURN v_assignment;
END;
$$;
```

### Function: apply_design_customization()
```sql
CREATE OR REPLACE FUNCTION apply_design_customization(
  p_assignment_id UUID,
  p_new_customization_id UUID
) RETURNS resume_design_assignments
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_assignment resume_design_assignments;
  v_current_customization_id UUID;
BEGIN
  -- Get current assignment
  SELECT * INTO v_assignment FROM resume_design_assignments WHERE id = p_assignment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assignment not found: %', p_assignment_id;
  END IF;

  -- Store current customization as previous (for undo)
  v_current_customization_id := v_assignment.customization_id;

  -- Update assignment
  UPDATE resume_design_assignments
  SET
    customization_id = p_new_customization_id,
    previous_customization_id = v_current_customization_id,
    updated_at = NOW()
  WHERE id = p_assignment_id
  RETURNING * INTO v_assignment;

  RETURN v_assignment;
END;
$$;
```

### Function: undo_design_change()
```sql
CREATE OR REPLACE FUNCTION undo_design_change(
  p_assignment_id UUID
) RETURNS resume_design_assignments
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_assignment resume_design_assignments;
  v_temp_id UUID;
BEGIN
  -- Get current assignment
  SELECT * INTO v_assignment FROM resume_design_assignments WHERE id = p_assignment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assignment not found: %', p_assignment_id;
  END IF;

  -- Swap current and previous customizations
  v_temp_id := v_assignment.customization_id;

  UPDATE resume_design_assignments
  SET
    customization_id = previous_customization_id,
    previous_customization_id = v_temp_id,
    updated_at = NOW()
  WHERE id = p_assignment_id
  RETURNING * INTO v_assignment;

  RETURN v_assignment;
END;
$$;
```

---

## Migration Script

**File**: `supabase/migrations/20251008_add_design_tables.sql`

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create design_templates table
CREATE TABLE design_templates (
  -- Schema defined above
);

-- Create design_customizations table
CREATE TABLE design_customizations (
  -- Schema defined above
);

-- Create resume_design_assignments table
CREATE TABLE resume_design_assignments (
  -- Schema defined above
);

-- Create indexes
-- (All indexes defined above)

-- Enable RLS and create policies
-- (All RLS policies defined above)

-- Create functions
-- (All functions defined above)

-- Seed initial templates
-- (Seed data defined above)

-- Grant permissions
GRANT SELECT ON design_templates TO authenticated;
GRANT ALL ON design_customizations TO authenticated;
GRANT ALL ON resume_design_assignments TO authenticated;
```

---

## Data Access Patterns

### Pattern 1: Get Available Templates for User
```typescript
// All users see all templates (FR-023)
const { data: templates } = await supabase
  .from('design_templates')
  .select('*')
  .order('category', 'name');
```

### Pattern 2: Get Current Design for Optimization
```typescript
const { data: assignment } = await supabase
  .from('resume_design_assignments')
  .select(`
    *,
    template:design_templates(*),
    customization:design_customizations(*),
    original_template:design_templates!original_template_id(*)
  `)
  .eq('optimization_id', optimizationId)
  .single();
```

### Pattern 3: Apply Design Customization
```typescript
// 1. Create new customization
const { data: customization } = await supabase
  .from('design_customizations')
  .insert({
    template_id: assignmentData.template_id,
    color_scheme: newColors,
    font_family: newFonts,
    spacing_settings: newSpacing,
    is_ats_safe: validationResult.isValid
  })
  .select()
  .single();

// 2. Apply to assignment (stores previous for undo)
const { data: updated } = await supabase
  .rpc('apply_design_customization', {
    p_assignment_id: assignmentId,
    p_new_customization_id: customization.id
  });
```

### Pattern 4: Undo Last Change
```typescript
const { data: reverted } = await supabase
  .rpc('undo_design_change', {
    p_assignment_id: assignmentId
  });
```

### Pattern 5: Revert to Original Template
```typescript
const { data: reset } = await supabase
  .from('resume_design_assignments')
  .update({
    template_id: assignment.original_template_id,
    customization_id: null,
    previous_customization_id: null
  })
  .eq('id', assignmentId)
  .select()
  .single();
```

---

## Performance Considerations

1. **Indexes**: All foreign keys indexed for fast joins
2. **RLS Optimization**: User-scoped policies use `auth.uid()` for efficient filtering
3. **Customization Immutability**: New records created instead of updates (preserves undo state)
4. **Finalization**: `finalized_at` timestamp allows cleanup of old, unused customizations
5. **Caching Strategy**: Templates rarely change → cache aggressively (1 hour TTL)

---

**Status**: Phase 1 Data Model COMPLETE ✅
**Next**: Generate API contracts (OpenAPI specs)
