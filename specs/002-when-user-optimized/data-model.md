# Data Model: AI Chat Resume Iteration

**Feature**: 002-when-user-optimized
**Date**: 2025-10-06
**Database**: Supabase PostgreSQL with Row Level Security (RLS)

## Overview

This feature extends the existing resume optimization data model with four new entities to support conversational AI-driven resume refinement. All tables enforce Row Level Security to ensure users can only access their own data.

## Entity Relationship Diagram

```
profiles (existing from 001)
    ↓ user_id
optimizations (existing from 001)
    ↓ optimization_id
chat_sessions (NEW)
    ↓ session_id
    ├→ chat_messages (NEW)
    └→ resume_versions (NEW)
         ↓ version_id
    amendment_requests (NEW)
```

## New Entities

### 1. chat_sessions

Represents an interactive conversation between a user and AI for refining a specific optimized resume.

**Table**: `chat_sessions`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique session identifier |
| user_id | UUID | NOT NULL, FOREIGN KEY → profiles(id) | Session owner |
| optimization_id | UUID | NOT NULL, FOREIGN KEY → optimizations(id) | Parent resume optimization |
| status | TEXT | NOT NULL, CHECK(status IN ('active', 'closed')), DEFAULT 'active' | Session state |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Session start time |
| last_activity_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last message timestamp (for 30-day retention) |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last modification time |
| context | JSONB | NULL | Optional conversation context (resume summary, job description key points) |

**Indexes**:
- `UNIQUE INDEX idx_active_session ON chat_sessions(user_id, optimization_id) WHERE status = 'active'` - Enforces single active session per resume
- `INDEX idx_user_sessions ON chat_sessions(user_id, last_activity_at DESC)` - User session list queries
- `INDEX idx_retention_cleanup ON chat_sessions(last_activity_at) WHERE status = 'closed'` - 30-day cleanup job

**RLS Policies**:
```sql
-- Users can only view their own sessions
CREATE POLICY "Users view own sessions" ON chat_sessions
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create sessions for their own optimizations
CREATE POLICY "Users create own sessions" ON chat_sessions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM optimizations WHERE id = optimization_id AND user_id = auth.uid())
  );

-- Users can update their own sessions
CREATE POLICY "Users update own sessions" ON chat_sessions
  FOR UPDATE USING (auth.uid() = user_id);
```

**Business Rules**:
- Only one active session per (user_id, optimization_id) pair
- Sessions automatically close when user explicitly closes chat sidebar
- Closed sessions retained for 30 days from `last_activity_at`
- Background job deletes sessions where `last_activity_at < NOW() - INTERVAL '30 days'`

---

### 2. chat_messages

Represents individual messages within a chat session.

**Table**: `chat_messages`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique message identifier |
| session_id | UUID | NOT NULL, FOREIGN KEY → chat_sessions(id) ON DELETE CASCADE | Parent chat session |
| sender | TEXT | NOT NULL, CHECK(sender IN ('user', 'ai')) | Message originator |
| content | TEXT | NOT NULL | Message text |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Message timestamp |
| metadata | JSONB | NULL | Optional structured data (amendment_type, section_affected, ai_model_version) |

**Indexes**:
- `INDEX idx_session_messages ON chat_messages(session_id, created_at ASC)` - Chronological message retrieval
- `INDEX idx_message_search ON chat_messages USING GIN(to_tsvector('english', content))` - Future full-text search (optional)

**RLS Policies**:
```sql
-- Users can view messages in their own sessions
CREATE POLICY "Users view own messages" ON chat_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM chat_sessions WHERE id = session_id AND user_id = auth.uid())
  );

-- Users can create messages in their own sessions
CREATE POLICY "Users create own messages" ON chat_messages
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM chat_sessions WHERE id = session_id AND user_id = auth.uid())
  );
```

**Business Rules**:
- Messages deleted automatically when parent session deleted (CASCADE)
- User messages trigger `last_activity_at` update on parent session
- AI messages include metadata for tracking model version and processing time

---

### 3. resume_versions

Represents snapshots of resume content at specific points in time, created after chat-based amendments.

