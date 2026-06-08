# Resumely — Growth + Pricing Design Spec
Date: 2026-06-07
Status: Approved by founder
Author: Brainstorming session — Claude Code + Nadav Yigal
Source research: `executive-os/research/WP-2-competitor-pricing-research.md`, `executive-os/work-packets/WP-2-monetization-spec.md`, `executive-os/BUSINESS-GTM-PLAN-V0.md`

---

## 1. Problem Statement

Resumely is about to go live on the App Store. Two questions need answering before the first real user cohort arrives:

1. **What does the pricing model look like?** The existing WP-2 spec was drafted subscription-first. The founder's intent is a tiered credit-pack model with an unlimited subscription as the top tier.
2. **What drives the first 100 users?** With $0 paid acquisition and a solo founder, growth must come from compounding organic engines.

---

## 2. Decisions Made in This Session

| Decision | Choice | Rationale |
|---|---|---|
| Monetization model shape | Freemium | Industry standard; Teal + Rezi give 1 free optimize + export. Gating before this kills activation. |
| Paywall placement | At export — see everything, pay to download | User is fully invested before the ask. Highest conversion point. |
| Purchase mechanic | Tiered credit packs + unlimited subscription | Matches episodic job-seeker behaviour. Credits feel fair per-job. Subscription for power users. |
| Primary growth strategy | Volume flywheel: ASO + web ATS tool + founder content | Three independent engines, each feeding the others. |
| Retention model | Accept episodic churn; capture the exit moment | Don't fight the nature of job searching. Extract max value at the "got hired" moment instead. |
| Ambassador mechanic | "Got hired?" flow → LinkedIn badge + App Store review | Zero-cost social proof. Each hired user feeds ASO ranking and founder content. |
| Hebrew market | Built into every engine from day one | No dominant competitor in Hebrew. Founder has direct market access. Phase 1: metadata + web tool. Phase 2: RTL PDF + templates. |

---

## 3. Pricing Model

### Free Tier (Permanent)

Every user gets this. No card required. No time limit.

| Feature | Free |
|---|---|
| Upload resume (PDF or DOCX) | Yes |
| 1 full AI optimization (analyze, improve bullets, keyword match) | Yes |
| Full preview of optimised resume | Yes |
| ATS score + top 5 missing keywords | Yes |
| 1 PDF export / download | Yes |
| 1 starter template | Yes |

**Philosophy:** The user must see a better resume and export it once, completely free. This is the activation moment. Gating before it is the market anti-pattern — Jobscan is widely criticised for gating scan #6, costing it installs and reviews.

### Paid Tiers

| Tier | Name | Price | What it is |
|---|---|---|---|
| 1 | Single Export | $3.99 ⚠️ | One-time IAP. Export one tailored resume. Lowest friction. |
| 2 | 5-Export Pack | $12.99 ⚠️ | One-time IAP. $2.60/export. Credits don't expire. Most popular — covers a typical 5–15 role job search. |
| 3 | 10-Export Pack | $19.99 ⚠️ | One-time IAP. $2.00/export. Best per-export value. For serious job searches. |
| 4 | Unlimited | $9.99/month or $49.99/year ⚠️ | Subscription. Unlimited tailoring + exports + all Expert modes + all templates + job application tracker. |

**⚠️ All prices are directional.** Final prices require CFO validation. See Section 6.

### What Paid Unlocks (beyond the free export)

| Feature | Free | Paid (any tier) |
|---|---|---|
| Per-job tailoring (additional job descriptions) | — | Yes |
| Additional exports and downloads | — | Yes (uses credits or unlimited) |
| Full ATS deep-dive (all keywords, section analysis) | — | Yes |
| Unlimited cover letter generation | — | Unlimited tier only |
| Expert modes: interview prep, LinkedIn optimisation, salary negotiation | — | Unlimited tier only |
| Premium design templates | — | Unlimited tier only |
| Job application tracker | — | Unlimited tier only |

### Paywall UX

- User completes first optimization and sees full improved resume.
- User taps **Export PDF** or **Copy text**.
- Paywall sheet appears showing all four tiers with the 5-pack highlighted as "Most Popular".
- User selects tier → IAP or subscription flow.
- On completion: export proceeds immediately.

---

## 4. Growth Strategy — Three Parallel Engines

### Engine 1: ASO (Start Before Approval)

**Goal:** Rank organically for job seeker search terms in the App Store.

