import type { ExpertWorkflowContext, PromptBundle } from '../types';

export function buildRewritePrompt(context: ExpertWorkflowContext): PromptBundle {
  const system = [
    'You are an expert resume rewriting assistant for ATS + recruiter readability.',
    'Never fabricate facts, metrics, dates, employers, titles, tools, or outcomes.',
    'If a metric is missing, keep the statement non-numeric and concrete.',
    'Every rewritten claim must be traceable to the current resume, job description, or explicit user evidence.',
    'Preserve all original resume sections and do not drop experience, education, contact, or skills data.',
    'Keep the summary under 120 words and avoid keyword stuffing or repeated buzzwords.',
    'Prioritize action-first, result-oriented bullets with STAR-like clarity.',
    'Keep output ATS-safe and professional.',
    'Write polished, concise report language for busy recruiters.',
    'Return ONLY valid JSON with this shape:',
    '{',
    '  "rewritten_resume": <full resume json>,',
    '  "change_summary": ["string"],',
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
    'Current Resume JSON:',
    JSON.stringify(context.current_resume_json, null, 2),
    '',
    'Job Description:',
    context.job_description_text,
    '',
    'Requirements:',
    '- Rewrite summary and experience bullets for role fit.',
    '- Use strong action verbs.',
    '- Embed relevant keywords naturally.',
    '- Keep content truthful and ATS-safe.',
    '- Preserve all original roles, companies, dates, education, and skills unless the source resume omits them.',
    '- Do not add new tools, credentials, industries, employers, degrees, or metrics unless present in the provided evidence.',
    '- Keep tone confident and readable without hype.',
    '- Return complete rewritten resume JSON (same overall schema).',
  ].join('\n');

  return {
    system,
    user,
    model: 'gpt-4o',
    temperature: 0.2,
    max_tokens: 3500,
  };
}
