-- =====================================================
-- Migration: Add Performance Indexes
-- Date: 2025-12-10
-- Description:
--   Add missing indexes for commonly queried columns
--   to improve query performance. All use IF NOT EXISTS
--   to be idempotent.
-- =====================================================

-- =====================================================
-- OPTIMIZATION QUERIES
-- =====================================================

-- Index for user-specific optimization queries sorted by date
CREATE INDEX IF NOT EXISTS idx_optimizations_user_created
  ON optimizations(user_id, created_at DESC);

COMMENT ON INDEX idx_optimizations_user_created IS
  'Optimizes queries fetching user optimizations sorted by date';

-- Index for optimization status queries
CREATE INDEX IF NOT EXISTS idx_optimizations_status
  ON optimizations(status)
  WHERE status != 'completed';

COMMENT ON INDEX idx_optimizations_status IS
  'Optimizes queries for processing/failed optimizations (partial index)';

-- =====================================================
-- CHAT QUERIES
-- =====================================================

-- Index for chat session lookups by optimization
CREATE INDEX IF NOT EXISTS idx_chat_sessions_optimization
  ON chat_sessions(optimization_id);

COMMENT ON INDEX idx_chat_sessions_optimization IS
  'Optimizes lookups for chat sessions related to an optimization';

-- Index for active chat session queries
CREATE INDEX IF NOT EXISTS idx_chat_sessions_active
  ON chat_sessions(user_id, is_active)
  WHERE is_active = true;

COMMENT ON INDEX idx_chat_sessions_active IS
  'Optimizes queries for active chat sessions (partial index)';

-- Index for chat messages by session, sorted by time
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_time
  ON chat_messages(session_id, created_at ASC);

COMMENT ON INDEX idx_chat_messages_session_time IS
  'Optimizes fetching chat message history in chronological order';

-- =====================================================
-- DESIGN QUERIES
-- =====================================================

-- Index for design assignment lookups by optimization
CREATE INDEX IF NOT EXISTS idx_resume_design_assignments_optimization
  ON resume_design_assignments(optimization_id);

COMMENT ON INDEX idx_resume_design_assignments_optimization IS
  'Optimizes lookups for design assignments by optimization';

-- Index for active design assignments
CREATE INDEX IF NOT EXISTS idx_resume_design_assignments_active
  ON resume_design_assignments(user_id, is_active)
  WHERE is_active = true;

COMMENT ON INDEX idx_resume_design_assignments_active IS
  'Optimizes queries for active design assignments (partial index)';

-- Index for design customization lookups
CREATE INDEX IF NOT EXISTS idx_design_customizations_user
  ON design_customizations(user_id, created_at DESC);

COMMENT ON INDEX idx_design_customizations_user IS
  'Optimizes fetching user design customizations sorted by date';

-- =====================================================
-- RESUME & JOB DESCRIPTION QUERIES
-- =====================================================

-- Index for resume lookups by user and date
CREATE INDEX IF NOT EXISTS idx_resumes_user_created
  ON resumes(user_id, created_at DESC);

COMMENT ON INDEX idx_resumes_user_created IS
  'Optimizes fetching user resumes sorted by date';

-- Index for job description lookups by user and date
CREATE INDEX IF NOT EXISTS idx_job_descriptions_user_created
  ON job_descriptions(user_id, created_at DESC);

COMMENT ON INDEX idx_job_descriptions_user_created IS
  'Optimizes fetching user job descriptions sorted by date';

-- =====================================================
-- APPLICATION TRACKING QUERIES
-- =====================================================

-- Index for application lookups by optimization
CREATE INDEX IF NOT EXISTS idx_applications_optimization
  ON applications(optimization_id)
  WHERE optimization_id IS NOT NULL;

COMMENT ON INDEX idx_applications_optimization IS
  'Optimizes lookups for applications linked to optimizations (partial index)';

-- Index for application source URL lookups
CREATE INDEX IF NOT EXISTS idx_applications_source_url
  ON applications(source_url)
  WHERE source_url IS NOT NULL;

COMMENT ON INDEX idx_applications_source_url IS
  'Optimizes lookups by job posting URL (partial index)';

-- =====================================================
-- EVENTS & ANALYTICS
-- =====================================================

-- Index for event queries by user and type
CREATE INDEX IF NOT EXISTS idx_events_user_type
  ON events(user_id, event_type, created_at DESC);

COMMENT ON INDEX idx_events_user_type IS
  'Optimizes analytics queries for user events by type';

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Performance indexes created successfully!';
  RAISE NOTICE 'Query performance should be improved.';
  RAISE NOTICE '===========================================';
END $$;
