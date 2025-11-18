-- Fix Database Schema Column Name Mismatches
--
-- Issue 1: design_customizations table has 'spacing_settings' but code expects 'spacing'
-- Issue 2: job_descriptions table has 'extracted_data' but code expects 'parsed_data'
--
-- These mismatches were causing:
-- - Font/color changes to fail silently (design customizations not saving)
-- - ATS score updates to fail (job description data not accessible)

-- Fix design_customizations column name
ALTER TABLE design_customizations
  RENAME COLUMN spacing_settings TO spacing;

-- Fix job_descriptions column name
ALTER TABLE job_descriptions
  RENAME COLUMN extracted_data TO parsed_data;

-- Verify the columns now exist with correct names
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'design_customizations' AND column_name = 'spacing'
  ) THEN
    RAISE NOTICE 'Success: design_customizations.spacing column exists';
  ELSE
    RAISE EXCEPTION 'Failed: design_customizations.spacing column not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_descriptions' AND column_name = 'parsed_data'
  ) THEN
    RAISE NOTICE 'Success: job_descriptions.parsed_data column exists';
  ELSE
    RAISE EXCEPTION 'Failed: job_descriptions.parsed_data column not found';
  END IF;
END $$;
