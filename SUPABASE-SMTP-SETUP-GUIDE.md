# 🔧 SUPABASE SMTP CONFIGURATION - STEP-BY-STEP

**Issue**: Registration emails not being sent
**Root Cause**: Supabase Auth SMTP not configured to use Resend
**Project**: `rsnibhkhsbfhdkqzjako.supabase.co`

---

## ⚠️ CRITICAL UNDERSTANDING

Having `RESEND_API_KEY` in your environment variables is **NOT enough**!

### What Happens When User Signs Up:
```
1. User fills signup form on your website
2. supabase.auth.signUp() is called
3. Supabase Auth tries to send confirmation email
4. ❌ Supabase DOESN'T use your Resend API key automatically
5. ❌ Supabase uses its own email service (which is NOT configured)
6. ❌ Email never arrives
```

### What Needs to Happen:
```
1. User fills signup form
2. supabase.auth.signUp() is called
3. ✅ Supabase Auth uses CONFIGURED SMTP (Resend)
4. ✅ Resend sends email via SMTP
5. ✅ Email arrives in user's inbox
6. ✅ User clicks link and gets confirmed
```

---

## 🎯 THE FIX: Configure Supabase Dashboard

**You MUST configure Supabase's Auth settings in the dashboard to use Resend SMTP.**

### Step 1: Open Supabase Auth Settings

1. Go to: **https://supabase.com/dashboard/project/rsnibhkhsbfhdkqzjako/settings/auth**

2. Scroll down to find **"SMTP Settings"** section

---

### Step 2: Enable Custom SMTP

1. Find the toggle: **"Enable Custom SMTP"**

2. Turn it **ON** (slide to the right, should turn purple/green)

---

### Step 3: Enter Resend SMTP Credentials

Fill in these **EXACT** values:

```
┌─────────────────────────────────────────────────────────┐
│ Sender email:                                           │
│ noreply@resumelybuilderai.com                          │
├─────────────────────────────────────────────────────────┤
│ Sender name:                                            │
│ Resumely                                                │
├─────────────────────────────────────────────────────────┤
│ Host:                                                   │
│ smtp.resend.com                                         │
├─────────────────────────────────────────────────────────┤
│ Port number:                                            │
│ 465                                                     │
├─────────────────────────────────────────────────────────┤
│ Username:                                               │
│ resend                                                  │
├─────────────────────────────────────────────────────────┤
│ Password:                                               │
│ re_eLNmG5GV_7XXnDS7U62JBRzyA89mdBrQq                   │
├─────────────────────────────────────────────────────────┤
│ ☑️ Enable SSL                                           │
│ (Must be CHECKED for port 465)                         │
└─────────────────────────────────────────────────────────┘
```

---

### Step 4: Save Configuration

1. Click **"Save"** button at the bottom

2. Supabase will **test the connection** automatically

3. You should see: **✅ "SMTP settings saved successfully"**

4. If you see an error:
   - Double-check the password (no extra spaces)
   - Verify port is 465
   - Ensure SSL is checked

---

### Step 5: Verify Email Templates

1. Stay on the same page (Auth settings)

2. Scroll up to find **"Email Templates"** section

3. Click on **"Confirm signup"** template

4. Verify the template looks good (you can customize later)

5. **IMPORTANT**: Check that `{{ .ConfirmationURL }}` is present in the template

---

### Step 6: Check URL Configuration

1. Scroll to **"URL Configuration"** section

2. Verify these settings:

```
Site URL: https://resumelybuilderai.com

Additional Redirect URLs:
- https://resumelybuilderai.com/auth/confirm
- https://resumelybuilderai.com/auth/callback
- https://resumelybuilderai.com/dashboard
```

3. **Save** if you made any changes

---

## 🧪 TESTING THE FIX

### Test 1: Local Development

1. Ensure dev server is running:
   ```bash
   cd resume-builder-ai
   npm run dev
   ```

2. Open: http://localhost:3000/auth/signup

3. Create test account with **your real email**

4. Watch the browser console for any errors

5. Check your email inbox (within 30 seconds)

6. Click confirmation link

7. Should redirect to dashboard

---

### Test 2: Production

1. Open: https://resumelybuilderai.com/auth/signup

2. Create test account with a **different email**

3. Should see message: "Check your email for the confirmation link!"

4. Check inbox within 30 seconds

