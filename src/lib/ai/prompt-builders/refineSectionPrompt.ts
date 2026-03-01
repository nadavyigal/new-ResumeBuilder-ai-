import type { RefineSectionRequest } from '@/types/refine';

interface RefineSectionPromptInput {
  req: RefineSectionRequest;
}

export function buildRefineSectionPrompt({ req }: RefineSectionPromptInput) {
  const { selection, instruction, jobDescription, constraints } = req;

  const toneLine = constraints?.tone ? `Tone: ${constraints.tone}` : 'Tone: professional';
  const maxCharsLine = constraints?.maxChars
    ? `MaxChars: ${constraints.maxChars}`
    : 'MaxChars: none';

  const system = [
    'You are a professional resume editor.',
    'Improve the selected text based on the user instruction and keep it truthful.',
    'Do not invent facts, metrics, titles, or tools that are not in the selected text or instruction.',
    'Use the same language as the selected text.',
    'Return ONLY valid JSON with keys: suggestion, keywordsApplied, rationale.',
    'suggestion must be the edited text only (no extra commentary).',
    'keywordsApplied must be an array of strings (may be empty).',
    'rationale should be one short sentence explaining the change.',
  ].join('\n');

  const user = [
    `SelectedText: """${selection.text}"""`,
    `Field: ${selection.field}`,
    `SectionId: ${selection.sectionId}`,
    `Instruction: ${instruction}`,
    toneLine,
    maxCharsLine,
    jobDescription ? `JobDescription: """${jobDescription}"""` : 'JobDescription: none',
    'Output JSON only.',
  ].join('\n');

  return { system, user };
}

