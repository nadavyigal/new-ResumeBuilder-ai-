-- =====================================================
-- Migration: Database Health Diagnostics
-- Date: 2025-12-10
-- Description:
--   Diagnostic queries to check database health.
--   Run these queries manually to verify database state.
-- =====================================================

-- NOTE: These are SELECT queries for diagnostics only.
-- They will not modify any data. Run them in Supabase SQL Editor.

-- =====================================================
-- DIAGNOSTIC 1: Check RLS Status on All Tables
-- =====================================================
-- Expected: All public tables should have rowsecurity = true

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== RLS STATUS CHECK ===';
  RAISE NOTICE 'Tables without RLS enabled:';
END $$;

SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = false
ORDER BY tablename;

-- =====================================================
-- DIAGNOSTIC 2: Check for Missing Indexes on Foreign Keys
-- =====================================================
-- Expected: All foreign keys should have indexes for performance

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== FOREIGN KEY INDEX CHECK ===';
  RAISE NOTICE 'Foreign keys without indexes:';
END $$;

SELECT DISTINCT
  tc.table_name,
  kcu.column_name,
  'CREATE INDEX IF NOT EXISTS idx_' || tc.table_name || '_' || kcu.column_name ||
  ' ON ' || tc.table_name || '(' || kcu.column_name || ');' as suggested_index
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = tc.table_name
      AND indexdef LIKE '%' || kcu.column_name || '%'
  )
ORDER BY tc.table_name, kcu.column_name;

-- =====================================================
-- DIAGNOSTIC 3: Check for Orphaned Data
-- =====================================================
-- Expected: No orphaned records (foreign keys pointing to deleted records)

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== ORPHANED DATA CHECK ===';
END $$;

-- Check optimizations with missing resumes
SELECT COUNT(*) as orphaned_optimizations,
       'optimizations referencing deleted resumes' as issue
FROM optimizations o
WHERE NOT EXISTS (SELECT 1 FROM resumes WHERE id = o.resume_id);

-- Check optimizations with missing job descriptions
SELECT COUNT(*) as orphaned_optimizations,
       'optimizations referencing deleted job_descriptions' as issue
FROM optimizations o
WHERE NOT EXISTS (SELECT 1 FROM job_descriptions WHERE id = o.jd_id);

-- Check chat_sessions with missing optimizations
SELECT COUNT(*) as orphaned_chat_sessions,
       'chat_sessions referencing deleted optimizations' as issue
FROM chat_sessions cs
WHERE NOT EXISTS (SELECT 1 FROM optimizations WHERE id = cs.optimization_id);

-- Check resume_design_assignments with missing optimizations
SELECT COUNT(*) as orphaned_design_assignments,
       'resume_design_assignments referencing deleted optimizations' as issue
FROM resume_design_assignments rda
WHERE NOT EXISTS (SELECT 1 FROM optimizations WHERE id = rda.optimization_id);

-- =====================================================
-- DIAGNOSTIC 4: Check Table Row Counts
-- =====================================================
-- Expected: Reasonable data distribution

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== TABLE ROW COUNTS ===';
END $$;

SELECT
  'profiles' as table_name,
  COUNT(*) as row_count
FROM profiles
UNION ALL
SELECT 'resumes', COUNT(*) FROM resumes
UNION ALL
SELECT 'job_descriptions', COUNT(*) FROM job_descriptions
UNION ALL
SELECT 'optimizations', COUNT(*) FROM optimizations
UNION ALL
SELECT 'templates', COUNT(*) FROM templates
UNION ALL
SELECT 'events', COUNT(*) FROM events
UNION ALL
SELECT 'chat_sessions', COUNT(*) FROM chat_sessions
UNION ALL
SELECT 'chat_messages', COUNT(*) FROM chat_messages
UNION ALL
SELECT 'resume_versions', COUNT(*) FROM resume_versions
UNION ALL
SELECT 'amendment_requests', COUNT(*) FROM amendment_requests
UNION ALL
SELECT 'design_templates', COUNT(*) FROM design_templates
UNION ALL
SELECT 'design_customizations', COUNT(*) FROM design_customizations
UNION ALL
SELECT 'resume_design_assignments', COUNT(*) FROM resume_design_assignments
UNION ALL
SELECT 'applications', COUNT(*) FROM applications
ORDER BY table_name;

-- =====================================================
-- DIAGNOSTIC 5: Check Optimization Quota Usage
-- =====================================================
-- Expected: No users should exceed their limit

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== OPTIMIZATION QUOTA CHECK ===';
  RAISE NOTICE 'Users who have exceeded their quota:';
END $$;

SELECT
  user_id,
  optimizations_used,
  max_optimizations,
  (optimizations_used - max_optimizations) as over_limit_by
FROM profiles
WHERE optimizations_used > max_optimizations
ORDER BY over_limit_by DESC;

-- =====================================================
-- DIAGNOSTIC 6: Check for Duplicate Design Assignment Table
-- =====================================================
-- Expected: design_assignments table should NOT exist after migration

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== DUPLICATE TABLE CHECK ===';
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'design_assignments'
  ) THEN
    RAISE WARNING 'design_assignments table still exists! Should be dropped.';
  ELSE
    RAISE NOTICE 'design_assignments table correctly removed.';
  END IF;
END $$;

-- =====================================================
-- DIAGNOSTIC 7: Storage Bucket Health
-- =====================================================
-- Expected: Buckets exist with proper policies

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== STORAGE BUCKET CHECK ===';
END $$;

SELECT
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
WHERE name IN ('resume-uploads', 'resume-exports')
ORDER BY name;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Database diagnostics completed!';
  RAISE NOTICE 'Review the output above for any issues.';
  RAISE NOTICE '===========================================';
END $$;
