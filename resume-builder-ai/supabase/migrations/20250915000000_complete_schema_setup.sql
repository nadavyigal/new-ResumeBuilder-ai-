-- =====================================================
-- AI Resume Optimizer - Complete Database Setup
-- Migration: 20250915000000_complete_schema_setup.sql
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- =====================================================
-- DROP EXISTING OBJECTS (for clean setup)
-- =====================================================

-- Drop triggers first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_resumes_updated_at ON resumes;
DROP TRIGGER IF EXISTS update_job_descriptions_updated_at ON job_descriptions;
DROP TRIGGER IF EXISTS update_optimizations_updated_at ON optimizations;
DROP TRIGGER IF EXISTS update_templates_updated_at ON templates;

-- Drop functions
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.check_subscription_limit();
DROP FUNCTION IF EXISTS public.increment_optimization_usage();
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own resumes" ON resumes;
DROP POLICY IF EXISTS "Users can insert own resumes" ON resumes;
DROP POLICY IF EXISTS "Users can update own resumes" ON resumes;
DROP POLICY IF EXISTS "Users can delete own resumes" ON resumes;
DROP POLICY IF EXISTS "Users can view own job descriptions" ON job_descriptions;
DROP POLICY IF EXISTS "Users can insert own job descriptions" ON job_descriptions;
DROP POLICY IF EXISTS "Users can update own job descriptions" ON job_descriptions;
DROP POLICY IF EXISTS "Users can delete own job descriptions" ON job_descriptions;
DROP POLICY IF EXISTS "Users can view own optimizations" ON optimizations;
DROP POLICY IF EXISTS "Users can insert own optimizations" ON optimizations;
DROP POLICY IF EXISTS "Users can update own optimizations" ON optimizations;
DROP POLICY IF EXISTS "Users can delete own optimizations" ON optimizations;
DROP POLICY IF EXISTS "Authenticated users can view templates" ON templates;
DROP POLICY IF EXISTS "Service role can manage templates" ON templates;

-- Drop tables (in reverse dependency order)
DROP TABLE IF EXISTS optimizations CASCADE;
DROP TABLE IF EXISTS job_descriptions CASCADE;
DROP TABLE IF EXISTS resumes CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS templates CASCADE;

-- =====================================================
-- CREATE TABLES
-- =====================================================

-- Profiles table - user information and subscription status
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    full_name TEXT,
    subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'premium')),
    optimizations_used INTEGER DEFAULT 0 CHECK (optimizations_used >= 0),
    max_optimizations INTEGER DEFAULT 1, -- free tier gets 1, premium gets unlimited (-1)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Templates table - resume templates available to users
CREATE TABLE templates (
    key TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    family TEXT NOT NULL CHECK (family IN ('ats', 'modern')),
    is_premium BOOLEAN DEFAULT false,
    config JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Resumes table - uploaded resume files and parsed data
CREATE TABLE resumes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    filename TEXT NOT NULL,
    original_content TEXT, -- raw text extracted from file
    parsed_data JSONB DEFAULT '{}', -- structured resume data
    embeddings vector(1536), -- OpenAI embeddings for similarity matching
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Job descriptions table - job postings for optimization
CREATE TABLE job_descriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    company TEXT,
    url TEXT, -- optional URL if scraped from job posting
    extracted_data JSONB NOT NULL DEFAULT '{}', -- structured job requirements
    embeddings vector(1536), -- OpenAI embeddings for similarity matching
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Optimizations table - AI optimization results
CREATE TABLE optimizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    resume_id UUID REFERENCES resumes(id) ON DELETE CASCADE NOT NULL,
    jd_id UUID REFERENCES job_descriptions(id) ON DELETE CASCADE NOT NULL,
    match_score DECIMAL(5,2) NOT NULL CHECK (match_score >= 0 AND match_score <= 100),
    optimization_data JSONB NOT NULL DEFAULT '{}', -- AI-optimized resume content
    status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ensure one optimization per resume-job combination
    UNIQUE(resume_id, jd_id)
);

-- =====================================================
-- ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_descriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE optimizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- CREATE RLS POLICIES
-- =====================================================

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = user_id);

-- Resumes policies
CREATE POLICY "Users can view own resumes" ON resumes
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own resumes" ON resumes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own resumes" ON resumes
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own resumes" ON resumes
    FOR DELETE USING (auth.uid() = user_id);