5. Click link → should go to dashboard

---

## 🔍 TROUBLESHOOTING

### Problem: "SMTP settings failed to save"

**Solution 1**: Check Password
- Copy-paste the password again
- Make sure no extra spaces: `re_eLNmG5GV_7XXnDS7U62JBRzyA89mdBrQq`
- Password should be exactly 42 characters

**Solution 2**: Verify Resend Account
- Go to: https://resend.com/
- Check that your account is active
- Verify the API key is valid

**Solution 3**: Try Port 587 with TLS
- Change Port to: `587`
- Uncheck "Enable SSL"
- This uses TLS instead of SSL

---

### Problem: Email Still Not Arriving

**Check 1**: Verify SMTP is Enabled
- Supabase Dashboard → Auth Settings
- "Enable Custom SMTP" should be **ON** (green/purple)

**Check 2**: Check Supabase Logs
- Dashboard → Logs
- Filter by: "auth"
- Look for SMTP send attempts or errors

**Check 3**: Check Resend Dashboard
- Go to: https://resend.com/emails
- See if any emails were sent
- Check delivery status

**Check 4**: Verify Domain
- Resend Dashboard → Domains
- Ensure `resumelybuilderai.com` is verified
- Status should show ✅ "Verified"

**Check 5**: Check Spam Folder
- First emails often go to spam
- Mark as "Not Spam" to train filters

---

### Problem: Email Arrives But Link Doesn't Work

**Check**: URL Configuration in Supabase
- Site URL must be: `https://resumelybuilderai.com`
- NOT `http://` or `localhost`

**Fix**:
1. Supabase Dashboard → Auth Settings
2. URL Configuration section
3. Update Site URL
4. Add redirect URL: `https://resumelybuilderai.com/auth/confirm`
5. Save

---

### Problem: "Error: Invalid login credentials"

This means user tried to sign in before confirming email.

**Solution**: User must click confirmation link first
- Check email for confirmation link
- Click link to verify
- Then try signing in

---

## 📊 VERIFICATION CHECKLIST

After configuration, verify:

### Supabase Dashboard
- [ ] Custom SMTP enabled (toggle ON)
- [ ] Host: `smtp.resend.com`
- [ ] Port: `465`
- [ ] SSL: Enabled (checked)
- [ ] Username: `resend`
- [ ] Password: Configured (42 chars)
- [ ] Sender email: `noreply@resumelybuilderai.com`
- [ ] Settings saved successfully

### Email Templates
- [ ] Confirmation template exists
- [ ] Contains `{{ .ConfirmationURL }}`
- [ ] Subject line looks good
- [ ] Branding/styling acceptable

### URL Configuration
- [ ] Site URL: `https://resumelybuilderai.com`
- [ ] Redirect URLs include `/auth/confirm`
- [ ] No `localhost` URLs in production

### Environment Variables (Vercel)
- [ ] `RESEND_API_KEY` in Production
- [ ] `NEXT_PUBLIC_SUPABASE_URL` in Production
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Production
- [ ] Application redeployed after adding vars

### Testing
- [ ] Local signup works
- [ ] Production signup works
- [ ] Email arrives within 30 seconds
- [ ] Confirmation link works
- [ ] User redirected to dashboard
- [ ] User can access protected routes

---

## 🎯 EXPECTED BEHAVIOR AFTER FIX

### When User Signs Up:

1. User fills form on `/auth/signup`
2. Clicks "Create Account"
3. Sees message: "Check your email for the confirmation link!"
4. Within 30 seconds: Email arrives from `noreply@resumelybuilderai.com`
5. User opens email
6. Clicks "Confirm Email Address" button
7. Browser opens: `https://resumelybuilderai.com/auth/confirm?token_hash=...`
8. Page verifies token with Supabase
9. User redirected to: `https://resumelybuilderai.com/dashboard`
10. User is logged in and can use the app

### Email Details:
- **From**: Resumely <noreply@resumelybuilderai.com>
- **Subject**: Confirm your Resumely account
- **Delivery time**: < 30 seconds
- **Location**: Inbox (not spam)
- **Link validity**: 24 hours

---

## 🔐 SECURITY NOTES

### SMTP Credentials Security
- ✅ Password stored in Supabase (encrypted at rest)
- ✅ Not exposed in client-side code
- ✅ Only Supabase Auth service can use it
- ✅ Transmitted over encrypted connection (SSL/TLS)

