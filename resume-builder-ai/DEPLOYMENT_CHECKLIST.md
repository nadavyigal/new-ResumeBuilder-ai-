# Viral Growth Engine - Deployment Checklist

## 🎯 Pre-Deployment Verification

### ✅ Code Implementation Status
- [x] Database migration created (`20251225000000_add_anonymous_scoring.sql`)
- [x] Rate limiting system implemented (database-backed)
- [x] Public ATS check API (`/api/public/ats-check`)
- [x] Session conversion API (`/api/public/convert-session`)
- [x] Frontend components (15 files)
- [x] Landing page integration (hero replaced)
- [x] Auth callback enhanced (session conversion)
- [x] Dashboard welcome flow implemented
- [x] PostHog analytics (8 events tracked)
- [x] Social share buttons (LinkedIn, Twitter)
- [x] Error handling & validation
- [x] Production build tested (✅ passes)

### ✅ Analytics Events Implemented
All planned PostHog events are tracking correctly:
- `ats_checker_view` - Landing page view
- `ats_checker_file_uploaded` - File selected
- `ats_checker_submitted` - Check submitted
- `ats_checker_score_displayed` - Results shown
- `ats_checker_share_clicked` - Social share
- `ats_checker_signup_clicked` - CTA clicked
- `ats_checker_session_converted` - User signed up
- `ats_checker_rate_limited` - Hit rate limit

---

## 📋 Deployment Steps

### Phase 1: Database Migration (15 minutes)

#### 1.1 Connect to Supabase Project
```bash
cd resume-builder-ai
npx supabase link --project-ref <your-project-ref>
```

#### 1.2 Review Migration
```bash
cat supabase/migrations/20251225000000_add_anonymous_scoring.sql
```

**Verify migration includes**:
- ✅ `anonymous_ats_scores` table with indexes
- ✅ `rate_limits` table with unique constraint
- ✅ RLS policies for both tables
- ✅ Indexes for performance

#### 1.3 Apply Migration to Production
```bash
npx supabase db push
```

**Expected output**: `Migration 20251225000000_add_anonymous_scoring.sql applied successfully`

#### 1.4 Verify Tables Created
```sql
-- Run in Supabase SQL Editor
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('anonymous_ats_scores', 'rate_limits');
```

**Expected result**: 2 rows returned

#### 1.5 Verify RLS Policies
```sql
-- Run in Supabase SQL Editor
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE tablename IN ('anonymous_ats_scores', 'rate_limits');
```

**Expected policies**:
- `anonymous_ats_scores`: "Allow anonymous insert", "Users can view converted scores"
- `rate_limits`: "System can manage rate limits"

---

### Phase 2: Environment Variables (5 minutes)

#### 2.1 Verify Required Variables
Check that these are set in your deployment platform (Vercel/production):

```bash
# Existing variables (should already be set)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
OPENAI_API_KEY=sk-...

# PostHog (should already be set)
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com

# App URL (for email redirects)
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

**Note**: No new environment variables required for viral growth engine!

---

### Phase 3: Deploy to Production (10 minutes)

#### 3.1 Merge to Main Branch
```bash
# From viral-growth-engine branch
git status
git add -A
git commit -m "feat: complete viral growth engine implementation"
git push origin viral-growth-engine

# Create PR and merge via GitHub UI
# OR merge directly if you're solo:
git checkout main
git merge viral-growth-engine
git push origin main
```

#### 3.2 Trigger Production Deployment
- **Vercel**: Automatically deploys on push to main
- **Other platforms**: Trigger deployment manually

#### 3.3 Monitor Deployment
Watch build logs for:
- ✅ Build completes successfully
- ✅ All routes generated correctly
- ✅ No runtime errors in server logs

---

### Phase 4: Post-Deployment Testing (30 minutes)

#### 4.1 Smoke Test - Anonymous ATS Check
1. Visit production homepage: `https://your-domain.com`
2. **Verify**: Landing page shows "Free ATS Score Checker" (not old hero)
3. Upload a test resume PDF (< 10MB)
4. Paste a job description (> 100 words)
5. Click "Check My ATS Score"
6. **Verify**:
   - Processing state appears (3-5 seconds)
   - Score displays with animated counter
   - Top 3 issues are visible
   - Remaining issues are blurred with lock overlay
   - "5 free checks remaining" label shown
   - Social share buttons appear (LinkedIn, Twitter)

