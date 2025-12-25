# Production Email Confirmation - Verification Checklist

## ✅ Code Configuration - VERIFIED

### Dynamic URL Detection
Your code correctly uses **dynamic origin detection**:
```typescript
// src/components/auth/auth-form.tsx:63
const origin = typeof window !== 'undefined' ? window.location.origin : '';
emailRedirectTo: `${origin}/auth/callback`
```

This means:
- **On localhost:** Uses `http://localhost:3000/auth/callback`
- **On production:** Uses `https://www.resumelybuilderai.com/auth/callback`

✅ **No code changes needed** - works automatically for all environments!

---

## ✅ Supabase Configuration - YOU CONFIGURED

You already configured in Supabase dashboard:

**Site URL:**
```
https://www.resumelybuilderai.com/
```

**Redirect URLs:**
```
https://www.resumelybuilderai.com/auth/callback
https://www.resumelybuilderai.com/auth/confirm
```

✅ **Configuration looks correct!**

---

## 🧪 Testing Procedure

### Test 1: New User Signup Flow

1. **Sign up with a test email:**
   - Go to: https://www.resumelybuilderai.com/auth/signup
   - Use a real email you can access
   - Fill in the form and submit

2. **Check confirmation email:**
   - Check your inbox (and spam folder)
   - Email should arrive from Supabase
   - Subject: "Confirm Your Signup" (or similar)

3. **Click the confirmation link:**
   - Link should look like:
     ```
     https://www.resumelybuilderai.com/auth/callback?token_hash=xxx&type=signup&next=/dashboard
     ```
   - Should redirect to: `https://www.resumelybuilderai.com/dashboard`

4. **Verify success:**
   - You should be logged in
   - Dashboard should load
   - No error messages

### Test 2: Check Browser Console

Open browser DevTools (F12) and check:
- **Console tab:** No JavaScript errors
- **Network tab:** All requests return 200 or 302 (redirect)
- **Application → Cookies:** Should see Supabase auth cookies

### Test 3: Verify in Supabase Dashboard

1. Go to: https://supabase.com/dashboard/project/brtdyamysfmctrhuankn/auth/users
2. Find your test user
3. Check **Email Confirmed At** column - should have a timestamp
4. User status should be **Confirmed**

---

## 🔍 Potential Issues & Solutions

### Issue 1: Email Not Arriving

**Possible causes:**
- SMTP not configured in Supabase
- Email in spam folder
- Email provider blocking

**Check:**
```bash
# In Supabase Dashboard:
# Project Settings → Auth → Email Templates
# Verify SMTP settings are configured
```

**View logs:**
https://supabase.com/dashboard/project/brtdyamysfmctrhuankn/logs/auth-logs

### Issue 2: Still Getting "OTP Expired" Error

**Likely causes:**
1. Redirect URL has typo (check for trailing slash)
2. URL not saved in Supabase dashboard
3. Browser cached old error

**Solutions:**
1. Double-check exact URLs in dashboard (no `/` at end)
2. Clear browser cache and cookies
3. Try in incognito/private window
4. Check Supabase Auth logs for actual error

### Issue 3: Link Expires Too Quickly

**Default expiration:**
- Email confirmation links: 24 hours
- Password reset links: 1 hour

**To change:**
1. Go to: Authentication → Settings
2. Update "Time-based one-time password (TOTP) expiry time"

### Issue 4: User Not Redirected to Dashboard

**Check:**
1. Browser console for errors
2. Network tab for failed requests
3. Supabase logs for auth failures

**Verify middleware:**
```bash
# Check if you have middleware.ts that might be blocking
# Should allow /auth/* routes
```

---

## 📊 Environment Variables Check

### Production (Vercel)

Verify these are set in Vercel dashboard:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://brtdyamysfmctrhuankn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_POSTHOG_KEY=phc_UmPZRavTHn7wwMrz2IqgKkBtdsVDDxeL3Z4FWP1EuwF
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

**To check:**
1. Go to: https://vercel.com/your-project/settings/environment-variables
2. Verify all variables are present
3. Make sure they're available for "Production" environment

---

## 🎯 Quick Test Commands

### Test from terminal:

```bash
# Test the callback route is accessible
curl -I https://www.resumelybuilderai.com/auth/callback

# Should return: 302 or 307 (redirect)
```

### Test PostHog tracking (optional):

```bash
# Check if events are being tracked
# Go to: https://us.i.posthog.com/
# Look for "signup_started" and "signup_completed" events
```

---

## ✅ Pre-Deployment Checklist

Before each deployment, verify:

- [ ] Environment variables set in Vercel
- [ ] Supabase redirect URLs include production domain
- [ ] Site URL in Supabase matches production domain
- [ ] SMTP configured in Supabase (for emails)
- [ ] SSL certificate active (HTTPS working)
- [ ] No hardcoded localhost URLs in code

---

## 🚀 Everything Should Work Because...

1. ✅ Your code uses **dynamic origin** - no hardcoding
2. ✅ You configured **redirect URLs** in Supabase dashboard
3. ✅ Your Supabase project is **ACTIVE_HEALTHY**
4. ✅ Your callback route handles errors properly
5. ✅ PostHog tracking is set up for monitoring

---

## 📞 Support Resources

### Supabase Dashboard Links:
- **Auth Logs:** https://supabase.com/dashboard/project/brtdyamysfmctrhuankn/logs/auth-logs
- **Users:** https://supabase.com/dashboard/project/brtdyamysfmctrhuankn/auth/users
- **Auth Settings:** https://supabase.com/dashboard/project/brtdyamysfmctrhuankn/auth/url-configuration
- **Email Templates:** https://supabase.com/dashboard/project/brtdyamysfmctrhuankn/auth/templates

### Debugging Tools:
- Browser DevTools → Console (for JavaScript errors)
- Browser DevTools → Network (for failed requests)
- Supabase logs (for backend errors)
- PostHog (for tracking signup flow)

---

## 🎉 Expected Flow

1. User visits: https://www.resumelybuilderai.com/auth/signup
2. User fills form and submits
3. Code sends signup request to Supabase
4. Supabase sends confirmation email
5. User clicks link in email
6. Supabase redirects to: `https://www.resumelybuilderai.com/auth/callback?code=xxx`
7. Callback route exchanges code for session
8. PostHog tracks "signup_completed" event
9. User redirected to: https://www.resumelybuilderai.com/dashboard
10. User is logged in ✨

---

## Next Steps

1. Test the signup flow with a real email
2. Check the confirmation email arrives
3. Click the link and verify you're redirected to dashboard
4. Check Supabase dashboard to confirm user is marked as "confirmed"
5. If any issues, check the sections above for troubleshooting

Let me know how the test goes! 🚀
