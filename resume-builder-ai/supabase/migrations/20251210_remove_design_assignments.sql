-- =====================================================
-- Migration: Remove experimental design_assignments table
-- Date: 2025-12-10
-- Description:
--   Remove the experimental design_assignments table that was
--   created but only used once. The primary table resume_design_assignments
--   is used throughout the application (13+ instances).
-- =====================================================

-- Drop the experimental table if it exists
DROP TABLE IF EXISTS design_assignments CASCADE;

-- Add comment to document the change
COMMENT ON TABLE resume_design_assignments IS
  'Primary table for resume design assignments. The experimental design_assignments table was removed in migration 20251210.';
