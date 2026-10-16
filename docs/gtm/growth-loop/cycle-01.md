# Cycle 1 — `rb-li-20260910-trusted-workspace`

Stage 2 run 2026-10-15: tracking verified, baseline not yet read. Pre-post check
2026-10-16 on production: **passed**, score and missing items shown signed out, no 402, no
sign-up popup (see "Pre-post check, 2026-10-16" in stage 2). Baseline still not read. Paste these into [`experiment-card.html`](./experiment-card.html)
and work the six stages. Nothing here has been published.

## 1. Frame

| Field | Value |
|---|---|
| Campaign ID | `rb-li-20260910-trusted-workspace` |
| Channel | LinkedIn, **personal profile** (the company page has 0 followers) |
| Locale | `he` |
| Positioning under test | Trusted application workspace |
| Question | Does one Hebrew LinkedIn post produce attributable arrivals, and does the loop execute end to end without a founder-only step stalling it? |

Destination:

```
https://resumelybuilderai.com/he/ats-checker?utm_source=linkedin&utm_medium=social&utm_campaign=rb-li-20260910-trusted-workspace&utm_content=he_li_trusted_01
```

**Cycle 1 validates execution and attribution, not positioning.** A
`trusted application workspace` vs `AI resume optimizer` comparison needs both arms
running with their own campaign ids, and is a later cycle.

## 2. Prepare

**Asset (existing, not newly written):** post 2 of the vault's LinkedIn batch 1 —
`02-Products/ResumeBuilder/2026-08-16-resumely-linkedin-posts.md`, "סיבות להשתמש ב-Resumely".

That post is the right carrier for this positioning and not a rewrite of it. Its spine is
*"מה שאין שם בכוונה: הבטחה שתעברו סינון כלשהו"* — what the product deliberately does not
promise. That refusal is the trust claim; the vault's 2026-09-09 content-operations note
independently names the same post as the one to move first.

**Positioning guardrail.** "Trusted application workspace" is a frame for what the
product *is*, and it must never be dressed as a measured fact. No "trusted by N users",
no rating claim, no employment-outcome claim. The avoid-list it was checked against is
the Resumely iOS repo's `.agents/product-marketing.md`: *pass ATS, guaranteed, beat the
bots, official ATS score, get interviews, pass filters, auto-apply, למצוא עבודה*.

**Copy (prompt 1):** filed 2026-10-15 as `builder-os-exchange` PR #27,
`outbox/2026-10-15-growth-communications-rb-cycle-01-post.md`. Vault post 2 with reason 3
removed (founder decision D2), cover-letter claim checked against the live listing and
kept. Independent review (marketing contract section 5) still pending.

### Stage 2 record, 2026-10-15 (Claude Code)

| Check | Result |
|---|---|
| Baseline | **NOT YET READ.** `measurement_contract.py` stopped: `AGENTIC_OS_POSTHOG_API_KEY` is not set on this machine. No number was read or estimated. |
| Tracking | **`verified`**, 2026-10-15 06:02 UTC. |
| Signed-out score check | **Score and gaps shown, no 402. A sign-up prompt does appear.** Founder decision before posting. |

**Pre-action baseline: NOT YET READ.** The script reads the key only from the
environment and stopped with `STOPPED: AGENTIC_OS_POSTHOG_API_KEY is not set`. Run this in
the Resumely iOS repo before publishing and paste the headline plus the read timestamp here:

```bash
AGENTIC_OS_POSTHOG_API_KEY=… python3 scripts/measurement_contract.py
```

**Tracking: `verified`.** The destination link above was opened signed-out in a clean
browser on 2026-10-15. Observed:

- The page stored `resumely_campaign_context` with `campaign_id = rb-li-20260910-trusted-workspace`,
  and the App Store button pointed at `…id6776752349?ct=rb-li-20260910-trusted-workspace&at=organic`.
- PostHog project 270848, after an explicit switch (`/api/projects/270848/` returned
  "ResumeBuilder AI", current team 270848) and a fingerprint check (`$ai_generation` with
  `$ai_lib = resumely-posthog-node`, `optimization_review_created`, `resume_file_selected`
  all present in the last 30 days). Read-only SQL:

| UTC | Event | distinct_id | campaign_id |
|---|---|---|---|
| 05:59:15 | `$pageview` | `01a06220-b48b-72b0-b5a0-3592090fe11f` | `rb-li-20260910-trusted-workspace` |
| 06:00:02 | `campaign_store_handoff` | `01a06220-b48b-72b0-b5a0-3592090fe11f` | `rb-li-20260910-trusted-workspace` |
| 06:00:54 | `$pageview` | `01a13e26-3555-7afd-933c-82079b5b0dba` | `rb-li-20260910-trusted-workspace` |
| 06:01:25 | `ats_checker_score_displayed` | `01a13e26-3555-7afd-933c-82079b5b0dba` | `rb-li-20260910-trusted-workspace` |
| 06:01:26 | `signup_popup_viewed` | `01a13e26-3555-7afd-933c-82079b5b0dba` | `rb-li-20260910-trusted-workspace` |

Every event also carried `utm_campaign` and `utm_content = he_li_trusted_01`.

**Test arrivals to exclude from every later count.** Exactly two distinct ids have ever
carried this campaign id (read 2026-10-15 06:02 UTC, all events since 2026-09-01):
`01a06220-b48b-72b0-b5a0-3592090fe11f` (1 pageview, 1 store handoff) and
`01a13e26-3555-7afd-933c-82079b5b0dba` (1 pageview, the score check). Both are excluded
twice over: the readout window starts at the post time, which is after 06:02 UTC on
2026-10-15, and the readout query adds `distinct_id not in (these two)`.

