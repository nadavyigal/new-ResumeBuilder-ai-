# Cycle 1 prompts, week of 2026-10-14

Campaign `rb-li-20260910-trusted-workspace`. Four steps, in order. Written 2026-10-14 by
Claude Code under founder decisions D2 (no "asks before it adds" claim in Hebrew) and D3 (run
cycle 1 with the marketing advisor).

| Step | Who | When |
|---|---|---|
| 1. Adapt the post | Marketing advisor (paste prompt 1) | Today |
| 2. Baseline and tracking check | Claude Code (paste prompt 2) | Before posting |
| 3. Post | Founder (checklist 3) | When steps 1 and 2 are green |
| 4. Readout | Claude Code (paste prompt 4) | 7 days after the post |

---

## Prompt 1: to the marketing advisor

```
Packet
From: founder (via Claude Code)
assigned_to: growth-communications
Date: 2026-10-14, Asia/Jerusalem
Directive in force: 2026-10-14 (expires 2026-10-23)
Project: Resumely, growth-loop cycle 1, campaign rb-li-20260910-trusted-workspace
Requested outcome: one Hebrew LinkedIn post, ready for the founder to publish, filed as one outbox PR

TASK
1. Read directive/CURRENT.md. If it is not on main or has expired, stop and report that.
2. Read registry/marketing-contract.md in full. Every field in section 4 is required.
3. Start from post 2 of the Builder OS vault note
   02-Products/ResumeBuilder/2026-08-16-resumely-linkedin-posts.md ("סיבות להשתמש ב-Resumely").
   Adapt it. Do not rewrite it from zero.
4. Remove reason 3 ("הטקסט נשאר שלך ... מאושרות על ידך") and renumber to three reasons.
   Founder decision D2, 2026-10-14: no claim that the app asks before it adds, or that the user
   approves each edit, in Hebrew or on iOS, until that feature runs there.
5. Check reason 4 ("ייצוא PDF ומכתב מקדים") against the live App Store listing, read with a
   varying cb. If the listing does not show cover letters, cut that part.
6. Keep the closing line about not promising to pass any filter. It is the point of the post.
7. Positioning: "fit my CV to this job". Not "a Hebrew CV builder".
8. The post body carries no link. The founder puts this link in the first comment:
   https://resumelybuilderai.com/he/ats-checker?utm_source=linkedin&utm_medium=social&utm_campaign=rb-li-20260910-trusted-workspace&utm_content=he_li_trusted_01
   Return it unchanged. Do not shorten it or rebuild it.
9. Channel: the founder's personal LinkedIn profile. If you cannot check it, write
   "channel unverified" and continue.
10. Self-check against the contract's claim rules. Mark any claim with no source BLOCKED.
11. File as outbox/2026-10-DD-growth-communications-rb-cycle-01-post.md, handoff-packet format,
    one PR, ready for review, not draft.

HARD LIMITS
- Do not publish, post, schedule, reply, DM or email. Do not sign in to any account.
- No testimonials, user counts, ratings, prices, outcome promises ("למצוא עבודה", "לעבור סינון").
- No claim absent from the iOS repo's .agents/product-marketing.md.
- Research is public pages only. No signups, no made-up identities, no disposable emails.
- The PR is the only delivery.

Expires after 2026-10-23, with the directive.
```

Starting draft the advisor adapts (post 2, reason 3 removed, nothing else changed):

```
בניתי את Resumely כי נמאס לי להתאים קורות חיים ידנית ולא לדעת אם זה שינה משהו.

שלוש סיבות להשתמש בו, בלי הבטחות שאי אפשר לקיים:

1. לדעת לפני שמגישים
לפני שאתה משקיע שעתיים, אתה רואה ציון התאמה למשרה ומה חסר בפועל. אם זה לא מתאים — חסכת את הזמן.

2. הפערים מנוסחים כמשימות
לא "הציון שלך 62". אלא: אילו מילים מקצועיות מהמודעה לא מופיעות אצלך, ומה כדאי לחדד.

3. הכל מהטלפון
העלאה, בדיקה, התאמה, ייצוא PDF ומכתב מקדים — בלי לפתוח מחשב.

מה שאין שם בכוונה: הבטחה שתעברו סינון כלשהו. אף אפליקציה לא יכולה להבטיח את זה, ומי שמבטיח — מוכר לכם משהו אחר.

מה הכי מעצבן אתכם בתהליך ההגשה היום?
```

