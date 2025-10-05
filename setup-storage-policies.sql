-- Storage Policies for resume-uploads bucket
-- Users can upload their own resumes

-- Allow authenticated users to upload their own resumes
CREATE POLICY "Users can upload their own resumes"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'resume-uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to read their own uploaded resumes
CREATE POLICY "Users can read their own resumes"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'resume-uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to update their own resumes
CREATE POLICY "Users can update their own resumes"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'resume-uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'resume-uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own resumes
CREATE POLICY "Users can delete their own resumes"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'resume-uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Storage Policies for resume-exports bucket
-- Users can access their optimized/exported resumes

-- Allow authenticated users to read their own exports
CREATE POLICY "Users can read their own exports"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'resume-exports'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow system (service role) to create exports
CREATE POLICY "Service role can create exports"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'resume-exports');

-- Allow users to delete their own exports
CREATE POLICY "Users can delete their own exports"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'resume-exports'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