**Table**: `resume_versions`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique version identifier |
| optimization_id | UUID | NOT NULL, FOREIGN KEY → optimizations(id) | Parent optimization |
| session_id | UUID | NULL, FOREIGN KEY → chat_sessions(id) ON DELETE SET NULL | Chat session that created this version (NULL if original optimization) |
| version_number | INTEGER | NOT NULL | Sequential version counter (1, 2, 3...) |
| content | JSONB | NOT NULL | Full resume content snapshot |
| change_summary | TEXT | NULL | Human-readable description of changes from previous version |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Version creation time |

**Indexes**:
- `UNIQUE INDEX idx_version_number ON resume_versions(optimization_id, version_number)` - Enforce sequential versioning
- `INDEX idx_session_versions ON resume_versions(session_id, created_at DESC)` - List versions by session

**RLS Policies**:
```sql
-- Users can view versions of their own optimizations
CREATE POLICY "Users view own versions" ON resume_versions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM optimizations WHERE id = optimization_id AND user_id = auth.uid())
  );

-- Users can create versions for their own optimizations
CREATE POLICY "Users create own versions" ON resume_versions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM optimizations WHERE id = optimization_id AND user_id = auth.uid())
  );
```

**Business Rules**:
- Version 1 = original optimization output
- Each chat amendment creates new version with incremented `version_number`
- `session_id` remains even if session deleted (for audit trail)
- `content` stored as full snapshot (not incremental diff) for undo reliability
- Undo operation creates new version pointing to previous content (preserves history)

---

### 4. amendment_requests

Represents structured amendment requests extracted from chat messages for processing.

**Table**: `amendment_requests`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique request identifier |
| session_id | UUID | NOT NULL, FOREIGN KEY → chat_sessions(id) ON DELETE CASCADE | Parent chat session |
| message_id | UUID | NOT NULL, FOREIGN KEY → chat_messages(id) ON DELETE CASCADE | Originating user message |
| type | TEXT | NOT NULL, CHECK(type IN ('add', 'modify', 'remove', 'clarify')) | Amendment category |
| target_section | TEXT | NULL | Resume section affected (skills, experience, education, summary) |
| status | TEXT | NOT NULL, CHECK(status IN ('pending', 'applied', 'rejected', 'needs_clarification')), DEFAULT 'pending' | Processing state |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Request extraction time |
| processed_at | TIMESTAMPTZ | NULL | When status changed from pending |
| rejection_reason | TEXT | NULL | Explanation if status='rejected' (e.g., fabrication attempt) |

**Indexes**:
- `INDEX idx_session_requests ON amendment_requests(session_id, created_at DESC)` - List requests by session
- `INDEX idx_pending_requests ON amendment_requests(status, created_at ASC) WHERE status = 'pending'` - Processing queue

**RLS Policies**:
```sql
-- Users can view requests in their own sessions
CREATE POLICY "Users view own requests" ON amendment_requests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM chat_sessions WHERE id = session_id AND user_id = auth.uid())
  );

-- System creates requests (no user INSERT policy - backend only)
```

**Business Rules**:
- Extracted by AI from user messages during processing
- One message may generate multiple requests (e.g., "add Python and remove Java")
- Rejected requests include explanation for user feedback
- Applied requests link to created `resume_version.id` via metadata

---

## Database Migration SQL

**File**: `supabase/migrations/20251006_chat_schema.sql`

