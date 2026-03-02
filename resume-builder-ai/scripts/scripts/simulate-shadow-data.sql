-- Simulate Shadow Data for Testing Step 2
-- This simulates 48 hours of shadow telemetry data for testing the rollout process
-- Run this ONLY in development/staging environments

-- NOTE: In production, this data will be collected naturally from real traffic
-- This script helps validate the monitoring queries and quality gates

BEGIN;

-- Clear any existing test data (optional)
-- DELETE FROM agent_shadow_logs WHERE user_id LIKE 'test-%';

-- Simulate successful agent runs with positive ATS lift (80% of runs)
INSERT INTO agent_shadow_logs (user_id, intent, ats_before, ats_after, diff_count, warnings, created_at)
SELECT
  'test-user-' || (random() * 100)::int,
  ARRAY['optimize']::text[],
  (random() * 30 + 50)::int, -- Before: 50-80
  (random() * 20 + 70)::int, -- After: 70-90 (positive lift)
  (random() * 10 + 3)::int,  -- 3-13 diffs
  ARRAY[]::text[],           -- No warnings
  NOW() - (random() * INTERVAL '48 hours')
FROM generate_series(1, 40);

-- Simulate excellent results (10% of runs)
INSERT INTO agent_shadow_logs (user_id, intent, ats_before, ats_after, diff_count, warnings, created_at)
SELECT
  'test-user-' || (random() * 100)::int,
  ARRAY['design', 'optimize']::text[],
  (random() * 20 + 50)::int, -- Before: 50-70
  (random() * 15 + 85)::int, -- After: 85-100 (excellent lift)
  (random() * 8 + 5)::int,   -- 5-13 diffs
  ARRAY[]::text[],
  NOW() - (random() * INTERVAL '48 hours')
FROM generate_series(1, 5);

-- Simulate runs with warnings but still positive (5% of runs)
INSERT INTO agent_shadow_logs (user_id, intent, ats_before, ats_after, diff_count, warnings, created_at)
SELECT
  'test-user-' || (random() * 100)::int,
  ARRAY['optimize']::text[],
  (random() * 25 + 55)::int, -- Before: 55-80
  (random() * 15 + 75)::int, -- After: 75-90
  (random() * 15 + 8)::int,  -- 8-23 diffs
  ARRAY['ATS score used a safe fallback due to a transient issue.']::text[],
  NOW() - (random() * INTERVAL '48 hours')
FROM generate_series(1, 3);

-- Simulate neutral results (3% of runs)
INSERT INTO agent_shadow_logs (user_id, intent, ats_before, ats_after, diff_count, warnings, created_at)
SELECT
  'test-user-' || (random() * 100)::int,
  ARRAY['strengthen']::text[],
  (random() * 20 + 60)::int, -- Before: 60-80
  (random() * 20 + 60)::int, -- After: 60-80 (neutral)
  (random() * 5 + 2)::int,   -- 2-7 diffs
  ARRAY[]::text[],
  NOW() - (random() * INTERVAL '48 hours')
FROM generate_series(1, 2);

-- Simulate design-focused runs (varying intents)
INSERT INTO agent_shadow_logs (user_id, intent, ats_before, ats_after, diff_count, warnings, created_at)
SELECT
  'test-user-' || (random() * 100)::int,
  ARRAY['design', 'layout']::text[],
  (random() * 25 + 55)::int, -- Before: 55-80
  (random() * 20 + 70)::int, -- After: 70-90
  (random() * 6 + 4)::int,   -- 4-10 diffs (mostly style changes)
  CASE
    WHEN random() < 0.15 THEN ARRAY['Preview PDF path is a fallback. You can retry to regenerate.']::text[]
    ELSE ARRAY[]::text[]
  END,
  NOW() - (random() * INTERVAL '48 hours')
FROM generate_series(1, 10);

COMMIT;

-- Verify insertion
SELECT
  'Total shadow logs inserted: ' || COUNT(*) as summary,
  MIN(created_at) as earliest,
  MAX(created_at) as latest
FROM agent_shadow_logs
WHERE user_id LIKE 'test-%';

-- Quick quality gate preview
SELECT
  ROUND(AVG(ats_after - ats_before), 2) as avg_ats_lift,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ats_after - ats_before) as median_ats_lift,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY diff_count) as p95_diff_count,
  ROUND(AVG(CASE WHEN array_length(warnings, 1) > 0 THEN 1.0 ELSE 0.0 END) * 100, 2) as warning_rate_pct
FROM agent_shadow_logs
WHERE user_id LIKE 'test-%';
