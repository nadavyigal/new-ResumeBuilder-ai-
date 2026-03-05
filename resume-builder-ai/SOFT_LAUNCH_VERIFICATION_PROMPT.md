# 🚀 SOFT LAUNCH READINESS VERIFICATION
## Copy this entire prompt into a new Claude Code chat

---

## CONTEXT

I'm about to soft launch ResumeBuilder AI (resumelybuilderai.com) - an AI-powered resume optimizer with a viral growth engine (free ATS score checker).

**Status so far:**
- ✅ Anonymous ATS checker migration deployed
- ✅ Newsletter migration deployed
- ✅ Blog post written
- ✅ Launch assets written

**What I need from you:**
Verify I'm 100% ready for soft launch by systematically testing everything and fixing any issues found. I want ZERO surprises when real users arrive.

---

## YOUR MISSION

Execute a comprehensive pre-flight check covering:

1. **Production Deployment Verification**
2. **End-to-End User Flow Testing**
3. **Analytics & Tracking Verification**
4. **Email Systems Testing**
5. **SEO & Discoverability Check**
6. **Social Sharing Mechanics**
7. **Performance & Mobile Testing**
8. **Launch Copy Review & Optimization**
9. **Final Pre-Flight Checklist**

For each section, test thoroughly and report:
- ✅ What works
- ❌ What's broken (and how to fix)
- ⚠️ What needs improvement

---

## 1. PRODUCTION DEPLOYMENT VERIFICATION

### Database Migrations
**Check these migrations are applied in production Supabase:**

```bash
# Run this to verify
cd resume-builder-ai
```

**Verify in Supabase Dashboard:**
- Navigate to: https://supabase.com/dashboard → project → Table Editor
- Confirm these tables exist:
  - [ ] `anonymous_ats_scores` (with columns: id, session_id, ip_address, ats_score, ats_subscores, ats_suggestions, resume_hash, job_description_hash, user_id, optimization_id, converted_at, created_at, expires_at)
  - [ ] `rate_limits` (with columns: id, identifier, endpoint, requests_count, window_start)
  - [ ] `newsletter_subscribers` (with columns: id, email, name, subscribed_at, status, created_at, updated_at)

**Test migration data:**
- [ ] Insert a test row in `anonymous_ats_scores` via SQL Editor
- [ ] Verify RLS policies allow anonymous inserts
- [ ] Verify row appears in table

**Expected result:** All tables exist with correct schema and RLS policies

---

### Environment Variables
**Verify in Vercel Dashboard (resumelybuilderai.com project):**

Navigate to: Settings → Environment Variables

**Critical variables that MUST be set:**
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `OPENAI_API_KEY`
- [ ] `RESEND_API_KEY`
- [ ] `NEXT_PUBLIC_POSTHOG_KEY`
- [ ] `NEXT_PUBLIC_POSTHOG_HOST`

**Action if missing:** Add missing variables and redeploy

---

### Build & Deployment Status
**Check Vercel deployment:**

```bash
# Test build locally first
cd resume-builder-ai
npm run build

# Expected: Build completes with 0 errors
```

**Verify in Vercel:**
- [ ] Latest deployment is "Ready" (not "Failed")
- [ ] Deployment matches latest git commit
- [ ] No build warnings about missing env vars
- [ ] Check deployment logs for errors

**Test production URL:**
- [ ] Visit https://resumelybuilderai.com
- [ ] Page loads without errors (check browser console)
- [ ] No 404s or broken images
- [ ] CSS loads correctly (not unstyled)

---

## 2. END-TO-END USER FLOW TESTING

### Flow 1: Anonymous ATS Check (Critical!)
**This is your viral growth engine - must work flawlessly**

**Test as incognito user (NOT logged in):**

1. **Visit landing page**
   - [ ] Free ATS checker is prominently displayed
   - [ ] Upload button works
   - [ ] Job description textarea is visible

2. **Upload resume**
   - [ ] Can select PDF file (<10MB)
   - [ ] File name displays after selection
   - [ ] No errors in console

