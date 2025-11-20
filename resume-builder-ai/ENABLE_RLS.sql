-- =====================================================
-- Enable Row Level Security (RLS) on all core tables
-- Date: 2025-11-09
-- Issue: RLS is currently disabled, allowing public access
-- =====================================================

-- Enable RLS on all core tables
ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS job_descriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS optimizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS design_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS design_customizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS resume_design_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS resume_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS amendment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS applications ENABLE ROW LEVEL SECURITY;

-- Verification
DO $$
DECLARE
  tbl text;
  rls_enabled boolean;
BEGIN
  RAISE NOTICE '=== RLS STATUS CHECK ===';

  FOR tbl IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename IN (
      'profiles', 'resumes', 'job_descriptions', 'optimizations',
      'templates', 'design_templates', 'design_customizations',
      'resume_design_assignments', 'chat_sessions', 'chat_messages',
      'resume_versions', 'amendment_requests', 'applications'
    )
  LOOP
    SELECT relrowsecurity INTO rls_enabled
    FROM pg_class
    WHERE relname = tbl AND relnamespace = 'public'::regnamespace;

    IF rls_enabled THEN
      RAISE NOTICE '✅ %: RLS enabled', tbl;
    ELSE
      RAISE NOTICE '❌ %: RLS disabled', tbl;
    END IF;
  END LOOP;

  RAISE NOTICE '========================';
END $$;

-- Note: RLS policies should already exist from previous migrations
-- This script only enables RLS enforcement
-- If policies are missing, they need to be created separately
