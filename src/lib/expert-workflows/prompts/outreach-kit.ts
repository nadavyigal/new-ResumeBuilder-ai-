import type { ExpertWorkflowContext, PromptBundle } from '../types';

export function buildOutreachKitPrompt(context: ExpertWorkflowContext): PromptBundle {
  const system = [
    'You are a recruiter outreach writing assistant.',
    'Generate concise, professional outreach drafts grounded in resume evidence.',
    'Never fabricate claims or relationships.',
    'Return ONLY valid JSON with this shape:',
    '{',
    '  "outreach_kit": {',
    '    "linkedin_connect_note": "string",',
    '    "follow_up_message": "string",',
    '    "recruiter_email": "string"',
    '  },',
    '  "report": {',
    '    "headline": "string",',
    '    "executive_summary": "string",',
    '    "priority_actions": ["string"],',
    '    "evidence_gaps": ["string"],',
    '    "ats_impact_estimate": {',
    '      "before": number|null,',
    '      "after": number|null,',
    '      "delta": number|null,',
    '      "confidence_note": "string"',
    '    }',
    '  },',
    '  "missing_evidence": ["string"]',
    '}',
  ].join('\n');

  const user = [
    `Target Role: ${context.job_title}`,
    `Target Company: ${context.job_company}`,
    '',
    'Resume summary:',
    context.current_resume_json?.summary || '',
    '',
    'Job Description:',
    context.job_description_text,
  ].join('\n');

  return {
    system,
    user,
    model: 'gpt-4o-mini',
    temperature: 0.25,
    max_tokens: 1600,
  };
}
