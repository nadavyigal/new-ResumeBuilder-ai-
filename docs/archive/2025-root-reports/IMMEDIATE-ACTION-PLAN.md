# ⚡ IMMEDIATE ACTION PLAN - GTM Week 1
# Resume Builder AI - Priority Tasks

**Created:** 2025-12-23
**Estimated Time:** 2-3 hours total

---

## 🚨 CRITICAL BLOCKERS (Complete in Next 30 Minutes)

### 0. FIX SUPABASE AUTH ISSUE ⏱️ 15 mins ⚠️ NEW - HIGHEST PRIORITY

**Why:** Users can't confirm their email signups - blocking all new registrations.

**Status:** ✅ DIAGNOSED - Ready to fix (just URL configuration)

**Quick Fix:**
1. Go to: https://supabase.com/dashboard/project/brtdyamysfmctrhuankn/auth/url-configuration
2. Set Site URL: `https://resumelybuilderai.com`
3. Add 6 redirect URLs (see FIX-AUTH-CHECKLIST.md)
4. Save and test

**Detailed Instructions:**
- 📋 **Quick Guide:** `FIX-AUTH-CHECKLIST.md` (15-min checklist)
- 📖 **Full Guide:** `SUPABASE_AUTH_FIX_INSTRUCTIONS.md` (complete details)
- 📊 **Summary:** `SUPABASE_AUTH_SUMMARY.md` (executive overview)
- 🔍 **Diagnosis:** `SUPABASE_AUTH_DIAGNOSIS.md` (technical analysis)

**Test:**
1. Visit https://resumelybuilderai.com/auth/signup
2. Sign up with test email
3. Click confirmation link
4. Should redirect to dashboard ✅

---

### 1. Get PostHog API Key ⏱️ 5 mins

**Why:** Analytics currently not working - can't track conversions or user behavior.

**Steps:**
1. Go to https://us.posthog.com/project/270848/settings/project
2. Find "Project API Key" (starts with `phc_`)
3. Copy the key
4. Open: `resume-builder-ai\.env.local`
5. Replace `your_posthog_project_api_key` with actual key
6. Save file

**Test:**
```bash
cd resume-builder-ai
npm run dev
```
Visit http://localhost:3000, check browser console for PostHog messages.

---

### 2. Create Newsletter Database Table ⏱️ 3 mins

**Why:** Newsletter signup will break without this table.

**Steps:**
1. Go to https://supabase.com/dashboard
2. Select project: `brtdyamysfmctrhuankn`
3. Click "SQL Editor" in sidebar
4. Click "New Query"
5. Copy-paste from: `resume-builder-ai\supabase\migrations\create_newsletter_subscribers.sql`
6. Click "Run"
7. Go to "Table Editor" → verify `newsletter_subscribers` table exists

**Test:**
```bash
npm run dev
```
Scroll to footer, enter test email, verify signup works.

---

### 3. Verify Resend Domain & Test Email ⏱️ 5 mins

**Why:** Emails won't deliver if domain not verified.

**Steps:**
1. Go to https://resend.com/domains
2. Find `resumelybuilderai.com`
3. Check status = "Verified" (green checkmark)
4. If not verified, add these DNS records:
   - DKIM (TXT): Already have in your notes
   - SPF (TXT): Check Resend dashboard for value
5. Test email signup on local site
6. Check inbox for welcome email (check spam if not in inbox)

---

## 🔥 HIGH PRIORITY (Complete Today - 2 hours)

### 4. Install Blog Dependencies & Create Structure ⏱️ 15 mins

```bash
cd resume-builder-ai

# Install dependencies
npm install gray-matter remark remark-html
npm install -D @types/gray-matter

# Create directory structure
mkdir -p src/app/blog/[slug]
mkdir -p src/content/blog
mkdir -p public/images/blog

# Verify
ls src/app/blog
ls src/content/blog
```

---

### 5. Create Blog Infrastructure Files ⏱️ 30 mins

Copy the code from `GTM-WEEK-1-IMPLEMENTATION-GUIDE.md` to create these files:

