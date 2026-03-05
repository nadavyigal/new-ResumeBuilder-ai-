-- Migration: Add Design Selection Tables
-- Feature: 003-i-want-to (AI-Powered Resume Design Selection)
-- Date: 2025-10-08
-- Reference: specs/003-i-want-to/data-model.md

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Table: design_templates
-- Stores available resume design templates from external library
-- ============================================================================

CREATE TABLE design_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  category VARCHAR(50) NOT NULL CHECK (category IN ('modern', 'traditional', 'creative', 'corporate')),
  description TEXT NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  preview_thumbnail_url TEXT,
  is_premium BOOLEAN NOT NULL DEFAULT false,
  ats_compatibility_score INTEGER NOT NULL DEFAULT 100 CHECK (ats_compatibility_score BETWEEN 0 AND 100),
  supported_customizations JSONB NOT NULL DEFAULT '{
    "colors": true,
    "fonts": true,
    "layout": true
  }'::jsonb,
  default_config JSONB NOT NULL DEFAULT '{
    "color_scheme": {
      "primary": "#2563eb",
      "secondary": "#64748b",
      "accent": "#0ea5e9"
    },
    "font_family": {
      "headings": "Arial",
      "body": "Arial"
    },
    "spacing_settings": {
      "compact": false,
      "lineHeight": 1.5
    }
  }'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for design_templates
CREATE INDEX idx_design_templates_category ON design_templates(category);
CREATE INDEX idx_design_templates_slug ON design_templates(slug);
CREATE INDEX idx_design_templates_premium ON design_templates(is_premium);

-- ============================================================================
-- Table: design_customizations
-- Stores user-specific design modifications to base templates
-- ============================================================================

CREATE TABLE design_customizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES design_templates(id) ON DELETE CASCADE,
  color_scheme JSONB NOT NULL DEFAULT '{
    "primary": "#2563eb",
    "secondary": "#64748b",
    "accent": "#0ea5e9"
  }'::jsonb,
  font_family JSONB NOT NULL DEFAULT '{
    "headings": "Arial",
    "body": "Arial"
  }'::jsonb,
  spacing_settings JSONB NOT NULL DEFAULT '{
    "compact": false,
    "lineHeight": 1.5
  }'::jsonb,
  layout_variant VARCHAR(100),
  custom_css TEXT,
  is_ats_safe BOOLEAN NOT NULL DEFAULT true,
  ats_validation_errors JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for design_customizations
CREATE INDEX idx_design_customizations_template ON design_customizations(template_id);
CREATE INDEX idx_design_customizations_ats_safe ON design_customizations(is_ats_safe);

-- ============================================================================
-- Table: resume_design_assignments
-- Links optimizations to design templates with customizations (1:1 relationship)
-- ============================================================================

CREATE TABLE resume_design_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  optimization_id UUID NOT NULL UNIQUE REFERENCES optimizations(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES design_templates(id) ON DELETE RESTRICT,
  customization_id UUID REFERENCES design_customizations(id) ON DELETE SET NULL,
  previous_customization_id UUID REFERENCES design_customizations(id) ON DELETE SET NULL,
  original_template_id UUID NOT NULL REFERENCES design_templates(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  finalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for resume_design_assignments
CREATE UNIQUE INDEX idx_resume_design_assignments_optimization ON resume_design_assignments(optimization_id);
CREATE INDEX idx_resume_design_assignments_user ON resume_design_assignments(user_id);
CREATE INDEX idx_resume_design_assignments_template ON resume_design_assignments(template_id);
CREATE INDEX idx_resume_design_assignments_finalized ON resume_design_assignments(finalized_at);

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE design_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_customizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE resume_design_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for design_templates
-- All authenticated users can read templates (FR-023: available to all tiers)
CREATE POLICY "Templates are viewable by all authenticated users"
  ON design_templates
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only service role can insert/update templates (admin operation)
CREATE POLICY "Templates are manageable by service role only"
  ON design_templates
  FOR ALL
  USING (auth.role() = 'service_role');

-- RLS Policies for design_customizations
-- Users can read customizations linked to their resume_design_assignments
CREATE POLICY "Customizations viewable by assignment owner"
  ON design_customizations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM resume_design_assignments rda
      WHERE rda.customization_id = design_customizations.id
        AND rda.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM resume_design_assignments rda
      WHERE rda.previous_customization_id = design_customizations.id
        AND rda.user_id = auth.uid()
    )
  );

