import type { RefineFlag, RefineSectionResponse } from '@/types/refine';

export interface ValidationResult {
  ok: boolean;
  flags: RefineFlag[];
  error?: string;
}

/**
 * Basic lexical guardrails to catch likely embellishments.
 * - Flags when new digits are introduced not present in source.
 * - Enforces maxChars when provided.
 */
export function validateRefineSuggestion(
  sourceText: string,
  suggestion: string,
  maxChars?: number
): ValidationResult {
  const flags: RefineFlag[] = [];

  if (!suggestion || suggestion.trim().length === 0) {
    return { ok: false, flags, error: 'Empty suggestion' };
  }

  if (maxChars && suggestion.length > maxChars) {
    flags.push('too_vague');
  }

  // If suggestion contains digits that are not in the source, flag as potential embellishment
  const srcDigits = new Set((sourceText.match(/\d+/g) || []));
  const sugDigits = new Set((suggestion.match(/\d+/g) || []));
  for (const d of sugDigits) {
    if (!srcDigits.has(d)) {
      flags.push('potential_embellishment');
      break;
    }
  }

  return { ok: true, flags };
}

export function coerceModelJson(raw: string): RefineSectionResponse | null {
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.suggestion === 'string' &&
      Array.isArray(parsed.keywordsApplied)
    ) {
      return parsed as RefineSectionResponse;
    }
  } catch {}
  return null;
}






