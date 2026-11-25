import type { ExpertWorkflowContext, PromptBundle } from '../types';
import { REPORT_SHAPE, expertLanguageRules, expertSystem, resumeEvidence, targetTags, wrap } from './common';

export function buildSummaryLabPrompt(context: ExpertWorkflowContext): PromptBundle {
  const system = expertSystem({
    role: `# Role
You write five professional-summary options for one candidate and one job posting.`,
    rules: `# Summary rules
- Exactly 5 options, one per angle, each under 80 words, with no repeated keywords or hype phrases:
  - "leadership": how the candidate has led people, projects or decisions, as the resume states it;
  - "technical": the tools and methods the resume shows;
  - "results": the candidate's strongest stated outcomes;
  - "industry": the domains and industries the candidate has worked in;
  - "vision": what the candidate wants to do next, framed as a goal, tied to the posting.
- Describe the candidate by titles they have held. The target role may appear only as a goal.
- Each rationale names the resume evidence or role-fit reason for that option.
- recommended_index is 0 to 4; recommended_reason says why.`,
    output: `# Output
One JSON object: { "summary_options": [ { "angle": "leadership" | "technical" | "results" | "industry" | "vision", "summary": string, "rationale": string } ], "recommended_index": number, "recommended_reason": string, ${REPORT_SHAPE} }`,
  });

  const user = [
    expertLanguageRules(context),
    targetTags(context),
    wrap('original_resume', resumeEvidence(context, 3, false)),
    wrap('job_posting', context.job_description_text),
    'Write the five summary options. Return only the JSON object.',
  ].join('\n\n');

  return {
    system,
    user,
    tier: 'FAST',
    model: 'gpt-4o-mini',
    temperature: 0.3,
    max_tokens: 1800,
  };
}