#### 4.2 Test Rate Limiting
1. Complete 5 ATS checks (use same session)
2. On 6th attempt, **verify**:
   - 429 status returned
   - Rate limit message displays
   - "Resets in X days" shown
   - "Sign Up Free" CTA appears

#### 4.3 Test Conversion Flow
1. From rate limit screen, click "Sign Up Free"
2. Complete signup with new email
3. Confirm email (check inbox)
4. **Verify**:
   - Redirected to `/dashboard`
   - Welcome card displays with previous score
   - Shows "X more issues to fix" message
   - "Upload Resume for Full Optimization" CTA visible

#### 4.4 Test Session Conversion
1. Open new incognito window
2. Complete 1 ATS check (don't sign up yet)
3. Note the session ID from localStorage (`ats_session_id`)
4. Click "Sign Up Free" from results
5. Sign up with new email
6. **Verify** in Supabase:
   ```sql
   SELECT session_id, user_id, converted_at, ats_score
   FROM anonymous_ats_scores
   WHERE session_id = '<your-session-id>';
   ```
   - `user_id` should be populated
   - `converted_at` should have timestamp

#### 4.5 Test Social Sharing
1. Complete an ATS check
2. Click "Share on LinkedIn" button
3. **Verify**:
   - LinkedIn share dialog opens in popup
   - Pre-filled text includes score and origin URL
   - PostHog event `ats_checker_share_clicked` fires
4. Repeat for Twitter

#### 4.6 Verify Database Privacy
```sql
-- Verify NO full resume text is stored
SELECT
  COUNT(*) as total_scores,
  COUNT(DISTINCT resume_hash) as unique_resumes,
  COUNT(DISTINCT job_description_hash) as unique_jobs,
  COUNT(DISTINCT session_id) as unique_sessions
FROM anonymous_ats_scores;
```

**Expected**: Multiple scores, all using hash-only storage

---

### Phase 5: Analytics Setup (15 minutes)

#### 5.1 Configure PostHog Funnels
Create these funnels in PostHog dashboard:

**Funnel 1: Anonymous to Signup**
1. `ats_checker_view` (landing page)
2. `ats_checker_submitted` (check submitted)
3. `ats_checker_score_displayed` (results shown)
4. `ats_checker_signup_clicked` (CTA clicked)
5. `ats_checker_session_converted` (user created)

**Target**: 20% conversion rate (view → signup)

**Funnel 2: Social Sharing**
1. `ats_checker_score_displayed` (results shown)
2. `ats_checker_share_clicked` (share button clicked)

**Target**: 10% share rate

**Funnel 3: Rate Limit to Conversion**
1. `ats_checker_rate_limited` (hit limit)
2. `ats_checker_signup_clicked` (CTA from limit screen)
3. `ats_checker_session_converted` (user created)

**Target**: 30% conversion rate (rate limited → signup)

#### 5.2 Set Up Alerts
Create PostHog alerts for:
- Conversion rate drops below 15%
- Share rate drops below 5%
- Error rate exceeds 5%
- Rate limit hits spike (potential viral moment!)

---

## 🚨 Rollback Plan

### If Critical Issues Arise

#### Quick Rollback (5 minutes)
```bash
# Revert to previous deployment
git revert HEAD
git push origin main
```

#### Database Rollback (10 minutes)
```sql
-- Only if necessary - this will DELETE all anonymous scores
DROP TABLE IF EXISTS public.anonymous_ats_scores CASCADE;
DROP TABLE IF EXISTS public.rate_limits CASCADE;
```

**Warning**: This deletes all anonymous check data. Only use if critical security issue.

---

## 📊 Success Metrics - Week 1

### Primary Metrics
- **Anonymous Checks**: Target 100+ checks
- **Conversion Rate**: Target 20% (checks → signups)
- **Share Rate**: Target 10% (results → shares)
- **Viral Coefficient**: Target 0.3+ (K-factor)

### Secondary Metrics
- **Average Score**: Baseline for improvements
- **Top Issues**: Identify common resume problems
- **Rate Limit Hits**: Indicates engagement
- **Conversion Time**: Time from check → signup

### How to Track
```sql
-- Week 1 dashboard query
SELECT
  COUNT(*) as total_checks,
  COUNT(DISTINCT session_id) as unique_sessions,
  COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) as conversions,
  ROUND(AVG(ats_score), 1) as avg_score,
  COUNT(*) FILTER (WHERE converted_at IS NOT NULL) as converted_checks,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE converted_at IS NOT NULL) / COUNT(*),
    1
  ) as conversion_rate_pct
FROM anonymous_ats_scores
WHERE created_at >= NOW() - INTERVAL '7 days';
```

---

## 🎉 Post-Launch Actions

### Day 1
- [ ] Monitor error logs for first 6 hours
- [ ] Check PostHog for event tracking
- [ ] Verify database growth (anonymous_ats_scores table)
- [ ] Test on mobile devices (iOS Safari, Android Chrome)

### Day 3
- [ ] Review conversion funnel in PostHog
- [ ] Analyze top 10 most common ATS issues
- [ ] Check social share referral traffic
- [ ] Gather user feedback (if any support tickets)

### Week 1
- [ ] Run success metrics query (see above)
- [ ] Create performance report
- [ ] Identify optimization opportunities
- [ ] Plan iteration #2 based on data

---

## 🔧 Troubleshooting

### Issue: Rate limiting not working
**Symptoms**: Users can submit > 5 checks
**Check**:
```sql
SELECT * FROM rate_limits WHERE endpoint = 'ats-check' LIMIT 10;
```
**Fix**: Verify migration applied, check RLS policies

### Issue: Session conversion failing
**Symptoms**: `user_id` stays NULL after signup
**Check**: Browser console for errors during callback
**Fix**: Verify `session_id` in localStorage matches database

### Issue: Score not displaying
**Symptoms**: Processing hangs or error shown
**Check**: Server logs for ATS scoring errors
**Common causes**:
- OpenAI API timeout (increase timeout)
- PDF parsing failure (test with different PDF)
- Job description too short (< 100 words)

### Issue: Analytics events not firing
**Symptoms**: PostHog dashboard shows 0 events
**Check**: Browser console for PostHog errors
**Fix**: Verify `NEXT_PUBLIC_POSTHOG_KEY` is set correctly

---

## ✅ Final Checklist

Before marking deployment complete:

- [ ] Database migration applied successfully
- [ ] Production build deployed without errors
- [ ] Anonymous ATS check flow works end-to-end
- [ ] Rate limiting enforces 5 checks per week
- [ ] Session conversion links anonymous → authenticated user
- [ ] Social share buttons generate correct URLs
- [ ] PostHog funnels configured and tracking
- [ ] Success metrics dashboard created
- [ ] Rollback plan documented and tested
- [ ] Team notified of launch
- [ ] Monitoring alerts configured

---

## 📞 Support

### If Issues Arise
1. Check server logs first (Vercel/platform logs)
2. Query Supabase for data verification
3. Review PostHog for analytics anomalies
4. Test in incognito/private browsing
5. If critical: Execute rollback plan

### Post-Launch Optimization Ideas
- Add more social platforms (Reddit, Facebook)
- A/B test score display animations
- Experiment with different rate limits (3/week vs 7/week)
- Add "Resume Score Report" PDF export
- Create share image with score badge
- Add email capture before showing results (higher conversion?)

---

**Deployment Owner**: _____________________
**Deployment Date**: _____________________
**Rollback Tested**: [ ] Yes [ ] No
**Success Metrics Baseline**: _____________________
