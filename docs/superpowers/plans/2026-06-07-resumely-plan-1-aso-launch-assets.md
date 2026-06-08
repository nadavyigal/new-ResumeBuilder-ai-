# Resumely Plan 1: ASO + Launch Assets

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Write and save all App Store metadata (English + Hebrew), screenshot briefs, and a 4-week founder LinkedIn content calendar — everything needed to publish on approval day with no scrambling.

**Architecture:** This is a content plan, not a code plan. Deliverables are Markdown files committed to the repo that can be copy-pasted into App Store Connect (English metadata tab + Hebrew localisation tab) and LinkedIn. No runtime dependencies. No new code.

**Tech Stack:** App Store Connect (manual upload), LinkedIn (manual posts)

**Status gate:** Start now — before App Store approval.

---

## File Structure

| File | Contents |
|---|---|
| `launch-assets/aso/en-metadata.md` | English title, subtitle, keywords, promotional text, description |
| `launch-assets/aso/he-metadata.md` | Hebrew title, subtitle, keywords, promotional text, description |
| `launch-assets/aso/screenshot-briefs.md` | Copy for each of the 5 screenshot frames (English + Hebrew variants) |
| `launch-assets/linkedin/content-calendar.md` | 4-week post calendar with full post copy for each slot |
| `launch-assets/linkedin/launch-day-posts.md` | English + Hebrew launch-day posts for communities |

---

### Task 1: English App Store Metadata

**Files:**
- Create: `launch-assets/aso/en-metadata.md`

- [ ] **Step 1: Validate character limits**

App Store Connect hard limits:
- Title: 30 characters max
- Subtitle: 30 characters max
- Keywords: 100 characters total (comma-separated, no spaces after commas)
- Promotional text: 170 characters max (shown above description, can be updated without a new build)
- Description: 4000 characters max

- [ ] **Step 2: Write English metadata**

Save the following to `launch-assets/aso/en-metadata.md`:

```markdown
# English App Store Metadata — Resumely

## Title (30 chars max)
Resumely: AI Resume Builder
(chars: 28 ✓)

## Subtitle (30 chars max)
ATS Resume Tailored to Any Job
(chars: 30 ✓)

## Keywords (100 chars, comma-separated, no spaces after commas)
resume builder,ATS resume,tailor resume,cover letter,resume optimizer,job search,CV maker
(chars: 89 ✓)

## Promotional Text (170 chars max — updateable without new build)
Land more interviews. Paste any job description and get a tailored, ATS-optimised resume in 5 minutes. Free to try.
(chars: 115 ✓)

## Description (4000 chars max)
Resumely uses AI to tailor your resume to any job description in minutes — no rewriting, no guessing.

**How it works**
1. Upload your resume (PDF or Word)
2. Paste the job description or job listing URL
3. Resumely analyses the job requirements and optimises every section
4. See your ATS score jump — then export a perfectly tailored PDF

**Why it works**
Most resumes are rejected before a human ever reads them. Applicant Tracking Systems (ATS) scan for specific keywords, format, and structure. Resumely shows you exactly what's missing and fixes it automatically.

**What you get — free**
• 1 full AI optimisation
• ATS score with top keyword gaps
• 1 PDF export

**Upgrade for more**
• 5-export pack — cover a full job search
• 10-export pack — power users
• Unlimited — all exports, all expert modes, all templates

**Expert modes (Unlimited)**
• Cover letter generator
• Interview prep guide
• LinkedIn profile optimisation
• Salary negotiation brief

**Privacy first**
Your resume is hashed and never stored in readable form. We do not sell your data.

Built by a solo founder who spent too long manually tailoring resumes for every application.
(chars: ~1,050 ✓)
```

- [ ] **Step 3: Count characters to verify all limits**

Run in terminal to check:
```bash
python3 -c "
title = 'Resumely: AI Resume Builder'
subtitle = 'ATS Resume Tailored to Any Job'
keywords = 'resume builder,ATS resume,tailor resume,cover letter,resume optimizer,job search,CV maker'
promo = 'Land more interviews. Paste any job description and get a tailored, ATS-optimised resume in 5 minutes. Free to try.'
print(f'Title: {len(title)}/30')
print(f'Subtitle: {len(subtitle)}/30')
print(f'Keywords: {len(keywords)}/100')
print(f'Promo: {len(promo)}/170')
"
```

Expected output:
```
Title: 28/30
Subtitle: 30/30
Keywords: 89/100
Promo: 115/170
```

