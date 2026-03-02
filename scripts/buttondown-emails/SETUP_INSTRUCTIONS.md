# Buttondown Email Setup Instructions

## Sequence Overview

```
Sequence Name: Resumely Welcome Sequence
Trigger: Newsletter signup or first ATS check completion
Goal: Drive ATS check usage → build trust → convert to Premium
Length: 3 emails
Timing: D0 (immediate), D3 (+3 days), D7 (+7 days)
Exit Conditions: User upgrades to Premium
```

## Email Summary

### Email 1: Welcome + Quick Wins (Day 0, immediate)
- **Subject:** Your ATS score is ready. Here's what to fix first.
- **Preview:** Start with your highest-impact blockers and keep application momentum.
- **File:** `email-1-welcome.html`
- **Job:** Activate the user. Drive first re-check after applying 3 quick fixes.
- **CTA:** Continue Your Optimization

### Email 2: Value + Customization (Day 3)
- **Subject:** The resume mistake that costs the most interviews
- **Preview:** One pattern we see more than any other in ATS checks.
- **File:** `email-2-value.html`
- **Job:** Educate on tailoring. Drive second ATS check with different JD.
- **CTA:** Run a New ATS Check

### Email 3: Premium Conversion (Day 7)
- **Subject:** What changes when you upgrade your resume workflow
- **Preview:** Same qualifications, less time per application, better results.
- **File:** `email-3-conversion.html`
- **Job:** Convert to Premium with product-behavior proof (not testimonials).
- **CTA:** Try Premium at $9/month

---

## Quick Setup (15 minutes)

### Step 1: Create Emails in Buttondown

1. Go to https://buttondown.com and log in
2. Navigate to **Emails** → **Drafts** or **Automations**
3. Create 3 new emails using the HTML files in this directory

### Step 2: Set Up Automation

**Option A: Buttondown Automations (Preferred)**

1. Go to **Automations** → Create new automation
2. Name: "Welcome Sequence"
3. Trigger: New subscriber
4. Actions:
   - Send Email 1 (immediately)
   - Wait 3 days → Send Email 2
   - Wait 4 more days (7 total) → Send Email 3

**Option B: Buttondown API (Programmatic)**

Use the Buttondown API to create scheduled emails:
```bash
# See api-setup.sh in this directory for automated setup
```

### Step 3: Verify Content

Before activating, confirm:
- [ ] All links point to `resumelybuilderai.com` (not `resumebuilder-ai.com`)
- [ ] UTM parameters are correct on all links
- [ ] `{{ subscriber.first_name|default:"there" }}` variables render correctly
- [ ] Branding says "Resumely" (not "ResumeBuilder AI")
- [ ] CTA buttons render properly on mobile

### Step 4: Test

1. Subscribe yourself with a test email
2. Verify Email 1 arrives immediately
3. Manually trigger Email 2 and Email 3 to verify formatting
4. Check on both desktop and mobile email clients

---

## Metrics to Track

| Metric | Email 1 Target | Email 2 Target | Email 3 Target |
|--------|---------------|---------------|---------------|
| Open Rate | 35%+ | 25%+ | 20%+ |
| Click Rate | 8%+ | 6%+ | 4%+ |
| Unsubscribe | <0.5% | <0.5% | <1% |

---

## Key Changes from Previous Version

1. **Branding unified:** All references now say "Resumely" (not "ResumeBuilder AI")
2. **URLs fixed:** All links point to `resumelybuilderai.com`
3. **No fabricated testimonials:** Email 3 replaced "Sarah's story" with product-behavior proof (what Premium actually does)
4. **Voice aligned:** Trust-first, non-hype tone per brand guidelines
5. **No unverified claims:** Removed "20-40 percentage point boost" and "analyzed thousands"
6. **Sign-off standardized:** All emails signed "The Resumely Team"
7. **UTM parameters updated:** Consistent `lifecycle` medium and `welcome_sequence` campaign
8. **P.S. lines create sequence continuity:** Each email teases the next

---

## Integration with App

Newsletter signup component (`src/components/newsletter-signup.tsx`) already posts to Buttondown API endpoint: `https://buttondown.com/api/emails/embed-subscribe/resumebuilderai`

For API-based subscriber management:
```javascript
await fetch('https://api.buttondown.email/v1/subscribers', {
  method: 'POST',
  headers: {
    'Authorization': `Token ${process.env.BUTTONDOWN_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: user.email,
    tags: ['free_user', 'ats_check_user']
  })
});
```
