-- Migration: Normalize applications column names (company -> company_name)
-- Created: 2025-10-16

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'applications' AND column_name = 'company'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'applications' AND column_name = 'company_name'
  ) THEN
    ALTER TABLE applications RENAME COLUMN company TO company_name;
  END IF;
END $$;