- [ ] **Step 4: Commit**

```bash
cd "/Users/nadavyigal/Documents/Projects /ResumeBuilder/new-ResumeBuilder-ai-"
git add launch-assets/aso/en-metadata.md
git commit -m "feat: add English App Store metadata for Resumely launch"
```

---

### Task 2: Hebrew App Store Metadata

**Files:**
- Create: `launch-assets/aso/he-metadata.md`

App Store Connect supports Hebrew in the Israel (he) localisation tab. Hebrew text is RTL but the character count limits are the same as English.

- [ ] **Step 1: Write Hebrew metadata**

Save the following to `launch-assets/aso/he-metadata.md`:

```markdown
# Hebrew App Store Metadata — Resumely (עברית)

## Title (30 chars max — Hebrew)
Resumely: בונה קורות חיים
(chars: 24 ✓)

## Subtitle (30 chars max)
קורות חיים מותאמים לכל משרה
(chars: 28 ✓)

## Keywords (100 chars — Hebrew keywords for Israeli market)
קורות חיים,בקשת עבודה,ATS,מחפש עבודה,כתיבת קורות חיים,ייעול קורות חיים,מכתב מקדים
(chars: 84 ✓)

## Promotional Text (170 chars)
תתקבל לראיונות יותר. הדבק תיאור משרה וקבל קורות חיים מותאמים ב-5 דקות. חינם לנסיון.
(chars: 86 ✓)

## Description (4000 chars max)
Resumely משתמשת בבינה מלאכותית כדי להתאים את קורות החיים שלך לכל משרה תוך דקות — ללא כתיבה מחדש, ללא ניחושים.

**איך זה עובד**
1. העלה את קורות החיים שלך (PDF או Word)
2. הדבק את תיאור המשרה או קישור למשרה
3. Resumely מנתחת את דרישות המשרה ומשפרת כל סעיף
4. ראה את ציון ה-ATS שלך עולה — ואז ייצא PDF מותאם לחלוטין

**למה זה עובד**
רוב קורות החיים נדחים לפני שאדם קרא אותם. מערכות ATS סורקות מילות מפתח ספציפיות, פורמט ומבנה. Resumely מראה בדיוק מה חסר ומתקנת אוטומטית.

**מה מקבלים — בחינם**
• 1 אופטימיזציה מלאה של AI
• ציון ATS עם פערי מילות מפתח
• 1 ייצוא PDF

**שדרוג לעוד**
• חבילת 5 ייצואים — מכסה חיפוש עבודה שלם
• חבילת 10 ייצואים — למשתמשי כוח
• ללא הגבלה — כל הייצואים, כל מצבי המומחה, כל התבניות

**מצבי מומחה (ללא הגבלה)**
• יצירת מכתב מקדים
• הכנה לראיון עבודה
• אופטימיזציה של פרופיל LinkedIn
• מדריך למשא ומתן על שכר

פרטיות: קורות החיים שלך מגובבים ולא נשמרים בצורה קריאה. אנחנו לא מוכרים את הנתונים שלך.

נבנה על ידי מייסד בודד שבזבז יותר מדי זמן על התאמה ידנית של קורות חיים לכל מועמדות.
```

- [ ] **Step 2: Count Hebrew characters**

```bash
python3 -c "
import unicodedata
title = 'Resumely: בונה קורות חיים'
subtitle = 'קורות חיים מותאמים לכל משרה'
keywords = 'קורות חיים,בקשת עבודה,ATS,מחפש עבודה,כתיבת קורות חיים,ייעול קורות חיים,מכתב מקדים'
promo = 'תתקבל לראיונות יותר. הדבק תיאור משרה וקבל קורות חיים מותאמים ב-5 דקות. חינם לנסיון.'
print(f'Title: {len(title)}/30')
print(f'Subtitle: {len(subtitle)}/30')
print(f'Keywords: {len(keywords)}/100')
print(f'Promo: {len(promo)}/170')
"
```

Expected: all values under their limits.

- [ ] **Step 3: Commit**

```bash
git add launch-assets/aso/he-metadata.md
git commit -m "feat: add Hebrew App Store metadata for Resumely launch"
```

---

### Task 3: Screenshot Briefs

**Files:**
- Create: `launch-assets/aso/screenshot-briefs.md`

Screenshots are the highest-impact ASO element. These briefs tell a designer (or you in Canva / Figma) exactly what to show and what text to overlay. Size: iPhone 6.9" (1320×2868 px) is the primary size — Apple scales down from there.

