-- =====================================================
-- SUPABASE SECURITY AND CONFIGURATION AUDIT
-- Date: 2025-11-10
-- Purpose: Comprehensive check of RLS, policies, and schema
-- =====================================================

\echo '=================================================='
\echo 'SECTION 1: RLS STATUS CHECK'
\echo '=================================================='

-- Check RLS status for all core tables
SELECT
  schemaname,
  tablename,
  CASE
    WHEN rowsecurity THEN '✅ ENABLED'
    ELSE '❌ DISABLED'
  END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles',
    'resumes',
    'job_descriptions',
    'optimizations',
    'templates',
    'design_templates',
    'design_customizations',
    'resume_design_assignments',
    'chat_sessions',
    'chat_messages',
    'resume_versions',
    'amendment_requests',
    'applications'
  )
ORDER BY tablename;

\echo ''
\echo '=================================================='
\echo 'SECTION 2: RLS POLICIES COUNT'
\echo '=================================================='

-- Count policies per table
SELECT
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

\echo ''
\echo '=================================================='
\echo 'SECTION 3: DETAILED RLS POLICIES'
\echo '=================================================='

-- List all RLS policies with details
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_clause,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

\echo ''
\echo '=================================================='
\echo 'SECTION 4: TABLES WITHOUT RLS POLICIES'
\echo '=================================================='

-- Find tables with RLS enabled but no policies (security risk!)
SELECT
  t.tablename,
  '⚠️ RLS enabled but NO POLICIES defined' as warning
FROM pg_tables t
WHERE t.schemaname = 'public'
  AND t.rowsecurity = true
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = t.schemaname
    AND p.tablename = t.tablename
  )
ORDER BY t.tablename;

\echo ''
\echo '=================================================='
\echo 'SECTION 5: COLUMN VERIFICATION'
\echo '=================================================='

-- Check critical columns that were renamed
\echo 'Checking job_descriptions columns...'
SELECT
  column_name,
  data_type,
  CASE
    WHEN column_name IN ('parsed_data', 'extracted_data') THEN '✅ VERIFIED'
    ELSE ''
  END as status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'job_descriptions'
  AND column_name IN ('parsed_data', 'extracted_data');

\echo ''
\echo 'Checking design_customizations columns...'
SELECT
  column_name,
  data_type,
  CASE
    WHEN column_name IN ('spacing', 'spacing_settings') THEN '✅ VERIFIED'
    ELSE ''
  END as status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'design_customizations'
  AND column_name IN ('spacing', 'spacing_settings');

\echo ''
\echo 'Checking optimizations columns...'
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'optimizations'
  AND column_name IN (
    'optimization_data',
    'rewrite_data',
    'ats_score',
    'ats_score_optimized'
  )
ORDER BY column_name;

\echo ''
\echo '=================================================='
\echo 'SECTION 6: FOREIGN KEY CONSTRAINTS'
\echo '=================================================='

-- List all foreign key constraints
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

\echo ''
\echo '=================================================='
\echo 'SECTION 7: UNIQUE CONSTRAINTS'
\echo '=================================================='

-- Check unique constraints (prevent duplicate data)
SELECT
  tc.table_name,
  kcu.column_name,
  tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'UNIQUE'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

\echo ''
\echo '=================================================='
\echo 'SECTION 8: INDEXES FOR PERFORMANCE'
\echo '=================================================='

-- List all indexes on core tables
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles',
    'resumes',
    'job_descriptions',
    'optimizations',
    'chat_sessions',
    'chat_messages',
    'design_templates',
    'design_customizations',
    'resume_design_assignments',
    'applications'
  )
ORDER BY tablename, indexname;

\echo ''
\echo '=================================================='
\echo 'SECTION 9: DATABASE FUNCTIONS'
\echo '=================================================='

-- List custom functions
SELECT
  n.nspname as schema,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  CASE
    WHEN p.prosecdef THEN 'SECURITY DEFINER'
    ELSE 'SECURITY INVOKER'
  END as security_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prokind = 'f'
ORDER BY p.proname;

\echo ''
\echo '=================================================='
\echo 'SECTION 10: STORAGE BUCKETS'
\echo '=================================================='

-- Check storage buckets configuration
SELECT
  id,
  name,
  public,
  CASE
    WHEN public THEN '⚠️ PUBLIC ACCESS'
    ELSE '✅ PRIVATE'
  END as access_status,
  created_at
FROM storage.buckets
ORDER BY name;

\echo ''
\echo '=================================================='
\echo 'SECTION 11: AUTH CONFIGURATION'
\echo '=================================================='

-- Check auth triggers
SELECT
  trigger_name,
  event_object_table,
  action_statement,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table IN ('profiles')
  OR trigger_name LIKE '%auth%'
ORDER BY trigger_name;

\echo ''
\echo '=================================================='
\echo 'SECTION 12: POTENTIAL SECURITY ISSUES'
\echo '=================================================='

\echo 'Checking for common security issues...'

-- Issue 1: Tables without user_id column (can't enforce user isolation)
\echo ''
\echo 'Issue 1: Tables without user_id column for RLS'
SELECT
  t.tablename,
  '⚠️ No user_id column - may be intentional' as potential_issue
FROM pg_tables t
WHERE t.schemaname = 'public'
  AND t.rowsecurity = true
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = t.tablename
      AND c.column_name = 'user_id'
  )
  AND t.tablename NOT IN ('templates', 'design_templates')
ORDER BY t.tablename;

-- Issue 2: JSONB columns without validation
\echo ''
\echo 'Issue 2: JSONB columns (ensure data validation in application)'
SELECT
  table_name,
  column_name,
  'ℹ️ Ensure application validates JSONB data' as note
FROM information_schema.columns
WHERE table_schema = 'public'
  AND data_type = 'jsonb'
ORDER BY table_name, column_name;

-- Issue 3: Nullable foreign keys (orphaned records possible)
\echo ''
\echo 'Issue 3: Nullable foreign key columns'
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  'ℹ️ Nullable FK - orphaned records possible' as note
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.columns AS c
  ON c.table_name = tc.table_name
  AND c.column_name = kcu.column_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND c.is_nullable = 'YES'
ORDER BY tc.table_name, kcu.column_name;

\echo ''
\echo '=================================================='
\echo 'AUDIT COMPLETE'
\echo '=================================================='
\echo ''
\echo 'Next steps:'
\echo '1. Review any ❌ DISABLED RLS tables'
\echo '2. Check tables with RLS but no policies'
\echo '3. Verify column names match code expectations'
\echo '4. Address any ⚠️ warnings based on your security requirements'
\echo ''
