-- Migration: Fix 406 errors by adding unique constraints
-- Date: 2025-10-21
-- Purpose: Prevent duplicate rows that cause "Cannot coerce to single JSON object" errors

-- ============================================================================
-- Fix #1: Ensure only one active chat session per user+optimization
-- ============================================================================

-- Drop existing index if it exists
DROP INDEX IF EXISTS idx_chat_sessions_active_unique;

-- Create partial unique index for active sessions
CREATE UNIQUE INDEX idx_chat_sessions_active_unique
ON chat_sessions(user_id, optimization_id)
WHERE status = 'active';

COMMENT ON INDEX idx_chat_sessions_active_unique IS
  'Ensures only one active chat session per user+optimization pair';

-- ============================================================================
-- Fix #2: Ensure unique version numbers per optimization
-- ============================================================================

-- Add unique constraint on (optimization_id, version_number)
ALTER TABLE resume_versions
DROP CONSTRAINT IF EXISTS resume_versions_optimization_version_unique;

ALTER TABLE resume_versions
ADD CONSTRAINT resume_versions_optimization_version_unique
UNIQUE (optimization_id, version_number);

COMMENT ON CONSTRAINT resume_versions_optimization_version_unique
ON resume_versions IS
  'Ensures unique version numbers per optimization (prevents duplicate versions)';

-- ============================================================================
-- Fix #3: Add composite index for faster user+optimization queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_resume_design_assignments_user_optimization
ON resume_design_assignments(user_id, optimization_id);

COMMENT ON INDEX idx_resume_design_assignments_user_optimization IS
  'Speeds up queries filtering by both user_id and optimization_id';

-- ============================================================================
-- Data Cleanup: Remove any duplicate rows before constraints take effect
-- ============================================================================

-- Clean up duplicate active chat sessions (keep the most recent)
WITH duplicates AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, optimization_id
           ORDER BY last_activity_at DESC, created_at DESC
         ) as rn
  FROM chat_sessions
  WHERE status = 'active'
)
UPDATE chat_sessions
SET status = 'closed',
    updated_at = NOW()
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Clean up duplicate resume versions (keep the highest version number)
WITH duplicate_versions AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY optimization_id, version_number
           ORDER BY created_at DESC
         ) as rn
  FROM resume_versions
)
DELETE FROM resume_versions
WHERE id IN (
  SELECT id FROM duplicate_versions WHERE rn > 1
);

-- Clean up duplicate design assignments (keep the most recent)
WITH duplicate_assignments AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY optimization_id
           ORDER BY updated_at DESC, created_at DESC
         ) as rn
  FROM resume_design_assignments
)
DELETE FROM resume_design_assignments
WHERE id IN (
  SELECT id FROM duplicate_assignments WHERE rn > 1
);

-- ============================================================================
-- Migration Complete
-- ============================================================================
