import type { ExpertWorkflowContext, PromptBundle } from '../types';
import { REPORT_SHAPE, evidenceTag, expertLanguageRules, expertSystem, resumeEvidence, targetTags, wrap } from './common';

export function buildScreeningAnswersPrompt(context: ExpertWorkflowContext): PromptBundle {
  const system = expertSystem({
    role: `# Role
You draft answers to common screening questions for one role. The candidate edits them before using them.`,
    rules: `# Answer rules
- At least 5 question-answer pairs covering role fit, impact, collaboration, tools, motivation and logistics.
- Answers use only resume evidence. Every answer has evidence_used entries from the resume, or a confidence_note explaining that evidence is thin.
- For salary, work authorization, relocation, notice period, availability and personal motivation, write the answer as a template with [brackets] for the candidate to fill in. Never guess these facts.
- Keep answers concise and interview-ready. No keyword stuffing.`,
    output: `# Output
One JSON object: { "screening_answers": [ { "question": string, "answer": string, "evidence_used": [string], "confidence_note": string } ], ${REPORT_SHAPE} }`,
  });

  const user = [
    expertLanguageRules(context),
    targetTags(context),
    wrap('original_resume', resumeEvidence(context, 4)),
    ...evidenceTag(context),
    wrap('job_posting', context.job_description_text),
    'Draft the screening answers. Return only the JSON object.',
  ].join('\n\n');

  return {
    system,
    user,
    tier: 'FAST',
    model: 'gpt-4o-mini',
    temperature: 0.2,
    max_tokens: 2200,
  };
}
