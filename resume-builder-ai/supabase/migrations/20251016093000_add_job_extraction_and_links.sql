-- Migration: Add job extraction fields, apply timestamp, and optimized resume linkage
-- Created: 2025-10-16

-- Make optimization_id nullable to allow URL-only application creation
ALTER TABLE applications
  ALTER COLUMN optimization_id DROP NOT NULL;

-- Add new fields for extraction and linkage
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS job_extraction JSONB,
  ADD COLUMN IF NOT EXISTS apply_clicked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS optimized_resume_id UUID,
  ADD COLUMN IF NOT EXISTS optimized_resume_url TEXT;

-- Optional index for quick lookup by source_url
CREATE INDEX IF NOT EXISTS idx_applications_source_url ON applications(source_url);

-- Foreign key for optimized_resume_id if the table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'optimizations'
  ) THEN
    ALTER TABLE applications
      ADD CONSTRAINT IF NOT EXISTS applications_optimized_resume_id_fkey
      FOREIGN KEY (optimized_resume_id) REFERENCES optimizations(id) ON DELETE SET NULL;
  END IF;
END $$;









