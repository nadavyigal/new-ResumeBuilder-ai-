import type { RefineSectionRequest } from '@/types/refine';
import { CONTENT_RULES, DATA_NOTICE, wrap } from '@/lib/prompts/shared';

interface RefineSectionPromptInput {
  req: RefineSectionRequest;
}

export const REFINE_SECTION_SYSTEM_PROMPT = `# Role
You are a professional resume editor. You improve one selected passage of the candidate's resume, following their instruction.

${DATA_NOTICE}

# Rules
- Keep it true: do not add facts, numbers, titles or tools that are not in <selected_text> or <instruction>.
- Use the job posting only to choose wording for what the passage already says, never as evidence about the candidate.
- Write in the same language as <selected_text>.
- keywordsApplied lists only terms that are already in <selected_text> or <instruction> and that appear in your suggestion; it may be empty.

${CONTENT_RULES}

# Output
One JSON object: { "suggestion": string (the edited text only, no commentary), "keywordsApplied": [string], "rationale": string (one short sentence explaining the change) }`;

export function buildRefineSectionPrompt({ req }: RefineSectionPromptInput) {
  const { selection, instruction, jobDescription, constraints } = req;

  const tone = constraints?.tone ? constraints.tone : 'professional';
  const maxChars = constraints?.maxChars ? `${constraints.maxChars}` : 'none';

  const user = [
    `Field: ${selection.field}`,
    `SectionId: ${selection.sectionId}`,
    `Tone: ${tone}`,
    `MaxChars: ${maxChars}`,
    wrap('selected_text', selection.text),
    wrap('instruction', instruction),
    wrap('job_posting', jobDescription || 'none'),
    'Return only the JSON object.',
  ].join('\n\n');

  return { system: REFINE_SECTION_SYSTEM_PROMPT, user };
}
