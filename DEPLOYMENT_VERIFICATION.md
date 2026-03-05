# Deployment Verification Checklist

## Critical Infrastructure Check

### 1. Verify Anonymous ATS Checker Table Exists

Run this query in Supabase SQL Editor:

```sql
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'anonymous_ats_scores'
);
```

**Expected**: `true`

If false, run migration: `supabase/migrations/20251225000000_add_anonymous_scoring.sql`

### 2. Verify Newsletter Table Exists

```sql
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'newsletter_subscribers'
);
```

**Expected**: `true`

Based on remote_schema files from Jan 4, 2026, this should already exist.

### 3. Verify Rate Limiting Table

```sql
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'rate_limits'
);
```

**Expected**: `true`

### 4. Test Anonymous ATS Endpoint

```bash
curl -X POST https://brtdyamysfmctrhuankn.supabase.co/rest/v1/anonymous_ats_scores \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"session_id": "test", "ip_address": "127.0.0.1", "ats_score": 75, "ats_subscores": {}, "ats_suggestions": {}, "resume_hash": "test", "job_description_hash": "test"}'
```

**Expected**: 201 Created

---

## Environment Variables Check

Verify these are set in production (Vercel):

- ✅ `NEXT_PUBLIC_SUPABASE_URL` - Present in .env.local
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Present
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - Present
- ✅ `OPENAI_API_KEY` - Present
- ✅ `RESEND_API_KEY` - Present (for email)
- ✅ `NEXT_PUBLIC_POSTHOG_KEY` - Present (analytics)
- ⚠️ `STRIPE_SECRET_KEY` - Set to placeholder (update when ready for payments)
- ⚠️ `STRIPE_WEBHOOK_SECRET` - Set to placeholder

---

## Quick Deployment Commands

If migrations need to be applied:

```bash
# Using Supabase CLI
cd "/sessions/peaceful-bold-tesla/mnt/ResumeBuilder AI"
npx supabase db push

# Or manually via SQL Editor
# Copy contents of migration files and run in order
```

---

## Status Summary

**Infrastructure**: ✅ Likely deployed (remote_schema from Jan 4 shows tables exist)

**Next Steps**:
1. Run verification queries above to confirm
2. If tables missing, apply migrations
3. Test anonymous endpoint with curl
4. Proceed with blog post creation

---

**Note**: Based on file timestamps, the anonymous scoring infrastructure was likely deployed on Jan 6, 2025. The remote_schema snapshots from Jan 4, 2026 include newsletter_subscribers, suggesting it's also deployed.