3. **Enter job description**
   - [ ] Can paste text (at least 100 words)
   - [ ] Character count displays (if applicable)
   - [ ] Validation works for short descriptions

4. **Submit and check score**
   - [ ] "Check Score" button is clickable
   - [ ] Loading state shows (progress indicator)
   - [ ] Request completes in <10 seconds
   - [ ] Score displays (0-100)

5. **Review results**
   - [ ] Score number is prominent and animated
   - [ ] Top 3 issues are clearly visible
   - [ ] Remaining issues are blurred/locked
   - [ ] "Sign up to see all fixes" CTA is clear
   - [ ] Quick Wins section displays (if implemented)

6. **Test rate limiting**
   - [ ] Try checking 6 times from same IP
   - [ ] 6th attempt should show rate limit message
   - [ ] Rate limit message shows reset time
   - [ ] Message includes "Sign up for unlimited" CTA

**Check backend:**
- [ ] Open Supabase → `anonymous_ats_scores` table
- [ ] Verify new row created with your test
- [ ] Verify `resume_hash` is stored (NOT full resume text)
- [ ] Verify `ip_address` is captured
- [ ] Verify `ats_score` and `ats_suggestions` are populated

**Expected result:** Complete anonymous flow works, data saves correctly, rate limiting enforces

---

### Flow 2: Sign Up After Score Check
**Test conversion flow (critical for growth):**

1. **From score results, click "Sign Up"**
   - [ ] Redirects to `/auth/signup` (or opens signup modal)
   - [ ] Session ID is preserved (check URL params or localStorage)

2. **Create account**
   - [ ] Email/password signup works
   - [ ] Or social auth works (Google/GitHub if enabled)
   - [ ] Receive confirmation email

3. **After signup, check dashboard**
   - [ ] Redirects to dashboard
   - [ ] Welcome message references previous score (if implemented)
   - [ ] Shows prompt to upload resume for full optimization
   - [ ] Anonymous score is linked to user account

**Check backend:**
- [ ] Open Supabase → `anonymous_ats_scores` table
- [ ] Find your test row
- [ ] Verify `user_id` is now populated
- [ ] Verify `converted_at` timestamp is set

**Expected result:** Seamless conversion from anonymous → authenticated user

---

### Flow 3: Full Optimization (Authenticated)
**Test core product functionality:**

1. **Upload resume**
   - [ ] Navigate to resume upload page
   - [ ] Upload PDF or DOCX
   - [ ] File parses successfully
   - [ ] Resume content displays

2. **Add job description**
   - [ ] Can paste or enter JD
   - [ ] Can paste job URL (if supported)
   - [ ] JD saves correctly

3. **Generate optimization**
   - [ ] Click "Optimize" button
   - [ ] AI processing completes
   - [ ] Optimized resume displays
   - [ ] Side-by-side comparison works (if implemented)

4. **View ATS score**
   - [ ] Score displays (should be same or higher than anonymous check)
   - [ ] All issues are visible (not just top 3)
   - [ ] Subscores show (8 dimensions)

5. **Export resume**
   - [ ] Can download as PDF
   - [ ] PDF opens correctly
   - [ ] Formatting looks professional
   - [ ] All content is included

**Expected result:** Full optimization flow works for authenticated users

---

### Flow 4: Newsletter Signup
**Test lead capture:**

1. **Scroll to footer**
   - [ ] Newsletter signup form is visible
   - [ ] Email input field works
   - [ ] Name input field works (if applicable)

2. **Submit email**
   - [ ] Form submits successfully
   - [ ] Success message displays
   - [ ] Form resets or shows "Already subscribed"

3. **Check email delivery**
   - [ ] Welcome email arrives within 1 minute
   - [ ] Email is not in spam folder
   - [ ] Sender shows as resumebuilderaiteam@gmail.com
   - [ ] Email content is formatted correctly
   - [ ] Links in email work

