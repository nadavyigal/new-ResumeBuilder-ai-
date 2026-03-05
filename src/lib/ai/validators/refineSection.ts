import type { RefineFlag } from '@/types/refine';

type ParsedRefineSuggestion = {
  suggestion?: unknown;
  keywordsApplied?: unknown;
  rationale?: unknown;
};

export function coerceModelJson(raw: string): ParsedRefineSuggestion | null {
  if (!raw) return null;
  const trimmed = raw.trim();

  const tryParse = (value: string) => {
    try {
      return JSON.parse(value) as ParsedRefineSuggestion;
    } catch {
      return null;
    }
  };

  const direct = tryParse(trimmed);
  if (direct) return direct;

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const slice = trimmed.slice(firstBrace, lastBrace + 1);
    const parsed = tryParse(slice);
    if (parsed) return parsed;
  }

  return null;
}

export function validateRefineSuggestion(
  original: string,
  suggestion: string,
  maxChars?: number
): { flags: RefineFlag[] } {
  const flags: RefineFlag[] = [];
  const originalText = (original || '').trim();
  const suggestionText = (suggestion || '').trim();

  if (!suggestionText || suggestionText.length < Math.max(12, Math.floor(originalText.length * 0.4))) {
    flags.push('too_vague');
  }

  if (maxChars && suggestionText.length > maxChars) {
    flags.push('too_vague');
  }

  const originalNumbers = originalText.match(/\d+/g) || [];
  const suggestionNumbers = suggestionText.match(/\d+/g) || [];
  if (suggestionNumbers.length > 0 && originalNumbers.length === 0) {
    flags.push('potential_embellishment');
  }

  return { flags };
}