---

## Prompt 2: to Claude Code, before posting

Open in `~/Developer/ResumeBuilder/ResumeBuilder IOS APP` and paste:

```
Growth-loop cycle 1, campaign rb-li-20260910-trusted-workspace, pre-publish checks.
Read docs/gtm/growth-loop/README.md and cycle-01.md in the web repo
(~/Developer/ResumeBuilder/new-ResumeBuilder-ai-) first.

1. Baseline: run AGENTIC_OS_POSTHOG_API_KEY=… python3 scripts/measurement_contract.py in this
   repo. Paste the headline and the read timestamp verbatim. Do not add --write.
2. Tracking: open this link in the browser, end to end:
   https://resumelybuilderai.com/he/ats-checker?utm_source=linkedin&utm_medium=social&utm_campaign=rb-li-20260910-trusted-workspace&utm_content=he_li_trusted_01
   Click the App Store button. Then confirm in PostHog (web project, read-only) that the arrival
   carries campaign_id = rb-li-20260910-trusted-workspace and that campaign_store_handoff fired
   with the same id. Exclude this test arrival from any later count and say how.
   Before any PostHog read, run the explicit switch-project and fingerprint check.
3. Write both results into stage 2 of docs/gtm/growth-loop/cycle-01.md on a branch, set
   tracking to verified only if step 2 showed the id, commit, push, open a PR.
4. Report: baseline headline, tracking verified yes or no, PR link.

Must not: estimate a count, quote a rate below n=10, post anything, change any event meaning.
```

---

## Checklist 3: founder posts

1. Prompt 1's PR is reviewed and merged. Prompt 2 reports tracking **verified**.
2. Post the final Hebrew text from your personal LinkedIn profile.
3. Put the tracked link as the first comment, exactly as given.
4. Reply to every comment within an hour on day one.
5. Send Claude Code the post URL and the time you posted. That starts the 7-day clock.

---

## Prompt 4: to Claude Code, 7 days after the post

Open in `~/Developer/ResumeBuilder/new-ResumeBuilder-ai-` and paste (fill the two blanks):

```
Growth-loop cycle 1 readout, campaign rb-li-20260910-trusted-workspace.
Post URL: ____  Posted at: ____ (Asia/Jerusalem)
Read docs/gtm/growth-loop/README.md and cycle-01.md first.

1. Confirm 168 hours have passed since the post. If not, report "not yet measurable" and stop.
2. PostHog, web project, read-only, after the switch-project and fingerprint check: count
   arrivals with campaign_id = rb-li-20260910-trusted-workspace and campaign_store_handoff events
   with the same id. Exclude the founder, QA accounts and the step-2 test arrival.
3. Re-run the iOS measurement contract (scripts/measurement_contract.py in the iOS repo) and paste
   its headline verbatim. Do not join it to the campaign: the App Store does not carry the id.
4. Count replies on the post (founder pastes them if you cannot read LinkedIn).
5. Fill stages 5 and 6 of cycle-01.md: one of the card's four states, never a partial figure.
   Decision against the rules: 50+ arrivals a week is on track for the gate; under 10 is strike 1
   of 3 toward changing channel.
6. Append the four-line row to Agentic OS distribution-os/experiment-log.md.
7. Branch, commit, push, PR. Report the numbers and the decision in three lines.

Must not: estimate, round, or quote a rate below n=10; present an activation count next to the
campaign id as if one caused the other.
```
