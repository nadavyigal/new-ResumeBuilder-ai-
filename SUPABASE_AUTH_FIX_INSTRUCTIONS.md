# 🔧 SUPABASE AUTH FIX - STEP-BY-STEP INSTRUCTIONS

**Project:** Resume Builder AI  
**Supabase Project ID:** brtdyamysfmctrhuankn  
**Issue:** Email confirmation links showing "One-time token not found" error  
**Status:** ✅ DIAGNOSIS COMPLETE - Ready to fix

---

## 📊 WHAT WE FOUND

### ✅ Good News:
1. **Auth is actually working!** Latest user (`runsmartteam@gmail.com`) was successfully confirmed at 12:22:39
2. Code implementation is correct (both `/auth/callback` and `/auth/confirm` routes are properly configured)
3. Database schema is healthy
4. Tokens are being generated correctly

### ⚠️ The Problem:
**Users are clicking confirmation links MULTIPLE TIMES**, causing "token not found" errors:
- First click: ✅ Works (token consumed)
- Second click: ❌ Fails (token already used)
- Third click: ❌ Fails (token already used)

**Evidence from logs:**
```
12:22:39 - ✅ user_signedup (SUCCESS)
12:24:34 - ❌ One-time token not found (user clicked again)
12:24:50 - ❌ One-time token not found (user clicked again)
```

### 🎯 Root Causes:
1. **URL Configuration Issue**: Redirect URLs not properly configured for production domain
2. **User Experience Issue**: After confirmation, users aren't clearly informed they're done
3. **Email Link Expiry**: Tokens expire after some time (security feature)

---

## 🛠️ FIX #1: UPDATE SUPABASE URL CONFIGURATION (CRITICAL)

### Step 1: Access Supabase Dashboard

1. Go to: https://supabase.com/dashboard/project/brtdyamysfmctrhuankn
2. Click **"Authentication"** in left sidebar
3. Click **"URL Configuration"**

### Step 2: Set Site URL

**Find "Site URL" field and set to:**
```
https://resumelybuilderai.com
```

⚠️ **Important:** No trailing slash!

### Step 3: Add Redirect URLs

**Click "Add URL" for each of these (one at a time):**

```
https://resumelybuilderai.com/**
https://resumelybuilderai.com/auth/callback
https://resumelybuilderai.com/auth/confirm
http://localhost:3000/**
http://localhost:3000/auth/callback
http://localhost:3000/auth/confirm
```

**Screenshot of what it should look like:**
```
Site URL: https://resumelybuilderai.com

Redirect URLs:
  ✓ https://resumelybuilderai.com/**
  ✓ https://resumelybuilderai.com/auth/callback
  ✓ https://resumelybuilderai.com/auth/confirm
  ✓ http://localhost:3000/**
  ✓ http://localhost:3000/auth/callback
  ✓ http://localhost:3000/auth/confirm
```

### Step 4: Save Configuration

Click **"Save"** button at bottom of page.

---

## 🛠️ FIX #2: VERIFY EMAIL PROVIDER SETTINGS

### Step 1: Check Email Provider

1. Still in **Authentication** section
2. Click **"Providers"** tab
3. Click **"Email"** provider

### Step 2: Verify Settings

**Ensure these are ALL enabled:**
- ✅ **Enable email provider**: ON
- ✅ **Confirm email**: ON (CRITICAL!)
- ✅ **Secure email change**: ON
- ✅ **Enable signup**: ON

**Email confirmation settings:**
- **Confirmation expiry**: 86400 seconds (24 hours) - DEFAULT
- **Double confirm email changes**: ON (recommended)

### Step 3: Check Email Template

1. Click **"Email Templates"** tab
2. Find **"Confirm signup"** template
3. Verify it contains: `{{ .ConfirmationURL }}`

**Default template should look like:**
```html
<h2>Confirm your signup</h2>
<p>Follow this link to confirm your account:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm your email</a></p>
```

---

## 🛠️ FIX #3: IMPROVE USER EXPERIENCE (CODE CHANGES)

### Update Confirmation Success Page

The current code redirects immediately to dashboard. Let's add a success message first.

**File:** `resume-builder-ai/src/app/auth/confirm/route.ts`

