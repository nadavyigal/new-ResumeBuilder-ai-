# Autonomous Marketing Workflow (Claude GTM + Automation-cowork)

Date: 2026-02-15  
Goal: run Week 1 and future GTM cycles with minimal manual effort.

## System Roles
1. `ResumeBuilder AI repo` (this repo): source of truth for messaging, assets, publishable content, KPIs.
2. `Claude Project: GTM`: strategy brain and weekly planner.
3. `Automation-cowork repo`: execution engine (scheduler, webhook APIs, run tracking).

## Recommended Operating Model
## Layer 1: Planning (Claude GTM)
1. Every Friday: generate next-week campaign plan from `docs/gtm/canonical-90-day-plan.md`.
2. Output files:
   - `docs/gtm/week-N-launch-plan.md`
   - `docs/gtm/week-N-social-copy-pack.md`
   - `docs/gtm/week-N-social-publishing-sheet.csv`
   - `docs/gtm/week-N-email-assets.md`
3. Commit and push to `version-2-marketing`.

## Layer 2: Orchestration (Automation-cowork)
1. Add a new automation module: `src/automations/marketing_distribution/`.
2. Ingest CSV/JSON assets from this repo on a schedule.
3. Queue posts and email sends in DB-backed jobs.
4. Push status + errors to notifications.

## Layer 3: Human Approval (Minimal)
1. One daily review window (10-15 min):
   - approve scheduled posts
   - approve newsletter send
   - resolve failed tasks
2. No manual rewriting unless performance requires it.

## Workflow Diagram (Logical)
1. Claude GTM writes weekly assets -> Git push
2. Automation-cowork pulls latest assets -> creates job queue
3. Scheduler executes social/email tasks
4. Results ingested from analytics -> baseline metrics updated
5. Claude GTM reads results -> next experiment + next week assets

## Source of Truth Files
1. Strategy: `docs/gtm/canonical-90-day-plan.md`
2. Weekly operations: `docs/gtm/week-1-launch-plan.md`
3. Social queue: `docs/gtm/week-1-social-publishing-sheet.csv`
4. Email copy: `docs/gtm/week-1-email-assets.md`
5. KPI baseline: `docs/gtm/baseline-metrics.md`

## Automation Guardrails
1. Never publish numeric claims not marked verified.
2. Never post if locale copy fails quality checks.
3. Retry failed post/send once, then escalate.
4. Keep one popup flow only (no overlapping campaign popups).

## What Should Stay Manual
1. First two weeks of channel engagement replies.
2. Any controversial messaging.
3. Budget expansion decisions.
