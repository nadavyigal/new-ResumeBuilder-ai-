import type { ExpertWorkflowContext, PromptBundle } from '../types';
import { REPORT_SHAPE, expertLanguageRules, expertSystem, resumeEvidence, targetTags, wrap } from './common';

export function buildStoryBankPrompt(context: ExpertWorkflowContext): PromptBundle {
  const system = expertSystem({
    role: `# Role
You turn resume evidence into STAR interview stories (situation, task, action, result) the candidate can tell.`,
    rules: `# Story rules
- At least 3 stories, each with a distinct theme relevant to the posting.
- Every part of a story comes from the resume. If the resume states no result for a story, set "result" to "" and add a question to missing_evidence asking for it.
- Keep each part to one or two sentences.`,
    output: `# Output
One JSON object: { "story_bank": [ { "theme": string, "situation": string, "task": string, "action": string, "result": string } ], ${REPORT_SHAPE} }`,
  });

  const user = [
    expertLanguageRules(context),
    targetTags(context),
    wrap('original_resume', resumeEvidence(context, 5, false)),
    wrap('job_posting', context.job_description_text),
    'Write the stories. Return only the JSON object.',
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
