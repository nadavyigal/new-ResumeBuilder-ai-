-- Migration: Atomic quota increment function
-- Purpose: Prevent race conditions in freemium quota checks
-- Created: 2025-01-24

-- Drop function if exists (for safe redeployment)
DROP FUNCTION IF EXISTS increment_optimizations_used(UUID, INTEGER);

-- Create atomic function to increment optimization counter
-- This function atomically checks quota and increments the counter
-- Returns the updated profile if successful, NULL if quota exceeded
CREATE OR REPLACE FUNCTION increment_optimizations_used(
  user_id_param UUID,
  max_allowed INTEGER
)
RETURNS profiles AS $$
DECLARE
  updated_profile profiles;
BEGIN
  -- Atomic update: only increment if under quota
  -- This prevents race conditions where multiple requests could bypass the limit
  UPDATE profiles
  SET
    optimizations_used = optimizations_used + 1,
    updated_at = NOW()
  WHERE
    user_id = user_id_param
    AND plan_type = 'free'
    AND optimizations_used < max_allowed
  RETURNING * INTO updated_profile;

  -- Return the updated profile (NULL if no row was updated)
  RETURN updated_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_optimizations_used(UUID, INTEGER) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION increment_optimizations_used IS
  'Atomically increments optimizations_used for free tier users. Returns NULL if quota exceeded or user is not on free plan.';
