---
type: gtm-plan
product: ResumeBuilder iOS
version: v0.1
inherited_from: distribution-context.md + distribution-os/projects/resumebuilder.md
status: draft
created: 2026-05-28
last_updated: 2026-05-28
owner: founder
---

# GTM Plan — ResumeBuilder iOS

Last synced from: `distribution-context.md` + `distribution-os/projects/resumebuilder.md` (2026-05-28)
Full install (with web GTM inheritance): run `distribution-os/prompts/install-resumebuilder-ios.md` in a separate session.

## 1. One-Line Positioning

ResumeBuilder AI helps you build and tailor a resume that passes ATS scans and reads like a confident professional — without sounding like a robot.

## 2. Audience Segments

See `audience.md` for full segment details. Summary:
- Primary: active English-speaking job seeker (mobile-first, applies during commute)
- Secondary: career switcher; polisher for a specific high-stakes role
- Tertiary: Hebrew-speaking job seeker in the Israeli market

## 3. Job To Be Done

> "Help me tailor my resume to this role so I get the interview, and don't lose my voice doing it."

iOS version: "Paste the posting, tailor in minutes, export from your phone."

## 4. Before / After

Before: rewriting the same resume against every job posting, juggling Word docs, second-guessing wording, fearing ATS rejection.

After: a job-tailored output, an ATS-aware score, polished templates that actually parse, and confidence that what's submitted reflects the real candidate.

## 7. Pricing

- iOS pricing model: <fill — confirm in-app purchase, subscription, or credit system>
- Web pricing model: <fill — confirm current web plan>
- Cross-platform restore: <fill — does iOS purchase unlock web access?>
- Hebrew / Israeli market: pricing in USD or ILS? <fill>
- Open question: does iOS offer a free tier with limited exports?

## 8. Channels (iOS-First; Priority Order)

| Priority | Channel | Tier | Current Status |
|---|---|---|---|
| 1 | App Store Optimization | A | not started |
| 2 | Web landing pages with App Store CTA | A | not started |
| 3 | Free ATS / resume scoring tool (web → app) | A | not started |
| 4 | Directory submissions (with App Store URL) | A | not started |
| 5 | Lifecycle email (post-install) | A | not started |
| 6 | Conversion optimization (app onboarding + web) | A | not started |
| 7 | Hebrew market (ASO + landing) | A | not started |
| 8 | Programmatic SEO with App Store CTA | B | not started |
| 9 | Career coach + HR partnerships | B | not started |
| 10 | LinkedIn job-seeker content | C | not started |

## 9. Acquisition Funnel

Web channels (SEO / directories / free tool / programmatic pages)
  → web landing (mobile-detect → App Store CTA on iOS)
    → App Store listing
      → install
        → first resume started → exported → returned

`at=` / `ct=` attribution parameters: <fill — confirm wired or not>

## 10. Activation Funnel

Install → onboarding → paste job posting → tailored resume draft → export PDF

## 11. Retention Funnel

- First export: "Resume exported — here's a tailoring tip" (email)
- 14-day return: re-tailor for next application
- Hebrew cohort: locale-specific lifecycle

## 13. Launch Model

- App Store status: <fill — pre-submission / TestFlight / live>
- Hebrew ASO: authored Hebrew metadata in scope; timing TBD
- iOS launch campaign: on major version ships only

## 15. Risks And Mitigations

| Risk | Why it matters | Mitigation |
|---|---|---|
| ATS claim not defensible on iOS | App Store review risk + user trust | Only claim ATS-aware where parser behavior is verified; add "not a guarantee" disclaimer |
| Hebrew iOS PDF RTL broken | Damages Hebrew market trust | Confirm RTL PDF export before publishing Hebrew metadata |
| iOS vs web pricing divergence | User confusion, refund requests | Define cross-platform restore policy before paid tier launches |
| Low-quality AI output on first tailoring | Kills activation | QA output quality on real job postings before ASO launch |
| Resume Library backend not yet live | Limits iOS feature set | Ship with available features; flag mock flag status |

## 16. Open Questions

- App Store status: pre-submission, TestFlight, or live?
- iOS pricing model: IAP subscription, credits, or free?
- Cross-platform restore: does iOS purchase unlock web access?
- Hebrew on iOS: separate App Store locale or one listing with multiple locales? RTL PDF working end-to-end?
- ATS parser parity: does iOS run the same parser as web, or a subset?
- Free ATS tool: lives on web today or planned? Result page points to App Store install?
- Apple Search Ads: explicitly out of scope until organic ASO proves — confirm.
- `at=` / `ct=` attribution wired on web-to-App-Store CTAs?

## 17. Decision Log

- 2026-05-28: GTM plan v0.1 scaffolded from distribution-context.md and resumebuilder.md; full inheritance from web GTM is a follow-up session using install-resumebuilder-ios.md
