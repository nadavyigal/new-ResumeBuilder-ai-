-- Disable Free Tier Limits
-- This migration modifies the subscription limit functions to always allow optimizations
-- Useful for development and testing

-- Modify check_subscription_limit to always return TRUE (bypass limits)
CREATE OR REPLACE FUNCTION public.check_subscription_limit(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- DISABLED: Always return TRUE to bypass subscription limits
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Modify increment_optimization_usage to always succeed without incrementing
CREATE OR REPLACE FUNCTION public.increment_optimization_usage(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- DISABLED: Always return TRUE without incrementing counter
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Optionally: Set all users to premium (commented out - uncomment if needed)
-- UPDATE profiles SET subscription_tier = 'premium', max_optimizations = -1;

-- Reset optimization counters for all users (commented out - uncomment if needed)
-- UPDATE profiles SET optimizations_used = 0;
