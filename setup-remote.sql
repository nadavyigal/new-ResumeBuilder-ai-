-- =====================================================
-- AI Resume Optimizer - Remote Database Setup Script
-- This script is idempotent and can be run multiple times
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- =====================================================
-- 1. CREATE OR UPDATE TABLES
-- =====================================================

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    full_name TEXT,
    subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'premium')),
    optimizations_used INTEGER DEFAULT 0 CHECK (optimizations_used >= 0),
    max_optimizations INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Templates table
CREATE TABLE IF NOT EXISTS templates (
    key TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    family TEXT NOT NULL CHECK (family IN ('ats', 'modern')),
    is_premium BOOLEAN DEFAULT false,
    config JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Resumes table
CREATE TABLE IF NOT EXISTS resumes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    filename TEXT NOT NULL,
    original_content TEXT,
    parsed_data JSONB DEFAULT '{}',
    embeddings vector(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Job descriptions table
CREATE TABLE IF NOT EXISTS job_descriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    company TEXT,
    url TEXT,
    extracted_data JSONB NOT NULL DEFAULT '{}',
    embeddings vector(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Optimizations table
CREATE TABLE IF NOT EXISTS optimizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    resume_id UUID REFERENCES resumes(id) ON DELETE CASCADE NOT NULL,
    jd_id UUID REFERENCES job_descriptions(id) ON DELETE CASCADE NOT NULL,
    match_score DECIMAL(5,2) NOT NULL CHECK (match_score >= 0 AND match_score <= 100),
    optimization_data JSONB NOT NULL DEFAULT '{}',
    status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(resume_id, jd_id)
);

-- =====================================================
-- 2. ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_descriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE optimizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 3. CREATE RLS POLICIES (Drop and recreate to ensure they're correct)
-- =====================================================

-- Profiles policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = user_id);

-- Resumes policies
DROP POLICY IF EXISTS "Users can view own resumes" ON resumes;
CREATE POLICY "Users can view own resumes" ON resumes
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own resumes" ON resumes;
CREATE POLICY "Users can insert own resumes" ON resumes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own resumes" ON resumes;
CREATE POLICY "Users can update own resumes" ON resumes
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own resumes" ON resumes;
CREATE POLICY "Users can delete own resumes" ON resumes
    FOR DELETE USING (auth.uid() = user_id);

-- Job descriptions policies
DROP POLICY IF EXISTS "Users can view own job descriptions" ON job_descriptions;
CREATE POLICY "Users can view own job descriptions" ON job_descriptions
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own job descriptions" ON job_descriptions;
CREATE POLICY "Users can insert own job descriptions" ON job_descriptions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own job descriptions" ON job_descriptions;
CREATE POLICY "Users can update own job descriptions" ON job_descriptions
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own job descriptions" ON job_descriptions;
CREATE POLICY "Users can delete own job descriptions" ON job_descriptions
    FOR DELETE USING (auth.uid() = user_id);

-- Optimizations policies
DROP POLICY IF EXISTS "Users can view own optimizations" ON optimizations;
CREATE POLICY "Users can view own optimizations" ON optimizations
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own optimizations" ON optimizations;
CREATE POLICY "Users can insert own optimizations" ON optimizations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own optimizations" ON optimizations;
CREATE POLICY "Users can update own optimizations" ON optimizations
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own optimizations" ON optimizations;
CREATE POLICY "Users can delete own optimizations" ON optimizations
    FOR DELETE USING (auth.uid() = user_id);

-- Templates policies
DROP POLICY IF EXISTS "Authenticated users can view templates" ON templates;
CREATE POLICY "Authenticated users can view templates" ON templates
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Service role can manage templates" ON templates;
CREATE POLICY "Service role can manage templates" ON templates
    FOR ALL TO service_role USING (true);

-- =====================================================
-- 4. CREATE FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers to recreate them
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_resumes_updated_at ON resumes;
DROP TRIGGER IF EXISTS update_job_descriptions_updated_at ON job_descriptions;
DROP TRIGGER IF EXISTS update_optimizations_updated_at ON optimizations;
DROP TRIGGER IF EXISTS update_templates_updated_at ON templates;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_resumes_updated_at
    BEFORE UPDATE ON resumes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_descriptions_updated_at
    BEFORE UPDATE ON job_descriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_optimizations_updated_at
    BEFORE UPDATE ON optimizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at
    BEFORE UPDATE ON templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, full_name, subscription_tier, optimizations_used, max_optimizations)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, 'Anonymous User'),
        'free',
        0,
        1
    )
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for automatic profile creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to check subscription limits
CREATE OR REPLACE FUNCTION public.check_subscription_limit(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_profile RECORD;
BEGIN
    SELECT subscription_tier, optimizations_used, max_optimizations
    INTO user_profile
    FROM profiles
    WHERE user_id = user_uuid;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    IF user_profile.subscription_tier = 'premium' OR user_profile.max_optimizations = -1 THEN
        RETURN TRUE;
    END IF;

    RETURN user_profile.optimizations_used < user_profile.max_optimizations;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment optimization usage
CREATE OR REPLACE FUNCTION public.increment_optimization_usage(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    updated_rows INTEGER;
BEGIN
    UPDATE profiles
    SET optimizations_used = optimizations_used + 1
    WHERE user_id = user_uuid
    AND (subscription_tier = 'premium' OR optimizations_used < max_optimizations);

    GET DIAGNOSTICS updated_rows = ROW_COUNT;
    RETURN updated_rows > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. INSERT DEFAULT TEMPLATES
-- =====================================================

INSERT INTO templates (key, name, family, is_premium, config) VALUES
('ats-safe', 'ATS-Safe Professional', 'ats', false, '{
  "fonts": ["Arial", "Calibri", "Times New Roman"],
  "colors": ["#000000", "#333333"],
  "layout": "single-column",
  "sections": ["header", "summary", "experience", "education", "skills"],
  "description": "Clean, professional template optimized for ATS systems"
}'),
('modern-creative', 'Modern Creative', 'modern', true, '{
  "fonts": ["Inter", "Roboto", "Open Sans"],
  "colors": ["#2563eb", "#1f2937", "#6b7280"],
  "layout": "two-column",
  "sections": ["header", "summary", "experience", "education", "skills", "certifications"],
  "description": "Contemporary design with visual elements for premium users"
}'),
('executive-level', 'Executive Level', 'modern', true, '{
  "fonts": ["Georgia", "Playfair Display", "Source Sans Pro"],
  "colors": ["#1a1a1a", "#8b5a3c", "#f5f5f5"],
  "layout": "executive",
  "sections": ["header", "executive_summary", "leadership_experience", "board_positions", "education", "achievements"],
  "description": "Premium template for senior executive positions"
}')
ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    family = EXCLUDED.family,
    is_premium = EXCLUDED.is_premium,
    config = EXCLUDED.config,
    updated_at = NOW();

-- =====================================================
-- 6. CREATE INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_job_descriptions_user_id ON job_descriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_optimizations_user_id ON optimizations(user_id);
CREATE INDEX IF NOT EXISTS idx_optimizations_resume_id ON optimizations(resume_id);
CREATE INDEX IF NOT EXISTS idx_optimizations_jd_id ON optimizations(jd_id);
CREATE INDEX IF NOT EXISTS idx_resumes_created_at ON resumes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_descriptions_created_at ON job_descriptions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_optimizations_created_at ON optimizations(created_at DESC);

-- Vector indexes (may take time on large datasets)
CREATE INDEX IF NOT EXISTS idx_resumes_embeddings ON resumes USING ivfflat (embeddings vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_job_descriptions_embeddings ON job_descriptions USING ivfflat (embeddings vector_cosine_ops) WITH (lists = 100);

-- =====================================================
-- 7. STORAGE BUCKETS SETUP
-- =====================================================

-- Insert storage buckets
INSERT INTO storage.buckets (id, name, public, allowed_mime_types, file_size_limit, avif_autodetection)
VALUES
    (
        'resume-uploads',
        'resume-uploads',
        false,
        ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'],
        10485760,
        false
    ),
    (
        'resume-exports',
        'resume-exports',
        false,
        ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        10485760,
        false
    )
ON CONFLICT (id) DO UPDATE SET
    allowed_mime_types = EXCLUDED.allowed_mime_types,
    file_size_limit = EXCLUDED.file_size_limit;

-- =====================================================
-- 8. STORAGE POLICIES
-- =====================================================

-- Resume uploads policies
DROP POLICY IF EXISTS "Users can upload own resume files" ON storage.objects;
CREATE POLICY "Users can upload own resume files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'resume-uploads'
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND (storage.extension(name)) IN ('pdf', 'docx', 'doc')
);

DROP POLICY IF EXISTS "Users can view own resume uploads" ON storage.objects;
CREATE POLICY "Users can view own resume uploads"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'resume-uploads'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can update own resume uploads" ON storage.objects;
CREATE POLICY "Users can update own resume uploads"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'resume-uploads'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can delete own resume uploads" ON storage.objects;
CREATE POLICY "Users can delete own resume uploads"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'resume-uploads'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Resume exports policies
DROP POLICY IF EXISTS "Users can upload own resume exports" ON storage.objects;
CREATE POLICY "Users can upload own resume exports"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'resume-exports'
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND (storage.extension(name)) IN ('pdf', 'docx')
);

DROP POLICY IF EXISTS "Users can view own resume exports" ON storage.objects;
CREATE POLICY "Users can view own resume exports"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'resume-exports'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can update own resume exports" ON storage.objects;
CREATE POLICY "Users can update own resume exports"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'resume-exports'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can delete own resume exports" ON storage.objects;
CREATE POLICY "Users can delete own resume exports"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'resume-exports'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- =====================================================
-- 9. HELPER FUNCTIONS
-- =====================================================

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
    file_extension := lower(split_part(filename, '.', -1));
    clean_filename := regexp_replace(split_part(filename, '.', 1), '[^a-zA-Z0-9_-]', '_', 'g');
    timestamp_suffix := extract(epoch from now())::text;
    RETURN user_uuid::text || '/' || file_type || '_' || clean_filename || '_' || timestamp_suffix || '.' || file_extension;
END;
$$ LANGUAGE plpgsql;
