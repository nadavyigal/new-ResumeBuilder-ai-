-- =====================================================
-- AI Resume Optimizer - Complete Database Setup
-- This is the ONLY SQL script you need to run in Supabase
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- =====================================================
-- DROP EXISTING OBJECTS (for clean reinstall)
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
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop tables (in reverse dependency order)
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS optimizations CASCADE;
DROP TABLE IF EXISTS job_descriptions CASCADE;
DROP TABLE IF EXISTS resumes CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS templates CASCADE;

-- =====================================================
-- CREATE TABLES
-- =====================================================

-- Profiles table
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    full_name TEXT,
    role TEXT,
    plan_type TEXT DEFAULT 'free' CHECK (plan_type IN ('free', 'premium')),
    optimizations_used INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Templates table (public access)
CREATE TABLE templates (
    key TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    family TEXT NOT NULL CHECK (family IN ('ats', 'modern')),
    config_data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Resumes table
CREATE TABLE resumes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    storage_path TEXT,
    raw_text TEXT,
    canonical_data JSONB DEFAULT '{}',
    embeddings vector(1536), -- OpenAI embeddings dimension
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Job descriptions table
CREATE TABLE job_descriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    source_url TEXT,
    title TEXT NOT NULL,
    company TEXT NOT NULL,
    raw_text TEXT NOT NULL,
    clean_text TEXT NOT NULL,
    extracted_data JSONB NOT NULL DEFAULT '{}',
    embeddings vector(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Optimizations table
CREATE TABLE optimizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    resume_id UUID REFERENCES resumes(id) ON DELETE CASCADE,
    jd_id UUID REFERENCES job_descriptions(id) ON DELETE CASCADE,
    match_score DECIMAL(5,2) NOT NULL,
    gaps_data JSONB NOT NULL DEFAULT '{}',
    rewrite_data JSONB NOT NULL DEFAULT '{}',
    template_key TEXT NOT NULL,
    output_paths JSONB DEFAULT '{}',
    status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Events table for analytics
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    payload_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_descriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE optimizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
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

-- Events policies
CREATE POLICY "Users can insert own events" ON events
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own events" ON events
    FOR SELECT USING (auth.uid() = user_id);

-- Templates policies (accessible to all authenticated users)
CREATE POLICY "Authenticated users can view templates" ON templates
    FOR SELECT TO authenticated USING (true);

-- Service role can manage templates for seeding/admin purposes
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
    INSERT INTO public.profiles (user_id, full_name, plan_type)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Anonymous User'),
        'free'
    )
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create profile on user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- INSERT DEFAULT DATA
-- =====================================================

-- Insert default templates
INSERT INTO templates (key, name, family, config_data) VALUES
('ats-safe', 'ATS-Safe Professional', 'ats', '{
  "fonts": ["Arial", "Calibri", "Times New Roman"],
  "colors": ["#000000", "#333333"],
  "layout": "single-column",
  "sections": ["header", "summary", "experience", "education", "skills"],
  "description": "Clean, professional template optimized for ATS systems"
}'),
('modern-creative', 'Modern Creative', 'modern', '{
  "fonts": ["Inter", "Roboto", "Open Sans"],
  "colors": ["#2563eb", "#1f2937", "#6b7280"],
  "layout": "two-column",
  "sections": ["header", "summary", "experience", "education", "skills", "certifications"],
  "description": "Contemporary design with visual elements"
}')
ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    family = EXCLUDED.family,
    config_data = EXCLUDED.config_data,
    updated_at = NOW();

-- =====================================================
-- CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- User-specific indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_job_descriptions_user_id ON job_descriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_optimizations_user_id ON optimizations(user_id);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);

-- Foreign key indexes
CREATE INDEX IF NOT EXISTS idx_optimizations_resume_id ON optimizations(resume_id);
CREATE INDEX IF NOT EXISTS idx_optimizations_jd_id ON optimizations(jd_id);

-- Timeline indexes
CREATE INDEX IF NOT EXISTS idx_resumes_created_at ON resumes(created_at);
CREATE INDEX IF NOT EXISTS idx_job_descriptions_created_at ON job_descriptions(created_at);
CREATE INDEX IF NOT EXISTS idx_optimizations_created_at ON optimizations(created_at);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Verify RLS is enabled on all tables
DO $$ 
BEGIN
    RAISE NOTICE 'Verifying Row Level Security...';
    
    -- Check if RLS is enabled
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename IN ('profiles', 'resumes', 'job_descriptions', 'optimizations', 'templates', 'events')
        AND rowsecurity = false
    ) THEN
        RAISE NOTICE '✅ RLS is enabled on all tables';
    ELSE
        RAISE EXCEPTION '❌ RLS is not enabled on some tables';
    END IF;
    
    -- Check if templates were inserted
    IF EXISTS (SELECT 1 FROM templates WHERE key IN ('ats-safe', 'modern-creative')) THEN
        RAISE NOTICE '✅ Default templates inserted successfully';
    ELSE
        RAISE EXCEPTION '❌ Default templates were not inserted';
    END IF;
    
    RAISE NOTICE '✅ Database setup completed successfully!';
    RAISE NOTICE 'Your AI Resume Optimizer is ready to use.';
END $$;

-- =====================================================
-- SETUP COMPLETE
-- =====================================================
-- 
-- 🎉 Congratulations! Your AI Resume Optimizer database is now fully configured.
--
-- What was created:
-- ✅ All database tables with proper relationships
-- ✅ Row Level Security (RLS) policies for data protection
-- ✅ Automatic profile creation on user signup
-- ✅ Default resume templates (ATS-Safe, Modern Creative)
-- ✅ Performance indexes for fast queries
-- ✅ Audit triggers for updated_at timestamps
--
-- Next steps:
-- 1. Your authentication should now work properly
-- 2. Visit http://localhost:3000/auth/signup to test
-- 3. Create an account and verify profile is created automatically
-- 4. Check that users can only access their own data
--
-- Troubleshooting:
-- - If you see permission errors, check RLS policies
-- - If signup fails, check the handle_new_user function
-- - If templates don't appear, check the templates table
--
-- =====================================================