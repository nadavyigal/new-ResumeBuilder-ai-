# 🚀 EMAIL CONFIRMATION - QUICK FIX (5 Minutes)

**Problem**: Users not receiving confirmation emails after signup
**Cause**: Supabase SMTP not configured
**Solution**: Configure Resend SMTP

---

## ⚡ IMMEDIATE FIX

### 1️⃣ Configure Supabase (3 min)

1. Open: https://supabase.com/dashboard/project/rsnibhkhsbfhdkqzjako/settings/auth
2. Scroll to **SMTP Settings**
3. Toggle **Enable Custom SMTP** = ON
4. Enter:
   ```
   Sender email: noreply@resumelybuilderai.com
   Sender name: Resumely

   Host: smtp.resend.com
   Port: 465
   Username: resend
   Password: re_eLNmG5GV_7XXnDS7U62JBRzyA89mdBrQq

   Enable SSL: ✅ YES
   ```
5. Click **Save**

---

### 2️⃣ Add Environment Variable (2 min)

1. Open: https://vercel.com/nadavyigal-gmailcoms-projects/resume-builder-ai/settings/environment-variables
2. Add:
   ```
   Key: RESEND_API_KEY
   Value: re_eLNmG5GV_7XXnDS7U62JBRzyA89mdBrQq
   Environments: ✅ Production ✅ Preview ✅ Development
   ```
3. **Save** and **Redeploy**

---

### 3️⃣ Test (1 min)

1. Visit: https://resumelybuilderai.com/auth/signup
2. Create test account with your email
3. Check inbox for confirmation email
4. Click link → should redirect to dashboard

---

## ✅ SUCCESS CHECKLIST

- [ ] Supabase SMTP configured with Resend
- [ ] Resend API key added to Vercel
- [ ] Test signup successful
- [ ] Confirmation email received
- [ ] User can access dashboard

---

## 🆘 IF STILL NOT WORKING

1. **Check Resend Dashboard**: https://resend.com/emails
   - See if emails are being sent

2. **Check Supabase Logs**: Dashboard → Logs
   - Look for SMTP errors

3. **Check Spam Folder**: First emails often land there

4. **Verify Domain**: Resend → Domains → resumelybuilderai.com should be verified

---

**Need help?** See full guide: [EMAIL-CONFIRMATION-FIX.md](./EMAIL-CONFIRMATION-FIX.md)

**Resend Password**: `re_eLNmG5GV_7XXnDS7U62JBRzyA89mdBrQq`
