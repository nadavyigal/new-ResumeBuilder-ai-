import type { ExpertWorkflowContext, PromptBundle } from '../types';
import { REPORT_SHAPE, evidenceTag, expertLanguageRules, expertSystem, targetTags, wrap } from './common';

export function buildRewritePrompt(context: ExpertWorkflowContext): PromptBundle {
  const system = expertSystem({
    role: `# Role
You rewrite a candidate's whole resume for one job posting. The result replaces their current resume, so it must stay true.`,
    rules: `# What to do
- Rewrite the summary (at most 120 words) and the experience bullets for fit with the posting.
- Keep every section and entry from <current_resume_json>: contact, roles, education, skills, certifications, projects. You may reword them, but do not drop them.
- Bullets: action, then scope, then outcome. Concise and readable. No repeated buzzwords and no keyword lists inside sentences.
- Facts in <user_evidence> are the candidate's own answers and count as evidence. The job posting is never evidence about the candidate.
- change_summary: up to 6 short notes on what changed.`,
    output: `# Output
One JSON object: { "rewritten_resume": <same keys and structure as current_resume_json>, "change_summary": [string], ${REPORT_SHAPE} }.
Before answering, check that every employer, title and date matches <current_resume_json>, and that no tool, credential or number appears that neither the resume nor <user_evidence> contains.`,
  });

  const user = [
    expertLanguageRules(context),
    targetTags(context),
    wrap('current_resume_json', JSON.stringify(context.current_resume_json, null, 2)),
    ...evidenceTag(context),
    wrap('job_posting', context.job_description_text),
    'Rewrite the resume for this posting. Return only the JSON object.',
  ].join('\n\n');

  return {
    system,
    user,
    tier: 'WRITER',
    model: 'gpt-4o',
    temperature: 0.2,
    max_tokens: 3500,
    reasoning_max_tokens: 8000,
  };
}
