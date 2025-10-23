# Data Model: AI Resume Assistant

**Feature**: 006-ai-resume-assistant
**Created**: 2025-10-15
**Status**: Reference (Existing Schema)

## Overview

**Important Note**: This feature leverages **existing database schema** from Features 002 (Chat), 003 (Design), and 005 (History). No new tables are required. This document serves as a reference for the entities involved in the AI Resume Assistant feature.

---

## Entity Relationship Diagram

```
┌─────────────┐
│   profiles  │
│             │
│ - id (PK)   │
│ - email     │
│ - plan_type │
└──────┬──────┘
       │
       │ (1:N)
       │
┌──────▼───────────┐
│  optimizations   │
│                  │
│ - id (PK)        │
│ - user_id (FK)   │
│ - jd_id (FK)     │
│ - match_score    │
│ - content (JSONB)│
└──────┬───────────┘
       │
       ├──────────────────────┐
       │                      │
       │ (1:N)                │ (1:1)
       │                      │
┌──────▼──────────┐    ┌─────▼──────────────────┐
│ chat_sessions   │    │resume_design_assignments│
│                 │    │                         │
│ - id (PK)       │    │- optimization_id (PK/FK)│
│ - user_id (FK)  │    │- template_key (FK)      │
│ - optimization  │    │- customization_id (FK)  │
│   _id (FK)      │    └───────┬─────────────────┘
│ - status        │            │
│ - context       │            │ (N:1)
└──────┬──────────┘            │
       │                  ┌────▼──────────────────┐
       │ (1:N)            │design_customizations  │
       │                  │                       │
┌──────▼─────────┐        │- id (PK)              │
│ chat_messages  │        │- user_id (FK)         │
│                │        │- template_key (FK)    │
│ - id (PK)      │        │- colors (JSONB)       │
│ - session_id   │        │- fonts (JSONB)        │
│   (FK)         │        │- layout (JSONB)       │
│ - sender       │        └───────────────────────┘
│ - content      │
│ - metadata     │               ┌──────────────────┐
└──────┬─────────┘               │design_templates  │
       │                         │                  │
       │ (1:N)                   │- id (PK)         │
       │                         │- name            │
┌──────▼───────────┐             │- category        │
│amendment_requests│             │- thumbnail_url   │
│                  │             │- config (JSONB)  │
│ - id (PK)        │             └──────────────────┘
│ - session_id (FK)│
│ - message_id (FK)│
│ - type           │
│ - status         │
└──────────────────┘

       │
       │ (1:N)
       │
┌──────▼──────────┐
│resume_versions  │
│                 │
│ - id (PK)       │
│ - optimization  │
│   _id (FK)      │
│ - session_id    │
│   (FK)          │
│ - version_number│
│ - content       │
│   (JSONB)       │
└─────────────────┘

       │
       │ (1:N)
       │
┌──────▼─────────┐
│ applications   │
│                │
│ - id (PK)      │
│ - user_id (FK) │
│ - optimization │
│   _id (FK)     │
│ - status       │
│ - applied_date │
│ - job_title    │
│ - company      │
│ - job_url      │
└────────────────┘
```

---

## Entities

### 1. profiles (Existing)

**Purpose**: User accounts with plan type and usage limits

**Source**: Core schema (pre-existing)

**Schema**:
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  plan_type TEXT NOT NULL DEFAULT 'free', -- 'free', 'premium'
  optimization_count INTEGER NOT NULL DEFAULT 0,
  max_optimizations INTEGER NOT NULL DEFAULT 1, -- 1 for free, -1 for premium (unlimited)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Relationships**:
- Has many `optimizations`
- Has many `chat_sessions`
- Has many `design_customizations`
- Has many `applications`

**RLS**: Users can only access their own profile

**Usage in Feature 006**: User authentication and plan limits

---

### 2. optimizations (Existing)

**Purpose**: Resume optimization results linking resumes and job descriptions

**Source**: Core schema (pre-existing)

