import type { ExpertWorkflowContext, PromptBundle } from '../types';
import { REPORT_SHAPE, evidenceTag, expertLanguageRules, expertSystem, resumeEvidence, targetTags, wrap } from './common';

export function buildCoverLetterPrompt(context: ExpertWorkflowContext): PromptBundle {
  const system = expertSystem({
    role: `# Role
You write three cover-letter drafts the candidate will send to an employer under their own name.`,
    rules: `# Letter rules
- 3 to 5 short paragraphs. Plain text with no placeholders. If no hiring manager is named, greet the hiring team ("Dear Hiring Team"; in Hebrew "לכבוד צוות הגיוס").
- Claims about the candidate come only from the resume and <user_evidence>. Claims about the company come only from the job posting.
- Do not invent the candidate's motivation, values or personal story. If you need a motivation line, write a neutral sentence about interest in the work the posting describes.
- Write in the first person as the candidate. Avoid stock phrases ("I am writing to express my interest", "perfect fit", "hit the ground running").
- Close with availability to talk (in Hebrew, end with "בברכה" and the candidate's name). Do not claim certainty about getting the job or about the value the candidate will deliver.

# Variants
Exactly 3, one per angle: "concise" (about 180 words), "narrative" (career story, about 300 words), "impact" (the 2 or 3 strongest results, about 250 words). Each rationale names the resume evidence it uses. recommended_index is 0, 1 or 2.`,
    output: `# Output
One JSON object: { "cover_letter_variants": [ { "angle": "concise" | "narrative" | "impact", "title": string, "opening_paragraph": string, "letter": string, "rationale": string } ], "recommended_index": number, "recommended_reason": string, ${REPORT_SHAPE} }`,
  });

  const user = [
    expertLanguageRules(context),
    targetTags(context),
    wrap('original_resume', resumeEvidence(context, 4)),
    ...evidenceTag(context),
    wrap('job_posting', context.job_description_text),
    'Write the three letters. Return only the JSON object.',
  ].join('\n\n');

  return {
    system,
    user,
    tier: 'WRITER',
    model: 'gpt-4o',
    temperature: 0.25,
    max_tokens: 2600,
    reasoning_max_tokens: 6000,
  };
}
