-- Migration: Add Simplified design_assignments Table
-- Feature: 008-optimization-page-improvements (AI Color Customization)
-- Date: 2025-11-10
-- Reference: specs/008-optimization-page-improvements/data-model.md
--
-- Purpose: Create simplified design_assignments table for storing color/font customizations
-- per optimization. This is separate from resume_design_assignments which handles full templates.

-- ============================================================================
-- Create design_assignments Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS design_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  optimization_id UUID NOT NULL UNIQUE REFERENCES optimizations(id) ON DELETE CASCADE,
  template_id UUID REFERENCES design_templates(id) ON DELETE SET NULL,
  customization JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE UNIQUE INDEX idx_design_assignments_optimization_id
  ON design_assignments(optimization_id);

CREATE INDEX idx_design_assignments_user_id
  ON design_assignments(user_id);

CREATE INDEX idx_design_assignments_template_id
  ON design_assignments(template_id);

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE design_assignments ENABLE ROW LEVEL SECURITY;

-- Users can view their own design assignments
CREATE POLICY "Users can view own design assignments"
  ON design_assignments
  FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own design assignments
CREATE POLICY "Users can insert own design assignments"
  ON design_assignments
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own design assignments
CREATE POLICY "Users can update own design assignments"
  ON design_assignments
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own design assignments
CREATE POLICY "Users can delete own design assignments"
  ON design_assignments
  FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================================
-- Triggers
-- ============================================================================

-- Update updated_at on row update
CREATE TRIGGER update_design_assignments_updated_at
  BEFORE UPDATE ON design_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Grants
-- ============================================================================

GRANT ALL ON design_assignments TO authenticated;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE design_assignments IS 'Stores color/font customizations for optimizations (Spec 008)';
COMMENT ON COLUMN design_assignments.customization IS 'JSONB storing colors, fonts, spacing: {"colors": {"background": "#fff", "primary": "#000"}, "fonts": {"heading": "Arial"}}';

-- ============================================================================
-- Migration Complete
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ design_assignments table created successfully';
  RAISE NOTICE '✅ RLS policies enabled for design_assignments';
  RAISE NOTICE '✅ Ready for AI color customization feature (Spec 008)';
END $$;
