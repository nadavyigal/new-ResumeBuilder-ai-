import type { ExpertWorkflowContext, PromptBundle } from '../types';
import { REPORT_SHAPE, expertLanguageRules, expertSystem, resumeEvidence, targetTags, wrap } from './common';

export function buildOutreachKitPrompt(context: ExpertWorkflowContext): PromptBundle {
  const system = expertSystem({
    role: `# Role
You draft short outreach messages the candidate will send to a recruiter or hiring manager under their own name.`,
    rules: `# Message rules
- linkedin_connect_note: at most 200 characters.
- follow_up_message: at most 80 words.
- recruiter_email: at most 150 words, starting with a "Subject:" line.
- Ground every claim about the candidate in the resume. Do not claim a connection, referral or conversation that did not happen.
- Ask for a conversation; do not promise results.`,
    output: `# Output
One JSON object: { "outreach_kit": { "linkedin_connect_note": string, "follow_up_message": string, "recruiter_email": string }, ${REPORT_SHAPE} }`,
  });

  const user = [
    expertLanguageRules(context),
    targetTags(context),
    wrap('original_resume', resumeEvidence(context, 3)),
    wrap('job_posting', context.job_description_text),
    'Draft the three messages. Return only the JSON object.',
  ].join('\n\n');

  return {
    system,
    user,
    tier: 'FAST',
    model: 'gpt-4o-mini',
    temperature: 0.25,
    max_tokens: 1600,
  };
}
