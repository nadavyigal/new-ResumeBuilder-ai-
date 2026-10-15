# Competitor pricing and founder research steps (Track 3)

Plan: `docs/plans/2026-10-14-market-play-implementation.md`, section "Track 3: Research".
R1 (AI cost, $0.018 to $0.032 per run) is recorded in the plan and is not repeated here.

Rule for every item (D4): public pages only. No signups, no logins, no made-up identities,
no disposable emails, no saved passwords. A page that needs an account is recorded as
"behind login" and left there. All reads below were done on 2026-10-15 in the Claude
desktop app's built-in browser, signed out. Quotes are short and verbatim.

## Summary

| # | Product | Price (public) | Tailors a CV to a job ad? | Meaning for G3 |
|---|---|---|---|---|
| R3 | Resumaker (resumake.co.il) | Not public. Behind a name, email and marketing-consent form | Not claimed on any public page | The Hebrew incumbent sells a builder. "Fit my CV to this job" is not its promise |
| R4 | "Adjusting your resume" by Ben Rotenberg, on Amazon PartyRock | Free | Yes, that is the whole tool | The Hebrew promise already exists for free. Win on trust and a finished file, not on "AI tailoring" |
| R5 | Teal (tealhq.com) | Free plan; Teal+ $13 / 7 days, $29 / 30 days, $79 / 90 days | Yes: job keyword matching and a Match Score | English price anchor. D1 packs are cheaper for one job search |

## R3. Resumaker (resumake.co.il)

- **URLs:** https://www.resumake.co.il/ , https://www.resumake.co.il/tos/ ,
  https://www.resumake.co.il/app/build/templates/ ,
  https://www.calcalist.co.il/article/rjjflqsic (sponsored article, 2022-05-08)
- **Read:** 2026-10-15

**Prices: not public.** There is no pricing page (`/pricing/` and `/prices/` return the
site's not-found page). The terms say prices are shown on the site and include VAT, and
that there is no refund once the CV is delivered. The builder's first screen asks for first
name, last name, email and consent to marketing email before anything else. Under D4 that
is the stop point: **behind login**.

**Does it tailor to a job ad? No public claim.** The home page sells templates, speed and an
AI that "suggests improvements". No public page mentions a job ad or a job description as
input. The only job-ad mention is a writing tip inside the builder's help text (mix in terms
from the job you want), which the user does by hand.

Quotes:
- Page title: "כתיבת קורות חיים - בחינם ובמהירות" (writing a CV, free and fast)
- Home page: "מנוע בינה מלאכותית שיעזור לך לבנות את קורות החיים ויציע עבורך שיפורים מתאימים"
- Terms, section 6: "המחירים המוצגים באתר כוללים מע"מ" (prices shown on the site include VAT)
- Builder consent line: "אני מאשר/ת את תנאי השימוש והפרטיות וקבלת דיוור פרסומי מהאתר"
- Calcalist, sponsored by Resumaker (company claim, not checked): "כ- 72 אחוז מכלל קורות החיים שנשלחים למעסיקים בישראל"

Other signals: home page counter "1214 קורות חיים נוצרו היום" on 2026-10-15; a link to upload
an existing CV; the same company runs builders in about 20 countries (footer links).
Trustpilot lists 151 reviews for resumake.co.il (page read, not analysed).

Not verified, a guess: a web search summary said a review of the Danish sister site mentions
a repeating charge every 4 weeks. That suggests a subscription after a free start, as is
common for builders. I did not open that review and it is about another domain.

**What it means for G3.** Resumaker owns "Hebrew CV builder": templates, free to start, large
Hebrew SEO library of CV examples. Fighting it there loses. Its public promise stops at "build
a good-looking CV"; it does not say "paste the job, see what is missing". G3's "fit my CV to
this job" sits in the space Resumaker does not claim. Lead with the job ad as the input, not
with templates.

## R4. The Israeli CV-to-job tool from Geektime

