# Supabase Security Warnings - Action Items

This document tracks the 9 security warnings from Supabase Security Advisor and how to address them.

## ✅ Fixed (5/9) - Function search_path Issues

**Status:** Migration created but needs manual application via Supabase Dashboard

**Files:**
- `supabase/migrations/20251025080000_fix_function_search_paths.sql`

**Functions Fixed:**
1. `check_subscription_limit` - Added `SET search_path = public`
2. `update_applications_updated_at` - Added `SET search_path = public`
3. `increment_optimization_usage` - Added `SET search_path = public`
4. `applications_update_search` - Added `SET search_path = public`
5. `increment_optimizations_used` - Added `SET search_path = public`

**To Apply:**
1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `supabase/migrations/20251025080000_fix_function_search_paths.sql`
3. Run the migration
4. Verify functions work correctly

---

## ⚠️ Requires Dashboard Configuration (3/9)

### 1. Auth - Leaked Password Protection

**Warning:** HaveIBeenPwned integration not enabled

**Impact:** Users can sign up with passwords that have been compromised in data breaches

**Fix:**
1. Go to Supabase Dashboard → Authentication → Settings
2. Scroll to "Password Protection"
3. Enable "Check passwords against HaveIBeenPwned database"
4. Save changes

**Priority:** Medium - Improves account security

---

### 2. Auth - MFA Options

**Warning:** Only TOTP enabled, missing additional MFA methods

**Impact:** Limited MFA options for users

**Recommended Additional Methods:**
- Phone (SMS)
- WebAuthn/Security Keys

**Fix:**
1. Go to Supabase Dashboard → Authentication → Settings
2. Scroll to "Multi-Factor Authentication"
3. Enable additional MFA methods as needed
4. Consider adding WebAuthn for hardware key support

**Priority:** Low - TOTP is sufficient for most use cases

---

### 3. Postgres Version - Security Patches

**Warning:** Security patches available for PostgreSQL version

**Impact:** Potential vulnerabilities in database engine

**Fix:**
1. Go to Supabase Dashboard → Settings → Infrastructure
2. Check current PostgreSQL version
3. Schedule upgrade during low-traffic period
4. Follow Supabase's upgrade guide

**Priority:** Medium - Should be scheduled but not urgent

---

## 📋 Low Priority / Informational (1/9)

### Extension in Public Schema

**Warning:** The `vector` extension is installed in the public schema

**Impact:** Organizational/namespace concern, not a security vulnerability

**Current Status:** Acceptable for this project size

**If needed to fix:**
1. Create dedicated schema for extensions
2. Move vector extension to new schema
3. Update all references to use schema-qualified names

**Priority:** Very Low - Can be ignored for now

---

## Summary

| Category | Count | Status |
|----------|-------|--------|
| Fixed (needs application) | 5 | Migration ready |
| Requires Dashboard config | 3 | Manual steps needed |
| Low priority | 1 | Can be deferred |
| **Total** | **9** | **5 automated, 4 manual** |

---

## Verification Steps

After applying fixes:

1. **Test Functions:**
```sql
-- Test check_subscription_limit
SELECT * FROM check_subscription_limit('YOUR_USER_ID');

-- Test increment_optimizations_used
SELECT * FROM increment_optimizations_used('YOUR_USER_ID', 1);
```

2. **Run Security Scan Again:**
- Go to Supabase Dashboard → Database → Advisors
- Click "Run Security Scan"
- Verify warnings reduced from 9 to 4 (or 1 if dashboard configs applied)

3. **Test Application:**
- Sign up new user (test leaked password protection if enabled)
- Upload resume (tests quota increment function)
- Verify all flows work correctly

---

## Notes

- Migration file created: `20251025080000_fix_function_search_paths.sql`
- All function fixes maintain existing behavior while improving security
- Dashboard configurations are non-breaking changes
- PostgreSQL upgrade should be scheduled separately during maintenance window
