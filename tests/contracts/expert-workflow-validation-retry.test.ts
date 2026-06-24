import { describe, it, expect, jest } from '@jest/globals';
import {
  generateValidatedOutput,
  withValidationCorrection,
} from '@/lib/expert-workflows/orchestrator';
import type { PromptBundle } from '@/lib/expert-workflows/types';

const basePrompt: PromptBundle = {
  system: 'system prompt',
  user: 'generate the cover letter',
  model: 'gpt-4o',
  temperature: 0.25,
  max_tokens: 100,
};

function reportEnvelope() {
  return {
    report: {
      headline: 'headline',
      executive_summary: 'summary',
      priority_actions: [],
      evidence_gaps: [],
      ats_impact_estimate: { before: 50, after: 60 },
    },
  };
}

function coverLetterVariant() {
  return {
    angle: 'leadership',
    title: 'Cover Letter',
    opening_paragraph: 'Dear hiring manager,',
    letter: 'Full letter body that is sufficiently long.',
    rationale: 'Why this angle fits.',
  };
}

function validCoverLetterOutput() {
  return {
    ...reportEnvelope(),
    cover_letter_variants: [coverLetterVariant(), coverLetterVariant(), coverLetterVariant()],
    recommended_index: 0,
    recommended_reason: 'Best balance of fit and tone.',
  };
}

// LLM variance: returns only 2 variants instead of the required exactly-3.
function invalidCoverLetterOutput() {
  return {
    ...reportEnvelope(),
    cover_letter_variants: [coverLetterVariant(), coverLetterVariant()],
    recommended_index: 0,
    recommended_reason: 'Best balance of fit and tone.',
  };
}

describe('generateValidatedOutput — regenerates on schema-validation failure', () => {
  it('retries when the first model output fails validation, then returns the valid output', async () => {
    const generate = jest
      .fn<(p: PromptBundle) => Promise<Record<string, unknown>>>()
      .mockResolvedValueOnce(invalidCoverLetterOutput())
      .mockResolvedValueOnce(validCoverLetterOutput());

    const { output, validation } = await generateValidatedOutput(
      'cover_letter_architect',
      basePrompt,
      generate
    );

    expect(validation.valid).toBe(true);
    expect((output.cover_letter_variants as unknown[]).length).toBe(3);
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('feeds the validation error back into the prompt on the retry attempt', async () => {
    const generate = jest
      .fn<(p: PromptBundle) => Promise<Record<string, unknown>>>()
      .mockResolvedValueOnce(invalidCoverLetterOutput())
      .mockResolvedValueOnce(validCoverLetterOutput());

    await generateValidatedOutput('cover_letter_architect', basePrompt, generate);

    const secondPrompt = generate.mock.calls[1][0];
    expect(secondPrompt.user).toContain(basePrompt.user);
    expect(secondPrompt.user).toContain('exactly 3 variants');
  });

  it('does not retry when the first output is already valid', async () => {
    const generate = jest
      .fn<(p: PromptBundle) => Promise<Record<string, unknown>>>()
      .mockResolvedValueOnce(validCoverLetterOutput());

    const { validation } = await generateValidatedOutput(
      'cover_letter_architect',
      basePrompt,
      generate
    );

    expect(validation.valid).toBe(true);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('throws the last validation error after exhausting all attempts', async () => {
    const generate = jest
      .fn<(p: PromptBundle) => Promise<Record<string, unknown>>>()
      .mockResolvedValue(invalidCoverLetterOutput());

    await expect(
      generateValidatedOutput('cover_letter_architect', basePrompt, generate, 3)
    ).rejects.toThrow('exactly 3 variants');
    expect(generate).toHaveBeenCalledTimes(3);
  });
});

describe('withValidationCorrection', () => {
  it('preserves the original prompt and appends the corrective error', () => {
    const corrected = withValidationCorrection(basePrompt, 'cover_letter_variants must include exactly 3 variants');
    expect(corrected.user).toContain(basePrompt.user);
    expect(corrected.user).toContain('exactly 3 variants');
    expect(corrected.system).toBe(basePrompt.system);
    expect(corrected.model).toBe(basePrompt.model);
  });
});