- **Article:** https://www.geektime.co.il/israeli-makes-this-super-easy-resume-enhancer-with-ai/
  ("רגע לפני שאתם שולחים: ישראלי יצר כלי חינמי שמתאים את הקו"ח שלכם למשרה"), by אושרי אלקסלסי,
  published 2025-03-05.
- **Product:** "Adjusting your resume - התאמת קורות החיים שלך", built by Ben Rotenberg
  (a marketer and AI lecturer, not a developer) on Amazon PartyRock:
  https://partyrock.aws/u/benBOT/VOMsh_SHb/Adjusting-your-resume
- **Read:** 2026-10-15

**Price: free.** The article calls it free. PartyRock's FAQ (https://partyrock.aws/faq) now
describes free daily credits for "educators and learners", so the platform has moved toward
education. Whether the tool still runs for the public is unverified.

**Does it tailor to a job ad? Yes, that is all it does.** Upload a CV (PDF), paste the job
description. Outputs: job keywords, a tailored CV, a second "final and edited" pass meant to
tone down overstatement, a cover letter, and an AI portrait. It keeps the CV's original
language, so it works in Hebrew. Output is text to copy, not a formatted file.

**Behind login to run.** The tool page loads for a signed-out guest and shows a "Sign in"
button. A reader comment says running it needs a Google or Amazon account. I did not run it.

Quotes:
- Geektime headline: "ישראלי יצר כלי חינמי שמתאים את הקו"ח שלכם למשרה"
- Geektime, on the edit pass: "עורך אותה כך שלא תהיה מוגזמת מדי"
- Rotenberg's reach claim (not checked): "לקח לי פחות מ-10 דקות לבנות כלי שהגיע למאות אלפי אנשים"
- Tool intro: "customize your resume for specific job positions while maintaining truthfulness and authenticity"
- Reader comment: "למה הדרישה להיכנס עם חשבון גוגל / אמזון?"

**What it means for G3.**
1. The Hebrew demand is real and the wording is settled. Geektime's headline is G3 almost
   word for word, and the tool's own title is "התאמת קורות החיים שלך". Use "התאמת קורות
   חיים למשרה" in G0 posts and the G1a Hebrew page.
2. "AI tailors your CV to the job" is not a differentiator in Hebrew: a free version had
   wide press in March 2025. Resumely has to say what this tool does not do:
   - no account to see the gaps (G1c);
   - shows what is missing and lets the user choose ("Add only if true"), instead of
     "trust our second pass not to exaggerate";
   - a finished, formatted file, not text to paste into a template.
3. The tool's own readers objected to the sign-in wall. Same lesson as G1c.

## R5. Teal (tealhq.com)

- **URL:** https://www.tealhq.com/pricing
- **Read:** 2026-10-15

**Prices (USD):**

| Plan | Price | Per day (Teal's figure) |
|---|---|---|
| Free | $0, "Free Forever" | |
| Teal+ weekly | $13 every 7 days | $1.85 |
| Teal+ monthly | $29 every 30 days | $0.96 |
| Teal+ quarterly | $79 every 90 days | $0.87 |

Free plan limits: 10 job-description keyword matches, top 5 analysis findings, 10 AI bullet
credits, 2 summaries, 2 cover letters. Teal+ makes all of them unlimited. "No credit card
required to start." Refunds only within a plan's eligibility window.

**Does it tailor to a job ad? Yes.** Attach a job, see its keywords, get a Match Score, and
rewrite bullets and summary with AI.

Quotes:
- "Unlock all keywords from the job description, and receive a Match Score"
- "No credit card required to start."
- "Upgrade or downgrade your plan or cancel at any time."

**What it means for D1 and G3.**
- One job search on Teal costs $13 to $29. D1's packs cost $3.99 for one tailored export and
  $19.99 for ten, with no renewal. For someone applying to a handful of jobs, packs are
  cheaper and carry no "remember to cancel" risk. Worth saying on the paywall when it exists.
- Teal also calls its number a "Match Score". That supports EXD-012's move away from "ATS
  pass" wording: the market leader sells a match number, not an ATS promise.
- Teal is English-only on its pricing page. It is a price anchor, not a Hebrew competitor.

---

## Founder-only items (steps only; Claude does not do these)

### R2. App Store Connect export, 90 days (closes the G1b test choice)

Why: G1b runs an App Store A/B test only if each arm can reach about 1,000 impressions in 4
weeks. Below that, ship the new screenshots and compare 4 weeks before and after.

1. Sign in to App Store Connect, open the Resumely app, open **Analytics** (menu names may
   differ slightly from this list).
2. Set the date range to the last 90 days.
3. Read and note, for the whole 90 days and per week: **Impressions**, **Product Page
   Views**, **Conversion Rate**, **Total Downloads** (first-time downloads).
4. Break the same numbers down by **Source Type** (App Store Search, App Store Browse, Web
   Referrer, App Referrer). Note the top web referrers if shown.
5. Export each view as CSV if offered. Keep the files out of the repo; paste the totals into
   the table below.
6. Decision: take impressions for the last 4 weeks and halve it. 1,000 or more per arm: run
   the A/B test (Product Page Optimization). Under 1,000: no test, ship and compare.

| Metric (90 days) | Total | Last 4 weeks |
|---|---|---|
| Impressions | | |
| Product page views | | |
| Conversion rate | | |
| First-time downloads | | |
| Top source type | | |

### R6. Willingness to pay in shekels: five short conversations (feeds P1, P3)

Who: five Israeli job seekers who applied to a job in the last 30 days. At most two from
tech. Not people who already know about Resumely in detail. 10 to 15 minutes each, by phone
or in person.

Rules: ask about what they did, not what they would do, until question 5. Do not pitch, do
not promise a price, do not sell. Record answers as P1 to P5, no names or phone numbers in
the repo.

Questions (Hebrew first, English for the record):

1. מתי שלחת לאחרונה קורות חיים למשרה מסוימת? שינית בהם משהו בשביל המשרה הזאת? מה?
   (When did you last send a CV for a specific job? Did you change it for that job? What?)
2. כמה זמן זה לקח לך? (How long did that take?)
3. שילמת פעם על משהו בחיפוש עבודה? כתיבת קו"ח, לינקדאין פרימיום, קורס? כמה?
   (Have you ever paid for anything in a job search: a CV writer, LinkedIn Premium, a course? How much?)
4. כמה משרות שלחת בחודש האחרון? (How many jobs did you apply to in the last month?)
5. Describe the product in one line: "מדביקים את המשרה, רואים מה חסר בקורות החיים, מתקנים
   ומורידים קובץ מוכן." Then ask the four price questions, in shekels, per tailored CV:
   - באיזה מחיר זה כל כך זול שלא היית סומך/ת על זה? (So cheap you would not trust it?)
   - באיזה מחיר זו מציאה? (A bargain?)
   - באיזה מחיר זה מתחיל להיות יקר, אבל עדיין היית שוקל/ת? (Getting expensive, but still possible?)
   - באיזה מחיר זה יקר מדי? (Too expensive?)
6. Only now show the D1 packs in shekels (1, 5 or 10 tailored exports; use the shekel price
   Apple shows for the chosen price tier in App Store Connect). "איזה היית קונה, אם בכלל?"
   (Which would you buy, if any?) Then: "ולמה לא מנוי חודשי?" (Why not, or why, a monthly plan?)

Record:

| # | Applied last 30 days | Changed CV per job? | Paid before (₪) | Too cheap | Bargain | Expensive | Too expensive | Pack chosen |
|---|---|---|---|---|---|---|---|---|
| P1 | | | | | | | | |
| P2 | | | | | | | | |
| P3 | | | | | | | | |
| P4 | | | | | | | | |
| P5 | | | | | | | | |

Five people is a sanity check, not a price study. Read it as: does anyone flinch at the D1
prices, and does anyone already tailor per job.

### R8. Apple Small Business Program (StoreKit gate condition 2)

Why: the StoreKit gate needs the Apple rate settled. 15% inside the program, 30% outside.
Source read 2026-10-15: https://developer.apple.com/app-store/small-business-program/

Eligibility (from Apple's page): up to 1 million USD in proceeds in the prior calendar year,
or new to the App Store, counted across all Associated Developer Accounts.

1. Check first whether you are already enrolled: App Store Connect, **Business** (or
   Agreements, Tax and Banking), look for the program status or a 15% rate in recent
   Payments and Financial Reports.
2. If not enrolled: you must be the **Account Holder** of the Apple Developer account.
3. Accept the latest **Paid Apps agreement** in App Store Connect if it is not already
   active (required to sell anything, including the D1 packs). This is a legal agreement:
   your call, read it first.
4. List **Associated Developer Accounts**. RunSmart: if it sits under a separate Apple
   Developer account you own or control, it must be listed, and its proceeds count toward
   the 1 million USD limit. If both apps are under one account, there is nothing to list.
5. Submit the enrollment form from the program page ("Enroll now").
6. Timing: Apple applies the 15% rate 15 days after the end of the fiscal month in which
   enrollment is approved. Enroll well before the first pack sale.
7. Record the result here (enrolled yes or no, approval date) and in the StoreKit gate table
   in the plan. Condition 2 is then closed.

Apple's page also says enrolled developers with under two million first-time downloads can
use Apple Foundation Models on Private Cloud Compute with no cloud API cost. Not in scope
now; noted because it could change R1's AI-cost picture later.

### R7. Exports per user: waits

Runs only when 30 or more users have exported. Today there are far fewer. Skipped.
