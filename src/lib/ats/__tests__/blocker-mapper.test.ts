import { mapSuggestionsToBlockers } from '../blocker-mapper';
import type { Suggestion } from '../types';

describe('mapSuggestionsToBlockers', () => {
  it('maps a Suggestion into the iOS ATSOptimizationBlocker shape', () => {
    const suggestions: Suggestion[] = [
      {
        id: 'keyword_exact:market-research',
        text: 'Add "market research" in context',
        estimated_gain: 6,
        targets: ['keyword_exact'],
        quick_win: true,
        category: 'keywords',
        action: {
          type: 'add_keyword',
          params: { keywords: ['market research'], target: 'experience', source: 'must_have' },
        },
      },
    ];

    const blockers = mapSuggestionsToBlockers(suggestions);

    expect(blockers).toEqual([
      {
        id: 'keyword_exact:market-research',
        category: 'keywords',
        title: 'Add "market research" in context',
        detail: 'Add "market research" in context',
        suggested_action: 'Add "market research" in context',
        estimated_gain: 6,
        severity: 'medium',
      },
    ]);
  });

  it('derives severity from estimated_gain (>=10 high, >=5 medium, else low)', () => {
    const make = (gain: number): Suggestion => ({
      id: `s-${gain}`,
      text: 'x',
      estimated_gain: gain,
      targets: ['keyword_exact'],
      quick_win: false,
      category: 'keywords',
    });

    const blockers = mapSuggestionsToBlockers([make(12), make(7), make(2)]);

    expect(blockers.map((b) => b.severity)).toEqual(['high', 'medium', 'low']);
  });

  it('returns an empty array for an empty or undefined suggestion list', () => {
    expect(mapSuggestionsToBlockers([])).toEqual([]);
    expect(mapSuggestionsToBlockers(undefined)).toEqual([]);
  });
});