### Email Security
- ✅ Domain should be verified in Resend
- ✅ SPF/DKIM records should be configured
- ✅ Uses secure SMTP connection (port 465 with SSL)
- ✅ Confirmation tokens expire after 24 hours

---

## 📈 MONITORING

### After Configuration, Monitor:

**1. Resend Dashboard** (https://resend.com/)
- Navigate to "Emails"
- Watch for new sends
- Check delivery status (delivered/bounced/failed)
- Monitor bounce rate (should be < 2%)

**2. Supabase Logs** (Dashboard → Logs)
- Filter: "auth"
- Look for: "email sent" events
- Watch for: SMTP errors
- Check: Confirmation success rate

**3. Your Application**
- Monitor: Signup conversion rate
- Track: Time from signup to confirmation
- Alert: If no emails sent in 1 hour
- Dashboard: User growth metrics

---

## 🚨 COMMON MISTAKES

### ❌ DON'T DO THIS:
1. ❌ Using `smtp.gmail.com` (Gmail blocks this)
2. ❌ Using port 25 (often blocked by ISPs)
3. ❌ Leaving SSL unchecked for port 465
4. ❌ Using `http://` in Site URL for production
5. ❌ Using `localhost` in redirect URLs for production
6. ❌ Forgetting to verify domain in Resend
7. ❌ Not configuring SPF/DKIM DNS records

### ✅ DO THIS:
1. ✅ Use `smtp.resend.com` with port 465 + SSL
2. ✅ Use verified domain email as sender
3. ✅ Test with real email addresses
4. ✅ Monitor Resend dashboard after configuration
5. ✅ Check spam folder for first emails
6. ✅ Configure proper redirect URLs
7. ✅ Keep SMTP credentials secure

---

## 📞 GETTING HELP

### If Still Not Working After Following This Guide:

**1. Check Supabase Status**
- https://status.supabase.com/
- Ensure no outages

**2. Check Resend Status**
- https://resend.com/status
- Ensure SMTP service is operational

**3. Test SMTP Directly**

Use this command to test Resend SMTP (replace with your email):

```bash
curl -X POST 'https://api.resend.com/emails' \
  -H 'Authorization: Bearer re_eLNmG5GV_7XXnDS7U62JBRzyA89mdBrQq' \
  -H 'Content-Type: application/json' \
  -d '{
    "from": "noreply@resumelybuilderai.com",
    "to": "your-email@example.com",
    "subject": "SMTP Test",
    "html": "<p>If you receive this, Resend SMTP is working!</p>"
  }'
```

**4. Contact Support**
- Supabase: https://discord.supabase.com
- Resend: support@resend.com

---

## 🎉 SUCCESS CRITERIA

You've successfully configured SMTP when:

- ✅ Test user receives confirmation email
- ✅ Email arrives in < 30 seconds
- ✅ Email lands in inbox (not spam)
- ✅ Confirmation link works on first click
- ✅ User can access dashboard after confirming
- ✅ No errors in Supabase logs
- ✅ Resend dashboard shows "delivered" status
- ✅ Production signup flow works end-to-end

---

## 🔄 NEXT STEPS AFTER SMTP IS WORKING

1. **Customize Email Templates**
   - Supabase → Auth Settings → Email Templates
   - Brand the emails with your colors/logo
   - Add helpful links and CTAs

2. **Set Up Email Analytics**
   - Monitor open rates in Resend
   - Track confirmation conversion rate
   - Set up alerts for delivery failures

3. **Configure Other Auth Emails**
   - Password reset email
   - Email change confirmation
   - Magic link email (if using)

4. **Verify Domain in Resend**
   - Add DNS records (SPF, DKIM, DMARC)
   - Improves deliverability
   - Prevents emails going to spam

5. **Test Edge Cases**
   - Expired confirmation links
   - Already confirmed users trying to sign up again
   - Invalid email addresses
   - Bounce handling

---

**Last Updated**: December 24, 2025
**Priority**: 🔴 CRITICAL
**Status**: Ready to configure
**Estimated Time**: 5 minutes

---

## 🚀 START HERE:

**Go to**: https://supabase.com/dashboard/project/rsnibhkhsbfhdkqzjako/settings/auth

**Then follow**: Step 1 → Step 2 → Step 3 → Step 4 → Test

Good luck! 🎯
