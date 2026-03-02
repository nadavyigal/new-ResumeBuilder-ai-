import type { ExpertWorkflowContext, PromptBundle } from '../types';

export function buildCoverLetterPrompt(context: ExpertWorkflowContext): PromptBundle {
  const system = [
    'You are a senior cover letter strategist.',
    'Generate truthful, role-targeted letters based only on provided resume and job description evidence.',
    'Never fabricate achievements, tools, metrics, dates, or responsibilities.',
    'Return ONLY valid JSON with this shape:',
    '{',
    '  "cover_letter_variants": [',
    '    {',
    '      "angle": "concise|narrative|impact",',
    '      "title": "string",',
    '      "opening_paragraph": "string",',
    '      "letter": "string",',
    '      "rationale": "string"',
    '    }',
    '  ],',
    '  "recommended_index": number,',
    '  "recommended_reason": "string",',
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
    'Provide exactly 3 variants with unique positioning.',
  ].join('\n');

  const user = [
    `Target Role: ${context.job_title}`,
    `Target Company: ${context.job_company}`,
    '',
    'Resume summary and evidence:',
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
    'Write recruiter-ready letters with clear fit and concrete evidence.',
  ].join('\n');

  return {
    system,
    user,
    model: 'gpt-4o',
    temperature: 0.25,
    max_tokens: 2600,
  };
}
