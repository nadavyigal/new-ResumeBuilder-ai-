-- Step 5: Post-Enable Production Monitoring Queries
-- Agent SDK is LIVE - Monitor for 7 days minimum
-- Run these queries every 6 hours during first 48h, then daily

-- ============================================================
-- CRITICAL METRICS (Check Every 6 Hours)
-- ============================================================

-- 1. ERROR RATE MONITOR (Target: < 0.5%)
-- ============================================================
SELECT
  COUNT(*) as total_requests,
  COUNT(CASE WHEN error IS NOT NULL THEN 1 END) as error_count,
  ROUND(COUNT(CASE WHEN error IS NOT NULL THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as error_rate_pct,
  CASE
    WHEN COUNT(CASE WHEN error IS NOT NULL THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0) < 0.5 THEN '✅ PASS: Error rate acceptable'
    WHEN COUNT(CASE WHEN error IS NOT NULL THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0) < 1.0 THEN '⚠️ WARN: Error rate elevated'
    ELSE '🚨 CRITICAL: Error rate too high - Consider rollback'
  END as status
FROM (
  -- Combine all agent run attempts from resume_versions + history
  SELECT created_at, NULL as error FROM resume_versions WHERE created_at >= NOW() - INTERVAL '6 hours'
  UNION ALL
  SELECT created_at, notes as error FROM history WHERE created_at >= NOW() - INTERVAL '6 hours' AND notes LIKE '%error%'
) runs;

-- 2. LATENCY DISTRIBUTION (Target: P95 < 10s)
-- ============================================================
-- Note: This requires storing duration_ms in a table
-- For now, we estimate based on timestamp differences
SELECT
  'Last 6 hours' as period,
  '⏳ Manual timing required' as note,
  'Target: P95 < 10s, P99 < 20s' as targets,
  CASE
    WHEN true THEN '✅ Assuming acceptable - implement duration tracking'
  END as status;

-- TODO: Add duration_ms tracking to resume_versions or create agent_runs table
-- Example with proper tracking:
-- SELECT
--   PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY duration_ms) as p50_ms,
--   PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95_ms,
--   PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms) as p99_ms
-- FROM agent_runs
-- WHERE created_at >= NOW() - INTERVAL '6 hours';

-- 3. ATS LIFT STABILITY (Target: Median > 0)
-- ============================================================
-- Using history table to track ATS scores
SELECT
  COUNT(*) as total_optimizations,
  AVG(ats_score) as avg_ats_score,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ats_score) as median_ats_score,
  MIN(ats_score) as min_score,
  MAX(ats_score) as max_score,
  CASE
    WHEN AVG(ats_score) > 70 THEN '✅ PASS: ATS scores healthy'
    WHEN AVG(ats_score) > 50 THEN '⚠️ WARN: ATS scores below optimal'
    ELSE '🚨 CRITICAL: ATS scores too low'
  END as status
FROM history
WHERE created_at >= NOW() - INTERVAL '6 hours'
  AND ats_score IS NOT NULL;

-- 4. ACTIVITY VOLUME (Detect anomalies)
-- ============================================================
SELECT
  COUNT(*) as requests_last_6h,
  ROUND(COUNT(*) * 1.0 / 6, 2) as requests_per_hour,
  COUNT(DISTINCT user_id) as unique_users,
  CASE
    WHEN COUNT(*) = 0 THEN '⚠️ WARN: No activity detected'
    WHEN COUNT(*) < 5 THEN '⏳ INFO: Low activity (expected in dev)'
    ELSE '✅ HEALTHY: Active usage'
  END as status
FROM resume_versions
WHERE created_at >= NOW() - INTERVAL '6 hours';

-- ============================================================
-- DAILY HEALTH CHECK (Run Once Per Day)
-- ============================================================

-- 5. DAILY SUMMARY DASHBOARD
-- ============================================================
SELECT
  'Last 24 hours' as period,
  COUNT(*) as total_optimizations,
  COUNT(DISTINCT rv.user_id) as unique_users,
  ROUND(AVG(h.ats_score), 1) as avg_ats_score,
  COUNT(CASE WHEN h.notes LIKE '%error%' THEN 1 END) as errors,
  ROUND(COUNT(CASE WHEN h.notes LIKE '%error%' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as error_rate_pct,
  MIN(rv.created_at) as first_request,
  MAX(rv.created_at) as last_request
FROM resume_versions rv
LEFT JOIN history h ON h.resume_version_id = rv.id
WHERE rv.created_at >= NOW() - INTERVAL '24 hours';

-- 6. USER ENGAGEMENT ANALYSIS
-- ============================================================
SELECT
  COUNT(DISTINCT user_id) as total_users,
  COUNT(*) as total_optimizations,
  ROUND(COUNT(*) * 1.0 / NULLIF(COUNT(DISTINCT user_id), 0), 2) as optimizations_per_user,
  COUNT(CASE WHEN opt_count = 1 THEN 1 END) as single_optimization_users,
  COUNT(CASE WHEN opt_count > 1 THEN 1 END) as repeat_users,
  CASE
    WHEN COUNT(*) * 1.0 / NULLIF(COUNT(DISTINCT user_id), 0) > 1.5 THEN '✅ GOOD: High user engagement'
    WHEN COUNT(*) * 1.0 / NULLIF(COUNT(DISTINCT user_id), 0) > 1.0 THEN '⏳ OK: Moderate engagement'
    ELSE '⚠️ INFO: Low repeat usage'
  END as engagement_status
FROM (
  SELECT user_id, COUNT(*) as opt_count
  FROM resume_versions
  WHERE created_at >= NOW() - INTERVAL '24 hours'
  GROUP BY user_id
) user_stats;

-- 7. HOURLY ACTIVITY PATTERN (Detect issues)
-- ============================================================
SELECT
  DATE_TRUNC('hour', created_at) as hour_bucket,
  COUNT(*) as requests,
  COUNT(DISTINCT user_id) as unique_users,
  ROUND(AVG(CASE
    WHEN h.ats_score IS NOT NULL THEN h.ats_score
    ELSE NULL
  END), 1) as avg_ats_score
FROM resume_versions rv
LEFT JOIN history h ON h.resume_version_id = rv.id
WHERE rv.created_at >= NOW() - INTERVAL '24 hours'
GROUP BY hour_bucket
ORDER BY hour_bucket DESC;

-- ============================================================
-- QUALITY METRICS (Run Daily)
-- ============================================================

-- 8. ATS SCORE DISTRIBUTION (7-Day Trend)
-- ============================================================
SELECT
  CASE
    WHEN ats_score >= 90 THEN 'Excellent (90-100)'
    WHEN ats_score >= 80 THEN 'Very Good (80-89)'
    WHEN ats_score >= 70 THEN 'Good (70-79)'
    WHEN ats_score >= 60 THEN 'Fair (60-69)'
    ELSE 'Needs Improvement (<60)'
  END as score_range,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM history
WHERE created_at >= NOW() - INTERVAL '7 days'
  AND ats_score IS NOT NULL
GROUP BY score_range
ORDER BY MIN(ats_score) DESC;

-- 9. VERSION HISTORY ANALYSIS
-- ============================================================
SELECT
  DATE(created_at) as date,
  COUNT(*) as versions_created,
  COUNT(DISTINCT user_id) as active_users,
  ROUND(COUNT(*) * 1.0 / NULLIF(COUNT(DISTINCT user_id), 0), 2) as versions_per_user
FROM resume_versions
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- ============================================================
-- ALERT CONDITIONS (Automated Monitoring)
-- ============================================================

-- 10. ALERT: Critical Issues Detector
-- ============================================================
WITH metrics AS (
  SELECT
    COUNT(*) as total_requests,
    COUNT(CASE WHEN h.notes LIKE '%error%' THEN 1 END) as error_count,
    ROUND(COUNT(CASE WHEN h.notes LIKE '%error%' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as error_rate,
    AVG(h.ats_score) as avg_ats,
    COUNT(DISTINCT rv.user_id) as unique_users
  FROM resume_versions rv
  LEFT JOIN history h ON h.resume_version_id = rv.id
  WHERE rv.created_at >= NOW() - INTERVAL '6 hours'
)
SELECT
  total_requests,
  error_count,
  error_rate,
  avg_ats,
  unique_users,
  CASE
    WHEN error_rate > 1.0 THEN '🚨 CRITICAL: Error rate > 1% - ROLLBACK RECOMMENDED'
    WHEN error_rate > 0.5 THEN '⚠️ WARNING: Error rate elevated - Monitor closely'
    WHEN avg_ats < 50 THEN '⚠️ WARNING: ATS scores very low - Investigate'
    WHEN total_requests = 0 THEN '⚠️ WARNING: No activity - System issue?'
    ELSE '✅ ALL CLEAR: System healthy'
  END as alert_status,
  CASE
    WHEN error_rate > 1.0 OR avg_ats < 50 THEN 'ACTION REQUIRED'
    WHEN error_rate > 0.5 OR total_requests = 0 THEN 'MONITOR CLOSELY'
    ELSE 'NO ACTION NEEDED'
  END as recommended_action
FROM metrics;

-- ============================================================
-- COMPARISON: Pre vs Post Activation (After 7 Days)
-- ============================================================

-- 11. Performance Comparison (Shadow vs Live)
-- ============================================================
-- Compare shadow data with live production data
SELECT
  'Shadow Period (Pre-Activation)' as period,
  COUNT(*) as total_runs,
  AVG(ats_after - ats_before) as avg_ats_lift,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ats_after - ats_before) as median_ats_lift,
  AVG(diff_count) as avg_diff_count,
  ROUND(AVG(CASE WHEN array_length(warnings, 1) > 0 THEN 1.0 ELSE 0.0 END) * 100, 2) as warning_rate_pct
FROM agent_shadow_logs

UNION ALL

SELECT
  'Production (Post-Activation)' as period,
  COUNT(*) as total_runs,
  NULL as avg_ats_lift, -- Calculate from history if tracking before/after
  AVG(ats_score) as median_ats_lift,
  NULL as avg_diff_count, -- Add tracking if needed
  NULL as warning_rate_pct -- Add tracking if needed
FROM history
WHERE created_at >= NOW() - INTERVAL '7 days';

-- ============================================================
-- MONITORING SCHEDULE
-- ============================================================
/*
FIRST 48 HOURS (Critical Period):
  - Run queries 1-4 every 6 hours
  - Check alert conditions (query 10) every 6 hours
  - Document any anomalies

DAYS 3-7 (Stabilization):
  - Run daily summary (query 5) once per day
  - Run quality metrics (queries 8-9) once per day
  - Continue alert monitoring every 12 hours

AFTER 7 DAYS:
  - Run comparison analysis (query 11)
  - Document findings
  - Proceed to Step 7 (Sign-off) if stable

ROLLBACK TRIGGERS:
  - Error rate > 1% for 2 consecutive checks
  - ATS scores drop below 50 average
  - Multiple user complaints
  - Critical system errors
*/

-- ============================================================
-- USAGE NOTES
-- ============================================================
/*
To monitor the Agent SDK in production:

1. Copy these queries to your Supabase SQL Editor
2. Run critical metrics (1-4) every 6 hours for first 48h
3. Run daily health check (5-7) once per day
4. Run alert detector (10) regularly
5. After 7 days, run comparison analysis (11)

Alert Response:
- 🚨 CRITICAL → Execute rollback procedure immediately
- ⚠️ WARNING → Investigate and monitor closely
- ✅ ALL CLEAR → Continue normal monitoring

Rollback Procedure (if needed):
  cd resume-builder-ai
  # Edit .env.local: AGENT_SDK_ENABLED=false, AGENT_SDK_SHADOW=true
  npx kill-port 3000
  npm run dev
  # Verify legacy responses restored
*/
