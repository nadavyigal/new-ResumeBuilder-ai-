# Cycle 1 — `rb-li-20260910-trusted-workspace`

Seeded, not run. Paste these into [`experiment-card.html`](./experiment-card.html) and
work the six stages. Nothing here has been published and nothing has been measured.

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

**Pre-action baseline — NOT YET READ.** Run this in the Resumely iOS repo before
publishing and paste the headline plus the read timestamp into the card:

```bash
AGENTIC_OS_POSTHOG_API_KEY=… python3 scripts/measurement_contract.py
```

**Tracking status: `unverified`.** It becomes `verified` only after the destination link
above is opened end to end and `campaign_id` is observed on the arrival. Until then the
card blocks a real publication, and founder approval does not lift that block.

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