**Signed-out score check: score and gaps yes, no 402, but a sign-up prompt appears.**
Same campaign link, signed out (no Supabase session in storage), a fictional demo resume
(`tests/fixtures/free-check-2026-10-11/maya-levin-resume.txt` as a PDF) and job ad
(`job-data-analyst.txt`):

- `POST /api/public/ats-check` returned **200**. No 402 anywhere.
- The page showed the score (62/100), the top 3 gaps with the missing keywords
  (`sql queries, tableau, regional performance, sales leadership`) and 3 quick wins.
- **About 1 second later a sign-up modal covers the result** ("רוצים את כל תוכנית
  התיקון? ... פתיחת חשבון חינם / לא עכשיו"). It is dismissible. Trigger:
  `src/components/landing/ATSScoreDisplay.tsx:43-61`, a 900 ms timer whenever
  `preview.lockedCount > 0` (here 7 of 10 issues are locked behind an account).

The post itself does not claim "no sign-up". Its claims (a match score and what is
missing) held with no account. Whether the post goes out with the modal in place, or waits
for G1c to remove it, is the founder's call.

**Seen on the way (not fixed here; G1a or G1c):**

- The fit verdict reads "Strong" above a 62/100 score labelled "דורש שיפור" (needs
  improvement). The two labels disagree.
- English strings on the Hebrew page: "Estimated fit vs this job, not a hiring
  guarantee." and the issue texts ("Add the missing skill ...").
- Gap 2 shows "+1.9000000000000001 נק׳" (unrounded float).
- The App Store button reads "הורד Resumely — חינם" (a "free" claim and an em dash).

### Pre-post check, 2026-10-16 (Claude Code)

**Verdict: passed.** The post's claims (a match score and what is missing, no account
needed) hold on production. Read only: nothing was posted.

| Check | Result |
|---|---|
| Production build | Vercel production deployment of `9281cc4` (main, includes #185 G1c-1), created 2026-10-16 04:25 UTC |
| Signed out | No Supabase session in storage (no `sb-` keys) |
| Campaign context | `resumely_campaign_context` stored `campaign_id = rb-li-20260910-trusted-workspace`, `utm_content = he_li_trusted_01`; both App Store links carry `ct=rb-li-20260910-trusted-workspace&at=organic` |
| `POST /api/public/ats-check` | **200**, about 13 s. No 402 anywhere |
| Result | Score 62/100, top 3 gaps with missing keywords (`sql queries, tableau, regional performance, sales leadership`), all 10 issues listed (none locked), 3 quick wins |
| Account prompt | **None blocking.** No dialog at any point (checked 20 s after the score). The only account mentions are the header "כבר יש לכם חשבון? התחברו" sign-in link and an optional "שמרו את הבדיקה" save box at the very end of the result |
| PostHog 270848 | Project confirmed by `project-get`. Events at 04:36:54 to 04:37:58 UTC: `$pageview`, `ats_checker_file_uploaded`, `ats_checker_submitted`, `ats_checker_score_displayed`, each with `campaign_id = rb-li-20260910-trusted-workspace` and `utm_content = he_li_trusted_01`. No `signup_popup_viewed` (it fired in the 2026-10-15 run, before #185) |

Run 2026-10-16 04:36 to 04:38 UTC, Playwright browser, the destination link above, the same
fictional demo resume and job ad as stage 2 (`maya-levin-resume.txt` as a PDF,
`job-data-analyst.txt`).

**Test arrival to exclude.** The Playwright profile reused distinct id
`01a13e26-3555-7afd-933c-82079b5b0dba`, already on the exclusion list above. No new test id
was created. The readout window starts at the post time anyway.

**Changed since 2026-10-15:** the sign-up modal is gone (#185); the fit label reads
"מתאים" above 62/100 and no longer disagrees with a "needs improvement" label; gap 2 shows
"+1.9 נק׳" (rounded); the App Store button reads "להורדת Resumely מ-App Store" (no "free"
claim, no em dash).

**Still seen (not blocking the post, not fixed here):** the quick wins' "why this improves
your score" lines are English on the Hebrew page ("Specifying 'sales and operations' aligns
with the job context ..."), and the issue example "שיפרתי sql queries ב-[X%]" puts a skill
in the metric slot. #187 fixes that in `MainIssuesSummary`, which the free check shares
with the dashboard banner; it is not merged yet.

**Still open before posting:** the baseline. `measurement_contract.py` needs
`AGENTIC_OS_POSTHOG_API_KEY`, which is not set on this machine; no number was read or
estimated. The independent review of the post copy (marketing contract section 5) is also
still pending.

## 3–6

Stage 3 onward are founder actions and are left empty on purpose. The card will not let
stage 4 record a real publication until stages 1 and 2 are complete, tracking is
verified, and approval is given.

## What this cycle can and cannot conclude

| Can | Cannot |
|---|---|
| Whether the loop ran end to end | Whether this positioning beats the other |
| Replies drawn, and from whom | Anything from impressions or likes |
| Arrivals carrying `rb-li-20260910-trusted-workspace`, and store handoffs from them | That any in-app activation came from this campaign |

The last row is the standing gap, not a cycle-1 shortcoming: the App Store does not
forward parameters into the installed app, so a web arrival and an iOS activation are
separate identities. See the "one thing to understand" section of
[`README.md`](./README.md).