**English metadata:**
- Title: `Resumely: AI Resume Builder`
- Subtitle: `ATS Resume Tailored to Any Job`
- Primary keywords: resume builder, ATS resume, tailor resume, cover letter AI, resume optimizer, job application, CV maker

**Hebrew metadata (same listing, additional locale):**
- Hebrew title, subtitle, and keyword field targeting Israeli job seekers
- Hebrew description emphasising Israeli job market context

**Screenshots:**
- Frame 1: Before/after ATS score (62 → 89)
- Frame 2: Paste job description → tailored resume in 5 minutes
- Frame 3: Export PDF from your phone
- Frame 4: Expert modes (cover letter, ATS deep-dive)
- Frame 5: Hebrew version of Frame 1 (for Hebrew locale)

**Preview video:** 30 seconds. Paste job description → watch resume sections update → ATS score improve → export.

**Review strategy:** First 20–50 installs from founder community (Engine 3) are primed to leave reviews. Early reviews are the #1 ASO ranking signal.

**Compounding:** Every 5-star review improves ranking → more organic installs → more reviews.

---

### Engine 2: Free Web ATS Tool (Post-Approval Build Sprint)

**Goal:** Capture Google intent traffic from job seekers searching "ATS score checker", "resume checker free", "is my resume ATS compatible".

**Product:**
- URL: `resumebuilder.ai/ats-checker` (or equivalent domain)
- No sign-in required
- User pastes resume text → instant ATS score + top 5 gaps identified
- Result page CTA: "Fix it in Resumely" → App Store link (auto-detects mobile)
- Attribution: `?ct=web-ats&at=organic` appended to all App Store links

**Hebrew version:**
- URL: `/he/ats-checker`
- Hebrew UI, Israeli job market keywords in copy
- Same attribution wiring

**SEO targeting:**
- Phase 1: one optimised landing page for the tool itself
- Phase 2 (later): job-title specific pages ("ATS resume for software engineers", "product manager resume template")

**Funnel:** Google search → free score → see gaps → "Fix it in Resumely" → App Store install → optimize → export.

**Build scope:** Requires one sprint on the ResumeBuilder web app. The ATS scoring logic already exists — this is a UI surface and landing page, not new AI work.

---

### Engine 3: Founder LinkedIn + Israeli Communities (Ongoing)

**Goal:** First 20–50 motivated users who will leave reviews and seed word-of-mouth.

**Cadence:** 1–2 posts per week. Consistency matters more than volume.

**Content angles:**
- Behind-the-scenes building ("why I built Resumely")
- Resume tips that prove expertise ("5 things ATS systems reject that look fine to humans")
- Success stories (hired users, with permission)
- Product updates framed as founder lessons

**Hebrew / Israeli channels:**
- Post in Hebrew as well as English
- Share in Israeli job-hunting Facebook groups on launch day
- LinkedIn in Hebrew for the Israeli professional audience
- Israeli tech communities (e.g. Israeli Startup Nation Slack, relevant Facebook groups)

**Goal metric:** 20 reviews in the first 30 days. Not installs — reviews. Reviews are what move ASO.

---

## 5. Ambassador Loop — "I Got Hired"

**The insight:** Job seekers churn once hired. Don't fight it. Capture the maximum value at the exit moment — when trust in the product is highest and the user is most motivated to share.

### In-App Flow

**Trigger:** 2–3 weeks after a user's last export. Push notification or in-app banner:
> "Did you land the interview? 🎯"

**If user taps Yes:**

1. **Success screen:** "Congrats! One step closer to the job." with Resumely branding.
2. Two CTAs presented simultaneously:
   - **"Share on LinkedIn"** (primary, highlighted) → opens pre-drafted LinkedIn post
   - **"Leave a review"** (secondary) → opens App Store review prompt

**If user taps Not yet:**
- Dismiss. No follow-up spam. Respect the timeline.

**If user taps I got the job:**
- Same success screen + both CTAs
- Bonus: unlock one free export credit as an ambassador reward ("Here's a free export for your next application")

### LinkedIn Badge — Auto-Drafted Post

English version:
```
Excited to share that I just landed an interview at [Company] 🎉

Used Resumely to tailor my resume to the job description — ATS score jumped
from [X] → [Y]. The optimisation took 5 minutes on my phone.

If you're job hunting, give it a try 👇
[App Store link]

#JobSearch #Resume #CareerTips
```

