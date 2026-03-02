# Quick Start: Apply RLS Security Fix

## 🔴 CRITICAL: This Must Be Done Immediately

Your database is currently allowing anonymous access to ALL user data. This fix will lock down access to authenticated users only.

---

## Option 1: Supabase Dashboard (Recommended)

### Step 1: Open SQL Editor
1. Go to https://supabase.com/dashboard/project/brtdyamysfmctrhuankn
2. Click **SQL Editor** in the left sidebar
3. Click **New query**

### Step 2: Copy and Run SQL
1. Open the file: `fix-rls-security.sql`
2. Copy ALL contents (Ctrl+A, Ctrl+C)
3. Paste into Supabase SQL Editor (Ctrl+V)
4. Click **Run** (or press Ctrl+Enter)

### Step 3: Verify Success
Look for this message at the bottom:
```
✅ RLS Security Fix Applied Successfully!
✅ All 13 tables have RLS enabled
✅ All tables have policies defined
✅ Anonymous access blocked
✅ Authenticated users can only access their own data
✅ Service role has full access for backend operations
```

### Step 4: Verify the Fix
Run the audit script again:
```bash
cd "C:\Users\nadav\OneDrive\מסמכים\AI\cursor\cursor playground\ResumeBuilder AI"
node check-supabase-config.js
```

You should now see:
```
✅ profiles: RLS ENABLED (anonymous blocked)
✅ resumes: RLS ENABLED (anonymous blocked)
✅ optimizations: RLS ENABLED (anonymous blocked)
... etc
```

---

## Option 2: Command Line (Advanced)

### Prerequisites
- Supabase CLI installed
- Project linked to local CLI

### Commands
```bash
# Navigate to project
cd "C:\Users\nadav\OneDrive\מסמכים\AI\cursor\cursor playground\ResumeBuilder AI"

# Apply the fix
npx supabase db push

# Or use psql directly
psql -h db.brtdyamysfmctrhuankn.supabase.co \
     -U postgres \
     -d postgres \
     -f fix-rls-security.sql
```

---

## What This Fix Does

### Before Fix (VULNERABLE)
```
Anonymous User → Database → ✅ Can read all profiles
Anonymous User → Database → ✅ Can read all resumes
Anonymous User → Database → ✅ Can read all optimizations
```

### After Fix (SECURE)
```
Anonymous User → Database → ❌ BLOCKED
Authenticated User → Database → ✅ Can read OWN data only
Authenticated User → Database → ❌ Cannot read OTHER users' data
Service Role (Backend) → Database → ✅ Full access
```

---

## Testing the Fix

### Test 1: Anonymous Access (Should Fail)
```bash
# This should return an error about RLS
curl https://brtdyamysfmctrhuankn.supabase.co/rest/v1/profiles \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJydGR5YW15c2ZtY3RyaHVhbmtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyNDYwODQsImV4cCI6MjA3MjgyMjA4NH0.x7IhVevlwHqrhJOVtcLeX8U-fN-tSZn-0AcC1dsXuyU"
```

**Expected:** Error about row-level security policy violation

### Test 2: Application Still Works
1. Open your application in browser
2. Sign in with a test account
3. Create a new optimization
4. Verify you can see your own data
5. Verify the AI assistant still works

### Test 3: Backend Operations Work
Your API routes using `SUPABASE_SERVICE_ROLE_KEY` should continue to work normally.

---

## Rollback (If Something Goes Wrong)

If you need to rollback:

```sql
-- This will remove all policies (TEMPORARILY UNSAFE!)
-- Use ONLY in development to debug issues

BEGIN;

-- Drop all policies
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- Re-create permissive policies (TEMPORARY - for debugging only)
CREATE POLICY "temp_debug_policy" ON profiles FOR ALL USING (true);
CREATE POLICY "temp_debug_policy" ON resumes FOR ALL USING (true);
-- ... repeat for other tables

COMMIT;
```

**⚠️ WARNING:** Only use rollback in development. In production, fix the specific policy causing issues.

---

## Troubleshooting

### Issue: "Users can't see their own data after fix"

**Cause:** JWT token may be expired or auth.uid() not matching user_id

**Fix:**
1. Sign out and sign back in (refresh JWT)
2. Check browser console for auth errors
3. Verify user_id in profiles table matches auth.users.id

### Issue: "API routes returning 401/403 errors"

**Cause:** API routes may be using anon key instead of service role key

**Fix:**
1. Verify API routes use `SUPABASE_SERVICE_ROLE_KEY`
2. Check `.env.local` has correct service role key
3. Restart Next.js dev server after env changes

### Issue: "Chat/design features not working"

**Cause:** RLS policies may be too restrictive for complex joins

**Fix:**
1. Check which table is causing the issue
2. Review the policy for that table in fix-rls-security.sql
3. The policies use EXISTS clauses to handle foreign key checks
4. Test the specific query in Supabase SQL Editor

---

## Post-Fix Checklist

- [ ] SQL script ran successfully (saw success message)
- [ ] Ran `node check-supabase-config.js` (all green)
- [ ] Anonymous access is blocked (Test 1 passed)
- [ ] Can sign in to application
- [ ] Can create new optimization
- [ ] Can view existing optimizations
- [ ] Chat assistant works
- [ ] Design customization works
- [ ] Can export resume to PDF

---

## Files Reference

| File | Purpose |
|------|---------|
| `fix-rls-security.sql` | The SQL fix to apply |
| `check-supabase-config.js` | Audit tool (run before/after) |
| `SUPABASE-SECURITY-REPORT.md` | Detailed findings |
| `APPLY-SECURITY-FIX.md` | This guide |

---

## Support

If you encounter issues:

1. **Check the audit output:**
   ```bash
   node check-supabase-config.js > audit-after-fix.txt
   ```

2. **Check Supabase logs:**
   - Go to Supabase Dashboard → Logs
   - Filter for errors in the last hour
   - Look for RLS policy violations

3. **Verify policies were created:**
   ```sql
   SELECT tablename, COUNT(*) as policy_count
   FROM pg_policies
   WHERE schemaname = 'public'
   GROUP BY tablename
   ORDER BY tablename;
   ```
   Each table should have 2-4 policies

---

## Estimated Time

- **Applying fix:** 30 seconds
- **Verification:** 2 minutes
- **Testing:** 5 minutes
- **Total:** ~10 minutes

---

**Last Updated:** 2025-11-10
**Status:** Ready to apply
**Priority:** 🔴 CRITICAL - Apply immediately
