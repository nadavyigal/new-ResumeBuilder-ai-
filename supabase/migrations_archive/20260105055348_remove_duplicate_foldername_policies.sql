-- Remove old storage policies that reference storage.foldername()
-- These are duplicates of the corrected policies added in 20260104195347

DROP POLICY IF EXISTS "Users can delete their own resumes" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own resumes" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own resumes" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own resumes" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own exports" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own exports" ON storage.objects;

-- Verification comment: All resume-related policies now use split_part(name, '/', 1) instead of storage.foldername();
