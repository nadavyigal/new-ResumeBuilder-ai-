# Canonical 90-Day GTM Plan (EN/HE)

Date: 2026-02-14  
Primary KPI: Visitor -> Signup  
Secondary KPIs: Visitor -> ATS Check, ATS Check -> Signup, Signup -> Paid

Detailed operating assets: `docs/gtm/execution-assets.md`

## North Star
- Position Resumely as a trust-first ATS optimization workflow for active job seekers.
- Use evidence-only claims. If proof is not verified in `docs/gtm/baseline-metrics.md`, do not publish numbers.
- Run one core growth loop: `Content/Social -> Free ATS Check -> Signup -> Full Optimization -> Referral/Share`.

## Messaging Architecture (Marketing Psychology Applied)
## Awareness (cold visitors)
- Core driver: uncertainty reduction.
- Message: "See how recruiter systems read your resume before you apply."
- Biases used: fluency (simple workflow), social proof (qualitative trust cues), loss aversion (missed opportunities from unclear resumes).

## Consideration (checker users)
- Core driver: clarity and control.
- Message: "Fix highest-impact blockers first."
- Biases used: goal-gradient (progressive reveal), Zeigarnik effect (unfinished improvement path), commitment consistency (save progress with signup).

## Decision (signup/paywall)
- Core driver: confidence and low risk.
- Message: "Upgrade when your application pace increases."
- Biases used: default effect (recommended premium), friction reduction, regret aversion (cancel anytime).

## Phase Plan (13 Weeks)
## Phase A (Weeks 1-3): Funnel Foundation
- Ship checker-first landing and EN/HE transcreated funnel copy.
- Launch localized pricing page and real Stripe checkout path.
- Fix locale-safe callback conversion handoff from ATS session to account.
- Lock baseline funnel instrumentation and QA event integrity.

## Phase B (Weeks 4-8): Conversion Engine
- Run weekly CRO experiments on hero/result/auth/paywall surfaces.
- Deploy one contextual popup only (capped frequency, clear dismiss).
- Launch 5-email welcome + nurture sequence (EN + HE variants).
- Publish bilingual weekly distribution cadence on LinkedIn, Reddit, X, and Hebrew communities.

## Phase C (Weeks 9-13): Distribution and Scale
- Expand SEO footprint with localized role/use-case content clusters.
- Publish 6-8 additional bilingual articles from validated pillar topics.
- Start minimal paid testing only after two consecutive weeks of clean measurement.
- Scale only channels with clear quality and conversion retention.

## Content Strategy (90 Days)
## Pillars
1. ATS diagnosis and correction
2. Role-specific resume rewrites
3. Interview conversion and application strategy
4. Workflow proof: before/after edit decisions

## Editorial Targets
- 8-12 bilingual articles (EN source + HE transcreation)
- 3-5 social posts per week per language
- 1 weekly newsletter in EN and HE
- 1 monthly proof asset (case walkthrough, anonymized)

## Programmatic SEO Architecture
- Route pattern: `/[locale]/blog/[slug]` with language-specific content files.
- Expansion pattern for scale (phase C): `role + goal` pages and `use-case + ATS` guides.
- Rule: each page must contain unique value, not variable swaps.

## CRO Backlog (Prioritized)
1. Hero framing and CTA hierarchy on home
2. ATS result lock screen copy and signup bridge
3. Auth form friction and callback continuity
4. Paywall value framing and CTA wording
5. Footer/newsletter and contextual popup trigger tuning

## Popup Spec (Single Experience Only)
- Trigger: user sees ATS results with locked issues and is still anonymous.
- Frequency cap: once per 7 days per browser.
- Primary CTA: create free account.
- Secondary CTA: dismiss.
- Events: `signup_popup_viewed`, `signup_popup_primary_clicked`, `signup_popup_dismissed`.

## Email Sequence (5 Emails)
1. Welcome + score-to-action bridge (send immediately)
2. "Fix first" guide with one quick win (Day 2)
3. Objection handling: "How ATS and recruiter review differ" (Day 4)
4. Proof-style walkthrough with concrete edit examples (Day 7)
5. Upgrade readiness email for active applicants (Day 10)

## Social Distribution Playbook (Weekly)
- EN: LinkedIn thought-leadership post, 2 tactical posts, 1 Reddit value post, 2 X threads/shorts.
- HE: LinkedIn Hebrew adaptation, community post, newsletter snippet, one tactical short-form post.
- Rule: every social unit maps to one funnel CTA (free ATS check).

## Operating Cadence
- Monday: KPI review, choose one primary experiment.
- Tuesday: implement copy/UI and tracking updates.
- Wednesday: ship content asset + schedule social.
- Thursday: distribute + engage + collect objections.
- Friday: evaluate lift, log learnings, set next test.

## Budget Model (90 Days)
- Paid test floor: $300 total
- Paid test cap: $1,500 total
- Channel spend limit per test wave: $150-$300
- Stop criteria: no quality lift after 2 iterations

## Go/No-Go Expansion Criteria
## Go if all are true for 2 consecutive weeks
- Visitor -> Signup improves against baseline.
- Signup -> First Optimization is stable or improving.
- Signup -> Paid does not degrade.

## No-Go if any are true
- Measurement quality is still unreliable.
- Lift is not repeatable after 3 tested iterations.
- Acquisition quality drops (low completion, weak retention intent).

## Source Mapping
This document supersedes fragmented plans from:
- `GTM-WEEK-1-IMPLEMENTATION-GUIDE.md`
- `VIRAL_GROWTH_ENGINE_PLAN.md`
- `LAUNCH_CHECKLIST.md`
- `PROMOTION_READINESS_STATUS.md`
