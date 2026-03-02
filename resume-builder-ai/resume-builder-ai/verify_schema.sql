-- Database Schema Verification Script
-- This script checks all tables, columns, and RLS policies

-- ============================================================================
-- Check Migrations Applied
-- ============================================================================

SELECT
  version,
  name,
  executed_at
FROM supabase_migrations.schema_migrations
ORDER BY executed_at DESC;

-- ============================================================================
-- Task 2: Verify Database Tables and Columns
-- ============================================================================

-- Check optimizations table
SELECT
  'optimizations' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'optimizations'
  AND column_name IN ('id', 'rewrite_data', 'ats_score_optimized', 'ats_suggestions', 'jd_id', 'user_id')
ORDER BY column_name;

-- Check job_descriptions table
SELECT
  'job_descriptions' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'job_descriptions'
  AND column_name IN ('id', 'parsed_data', 'extracted_data', 'embeddings')
ORDER BY column_name;

-- Check design_assignments table (resume_design_assignments)
SELECT
  'resume_design_assignments' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'resume_design_assignments'
  AND column_name IN ('optimization_id', 'user_id', 'template_id', 'customization_id')
ORDER BY column_name;

-- Check design_customizations table
SELECT
  'design_customizations' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'design_customizations'
  AND column_name IN ('id', 'template_id', 'color_scheme', 'font_family', 'spacing', 'spacing_settings')
ORDER BY column_name;

-- Check chat_messages table
SELECT
  'chat_messages' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'chat_messages'
  AND column_name IN ('session_id', 'sender', 'content', 'metadata')
ORDER BY column_name;

-- Check chat_sessions table
SELECT
  'chat_sessions' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'chat_sessions'
  AND column_name IN ('id', 'optimization_id', 'status', 'user_id')
ORDER BY column_name;

-- ============================================================================
-- Check All Tables Existence
-- ============================================================================

SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE c.table_name = columns.table_name) as column_count
FROM information_schema.tables c
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name IN (
    'profiles',
    'resumes',
    'job_descriptions',
    'optimizations',
    'templates',
    'events',
    'chat_sessions',
    'chat_messages',
    'resume_versions',
    'amendment_requests',
    'design_templates',
    'design_customizations',
    'resume_design_assignments',
    'applications'
  )
ORDER BY table_name;

-- ============================================================================
-- Task 3: Check Row Level Security (RLS)
-- ============================================================================

-- Check which tables have RLS enabled
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'optimizations',
    'resume_design_assignments',
    'chat_messages',
    'chat_sessions',
    'design_customizations',
    'design_templates'
  )
ORDER BY tablename;

-- Check RLS policies for optimizations
SELECT
  'optimizations' as table_name,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'optimizations';

-- Check RLS policies for design_assignments
SELECT
  'resume_design_assignments' as table_name,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'resume_design_assignments';

-- Check RLS policies for chat_messages
SELECT
  'chat_messages' as table_name,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'chat_messages';

-- Check RLS policies for chat_sessions
SELECT
  'chat_sessions' as table_name,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'chat_sessions';

-- ============================================================================
-- Check for Missing Columns (Known Issues)
-- ============================================================================

-- Check if job_descriptions has parsed_data (not extracted_data)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_descriptions' AND column_name = 'parsed_data'
  ) THEN
    RAISE NOTICE 'SUCCESS: job_descriptions.parsed_data exists';
  ELSE
    RAISE WARNING 'MISSING: job_descriptions.parsed_data does not exist';

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'job_descriptions' AND column_name = 'extracted_data'
    ) THEN
      RAISE NOTICE 'INFO: job_descriptions.extracted_data exists (should be renamed to parsed_data)';
    END IF;
  END IF;

  -- Check if design_customizations has spacing (not spacing_settings)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'design_customizations' AND column_name = 'spacing'
  ) THEN
    RAISE NOTICE 'SUCCESS: design_customizations.spacing exists';
  ELSE
    RAISE WARNING 'MISSING: design_customizations.spacing does not exist';

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'design_customizations' AND column_name = 'spacing_settings'
    ) THEN
      RAISE NOTICE 'INFO: design_customizations.spacing_settings exists (should be renamed to spacing)';
    END IF;
  END IF;
END $$;