1. **Blog Utilities:** `src/lib/blog.ts`
2. **Blog Post Page:** `src/app/blog/[slug]/page.tsx`
3. **Blog Index:** `src/app/blog/page.tsx`
4. **Sitemap:** `src/app/sitemap.ts`
5. **Robots:** `src/app/robots.ts`

**Time-Saver:** Use the code snippets exactly as provided in the guide.

---

### 6. Publish First Blog Post ⏱️ 20 mins

1. **Get your prepared blog post:** `how-to-beat-ats-systems-2025.md`

2. **Add frontmatter:**
```markdown
---
title: "How to Beat ATS Systems in 2025: The Complete Guide"
date: "2025-12-23"
excerpt: "Learn the proven strategies to optimize your resume for Applicant Tracking Systems and get 3x more interviews in 2025."
author: "Resumely Team"
coverImage: "/images/blog/ats-systems-2025.jpg"
tags: ["ATS", "Resume Optimization", "Job Search"]
---

[Your blog content here...]
```

3. **Save to:** `src/content/blog/how-to-beat-ats-systems-2025.md`

4. **Add featured image:**
   - Find free image on https://unsplash.com/ (search "resume" or "job interview")
   - Download as 1200x630px
   - Save to: `public/images/blog/ats-systems-2025.jpg`

5. **Test locally:**
```bash
npm run dev
# Visit http://localhost:3000/blog
# Click your post, verify it displays correctly
```

---

### 7. Create Privacy & Terms Pages ⏱️ 30 mins

**Option A: Quick (15 mins)**
1. Go to https://www.termsfeed.com/
2. Generate Privacy Policy and Terms of Service
3. Copy generated HTML
4. Create files using code from `GTM-WEEK-1-IMPLEMENTATION-GUIDE.md`:
   - `src/app/privacy/page.tsx`
   - `src/app/terms/page.tsx`

**Option B: Use Templates (30 mins)**
- Use the template code provided in the guide
- Customize with your specific details
- More professional and tailored

---

### 8. Update Root Metadata for SEO ⏱️ 10 mins

1. Open: `src/app/layout.tsx`
2. Find the `metadata` object
3. Replace with enhanced version from guide (includes Open Graph, Twitter cards)
4. **Create OG image:**
   - Use https://www.canva.com/ (free)
   - Size: 1200 x 630 px
   - Text: "Resumely - AI Resume Optimizer | Get 3X More Interviews"
   - Save to: `public/images/og-image.jpg`

---

## 📦 DEPLOY TO PRODUCTION ⏱️ 15 mins

### 9. Update Vercel Environment Variables

1. Go to https://vercel.com/dashboard
2. Select your project
3. Settings → Environment Variables
4. Add/Update:
   - `NEXT_PUBLIC_POSTHOG_KEY` = (your actual key)
   - `NEXT_PUBLIC_POSTHOG_HOST` = `https://us.i.posthog.com`
   - `RESEND_API_KEY` = `re_eLNmG5GV_7XXnDS7U62JBRzyA89mdBrQq`
5. Click "Save"

---

### 10. Deploy Changes

```bash
cd resume-builder-ai

# Test build locally first
npm run build

# If build succeeds, deploy
git add .
git commit -m "feat: add blog, newsletter footer, SEO improvements for GTM Week 1"
git push origin main
```

Vercel will auto-deploy in ~2 minutes.

---

### 11. Post-Deploy Verification (10 mins)

**Visit https://resumelybuilderai.com and check:**

- [ ] Homepage loads
- [ ] Scroll to footer → Newsletter signup form visible
- [ ] Enter test email → Verify welcome email arrives
- [ ] Visit `/blog` → Blog index displays
- [ ] Click blog post → Post displays correctly
- [ ] Visit `/privacy` → Privacy policy shows
- [ ] Visit `/terms` → Terms of service shows
- [ ] Check browser console → No errors
- [ ] Open DevTools → Network → See PostHog tracking calls
- [ ] Visit Google Analytics → See real-time pageview

---

## 🔍 GOOGLE SEARCH CONSOLE SETUP ⏱️ 15 mins

### 12. Submit Sitemap

1. Go to https://search.google.com/search-console
2. Add property: `resumelybuilderai.com`
3. Verify ownership:
   - **Option A:** HTML tag (add to layout.tsx)
   - **Option B:** DNS TXT record
