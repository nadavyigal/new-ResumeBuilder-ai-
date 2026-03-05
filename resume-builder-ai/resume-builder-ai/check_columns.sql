-- Quick check for problematic columns

-- Check job_descriptions columns
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'job_descriptions'
  AND column_name IN ('parsed_data', 'extracted_data')
ORDER BY column_name;

-- Check design_customizations columns
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'design_customizations'
  AND column_name IN ('spacing', 'spacing_settings')
ORDER BY column_name;
