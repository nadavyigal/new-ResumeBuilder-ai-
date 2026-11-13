# Email Confirmation Fix - Complete Guide

## Problem
Users were getting `otp_expired` and `access_denied` errors when clicking email confirmation links because the redirect URL wasn't whitelisted in Supabase.

## What Was Changed

### 1. Updated Email Redirect Route
Changed from `/auth/confirm` to `/auth/callback` for better compatibility with Supabase's PKCE flow.

**File: [src/components/auth/auth-form.tsx](resume-builder-ai/src/components/auth/auth-form.tsx#L63)**
- Changed `emailRedirectTo` from `${origin}/auth/confirm` to `${origin}/auth/callback`

### 2. Enhanced Callback Route
Improved error handling and added PostHog tracking for email confirmations.

**File: [src/app/auth/callback/route.ts](resume-builder-ai/src/app/auth/callback/route.ts)**
- Added PostHog event tracking for email confirmations
- Improved error messages
- Better fallback handling

## Required: Supabase Dashboard Configuration

**CRITICAL:** You must whitelist the redirect URL in your Supabase dashboard:

### Steps:
1. Go to: https://supabase.com/dashboard/project/brtdyamysfmctrhuankn
2. Navigate to: **Authentication** → **URL Configuration**
3. Configure the following:

   **Site URL:**
   ```
   http://localhost:3000
   ```

   **Redirect URLs:** (add both)
   ```
   http://localhost:3000/auth/callback
   http://localhost:3000/auth/confirm
   ```

   **Note:** Add both URLs for backward compatibility. New signups will use `/callback`, but any existing emails in user inboxes will still use `/confirm`.

4. Click **Save**

### For Production (when deploying):
Add your production URLs as well:
```
https://yourdomain.com/auth/callback
https://yourdomain.com/auth/confirm
```

## Testing the Fix

### 1. Clear Previous Signups
Since you were testing, you might want to clean up:
```bash
# In Supabase dashboard:
# Authentication → Users → Delete test users
```

### 2. Test Flow
1. Start your dev server:
   ```bash
   cd resume-builder-ai
   npm run dev
   ```

2. Sign up with a new email
3. Check your email for the confirmation link
4. Click the link - you should be redirected to `/dashboard` successfully
5. Verify the user is confirmed in Supabase dashboard

### 3. Monitor for Errors
Check your browser console and terminal for any errors during the process.

## Why This Happens

Supabase requires explicit whitelisting of redirect URLs for security. The error messages you saw:
- `error=access_denied` - Supabase blocked the redirect
- `error_code=otp_expired` - Misleading; the real issue is the URL not being whitelisted
- `error_description=Email+link+is+invalid+or+has+expired` - Generic error message

## Additional Notes

### Email Link Expiration
By default, Supabase email confirmation links expire after:
- **24 hours** for email confirmations
- **1 hour** for password reset links

You can change this in: **Authentication → Email Templates → Confirm Signup**

### Development vs Production
- **Development:** Use `http://localhost:3000/auth/callback`
- **Production:** Use `https://yourdomain.com/auth/callback`
- Both must be explicitly added to the redirect URLs list

### Security Best Practices
✅ Only whitelist URLs you control
✅ Use HTTPS in production
✅ Keep Site URL up to date when changing domains
❌ Don't use wildcards (Supabase doesn't support them)

## Next Steps

1. ✅ Code changes are complete
2. ⏳ Configure Supabase dashboard (follow steps above)
3. ⏳ Test the signup flow
4. ⏳ When deploying to production, add production URLs

## Troubleshooting

### Still getting errors?
1. **Check Supabase logs:** Authentication → Logs
2. **Verify URL exactly matches:** No trailing slashes, correct protocol
3. **Clear browser cache:** Sometimes old auth cookies cause issues
4. **Check email template:** Ensure it's using `{{ .ConfirmationURL }}`

### Email not arriving?
1. Check spam folder
2. Verify SMTP settings in Supabase: **Project Settings → Auth → SMTP Settings**
3. Check Supabase logs for email delivery errors

## Support
If issues persist, check:
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Your Supabase Project Logs](https://supabase.com/dashboard/project/brtdyamysfmctrhuankn/logs/auth-logs)
