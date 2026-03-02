# Step 5: Post-Enable Monitoring

**Start Date**: 2025-10-23 (Agent SDK Activated)
**Duration**: 7 days minimum
**Status**: ✅ ACTIVE

---

## Overview

The Agent SDK is now LIVE in production. This document outlines the monitoring procedures for the next 7 days to ensure stable operation and validate the rollout success.

---

## Monitoring Schedule

### Phase 1: Critical Period (First 48 Hours)
**Frequency**: Every 6 hours
**Focus**: Detect and respond to critical issues immediately

| Time | Actions | Queries to Run |
|------|---------|----------------|
| Every 6h | Check critical metrics | Queries 1-4, 10 |
| Every 12h | Review server logs | Check for errors/warnings |
| Every 24h | Daily summary | Query 5 |

### Phase 2: Stabilization (Days 3-7)
**Frequency**: Daily
**Focus**: Validate sustained performance

| Time | Actions | Queries to Run |
|------|---------|----------------|
| Daily | Health check | Queries 5-9 |
| Daily | Alert check | Query 10 |
| Daily | Review trends | Compare with previous days |

### Phase 3: Evaluation (Day 7+)
**Frequency**: Once
**Focus**: Compare pre/post activation performance

| Time | Actions | Queries to Run |
|------|---------|----------------|
| Day 7 | Final analysis | Query 11 (comparison) |
| Day 7 | Documentation | Capture findings |
| Day 7 | Sign-off decision | Proceed to Step 7 |

---

## Critical Metrics to Monitor

### 1. Error Rate (Target: < 0.5%)

**What to Check**:
```sql
-- Run query 1 from step5-production-monitoring.sql
```

**Success Criteria**:
- ✅ Error rate < 0.5% → System healthy
- ⚠️ Error rate 0.5-1.0% → Monitor closely
- 🚨 Error rate > 1.0% → Consider rollback

**Response Actions**:
| Condition | Action |
|-----------|--------|
| < 0.5% | Continue normal monitoring |
| 0.5-1.0% | Investigate errors, increase monitoring frequency |
| > 1.0% for 2 checks | Execute rollback procedure |

---

### 2. P95 Latency (Target: < 10s)

**What to Check**:
- Response times for API requests
- Current implementation requires manual timing
- **TODO**: Add duration tracking to resume_versions table

**Success Criteria**:
- ✅ P95 < 10s → Excellent performance
- ⚠️ P95 10-15s → Acceptable, monitor
- 🚨 P95 > 15s → Performance issue

**How to Measure** (Manual):
1. Open browser DevTools → Network tab
2. Make optimization request
3. Check request duration
4. Record p95 over 10 samples

---

### 3. ATS Lift Stability (Target: Median > 0)

**What to Check**:
```sql
-- Run query 3 from step5-production-monitoring.sql
```

**Success Criteria**:
- ✅ Average ATS > 70 → Excellent quality
- ⚠️ Average ATS 50-70 → Acceptable
- 🚨 Average ATS < 50 → Quality issue

**Response Actions**:
| Condition | Action |
|-----------|--------|
| Avg > 70 | System performing well |
| Avg 50-70 | Review ATS scoring logic |
| Avg < 50 | Investigate algorithm, consider rollback |

---

### 4. Warning Rate (Target: < 20%)

**What to Track**:
- Fallback activations
- Missing dependencies
- Degraded mode operations

**Success Criteria**:
- ✅ Warning rate < 10% → Excellent
- ⚠️ Warning rate 10-20% → Acceptable
- 🚨 Warning rate > 20% → Too many fallbacks

---

## Automated Alert System

### Alert Query (Run Every 6 Hours)

```sql
-- Run query 10 from step5-production-monitoring.sql
```

**Alert Levels**:

| Status | Condition | Action |
|--------|-----------|--------|
| 🚨 CRITICAL | Error rate > 1% OR ATS < 50 | **Rollback immediately** |
| ⚠️ WARNING | Error rate > 0.5% OR No activity | Monitor closely, investigate |
| ✅ ALL CLEAR | All metrics healthy | Continue normal operations |

---

## Monitoring Dashboard

### Daily Health Check (Run Once Per Day)

**Query**: #5 from `step5-production-monitoring.sql`

**Expected Output**:
```
Period: Last 24 hours
Total optimizations: 50-200 (varies by usage)
Unique users: 20-100
Average ATS score: 70-85
Errors: 0-2
Error rate: < 0.5%
```

**Interpretation**:
- High optimization count = Good user engagement
- High ATS scores = Quality maintained
- Low error rate = System stable

---

### Weekly Trend Analysis (Day 7)

**Query**: #11 from `step5-production-monitoring.sql`

**Compare**:
- Shadow period metrics (Step 2)
- Production metrics (Step 5)

**Success Indicators**:
- ATS scores match or exceed shadow period
- Error rate remains low
- No significant degradation
- User engagement stable or increasing

---

## Rollback Procedure (If Needed)

### When to Rollback

Trigger immediate rollback if **any** of these occur:
- 🚨 Error rate > 1% for 2 consecutive 6h checks
- 🚨 Average ATS score < 50 for 24 hours
- 🚨 Multiple critical system errors
- 🚨 User complaints about quality degradation
- 🚨 Database connection failures

### Rollback Steps (< 2 Minutes)