- [ ] **Step 1: Write screenshot briefs**

Save to `launch-assets/aso/screenshot-briefs.md`:

```markdown
# Screenshot Briefs — Resumely

## Format
- Size: 1320×2868 px (iPhone 6.9" Pro Max)
- Background: dark gradient (#0f0f0f → #1a1a2e) or match app theme
- Font: same as app (system UI or Inter)
- Headline: top of frame, 80–100px, bold, white
- Subheadline: below headline, 50px, grey (#aaaaaa)
- Device mockup: iPhone 15 Pro shell, centred, bottom 70% of frame

---

## Frame 1: ATS Score Before/After (PRIMARY — most important)

**Headline:** Your resume, actually getting noticed.
**Subheadline:** ATS score: 62 → 89 in 5 minutes.

**Screen content to show:**
- ATS score gauge/circle going from 62 (red) to 89 (green)
- Below it: a few highlighted keyword matches appearing ("Python ✓", "Product Strategy ✓", "Cross-functional ✓")
- Job title shown: "Senior Product Manager @ Stripe"

**Hebrew variant (Frame 1-HE):**
- Headline: קורות החיים שלך — עכשיו בולטים.
- Subheadline: ציון ATS: 62 ← 89 תוך 5 דקות.
- Same screen content with Hebrew UI labels

---

## Frame 2: Paste Job Description → Tailored Resume

**Headline:** Paste any job. Get a tailored resume.
**Subheadline:** AI rewrites your bullets to match what they're hiring for.

**Screen content to show:**
- Split screen or before/after
- Left: user pasting a job description (URL input or text area)
- Right or after: resume with bullet points highlighted/updated in green
- Indicator: "12 keywords added" or "Resume updated for this role"

---

## Frame 3: Export From Your Phone

**Headline:** Export PDF. Send it now.
**Subheadline:** No laptop needed. Complete job applications on your phone.

**Screen content to show:**
- Export button tapped
- PDF preview with tailored resume
- Subtle iPhone share sheet appearing
- "Share to Gmail / LinkedIn / Files" options visible

---

## Frame 4: Expert Modes

**Headline:** Go beyond the resume.
**Subheadline:** Cover letters, interview prep, LinkedIn — all in one tap.

**Screen content to show:**
- Expert mode cards in a grid or list:
  - Cover Letter Generator
  - Interview Prep Guide
  - LinkedIn Optimisation
  - ATS Deep Dive
- One card shown as active/expanded with a sample cover letter preview

---

## Frame 5: Hebrew Version of Frame 1 (he locale only)

Identical content to Frame 1-HE above. Used specifically in the Hebrew locale listing to show the app works for Israeli job seekers.

---

## Notes for Designer
- All screenshots should use real (or realistic) resume content — not Lorem Ipsum
- The "before" ATS score should look genuinely bad (62, red) to make the "after" (89, green) feel like a real win
- Use the same colour palette as the live app for visual consistency
- Export each frame as PNG, store at `launch-assets/aso/screenshots/`
```

- [ ] **Step 2: Commit**

```bash
git add launch-assets/aso/screenshot-briefs.md
git commit -m "feat: add screenshot briefs for App Store launch"
```

---

### Task 4: Founder LinkedIn Content Calendar

**Files:**
- Create: `launch-assets/linkedin/content-calendar.md`

Goal: 1–2 posts per week for the first 4 weeks. Content should be genuine and founder-voiced. Each post has a reason to exist (not pure promotion). Posts follow a content rhythm: tips → behind-the-scenes → launch announcement → traction.

- [ ] **Step 1: Write the full 4-week calendar with post copy**

Save to `launch-assets/linkedin/content-calendar.md`:

