-- Fix Database Schema Column Name Mismatches
-- Date: 2025-11-09
-- Issue: Code expects different column names than what exists in database
--
-- Fixes:
-- 1. job_descriptions.extracted_data → parsed_data
-- 2. design_customizations.spacing_settings → spacing

-- Fix 1: Rename extracted_data to parsed_data in job_descriptions
DO $$
BEGIN
  -- Check if extracted_data exists and parsed_data doesn't
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_descriptions' AND column_name = 'extracted_data'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_descriptions' AND column_name = 'parsed_data'
  ) THEN
    ALTER TABLE job_descriptions RENAME COLUMN extracted_data TO parsed_data;
    RAISE NOTICE 'Renamed job_descriptions.extracted_data to parsed_data';
  ELSE
    RAISE NOTICE 'job_descriptions.parsed_data already exists or extracted_data missing';
  END IF;
END $$;

-- Fix 2: Rename spacing_settings to spacing in design_customizations
DO $$
BEGIN
  -- Check if spacing_settings exists and spacing doesn't
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'design_customizations' AND column_name = 'spacing_settings'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'design_customizations' AND column_name = 'spacing'
  ) THEN
    ALTER TABLE design_customizations RENAME COLUMN spacing_settings TO spacing;
    RAISE NOTICE 'Renamed design_customizations.spacing_settings to spacing';
  ELSE
    RAISE NOTICE 'design_customizations.spacing already exists or spacing_settings missing';
  END IF;
END $$;

-- Verification
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_descriptions' AND column_name = 'parsed_data'
  ) THEN
    RAISE NOTICE 'VERIFIED: job_descriptions.parsed_data exists';
  ELSE
    RAISE EXCEPTION 'FAILED: job_descriptions.parsed_data does not exist';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'design_customizations' AND column_name = 'spacing'
  ) THEN
    RAISE NOTICE 'VERIFIED: design_customizations.spacing exists';
  ELSE
    RAISE EXCEPTION 'FAILED: design_customizations.spacing does not exist';
  END IF;
END $$;
