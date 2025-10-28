-- =====================================================
-- ATS v2 Scoring System - Database Schema Migration
-- Migration: 20250128000000_ats_v2_schema.sql
-- =====================================================

-- Add new columns to optimizations table for ATS v2 scoring
ALTER TABLE optimizations
  ADD COLUMN IF NOT EXISTS ats_score_original REAL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ats_score_optimized REAL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ats_subscores JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ats_suggestions JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ats_confidence REAL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ats_version INTEGER DEFAULT 2;

-- Create index for faster queries by version
CREATE INDEX IF NOT EXISTS idx_optimizations_ats_version
  ON optimizations(ats_version);

-- Create index for score range queries
CREATE INDEX IF NOT EXISTS idx_optimizations_ats_score_optimized
  ON optimizations(ats_score_optimized) WHERE ats_score_optimized IS NOT NULL;

-- Migrate existing scores to v1 format
-- This marks all existing optimizations as using the old scoring system
UPDATE optimizations
SET
  ats_version = 1,
  ats_score_original = match_score,
  ats_score_optimized = match_score
WHERE ats_version IS NULL;

-- Add column comments for documentation
COMMENT ON COLUMN optimizations.ats_score_original IS
  'ATS match score for original resume (0-100). Version 2+ only.';

COMMENT ON COLUMN optimizations.ats_score_optimized IS
  'ATS match score for optimized resume (0-100). Version 2+ only.';

COMMENT ON COLUMN optimizations.ats_subscores IS
  'JSON object containing all 8 sub-scores: keyword_exact, keyword_phrase, semantic_relevance, title_alignment, metrics_presence, section_completeness, format_parseability, recency_fit';

COMMENT ON COLUMN optimizations.ats_suggestions IS
  'JSON array of actionable suggestions to improve ATS score. Each suggestion has: id, text, estimated_gain, targets, quick_win, category';

COMMENT ON COLUMN optimizations.ats_confidence IS
  'Confidence in the ATS score (0.0-1.0). Lower when data quality is poor.';

COMMENT ON COLUMN optimizations.ats_version IS
  'Scoring system version: 1 = legacy single score, 2 = multi-dimensional scoring';

-- Add check constraint to ensure scores are in valid range
ALTER TABLE optimizations
  ADD CONSTRAINT check_ats_score_original_range
  CHECK (ats_score_original IS NULL OR (ats_score_original >= 0 AND ats_score_original <= 100));

ALTER TABLE optimizations
  ADD CONSTRAINT check_ats_score_optimized_range
  CHECK (ats_score_optimized IS NULL OR (ats_score_optimized <= 0 AND ats_score_optimized <= 100));

ALTER TABLE optimizations
  ADD CONSTRAINT check_ats_confidence_range
  CHECK (ats_confidence IS NULL OR (ats_confidence >= 0 AND ats_confidence <= 1));

-- Create view for easy querying of ATS v2 scores
CREATE OR REPLACE VIEW optimizations_with_ats_v2 AS
SELECT
  o.id,
  o.user_id,
  o.resume_id,
  o.jd_id,
  o.created_at,
  o.status,
  o.template_key,
  -- Legacy score (for backwards compatibility)
  o.match_score as legacy_score,
  -- ATS v2 scores
  o.ats_version,
  o.ats_score_original,
  o.ats_score_optimized,
  -- Score improvement
  CASE
    WHEN o.ats_score_original IS NOT NULL AND o.ats_score_optimized IS NOT NULL
    THEN o.ats_score_optimized - o.ats_score_original
    ELSE NULL
  END as ats_score_improvement,
  -- Sub-scores (extracted from JSONB)
  o.ats_subscores->'keyword_exact' as subscore_keyword_exact,
  o.ats_subscores->'keyword_phrase' as subscore_keyword_phrase,
  o.ats_subscores->'semantic_relevance' as subscore_semantic_relevance,
  o.ats_subscores->'title_alignment' as subscore_title_alignment,
  o.ats_subscores->'metrics_presence' as subscore_metrics_presence,
  o.ats_subscores->'section_completeness' as subscore_section_completeness,
  o.ats_subscores->'format_parseability' as subscore_format_parseability,
  o.ats_subscores->'recency_fit' as subscore_recency_fit,
  -- Full sub-scores and suggestions
  o.ats_subscores,
  o.ats_suggestions,
  o.ats_confidence
FROM optimizations o;

-- Grant access to the view (adjust based on your RLS policies)
GRANT SELECT ON optimizations_with_ats_v2 TO authenticated;

-- Create function to check if optimization uses ATS v2
CREATE OR REPLACE FUNCTION is_ats_v2(optimization_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_version INTEGER;
BEGIN
  SELECT ats_version INTO v_version
  FROM optimizations
  WHERE id = optimization_id;

  RETURN COALESCE(v_version, 1) >= 2;
END;
$$;

-- Create function to get ATS score improvement
CREATE OR REPLACE FUNCTION get_ats_improvement(optimization_id BIGINT)
RETURNS REAL
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_original REAL;
  v_optimized REAL;
BEGIN
  SELECT ats_score_original, ats_score_optimized
  INTO v_original, v_optimized
  FROM optimizations
  WHERE id = optimization_id;

  IF v_original IS NULL OR v_optimized IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN v_optimized - v_original;
END;
$$;

-- Create index on JSONB columns for faster queries
CREATE INDEX IF NOT EXISTS idx_optimizations_ats_subscores_gin
  ON optimizations USING gin(ats_subscores);

CREATE INDEX IF NOT EXISTS idx_optimizations_ats_suggestions_gin
  ON optimizations USING gin(ats_suggestions);
