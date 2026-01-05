# Deployment & Testing Checklist - Critical for Monday Launch

## Current Status

### ✅ Code Changes Pushed to GitHub
- Commit 1961926: Header Login/Signup buttons
- Commit a6d118d: Landing page login link
- Status: **In GitHub, not yet deployed to production**

### ❌ Production Deployment Status
- **Issue**: Changes not live on https://resumelybuilderai.com
- **Evidence**: WebFetch shows old "Contact Us" button, not new Login/Signup buttons
- **Action Required**: Trigger Vercel deployment

### ❌ Email Confirmations
- **Issue**: Users not receiving signup confirmation emails
- **Root Cause**: Supabase SMTP not configured
- **Action Required**: Configure in Supabase dashboard

---

## STEP 1: Deploy Code to Production (Vercel)

### Option A: Trigger Deployment via Vercel Dashboard

1. **Go to Vercel Dashboard**:
   ```
   https://vercel.com/dashboard
   ```

2. **Find Your Project**: "resumelybuilderai" or "resume-builder-ai"

3. **Check Deployments Tab**:
   - Look for latest deployment
   - Should show commits: 1961926 or a6d118d
   - If not, deployment didn't trigger

4. **Manual Redeploy** (if needed):
   - Click "Deployments" tab
   - Find latest deployment
   - Click "..." menu → "Redeploy"
   - OR: Click "Redeploy" button on project overview

### Option B: Trigger Deployment via Git

```bash
cd resume-builder-ai

# Trigger deployment with empty commit
git commit --allow-empty -m "chore: trigger Vercel deployment"
git push origin main
```

### Option C: Trigger via Vercel CLI

```bash
# Install Vercel CLI (if not installed)
npm install -g vercel

# Login to Vercel
vercel login

# Deploy to production
cd resume-builder-ai
vercel --prod
```

### Verify Deployment

**Wait 2-3 minutes**, then check:

1. **Vercel Dashboard**:
   - Status should show "Ready" with green checkmark
   - Deployment should show latest commit hash (a6d118d)

