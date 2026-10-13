-- Fix search_path security issues in functions
-- This migration adds SET search_path = public to all security definer functions

-- check_subscription_limit: removed. This block redefined the function as
-- RETURNS TABLE(...) with the same (uuid) signature as the boolean version from
-- 20250915000000_complete_schema_setup.sql, which Postgres rejects ("cannot change
-- return type of existing function"), so every fresh replay stopped here.
-- Production never had the TABLE version: it still has
-- check_subscription_limit(user_uuid uuid) RETURNS boolean (checked 2026-10-13),
-- redefined with search_path by 20260104144852_remote_schema.sql.
-- Fix: update_applications_updated_at
CREATE OR REPLACE FUNCTION update_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  SET search_path = public;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- increment_optimization_usage: removed for the same reason. This block
-- redefined it as RETURNS profiles over the same (uuid) signature; Postgres
-- rejects the return-type change. Production still has
-- increment_optimization_usage(user_uuid uuid) RETURNS boolean (checked
-- 2026-10-13), defined with search_path by 20260104144852_remote_schema.sql.
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
