-- Agent SDK Shadow Mode Monitoring Queries
-- Step 1: 48h Shadow Mode Monitoring (Started: 2025-10-23)

-- ============================================================
-- 1. Shadow Log Summary (Last 48 Hours)
-- ============================================================
SELECT
  COUNT(*) as total_runs,
  AVG(ats_after - ats_before) as avg_ats_lift,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ats_after - ats_before) as median_ats_lift,
  AVG(diff_count) as avg_diff_count,
  COUNT(CASE WHEN array_length(warnings, 1) > 0 THEN 1 END) as runs_with_warnings,
  COUNT(DISTINCT user_id) as unique_users,
  MIN(created_at) as first_run,
  MAX(created_at) as last_run
FROM agent_shadow_logs
WHERE created_at >= NOW() - INTERVAL '48 hours';

-- ============================================================
-- 2. ATS Score Distribution Analysis
-- ============================================================
SELECT
  CASE
    WHEN ats_after - ats_before >= 10 THEN 'Excellent (+10 or more)'
    WHEN ats_after - ats_before >= 5 THEN 'Good (+5 to +9)'
    WHEN ats_after - ats_before >= 0 THEN 'Neutral (0 to +4)'
    WHEN ats_after - ats_before >= -5 THEN 'Slight Decline (-1 to -5)'
    ELSE 'Significant Decline (-6 or worse)'
  END as ats_category,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM agent_shadow_logs
WHERE created_at >= NOW() - INTERVAL '48 hours'
  AND ats_before IS NOT NULL
  AND ats_after IS NOT NULL
GROUP BY ats_category
ORDER BY MIN(ats_after - ats_before) DESC;

-- ============================================================
-- 3. Intent Breakdown
-- ============================================================
SELECT
  UNNEST(intent) as intent_type,
  COUNT(*) as frequency,
  AVG(ats_after - ats_before) as avg_ats_lift,
  AVG(diff_count) as avg_diffs
FROM agent_shadow_logs
WHERE created_at >= NOW() - INTERVAL '48 hours'
GROUP BY intent_type
ORDER BY frequency DESC;

-- ============================================================
-- 4. Warning Analysis
-- ============================================================
SELECT
  UNNEST(warnings) as warning_message,
  COUNT(*) as occurrence_count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM agent_shadow_logs WHERE created_at >= NOW() - INTERVAL '48 hours'), 2) as percentage
FROM agent_shadow_logs
WHERE created_at >= NOW() - INTERVAL '48 hours'
  AND array_length(warnings, 1) > 0
GROUP BY warning_message
ORDER BY occurrence_count DESC;

-- ============================================================
-- 5. Diff Stability Check
-- ============================================================
SELECT
  CASE
    WHEN diff_count = 0 THEN 'No changes'
    WHEN diff_count BETWEEN 1 AND 5 THEN 'Minor (1-5 diffs)'
    WHEN diff_count BETWEEN 6 AND 15 THEN 'Moderate (6-15 diffs)'
    WHEN diff_count BETWEEN 16 AND 30 THEN 'Significant (16-30 diffs)'
    ELSE 'Extensive (31+ diffs)'
  END as diff_category,
  COUNT(*) as count,
  AVG(ats_after - ats_before) as avg_ats_lift
FROM agent_shadow_logs
WHERE created_at >= NOW() - INTERVAL '48 hours'
GROUP BY diff_category
ORDER BY MIN(diff_count);

-- ============================================================
-- 6. Hourly Activity Pattern
-- ============================================================
SELECT
  DATE_TRUNC('hour', created_at) as hour_bucket,
  COUNT(*) as runs,
  AVG(ats_after - ats_before) as avg_ats_lift,
  AVG(diff_count) as avg_diffs,
  COUNT(CASE WHEN array_length(warnings, 1) > 0 THEN 1 END) as warnings_count
FROM agent_shadow_logs
WHERE created_at >= NOW() - INTERVAL '48 hours'
GROUP BY hour_bucket
ORDER BY hour_bucket DESC;

-- ============================================================
-- 7. Quality Gate Check (For Step 3 Evaluation)
-- ============================================================
WITH metrics AS (
  SELECT
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ats_after - ats_before) as median_ats_lift,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY diff_count) as p95_diff_count,
    AVG(CASE WHEN array_length(warnings, 1) > 0 THEN 1.0 ELSE 0.0 END) as warning_rate
  FROM agent_shadow_logs
  WHERE created_at >= NOW() - INTERVAL '48 hours'
    AND ats_before IS NOT NULL
    AND ats_after IS NOT NULL
)
SELECT
  median_ats_lift,
  p95_diff_count,
  ROUND(warning_rate * 100, 2) as warning_percentage,
  CASE
    WHEN median_ats_lift > 0 THEN '✅ PASS: Median ATS lift is positive'
    ELSE '❌ FAIL: Median ATS lift is not positive'
  END as ats_gate,
  CASE
    WHEN p95_diff_count < 50 THEN '✅ PASS: p95 diff count is stable'
    ELSE '❌ FAIL: p95 diff count is too high'
  END as diff_gate,
  CASE
    WHEN warning_rate < 0.20 THEN '✅ PASS: Warning rate is acceptable'
    ELSE '⚠️ WARN: Warning rate is elevated'
  END as warning_gate
FROM metrics;

-- ============================================================
-- 8. Recent Shadow Logs (Last 20)
-- ============================================================
SELECT
  created_at,
  user_id,
  intent,
  ats_before,
  ats_after,
  ats_after - ats_before as ats_lift,
  diff_count,
  warnings
FROM agent_shadow_logs
WHERE created_at >= NOW() - INTERVAL '48 hours'
ORDER BY created_at DESC
LIMIT 20;

-- ============================================================
-- USAGE NOTES:
-- ============================================================
-- Run these queries daily during the 48h shadow period
-- Focus on:
--   1. Median ATS lift should be > 0
--   2. Diff count p95 should be stable (< 50)
--   3. Warning rate should be < 20%
--
-- If all gates pass after 48h, proceed to Step 4 (Controlled Activation)
-- If any gate fails, investigate and address issues before enabling