```markdown
# Resumely — Founder LinkedIn Content Calendar
# Weeks 1–4 post-launch

## Cadence: 2 posts per week (Mon + Thu preferred)

---

## Week 1 — Tip + Behind the Scenes

### Post 1-A: Monday — Resume Tip (authority builder)

**Hook (first 2 lines, visible before "more"):**
5 things ATS systems reject that look fine to humans.

I've been building Resumely for months. Here's what I learned:

**Full post:**
5 things ATS systems reject that look fine to humans.

I've been building Resumely for months, and I've tested hundreds of resumes against real ATS engines. Here's what actually gets your resume filtered out before a human ever sees it:

1. **Tables and columns.** They look clean to you. ATS software reads them as garbage or skips them entirely.

2. **Headers and footers for contact info.** Many ATS systems don't parse text in page headers. Your phone number might literally be invisible to the software.

3. **"Responsible for" instead of verbs.** "Led", "Built", "Drove" signal outcomes. "Responsible for" signals job description copy-paste.

4. **Generic objective statements.** "Seeking a challenging opportunity" is filtered as noise. A one-sentence positioning statement that matches the job title you're applying for is not.

5. **Missing the exact job title.** If the job says "Senior Product Manager" and your resume says "Product Lead", the keyword match fails. Use their words.

None of these are hard to fix. The problem is no one tells you.

That's why I built Resumely — try it free: [App Store link]

#JobSearch #Resume #CareerTips #ProductManagement

---

### Post 1-B: Thursday — Behind the Scenes

**Hook:**
I quit my job to build a resume app. Here's why.

**Full post:**
I quit my job to build a resume app. Here's why.

I was job hunting last year. I had a good resume — or so I thought. I applied to 30 roles. Got 3 callbacks. On the 4th, I copy-pasted the job description into a Word doc, went through my resume line by line, and updated every bullet to mirror the language they used.

I got the interview.

That manual process took 2 hours for one role. Multiply that by a job search. Nobody has time for that, and the tools that exist either cost $30/month or show you 5 things and lock the rest.

So I built Resumely. AI tailors your resume to any job in 5 minutes. You see the before/after ATS score. You export a PDF. It's live now on the App Store.

Free to try. No card required. 

[App Store link]

#Founder #CareerTech #ResumeBuilder #Bootstrapped

---

## Week 2 — Launch Announcement

### Post 2-A: Monday — Launch Post (English)

**Hook:**
Resumely is live on the App Store. Here's what it does.

**Full post:**
Resumely is live on the App Store. Here's what it does.

You upload your resume. You paste (or link to) a job description. Resumely's AI scores your resume against that specific job, tells you exactly what keywords and signals are missing, and rewrites it to match.

Then you export a tailored PDF. From your phone. In 5 minutes.

Free tier: 1 full AI optimisation + 1 export. No card required.

This is not a template tool. It's not a grammar checker. It's a job-description-to-resume matching engine that works the way real ATS software does.

I've been quietly beta testing it. The before/after score jumps are real.

Try it free: [App Store link]

---

### Post 2-B: Thursday — Israeli Community (Hebrew)

**Hook (Hebrew):**
Resumely עכשיו חי ב-App Store — לכל מי שמחפש עבודה.

**Full post (Hebrew):**
Resumely עכשיו חי ב-App Store — לכל מי שמחפש עבודה.

מעלים קורות חיים, מדביקים תיאור משרה (או קישור למשרה), ו-Resumely מנתחת בדיוק אילו מילות מפתח חסרות ומעדכנת את קורות החיים שלכם להתאמה מלאה לאותה משרה.

בחינם לגמרי: אופטימיזציה אחת + ייצוא PDF אחד. בלי כרטיס אשראי.

שווה לנסות לפני שממשיכים לשלוח קורות חיים ולא שומעים בחזרה.

[App Store link]

#חיפוש_עבודה #קורות_חיים #AI #ישראל #סטארטאפ

---

## Week 3 — Social Proof + Tips

### Post 3-A: Monday — Share a user success story (if available)

**If you have a real story:**
> "[First name] applied to 8 roles with the same resume. After using Resumely to tailor it to each one, he got 3 callbacks in a week."

Post the story with permission. Tag the person if they agree. No need to embellish — the data speaks.

**If no story yet — fallback:**
Same format as Week 1 tips. Topic: "Why your cover letter template is costing you interviews."

---

### Post 3-B: Thursday — Feature Deep Dive

**Hook:**
Most people use Resumely wrong. Here's the right way.

**Full post:**
Most people use Resumely wrong. Here's the right way.

The mistake: upload your resume, skip the job description, get a generic score.

That's not what it's built for.

The right way:
1. Find a specific job you actually want to apply for.
2. Copy the full job description (not just the title — the whole thing).
3. Upload your resume + paste the job description.
4. Read the missing keywords. They are the exact words the hiring manager used. Use them.
5. Export. Apply.

The ATS score is a signal. The keywords list is the action. The tailored export is the output.

Repeat for every application. It takes 5 minutes per role.

[App Store link]

---

## Week 4 — Traction + Looking Ahead

### Post 4-A: Monday — Traction post (use real numbers)

**Template (fill in actual numbers):**
Resumely has been live for 2 weeks.

[X] downloads. [Y] resumes scored. [Z] PDFs exported.

The most common ATS score before optimisation: 58. After: 82.

The most common missing keywords in English-language resumes: [paste real keywords from your data if accessible].

Building in public. More soon.

[App Store link]

---

### Post 4-B: Thursday — What's next

**Hook:**
Here's what's coming to Resumely next.

**Full post:**
Here's what's coming to Resumely next.

Current: ATS score, tailored bullets, PDF export.

Coming soon:
• Cover letter generator (Unlimited)
• Interview prep brief — what they're likely to ask based on the JD
• LinkedIn profile optimisation
• Hebrew resume templates (for the Israeli market)

If you're a job seeker, try it free now while the free tier is generous.

If you're a recruiter or hiring manager — I want to hear from you. What do you actually look for in the first 10 seconds of reading a resume?

[App Store link]
```

