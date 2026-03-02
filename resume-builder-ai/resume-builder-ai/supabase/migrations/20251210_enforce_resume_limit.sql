-- =====================================================
-- Migration: Enforce Resume Optimization Limit
-- Date: 2025-12-10
-- Description:
--   Add database-level rate limiting to enforce 15 resume
--   optimization limit per user. Includes triggers to:
--   1. Prevent optimization creation when quota exceeded
--   2. Auto-increment counter when optimization completes
-- =====================================================

-- Step 1: Add database constraint to ensure users don't exceed limit
ALTER TABLE profiles
  ADD CONSTRAINT IF NOT EXISTS check_optimization_limit
  CHECK (optimizations_used <= max_optimizations);

-- Step 2: Update default max_optimizations for new users to 15
ALTER TABLE profiles
  ALTER COLUMN max_optimizations SET DEFAULT 15;

-- Step 3: Update existing users to have 15 as max if currently NULL or 0
UPDATE profiles
SET max_optimizations = 15
WHERE max_optimizations IS NULL OR max_optimizations = 0;

-- Step 4: Create trigger function to enforce limit on optimization creation
CREATE OR REPLACE FUNCTION check_optimization_quota()
RETURNS TRIGGER AS $$
DECLARE
  v_optimizations_used INTEGER;
  v_max_optimizations INTEGER;
BEGIN
  -- Get current usage and limit for this user
  SELECT optimizations_used, max_optimizations
  INTO v_optimizations_used, v_max_optimizations
  FROM profiles
  WHERE user_id = NEW.user_id;

  -- Check if user exists
  IF v_optimizations_used IS NULL THEN
    RAISE EXCEPTION 'User profile not found for user_id: %', NEW.user_id;
  END IF;

  -- Check if quota exceeded
  IF v_optimizations_used >= v_max_optimizations THEN
    RAISE EXCEPTION 'Optimization quota exceeded. You have used % out of % optimizations.',
      v_optimizations_used, v_max_optimizations;
  END IF;

  -- Allow the insert to proceed
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create trigger to enforce quota before insert
DROP TRIGGER IF EXISTS enforce_optimization_quota ON optimizations;
CREATE TRIGGER enforce_optimization_quota
  BEFORE INSERT ON optimizations
  FOR EACH ROW
  EXECUTE FUNCTION check_optimization_quota();

-- Step 6: Create trigger function to auto-increment counter when optimization completes
CREATE OR REPLACE FUNCTION increment_optimization_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Only increment when status changes to 'completed' (not on initial insert)
  IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status != 'completed') THEN
    UPDATE profiles
    SET optimizations_used = optimizations_used + 1,
        updated_at = NOW()
    WHERE user_id = NEW.user_id;

    RAISE NOTICE 'Incremented optimization count for user: %', NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Create trigger to auto-increment on optimization completion
DROP TRIGGER IF EXISTS auto_increment_optimization_count ON optimizations;
CREATE TRIGGER auto_increment_optimization_count
  AFTER INSERT OR UPDATE ON optimizations
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION increment_optimization_count();

-- Step 8: Add helpful comments
COMMENT ON FUNCTION check_optimization_quota() IS
  'Prevents users from creating optimizations when they have reached their quota limit';

COMMENT ON FUNCTION increment_optimization_count() IS
  'Auto-increments the optimizations_used counter when an optimization status changes to completed';

COMMENT ON CONSTRAINT check_optimization_limit ON profiles IS
  'Ensures optimizations_used never exceeds max_optimizations';

-- Step 9: Create admin function to reset user quota (for support/debugging)
CREATE OR REPLACE FUNCTION reset_user_optimization_quota(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET optimizations_used = 0,
      updated_at = NOW()
  WHERE user_id = target_user_id;

  RAISE NOTICE 'Reset optimization quota for user: %', target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION reset_user_optimization_quota IS
  'Admin function to reset a user''s optimization quota (use with caution)';
