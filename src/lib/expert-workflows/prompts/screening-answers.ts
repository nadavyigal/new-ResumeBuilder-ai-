import type { ExpertWorkflowContext, PromptBundle } from '../types';

export function buildScreeningAnswersPrompt(context: ExpertWorkflowContext): PromptBundle {
  const system = [
    'You are an interview screening answer coach.',
    'Create concise, truthful answers to common screening questions for this role.',
    'Never invent missing facts. If evidence is weak, keep claims conservative and note confidence.',
    'Return ONLY valid JSON with this shape:',
    '{',
    '  "screening_answers": [',
    '    {',
    '      "question": "string",',
    '      "answer": "string",',
    '      "evidence_used": ["string"],',
    '      "confidence_note": "string"',
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
    'Provide at least 5 question-answer pairs.',
  ].join('\n');

  const user = [
    `Target Role: ${context.job_title}`,
    `Target Company: ${context.job_company}`,
    '',
    'Resume evidence:',
    JSON.stringify(
      {
        summary: context.current_resume_json?.summary || '',
        skills: context.current_resume_json?.skills || {},
        experience: (context.current_resume_json?.experience || []).slice(0, 4).map((exp) => ({
          title: exp.title,
          company: exp.company,
          achievements: (exp.achievements || []).slice(0, 4),
        })),
      },
      null,
      2
    ),
    '',
    'Job Description:',
    context.job_description_text,
    '',
    'Prioritize common screening topics: role fit, impact, collaboration, tools, motivation, logistics.',
  ].join('\n');

  return {
    system,
    user,
    model: 'gpt-4o-mini',
    temperature: 0.2,
    max_tokens: 2200,
  };
}
