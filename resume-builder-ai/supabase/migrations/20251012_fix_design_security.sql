-- Migration: Fix Design Tables Security and Performance Issues
-- Feature: 003-i-want-to (AI-Powered Resume Design Selection)
-- Task: T049 - Security advisory fixes
-- Date: 2025-10-12
--
-- Changes:
-- 1. Add missing RLS policies for design_customizations (UPDATE, DELETE)
-- 2. Add missing RLS policy for resume_design_assignments (DELETE)
-- 3. Add missing performance indexes
-- 4. Tighten design_customizations INSERT policy

-- ============================================================================
-- 1. Add Missing RLS Policies for design_customizations
-- ============================================================================

-- DROP existing permissive INSERT policy
DROP POLICY IF EXISTS "Customizations insertable by authenticated users" ON design_customizations;

-- CREATE stricter INSERT policy that verifies ownership through assignments
CREATE POLICY "Customizations insertable by assignment owner"
ON design_customizations FOR INSERT
TO public
WITH CHECK (
  -- Verify user owns an assignment with this template_id
  EXISTS (
    SELECT 1 FROM resume_design_assignments rda
    WHERE rda.template_id = design_customizations.template_id
    AND rda.user_id = auth.uid()
  )
);

-- ADD UPDATE policy
CREATE POLICY "Customizations updatable by assignment owner"
ON design_customizations FOR UPDATE
TO public
USING (
  -- User can update if they own an assignment that references this customization
  EXISTS (
    SELECT 1 FROM resume_design_assignments rda
    WHERE (rda.customization_id = design_customizations.id
           OR rda.previous_customization_id = design_customizations.id)
    AND rda.user_id = auth.uid()
  )
)
WITH CHECK (
  -- Same check for the updated values
  EXISTS (
    SELECT 1 FROM resume_design_assignments rda
    WHERE (rda.customization_id = design_customizations.id
           OR rda.previous_customization_id = design_customizations.id)
    AND rda.user_id = auth.uid()
  )
);

-- ADD DELETE policy
CREATE POLICY "Customizations deletable by assignment owner"
ON design_customizations FOR DELETE
TO public
USING (
  -- User can delete if they own an assignment that references this customization
  EXISTS (
    SELECT 1 FROM resume_design_assignments rda
    WHERE (rda.customization_id = design_customizations.id
           OR rda.previous_customization_id = design_customizations.id)
    AND rda.user_id = auth.uid()
  )
);

-- ============================================================================
-- 2. Add Missing RLS Policy for resume_design_assignments
-- ============================================================================

-- ADD DELETE policy
CREATE POLICY "Assignments deletable by owner"
ON resume_design_assignments FOR DELETE
TO public
USING (user_id = auth.uid());

-- ============================================================================
-- 3. Add Missing Performance Indexes
-- ============================================================================

-- Index on template_id foreign key (for JOIN operations)
CREATE INDEX IF NOT EXISTS idx_resume_design_assignments_template_id_performance
ON resume_design_assignments(template_id);

-- Index on original_template_id foreign key (for template history tracking)
CREATE INDEX IF NOT EXISTS idx_resume_design_assignments_original_template_id_performance
ON resume_design_assignments(original_template_id);

-- ============================================================================
-- 4. Add Comments for Documentation
-- ============================================================================

COMMENT ON POLICY "Customizations insertable by assignment owner" ON design_customizations IS
'Users can only create customizations for templates they have assigned to their optimizations. Prevents unauthorized customization creation.';

COMMENT ON POLICY "Customizations updatable by assignment owner" ON design_customizations IS
'Users can only update customizations that are currently or previously assigned to their optimizations. Ensures ownership through assignments.';

COMMENT ON POLICY "Customizations deletable by assignment owner" ON design_customizations IS
'Users can only delete customizations that are currently or previously assigned to their optimizations. Ensures ownership through assignments.';

COMMENT ON POLICY "Assignments deletable by owner" ON resume_design_assignments IS
'Users can only delete their own design assignments. Maintains user data isolation.';

COMMENT ON INDEX idx_resume_design_assignments_template_id_performance IS
'Performance index for JOIN operations between assignments and templates. Addresses Supabase advisor warning about missing foreign key index.';

COMMENT ON INDEX idx_resume_design_assignments_original_template_id_performance IS
'Performance index for template history tracking queries. Addresses Supabase advisor warning about missing foreign key index.';

-- ============================================================================
-- Verification Queries (commented out - for manual testing)
-- ============================================================================

-- Verify RLS policies are in place:
-- SELECT schemaname, tablename, policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename IN ('design_customizations', 'resume_design_assignments')
-- ORDER BY tablename, policyname;

-- Verify indexes exist:
-- SELECT indexname, tablename, indexdef
-- FROM pg_indexes
-- WHERE tablename IN ('resume_design_assignments')
-- AND indexname LIKE '%performance%'
-- ORDER BY tablename, indexname;