-- Job descriptions policies
CREATE POLICY "Users can view own job descriptions" ON job_descriptions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own job descriptions" ON job_descriptions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own job descriptions" ON job_descriptions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own job descriptions" ON job_descriptions
    FOR DELETE USING (auth.uid() = user_id);

-- Optimizations policies
CREATE POLICY "Users can view own optimizations" ON optimizations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own optimizations" ON optimizations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own optimizations" ON optimizations
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own optimizations" ON optimizations
    FOR DELETE USING (auth.uid() = user_id);

-- Templates policies (public read access for authenticated users)
CREATE POLICY "Authenticated users can view templates" ON templates
    FOR SELECT TO authenticated USING (true);

-- Service role can manage templates for admin purposes
CREATE POLICY "Service role can manage templates" ON templates
    FOR ALL TO service_role USING (true);

-- =====================================================
-- CREATE FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all tables
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
        1 -- free tier limit
    )
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create profile on user signup
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

    -- If no profile found, deny access
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Premium users have unlimited access (max_optimizations = -1)
    IF user_profile.subscription_tier = 'premium' OR user_profile.max_optimizations = -1 THEN
        RETURN TRUE;
    END IF;

    -- Check if free user has exceeded limit
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
-- INSERT DEFAULT DATA
-- =====================================================

-- Insert default templates
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
-- CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- User-specific indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_job_descriptions_user_id ON job_descriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_optimizations_user_id ON optimizations(user_id);

-- Foreign key indexes
CREATE INDEX IF NOT EXISTS idx_optimizations_resume_id ON optimizations(resume_id);
CREATE INDEX IF NOT EXISTS idx_optimizations_jd_id ON optimizations(jd_id);

-- Timeline indexes for sorting and pagination
CREATE INDEX IF NOT EXISTS idx_resumes_created_at ON resumes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_descriptions_created_at ON job_descriptions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_optimizations_created_at ON optimizations(created_at DESC);

-- Vector similarity indexes (for future similarity search optimization)
CREATE INDEX IF NOT EXISTS idx_resumes_embeddings ON resumes USING ivfflat (embeddings vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_job_descriptions_embeddings ON job_descriptions USING ivfflat (embeddings vector_cosine_ops) WITH (lists = 100);

-- =====================================================
-- SECURITY VALIDATION
-- =====================================================

-- Verify RLS is enabled on all tables
DO $$
DECLARE
    table_name TEXT;
    missing_rls TEXT[] := ARRAY[]::TEXT[];
BEGIN
    FOR table_name IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('profiles', 'resumes', 'job_descriptions', 'optimizations', 'templates')
    LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = table_name AND rowsecurity = true) THEN
            missing_rls := array_append(missing_rls, table_name);
        END IF;
    END LOOP;

    IF array_length(missing_rls, 1) > 0 THEN
        RAISE EXCEPTION 'RLS not enabled on tables: %', array_to_string(missing_rls, ', ');
    END IF;

    RAISE NOTICE '✅ Row Level Security enabled on all tables';
END $$;

-- Verify templates were inserted
DO $$
BEGIN
    IF (SELECT COUNT(*) FROM templates) >= 3 THEN
        RAISE NOTICE '✅ Default templates inserted successfully';
    ELSE
        RAISE EXCEPTION '❌ Default templates were not inserted properly';
    END IF;
END $$;

-- =====================================================
-- SETUP COMPLETE NOTIFICATION
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 AI Resume Optimizer Database Setup Complete!';
    RAISE NOTICE '';
    RAISE NOTICE 'Created:';
    RAISE NOTICE '✅ 5 tables with proper relationships and constraints';
    RAISE NOTICE '✅ Row Level Security policies for data protection';
    RAISE NOTICE '✅ Automatic profile creation on user signup';
    RAISE NOTICE '✅ Subscription limit enforcement functions';
    RAISE NOTICE '✅ 3 default resume templates (1 free, 2 premium)';
    RAISE NOTICE '✅ Performance indexes including vector similarity';
    RAISE NOTICE '✅ Audit triggers for automatic timestamp updates';
    RAISE NOTICE '';
    RAISE NOTICE 'Next: Configure Storage buckets and test authentication';
END $$;