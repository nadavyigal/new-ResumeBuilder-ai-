import type { ExpertWorkflowContext, PromptBundle } from '../types';
import { REPORT_SHAPE, expertLanguageRules, expertSystem, targetTags, wrap } from './common';

export function buildATSReportPrompt(context: ExpertWorkflowContext): PromptBundle {
  const system = expertSystem({
    role: `# Role
You write an ATS keyword report for one resume and one job posting. It tells the candidate which posting terms their resume already shows, where to place them, and what to check.`,
    rules: `# Report rules
- Recommend only keywords that are in the job posting and that the resume truthfully supports. A posting term the resume does not support goes to evidence_gaps as a question, never to recommended_keywords_to_add.
- recommended_keywords_to_add: unique, at most 20.
- Every keyword_match_analysis row says where the keyword already appears or where it should go. suggested_placement is "summary", "skills", "experience" or "education".
- Do not claim certainty about how any specific applicant tracking system works internally.
- Prefer natural placement in the summary, skills or relevant bullets. No keyword stuffing.
- score_estimate: your rough estimate, 0 to 100, of the match before and after the recommended changes. If <current_match_score_estimate> holds a number, use it as "before". Use null when you cannot estimate.`,
    output: `# Output
One JSON object: { "ats_report": { "keyword_match_analysis": [ { "keyword": string, "present": boolean, "suggested_placement": "summary" | "skills" | "experience" | "education", "note": string } ], "section_heading_compliance": [string], "format_guidance": [string], "acronym_coverage": [string], "score_estimate": { "before": number|null, "after": number|null }, "recommended_keywords_to_add": [string] }, ${REPORT_SHAPE} }`,
  });

  const user = [
    expertLanguageRules(context),
    targetTags(context),
    wrap('current_resume_json', JSON.stringify(context.current_resume_json, null, 2)),
    wrap('job_posting', context.job_description_text),
    'Write the report. Return only the JSON object.',
  ].join('\n\n');

  return {
    system,
    user,
    tier: 'FAST',
    model: 'gpt-4o-mini',
    temperature: 0.15,
    max_tokens: 2200,
  };
}
