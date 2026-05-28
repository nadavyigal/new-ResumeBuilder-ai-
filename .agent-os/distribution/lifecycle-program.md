# ResumeBuilder — Lifecycle Program

Use `distribution-os/workflows/08-lifecycle-email.md` to design new stages.

## Stages In Order

1. Welcome (account created)
2. Welcome 2 (didn't start a resume in 24h)
3. Activation hit (first export)
4. Activation missed (started but didn't export)
5. 7-day digest with job-tailoring tip
6. 14-day reactivation
7. Monthly job-seeker tip (low frequency, opt-in)
8. Pre-paid offer / credit-system reminder
9. Cancellation save

## Channels Per Stage

- Email: always
- In-app banner: stages 2, 4
- No push notifications (web-first product)

## Status Per Stage

- Welcome: <draft | live | not started>
- (Fill in)

## Measurement

- Open rate, click rate, downstream action per stage
- Effect on `resumebuilder.activation.first_resume_exported`, `resumebuilder.retention.returned_within_14_days`, `resumebuilder.revenue.paid_conversion_rate`