```bash
# 1. Edit .env.local
cd resume-builder-ai
# Change:
#   AGENT_SDK_ENABLED=true  → false
#   AGENT_SDK_SHADOW=false  → true

# 2. Restart server
npx kill-port 3000
npm run dev

# 3. Verify rollback
curl http://localhost:3000/api/agent/run \
  -H "Content-Type: application/json" \
  -d '{"command":"test"}'
# Expected: {"error":"Unauthorized"} or {"shadow":true,"legacy":{...}}

# 4. Monitor for 1 hour
# Confirm legacy responses restored
# Verify error rate drops
```

### Post-Rollback Actions
1. Keep shadow mode running (collect telemetry)
2. Investigate root cause using shadow logs
3. Fix identified issues
4. Re-run quality gates (Step 3)
5. Schedule new activation attempt

---

## Monitoring Log Template

### 6-Hour Check Log

```
Date: 2025-10-23
Time: 16:00
Period: Last 6 hours

CRITICAL METRICS:
✅ Error Rate: 0.2% (Target: < 0.5%)
✅ P95 Latency: 6.8s (Target: < 10s)
✅ ATS Average: 78 (Target: > 70)
✅ Activity: 15 requests, 8 unique users

ALERT STATUS: ✅ ALL CLEAR

NOTES:
- No issues detected
- Performance within targets
- User engagement healthy

NEXT CHECK: 22:00
```

### Daily Summary Log

```
Date: 2025-10-23
Period: Last 24 hours

SUMMARY:
- Total Optimizations: 85
- Unique Users: 32
- Average ATS Score: 76
- Error Count: 1
- Error Rate: 1.2%

TRENDS:
📈 User engagement up 15% from yesterday
📊 ATS scores stable around 76
📉 Error rate slightly elevated (investigate)

ACTION ITEMS:
1. Investigate error from user_id: abc-123
2. Monitor error rate at next check
3. Continue normal monitoring

STATUS: ✅ HEALTHY (monitor error rate)
```

---

## Success Criteria (Day 7 Evaluation)

### Metrics to Evaluate

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Average Error Rate (7d) | < 0.5% | ___ % | ___ |
| P95 Latency | < 10s | ___ s | ___ |
| Average ATS Score | > 70 | ___ | ___ |
| Warning Rate | < 20% | ___ % | ___ |
| User Engagement | Stable/Growing | ___ | ___ |
| Critical Issues | 0 | ___ | ___ |

### Decision Matrix

| Condition | Decision |
|-----------|----------|
| All metrics ✅ | ✅ Proceed to Step 7 (Sign-off) |
| 1-2 metrics ⚠️ | ⚠️ Extend monitoring 3-7 days |
| Any metric 🚨 | 🚨 Rollback and investigate |

---

## Monitoring Tools

### SQL Queries
**Location**: `monitoring/step5-production-monitoring.sql`
- Query 1-4: Critical metrics (every 6h)
- Query 5-7: Daily health check
- Query 8-9: Quality trends
- Query 10: Alert detector
- Query 11: Pre/post comparison

### Server Logs
**Location**: Terminal running `npm run dev`
**Watch For**:
```
✅ Good signs:
- {"category":"agent_run", "message":"agent run completed"}
- No uncaught exceptions
- Consistent response times

⚠️ Warning signs:
- {"category":"tool_error", ...}
- {"category":"storage_warn", ...}
- Frequent fallback activations

🚨 Critical signs:
- Uncaught exceptions
- Database connection errors
- Multiple consecutive failures
```

### Browser DevTools
**Network Tab**:
- Monitor /api/agent/run response times
- Check response structure (AgentResult)
- Verify no 500 errors

**Console**:
- Watch for JavaScript errors
- Check for missing resources
- Monitor render performance

---

## Communication Plan

### Daily Status Updates (Optional)

**Template**:
```
Agent SDK Daily Status - Day X/7

Status: ✅ Healthy / ⚠️ Monitoring / 🚨 Issues

Metrics (24h):
- Optimizations: XX
- Error Rate: X.X%
- Avg ATS: XX
- Users: XX

Issues: None / [describe]

Action: Continue monitoring / [action needed]

Next Review: [date/time]
```

### Escalation Path

| Issue Level | Contact | Response Time |
|-------------|---------|---------------|
| 🚨 Critical | Immediate team notification | < 30 minutes |
| ⚠️ Warning | Daily standup / Slack | < 4 hours |
| ✅ Normal | Weekly review | N/A |

---

## Step 5 Completion Checklist

- [ ] Monitoring queries documented and accessible
- [ ] 6-hour checks scheduled for first 48h
- [ ] Daily summaries logged
- [ ] Alert thresholds configured
- [ ] Rollback procedure tested and ready
- [ ] Team notified of monitoring period
- [ ] 7-day evaluation scheduled

---

## Next Steps

After 7 days of stable monitoring:
1. Run final comparison analysis (Query 11)
2. Document findings and metrics
3. Capture lessons learned
4. Proceed to **Step 7: Report & Sign-Off**
5. Consider disabling shadow mode permanently (if not already)

---

**Monitoring Start**: 2025-10-23
**Expected Completion**: 2025-10-30
**Status**: ✅ ACTIVE - Day 1/7

**Note**: This is Day 1 of the 7-day monitoring period. The Agent SDK is live and performing well based on initial activation results.
