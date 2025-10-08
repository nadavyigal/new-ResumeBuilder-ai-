-- =====================================================
-- AI Resume Optimizer - Storage Buckets Setup
-- Migration: 20250915000001_setup_storage.sql
-- =====================================================

-- Insert buckets for file storage
INSERT INTO storage.buckets (id, name, public, allowed_mime_types, file_size_limit, avif_autodetection)
VALUES
    (
        'resume-uploads',
        'resume-uploads',
        false, -- private bucket
        ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'],
        10485760, -- 10MB limit
        false
    ),
    (
        'resume-exports',
        'resume-exports',
        false, -- private bucket
        ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        10485760, -- 10MB limit
        false
    )
ON CONFLICT (id) DO UPDATE SET
    allowed_mime_types = EXCLUDED.allowed_mime_types,
    file_size_limit = EXCLUDED.file_size_limit;

-- =====================================================
-- STORAGE POLICIES FOR RESUME UPLOADS
-- =====================================================

-- Allow authenticated users to upload their own resume files
CREATE POLICY "Users can upload own resume files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'resume-uploads'
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND (storage.extension(name)) IN ('pdf', 'docx', 'doc')
);

-- Allow users to view their own uploaded files
CREATE POLICY "Users can view own resume uploads"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'resume-uploads'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to update their own files (for re-uploads)
CREATE POLICY "Users can update own resume uploads"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'resume-uploads'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own files
CREATE POLICY "Users can delete own resume uploads"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'resume-uploads'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- =====================================================
-- STORAGE POLICIES FOR RESUME EXPORTS
-- =====================================================

-- Allow authenticated users to upload optimized resume exports
CREATE POLICY "Users can upload own resume exports"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'resume-exports'
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND (storage.extension(name)) IN ('pdf', 'docx')
);

-- Allow users to view their own exported files
CREATE POLICY "Users can view own resume exports"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'resume-exports'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to update their own export files
CREATE POLICY "Users can update own resume exports"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'resume-exports'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own export files
CREATE POLICY "Users can delete own resume exports"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'resume-exports'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- =====================================================
-- HELPER FUNCTIONS FOR FILE MANAGEMENT
-- =====================================================

-- Function to generate secure file paths
CREATE OR REPLACE FUNCTION public.generate_file_path(
    user_uuid UUID,
    filename TEXT,
    file_type TEXT DEFAULT 'upload'
)
RETURNS TEXT AS $$
DECLARE
    clean_filename TEXT;
    timestamp_suffix TEXT;
    file_extension TEXT;
BEGIN
    -- Extract file extension
    file_extension := lower(split_part(filename, '.', -1));

    -- Clean filename (remove extension and sanitize)
    clean_filename := regexp_replace(
        split_part(filename, '.', 1),
        '[^a-zA-Z0-9_-]',
        '_',
        'g'
    );

    -- Add timestamp to prevent conflicts
    timestamp_suffix := extract(epoch from now())::text;

    -- Return full path: user_id/type_cleanname_timestamp.ext
    RETURN user_uuid::text || '/' || file_type || '_' || clean_filename || '_' || timestamp_suffix || '.' || file_extension;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old files (for maintenance)
CREATE OR REPLACE FUNCTION public.cleanup_old_files(
    bucket_name TEXT,
    days_old INTEGER DEFAULT 30
)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    -- This function can be called by admins to clean up old files
    -- Implementation would depend on your specific cleanup requirements

    -- For now, just return 0 as placeholder
    -- In production, you might want to delete files older than X days
    -- that are not referenced in the database

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- VALIDATION AND TESTING
-- =====================================================

-- Verify buckets were created
DO $$
DECLARE
    bucket_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO bucket_count
    FROM storage.buckets
    WHERE id IN ('resume-uploads', 'resume-exports');

    IF bucket_count = 2 THEN
        RAISE NOTICE '✅ Storage buckets created successfully';
        RAISE NOTICE '  - resume-uploads: for original files (PDF/DOCX, 10MB limit)';
        RAISE NOTICE '  - resume-exports: for optimized files (PDF/DOCX, 10MB limit)';
    ELSE
        RAISE EXCEPTION '❌ Storage buckets not created properly';
    END IF;
END $$;

-- Verify storage policies exist
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname LIKE '%resume%';

    IF policy_count >= 8 THEN
        RAISE NOTICE '✅ Storage security policies created successfully';
    ELSE
        RAISE WARNING '⚠️  Expected 8+ storage policies, found %', policy_count;
    END IF;
END $$;

-- =====================================================
-- USAGE EXAMPLES AND DOCUMENTATION
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '📁 Storage Configuration Complete!';
    RAISE NOTICE '';
    RAISE NOTICE 'Buckets Created:';
    RAISE NOTICE '  resume-uploads/ - Original uploaded files';
    RAISE NOTICE '  resume-exports/ - AI-optimized exports';
    RAISE NOTICE '';
    RAISE NOTICE 'Security Features:';
    RAISE NOTICE '  ✅ Users can only access their own files';
    RAISE NOTICE '  ✅ File type restrictions (PDF, DOCX only)';
    RAISE NOTICE '  ✅ File size limits (10MB max)';
    RAISE NOTICE '  ✅ Secure folder structure (user_id/file)';
    RAISE NOTICE '';
    RAISE NOTICE 'File Path Format:';
    RAISE NOTICE '  {user_id}/upload_{filename}_{timestamp}.{ext}';
    RAISE NOTICE '  {user_id}/export_{filename}_{timestamp}.{ext}';
    RAISE NOTICE '';
END $$;