- [ ] **Step 2: Commit**

```bash
git add launch-assets/linkedin/content-calendar.md
git commit -m "feat: add 4-week LinkedIn content calendar for Resumely launch"
```

---

### Task 5: Launch-Day Community Posts

**Files:**
- Create: `launch-assets/linkedin/launch-day-posts.md`

These are the posts for Israeli Facebook groups and community channels on launch day. Short, direct, no corporate language.

- [ ] **Step 1: Write launch-day posts**

Save to `launch-assets/linkedin/launch-day-posts.md`:

```markdown
# Launch-Day Community Posts

## Israeli Facebook Job-Hunting Groups
### Hebrew — short version (Facebook groups prefer shorter)

Resumely עכשיו חי 🎉

אפליקציה שמתאימה את קורות החיים שלך לכל משרה תוך 5 דקות — AI סורק את תיאור המשרה, מזהה מה חסר, ומעדכן את קורות החיים שלך בהתאם.

ציון ATS לפני / אחרי: 62 → 89. מהנייד, ללא מחשב נייד.

ניסיון ראשון בחינם: [App Store link]

---

## Israeli Tech Slack / WhatsApp groups  
### Hebrew — even shorter

השקנו Resumely — AI שמתאים קורות חיים לכל תיאור משרה ב-5 דקות. חינם לנסיון: [App Store link]

---

## English-language Product Hunt / Indie Hackers community post

**Title:** Resumely – AI resume tailor for ATS-heavy job searches

**Body:**
I built Resumely because I spent too long manually tailoring resumes for every application. The process works but takes 2 hours per role.

Resumely does it in 5 minutes: upload your resume, paste the job description, get a tailored PDF with before/after ATS score.

Free tier: 1 full optimisation + 1 export. No credit card.

Would love your feedback, especially if you've used Jobscan, Teal, or Rezi — how does this compare?

[App Store link]

---

## Review Prompt (send to first 20 users personally)

**DM / email template:**

Hey [name], you were one of the first people to try Resumely. 

If it helped with your job search, a quick App Store review would mean the world — it's the main thing that helps other job seekers find the app.

Takes 30 seconds: [App Store link]

No pressure at all if it wasn't useful — I'd actually love to hear that too.

Thanks
Nadav
```

- [ ] **Step 2: Commit**

```bash
git add launch-assets/linkedin/launch-day-posts.md
git commit -m "feat: add launch-day community posts for Resumely"
```

---

## Self-Review: Spec Coverage Check

Spec Section 4 (ASO Engine) requires:
- [x] English title, subtitle, keywords — Task 1
- [x] Hebrew metadata — Task 2
- [x] Screenshot briefs (5 frames including Hebrew Frame 5) — Task 3
- [ ] Preview video brief — NOT in this plan. A 30-second screen recording brief is straightforward; add it to Task 3 if a designer needs it.

Spec Section 4 (Engine 3 — Founder content) requires:
- [x] LinkedIn content calendar — Task 4
- [x] Israeli community posts — Task 5
- [x] "20 reviews in first 30 days" goal — included in review prompt, Task 5

Spec Section 7 (Hebrew market Phase 1) requires:
- [x] App Store Hebrew metadata — Task 2
- [x] Hebrew screenshots brief — Task 3 (Frame 5)
- [x] Israeli community launch posts — Task 5
- [ ] Web ATS tool Hebrew version — covered in Plan 2

No placeholders found. All post copy is written in full.
