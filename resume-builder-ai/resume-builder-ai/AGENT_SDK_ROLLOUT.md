# Agent SDK Rollout Status

## 🚀 Current Status: Step 1 - Shadow Mode Active

**Start Date**: 2025-10-23
**Target Duration**: 48 hours
**Expected Completion**: 2025-10-25

---

## Step 1: Shadow Mode Enablement ✅ ACTIVE

### Configuration
```env
AGENT_SDK_ENABLED=false      # Agent SDK not yet live
AGENT_SDK_SHADOW=true        # 🟢 Shadow mode ACTIVE
AGENT_SDK_MODEL=gpt-4o-mini
```

### What's Happening
- ✅ All requests to `/api/agent/run` return **legacy optimizer responses** (users see no change)
- ✅ Agent SDK runs in **background** (fire-and-forget) for every request
- ✅ Telemetry logged to `agent_shadow_logs` table for analysis
- ✅ No user-facing changes or disruptions

### Monitoring Metrics
Shadow telemetry captures:
- `intent[]` - Detected user intents
- `ats_before` - ATS score before agent processing
- `ats_after` - ATS score after agent processing
- `diff_count` - Number of diffs applied
- `warnings[]` - Any degradation warnings

### How to Monitor
1. Run queries from `monitoring/shadow-mode-queries.sql`
2. Check daily (at least once per 24h):
   ```sql
   -- Quick health check
   SELECT COUNT(*), AVG(ats_after - ats_before) as avg_lift
   FROM agent_shadow_logs
   WHERE created_at >= NOW() - INTERVAL '24 hours';
   ```
3. Review full metrics dashboard before Step 2

---

## Step 2: Shadow Telemetry Monitoring ⏳ PENDING

**Prerequisites**: 48h of shadow data collected
**Target Start**: 2025-10-25

### Quality Gates (Must Pass All)
- ✅ **ATS Lift**: Median `ats_after > ats_before` (positive improvement)
- ✅ **Diff Stability**: P95 `diff_count < 50` (changes are reasonable)
- ✅ **Warning Rate**: < 20% of runs have warnings

### Evaluation Queries
Run query #7 from `monitoring/shadow-mode-queries.sql`:
```sql
-- Quality Gate Check
WITH metrics AS (
  SELECT
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ats_after - ats_before) as median_ats_lift,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY diff_count) as p95_diff_count,
    AVG(CASE WHEN array_length(warnings, 1) > 0 THEN 1.0 ELSE 0.0 END) as warning_rate
  FROM agent_shadow_logs
  WHERE created_at >= NOW() - INTERVAL '48 hours'
)
SELECT * FROM metrics;
```

### Decision Matrix
| Median ATS Lift | P95 Diff Count | Warning Rate | Decision |
|----------------|----------------|--------------|----------|
| > 0            | < 50           | < 20%        | ✅ **Proceed to Step 3** |
| ≤ 0            | Any            | Any          | ❌ Investigate & fix |
| Any            | ≥ 50           | Any          | ⚠️ Review diff logic |
| Any            | Any            | ≥ 20%        | ⚠️ Review fallbacks |

---

## Step 3: Nightly Quality Gates ⏳ NOT STARTED

**Prerequisites**: Step 2 quality gates passed
**Duration**: Ongoing during rollout

### Test Suite
Run daily before any configuration changes:

```bash
# 1. Contract tests - ensure schema stability
npm run test:contracts

# 2. Benchmark tests - validate SLA and ATS lift
npm run bench:agent -- --ci

# 3. Check for regressions
# - p95 latency < 10s
# - ATS lift stable (median > 0)
# - No contract failures
```

### Alert Conditions
- ❌ Any contract test fails → **BLOCK** activation
- ⚠️ Benchmark ATS lift drops → Investigate before activation
- ⚠️ P95 latency > 10s → Optimize before activation

---

## Step 4: Controlled Activation ⏳ NOT STARTED

**Prerequisites**: All quality gates green for 48h

### Activation Checklist
- [ ] Step 2 quality gates: ✅ ALL PASS
- [ ] Step 3 nightly tests: ✅ 2 consecutive days passing
- [ ] Team notification: Freeze window announced
- [ ] Rollback plan: Documented and tested
- [ ] Monitoring: Dashboard ready for real-time tracking

### Configuration Change
```env
AGENT_SDK_ENABLED=true       # 🚀 ACTIVATE
AGENT_SDK_SHADOW=false       # Disable shadow mode
AGENT_SDK_MODEL=gpt-4o-mini
```

