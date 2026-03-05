import type { ExpertWorkflowContext, PromptBundle } from '../types';

export function buildStoryBankPrompt(context: ExpertWorkflowContext): PromptBundle {
  const system = [
    'You are an interview story coach.',
    'Generate STAR-style stories from resume evidence with no fabrication.',
    'Return ONLY valid JSON with this shape:',
    '{',
    '  "story_bank": [',
    '    {',
    '      "theme": "string",',
    '      "situation": "string",',
    '      "task": "string",',
    '      "action": "string",',
    '      "result": "string"',
    '    }',
    '  ],',
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
    'Provide at least 3 stories with distinct themes.',
  ].join('\n');

  const user = [
    `Target Role: ${context.job_title}`,
    `Target Company: ${context.job_company}`,
    '',
    'Top resume evidence:',
    JSON.stringify(
      (context.current_resume_json?.experience || []).slice(0, 5).map((exp) => ({
        title: exp.title,
        company: exp.company,
        achievements: (exp.achievements || []).slice(0, 4),
      })),
      null,
      2
    ),
    '',
    'Job Description:',
    context.job_description_text,
  ].join('\n');

  return {
    system,
    user,
    model: 'gpt-4o-mini',
    temperature: 0.2,
    max_tokens: 2200,
  };
}
