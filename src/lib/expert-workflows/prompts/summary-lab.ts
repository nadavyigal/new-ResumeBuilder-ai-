import type { ExpertWorkflowContext, PromptBundle } from '../types';

export function buildSummaryLabPrompt(context: ExpertWorkflowContext): PromptBundle {
  const system = [
    'You are a professional summary specialist for resumes.',
    'Create concise, role-targeted summaries that are truthful and ATS-friendly.',
    'Never invent achievements or metrics.',
    'Return ONLY valid JSON with this shape:',
    '{',
    '  "summary_options": [',
    '    { "angle": "leadership|technical|results|industry|vision", "summary": "string", "rationale": "string" }',
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
    'Provide exactly 5 summary options.',
  ].join('\n');

  const user = [
    `Target Role: ${context.job_title}`,
    `Target Company: ${context.job_company}`,
    '',
    'Current resume summary:',
    context.current_resume_json?.summary || '',
    '',
    'Top experience bullets (for evidence):',
    JSON.stringify(
      (context.current_resume_json?.experience || []).slice(0, 3).map((exp) => ({
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
    temperature: 0.3,
    max_tokens: 1800,
  };
}
