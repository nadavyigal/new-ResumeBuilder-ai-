# Phase 1 Database Migrations - Application Guide

This guide explains how to apply Phase 1 database migrations for the Enhanced AI Assistant feature (spec 008-enhance-ai-assistent).

## What Gets Applied

The Phase 1 migrations create the foundational database schema:

1. **ai_threads** - Manages OpenAI Assistant thread lifecycle
2. **content_modifications** - Tracks resume field modifications with audit trail
3. **style_customization_history** - Records visual customization changes
4. **Existing table alterations** - Adds fields to `chat_sessions` and `optimizations`

## Prerequisites

### 1. Environment Variables

Ensure `.env.local` contains:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**Where to find these:**
- Supabase Dashboard → Project Settings → API
- Service Role Key: **Keep this secret!** It has admin privileges

### 2. Dependencies

Install required packages (if not already installed):

```bash
cd resume-builder-ai
npm install
```

## Migration Methods

### Method 1: Automated Script (Recommended)

Use the provided migration script:

```bash
cd resume-builder-ai
node scripts/apply-phase1-migrations.mjs
```

**What it does:**
- ✅ Validates environment configuration
- ✅ Checks for existing tables
- ✅ Applies all 4 migrations in order
- ✅ Creates RLS policies
- ✅ Provides detailed success/failure reporting

**Expected output:**

```
🚀 Phase 1 Migration Application

🔍 Validating environment...
✅ Supabase URL: https://xxx.supabase.co
✅ Service key found (eyJhbG...)

🔌 Connecting to Supabase...

🔍 Checking for existing tables...
   ℹ️  Table "ai_threads" does not exist (will be created)
   ℹ️  Table "content_modifications" does not exist (will be created)
   ℹ️  Table "style_customization_history" does not exist (will be created)

📦 Applying migrations...

📋 Applying migration: 20250118000001_create_ai_threads.sql
   ✅ Migration applied successfully

📋 Applying migration: 20250118000002_create_content_modifications.sql
   ✅ Migration applied successfully

📋 Applying migration: 20250118000003_create_style_history.sql
   ✅ Migration applied successfully

📋 Applying migration: 20250118000004_alter_existing_tables.sql
   ✅ Migration applied successfully

📊 Migration Summary:
   ✅ Successful: 4/4
   ❌ Failed: 0/4

🎉 All migrations applied successfully!
```

### Method 2: Supabase Dashboard (Manual)

If the script fails or you prefer manual control:

1. Open [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to: **SQL Editor**
3. Create a new query
4. Copy-paste each migration file in order:
   - `supabase/migrations/20250118000001_create_ai_threads.sql`
   - `supabase/migrations/20250118000002_create_content_modifications.sql`
   - `supabase/migrations/20250118000003_create_style_history.sql`
   - `supabase/migrations/20250118000004_alter_existing_tables.sql`
5. Run each query and verify success

### Method 3: Supabase CLI (If Available)

```bash
cd resume-builder-ai
npx supabase db push
```

**Note:** This requires Supabase CLI to be properly linked and authenticated.

## Verification

After applying migrations, verify they worked:

### 1. Check Tables Exist

**Dashboard Method:**
- Supabase Dashboard → Table Editor
- Look for: `ai_threads`, `content_modifications`, `style_customization_history`

**SQL Method:**
```sql
-- Run in SQL Editor
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'ai_threads',
    'content_modifications',
    'style_customization_history'
  );
```

### 2. Verify RLS Policies

**Dashboard Method:**
- Supabase Dashboard → Authentication → Policies
- Check each new table has 4 policies (SELECT, INSERT, UPDATE, DELETE)

**SQL Method:**
```sql
-- Run in SQL Editor
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE tablename IN (
  'ai_threads',
  'content_modifications',
  'style_customization_history'
)
ORDER BY tablename, policyname;
```

### 3. Check Column Additions

Verify `chat_sessions` and `optimizations` tables have new columns:

```sql
-- Check chat_sessions.openai_thread_id
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'chat_sessions'
  AND column_name = 'openai_thread_id';

-- Check optimizations.ai_modification_count
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'optimizations'
  AND column_name = 'ai_modification_count';
```

## Troubleshooting

### Error: "SUPABASE_SERVICE_ROLE_KEY not found"

**Solution:** Add service role key to `.env.local`:
```bash
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...your-key-here
```

Find it at: Supabase Dashboard → Project Settings → API → service_role

### Error: "relation 'ai_threads' already exists"

**Cause:** Migrations were partially applied

**Solution:**
1. Check which tables exist in Table Editor
2. Only run migrations for tables that don't exist
3. Or drop existing tables and re-run (⚠️ **CAUTION:** This deletes data!)

```sql
-- Drop tables if needed (CAUTION: Deletes all data!)
DROP TABLE IF EXISTS ai_threads CASCADE;
DROP TABLE IF EXISTS content_modifications CASCADE;
DROP TABLE IF EXISTS style_customization_history CASCADE;
```

### Error: "function exec_sql does not exist"

**Cause:** Script needs helper function that doesn't exist

**Solution:** Run this in SQL Editor first:

```sql
CREATE OR REPLACE FUNCTION exec_sql(sql_string TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql_string;
  RETURN 'Success';
EXCEPTION
  WHEN OTHERS THEN
    RETURN 'Error: ' || SQLERRM;
END;
$$;
```

Then re-run the migration script.

### Error: "permission denied"

**Cause:** Using anon key instead of service role key

**Solution:**
- Verify you're using `SUPABASE_SERVICE_ROLE_KEY` (not ANON_KEY)
- Service role key starts with `eyJhbG...` and is much longer than anon key

## Next Steps

After successful migration:

1. ✅ **Verify** all tables created
2. ✅ **Test** Phase 2 thread management
   - Start AI assistant
   - Send a message
   - Verify no "undefined thread ID" errors
3. ✅ **Monitor** logs for any database errors
4. ✅ **Proceed** to Phase 3 implementation (if not already complete)

## Rollback

If you need to undo migrations:

```sql
-- Drop all Phase 1 additions (CAUTION: Deletes all data!)
BEGIN;

-- Drop tables
DROP TABLE IF EXISTS ai_threads CASCADE;
DROP TABLE IF EXISTS content_modifications CASCADE;
DROP TABLE IF EXISTS style_customization_history CASCADE;

-- Remove added columns
ALTER TABLE chat_sessions DROP COLUMN IF EXISTS openai_thread_id;
ALTER TABLE optimizations DROP COLUMN IF EXISTS ai_modification_count;

COMMIT;
```

## Support

If you encounter issues:

1. Check the [Troubleshooting](#troubleshooting) section above
2. Review error messages from the script output
3. Verify environment variables are set correctly
4. Try the manual Dashboard method (Method 2)

## Migration Files Reference

All migration SQL files are located in:
```
supabase/migrations/
  ├── 20250118000001_create_ai_threads.sql
  ├── 20250118000002_create_content_modifications.sql
  ├── 20250118000003_create_style_history.sql
  └── 20250118000004_alter_existing_tables.sql
```

Each file is self-contained and can be run independently (except 20250118000004 which depends on existing tables).