4. After verification:
   - Go to Sitemaps section
   - Submit: `https://resumelybuilderai.com/sitemap.xml`
5. Request indexing for blog post:
   - Use URL Inspection tool
   - Enter: `https://resumelybuilderai.com/blog/how-to-beat-ats-systems-2025`
   - Click "Request Indexing"

**Timeline:**
- Sitemap accepted: Immediate
- First crawl: 1-3 days
- Blog post indexed: 3-7 days

---

## 🎯 LINKEDIN COMPANY PAGE ⏱️ 20 mins

### 13. Create Company Page

1. **Go to:** https://www.linkedin.com/company/setup/new/
2. **Enter details:**
   - Company name: Resumely
   - LinkedIn public URL: linkedin.com/company/resumely-ai
   - Website: https://resumelybuilderai.com
   - Industry: Technology, Information and Internet
   - Company size: 1-10 employees
   - Company type: Privately Held

3. **Add descriptions:**
   - Use text from `GTM-WEEK-1-IMPLEMENTATION-GUIDE.md` → LinkedIn section

4. **Upload images:**
   - **Logo:** 300x300px PNG (use your brand logo)
   - **Cover:** 1128x191px (create in Canva)

5. **Create first post:**
   - Use launch announcement from guide
   - Include link to https://resumelybuilderai.com
   - Add hashtags: #ResumeOptimization #JobSearch #ATS

---

## ✅ END OF DAY CHECKLIST

By end of today, you should have:

- [x] PostHog tracking working
- [x] Newsletter signup working (footer)
- [x] Blog infrastructure complete
- [x] First blog post published
- [x] Privacy & Terms pages live
- [x] SEO metadata updated
- [x] Sitemap submitted to Google
- [x] LinkedIn company page created
- [x] Production deployment complete

---

## 📊 HOW TO VERIFY SUCCESS

### Analytics Check:
```bash
# Open browser
# Visit https://resumelybuilderai.com
# Open DevTools → Console
# Should see:
# - PostHog initialized
# - Google Analytics tracking call
# - No errors
```

### Database Check:
1. Go to Supabase Dashboard
2. Table Editor → `newsletter_subscribers`
3. Should see test email entry

### SEO Check:
1. Visit https://resumelybuilderai.com/sitemap.xml
2. Should see list of URLs (homepage, blog, etc.)
3. Visit https://resumelybuilderai.com/robots.txt
4. Should see sitemap URL

### Email Check:
1. Sign up for newsletter from live site
2. Check inbox (and spam folder)
3. Welcome email should arrive within 1 minute

---

## 🚀 NEXT STEPS (Tomorrow)

After completing the above:

1. **Share blog post:**
   - Post on LinkedIn company page
   - Share in relevant LinkedIn groups
   - Post on Twitter
   - Submit to relevant subreddits (r/resumes, r/jobs)

2. **Start tracking metrics:**
   - Create Google Sheet
   - Track daily: pageviews, signups, followers
   - Set up daily reminder to check analytics

3. **Create 2nd blog post:**
   - Topic: "The 7 ATS Mistakes Killing Your Applications"
   - Publish within 3-4 days
   - Maintain weekly publishing cadence

---

## 🆘 STUCK? QUICK TROUBLESHOOTING

**Newsletter signup doesn't work:**
→ Check browser console for errors
→ Verify `newsletter_subscribers` table exists in Supabase
→ Check RESEND_API_KEY is set correctly

**Blog post doesn't show:**
→ Verify file is in `src/content/blog/` with `.md` extension
→ Check frontmatter has valid YAML format
→ Restart dev server (`npm run dev`)

**PostHog not tracking:**
→ Check browser console for "PostHog" initialization message
→ Disable ad blockers
→ Verify env var is set and starts with `phc_`

**Deploy failed:**
→ Check Vercel build logs
→ Run `npm run build` locally to see errors
→ Fix TypeScript/ESLint errors

---

**Questions?** Review the detailed `GTM-WEEK-1-IMPLEMENTATION-GUIDE.md` file.

Good luck! 🚀