**Schema**:
```sql
CREATE TABLE optimizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  resume_id UUID REFERENCES resumes(id),
  jd_id UUID REFERENCES job_descriptions(id),
  optimized_data JSONB NOT NULL,
  match_score NUMERIC(3,2), -- 0.00 to 1.00 (e.g., 0.87 = 87%)
  status TEXT NOT NULL DEFAULT 'completed',
  template_key TEXT DEFAULT 'minimal',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Relationships**:
- Belongs to `profiles` (user_id)
- Belongs to `resumes` (resume_id)
- Belongs to `job_descriptions` (jd_id)
- Has many `chat_sessions`
- Has many `resume_versions`
- Has one `resume_design_assignments`
- Has many `applications`

**RLS**: Users can only access their own optimizations

**Usage in Feature 006**: Central entity that connects chat sessions, design customizations, and applications

---

### 3. chat_sessions (Existing - Feature 002)

**Purpose**: Interactive conversation sessions for resume refinement

**Source**: `supabase/migrations/20251006104316_chat_schema.sql`

**Schema**:
```sql
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  optimization_id UUID NOT NULL REFERENCES optimizations(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK(status IN ('active', 'closed')) DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  context JSONB -- Optional: stores conversation context (job requirements, user preferences)
);

CREATE UNIQUE INDEX idx_active_session ON chat_sessions(user_id, optimization_id) WHERE status = 'active';
CREATE INDEX idx_user_sessions ON chat_sessions(user_id, last_activity_at DESC);
```

**Relationships**:
- Belongs to `profiles` (user_id)
- Belongs to `optimizations` (optimization_id)
- Has many `chat_messages`
- Has many `amendment_requests`
- Has many `resume_versions`

**RLS**: Users can only access their own sessions

**Business Rules**:
- Only ONE active session per (user_id, optimization_id) - enforced by unique index
- Sessions auto-close after 30 days of inactivity (cleanup job)
- Context stores job requirements for better AI responses

**Usage in Feature 006 (US1)**: Stores AI assistant conversation state for content editing

---

### 4. chat_messages (Existing - Feature 002)

**Purpose**: Individual messages within a chat session

**Source**: `supabase/migrations/20251006104316_chat_schema.sql`

**Schema**:
```sql
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK(sender IN ('user', 'ai')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB -- Optional: { amendment_type, section_affected, ai_model_version, processing_time_ms }
);

CREATE INDEX idx_session_messages ON chat_messages(session_id, created_at ASC);
```

**Relationships**:
- Belongs to `chat_sessions` (session_id)
- Has many `amendment_requests` (when sender = 'user')

**RLS**: Users can only access messages from their own sessions

**Business Rules**:
- Messages are immutable (no updates/deletes except cascade from session)
- Sender can only be 'user' or 'ai'
- Metadata tracks AI processing details for debugging

**Usage in Feature 006 (US1)**: Stores conversation history for context and display

---

### 5. amendment_requests (Existing - Feature 002)

**Purpose**: Structured amendment requests extracted from user messages

**Source**: `supabase/migrations/20251006104316_chat_schema.sql`

**Schema**:
```sql
CREATE TABLE amendment_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('add', 'modify', 'remove', 'clarify')),
  target_section TEXT, -- e.g., 'experience[0].bullets[2]', 'education', 'skills'
  status TEXT NOT NULL CHECK(status IN ('pending', 'applied', 'rejected', 'needs_clarification')) DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  rejection_reason TEXT
);

CREATE INDEX idx_session_requests ON amendment_requests(session_id, created_at DESC);
CREATE INDEX idx_pending_requests ON amendment_requests(status, created_at ASC) WHERE status = 'pending';
```

**Relationships**:
- Belongs to `chat_sessions` (session_id)
- Belongs to `chat_messages` (message_id)

**RLS**: Users can only access amendment requests from their own sessions

**Business Rules**:
- Type determines how AI processes the request:
  - `add`: Add new content (bullets, skills, etc.)
  - `modify`: Rewrite existing content
  - `remove`: Delete content
  - `clarify`: Request more information from user
- Status workflow: `pending` → `applied` OR `rejected` OR `needs_clarification`
- Rejection reason required when status = 'rejected'

**Usage in Feature 006 (US1)**: Tracks user's content modification requests for approval/preview

---

### 6. resume_versions (Existing - Feature 002)

**Purpose**: Snapshot of resume content at specific points in time

**Source**: `supabase/migrations/20251006104316_chat_schema.sql`

**Schema**:
```sql
CREATE TABLE resume_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  optimization_id UUID NOT NULL REFERENCES optimizations(id) ON DELETE CASCADE,
  session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
  version_number INTEGER NOT NULL,
  content JSONB NOT NULL, -- Full resume data structure
  change_summary TEXT, -- Human-readable description of changes
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_version_number ON resume_versions(optimization_id, version_number);
CREATE INDEX idx_session_versions ON resume_versions(session_id, created_at DESC);
```

**Relationships**:
- Belongs to `optimizations` (optimization_id)
- Optionally belongs to `chat_sessions` (session_id) - null if created outside chat

**RLS**: Users can only access versions from their own optimizations

**Business Rules**:
- Version numbers are sequential per optimization (1, 2, 3, ...)
- Version 1 = original optimized resume (before any chat amendments)
- Each applied amendment creates a new version
- Content is immutable (no updates after creation)
- Supports undo/redo by loading previous versions

**Usage in Feature 006 (US1)**: Enables version control and undo functionality for content changes

---

### 7. design_templates (Existing - Feature 003)

**Purpose**: Catalog of available resume design templates

**Source**: `supabase/migrations/20251008_add_design_tables.sql`

**Schema**:
```sql
CREATE TABLE design_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE, -- 'minimal', 'card', 'timeline', 'sidebar'
  display_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- 'professional', 'creative', 'modern'
  thumbnail_url TEXT, -- Preview image URL
  config JSONB NOT NULL, -- Default colors, fonts, layout settings
  is_premium BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_templates_category ON design_templates(category) WHERE is_active = true;