**Check Buttondown dashboard:**
- [ ] Login at https://buttondown.com
- [ ] Navigate to Subscribers
- [ ] Verify new subscriber with your test email
- [ ] Verify subscription status is 'active'
- [ ] Verify subscriber metadata captured (if applicable)

**Note:** This app uses Buttondown API for newsletter management (not Supabase table). This is the recommended approach for simpler email infrastructure.

**Expected result:** Newsletter signup works, welcome email delivers from Buttondown

---

## 3. ANALYTICS & TRACKING VERIFICATION

### PostHog Event Tracking
**Verify PostHog is capturing events:**

1. **Visit PostHog dashboard**
   - [ ] Login at https://us.posthog.com/project/270848
   - [ ] Navigate to "Live Events" or "Activity"

2. **Trigger events and verify capture:**
   - [ ] Visit landing page → Check for `pageview` event
   - [ ] Upload resume → Check for `ats_checker_file_uploaded` event
   - [ ] Submit ATS check → Check for `ats_checker_submitted` event
   - [ ] View score → Check for `ats_checker_score_displayed` event
   - [ ] Click signup → Check for `ats_checker_signup_clicked` event

3. **Verify event properties:**
   - [ ] Events include session_id
   - [ ] Events include score value (where applicable)
   - [ ] Events include user properties

**Action if broken:**
- Check `NEXT_PUBLIC_POSTHOG_KEY` is set in Vercel
- Check PostHog provider wraps the app
- Check browser console for PostHog initialization errors

**Expected result:** All key events are captured in PostHog

---

### Google Analytics (if configured)
**Check GA4 tracking:**

1. **Visit Google Analytics dashboard**
   - [ ] Real-time view shows your test session
   - [ ] Pageviews are being tracked
   - [ ] Events are firing (if configured)

2. **Test key pages:**
   - [ ] Landing page
   - [ ] Blog post
   - [ ] Dashboard (if tracking authenticated pages)

**Expected result:** GA4 tracks pageviews and events

---

## 4. EMAIL SYSTEMS TESTING

### Resend Domain Configuration
**Verify email delivery infrastructure:**

1. **Check Resend dashboard**
   - [ ] Login at https://resend.com
   - [ ] Navigate to Domains
   - [ ] Verify `resumelybuilderai.com` status is "Verified"

2. **Check DNS records**
   - [ ] DKIM record (TXT) exists
   - [ ] SPF record (TXT) exists
   - [ ] DMARC record (TXT) exists
   - [ ] All records show "Valid" in Resend

**Action if not verified:**
- Add missing DNS records
- Wait 24-48 hours for propagation
- Verify again in Resend dashboard

---

### Email Templates
**Check Supabase Auth email templates:**

1. **Navigate to Supabase Dashboard**
   - [ ] Go to Authentication → Email Templates

2. **Verify templates:**
   - [ ] "Confirm signup" template is customized (not default)
   - [ ] "From" email is resumebuilderaiteam@gmail.com
   - [ ] Template copy is professional and on-brand
   - [ ] Links in template work

3. **Test email delivery:**
   - [ ] Create test account with real email
   - [ ] Verify confirmation email arrives
   - [ ] Click confirmation link works
   - [ ] Account activates successfully

**Expected result:** All auth emails deliver and look professional

---

## 5. SEO & DISCOVERABILITY CHECK

### Google Search Console Setup
**Verify Google can index your site:**

1. **Check Google Search Console**
   - [ ] Visit https://search.google.com/search-console
   - [ ] Property for `resumelybuilderai.com` exists
   - [ ] Domain ownership is verified (green checkmark)

2. **Check sitemap submission:**
   - [ ] Navigate to Sitemaps section
   - [ ] `https://resumelybuilderai.com/sitemap.xml` is submitted
   - [ ] Status shows "Success" (not "Error")
   - [ ] Discovered URLs count is > 0

3. **Request indexing for key pages:**
   - [ ] Landing page: Request indexing
   - [ ] Blog index: Request indexing
   - [ ] First blog post: Request indexing