Hebrew version:
```
שמח לשתף שנקראתי לראיון ב-[חברה] 🎉

השתמשתי ב-Resumely כדי להתאים את קורות החיים שלי למשרה —
הציון ATS קפץ מ-[X] ל-[Y]. לקח 5 דקות בנייד.

למי שמחפש עבודה, שווה לנסות 👇
[App Store link]

#חיפוש_עבודה #קורות_חיים
```

User can edit before posting. One tap to share.

### Why This Works

- Authentic social proof from a real person beats any ad
- LinkedIn reach is exactly where job seekers and hiring managers spend time
- Each post tags Resumely, creating organic brand mentions
- App Store review from a hired user carries more weight than a generic review
- Hebrew posts reach the Israeli market with zero additional effort

---

## 6. CFO Validation Required Before Finalising Prices

Prices in Section 3 are directional. Before hardcoding any price in StoreKit:

| Input needed | Source | Why it matters |
|---|---|---|
| AI cost per full optimization | OpenAI billing dashboard | Sets the price floor. If AI cost > ~$2 per session, Tier 1 ($3.99 − 30% Apple cut = $2.79 net) loses money. |
| Hosting + Supabase + Vercel cost per active user | Provider billing dashboards | Adds to the per-transaction cost basis. |
| Apple IAP cut | Fixed: 30% standard, 15% if < $1M/year revenue | Already factored in above — confirm which rate applies. |
| Market validation | First-cohort activation data (PostHog) | Per EXD-009: don't hardcode prices until D7 activation is readable. |

**Market ranges confirmed by WP-2 research (source: `executive-os/research/WP-2-competitor-pricing-research.md`):**
- Resumely subscription: $9–13/week, $25–30/month, $79–96/year (Teal, Rezi, Kickresume benchmarks)
- The credit-pack model has no direct competitor benchmark — Tier 1–3 prices are set by cost floor + perceived value

---

## 7. Hebrew Market — Phased Plan

### Phase 1 (Zero build risk — ship with v1.0)
- App Store Hebrew locale metadata (title, subtitle, keywords, description)
- Hebrew screenshots (translated UI labels on existing screenshots)
- Web ATS tool Hebrew version at `/he/ats-checker`
- LinkedIn ambassador badge — Hebrew draft included
- Israeli community channels seeded on launch day

### Phase 2 (After RTL device QA passes)
- RTL PDF export (currently a known risk — WKWebView rendering unverified)
- Hebrew resume templates
- ILS pricing option (Israeli Shekel)
- Israeli job board integrations (AllJobs, Jobmaster) — future consideration

**Gate for Phase 2:** RTL PDF export must be verified working on a physical device before publishing Hebrew metadata that implies Hebrew resume support.

---

## 8. Execution Sequence

| Phase | When | What |
|---|---|---|
| Now (pre-approval) | This week | Write ASO copy (English + Hebrew metadata). Prepare screenshots. Set up founder LinkedIn cadence. |
| Approval day | Day 0 | Publish ASO listing. Post in Israeli communities. Begin founder content. |
| Week 2–3 post-approval | After first reviews land | Start web ATS tool build sprint. |
| Week 4+ | After first-cohort D7 data | CFO validates prices. Implement StoreKit IAP + subscription. Enable paywall. |
| Post-pricing | After paywall live | Ambassador flow build (in-app "Got hired?" prompt + LinkedIn badge). |

---

## 9. What This Spec Does NOT Cover

- StoreKit IAP implementation details (separate engineering spec)
- RevenueCat vs StoreKit-direct decision (separate CFO decision)
- RunSmart pricing (separate spec — see WP-2-monetization-spec.md)
- PostHog event instrumentation for the paywall (separate analytics spec)
- Programmatic SEO pages (Phase 2 growth — after ASO + web tool prove conversion)

---

## 10. Conflicts With Existing Specs to Resolve

**WP-2-monetization-spec.md** was drafted with subscription-first shape (weekly/monthly/annual). This spec introduces credit packs (Tier 1–3) as the primary transactional model and moves subscription to Tier 4 (unlimited). The feature matrix in WP-2 remains valid — only the purchase mechanic and tier structure change. WP-2 should be updated to reflect this spec before implementation begins.

---

## Links

- Research: `executive-os/research/WP-2-competitor-pricing-research.md`
- Existing monetization spec: `executive-os/work-packets/WP-2-monetization-spec.md`
- GTM plan: `executive-os/BUSINESS-GTM-PLAN-V0.md` + `.agent-os/distribution/gtm-plan.md`
- CFO OS: `executive-os/CFO-OS.md`
- EXD-009 (pricing timing gate): `executive-os/EXECUTIVE-DECISIONS.md`
