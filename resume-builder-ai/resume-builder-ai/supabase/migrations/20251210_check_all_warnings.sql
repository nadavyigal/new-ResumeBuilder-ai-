-- =====================================================
-- Complete Database Health Check & Warning Detection
-- Run this in Supabase SQL Editor to see all issues
-- =====================================================

DO $$
DECLARE
    v_result TEXT;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'SUPABASE DATABASE HEALTH CHECK';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;

-- =====================================================
-- 1. CHECK FOR MISSING INDEXES ON FOREIGN KEYS
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '1. MISSING INDEXES ON FOREIGN KEYS';
    RAISE NOTICE '-----------------------------------';
END $$;

SELECT
    tc.table_name,
    kcu.column_name,
    'CREATE INDEX idx_' || tc.table_name || '_' || kcu.column_name ||
    ' ON ' || tc.table_name || '(' || kcu.column_name || ');' as fix_sql
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
            AND tablename = tc.table_name
            AND indexdef LIKE '%' || kcu.column_name || '%'
    )
ORDER BY tc.table_name;

-- =====================================================
-- 2. CHECK FOR TABLES WITHOUT RLS ENABLED
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '2. TABLES WITHOUT RLS ENABLED';
    RAISE NOTICE '-----------------------------------';
END $$;

SELECT
    tablename,
    'ALTER TABLE ' || tablename || ' ENABLE ROW LEVEL SECURITY;' as fix_sql
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename NOT LIKE 'pg_%'
    AND rowsecurity = false
ORDER BY tablename;

-- =====================================================
-- 3. CHECK FOR TABLES WITH RLS BUT NO POLICIES
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '3. TABLES WITH RLS BUT NO POLICIES';
    RAISE NOTICE '-----------------------------------';
END $$;

SELECT
    t.tablename,
    'Table has RLS enabled but no policies - users cannot access data' as warning
FROM pg_tables t
WHERE t.schemaname = 'public'
    AND t.rowsecurity = true
    AND NOT EXISTS (
        SELECT 1 FROM pg_policies p
        WHERE p.schemaname = 'public'
            AND p.tablename = t.tablename
    )
ORDER BY t.tablename;

-- =====================================================
-- 4. CHECK FOR ORPHANED DATA
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '4. ORPHANED DATA CHECK';
    RAISE NOTICE '-----------------------------------';
END $$;

-- Optimizations without resumes
SELECT
    'optimizations' as table_name,
    COUNT(*) as orphaned_count,
    'Optimizations referencing deleted resumes' as issue
FROM optimizations o
WHERE NOT EXISTS (SELECT 1 FROM resumes WHERE id = o.resume_id)
HAVING COUNT(*) > 0

UNION ALL

-- Optimizations without job descriptions
SELECT
    'optimizations' as table_name,
    COUNT(*) as orphaned_count,
    'Optimizations referencing deleted job_descriptions' as issue
FROM optimizations o
WHERE NOT EXISTS (SELECT 1 FROM job_descriptions WHERE id = o.jd_id)
HAVING COUNT(*) > 0

UNION ALL

-- Chat sessions without optimizations
SELECT
    'chat_sessions' as table_name,
    COUNT(*) as orphaned_count,
    'Chat sessions referencing deleted optimizations' as issue
FROM chat_sessions cs
WHERE NOT EXISTS (SELECT 1 FROM optimizations WHERE id = cs.optimization_id)
HAVING COUNT(*) > 0

UNION ALL

-- Design assignments without optimizations
SELECT
    'resume_design_assignments' as table_name,
    COUNT(*) as orphaned_count,
    'Design assignments referencing deleted optimizations' as issue
FROM resume_design_assignments rda
WHERE NOT EXISTS (SELECT 1 FROM optimizations WHERE id = rda.optimization_id)
HAVING COUNT(*) > 0;

-- =====================================================
-- 5. CHECK FOR DUPLICATE OR CONFLICTING TRIGGERS
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '5. TRIGGER ANALYSIS';
    RAISE NOTICE '-----------------------------------';
END $$;

SELECT
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    tgenabled as enabled,
    pg_get_triggerdef(oid) as definition
FROM pg_trigger
WHERE tgrelid::regclass::text IN (
    'profiles', 'optimizations', 'chat_sessions',
    'resume_design_assignments', 'design_customizations'
)
    AND NOT tgisinternal
ORDER BY tgrelid::regclass, tgname;

-- =====================================================
-- 6. CHECK FOR CONSTRAINT VIOLATIONS
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '6. CONSTRAINT VIOLATIONS';
    RAISE NOTICE '-----------------------------------';
END $$;

-- Check optimization quota violations
SELECT
    'profiles' as table_name,
    user_id,
    optimizations_used,
    max_optimizations,
    (optimizations_used - max_optimizations) as over_by
FROM profiles
WHERE optimizations_used > max_optimizations
ORDER BY over_by DESC;

-- =====================================================
-- 7. CHECK FOR UNUSED OR EXPERIMENTAL TABLES
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '7. EXPERIMENTAL/DUPLICATE TABLES';
    RAISE NOTICE '-----------------------------------';
END $$;

SELECT
    tablename,
    'Experimental table - should be dropped' as warning
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename = 'design_assignments'

UNION ALL

SELECT
    tablename,
    'Check if this table is still needed' as warning
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN ('ai_threads', 'content_modifications', 'style_history')
    AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = tablename
            AND constraint_type = 'FOREIGN KEY'
    );

-- =====================================================
-- 8. CHECK STORAGE CONFIGURATION
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '8. STORAGE BUCKET CONFIGURATION';
    RAISE NOTICE '-----------------------------------';
END $$;

SELECT
    id,
    name,
    public as is_public,
    file_size_limit / 1024 / 1024 as size_limit_mb,
    allowed_mime_types,
    CASE
        WHEN file_size_limit IS NULL THEN 'WARNING: No size limit set'
        WHEN file_size_limit > 10485760 THEN 'INFO: Size limit > 10MB'
        ELSE 'OK'
    END as status
FROM storage.buckets
WHERE name IN ('resume-uploads', 'resume-exports')
ORDER BY name;

-- =====================================================
-- 9. CHECK FOR SLOW QUERIES (MISSING INDEXES)
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '9. POTENTIAL SLOW QUERY PATTERNS';
    RAISE NOTICE '-----------------------------------';
END $$;

-- Check for large tables without indexes on commonly queried columns
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
    'Consider adding index on user_id' as recommendation
FROM pg_tables t
WHERE schemaname = 'public'
    AND tablename IN ('optimizations', 'resumes', 'job_descriptions', 'chat_sessions')
    AND NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
            AND tablename = t.tablename
            AND indexdef LIKE '%user_id%'
    );

-- =====================================================
-- 10. DATABASE STATISTICS SUMMARY
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '10. DATABASE STATISTICS';
    RAISE NOTICE '-----------------------------------';
END $$;

SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
    n_live_tup as row_count,
    n_dead_tup as dead_rows,
    CASE
        WHEN n_live_tup > 0
        THEN ROUND(100.0 * n_dead_tup / n_live_tup, 2)
        ELSE 0
    END as dead_row_percent
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;

-- =====================================================
-- SUMMARY
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'HEALTH CHECK COMPLETE';
    RAISE NOTICE 'Review output above for any warnings';
    RAISE NOTICE '========================================';
END $$;
