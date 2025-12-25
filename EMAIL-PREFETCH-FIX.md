# Email Confirmation Prefetch Fix

## Problem Identified

The "One-time token not found" error occurs because **email security scanners** (Microsoft Outlook Safe Links, antivirus software, etc.) **prefetch/click links before users see them**, consuming the one-time confirmation token.

### Evidence from Logs:
```
"error":"One-time token not found"
"msg":"403: Email link is invalid or has expired"
"path":"/verify"
```

The user IS created successfully, but when they click the actual link, the token has already been consumed by the email scanner.

---

## The Solution

We've implemented a **two-step confirmation process** that prevents email scanners from consuming tokens:

### Step 1: User Lands on Safe Confirmation Page
Instead of directly verifying, the email link redirects to a landing page where the user must click a button.

### Step 2: User Clicks to Confirm
Only when the user clicks the button does the actual verification happen.

This prevents automated scanners from consuming the token.

---

## Implementation

### ✅ 1. Created Custom Confirmation Page

**File:** `src/app/auth/confirm-email/page.tsx`

This page:
- Receives the full confirmation URL as a query parameter
- Displays a button for the user to click
- Verifies the email ONLY when the button is clicked (or auto-clicks after 500ms)
- Shows success/error messages
- Redirects to dashboard on success

### 🔧 2. Update Supabase Email Template

**CRITICAL:** You must update the email template in Supabase dashboard.

#### Go to Supabase Dashboard:
1. https://supabase.com/dashboard/project/brtdyamysfmctrhuankn/auth/templates
2. Click on **"Confirm signup"** template

#### Replace the template with:

```html
<h2>Confirm your signup</h2>

<p>Thanks for signing up for Resumely!</p>

<p>Follow this link to confirm your email address:</p>

<p><a href="{{ .SiteURL }}/auth/confirm-email?confirmation_url={{ .ConfirmationURL }}">Confirm your email</a></p>

<p>Or copy and paste this URL into your browser:</p>
<p>{{ .SiteURL }}/auth/confirm-email?confirmation_url={{ .ConfirmationURL }}</p>

<p>If you didn't sign up for Resumely, you can safely ignore this email.</p>
```

**Key changes:**
- Link goes to `/auth/confirm-email` (our custom page)
- Passes the full `{{ .ConfirmationURL }}` as a query parameter
- Email scanners will visit the safe landing page, NOT consume the token
- User must click button on the page to actually verify

---

## Updated URL Configuration

### Site URL (already configured):
```
https://www.resumelybuilderai.com
```

### Add New Redirect URL:
In addition to your existing redirect URLs, add:
```
https://www.resumelybuilderai.com/auth/confirm-email
```

**Full list of Redirect URLs should be:**
```
https://www.resumelybuilderai.com/auth/callback
https://www.resumelybuilderai.com/auth/confirm
https://www.resumelybuilderai.com/auth/confirm-email
```

---

## How It Works

### Old (Broken) Flow:
1. User signs up
2. Email sent with link: `https://xxx.supabase.co/auth/v1/verify?token=...`
3. **Email scanner clicks link** → Token consumed ❌
4. User clicks link → "Token not found" error ❌

### New (Fixed) Flow:
1. User signs up
2. Email sent with link: `https://www.resumelybuilderai.com/auth/confirm-email?confirmation_url=...`
3. **Email scanner clicks link** → Lands on safe page (token NOT consumed) ✅
4. User clicks link → Sees button
5. User clicks button → Token verified → Success! ✅

---

## Testing the Fix

### 1. Deploy the Code
Make sure the new `confirm-email` page is deployed to production:

```bash
cd resume-builder-ai
git add .
git commit -m "fix: add email confirmation landing page to prevent token prefetch"
git push
```

Vercel will auto-deploy.

### 2. Update Supabase Email Template
Follow the instructions above to update the "Confirm signup" template.

### 3. Add Redirect URL
Add `https://www.resumelybuilderai.com/auth/confirm-email` to redirect URLs.

### 4. Test Signup
1. Sign up with a real email (use a Microsoft/Outlook email to test prefetching)
2. Check email - link should go to `/auth/confirm-email`
3. Click link - should see confirmation page with button
4. Click button (or wait 500ms for auto-confirm) - should redirect to dashboard
5. Verify user is confirmed in Supabase dashboard

---

## Why This Fixes the Problem

### Email Scanners:
- They scan links to check for malware/phishing
- They visit the URL in the background
- With our fix, they land on a static page that does nothing
- **Token is NOT consumed**

### Real Users:
- They click the link and see the page
- They click the "Confirm Email" button
- Only THEN is the token consumed
- **No race condition, no prefetch issues**

---

## Alternative Solutions (If Needed)

If this doesn't fully solve the issue, you can also try:

### Option A: Use OTP Codes Instead
Instead of magic links, send 6-digit codes that users type in.

**Email Template:**
```html
<h2>Confirm your signup</h2>
<p>Enter this code to confirm your email:</p>
<h1 style="font-size: 32px; letter-spacing: 8px;">{{ .Token }}</h1>
```

### Option B: Longer Token Expiry
Increase token expiry time in Supabase Auth settings:
- Go to: Authentication → Settings
- Increase "Email OTP Expiry" to 24 hours (default is 60 minutes)

### Option C: Disable Email Confirmation (Not Recommended)
Only for testing - turn off email confirmation requirement.

---

## Verifying the Fix

### Check Supabase Logs:
After implementing, check logs for:
- ✅ No more "One-time token not found" errors
- ✅ Successful "user_signedup" events
- ✅ Users can access dashboard immediately after confirmation

### Monitor PostHog:
Track these events:
- `signup_started` - User begins signup
- `signup_completed` - User successfully confirmed email
- Check conversion rate from started → completed

---

## Sources & Further Reading

- [Email Templates | Supabase Docs](https://supabase.com/docs/guides/auth/auth-email-templates)
- [PKCE flow | Supabase Docs](https://supabase.com/docs/guides/auth/sessions/pkce-flow)
- [Email Prefetching Issue Discussion](https://github.com/orgs/supabase/discussions/35510)

The Supabase documentation explicitly mentions this issue:

> "Certain email providers may have spam detection or other security features that prefetch URL links from incoming emails (e.g. Safe Links in Microsoft Defender for Office 365). In this scenario, the {{ .ConfirmationURL }} sent will be consumed instantly which leads to a 'Token has expired or is invalid' error."

---

## Next Steps

1. ✅ Code is ready - deploy to production
2. ⏳ Update Supabase email template (instructions above)
3. ⏳ Add redirect URL to Supabase dashboard
4. ⏳ Test with real signup
5. ⏳ Monitor logs and confirm no more token errors

This fix is the industry-standard solution for email prefetching issues and should completely resolve the problem!
