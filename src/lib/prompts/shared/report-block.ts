/**
 * The "report" object every expert workflow returns. The model fills the
 * ats_impact_estimate numbers (founder decision 2026-11-23); they are shown
 * labelled as estimates. <current_match_score_estimate> anchors "before"
 * (founder decision D4, 2026-11-24).
 */
export const REPORT_BLOCK = `# The "report" object
- headline: one line on what this run produced.
- executive_summary: 2 or 3 sentences on what changed and why it fits the posting.
- priority_actions: up to 5 concrete next steps for the candidate.
- evidence_gaps: posting requirements the resume does not show, phrased as questions the candidate can answer.
- ats_impact_estimate: "before" and "after" are your rough estimates, 0 to 100, of how well the resume matches the posting before and after this run; "delta" is after minus before. If <current_match_score_estimate> holds a number, use it as "before". Use null for any value you cannot estimate. confidence_note: one short sentence saying these numbers are estimates and what they rest on.
# The top-level "missing_evidence" array
Facts the candidate could add to make this stronger, phrased as questions (for example "How many users did the app have?").`;

export const REPORT_SHAPE = `"report": { "headline": string, "executive_summary": string, "priority_actions": [string], "evidence_gaps": [string], "ats_impact_estimate": { "before": number|null, "after": number|null, "delta": number|null, "confidence_note": string } }, "missing_evidence": [string]`;

/** The app's current Match Score as an anchor tag; "unknown" when there is none. */
export function matchScoreAnchor(score: number | null | undefined): string {
  const value = typeof score === 'number' && Number.isFinite(score) ? `${Math.round(score)} (estimate)` : 'unknown';
  return `<current_match_score_estimate>${value}</current_match_score_estimate>`;
}
