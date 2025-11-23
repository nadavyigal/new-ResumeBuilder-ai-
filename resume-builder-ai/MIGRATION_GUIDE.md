# Database Migration Guide
## Feature: 008-enhance-ai-assistent

This guide explains how to apply 4 database migrations for the Enhanced AI Assistant feature.

## Migrations to Apply

1. **20250118000001_create_ai_threads.sql** - OpenAI thread tracking table
2. **20250118000002_create_content_modifications.sql** - Resume change audit trail
3. **20250118000003_create_style_history.sql** - Visual customization tracking
4. **20250118000004_alter_existing_tables.sql** - Add columns to existing tables

## Method 1: Supabase Dashboard (RECOMMENDED - Manual)

This is the most reliable method.

### Steps:

1. **Open Supabase SQL Editor**
   - Go to: https://supabase.com/dashboard/project/brtdyamysfmctrhuankn/editor/sql
   - Or navigate: Dashboard → SQL Editor

2. **Apply Each Migration**

   For each migration file (in order 001, 002, 003, 004):

   a. Click "New query" button

   b. Copy the entire SQL content from the migration file:
      - `resume-builder-ai/supabase/migrations/20250118000001_create_ai_threads.sql`
      - `resume-builder-ai/supabase/migrations/20250118000002_create_content_modifications.sql`
      - `resume-builder-ai/supabase/migrations/20250118000003_create_style_history.sql`
      - `resume-builder-ai/supabase/migrations/20250118000004_alter_existing_tables.sql`

   c. Paste into the SQL editor

   d. Click "Run" (or press Ctrl+Enter)

   e. Verify "Success" message appears

3. **Verify Tables Created**

   Run this query to check:
   ```sql
   SELECT table_name
   FROM information_schema.tables
   WHERE table_schema = 'public'
   AND table_name IN (
     'ai_threads',
     'content_modifications',
     'style_customization_history'
   );
   ```

   Should return 3 rows.

4. **Verify Columns Added**

   Run this query:
   ```sql
   -- Check chat_sessions.openai_thread_id
   SELECT column_name
   FROM information_schema.columns
   WHERE table_name = 'chat_sessions'
   AND column_name = 'openai_thread_id';

   -- Check optimizations.ai_modification_count
   SELECT column_name
   FROM information_schema.columns
   WHERE table_name = 'optimizations'
   AND column_name = 'ai_modification_count';
   ```

   Both should return 1 row each.

## Method 2: Supabase CLI (RECOMMENDED - Automated)

If you have Supabase CLI installed and configured:

### Prerequisites:
```bash
# Install CLI (if not installed)
npm install -g supabase

# Link your project
npx supabase link --project-ref brtdyamysfmctrhuankn
```

### Apply Migrations:
```bash
cd resume-builder-ai
npx supabase db push
```

This will automatically apply all pending migrations in order.

### Verify:
```bash
npx supabase db diff
```

Should show no pending migrations.

## Method 3: psql Command Line

If you have PostgreSQL client (psql) installed:

1. **Get Database Password**
   - Go to Supabase Dashboard → Settings → Database
   - Copy the database password

2. **Connect via psql**
   ```bash
   psql "postgresql://postgres:[YOUR_PASSWORD]@db.brtdyamysfmctrhuankn.supabase.co:5432/postgres"
   ```

3. **Run Each Migration**
   ```bash
   \i C:/Users/nadav/OneDrive/מסמכים/AI/cursor/cursor playground/ResumeBuilder AI/resume-builder-ai/supabase/migrations/20250118000001_create_ai_threads.sql
   \i C:/Users/nadav/OneDrive/מסמכים/AI/cursor/cursor playground/ResumeBuilder AI/resume-builder-ai/supabase/migrations/20250118000002_create_content_modifications.sql
   \i C:/Users/nadav/OneDrive/מסמכים/AI/cursor/cursor playground/ResumeBuilder AI/resume-builder-ai/supabase/migrations/20250118000003_create_style_history.sql
   \i C:/Users/nadav/OneDrive/מסמכים/AI/cursor/cursor playground/ResumeBuilder AI/resume-builder-ai/supabase/migrations/20250118000004_alter_existing_tables.sql
   ```

## Verification Script

After applying migrations, run the verification script:

```bash
cd resume-builder-ai
node apply-migrations-simple.js
```

You should see all tables and columns marked with ✅.

## Expected Database Schema After Migration

### New Tables:

1. **ai_threads**
   - Tracks OpenAI Assistant threads
   - Links user → optimization → chat session → OpenAI thread
   - Columns: id, user_id, optimization_id, session_id, openai_thread_id, status, metadata, timestamps

2. **content_modifications**
   - Audit trail of all resume content changes
   - Tracks what changed, why, and impact on ATS score
   - Columns: id, user_id, optimization_id, operation, field_path, old_value, new_value, ats_scores, timestamps

3. **style_customization_history**
   - History of visual/design customizations
   - Tracks color, font, spacing, layout changes
   - Columns: id, user_id, optimization_id, customization_type, changes, previous_customization, timestamps

### Modified Tables:

1. **chat_sessions**
   - Added: `openai_thread_id VARCHAR(255) UNIQUE`
   - Links chat session to OpenAI Assistant thread

2. **optimizations**
   - Added: `ai_modification_count INTEGER DEFAULT 0`
   - Counts number of AI modifications made to resume

## Troubleshooting

### "Already Exists" Errors
- These are safe to ignore - means migration was already applied
- Verify the table exists using the verification queries above

### Permission Errors
- Ensure you're using the service role key or database password
- Check RLS policies aren't blocking the operation

### Connection Errors
- Verify project reference is correct: `brtdyamysfmctrhuankn`
- Check internet connection
- Verify Supabase project is active

## Rollback (If Needed)

If you need to undo the migrations:

```sql
-- Drop new tables (cascades to dependent objects)
DROP TABLE IF EXISTS ai_threads CASCADE;
DROP TABLE IF EXISTS content_modifications CASCADE;
DROP TABLE IF EXISTS style_customization_history CASCADE;

-- Remove new columns
ALTER TABLE chat_sessions DROP COLUMN IF EXISTS openai_thread_id;
ALTER TABLE optimizations DROP COLUMN IF EXISTS ai_modification_count;
```

⚠️  **WARNING**: This will delete all data in these tables!

## Support

If you encounter issues:
1. Check Supabase Dashboard → Logs for error details
2. Verify database status in Dashboard → Settings → Database
3. Try Method 1 (Dashboard) as the most reliable option

---

**Last Updated**: 2025-01-18
**Feature**: 008-enhance-ai-assistent
**Status**: Ready to apply