2. **Production Site** (https://resumelybuilderai.com):
   - Hard refresh: Ctrl+F5 (Windows) or Cmd+Shift+R (Mac)
   - Check header: Should have "Log In" and "Sign Up" buttons
   - Check hero section: Should have "Already have an account? Log in here"

---

## STEP 2: Configure Supabase Email (CRITICAL)

### Navigate to Supabase

```
https://supabase.com/dashboard/project/brtdyamysfmctrhuankn/settings/auth
```

### A. Enable SMTP

Scroll to **"SMTP Settings"**:

```
☑️ Enable Custom SMTP (toggle ON)

Sender Email: noreply@resumelybuilderai.com
Sender Name: Resumely

Host: smtp.resend.com
Port: 465
Username: resend
Password: re_eLNmG5GV_7XXnDS7U62JBRzyA89mdBrQq

☑️ Enable SSL (MUST be checked)
```

Click **"Save"** → Should see "SMTP settings saved successfully" ✅

### B. Enable Email Confirmations

Scroll to **"Auth Providers"** → **"Email"**:

```
☑️ Enable Email Signup: ON
☑️ Confirm Email: ON ← THIS IS CRITICAL!
```

Click **"Save"**

### C. Configure Redirect URLs

Scroll to **"URL Configuration"**:

```
Site URL: https://resumelybuilderai.com

Additional Redirect URLs:
https://resumelybuilderai.com/auth/callback
https://resumelybuilderai.com/auth/signin
https://resumelybuilderai.com/dashboard
```

Click **"Save"**

### D. Update Email Template (Optional but Recommended)

Scroll to **"Email Templates"** → **"Confirm signup"**:

Change any text that says "ATS checker" to "access your dashboard"

Example subject: "Welcome to Resumely - Confirm Your Email"

Click **"Save"**

---

## STEP 3: End-to-End Test

### Test 1: Visual Verification

1. **Open**: https://resumelybuilderai.com

2. **Verify Header** (top right):
   - [ ] "Log In" button visible (ghost variant)
   - [ ] "Sign Up" button visible (default/solid variant)
   - [ ] NO "Contact Us" button

3. **Verify Hero Section** (below features list):
   - [ ] "Already have an account? Log in here" link visible
   - [ ] Link uses brand color (mobile-cta)

### Test 2: Signup Email Flow

1. **Open**: https://resumelybuilderai.com

2. **Click**: "Sign Up" button (in header)

3. **Fill Form**:
   ```
   Full Name: Test User
   Email: your-real-email@gmail.com
   Password: TestPassword123!
   ```

4. **Submit** and watch for:
   - [ ] Success message: "Check your email for the confirmation link!"
   - [ ] No errors in browser console (F12 → Console tab)

5. **Check Email** (within 60 seconds):
   - [ ] Email received
   - [ ] From: Resumely <noreply@resumelybuilderai.com>
   - [ ] Subject mentions "confirm" or "welcome"
   - [ ] Email in Inbox (not spam)
   - [ ] "Confirm Email" button/link present

6. **Click** confirmation link in email

7. **Verify** after clicking:
   - [ ] Redirects to: https://resumelybuilderai.com/dashboard
   - [ ] Dashboard loads successfully
   - [ ] Header shows: "Sign Out" button
   - [ ] See welcome message with your name

8. **Verify in Supabase**:
   - [ ] Dashboard → Authentication → Users
   - [ ] Test user appears in list
   - [ ] Status: "Confirmed" (green checkmark)
   - [ ] Email confirmed timestamp shows recent date/time

### Test 3: Login Flow

1. **Log out** (click "Sign Out" in header)

2. **Click**: "Log In" button (in header)

3. **Fill Form**:
   ```
   Email: your-test-email@gmail.com
   Password: TestPassword123!
   ```

4. **Submit** and verify:
   - [ ] Redirects to dashboard
   - [ ] No errors
   - [ ] User is logged in

### Test 4: Returning User from Landing Page

1. **Log out** again

2. **Go to**: https://resumelybuilderai.com (landing page)

3. **Scroll** to hero section (Free ATS Checker)

4. **Find and click**: "Already have an account? Log in here" link

5. **Verify**:
   - [ ] Redirects to: /auth/signin
   - [ ] Login form appears
   - [ ] Can log in successfully

---

## STEP 4: Troubleshooting

### Issue: Deployment Not Showing on Vercel

**Check**:
- Vercel project connected to correct GitHub repo?
- Vercel has access to the repository?
- Branch is set to "main" in Vercel settings?

**Fix**:
- Vercel Dashboard → Project Settings → Git
- Ensure "Production Branch" is set to: `main`
- Ensure GitHub app is connected and has repo access

### Issue: Email Still Not Arriving

**Check 1**: SMTP Save Failed
- Error message when saving SMTP settings?
- Try port 587 instead of 465 (uncheck SSL)

**Check 2**: Confirm Email Disabled
- Auth Settings → Email → "Confirm Email" must be ON

**Check 3**: Rate Limit Hit
- If testing repeatedly, Supabase rate limits (2 emails/hour in dev)
- Wait 1 hour or upgrade Supabase plan

**Check 4**: Resend Account Issue
- Go to: https://resend.com/
- Check API key is valid
- Verify domain is verified

**Check 5**: Check Logs
- Supabase Dashboard → Logs → Auth
- Look for SMTP errors
- Resend Dashboard → Emails
- Check if emails are being sent

### Issue: Login Buttons Not Showing

**Check 1**: Cache
- Hard refresh: Ctrl+F5 or Cmd+Shift+R
- Try incognito/private window

**Check 2**: Deployment Status
- Vercel Dashboard → Deployments
- Ensure latest deployment is "Ready"
- Check commit hash matches a6d118d

**Check 3**: Build Errors
- Vercel Dashboard → Deployment → Build Logs
- Look for errors or warnings
- Fix and redeploy if needed

---

## STEP 5: Final Verification

Once both issues are fixed, verify:

### User Flow 1: New User (Full Journey)
1. [ ] Land on homepage
2. [ ] See "Sign Up" button in header
3. [ ] Click "Sign Up"
4. [ ] Fill form and submit
5. [ ] See success message
6. [ ] Receive email < 60 seconds
7. [ ] Click email confirmation link
8. [ ] Land on dashboard
9. [ ] Logged in successfully

### User Flow 2: Returning User
1. [ ] Land on homepage
2. [ ] See "Log In" button in header OR
3. [ ] See "Log in here" link in hero
4. [ ] Click either link
5. [ ] Fill login form
6. [ ] Log in successfully
7. [ ] Land on dashboard

### User Flow 3: ATS Checker → Signup
1. [ ] Use free ATS checker
2. [ ] See signup CTA after results
3. [ ] Click signup
4. [ ] Complete signup flow
5. [ ] Receive email
6. [ ] Confirm and access dashboard
7. [ ] ATS score data converted to user account

---

## Success Criteria

✅ **Code Deployment**
- Latest commits (1961926, a6d118d) deployed to Vercel
- Production site shows new UI elements
- No build errors

✅ **Email Configuration**
- SMTP configured in Supabase
- Email confirmations enabled
- Test emails deliver < 60 seconds
- Emails land in inbox (not spam)

✅ **User Experience**
- Clear path to signup from anywhere on site
- Clear path to login for returning users
- Email confirmation works smoothly
- Dashboard accessible after confirmation

✅ **Production Ready**
- All user flows tested end-to-end
- No console errors
- No 404s or broken links
- Mobile responsive (test on phone)

---

## Timeline

**Total Time**: ~15 minutes

1. **Deploy to Vercel**: 5 minutes (trigger + wait)
2. **Configure Supabase SMTP**: 5 minutes
3. **Test End-to-End**: 5 minutes

**Deadline**: Before Monday soft launch

---

## Quick Commands Reference

### Redeploy via Git
```bash
cd resume-builder-ai
git commit --allow-empty -m "chore: trigger deployment"
git push origin main
```

### Check Deployment Status
```bash
# Via Vercel CLI
vercel ls

# Or visit
# https://vercel.com/dashboard
```

### Hard Refresh Browser
- **Windows**: Ctrl + F5
- **Mac**: Cmd + Shift + R
- **Chrome**: Ctrl/Cmd + Shift + Delete → Clear cache

---

## Support

**Vercel Issues**:
- https://vercel.com/docs
- Check deployment logs in dashboard

**Supabase Issues**:
- https://supabase.com/docs/guides/auth/auth-smtp
- Check auth logs in dashboard

**Emergency Contact**:
- resumebuilderaiteam@gmail.com

---

**Status**: 🔴 URGENT - Must complete before Monday
**Priority**: P0 - Blocking launch
**Owner**: You
**Next Action**: Start with Step 1 (Deploy to Vercel)
