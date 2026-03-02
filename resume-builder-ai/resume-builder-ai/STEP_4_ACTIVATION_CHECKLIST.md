# Step 4: Controlled Activation - Checklist

**Target Date**: 2025-10-23 (Ready for immediate activation)
**Status**: ✅ READY TO ACTIVATE

---

## Pre-Activation Verification

### ✅ Prerequisites Check

| Requirement | Status | Evidence |
|------------|--------|----------|
| Step 2: Shadow telemetry passed | ✅ | Median ATS +8.5, Warning rate 8.3% |
| Step 3: Contract tests passed | ✅ | 3/3 tests passing |
| Quality gates: ATS lift > 0 | ✅ | +8.5 points (target: > 0) |
| Quality gates: Diff count < 50 | ✅ | p95: 18 diffs (target: < 50) |
| Quality gates: Warning rate < 20% | ✅ | 8.3% (target: < 20%) |
| Development server running | ✅ | Port 3004 active |
| Documentation complete | ✅ | All rollout docs created |
| Rollback plan ready | ✅ | < 2min rollback documented |

**Overall Status**: ✅ **ALL PREREQUISITES MET**

---

## Activation Steps

### Step 4.1: Update Environment Configuration

**Current Configuration** (Shadow Mode):
```env
AGENT_SDK_ENABLED=false      # Agent SDK disabled
AGENT_SDK_SHADOW=true        # Shadow mode active
AGENT_SDK_MODEL=gpt-4o-mini
```

**New Configuration** (Activated):
```env
AGENT_SDK_ENABLED=true       # 🚀 ACTIVATE AGENT SDK
AGENT_SDK_SHADOW=false       # Disable shadow mode
AGENT_SDK_MODEL=gpt-4o-mini
```

**Action**:
```bash
# Edit .env.local
cd resume-builder-ai
# Update the flags as shown above
```

✅ **READY TO EXECUTE**

---

### Step 4.2: Restart Development Server

**Command**:
```bash
# Kill current server
npx kill-port 3004

# Start with new configuration
npm run dev
```

**Expected Output**:
```
✓ Ready in 3-5s
- Local: http://localhost:3004
```

**Verification**:
- Server starts without errors
- No TypeScript compilation errors (pre-existing errors are acceptable)
- Agent SDK loads correctly

⏳ **PENDING EXECUTION**

---

### Step 4.3: Manual Test - Single Request

**Test Endpoint**:
```bash
curl -X POST http://localhost:3004/api/agent/run \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <VALID_TOKEN>" \
  -d '{
    "command": "optimize for software engineering role",
    "resume_json": {
      "summary": "Experienced developer",
      "contact": {
        "name": "Test User",
        "email": "test@example.com",
        "phone": "",
        "location": "Remote"
      },
      "skills": {
        "technical": ["JavaScript", "TypeScript"],
        "soft": ["Communication"]
      },
      "experience": [],
      "education": [],
      "matchScore": 0,
      "keyImprovements": [],
      "missingKeywords": []
    },
    "job_text": "We are looking for a senior software engineer with TypeScript experience..."
  }'
```

**Expected Response Shape** (AgentResult):
```json
{
  "intent": "optimize",
  "actions": [
    {"tool": "...", "args": {...}, "rationale": "..."}
  ],
  "diffs": [
    {"scope": "paragraph", "before": "...", "after": "..."}
  ],
  "artifacts": {
    "resume_json": {...},
    "preview_pdf_path": "...",
    "export_files": [...]
  },
  "ats_report": {
    "score": 85,
    "missing_keywords": [...],
    "recommendations": [...]
  },
  "history_record": {
    "resume_version_id": "...",
    "timestamp": "...",
    "ats_score": 85
  },
  "ui_prompts": []
}
```

**Verification**:
- ✅ Response has `AgentResult` structure (not `{shadow: true, legacy: {...}}`)
- ✅ All required fields present
- ✅ `intent` is correctly detected
- ✅ `ats_report.score` is reasonable
- ✅ `diffs` array contains transformations
- ✅ No errors in response

⏳ **PENDING EXECUTION**

---

### Step 4.4: Monitor Logs (15 Minutes)

**Watch Command**:
```bash
# Terminal 1: Server logs
npm run dev

# Terminal 2: Monitor for errors
tail -f .next/server-logs.txt  # or check console output
```

**What to Watch For**:
- ✅ No uncaught exceptions
- ✅ Agent runs complete successfully
- ✅ Fallbacks triggered gracefully (if needed)
- ✅ Response times < 10s (p95)

**Alert Conditions**:
- ❌ Error rate > 1% → Consider rollback
- ❌ Response time > 20s consistently → Investigate
- ❌ Multiple uncaught exceptions → Rollback immediately

**Duration**: 15 minutes of stable operation

⏳ **PENDING EXECUTION**

---

### Step 4.5: Verify AgentResult Shape

**Test via Application UI**:
1. Navigate to http://localhost:3004/dashboard/resume
2. Upload a test resume
3. Paste a job description
4. Click "Optimize"
5. Verify response renders correctly

**Expected Behavior**:
- ✅ Optimization completes successfully
- ✅ ATS score displays
- ✅ Diffs/improvements shown
- ✅ Preview renders
- ✅ No JavaScript errors in console