**Action if not set up:**
- Follow instructions in GTM-WEEK-1-IMPLEMENTATION-GUIDE.md
- Complete verification process
- Submit sitemap.xml

---

### Sitemap & Robots.txt
**Verify SEO infrastructure:**

1. **Check sitemap.xml**
   - [ ] Visit https://resumelybuilderai.com/sitemap.xml
   - [ ] XML displays correctly (not 404)
   - [ ] Includes landing page
   - [ ] Includes /blog
   - [ ] Includes blog post(s)
   - [ ] URLs are absolute (not relative)

2. **Check robots.txt**
   - [ ] Visit https://resumelybuilderai.com/robots.txt
   - [ ] File exists (not 404)
   - [ ] Allows indexing of public pages
   - [ ] Disallows /api/, /dashboard/, /auth/
   - [ ] References sitemap.xml

**Expected result:** Both files are publicly accessible and correct

---

### Meta Tags & Open Graph
**Check social sharing preview:**

1. **Use LinkedIn Post Inspector**
   - [ ] Visit https://www.linkedin.com/post-inspector/
   - [ ] Enter: https://resumelybuilderai.com
   - [ ] Verify preview image displays
   - [ ] Verify title and description are correct
   - [ ] No errors shown

2. **Use Twitter Card Validator**
   - [ ] Visit https://cards-dev.twitter.com/validator
   - [ ] Enter: https://resumelybuilderai.com
   - [ ] Verify card preview displays
   - [ ] Verify image, title, description

3. **Check meta tags in source**
   - [ ] View page source
   - [ ] Verify `<meta property="og:image">` exists
   - [ ] Verify `<meta property="og:title">` is compelling
   - [ ] Verify `<meta name="description">` is present

**Expected result:** Social sharing shows professional preview

---

## 6. SOCIAL SHARING MECHANICS

### Share Buttons Functionality
**Test viral sharing features:**

1. **After ATS score displays, check share buttons:**
   - [ ] LinkedIn share button is visible
   - [ ] Twitter share button is visible
   - [ ] Copy link button is visible (if implemented)

2. **Click LinkedIn share:**
   - [ ] Opens LinkedIn share dialog
   - [ ] Pre-filled text includes score
   - [ ] Pre-filled text includes CTA
   - [ ] URL is correct (includes UTM params for tracking)
   - [ ] Text is compelling

3. **Click Twitter share:**
   - [ ] Opens Twitter intent
   - [ ] Pre-filled tweet includes score
   - [ ] Character count is <280
   - [ ] URL is correct

4. **Check share tracking:**
   - [ ] PostHog captures `ats_checker_share_clicked` event
   - [ ] Event includes platform (linkedin/twitter)
   - [ ] Event includes score value

**Expected result:** Sharing is frictionless and tracked

---

### Shared Link Experience
**Test what happens when someone clicks shared link:**

1. **Click your own shared link**
   - [ ] Lands on landing page (not 404)
   - [ ] Free ATS checker is immediately visible
   - [ ] UTM parameters are captured (check analytics)

2. **Check attribution:**
   - [ ] PostHog tracks referral source
   - [ ] Can distinguish organic vs shared traffic

**Expected result:** Shared links work and attribution tracks

---

## 7. PERFORMANCE & MOBILE TESTING

### Page Speed
**Run Lighthouse audit:**

1. **Open Chrome DevTools**
   - [ ] Navigate to resumelybuilderai.com
   - [ ] DevTools → Lighthouse tab
   - [ ] Run audit (Desktop + Mobile)

2. **Check scores:**
   - [ ] Performance: Target >90 (minimum 80)
   - [ ] Accessibility: Target >95
   - [ ] Best Practices: Target >90
   - [ ] SEO: Target >90

3. **Fix critical issues:**
   - [ ] If Performance <80: Optimize images, reduce JS bundle
   - [ ] If Accessibility <90: Fix contrast, ARIA labels
   - [ ] If SEO <90: Add missing meta tags, fix structure

**Expected result:** All scores >85, ideally >90

---

