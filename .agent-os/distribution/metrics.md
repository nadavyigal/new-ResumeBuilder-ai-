# ResumeBuilder — Metrics

Update during the weekly cycle.
Last synced from: `distribution-context.md` + `distribution-os/projects/resumebuilder.md` (2026-05-28)

## North Star Metrics

- **First resume exported** (primary activation): user exports a tailored resume within first session
- **Return within 14 days** (primary retention): user returns to tailor for a second application
- **Hebrew conversion share** (secondary): percentage of activations from Hebrew-locale users

Tracking status: `not tracked` — analytics instrumentation not yet confirmed for iOS app.

## Current Snapshot (week of YYYY-MM-DD)

| Metric | This week | Prior week | Delta | Status | Note |
|---|---|---|---|---|---|
| `resumebuilder.acquisition.app_store_impressions` | | | | not tracked | App Store Connect — pull manually |
| `resumebuilder.acquisition.app_store_install_rate` | | | | not tracked | App Store Connect — pull manually |
| `resumebuilder.acquisition.organic_search_impressions` | | | | unknown | Search Console |
| `resumebuilder.acquisition.organic_search_clicks` | | | | unknown | Search Console |
| `resumebuilder.acquisition.indexed_pages` | | | | unknown | Search Console |
| `resumebuilder.acquisition.directory_referrals` | | | | not tracked | needs UTM on directory links |
| `resumebuilder.activation.first_resume_started` | | | | not tracked | needs PostHog event |
| `resumebuilder.activation.first_resume_exported` | | | | not tracked | primary north star |
| `resumebuilder.activation.signup_to_export_median` | | | | not tracked | |
| `resumebuilder.retention.returned_within_14_days` | | | | not tracked | primary north star |
| `resumebuilder.retention.hebrew_share` | | | | not tracked | secondary |
| `resumebuilder.revenue.paid_conversion_rate` | | | | not tracked | activate when paid tier ships |
| `resumebuilder.revenue.mrr` | | | | not tracked | activate when paid tier ships |

## Key Conversion Events (to instrument)

1. `app_opened` — first open
2. `onboarding_completed`
3. `resume_started` — first resume created
4. `job_posting_pasted` — user pastes a job posting to tailor against
5. `resume_exported` — PDF or DOCX exported (primary activation)
6. `app_returned` — return after 7+ day gap

## Top SEO Queries

| Query | Clicks | Impressions | Position |
|---|---|---|---|
| | | | |

## Top Pages (organic)

| Page | Clicks | Impressions |
|---|---|---|
| | | |

## Anomalies This Week

- (none) / list
