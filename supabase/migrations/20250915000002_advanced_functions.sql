-- =====================================================
-- AI Resume Optimizer - Advanced Database Functions
-- Migration: 20250915000002_advanced_functions.sql
-- =====================================================

-- =====================================================
-- SUBSCRIPTION MANAGEMENT FUNCTIONS
-- =====================================================

-- Function to upgrade user to premium
CREATE OR REPLACE FUNCTION public.upgrade_to_premium(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    updated_rows INTEGER;
BEGIN
    UPDATE profiles
    SET
        subscription_tier = 'premium',
        max_optimizations = -1, -- unlimited
        updated_at = NOW()
    WHERE user_id = user_uuid;

    GET DIAGNOSTICS updated_rows = ROW_COUNT;

    IF updated_rows > 0 THEN
        -- Insert event for analytics
        INSERT INTO events (user_id, type, payload_data)
        VALUES (user_uuid, 'subscription_upgraded', jsonb_build_object(
            'tier', 'premium',
            'timestamp', NOW()
        ));

        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user subscription status with limits
CREATE OR REPLACE FUNCTION public.get_user_subscription_status(user_uuid UUID)
RETURNS JSONB AS $$
DECLARE
    user_profile RECORD;
    result JSONB;
BEGIN
    SELECT
        subscription_tier,
        optimizations_used,
        max_optimizations,
        created_at
    INTO user_profile
    FROM profiles
    WHERE user_id = user_uuid;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'error', 'User profile not found',
            'can_optimize', false
        );
    END IF;

    -- Calculate remaining optimizations
    result := jsonb_build_object(
        'subscription_tier', user_profile.subscription_tier,
        'optimizations_used', user_profile.optimizations_used,
        'max_optimizations', user_profile.max_optimizations,
        'can_optimize', CASE
            WHEN user_profile.subscription_tier = 'premium' OR user_profile.max_optimizations = -1 THEN true
            ELSE user_profile.optimizations_used < user_profile.max_optimizations
        END,
        'remaining_optimizations', CASE
            WHEN user_profile.subscription_tier = 'premium' OR user_profile.max_optimizations = -1 THEN -1
            ELSE GREATEST(0, user_profile.max_optimizations - user_profile.optimizations_used)
        END,
        'member_since', user_profile.created_at
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- OPTIMIZATION TRACKING FUNCTIONS
-- =====================================================

-- Function to start a new optimization (with limit checking)
CREATE OR REPLACE FUNCTION public.create_optimization(
    user_uuid UUID,
    resume_uuid UUID,
    jd_uuid UUID,
    initial_match_score DECIMAL DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    optimization_id UUID;
    can_proceed BOOLEAN;
BEGIN
    -- Check if user can create optimization
    SELECT public.check_subscription_limit(user_uuid) INTO can_proceed;

    IF NOT can_proceed THEN
        RAISE EXCEPTION 'Subscription limit exceeded. Upgrade to premium for unlimited optimizations.';
    END IF;

    -- Verify resume and job description belong to user
    IF NOT EXISTS (
        SELECT 1 FROM resumes WHERE id = resume_uuid AND user_id = user_uuid
    ) THEN
        RAISE EXCEPTION 'Resume not found or access denied';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM job_descriptions WHERE id = jd_uuid AND user_id = user_uuid
    ) THEN
        RAISE EXCEPTION 'Job description not found or access denied';
    END IF;

    -- Create optimization record
    INSERT INTO optimizations (
        user_id,
        resume_id,
        jd_id,
        match_score,
        status
    ) VALUES (
        user_uuid,
        resume_uuid,
        jd_uuid,
        COALESCE(initial_match_score, 0),
        'processing'
    )
    RETURNING id INTO optimization_id;

    -- Increment usage counter
    PERFORM public.increment_optimization_usage(user_uuid);

    -- Log event
    INSERT INTO events (user_id, type, payload_data)
    VALUES (user_uuid, 'optimization_started', jsonb_build_object(
        'optimization_id', optimization_id,
        'resume_id', resume_uuid,
        'jd_id', jd_uuid,
        'match_score', initial_match_score
    ));

    RETURN optimization_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to complete an optimization
CREATE OR REPLACE FUNCTION public.complete_optimization(
    optimization_uuid UUID,
    final_match_score DECIMAL,
    optimization_result JSONB
)
RETURNS BOOLEAN AS $$
DECLARE
    user_uuid UUID;
    updated_rows INTEGER;
BEGIN
    -- Get user_id for the optimization
    SELECT user_id INTO user_uuid
    FROM optimizations
    WHERE id = optimization_uuid AND status = 'processing';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Optimization not found or already completed';
    END IF;

    -- Update optimization with results
    UPDATE optimizations
    SET
        match_score = final_match_score,
        optimization_data = optimization_result,
        status = 'completed',
        updated_at = NOW()
    WHERE id = optimization_uuid;

    GET DIAGNOSTICS updated_rows = ROW_COUNT;

    IF updated_rows > 0 THEN
        -- Log completion event
        INSERT INTO events (user_id, type, payload_data)
        VALUES (user_uuid, 'optimization_completed', jsonb_build_object(
            'optimization_id', optimization_uuid,
            'final_match_score', final_match_score,
            'processing_time', NOW() - (
                SELECT created_at FROM optimizations WHERE id = optimization_uuid
            )
        ));

        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark optimization as failed
CREATE OR REPLACE FUNCTION public.fail_optimization(
    optimization_uuid UUID,
    error_message TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    user_uuid UUID;
    updated_rows INTEGER;
BEGIN
    -- Get user_id for the optimization
    SELECT user_id INTO user_uuid
    FROM optimizations
    WHERE id = optimization_uuid AND status = 'processing';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Optimization not found or not in processing state';
    END IF;

    -- Update optimization status
    UPDATE optimizations
    SET
        status = 'failed',
        optimization_data = jsonb_build_object('error', COALESCE(error_message, 'Unknown error')),
        updated_at = NOW()
    WHERE id = optimization_uuid;

    GET DIAGNOSTICS updated_rows = ROW_COUNT;

    IF updated_rows > 0 THEN
        -- Decrement usage counter since optimization failed
        UPDATE profiles
        SET optimizations_used = GREATEST(0, optimizations_used - 1)
        WHERE user_id = user_uuid;

        -- Log failure event
        INSERT INTO events (user_id, type, payload_data)
        VALUES (user_uuid, 'optimization_failed', jsonb_build_object(
            'optimization_id', optimization_uuid,
            'error_message', error_message
        ));

        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- ANALYTICS AND REPORTING FUNCTIONS
-- =====================================================

-- Function to get user dashboard statistics
CREATE OR REPLACE FUNCTION public.get_user_dashboard_stats(user_uuid UUID)
RETURNS JSONB AS $$
DECLARE
    stats JSONB;
    recent_activity JSONB;
BEGIN
    -- Get basic statistics
    SELECT jsonb_build_object(
        'total_resumes', (SELECT COUNT(*) FROM resumes WHERE user_id = user_uuid),
        'total_job_descriptions', (SELECT COUNT(*) FROM job_descriptions WHERE user_id = user_uuid),
        'total_optimizations', (SELECT COUNT(*) FROM optimizations WHERE user_id = user_uuid),
        'completed_optimizations', (SELECT COUNT(*) FROM optimizations WHERE user_id = user_uuid AND status = 'completed'),
        'average_match_score', (
            SELECT ROUND(AVG(match_score), 2)
            FROM optimizations
            WHERE user_id = user_uuid AND status = 'completed'
        ),
        'subscription_status', (
            SELECT jsonb_build_object(
                'tier', subscription_tier,
                'optimizations_used', optimizations_used,
                'max_optimizations', max_optimizations
            )
            FROM profiles WHERE user_id = user_uuid
        )
    ) INTO stats;

    -- Get recent activity
    SELECT jsonb_agg(
        jsonb_build_object(
            'type', type,
            'created_at', created_at,
            'payload', payload_data
        )
        ORDER BY created_at DESC
    ) INTO recent_activity
    FROM (
        SELECT type, created_at, payload_data
        FROM events
        WHERE user_id = user_uuid
        ORDER BY created_at DESC
        LIMIT 10
    ) recent;

    RETURN stats || jsonb_build_object('recent_activity', COALESCE(recent_activity, '[]'::jsonb));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- MAINTENANCE AND CLEANUP FUNCTIONS
-- =====================================================

-- Function to clean up failed/stale optimizations
CREATE OR REPLACE FUNCTION public.cleanup_stale_optimizations()
RETURNS INTEGER AS $$
DECLARE
    cleanup_count INTEGER;
    stale_threshold INTERVAL := '1 hour';
BEGIN
    -- Mark processing optimizations older than 1 hour as failed
    UPDATE optimizations
    SET
        status = 'failed',
        optimization_data = jsonb_build_object('error', 'Processing timeout'),
        updated_at = NOW()
    WHERE status = 'processing'
    AND created_at < NOW() - stale_threshold;

    GET DIAGNOSTICS cleanup_count = ROW_COUNT;

    -- Log cleanup event if any were cleaned up
    IF cleanup_count > 0 THEN
        INSERT INTO events (user_id, type, payload_data)
        VALUES (
            NULL, -- system event
            'system_cleanup',
            jsonb_build_object(
                'cleaned_optimizations', cleanup_count,
                'reason', 'stale_processing_timeout'
            )
        );
    END IF;

    RETURN cleanup_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create events table if it doesn't exist (for analytics)
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    payload_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on events table
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Events policies
CREATE POLICY IF NOT EXISTS "Users can insert own events" ON events
    FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY IF NOT EXISTS "Users can view own events" ON events
    FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

-- Service role can manage all events for analytics
CREATE POLICY IF NOT EXISTS "Service role can manage all events" ON events
    FOR ALL TO service_role USING (true);

-- Create index for events
CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);

-- =====================================================
-- VALIDATION AND TESTING
-- =====================================================

DO $$
DECLARE
    function_count INTEGER;
BEGIN
    -- Count created functions
    SELECT COUNT(*) INTO function_count
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
    AND p.proname IN (
        'upgrade_to_premium',
        'get_user_subscription_status',
        'create_optimization',
        'complete_optimization',
        'fail_optimization',
        'get_user_dashboard_stats',
        'cleanup_stale_optimizations'
    );

    IF function_count = 7 THEN
        RAISE NOTICE '✅ All advanced functions created successfully';
    ELSE
        RAISE WARNING '⚠️  Expected 7 functions, found %', function_count;
    END IF;

    RAISE NOTICE '';
    RAISE NOTICE '🚀 Advanced Functions Ready!';
    RAISE NOTICE '';
    RAISE NOTICE 'Subscription Management:';
    RAISE NOTICE '  - upgrade_to_premium()';
    RAISE NOTICE '  - get_user_subscription_status()';
    RAISE NOTICE '';
    RAISE NOTICE 'Optimization Workflow:';
    RAISE NOTICE '  - create_optimization()';
    RAISE NOTICE '  - complete_optimization()';
    RAISE NOTICE '  - fail_optimization()';
    RAISE NOTICE '';
    RAISE NOTICE 'Analytics & Maintenance:';
    RAISE NOTICE '  - get_user_dashboard_stats()';
    RAISE NOTICE '  - cleanup_stale_optimizations()';
    RAISE NOTICE '';
END $$;