### Mobile Responsiveness
**Test on mobile devices:**

1. **Chrome DevTools Device Mode**
   - [ ] Toggle device toolbar
   - [ ] Test iPhone SE (375px)
   - [ ] Test iPhone 12 Pro (390px)
   - [ ] Test iPad (768px)
   - [ ] Test Pixel 5 (393px)

2. **Check mobile experience:**
   - [ ] Text is readable (not too small)
   - [ ] Buttons are tap-friendly (min 44x44px)
   - [ ] No horizontal scrolling
   - [ ] Forms work on mobile keyboard
   - [ ] Upload button works on mobile
   - [ ] Score display fits on screen

3. **Test actual mobile device:**
   - [ ] Visit site on your phone
   - [ ] Complete full ATS check flow
   - [ ] Share works on mobile
   - [ ] Everything feels smooth

**Expected result:** Flawless mobile experience

---

### Loading States & Error Handling
**Test edge cases:**

1. **Test slow network:**
   - [ ] DevTools → Network → Slow 3G
   - [ ] Submit ATS check
   - [ ] Verify loading indicator shows
   - [ ] Verify doesn't timeout
   - [ ] Verify graceful handling

2. **Test error states:**
   - [ ] Upload corrupted PDF → See friendly error message
   - [ ] Submit with empty JD → See validation error
   - [ ] Submit JD <100 words → See helpful message
   - [ ] Rate limit exceeded → See clear explanation

3. **Test offline:**
   - [ ] DevTools → Network → Offline
   - [ ] Try to use site
   - [ ] See "No connection" message (not just broken)

**Expected result:** All errors show friendly messages, no crashes

---

## 8. LAUNCH COPY REVIEW & OPTIMIZATION

### Blog Post Quality Check
**Review first blog post:**

1. **Read the blog post at `/blog/[slug]`**
   - [ ] Title is compelling and SEO-optimized
   - [ ] Introduction hooks the reader
   - [ ] Content is valuable (not just fluff)
   - [ ] Examples and data are included
   - [ ] Formatting is clean (headers, bullets, bold)

2. **Check SEO elements:**
   - [ ] Target keyword appears in title
   - [ ] Target keyword in first paragraph
   - [ ] Headers use keyword variations
   - [ ] Meta description is compelling
   - [ ] Alt text on images

3. **Check CTAs:**
   - [ ] CTA at end of post ("Check your ATS score free")
   - [ ] CTA is prominent (button, not just link)
   - [ ] CTA links to correct page
   - [ ] Inline CTAs throughout (not just at end)

**Action if needed:**
- Edit content for clarity and SEO
- Strengthen CTAs
- Add more examples/data

**Expected result:** Blog post is publication-ready

---

### Landing Page Copy Review
**Optimize conversion copy:**

1. **Hero section:**
   - [ ] Headline clearly states benefit ("Get 3X more interviews")
   - [ ] Sub-headline explains how ("AI-powered ATS checker")
   - [ ] CTA is action-oriented ("Check Your Resume Free")
   - [ ] No jargon, easy to understand in 5 seconds

2. **Social proof:**
   - [ ] Stats are displayed ("10,000+ resumes checked")
   - [ ] Stats feel credible (not inflated)
   - [ ] Testimonials if available

3. **Value proposition:**
   - [ ] Clear what problem you solve
   - [ ] Clear what makes you different
   - [ ] Clear what user gets (specific outcomes)

**Action if weak:**
- Rewrite hero headline for clarity
- Add/strengthen social proof
- Simplify value prop

**Expected result:** Copy converts casual visitors

---

### Launch Post Copy (LinkedIn/Reddit)
**Review your prepared launch posts:**

1. **Check LinkedIn launch post:**
   - [ ] Opens with hook (personal story or shocking stat)
   - [ ] Explains problem clearly
   - [ ] Mentions solution (your tool)
   - [ ] Includes CTA with link
   - [ ] Tone is authentic, not salesy
   - [ ] Length is <1300 characters (ideal)

