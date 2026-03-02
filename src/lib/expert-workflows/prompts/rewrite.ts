import type { ExpertWorkflowContext, PromptBundle } from '../types';

export function buildRewritePrompt(context: ExpertWorkflowContext): PromptBundle {
  const system = [
    'You are an expert resume rewriting assistant for ATS + recruiter readability.',
    'Never fabricate facts, metrics, dates, employers, titles, tools, or outcomes.',
    'If a metric is missing, keep the statement non-numeric and concrete.',
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
