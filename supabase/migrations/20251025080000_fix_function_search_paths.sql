-- Fix search_path security issues in functions
-- This migration adds SET search_path = public to all security definer functions

DROP FUNCTION IF EXISTS check_subscription_limit(UUID);
DROP FUNCTION IF EXISTS update_applications_updated_at();
DROP FUNCTION IF EXISTS increment_optimization_usage(UUID);
DROP FUNCTION IF EXISTS applications_update_search();
DROP FUNCTION IF EXISTS increment_optimizations_used(UUID, INTEGER);

-- Fix: check_subscription_limit
CREATE OR REPLACE FUNCTION check_subscription_limit(user_id_param UUID)
RETURNS TABLE(allowed BOOLEAN, current_count INTEGER, max_allowed INTEGER) AS $$
DECLARE
  user_plan TEXT;
  current_usage INTEGER;
  plan_limit INTEGER;
BEGIN
  SET search_path = public;

  -- Get user's plan type
  SELECT plan_type INTO user_plan
  FROM profiles
  WHERE user_id = user_id_param;

  -- Get current optimization count
  SELECT optimizations_used INTO current_usage
  FROM profiles
  WHERE user_id = user_id_param;

  -- Determine limit based on plan
  IF user_plan = 'free' THEN
    plan_limit := 1;
  ELSIF user_plan = 'premium' THEN
    plan_limit := 999999; -- Effectively unlimited
  ELSE
    plan_limit := 0;
  END IF;

  -- Return results
  RETURN QUERY SELECT
    (current_usage < plan_limit)::BOOLEAN,
    current_usage,
    plan_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix: update_applications_updated_at
CREATE OR REPLACE FUNCTION update_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  SET search_path = public;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix: increment_optimization_usage
CREATE OR REPLACE FUNCTION increment_optimization_usage(user_id_param UUID)
RETURNS profiles AS $$
DECLARE
  updated_profile profiles;
BEGIN
  SET search_path = public;

  UPDATE profiles
  SET optimizations_used = optimizations_used + 1
  WHERE user_id = user_id_param
  RETURNING * INTO updated_profile;

  RETURN updated_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix: applications_update_search
CREATE OR REPLACE FUNCTION applications_update_search()
RETURNS TRIGGER AS $$
BEGIN
  SET search_path = public;

  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.job_title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.company, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.notes, '')), 'C');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix: increment_optimizations_used (already fixed in previous migration, but ensuring search_path)
CREATE OR REPLACE FUNCTION increment_optimizations_used(
  user_id_param UUID,
  max_allowed INTEGER
)
RETURNS profiles AS $$
DECLARE
  updated_profile profiles;
BEGIN
  SET search_path = public;

  UPDATE profiles
  SET optimizations_used = optimizations_used + 1
  WHERE user_id = user_id_param
    AND plan_type = 'free'
    AND optimizations_used < max_allowed
  RETURNING * INTO updated_profile;

  RETURN updated_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments for documentation
COMMENT ON FUNCTION check_subscription_limit IS 'Checks if user has remaining optimizations. Uses SET search_path for security.';
COMMENT ON FUNCTION update_applications_updated_at IS 'Trigger to update updated_at timestamp. Uses SET search_path for security.';
COMMENT ON FUNCTION increment_optimization_usage IS 'Increments optimization usage counter. Uses SET search_path for security.';
COMMENT ON FUNCTION applications_update_search IS 'Updates full-text search vector. Uses SET search_path for security.';
COMMENT ON FUNCTION increment_optimizations_used IS 'Atomic quota increment with limit check. Uses SET search_path for security.';