2. **Check Reddit launch post:**
   - [ ] Title is curiosity-driven
   - [ ] Body provides value upfront
   - [ ] Mentions tool naturally (not spammy)
   - [ ] Invites feedback
   - [ ] Tone matches Reddit culture

3. **Prepare variations:**
   - [ ] Have 2-3 headline variations ready
   - [ ] Have short vs long versions
   - [ ] Adjust tone for each platform

**Expected result:** Launch copy is tested and optimized

---

## 9. FINAL PRE-FLIGHT CHECKLIST

### Critical Systems
- [ ] Anonymous ATS checker works (tested in incognito)
- [ ] Rate limiting enforces (tested 6 requests)
- [ ] Signup flow works (tested account creation)
- [ ] Email delivery works (received confirmation email)
- [ ] Newsletter signup works (tested and received email)
- [ ] Blog post is published and accessible
- [ ] PostHog tracking captures events
- [ ] Social share buttons work

### Infrastructure
- [ ] Supabase migrations applied in production
- [ ] All environment variables set in Vercel
- [ ] Build passes with 0 errors
- [ ] Latest code deployed to production
- [ ] No 404 errors on key pages
- [ ] SSL certificate valid (https works)

### SEO & Discovery
- [ ] Google Search Console verified
- [ ] Sitemap.xml submitted
- [ ] Robots.txt accessible
- [ ] Meta tags present
- [ ] Open Graph preview looks good

### Content
- [ ] Landing page copy is optimized
- [ ] Blog post is high-quality
- [ ] Launch posts are written and ready
- [ ] CTAs are clear and compelling

### Performance
- [ ] Mobile responsive (tested on real device)
- [ ] Page loads in <3 seconds
- [ ] Lighthouse scores >85
- [ ] No console errors

### Launch Materials
- [ ] LinkedIn launch post ready
- [ ] Reddit launch posts ready (r/resumes, r/jobs)
- [ ] Email to network drafted
- [ ] Social share images created (optional but helpful)

---

## 10. CREATE LAUNCH DAY PLAN

**Based on everything you've verified, create a detailed plan for launch day:**

### Monday Morning (9-10 AM)
```
[ ] Post on personal LinkedIn (copy ready?)
[ ] Email 20-30 people from network (list ready?)
[ ] Share in 2-3 Slack/Discord communities (which ones?)
```

### Monday Afternoon (2-4 PM EST)
```
[ ] Post in r/resumes (copy ready?)
[ ] Post in r/jobs (copy ready?)
[ ] Set timer to check Reddit comments every 30 mins
```

### Throughout Day
```
[ ] Monitor PostHog dashboard for user behavior
[ ] Respond to all comments/messages within 1 hour
[ ] Fix any critical bugs immediately
[ ] Track key metrics in spreadsheet
```

---

## FINAL OUTPUT

After completing all tests above, provide me with:

1. **✅ GO / ❌ NO-GO Decision**
   - Am I ready for soft launch or not?

2. **Issues Found**
   - List anything broken or not working
   - Prioritize by severity (P0 = blocker, P1 = important, P2 = nice to fix)
   - Provide fix instructions for each

3. **Optimization Recommendations**
   - List things that work but could be improved
   - Prioritize by impact on conversion

4. **Launch Day Checklist**
   - Specific times and actions for Monday
   - Pre-written posts to copy-paste
   - Metrics to track hourly

5. **Confidence Score**
   - Rate readiness 1-10
   - List top 3 risks
   - List top 3 strengths

---

## SUCCESS CRITERIA

I'm ready for soft launch when:

✅ Anonymous ATS check works perfectly (99% reliability)
✅ Signup conversion flow is smooth
✅ Analytics tracks all key events
✅ Mobile experience is flawless
✅ No critical bugs found in testing
✅ All launch copy is optimized
✅ Contingency plan exists for common errors

---

**START YOUR COMPREHENSIVE VERIFICATION NOW!**

Be thorough. Test everything. Find issues before real users do.

My soft launch success depends on this verification. 🚀
