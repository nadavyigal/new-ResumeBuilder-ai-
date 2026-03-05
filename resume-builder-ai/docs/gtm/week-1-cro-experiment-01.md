# CRO Experiment 01 (Week 1)

Experiment: Homepage hero framing + CTA hierarchy  
Window: 2026-02-18 to 2026-02-24 (minimum)  
Owner: Growth/Product

## Hypothesis
If we lead with the "free ATS check" outcome in the first screen and repeat the same CTA language consistently, then `Visitor -> ATS Check Started` and `ATS Check Completed -> Signup` will improve.

## Variant Structure
## Control
- Existing checker-first layout and current messaging.

## Variant A
- Hero subtext tightened to urgency + clarity.
- Primary CTA text: "Run Free ATS Check" in all top decision points.
- Secondary CTA de-emphasized.

## Success Metrics
1. Primary: `Visitor -> ATS Check Started`
2. Secondary: `ATS Check Completed -> Signup`
3. Guardrail: No decline in `Signup -> First Full Optimization`

## Instrumentation Checklist
1. Confirm `ats_checker_view`
2. Confirm `ats_checker_submitted`
3. Confirm `ats_checker_score_displayed`
4. Confirm `signup_started`
5. Confirm `signup_completed`

## Decision Rule
1. Promote variant if primary metric improves and guardrail holds.
2. Keep running if inconclusive and traffic is too low.
3. Revert if guardrail degrades.

## Notes Template
- Traffic split:
- Sample size:
- Primary delta:
- Secondary delta:
- Guardrail delta:
- Decision:
