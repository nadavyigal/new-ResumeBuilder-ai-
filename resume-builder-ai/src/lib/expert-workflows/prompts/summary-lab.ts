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
    '  "missing_evidence": ["string"],',
    '  "report": {',
    '    "headline": "one-line summary (e.g. 5 summary options generated for Senior Engineer at Acme)",',
    '    "executive_summary": "2-3 sentences on which angle is strongest and why, plus what additional context would improve all options",',
    '    "priority_actions": ["action to strengthen the chosen summary further"],',
    '    "evidence_gaps": ["achievement or context that would make the summary more compelling"],',
    '    "ats_impact_estimate": { "before": null, "after": null, "delta": null, "confidence_note": "Summary improvements affect keyword placement and first-impression score" }',
    '  }',
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
    max_tokens: 2200,
  };
}
