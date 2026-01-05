# How to Apply Database Migrations

## Quick Start - Copy & Paste Method (5 minutes)

### Step 1: Open Supabase SQL Editor

Go to: **https://supabase.com/dashboard/project/brtdyamysfmctrhuankn/sql/new**

Or:
1. Visit https://supabase.com/dashboard
2. Select project "ResumeBuilder AI"
3. Click "SQL Editor" in sidebar
4. Click "New query"

### Step 2: Copy and Run Each Migration

**IMPORTANT**: Run these in order (001, 002, 003, 004)

---

#### Migration 1: Create ai_threads table

1. Create a new query
2. Copy ALL content from: `supabase/migrations/20250118000001_create_ai_threads.sql`
3. Paste and click **RUN**
4. Verify you see "Success. No rows returned"

---

#### Migration 2: Create content_modifications table

1. Create a new query
2. Copy ALL content from: `supabase/migrations/20250118000002_create_content_modifications.sql`
3. Paste and click **RUN**
4. Verify you see "Success. No rows returned"

---

#### Migration 3: Create style_customization_history table

1. Create a new query
2. Copy ALL content from: `supabase/migrations/20250118000003_create_style_history.sql`
3. Paste and click **RUN**
4. Verify you see "Success. No rows returned"

---

#### Migration 4: Alter existing tables

1. Create a new query
2. Copy ALL content from: `supabase/migrations/20250118000004_alter_existing_tables.sql`
3. Paste and click **RUN**
4. Verify you see "Success. No rows returned"

---

### Step 3: Verify Migrations

Run this verification query in SQL Editor:

```sql
-- Check new tables exist
SELECT
  't1' as check_type,
  table_name,
  CASE WHEN table_name IN ('ai_threads', 'content_modifications', 'style_customization_history')
    THEN 'EXISTS ✓'
    ELSE 'MISSING ✗'
  END as status
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('ai_threads', 'content_modifications', 'style_customization_history')

UNION ALL

-- Check new columns exist
SELECT
  't2' as check_type,
  table_name || '.' || column_name as table_name,
  'EXISTS ✓' as status
FROM information_schema.columns
WHERE table_schema = 'public'
AND (
  (table_name = 'chat_sessions' AND column_name = 'openai_thread_id')
  OR
  (table_name = 'optimizations' AND column_name = 'ai_modification_count')
)
ORDER BY check_type, table_name;
```

**Expected Output**: 5 rows showing "EXISTS ✓"
- ai_threads
- content_modifications
- style_customization_history
- chat_sessions.openai_thread_id
- optimizations.ai_modification_count

---

## What These Migrations Do

### Migration 001: ai_threads Table
**Purpose**: Track OpenAI Assistant threads for persistent conversations

**Schema**:
- Links: user → optimization → chat session → OpenAI thread
- Stores: thread ID, assistant ID, status, metadata
- RLS: Enabled (users can only see their own threads)

**Use Case**: When user chats with AI assistant, we create a thread once and reuse it for the entire optimization session.

---

### Migration 002: content_modifications Table
**Purpose**: Audit trail of all AI-made resume changes

**Schema**:
- Tracks: what field changed, old/new values, operation type
- Measures: ATS score before/after each change
- Context: links to chat message that triggered change

**Use Case**:
- Show user history of changes ("Timeline" feature)
- Calculate total improvement score
- Implement undo/redo functionality
- Debug why AI made certain changes

---

### Migration 003: style_customization_history Table
**Purpose**: Track visual/design customization requests

**Schema**:
- Stores: color, font, spacing, layout changes
- History: previous customization state for undo
- Links: to chat message that requested the change

**Use Case**:
- Undo visual changes
- Show customization history
- Restore previous design states

---

### Migration 004: Alter Existing Tables
**Purpose**: Add columns to support new features

**Changes**:
1. `chat_sessions.openai_thread_id` - Link session to OpenAI thread
2. `optimizations.ai_modification_count` - Count of AI edits made

**Use Case**:
- Persist thread ID across page refreshes
- Show "X improvements made" badge
- Track usage metrics

---

## Troubleshooting

### Error: "relation already exists"
✅ **This is OK!** It means the migration was already applied.
Just continue to the next migration.

### Error: "permission denied"
❌ Make sure you're logged into the correct Supabase project.
Try refreshing the page and logging in again.

### Error: "column does not exist" in references
❌ You may have skipped a migration.
Make sure you ran them in order: 001 → 002 → 003 → 004

### No errors but tables don't appear
⚠️  Wait 10 seconds and refresh the Table Editor page.
Supabase caches schema, it may take a moment to update.

---

## After Migration

### 1. Verify in Table Editor
- Go to: Database → Tables
- Look for: `ai_threads`, `content_modifications`, `style_customization_history`
- They should appear in the list

### 2. Check RLS Policies
- Click on each new table
- Go to "Policies" tab
- You should see 4 policies per table (SELECT, INSERT, UPDATE, DELETE)

### 3. Test in Node.js
Run the verification script:
```bash
cd resume-builder-ai
node apply-migrations-simple.js
```

Should show:
```
✅ Table: ai_threads
✅ Table: content_modifications
✅ Table: style_customization_history
✅ Column: chat_sessions.openai_thread_id
✅ Column: optimizations.ai_modification_count
```

---

## Rollback (Emergency Only)

If you need to undo these migrations:

```sql
-- ⚠️  WARNING: This deletes all data!

BEGIN;

-- Drop new tables
DROP TABLE IF EXISTS ai_threads CASCADE;
DROP TABLE IF EXISTS content_modifications CASCADE;
DROP TABLE IF EXISTS style_customization_history CASCADE;

-- Remove new columns
ALTER TABLE chat_sessions DROP COLUMN IF EXISTS openai_thread_id;
ALTER TABLE optimizations DROP COLUMN IF EXISTS ai_modification_count;

COMMIT;
```

---

## Alternative: Supabase CLI Method

If you prefer command line:

```bash
# Install Supabase CLI
npm install -g supabase

# Navigate to project
cd resume-builder-ai/resume-builder-ai

# Link your project (you'll be prompted for credentials)
npx supabase link --project-ref brtdyamysfmctrhuankn

# Apply all migrations
npx supabase db push

# Verify
npx supabase db diff
```

---

## Files Reference

All migration files are in: `supabase/migrations/`

1. `20250118000001_create_ai_threads.sql` (54 lines)
2. `20250118000002_create_content_modifications.sql` (69 lines)
3. `20250118000003_create_style_history.sql` (48 lines)
4. `20250118000004_alter_existing_tables.sql` (33 lines)

**Total**: 204 lines of SQL

**Time to apply**: ~5 minutes via Dashboard, ~2 minutes via CLI

---

**Status**: Ready to apply ✓
**Risk**: Low (all migrations use IF NOT EXISTS)
**Reversible**: Yes (see Rollback section)
**Dependencies**: Existing tables (auth.users, optimizations, chat_sessions, chat_messages)
