-- Migration: Add application snapshot columns and search index; create 'applications' storage bucket
-- Created: 2025-10-16

-- Add snapshot columns to applications
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS resume_html_path TEXT,
  ADD COLUMN IF NOT EXISTS resume_json_path TEXT,
  ADD COLUMN IF NOT EXISTS ats_score NUMERIC,
  ADD COLUMN IF NOT EXISTS contact JSONB,
  ADD COLUMN IF NOT EXISTS search tsvector;

-- Populate search for existing rows
UPDATE applications
SET search = to_tsvector('simple', coalesce(job_title,'') || ' ' || coalesce(company,'') );

-- Create GIN index on search
CREATE INDEX IF NOT EXISTS idx_applications_search ON applications USING GIN (search);

-- Trigger to keep search column up to date
CREATE OR REPLACE FUNCTION applications_update_search()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search := to_tsvector('simple', coalesce(NEW.job_title,'') || ' ' || coalesce(NEW.company,'') );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_applications_update_search ON applications;
CREATE TRIGGER trg_applications_update_search
  BEFORE INSERT OR UPDATE OF job_title, company
  ON applications
  FOR EACH ROW
  EXECUTE FUNCTION applications_update_search();

-- Create private storage bucket for application snapshots (HTML/JSON)
INSERT INTO storage.buckets (id, name, public)
VALUES ('applications', 'applications', false)
ON CONFLICT (id) DO NOTHING;