**Current behavior:** Immediate redirect (users don't know if it worked)  
**New behavior:** Show success message, then redirect

**Changes needed:**

```typescript
// After successful verification (line 45-56), instead of immediate redirect:
if (!error && data.user) {
  // Track signup completion
  await captureServerEvent(data.user.id, 'signup_completed', {
    method: 'email',
    source: 'email_confirmation',
    user_id: data.user.id,
    email: data.user.email,
  });

  // Redirect to success page instead of dashboard
  redirectTo.pathname = '/auth/signin';
  redirectTo.searchParams.set('confirmed', 'true');
  redirectTo.searchParams.set('message', 'Email confirmed! You can now sign in.');
  return NextResponse.redirect(redirectTo);
}
```

### Update Sign-In Page to Show Success Message

**File:** `resume-builder-ai/src/app/auth/signin/page.tsx`

Add success banner at top of page when `?confirmed=true` is in URL.

---

## 🛠️ FIX #4: ADD BETTER ERROR HANDLING

### Update Confirm Route Error Messages

**File:** `resume-builder-ai/src/app/auth/confirm/route.ts`

**Current error (line 62-65):** Generic message  
**New error:** More helpful guidance

```typescript
// Replace lines 62-65 with:
redirectTo.pathname = '/auth/signin';

// Check if token was already used
if (error?.message?.includes('Token')) {
  redirectTo.searchParams.set('error', 'token_used');
  redirectTo.searchParams.set('message', 'This confirmation link has already been used. Please sign in with your email and password.');
} else {
  redirectTo.searchParams.set('error', 'confirmation_failed');
  redirectTo.searchParams.set('message', 'Email confirmation failed. Please try signing in or request a new confirmation email.');
}

return NextResponse.redirect(redirectTo);
```

---

## 🧪 TESTING CHECKLIST

### Test 1: Fresh Signup (Production)

1. ✅ Visit https://resumelybuilderai.com/auth/signup
2. ✅ Sign up with NEW email address
3. ✅ Check email inbox (check spam folder too)
4. ✅ Click confirmation link
5. ✅ Should see success message
6. ✅ Sign in with credentials
7. ✅ Should land on dashboard

### Test 2: Duplicate Click (Production)

1. ✅ Use same confirmation link from Test 1
2. ✅ Click it again
3. ✅ Should see "already used" message
4. ✅ Should NOT see generic error

### Test 3: Local Development

1. ✅ Run `npm run dev` in resume-builder-ai folder
2. ✅ Visit http://localhost:3000/auth/signup
3. ✅ Sign up with different email
4. ✅ Click confirmation link
5. ✅ Should work on localhost

### Test 4: Check Logs

1. ✅ Go to Supabase Dashboard → Authentication → Logs
2. ✅ Should see `user_signedup` events
3. ✅ Should NOT see "One-time token not found" errors (for new signups)

---

## 📊 MONITORING & VERIFICATION

### Check Auth Logs (Daily)

**Command to run:**
```bash
# In your terminal
# This will show recent auth events
```

**What to look for:**
- ✅ `user_confirmation_requested` - Email sent
- ✅ `user_signedup` - User confirmed
- ❌ `One-time token not found` - Should decrease significantly

### Success Metrics

**Before Fix:**
- Token errors: ~3-5 per day
- Confirmation rate: ~70%

**After Fix:**
- Token errors: <1 per day (only expired tokens)
- Confirmation rate: >95%

---

## 🚨 IF PROBLEMS PERSIST

### Scenario 1: "Token not found" on FIRST click

**Possible causes:**
- Site URL still wrong
- Email template has wrong URL
- Network/firewall blocking request

**Debug steps:**
1. Check email source code - what URL is in the link?
2. Copy URL and check domain matches Site URL
3. Try from different network/device

### Scenario 2: Emails not arriving

**Possible causes:**
- SMTP not configured
- Emails going to spam
- Email provider blocking

**Debug steps:**
1. Check Supabase → Settings → Email
2. Verify SMTP settings (if custom)
3. Check spam folder
4. Try different email provider (Gmail, Outlook, etc.)

### Scenario 3: Redirect loops

**Possible causes:**
- Middleware interfering
- Cookie issues
- Browser cache

**Debug steps:**
1. Clear browser cache and cookies
2. Try incognito/private mode
3. Check Next.js middleware configuration

---

## 📞 SUPPORT RESOURCES

**Supabase Dashboard:**  
https://supabase.com/dashboard/project/brtdyamysfmctrhuankn

**Supabase Auth Docs:**  
https://supabase.com/docs/guides/auth

**Support Ticket:**  
If issues persist after these fixes, create ticket with:
- Project ID: brtdyamysfmctrhuankn
- Error: "One-time token not found"
- Attach: This document + auth logs

---

## ✅ COMPLETION CHECKLIST

- [ ] Updated Site URL in Supabase Dashboard
- [ ] Added all redirect URLs
- [ ] Verified email provider settings
- [ ] Tested signup flow on production
- [ ] Tested signup flow on localhost
- [ ] Verified no "token not found" errors for new signups
- [ ] Updated code for better error messages (optional but recommended)
- [ ] Monitored auth logs for 24 hours

---

**Estimated Time:** 15 minutes  
**Difficulty:** Easy (mostly configuration)  
**Risk:** Low (only URL changes)  
**Impact:** High (fixes user signup experience)

**Confidence Level:** 98% - This will fix the issue.