```sql
-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Chat Sessions Table
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  optimization_id UUID NOT NULL REFERENCES optimizations(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK(status IN ('active', 'closed')) DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  context JSONB
);

CREATE UNIQUE INDEX idx_active_session ON chat_sessions(user_id, optimization_id) WHERE status = 'active';
CREATE INDEX idx_user_sessions ON chat_sessions(user_id, last_activity_at DESC);
CREATE INDEX idx_retention_cleanup ON chat_sessions(last_activity_at) WHERE status = 'closed';

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

-- Chat Messages Table
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK(sender IN ('user', 'ai')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB
);

CREATE INDEX idx_session_messages ON chat_messages(session_id, created_at ASC);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Resume Versions Table
CREATE TABLE resume_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  optimization_id UUID NOT NULL REFERENCES optimizations(id) ON DELETE CASCADE,
  session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
  version_number INTEGER NOT NULL,
  content JSONB NOT NULL,
  change_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_version_number ON resume_versions(optimization_id, version_number);
CREATE INDEX idx_session_versions ON resume_versions(session_id, created_at DESC);

ALTER TABLE resume_versions ENABLE ROW LEVEL SECURITY;

-- Amendment Requests Table
CREATE TABLE amendment_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('add', 'modify', 'remove', 'clarify')),
  target_section TEXT,
  status TEXT NOT NULL CHECK(status IN ('pending', 'applied', 'rejected', 'needs_clarification')) DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  rejection_reason TEXT
);

CREATE INDEX idx_session_requests ON amendment_requests(session_id, created_at DESC);
CREATE INDEX idx_pending_requests ON amendment_requests(status, created_at ASC) WHERE status = 'pending';

ALTER TABLE amendment_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies (see entity definitions above for complete policies)
-- ... (policies omitted for brevity, see full migration file)

-- Trigger to update last_activity_at on new messages
CREATE OR REPLACE FUNCTION update_session_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chat_sessions
  SET last_activity_at = NOW(), updated_at = NOW()
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_message_created
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_session_activity();
```

---

## Integration with Existing Schema

### Dependencies on Existing Tables

- **profiles** (from 001): `chat_sessions.user_id` references `profiles.id`
- **optimizations** (from 001): `chat_sessions.optimization_id` and `resume_versions.optimization_id` reference `optimizations.id`

### Schema Extensions

No modifications to existing tables required. Feature is fully additive with clean foreign key relationships.

---

## Data Retention Policy

**30-Day Cleanup Job** (Supabase Edge Function or pg_cron):

```sql
-- Delete closed sessions older than 30 days (CASCADE deletes messages and requests)
DELETE FROM chat_sessions
WHERE status = 'closed'
  AND last_activity_at < NOW() - INTERVAL '30 days';

-- Resume versions are preserved (audit trail) even if session deleted (ON DELETE SET NULL)
```

**Storage Estimates**:
- Average chat session: 20 messages × 200 chars = 4KB
- Average resume version: 50KB (JSONB)
- 1000 users × 5 sessions = 20MB (messages) + 250MB (versions) = 270MB total (negligible)

---

## Validation Rules Summary

| Entity | Validation | Enforcement |
|--------|-----------|-------------|
| chat_sessions | Single active per (user, optimization) | DB unique index + CHECK constraint |
| chat_messages | sender IN ('user', 'ai') | CHECK constraint |
| resume_versions | Sequential version_number | DB unique index on (optimization_id, version_number) |
| amendment_requests | type IN (add, modify, remove, clarify) | CHECK constraint |
| amendment_requests | status transitions (pending→applied/rejected) | Application logic + DB CHECK |
| All tables | User can only access own data | RLS policies |

---

## TypeScript Type Definitions

**File**: `src/types/chat.ts`

```typescript
export type ChatSessionStatus = 'active' | 'closed';
export type MessageSender = 'user' | 'ai';
export type AmendmentType = 'add' | 'modify' | 'remove' | 'clarify';
export type AmendmentStatus = 'pending' | 'applied' | 'rejected' | 'needs_clarification';

export interface ChatSession {
  id: string;
  user_id: string;
  optimization_id: string;
  status: ChatSessionStatus;
  created_at: string;
  last_activity_at: string;
  updated_at: string;
  context?: Record<string, any>;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  sender: MessageSender;
  content: string;
  created_at: string;
  metadata?: {
    amendment_type?: AmendmentType;
    section_affected?: string;
    ai_model_version?: string;
    processing_time_ms?: number;
  };
}

export interface ResumeVersion {
  id: string;
  optimization_id: string;
  session_id: string | null;
  version_number: number;
  content: Record<string, any>; // Resume JSONB structure
  change_summary: string | null;
  created_at: string;
}

export interface AmendmentRequest {
  id: string;
  session_id: string;
  message_id: string;
  type: AmendmentType;
  target_section: string | null;
  status: AmendmentStatus;
  created_at: string;
  processed_at: string | null;
  rejection_reason: string | null;
}
```

---

**End of Data Model**