```

**Relationships**:
- Has many `resume_design_assignments`
- Has many `design_customizations`

**RLS**: Public read access (no authentication required to browse templates)

**Business Rules**:
- Template `name` is unique and used as key in code
- Premium templates only visible to premium users
- Inactive templates hidden from UI but preserved for existing assignments
- Config JSONB structure:
  ```json
  {
    "colors": { "primary": "#1e40af", "secondary": "#64748b", "accent": "#3b82f6" },
    "fonts": { "heading": "Inter", "body": "Inter", "accent": "Playfair Display" },
    "layout": { "columns": 1, "margins": "normal", "spacing": "comfortable" }
  }
  ```

**Usage in Feature 006 (US2)**: Defines available templates for design customization via AI

---

### 8. design_customizations (Existing - Feature 003)

**Purpose**: User-specific design modifications to templates

**Source**: `supabase/migrations/20251008_add_design_tables.sql`

**Schema**:
```sql
CREATE TABLE design_customizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  template_key TEXT NOT NULL, -- References design_templates.name
  colors JSONB, -- Color overrides { "primary": "#...", "secondary": "#..." }
  fonts JSONB, -- Font overrides { "heading": "...", "body": "..." }
  layout JSONB, -- Layout overrides { "columns": 2, "margins": "wide" }
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customizations_user ON design_customizations(user_id, template_key);
```

**Relationships**:
- Belongs to `profiles` (user_id)
- References `design_templates` (template_key, not FK to allow template deletion)
- Has many `resume_design_assignments`

**RLS**: Users can only access their own customizations

**Business Rules**:
- Customizations are deltas from template defaults (only store changed values)
- Null values inherit from template config
- Multiple customizations allowed per (user, template) - but typically one "current" per optimization
- Changes applied via AI chat or manual design panel

**Usage in Feature 006 (US2)**: Stores user's design preferences applied via AI natural language commands

---

### 9. resume_design_assignments (Existing - Feature 003)

**Purpose**: Links optimizations to design templates with customizations

**Source**: `supabase/migrations/20251008_add_design_tables.sql`

**Schema**:
```sql
CREATE TABLE resume_design_assignments (
  optimization_id UUID PRIMARY KEY REFERENCES optimizations(id) ON DELETE CASCADE,
  template_key TEXT NOT NULL, -- References design_templates.name
  customization_id UUID REFERENCES design_customizations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_assignments_template ON resume_design_assignments(template_key);
```

**Relationships**:
- Belongs to `optimizations` (optimization_id) - **1:1 relationship** (PK is FK)
- References `design_templates` (template_key)
- Optionally references `design_customizations` (customization_id)

**RLS**: Users can only access assignments for their own optimizations

**Business Rules**:
- One design per optimization (enforced by PK)
- If no assignment exists, use default template (minimal)
- Customization is optional - can use template defaults
- When template_key changes, customization_id reset to null (new template, new customizations)

**Usage in Feature 006 (US2)**: Connects optimizations to current design state for AI-driven customization

---

### 10. applications (Existing - Feature 005)

**Purpose**: Track job applications using optimized resumes

**Source**: `supabase/migrations/20251014000000_add_applications_table.sql`

**Schema**:
```sql
CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  optimization_id UUID NOT NULL REFERENCES optimizations(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'applied', -- 'applied', 'interviewing', 'offered', 'rejected', 'accepted'
  applied_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  job_title TEXT,
  company TEXT,
  job_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_applications_user_id ON applications(user_id);
CREATE INDEX idx_applications_optimization_id ON applications(optimization_id);
CREATE INDEX idx_applications_applied_date ON applications(applied_date DESC);
```

**Relationships**:
- Belongs to `profiles` (user_id)
- Belongs to `optimizations` (optimization_id)

**RLS**: Users can only access their own applications

**Business Rules**:
- Status workflow: `applied` → `interviewing` → (`offered` OR `rejected`) → (`accepted` OR finalized)
- Job metadata (title, company, URL) optional but recommended
- Applied date defaults to NOW() but can be backdated
- Notes support user's custom tracking info

**Usage in Feature 006 (US3)**: Stores application history when user clicks "Apply Resume"

---

## Data Flows

### Flow 1: Interactive Content Editing (US1)

**User Action**: Ask AI to improve resume content

**Sequence**:
```
1. User opens optimization → Check if active chat_session exists
   ├─ If exists: Resume existing session
   └─ If not: Create new chat_session (status='active')

2. User sends message → Create chat_message (sender='user')

3. AI processes message → Extract amendment_request
   ├─ Type: 'add', 'modify', 'remove', 'clarify'
   ├─ Target: section path (e.g., 'experience[0].bullets[1]')
   └─ Status: 'pending'

4. AI responds → Create chat_message (sender='ai')

5. User previews change → GET /api/v1/chat/sessions/{id}/preview
   └─ Returns diff of original vs. proposed content

6. User applies change → POST /api/v1/chat/sessions/{id}/apply
   ├─ Update amendment_request (status='applied', processed_at=NOW())
   ├─ Create resume_version (version_number=N+1, content=new_data)
   └─ Update optimization.optimized_data

7. User exports → Generate PDF with latest resume_version content
```

**Key Entities**: `chat_sessions`, `chat_messages`, `amendment_requests`, `resume_versions`, `optimizations`

---

### Flow 2: Visual Design Customization (US2)

**User Action**: Change resume design via natural language

**Sequence**:
```
1. User opens optimization → Load resume_design_assignments
   ├─ If exists: Load current template + customizations
   └─ If not: Assign default template ('minimal')

2. User requests design change (e.g., "make header blue")
   → POST /api/v1/design/{optimizationId}/customize

3. AI parses request → Extract design modifications
   ├─ Parse: "blue" → colors.primary = "#0000FF"
   ├─ Validate: ATS compatibility check
   └─ Generate: customization delta

4. Apply customization
   ├─ Check if design_customization exists for (user_id, template_key)
   │  ├─ If exists: Update existing customization
   │  └─ If not: Create new design_customization
   └─ Update resume_design_assignments.customization_id

5. Render preview → GET /api/v1/design/templates/{id}/preview
   └─ Apply customizations on top of template defaults

6. User exports → Generate PDF with customized design
```

**Key Entities**: `resume_design_assignments`, `design_customizations`, `design_templates`, `optimizations`

---

### Flow 3: Application History Tracking (US3)

**User Action**: Click "Apply Resume"

**Sequence**:
```
1. User clicks "Apply Resume" → POST /api/applications

2. Collect metadata
   ├─ optimization_id (current optimization)
   ├─ job_title (from job_descriptions.title)
   ├─ company (from job_descriptions.company)
   ├─ job_url (from job_descriptions.source_url)
   └─ applied_date (NOW())

3. Validate: Check for duplicate
   → SELECT * FROM applications WHERE user_id = ? AND job_title = ? AND company = ? AND DATE(applied_date) = CURRENT_DATE
   ├─ If duplicate found: Show confirmation dialog
   └─ If no duplicate: Proceed

4. Create application record
   → INSERT INTO applications (...)

5. Trigger actions
   ├─ Download PDF (GET /api/download/{optimization_id})
   ├─ Open job URL in new tab (if job_url exists)
   └─ Show success toast

6. User views history → GET /api/optimizations
   └─ Join applications table to show "Applied" badge
```

**Key Entities**: `applications`, `optimizations`, `job_descriptions`

---

## Performance Considerations

### Indexes (Existing)

**Chat Tables**:
- `idx_active_session` - Unique index on (user_id, optimization_id) WHERE status='active'
- `idx_user_sessions` - Index on (user_id, last_activity_at DESC)
- `idx_session_messages` - Index on (session_id, created_at ASC)
- `idx_session_requests` - Index on (session_id, created_at DESC)
- `idx_pending_requests` - Partial index on (status, created_at ASC) WHERE status='pending'

**Design Tables**:
- `idx_templates_category` - Partial index on (category) WHERE is_active=true
- `idx_customizations_user` - Index on (user_id, template_key)
- `idx_assignments_template` - Index on (template_key)

**Application Tables**:
- `idx_applications_user_id` - Index on (user_id)
- `idx_applications_optimization_id` - Index on (optimization_id)
- `idx_applications_applied_date` - Index on (applied_date DESC)

**Query Performance**:
- Chat session lookup: O(1) via unique index
- Message history: O(N) via index, paginated to limit N
- Design assignment lookup: O(1) via PK (optimization_id)
- Application history: O(log N) via user_id index + pagination

---

## Data Retention

### Chat Data (Feature 002)

**Policy**: Retain for 90 days after session closure

**Implementation**:
```sql
-- Cleanup job (runs daily)
DELETE FROM chat_sessions
WHERE status = 'closed'
  AND last_activity_at < NOW() - INTERVAL '90 days';
-- Cascade deletes chat_messages, amendment_requests automatically
```

**Rationale**: Conversations are ephemeral. Users care about final resume, not how they got there.

### Resume Versions (Feature 002)

**Policy**: Retain forever (or until optimization is deleted)

**Rationale**: Version history is valuable for undo/redo and auditing.

### Applications (Feature 005)

**Policy**: Retain forever (or until user explicitly deletes)

**Rationale**: Application history is critical user data. Users need long-term tracking.

---

## Schema Migration Strategy

### No New Tables Required

This feature uses **100% existing schema**. No migrations needed.

### Optional Enhancement: Acceptance Tracking (for SC-002)

**If needed** to track amendment acceptance rate (SC-002):

```sql
ALTER TABLE amendment_requests ADD COLUMN accepted BOOLEAN DEFAULT NULL;
-- NULL = not yet decided, TRUE = user accepted, FALSE = user rejected
```

**Usage**: Track SC-002 (90% acceptance rate) by measuring `COUNT(*) WHERE accepted=true` / `COUNT(*)`

---

## Constraints and Validation

### Business Rules Enforced by Database

1. **One active chat session per optimization**
   - Enforced by: `idx_active_session` unique index
   - Prevents: Multiple simultaneous conversations for same resume

2. **Sequential version numbers**
   - Enforced by: `idx_version_number` unique index + application logic
   - Prevents: Version number conflicts

3. **Valid amendment types**
   - Enforced by: `CHECK(type IN ('add', 'modify', 'remove', 'clarify'))`
   - Prevents: Invalid amendment types

4. **Valid amendment statuses**
   - Enforced by: `CHECK(status IN ('pending', 'applied', 'rejected', 'needs_clarification'))`
   - Prevents: Invalid status transitions

5. **Valid application statuses**
   - Enforced by: Application logic (not CHECK constraint to allow future extensibility)
   - Valid: 'applied', 'interviewing', 'offered', 'rejected', 'accepted'

### Application-Level Validation

1. **Fabrication prevention**: AI cannot add content not present in original resume
   - Implemented in: `src/lib/chat-manager/processor.ts`
   - Validation: Compare amendment against `resume_versions.content[0]` (original)

2. **ATS compliance**: Design changes must maintain ATS readability
   - Implemented in: `src/lib/design-manager/ats-validator.ts`
   - Validation: Check text contrast, font sizes, parseable structure

3. **Duplicate application detection**: Warn when applying to same job twice
   - Implemented in: `POST /api/applications`
   - Validation: Query `applications` for matching (user_id, job_title, company, applied_date)

---

## Security

### Row Level Security (RLS)

**All tables have RLS enabled** with policies ensuring users can only access their own data:

- `chat_sessions`: `auth.uid() = user_id`
- `chat_messages`: Via join to `chat_sessions.user_id`
- `amendment_requests`: Via join to `chat_sessions.user_id`
- `resume_versions`: Via join to `optimizations.user_id`
- `design_customizations`: `auth.uid() = user_id`
- `resume_design_assignments`: Via join to `optimizations.user_id`
- `applications`: `auth.uid() = user_id`

### Sensitive Data

**No PII stored** in chat/design/application tables beyond user_id (which is a UUID).

**Job metadata** (job_title, company, job_url) is user-entered and not sensitive.

**Resume content** stored in JSONB is protected by RLS.

---

## Conclusion

Feature 006 leverages a **mature, battle-tested schema** from Features 002, 003, and 005. No new tables required. All entities, relationships, indexes, and RLS policies already exist and are production-ready.

**Key Takeaways**:
1. **Zero schema changes needed** - Existing tables cover all requirements
2. **Strong data integrity** - Constraints, indexes, and RLS policies already in place
3. **Proven scalability** - Schema supports thousands of users and millions of records
4. **Clear data flows** - Well-defined relationships between entities

**Implementation Focus**: UI integration and prompt engineering, not database work.
