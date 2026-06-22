import type { Suggestion } from './types';

export interface ATSBlockerDTO {
  id: string;
  category: string;
  title: string;
  detail: string;
  suggested_action: string;
  estimated_gain: number;
  severity: 'high' | 'medium' | 'low';
}

function severityFromGain(gain: number): 'high' | 'medium' | 'low' {
  if (gain >= 10) return 'high';
  if (gain >= 5) return 'medium';
  return 'low';
}

export function mapSuggestionsToBlockers(
  suggestions: Suggestion[] | undefined | null,
): ATSBlockerDTO[] {
  if (!suggestions || suggestions.length === 0) {
    return [];
  }

  return suggestions.map((suggestion) => ({
    id: suggestion.id,
    category: suggestion.category,
    title: suggestion.text,
    detail: suggestion.text,
    suggested_action: suggestion.text,
    estimated_gain: suggestion.estimated_gain,
    severity: severityFromGain(suggestion.estimated_gain),
  }));
}
