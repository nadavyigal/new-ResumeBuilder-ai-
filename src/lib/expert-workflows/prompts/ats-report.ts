import type { ExpertWorkflowContext, PromptBundle } from '../types';

export function buildATSReportPrompt(context: ExpertWorkflowContext): PromptBundle {
  const system = [
    'You are an ATS optimization analyst.',
    'You must produce practical ATS-focused guidance without exaggeration.',
    'Do not claim certainty about proprietary ATS internals.',
    'Return ONLY valid JSON with this shape:',
    '{',
    '  "ats_report": {',
    '    "keyword_match_analysis": [',
    '      {',
    '        "keyword": "string",',
    '        "present": boolean,',
    '        "suggested_placement": "summary|skills|experience|education",',
    '        "note": "string"',
    '      }',
    '    ],',
    '    "section_heading_compliance": ["string"],',
    '    "format_guidance": ["string"],',
    '    "acronym_coverage": ["string"],',
    '    "score_estimate": {"before": number|null, "after": number|null},',
    '    "recommended_keywords_to_add": ["string"]',
    '  },',
    '  "missing_evidence": ["string"]',
    '}',
  ].join('\n');

  const beforeScore = context.current_ats_score_optimized ?? context.current_ats_score_original;

  const user = [
    `Target Role: ${context.job_title}`,
    `Current ATS score estimate baseline: ${beforeScore ?? 'unknown'}`,
    '',
    'Current Resume JSON:',
    JSON.stringify(context.current_resume_json, null, 2),
    '',
    'Job Description:',
    context.job_description_text,
    '',
    'Generate a recruiter-readable ATS optimization report with concrete actions.',
  ].join('\n');

  return {
    system,
    user,
    model: 'gpt-4o-mini',
    temperature: 0.15,
    max_tokens: 2200,
  };
}
