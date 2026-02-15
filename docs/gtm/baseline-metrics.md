# Baseline Metrics Snapshot

Date: 2026-02-14  
Owner: Growth / Product  
Source systems: PostHog, GA4, application database

## Purpose
This snapshot defines the baseline used for the 90-day GTM plan.  
Do not publish numeric marketing claims unless they are documented here and marked verified.

## KPI Ladder
1. Visitor -> ATS Check Started
2. ATS Check Started -> ATS Check Completed
3. ATS Check Completed -> Signup
4. Signup -> First Full Optimization
5. Signup -> Paid Upgrade

## Current Baseline (fill with validated dashboard exports)
| Metric | Current | Window | Source | Verified |
|---|---:|---|---|---|
| Unique visitors | TBD | last 28 days | GA4 | No |
| ATS check starts | TBD | last 28 days | PostHog event `ats_checker_submitted` | No |
| ATS check completions | TBD | last 28 days | PostHog event `ats_checker_score_displayed` | No |
| Visitor -> Signup CVR | TBD | last 28 days | PostHog + auth events | No |
| Signup -> First optimization CVR | TBD | last 28 days | app events | No |
| Signup -> Paid CVR | TBD | last 28 days | billing + app events | No |

## Tracking Gaps
- Confirm event taxonomy consistency across EN/HE flows.
- Confirm no duplicate pageview capture.
- Confirm pricing and checkout events are emitted for all paths.
- Confirm callback conversion events include locale and source context.

## Evidence Checklist
- Screenshot/export attached from PostHog funnels.
- Screenshot/export attached from GA4 traffic reports.
- Query or report for paid conversions.
- Date + owner + method documented for each metric.

## Claim Publication Rules
- Numeric claims are allowed only when `Verified = Yes`.
- Any claim older than 30 days requires re-validation.
- If evidence is missing or stale, use qualitative messaging.
