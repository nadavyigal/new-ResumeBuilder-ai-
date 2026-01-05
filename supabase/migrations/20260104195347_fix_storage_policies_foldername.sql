-- =====================================================
-- Fix storage policies to avoid dependencies on storage.foldername
-- =====================================================

DROP POLICY IF EXISTS "Users can upload own resume files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own resume uploads" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own resume uploads" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own resume uploads" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own resume exports" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own resume exports" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own resume exports" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own resume exports" ON storage.objects;

CREATE POLICY "Users can upload own resume files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'resume-uploads'
  AND auth.uid()::text = split_part(name, '/', 1)
  AND lower(reverse(split_part(reverse(name), '.', 1))) IN ('pdf', 'docx', 'doc')
);

CREATE POLICY "Users can view own resume uploads"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'resume-uploads'
  AND auth.uid()::text = split_part(name, '/', 1)
);

CREATE POLICY "Users can update own resume uploads"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'resume-uploads'
  AND auth.uid()::text = split_part(name, '/', 1)
);

CREATE POLICY "Users can delete own resume uploads"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'resume-uploads'
  AND auth.uid()::text = split_part(name, '/', 1)
);

CREATE POLICY "Users can upload own resume exports"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'resume-exports'
  AND auth.uid()::text = split_part(name, '/', 1)
  AND lower(reverse(split_part(reverse(name), '.', 1))) IN ('pdf', 'docx')
);

CREATE POLICY "Users can view own resume exports"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'resume-exports'
  AND auth.uid()::text = split_part(name, '/', 1)
);

CREATE POLICY "Users can update own resume exports"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'resume-exports'
  AND auth.uid()::text = split_part(name, '/', 1)
);

CREATE POLICY "Users can delete own resume exports"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'resume-exports'
  AND auth.uid()::text = split_part(name, '/', 1)
);
