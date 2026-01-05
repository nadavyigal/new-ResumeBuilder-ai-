-- Migration: Verify and document RLS policies
-- Purpose: Ensure Row Level Security is enabled on all tables
-- Created: 2025-01-24
-- NOTE: This is a verification script. Run this to check current RLS status.

-- ==================== CHECK RLS STATUS ====================

-- Query to check if RLS is enabled on all critical tables
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM
  pg_tables
WHERE
  schemaname = 'public'
  AND tablename IN ('profiles', 'resumes', 'job_descriptions', 'optimizations', 'templates', 'events')
ORDER BY
  tablename;

-- ==================== LIST ALL RLS POLICIES ====================

-- Query to list all RLS policies for our tables
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM
  pg_policies
WHERE
  schemaname = 'public'
  AND tablename IN ('profiles', 'resumes', 'job_descriptions', 'optimizations', 'templates', 'events')
ORDER BY
  tablename, policyname;

-- ==================== ENABLE RLS IF NOT ENABLED ====================

-- Ensure RLS is enabled on all critical tables
-- These statements are idempotent (safe to run multiple times)

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_descriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE optimizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- ==================== BASIC RLS POLICIES ====================
-- These are baseline policies. Adjust based on your requirements.

-- PROFILES: Users can only see their own profile
DO $$
BEGIN
  -- Drop existing policy if it exists
  DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
  DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

  -- Create policies
  CREATE POLICY "Users can view their own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = user_id);

  CREATE POLICY "Users can update their own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- RESUMES: Users can only access their own resumes
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view their own resumes" ON resumes;
  DROP POLICY IF EXISTS "Users can insert their own resumes" ON resumes;
  DROP POLICY IF EXISTS "Users can delete their own resumes" ON resumes;

  CREATE POLICY "Users can view their own resumes"
    ON resumes FOR SELECT
    USING (auth.uid() = user_id);

  CREATE POLICY "Users can insert their own resumes"
    ON resumes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

  CREATE POLICY "Users can delete their own resumes"
    ON resumes FOR DELETE
    USING (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- JOB_DESCRIPTIONS: Users can only access their own job descriptions
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view their own job descriptions" ON job_descriptions;
  DROP POLICY IF EXISTS "Users can insert their own job descriptions" ON job_descriptions;
  DROP POLICY IF EXISTS "Users can delete their own job descriptions" ON job_descriptions;

  CREATE POLICY "Users can view their own job descriptions"
    ON job_descriptions FOR SELECT
    USING (auth.uid() = user_id);

  CREATE POLICY "Users can insert their own job descriptions"
    ON job_descriptions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

  CREATE POLICY "Users can delete their own job descriptions"
    ON job_descriptions FOR DELETE
    USING (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- OPTIMIZATIONS: Users can only access their own optimizations
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view their own optimizations" ON optimizations;
  DROP POLICY IF EXISTS "Users can insert their own optimizations" ON optimizations;
  DROP POLICY IF EXISTS "Users can delete their own optimizations" ON optimizations;

  CREATE POLICY "Users can view their own optimizations"
    ON optimizations FOR SELECT
    USING (auth.uid() = user_id);

  CREATE POLICY "Users can insert their own optimizations"
    ON optimizations FOR INSERT
    WITH CHECK (auth.uid() = user_id);

  CREATE POLICY "Users can delete their own optimizations"
    ON optimizations FOR DELETE
    USING (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- TEMPLATES: All authenticated users can view templates
DO $$
BEGIN
  DROP POLICY IF EXISTS "Authenticated users can view templates" ON templates;

  CREATE POLICY "Authenticated users can view templates"
    ON templates FOR SELECT
    USING (auth.role() = 'authenticated');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- EVENTS: Users can only view their own events
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view their own events" ON events;
  DROP POLICY IF EXISTS "Users can insert their own events" ON events;

  CREATE POLICY "Users can view their own events"
    ON events FOR SELECT
    USING (auth.uid() = user_id);

  CREATE POLICY "Users can insert their own events"
    ON events FOR INSERT
    WITH CHECK (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ==================== VERIFICATION QUERIES ====================

-- Run these after applying the migration to verify:

-- 1. Check that RLS is enabled
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- 2. Check that policies exist
-- SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';

-- 3. Test that policies work (as a test user)
-- SELECT * FROM optimizations; -- Should only return rows where user_id = auth.uid()