### Deployment Steps
1. Update `.env.local` with above config
2. Restart server: `npm run dev` or redeploy
3. Test single request manually
4. Monitor logs for 15 minutes
5. Confirm `AgentResult` shape in responses
6. Enable for all traffic

### Verification
```bash
# Test endpoint returns AgentResult (not legacy)
curl -X POST http://localhost:3004/api/agent/run \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"command": "test", "resume_json": {...}}'

# Expected response shape:
# {
#   "intent": "...",
#   "actions": [...],
#   "diffs": [...],
#   "artifacts": {...},
#   "ats_report": {...},
#   "history_record": {...},
#   "ui_prompts": [...]
# }
```

---

## Step 5: Post-Enable Monitoring ⏳ NOT STARTED

**Duration**: First 7 days after activation

### Real-Time Metrics
Monitor every 6 hours:
1. **Error Rate**: < 0.5% (target)
2. **P95 Latency**: < 10s
3. **ATS Lift**: Median remains positive
4. **Warning Rate**: < 20%

### Monitoring Queries
```sql
-- Error rate (last 6h)
SELECT
  COUNT(CASE WHEN error IS NOT NULL THEN 1 END) * 100.0 / COUNT(*) as error_rate_pct
FROM agent_runs
WHERE created_at >= NOW() - INTERVAL '6 hours';

-- Latency distribution
SELECT
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY duration_ms) as p50_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95_ms,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms) as p99_ms
FROM agent_runs
WHERE created_at >= NOW() - INTERVAL '6 hours';
```

### Alert Thresholds
- 🚨 **Critical**: Error rate > 1% → Consider rollback
- ⚠️ **Warning**: P95 latency > 15s → Investigate
- ⚠️ **Warning**: Median ATS lift < 0 → Review agent logic

---

## Step 6: Instant Rollback Path ✅ READY

### When to Rollback
Trigger immediate rollback if:
- Error rate exceeds 1%
- P95 latency exceeds 20s
- ATS lift median becomes negative
- User reports of degraded quality

### Rollback Procedure (< 2 minutes)
```bash
# 1. Flip flags (IMMEDIATELY)
# Edit .env.local:
AGENT_SDK_ENABLED=false      # ❌ DISABLE
AGENT_SDK_SHADOW=true        # Re-enable shadow mode

# 2. Restart server
npm run dev  # or trigger redeployment

# 3. Verify legacy responses restored
curl -X POST http://localhost:3004/api/agent/run ... | jq .legacy

# 4. Keep shadow telemetry running
# - Continue collecting data for root cause analysis
# - Review agent_shadow_logs for issues
```

### Post-Rollback
- Analyze shadow logs to identify root cause
- Fix issues in agent runtime/tools
- Re-run quality gates
- Schedule new activation attempt

---

## Step 7: Report and Sign-Off ⏳ NOT STARTED

**Prerequisites**: 7 days of stable production operation

### Success Metrics Summary
Document final metrics:
- **ATS Lift**: Median improvement over 7 days
- **Latency**: P95, P99 distribution
- **Error Rate**: Actual vs target (< 0.5%)
- **Warning Rate**: Degradation frequency
- **User Impact**: Support tickets, feedback

### Lessons Learned
Capture for future rollouts:
- What went well
- What could be improved
- Edge cases discovered
- Performance optimizations applied

### Final Sign-Off Checklist
- [ ] All metrics meet or exceed targets
- [ ] No outstanding critical bugs
- [ ] Documentation updated
- [ ] Team trained on new system
- [ ] Monitoring dashboards finalized
- [ ] Shadow mode disabled permanently

---

## Quick Reference

### Current Configuration
```bash
# Check current flags
cd resume-builder-ai
grep AGENT_SDK .env.local

# Expected output (Step 1):
# AGENT_SDK_ENABLED=false
# AGENT_SDK_SHADOW=true
# AGENT_SDK_MODEL=gpt-4o-mini
```

### Key Files
- **Config**: `.env.local`
- **API Route**: `src/app/api/agent/run/route.ts`
- **Monitoring**: `monitoring/shadow-mode-queries.sql`
- **Tests**: `npm run test:contracts`, `npm run bench:agent`

### Support
- **Plan**: `plan.md` (full rollout details)
- **Tests**: `tests/contracts/` (schema validation)
- **Logs**: Check `agent_shadow_logs` table in Supabase

---

**Last Updated**: 2025-10-23
**Next Review**: 2025-10-25 (48h shadow period complete)
**Owner**: Development Team
