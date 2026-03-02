# Integration Plan: Automation-cowork -> Marketing Execution

This plan maps your existing automation engine to GTM execution tasks.

## Current Relevant Capabilities in Automation-cowork
1. FastAPI webhook entrypoints (`/api/webhook/*` pattern).
2. APScheduler-based recurring jobs.
3. PostgreSQL job persistence via SQLAlchemy models.
4. Run tracking (`automation_runs`) and failure handling.

## Add This New Automation
Path to implement in Automation-cowork:
`src/automations/marketing_distribution/`

Suggested files:
1. `scheduler.py` (daily/weekly triggers)
2. `ingest_assets.py` (read CSV/JSON from ResumeBuilder repo)
3. `publishers.py` (LinkedIn/X/Reddit/email connectors)
4. `storage.py` (persist marketing jobs)
5. `notifications.py` (send fail/success summaries)
6. `webhook.py` (manual trigger + rerun API)

## Data Contract (Input)
Primary input:
`docs/gtm/week-1-social-publishing-sheet.csv`

Expected columns:
1. `post_id`
2. `publish_date`
3. `locale`
4. `platform`
5. `account_target`
6. `post_copy`
7. `utm_url`
8. `status`

Optional input:
`docs/gtm/week-1-email-assets.md` (parsed into send templates).

## Minimal API Contract (Automation-cowork)
1. `POST /api/webhook/marketing/run-week`
Request:
```json
{
  "week_id": "week1_launch",
  "assets_repo": "https://github.com/nadavyigal/new-ResumeBuilder-ai-.git",
  "assets_branch": "version-2-marketing"
}
```
2. `POST /api/webhook/marketing/rerun-failed`
3. `GET /api/marketing/status?week_id=week1_launch`

## Suggested Job States
1. `pending`
2. `approved`
3. `scheduled`
4. `posted`
5. `failed`

## Daily Autonomous Loop
1. 08:00 pull latest GTM assets from git branch.
2. 08:05 parse CSV and create/update jobs.
3. 08:10 publish due posts.
4. 08:20 log run summary.
5. 08:25 send notification if failures exist.

## Failure Handling
1. If publish API fails:
   - retry once after 10 minutes.
   - mark failed and notify.
2. If CSV parse fails:
   - stop run, alert immediately.
3. If UTM link missing:
   - mark invalid, skip post, notify.

## KPI Feedback Hook
Add a nightly task in Automation-cowork that writes:
`docs/gtm/baseline-metrics.md` update payload (JSON snapshot) for Claude GTM review.

Suggested snapshot file:
`docs/gtm/metrics-snapshots/week-1.json`

## Implementation Priority
1. CSV ingestion + scheduler
2. LinkedIn + X publishing adapter
3. Notification + retry logic
4. Metrics snapshot writer
