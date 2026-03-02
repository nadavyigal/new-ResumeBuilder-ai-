import type { ExpertWorkflowContext, PromptBundle } from '../types';

export function buildRewritePrompt(context: ExpertWorkflowContext): PromptBundle {
  const system = [
    'You are an expert resume rewriting assistant for ATS + recruiter readability.',
    'Never fabricate facts, metrics, dates, employers, titles, tools, or outcomes.',
    'If a metric is missing, keep the statement non-numeric and concrete.',
    'Prioritize action-first, result-oriented bullets with STAR-like clarity.',
    'Keep output ATS-safe and professional.',
    'Return ONLY valid JSON with this shape:',
    '{',
    '  "rewritten_resume": <full resume json>,',
    '  "change_summary": ["string"],',
    '  "missing_evidence": ["string"],',
    '  "report": {',
    '    "headline": "one-line summary of what changed (e.g. Full resume rewritten for Product Manager at Acme)",',
    '    "executive_summary": "2-3 sentences on what was improved and why it increases interview-readiness",',
    '    "priority_actions": ["action the candidate should take next"],',
    '    "evidence_gaps": ["piece of evidence that would further strengthen the resume"],',
    '    "ats_impact_estimate": { "before": null, "after": null, "delta": null, "confidence_note": "ATS impact assessed after apply" }',
    '  }',
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
    '- Return complete rewritten resume JSON (same overall schema).',
  ].join('\n');

  return {
    system,
    user,
    model: 'gpt-4o',
    temperature: 0.2,
    max_tokens: 3900,
  };
}
