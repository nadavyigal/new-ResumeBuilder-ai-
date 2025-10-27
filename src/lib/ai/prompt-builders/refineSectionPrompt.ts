import type { RefineSectionRequest } from '@/types/refine';

interface BuildPromptParams {
  req: RefineSectionRequest;
  nearbyContext?: string; // optional surrounding bullets/lines
}

export function buildRefineSectionPrompt({ req, nearbyContext }: BuildPromptParams) {
  const system = `You are a resume rewriting assistant.
- Rephrase only the provided text.
- Do not invent achievements, titles, or metrics that are not present.
- Use professional, ATS-friendly phrasing aligned to the job description if provided.
- Keep facts and scope truthful; preserve seniority and responsibilities.
- Return strictly a JSON object with keys: suggestion, keywordsApplied, rationale.`;

  const user = [
    `Selection Field: ${req.selection.field}\nSection Id: ${req.selection.sectionId}`,
    req.constraints?.maxChars ? `Max Characters: ${req.constraints.maxChars}` : null,
    req.constraints?.tone ? `Tone: ${req.constraints.tone}` : null,
    `Instruction: ${req.instruction}`,
    `Selected Text:\n"""\n${req.selection.text}\n"""`,
    nearbyContext ? `Nearby Context:\n${nearbyContext}` : null,
    req.jobDescription ? `Job Description (optional):\n${req.jobDescription}` : null,
    `Respond ONLY with a JSON object: {"suggestion": string, "keywordsApplied": string[], "rationale": string}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  return {
    system,
    user,
  };
}