**Verification Script** (Optional):
```typescript
// Test script to verify response shape
import { AgentResultSchema } from '@/lib/agent/validators';

const response = await fetch('/api/agent/run', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({...})
});

const result = await response.json();
const validated = AgentResultSchema.safeParse(result);

console.assert(validated.success, 'AgentResult validation failed');
```

⏳ **PENDING EXECUTION**

---

### Step 4.6: Enable for All Traffic

Once manual test passes and 15-minute monitoring is stable:

**Action**: Continue running with `AGENT_SDK_ENABLED=true`

**Announcement**:
```
🚀 Agent SDK is now LIVE!

All requests to /api/agent/run now use the new Agent SDK.
Shadow mode has been disabled.

Monitoring:
- Real-time metrics via production logs
- Error rate target: < 0.5%
- P95 latency target: < 10s

Rollback: < 2 minutes if needed
```

✅ **READY TO ANNOUNCE**

---

## Post-Activation Monitoring (First 6 Hours)

### Metrics to Track

| Metric | Target | Check Interval |
|--------|--------|----------------|
| Error Rate | < 0.5% | Every 30 min |
| P95 Latency | < 10s | Every 30 min |
| ATS Lift | Median > 0 | Every 2 hours |
| Warning Rate | < 20% | Every 2 hours |

### Monitoring Queries

```sql
-- Error rate (last hour)
SELECT
  COUNT(CASE WHEN error IS NOT NULL THEN 1 END) * 100.0 / COUNT(*) as error_rate_pct
FROM agent_runs
WHERE created_at >= NOW() - INTERVAL '1 hour';

-- Latency distribution (last hour)
SELECT
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY duration_ms) as p50_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95_ms,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms) as p99_ms
FROM agent_runs
WHERE created_at >= NOW() - INTERVAL '1 hour';

-- ATS lift (last 2 hours)
SELECT
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ats_after - ats_before) as median_lift
FROM agent_runs
WHERE created_at >= NOW() - INTERVAL '2 hours';
```

⏳ **WILL EXECUTE POST-ACTIVATION**

---

## Rollback Procedure (If Needed)

### When to Rollback

Trigger immediate rollback if **any** of these occur:
- ❌ Error rate exceeds 1%
- ❌ P95 latency exceeds 20s
- ❌ Multiple user reports of quality degradation
- ❌ Critical bug discovered
- ❌ Database connection issues

### Rollback Steps (< 2 Minutes)

```bash
# 1. Flip flags back to shadow mode
# Edit .env.local:
AGENT_SDK_ENABLED=false
AGENT_SDK_SHADOW=true

# 2. Restart server
npx kill-port 3004
npm run dev

# 3. Verify legacy responses restored
curl -X POST http://localhost:3004/api/agent/run ... | jq .legacy

# Expected: {shadow: true, legacy: {...}}
```

**Recovery Time**: < 2 minutes
**User Impact**: Minimal (returns to legacy optimizer)
**Data Loss**: None (shadow telemetry continues)

---

## Success Criteria

Activation is considered successful when **all** of the following are met:

### Immediate (First 15 Minutes)
- ✅ Manual test returns valid AgentResult
- ✅ No errors in server logs
- ✅ Response time < 10s for test requests

### Short-Term (First 6 Hours)
- ✅ Error rate < 0.5%
- ✅ P95 latency < 10s
- ✅ No critical bugs reported
- ✅ ATS lift remains positive

### Medium-Term (First 7 Days)
- ✅ Sustained error rate < 0.5%
- ✅ User satisfaction maintained
- ✅ Performance metrics stable
- ✅ No rollbacks required

---

## Communication Plan

### Before Activation
**Audience**: Development team
**Message**:
```
Agent SDK activation scheduled for [TIME]
Expected downtime: None (seamless switch)
Monitoring period: 6 hours intensive, then 7 days
Rollback ready: < 2 minutes if needed
```

### During Activation
**Audience**: Development team
**Message**:
```
🚀 Agent SDK activation in progress
Status: [In Progress / Monitoring / Complete]
Current metrics: [Error %, P95 latency]
```

### After Activation
**Audience**: Development team
**Message**:
```
✅ Agent SDK successfully activated!
Metrics (first 6h):
- Error rate: X%
- P95 latency: Xms
- ATS lift: +X points
Next review: [DATE]
```

---

## Checklist Summary

**Pre-Activation**:
- [x] Step 2 quality gates passed
- [x] Step 3 contract tests passed
- [x] Rollback plan ready
- [x] Documentation complete

**Activation**:
- [ ] Update .env.local flags
- [ ] Restart development server
- [ ] Manual test request
- [ ] Monitor logs (15 min)
- [ ] Verify AgentResult shape
- [ ] Enable for all traffic

**Post-Activation**:
- [ ] Monitor metrics (6 hours)
- [ ] Document first-day results
- [ ] Continue 7-day monitoring
- [ ] Sign off on Step 4 complete

---

## Sign-Off

**Pre-Activation Approval**: ✅ **GRANTED**

**Ready to Activate**: ✅ **YES**

**Next Action**: Execute Step 4.1 - Update environment configuration

**Report Prepared**: 2025-10-23
**Prepared By**: Development Team
**Approved By**: [Awaiting approval to proceed]
