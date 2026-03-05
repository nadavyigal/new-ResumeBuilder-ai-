# Manual E2E Testing Script - ResumeBuilder AI

**Date**: 2025-12-14  
**Tester**: Nadav  
**Environment**: Local Development (http://localhost:3000)  
**Duration**: ~2-3 hours  
**Status**: ⏳ PENDING

---

## 🎯 **Testing Objectives**

1. Verify all core user flows work end-to-end
2. Identify P0 bugs that block launch
3. Validate API integrations (OpenAI, Supabase, Stripe)
4. Ensure security works (users see only their data)
5. Test edge cases and error handling

---

## 📋 **Pre-Test Checklist**

Before starting, verify:
- [ ] `.env.local` file exists with all API keys
- [ ] Dev server is running (`npm run dev`)
- [ ] Database is accessible (run health check passed)
- [ ] Browser is ready (Chrome/Edge recommended)
- [ ] Developer tools open (F12) to check console for errors

---

## 🧪 **Test Flows** (Priority Order)

### **Flow 1: User Authentication** [P0 - Critical]

#### Test 1.1: Sign Up
**Estimated Time**: 5 minutes

**Steps**:
1. Navigate to http://localhost:3000
2. Click "Sign Up" or navigate to `/auth/signup`
3. Enter test email: `test+${Date.now()}@example.com`
4. Enter password: `TestPassword123!`
5. Click "Sign Up"

**Expected Results**:
- ✅ User is redirected to email verification page OR dashboard
- ✅ Success message displayed
- ✅ No console errors
- ✅ User record created in database

**Actual Results**:
```
Status: [ ] Pass  [ ] Fail  [ ] Partial
Notes:


```

**If Failed**:
- Priority: P0 (blocking)
- Check: Console errors, network tab, Supabase logs
- Action: Document exact error message

---

#### Test 1.2: Email Verification (If Required)
**Estimated Time**: 3 minutes

**Steps**:
1. Check email inbox for verification email
2. Click verification link
3. Should redirect back to app

**Expected Results**:
- ✅ Email received within 1 minute
- ✅ Link works and verifies email
- ✅ Redirected to dashboard

**Actual Results**:
```
Status: [ ] Pass  [ ] Fail  [ ] Partial  [ ] Skip (if no email verification)
Notes:


```

---

#### Test 1.3: Sign In
**Estimated Time**: 3 minutes

**Steps**:
1. Navigate to `/auth/signin`
2. Enter email and password from Test 1.1
3. Click "Sign In"

**Expected Results**:
- ✅ Successfully logged in
- ✅ Redirected to dashboard
- ✅ User session persists (refresh page - still logged in)

**Actual Results**:
```
Status: [ ] Pass  [ ] Fail  [ ] Partial
Notes:


```

---

### **Flow 2: Resume Upload** [P0 - Critical]

#### Test 2.1: Upload PDF Resume
**Estimated Time**: 5 minutes

**Preparation**: 
- Get a test PDF resume (or use one from `tests/fixtures/` if available)
- If you don't have one, create a simple PDF with your info

**Steps**:
1. From dashboard, navigate to resume upload page
2. Click "Upload Resume" or drag-and-drop area
3. Select a PDF file (< 10MB)
4. Click "Upload" or wait for auto-upload

**Expected Results**:
- ✅ Upload progress indicator shows
- ✅ File uploads successfully (< 5 seconds)
- ✅ Resume text is extracted and displayed
- ✅ No console errors
- ✅ Success message displayed

**Actual Results**:
```
Status: [ ] Pass  [ ] Fail  [ ] Partial
File Size: _____ KB
Upload Time: _____ seconds
Notes:


```

**If Failed**:
- Priority: P0 (blocking)
- Check: File size, MIME type, Supabase storage bucket permissions
- Try: Different PDF file

---

#### Test 2.2: Upload DOCX Resume
**Estimated Time**: 3 minutes

**Steps**:
1. Navigate to resume upload page
2. Upload a .docx file instead of PDF

**Expected Results**:
- ✅ DOCX file accepted and uploaded
- ✅ Text extracted correctly
- ✅ Formatting preserved reasonably

**Actual Results**:
```
Status: [ ] Pass  [ ] Fail  [ ] Partial  [ ] Skip (if no DOCX available)
Notes:


```

---

#### Test 2.3: Upload Invalid File
**Estimated Time**: 2 minutes

**Steps**:
1. Try uploading a .txt or .jpg file (not PDF/DOCX)

**Expected Results**:
- ✅ File rejected with clear error message
- ✅ "Only PDF and DOCX files are allowed"
- ✅ No crash or console errors

**Actual Results**:
```
Status: [ ] Pass  [ ] Fail  [ ] Partial
Notes:


```

---

### **Flow 3: Job Description Input** [P0 - Critical]

#### Test 3.1: Paste Job Description
**Estimated Time**: 3 minutes

**Preparation**:
- Find a real job description (from Indeed, LinkedIn, etc.)
- Or use this sample:
```
Senior Software Engineer
TechCorp Inc. - Remote

We're looking for an experienced software engineer with 5+ years of experience in React, TypeScript, and Node.js.

Requirements:
- 5+ years of software development experience
- Strong proficiency in React and TypeScript
- Experience with Node.js and Express
- AWS cloud experience
- Excellent communication skills

Responsibilities:
- Build and maintain web applications
- Collaborate with cross-functional teams
- Mentor junior developers
- Participate in code reviews
```

**Steps**:
1. Navigate to job description input page
2. Paste job description text into textarea
3. Click "Save" or "Next"

**Expected Results**:
- ✅ Job description saved successfully
- ✅ Text is parsed/stored
- ✅ Title and company extracted (if possible)
- ✅ Can proceed to optimization

**Actual Results**:
```
Status: [ ] Pass  [ ] Fail  [ ] Partial
JD Length: _____ characters
Extracted Title: 
Extracted Company: 
Notes:


```

---

#### Test 3.2: Job Description URL (If Supported)
**Estimated Time**: 3 minutes

**Steps**:
1. Try entering a job URL instead of pasting text
2. Example: https://linkedin.com/jobs/view/123456789

**Expected Results**:
- ✅ URL is validated and accepted
- ✅ Job description scraped automatically (if implemented)
- ✅ OR user is prompted to paste text

**Actual Results**:
```
Status: [ ] Pass  [ ] Fail  [ ] Partial  [ ] Not Implemented
Notes:


```

---

### **Flow 4: Resume Optimization** [P0 - CRITICAL]

#### Test 4.1: Generate Optimization
**Estimated Time**: 30-60 seconds (API call)

**Steps**:
1. With resume and JD uploaded, click "Optimize" or "Generate"
2. Wait for AI processing

**Expected Results**:
- ✅ Loading indicator shows
- ✅ Process completes within 60 seconds
- ✅ Optimized resume is generated
- ✅ Match score is calculated (0-100)
- ✅ Can view optimized version
- ✅ No console errors

**Actual Results**:
```
Status: [ ] Pass  [ ] Fail  [ ] Partial
Processing Time: _____ seconds
Match Score: _____ / 100
Optimizations Applied: _____ items
Notes:


```

**If Failed**:
- Priority: P0 (BLOCKING - core feature)
- Check: OpenAI API key, console errors, network tab
- Error Message: 

---

#### Test 4.2: View Optimization Results
**Estimated Time**: 5 minutes

**Steps**:
1. Review the optimized resume
2. Check suggested changes
3. Verify improvements are reasonable

**Expected Results**:
- ✅ Optimized resume displays properly
- ✅ Changes make sense (relevant to job)
- ✅ Keywords from JD are incorporated
- ✅ Formatting is intact
- ✅ Original resume preserved (can compare)

**Actual Results**:
```
Status: [ ] Pass  [ ] Fail  [ ] Partial
Quality of Changes: [ ] Excellent  [ ] Good  [ ] Acceptable  [ ] Poor
Notes:


```

---

### **Flow 5: ATS Scoring** [P0 - Critical]

#### Test 5.1: View ATS Score
**Estimated Time**: 3 minutes

**Steps**:
1. After optimization, navigate to ATS score section
2. Review the score and sub-scores

**Expected Results**:
- ✅ ATS score displayed (0-100)
- ✅ Score breakdown shown (8 sub-scores if v2)
- ✅ Score seems reasonable (not random)
- ✅ Suggestions are actionable

**Actual Results**:
```
Status: [ ] Pass  [ ] Fail  [ ] Partial
ATS Score: _____ / 100
Sub-scores displayed: [ ] Yes  [ ] No
Score seems accurate: [ ] Yes  [ ] Somewhat  [ ] No
Notes:


```

---

#### Test 5.2: Validate Score Accuracy (Manual Check)
**Estimated Time**: 5 minutes

**Steps**:
1. Read your resume and the job description
2. Mentally assess if the score makes sense
3. Check if keywords from JD appear in resume

**Expected Results**:
- ✅ Score correlates with actual keyword overlap
- ✅ Higher keywords = higher score
- ✅ Missing important keywords = lower score

**Actual Results**:
```
Status: [ ] Accurate  [ ] Somewhat Accurate  [ ] Inaccurate
Reasoning:


```

---

### **Flow 6: Chat Refinement** [P0 - Critical]

#### Test 6.1: Start Chat Session
**Estimated Time**: 5 minutes

**Steps**:
1. Navigate to chat/refinement interface
2. Send a message: "Make my work experience more quantitative with metrics"
3. Wait for AI response

**Expected Results**:
- ✅ Chat interface loads
- ✅ Message sends successfully
- ✅ AI responds within 30 seconds
- ✅ Response is relevant and helpful
- ✅ Modifications are applied to resume

**Actual Results**:
```
Status: [ ] Pass  [ ] Fail  [ ] Partial
Response Time: _____ seconds
Quality: [ ] Excellent  [ ] Good  [ ] Acceptable  [ ] Poor
Changes Applied: [ ] Yes  [ ] No  [ ] Partial
Notes:


```

---

#### Test 6.2: Multiple Chat Iterations
**Estimated Time**: 10 minutes

**Test Prompts**:
1. "Add more action verbs to my bullet points"
2. "Emphasize my leadership experience"
3. "Make it more concise, reduce to one page"

**Expected Results**:
- ✅ Each message gets a response
- ✅ Modifications are cumulative (build on previous)
- ✅ Can see change history
- ✅ Can undo changes if needed

**Actual Results**:
```
Status: [ ] Pass  [ ] Fail  [ ] Partial
Iteration 1: 
Iteration 2: 
Iteration 3: 
Notes:


```

---

### **Flow 7: Template Application** [P1 - Important]

#### Test 7.1: View Available Templates
**Estimated Time**: 3 minutes

**Steps**:
1. Navigate to template selection page
2. Browse available templates

**Expected Results**:
- ✅ Templates are displayed with previews
- ✅ Can see template names and styles
- ✅ At least 2-4 templates available

**Actual Results**:
```
Status: [ ] Pass  [ ] Fail  [ ] Partial
Number of Templates: _____
Templates Working: [ ] All  [ ] Some  [ ] None
Notes:


```

---

#### Test 7.2: Apply Template
**Estimated Time**: 5 minutes

**Steps**:
1. Select a template (e.g., "Modern", "ATS-Optimized")
2. Click "Apply" or "Use This Template"
3. Wait for template to render

**Expected Results**:
- ✅ Template applies successfully
- ✅ Resume content fits the template
- ✅ Formatting looks good
- ✅ No broken layout or overlapping text
- ✅ Can preview before confirming

**Actual Results**:
```
Status: [ ] Pass  [ ] Fail  [ ] Partial
Template Applied: 
Layout Quality: [ ] Excellent  [ ] Good  [ ] Acceptable  [ ] Broken
Notes:


```

---

#### Test 7.3: Switch Templates
**Estimated Time**: 3 minutes

**Steps**:
1. Apply a different template
2. Switch back to original

**Expected Results**:
- ✅ Can change templates easily
- ✅ Content is preserved when switching
- ✅ Previous template selection is remembered

**Actual Results**:
```
Status: [ ] Pass  [ ] Fail  [ ] Partial
Notes:


```

---

### **Flow 8: PDF Export** [P0 - CRITICAL]

#### Test 8.1: Export to PDF
**Estimated Time**: 10 minutes

**Steps**:
1. Navigate to export page
2. Click "Download PDF" or "Export"
3. Wait for PDF generation
4. Download and open the PDF

**Expected Results**:
- ✅ PDF generates within 10 seconds
- ✅ PDF downloads successfully
- ✅ PDF opens without errors
- ✅ All content is visible (not cut off)
- ✅ Formatting is intact
- ✅ PDF looks professional
- ✅ PDF is readable (not corrupted)

**Actual Results**:
```
Status: [ ] Pass  [ ] Fail  [ ] Partial
Generation Time: _____ seconds
File Size: _____ KB
PDF Quality: [ ] Excellent  [ ] Good  [ ] Acceptable  [ ] Poor
Issues Found:


```

**If Failed**:
- Priority: P0 (blocking)
- Check: Console errors, file size, template rendering

---

#### Test 8.2: Export to DOCX (If Supported)
**Estimated Time**: 5 minutes

**Steps**:
1. Try exporting to DOCX format

**Expected Results**:
- ✅ DOCX exports successfully
- ✅ Opens in Word/Google Docs
- ✅ Formatting is editable

**Actual Results**:
```
Status: [ ] Pass  [ ] Fail  [ ] Not Implemented
Notes:


```

---

### **Flow 9: Upgrade to Premium** [P1 - Important]

#### Test 9.1: View Premium Features
**Estimated Time**: 3 minutes

**Steps**:
1. Navigate to upgrade/pricing page
2. Review premium features

**Expected Results**:
- ✅ Premium features are clearly listed
- ✅ Pricing is displayed
- ✅ Free tier limitations are shown
- ✅ Call-to-action button is visible

**Actual Results**:
```
Status: [ ] Pass  [ ] Fail  [ ] Partial
Pricing: $_____ / month
Features Clear: [ ] Yes  [ ] Somewhat  [ ] No
Notes:


```

---

#### Test 9.2: Upgrade Flow (Development Mode)
**Estimated Time**: 5 minutes

**Steps**:
1. Click "Upgrade to Premium"
2. Follow the upgrade flow

**Expected Results** (Development Mode):
- ✅ Since Stripe not configured, shows development mode message
- ✅ OR immediately upgrades plan in database (dev mode)
- ✅ User plan updates to "premium"
- ✅ Premium features are unlocked

**Expected Results** (Production/Stripe Configured):
- ✅ Redirects to Stripe checkout
- ✅ Test payment works (use Stripe test card)
- ✅ Returns to app after payment
- ✅ Plan is upgraded

**Actual Results**:
```
Status: [ ] Pass  [ ] Fail  [ ] Partial  [ ] Skip (Stripe not configured)
Mode: [ ] Development  [ ] Production
Plan Updated: [ ] Yes  [ ] No
Notes:


```

---

### **Flow 10: Multi-User Security** [P0 - CRITICAL]

#### Test 10.1: Data Isolation
**Estimated Time**: 15 minutes

**Setup**:
1. Create TWO separate user accounts (use different emails)
2. Upload resume for User A
3. Create optimization for User A
4. Log out

**Steps**:
1. Log in as User B
2. Try to access User A's data

**Expected Results**:
- ✅ User B CANNOT see User A's resumes
- ✅ User B CANNOT see User A's optimizations
- ✅ User B CANNOT see User A's applications
- ✅ Dashboard shows only User B's data
- ✅ No way to access other users' URLs

**Actual Results**:
```
Status: [ ] Pass  [ ] FAIL (CRITICAL!)  [ ] Partial
User A Resumes Visible to User B: [ ] Yes (BUG!)  [ ] No (Good)
User A Optimizations Visible: [ ] Yes (BUG!)  [ ] No (Good)
Notes:


```

**If Failed**:
- Priority: P0 (CRITICAL SECURITY BUG)
- Action: DO NOT LAUNCH
- Report: Immediately document and fix

---

### **Flow 11: Error Handling** [P1 - Important]

#### Test 11.1: No Internet Connection
**Estimated Time**: 5 minutes

**Steps**:
1. Disconnect internet (or use DevTools to go offline)
2. Try to upload resume or optimize

**Expected Results**:
- ✅ Clear error message displayed
- ✅ "Please check your connection" or similar
- ✅ No app crash
- ✅ Can retry when back online

**Actual Results**:
```
Status: [ ] Pass  [ ] Fail  [ ] Partial
Error Message Quality: [ ] Good  [ ] Acceptable  [ ] Poor
Notes:


```

---

#### Test 11.2: Invalid API Key (Simulated)
**Estimated Time**: 5 minutes

**Steps**:
1. Temporarily change OpenAI API key in `.env.local` to invalid value
2. Restart dev server
3. Try to optimize resume

**Expected Results**:
- ✅ Clear error message (not cryptic)
- ✅ Doesn't expose API key in error
- ✅ Suggests checking configuration

**Actual Results**:
```
Status: [ ] Pass  [ ] Fail  [ ] Skip
Error Message: 


Notes:


```

**IMPORTANT**: Restore correct API key after test!

---

#### Test 11.3: Rate Limiting
**Estimated Time**: 5 minutes

**Steps**:
1. Make rapid repeated requests (e.g., optimize 5 times quickly)

**Expected Results**:
- ✅ After X requests, rate limit kicks in
- ✅ Clear error: "Too many requests, please wait"
- ✅ Shows retry time or cooldown period
- ✅ No server crash

**Actual Results**:
```
Status: [ ] Pass  [ ] Fail  [ ] Partial
Rate Limit Triggered: [ ] Yes  [ ] No
Message: 


Notes:


```

---

### **Flow 12: Edge Cases** [P2 - Nice to Have]

#### Test 12.1: Very Long Resume (10+ pages)
**Estimated Time**: 5 minutes

**Steps**:
1. Upload a very long resume (or duplicate content 10x)

**Expected Results**:
- ✅ Handles large file gracefully
- ✅ OR shows error: "Resume too long, please keep under X pages"
- ✅ Doesn't crash or timeout

**Actual Results**:
```
Status: [ ] Pass  [ ] Fail  [ ] Skip
Notes:


```

---

#### Test 12.2: Resume with Special Characters
**Estimated Time**: 3 minutes

**Steps**:
1. Upload resume with special chars (é, ñ, 中文, 日本語)

**Expected Results**:
- ✅ Special characters preserved
- ✅ No encoding issues
- ✅ Export maintains characters

**Actual Results**:
```
Status: [ ] Pass  [ ] Fail  [ ] Skip
Notes:


```

---

#### Test 12.3: Empty Fields
**Estimated Time**: 3 minutes

**Steps**:
1. Try to optimize with minimal data (very short resume)

**Expected Results**:
- ✅ Handles gracefully
- ✅ Shows helpful error or proceeds with warnings

**Actual Results**:
```
Status: [ ] Pass  [ ] Fail  [ ] Skip
Notes:


```

---

## 📊 **Test Summary Sheet**

### Critical Flows (P0) - Must Pass

| Flow | Status | Priority | Blocker? |
|------|--------|----------|----------|
| Sign Up | ⏳ | P0 | [ ] Yes [ ] No |
| Sign In | ⏳ | P0 | [ ] Yes [ ] No |
| Upload PDF | ⏳ | P0 | [ ] Yes [ ] No |
| Job Description Input | ⏳ | P0 | [ ] Yes [ ] No |
| **Generate Optimization** | ⏳ | **P0** | [ ] **Yes** [ ] No |
| View ATS Score | ⏳ | P0 | [ ] Yes [ ] No |
| Chat Refinement | ⏳ | P0 | [ ] Yes [ ] No |
| **Export PDF** | ⏳ | **P0** | [ ] **Yes** [ ] No |
| **Data Isolation (Security)** | ⏳ | **P0** | [ ] **Yes** [ ] No |

### Important Flows (P1) - Should Pass

| Flow | Status | Priority | Blocker? |
|------|--------|----------|----------|
| Email Verification | ⏳ | P1 | [ ] Yes [ ] No |
| Upload DOCX | ⏳ | P1 | [ ] Yes [ ] No |
| Apply Template | ⏳ | P1 | [ ] Yes [ ] No |
| Upgrade Premium | ⏳ | P1 | [ ] Yes [ ] No |
| Error Handling | ⏳ | P1 | [ ] Yes [ ] No |

### Nice to Have (P2) - Can Defer

| Flow | Status | Priority |
|------|--------|----------|
| Export DOCX | ⏳ | P2 |
| Edge Cases | ⏳ | P2 |
| Rate Limiting Display | ⏳ | P2 |

---

## 🐛 **Bug Report Template**

For each bug found, fill out:

### Bug #___

**Title**: [Short description]

**Severity**: 
- [ ] P0 - BLOCKER (Cannot launch)
- [ ] P1 - CRITICAL (Must fix before launch)
- [ ] P2 - HIGH (Should fix soon)
- [ ] P3 - MEDIUM (Fix when possible)
- [ ] P4 - LOW (Nice to have)

**Flow**: [Which test flow?]

**Steps to Reproduce**:
1. 
2. 
3. 

**Expected Result**:


**Actual Result**:


**Screenshots/Error Messages**:
```


```

**Console Errors**:
```


```

**Impact**:
- [ ] Blocks all users
- [ ] Blocks some users
- [ ] Workaround exists
- [ ] Cosmetic only

**Action Required**:
- [ ] Fix immediately (P0)
- [ ] Fix before launch (P1)
- [ ] Fix post-launch (P2+)

---

## ✅ **Test Completion Checklist**

- [ ] All P0 flows tested
- [ ] All P1 flows tested
- [ ] Bugs documented with priority
- [ ] P0 bugs fixed (if any)
- [ ] P1 bugs assessed (fix or defer decision)
- [ ] Test results shared with team
- [ ] Launch decision made

---

## 🎯 **Launch Decision Criteria**

### Can Launch If:
- ✅ All P0 flows pass (or bugs fixed)
- ✅ Core optimization flow works (upload → optimize → export)
- ✅ Security works (data isolation confirmed)
- ✅ No critical bugs that affect all users
- ⚠️ P1 bugs exist but have workarounds

### Cannot Launch If:
- ❌ P0 flow completely broken
- ❌ Security vulnerability (users see other users' data)
- ❌ Core feature unusable (optimization fails every time)
- ❌ Data loss issue (uploads disappear)

---

## 📊 **Test Metrics to Track**

After completing all tests, fill out:

**Overall Pass Rate**: _____% (___ passed / ___ total)
**P0 Pass Rate**: _____% (___ passed / ___ total P0)
**Critical Bugs Found**: _____
**Total Bugs Found**: _____
**Time Spent Testing**: _____ hours

**Launch Recommendation**:
- [ ] Ready to Launch ✅
- [ ] Ready with P1 fixes ⚠️
- [ ] Not Ready - Critical bugs ❌

---

**Testing Completed**: [ ] Yes  [ ] No  [ ] Partial  
**Date Completed**: _____________  
**Sign-off**: _____________

---

## 📁 **Files to Save**

After testing, save:
1. This completed test script
2. Screenshots of any bugs
3. Console log exports (if errors found)
4. List of P0 bugs to fix

---

**Good luck with testing! 🚀**  
**Remember**: The goal is to find bugs NOW, not after users do. Be thorough!