-- Users can insert customizations (via design customization flow)
CREATE POLICY "Customizations insertable by authenticated users"
  ON design_customizations
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Users cannot update/delete customizations (immutable after creation)

-- RLS Policies for resume_design_assignments
-- Users can only view their own assignments
CREATE POLICY "Assignments viewable by owner"
  ON resume_design_assignments
  FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own assignments
CREATE POLICY "Assignments insertable by owner"
  ON resume_design_assignments
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own assignments
CREATE POLICY "Assignments updatable by owner"
  ON resume_design_assignments
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- Database Functions
-- ============================================================================

-- Function: assign_recommended_template()
-- Assigns initial AI-recommended template to an optimization
CREATE OR REPLACE FUNCTION assign_recommended_template(
  p_user_id UUID,
  p_optimization_id UUID,
  p_template_id UUID
) RETURNS resume_design_assignments
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_assignment resume_design_assignments;
BEGIN
  -- Validate template exists
  IF NOT EXISTS (SELECT 1 FROM design_templates WHERE id = p_template_id) THEN
    RAISE EXCEPTION 'Template not found: %', p_template_id;
  END IF;

  -- Insert assignment
  INSERT INTO resume_design_assignments (
    user_id,
    optimization_id,
    template_id,
    original_template_id
  ) VALUES (
    p_user_id,
    p_optimization_id,
    p_template_id,
    p_template_id
  )
  RETURNING * INTO v_assignment;

  RETURN v_assignment;
END;
$$;

-- Function: apply_design_customization()
-- Applies a new customization to an assignment (stores previous for undo)
CREATE OR REPLACE FUNCTION apply_design_customization(
  p_assignment_id UUID,
  p_new_customization_id UUID
) RETURNS resume_design_assignments
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_assignment resume_design_assignments;
  v_current_customization_id UUID;
BEGIN
  -- Get current assignment
  SELECT * INTO v_assignment FROM resume_design_assignments WHERE id = p_assignment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assignment not found: %', p_assignment_id;
  END IF;

  -- Store current customization as previous (for undo)
  v_current_customization_id := v_assignment.customization_id;

  -- Update assignment
  UPDATE resume_design_assignments
  SET
    customization_id = p_new_customization_id,
    previous_customization_id = v_current_customization_id,
    updated_at = NOW()
  WHERE id = p_assignment_id
  RETURNING * INTO v_assignment;

  RETURN v_assignment;
END;
$$;

-- Function: undo_design_change()
-- Reverts to previous customization (single-level undo)
CREATE OR REPLACE FUNCTION undo_design_change(
  p_assignment_id UUID
) RETURNS resume_design_assignments
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_assignment resume_design_assignments;
  v_temp_id UUID;
BEGIN
  -- Get current assignment
  SELECT * INTO v_assignment FROM resume_design_assignments WHERE id = p_assignment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assignment not found: %', p_assignment_id;
  END IF;

  -- Swap current and previous customizations
  v_temp_id := v_assignment.customization_id;

  UPDATE resume_design_assignments
  SET
    customization_id = previous_customization_id,
    previous_customization_id = v_temp_id,
    updated_at = NOW()
  WHERE id = p_assignment_id
  RETURNING * INTO v_assignment;

  RETURN v_assignment;
END;
$$;

-- ============================================================================
-- Triggers
-- ============================================================================

-- Create trigger function for updated_at if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on design_templates
CREATE TRIGGER update_design_templates_updated_at
  BEFORE UPDATE ON design_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update updated_at on resume_design_assignments
CREATE TRIGGER update_resume_design_assignments_updated_at
  BEFORE UPDATE ON resume_design_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Grants
-- ============================================================================

GRANT SELECT ON design_templates TO authenticated;
GRANT ALL ON design_customizations TO authenticated;
GRANT ALL ON resume_design_assignments TO authenticated;

-- ============================================================================
-- Migration Complete
-- ============================================================================

COMMENT ON TABLE design_templates IS 'Available resume design templates (minimal, card, timeline, sidebar)';
COMMENT ON TABLE design_customizations IS 'User-specific design modifications (colors, fonts, layout)';
COMMENT ON TABLE resume_design_assignments IS 'Links optimizations to templates with customizations (1:1)';
