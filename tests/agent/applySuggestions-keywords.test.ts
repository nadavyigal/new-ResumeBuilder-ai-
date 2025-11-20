import { describe, it, expect } from '@jest/globals';
import { applySuggestions } from '@/lib/agent/applySuggestions';
import type { OptimizedResume } from '@/lib/ai-optimizer';
import type { Suggestion } from '@/lib/ats/types';

const baseResume: OptimizedResume = {
  summary: '',
  contact: { name: '', email: '', phone: '', location: '' },
  skills: { technical: [], soft: [] },
  experience: [],
  education: [],
  matchScore: 0,
  keyImprovements: [],
  missingKeywords: [],
};

describe('applySuggestions keyword extraction for acronyms', () => {
  it('skips bare generic acronyms without context', async () => {
    const suggestions: Suggestion[] = [
      {
        id: '1',
        text: 'Add API to your skills section.',
        estimated_gain: 1,
        quick_win: false,
        targets: [],
        category: 'keywords',
      },
    ];

    const result = await applySuggestions(baseResume, suggestions);
    expect(result.skills.technical).toHaveLength(0);
  });

  it('captures contextual multi-word API skills', async () => {
    const suggestions: Suggestion[] = [
      {
        id: '2',
        text: 'Add REST API integrations to your technical skills.',
        estimated_gain: 1,
        quick_win: true,
        targets: [],
        category: 'keywords',
      },
    ];

    const result = await applySuggestions(baseResume, suggestions);
    expect(result.skills.technical).toContain('REST API integrations');
  });

  it('enriches other generic acronyms with nearby context', async () => {
    const suggestions: Suggestion[] = [
      {
        id: '3',
        text: 'Consider adding GraphQL APIs and SQL query optimization to skills.',
        estimated_gain: 1,
        quick_win: true,
        targets: [],
        category: 'keywords',
      },
    ];

    const result = await applySuggestions(baseResume, suggestions);
    expect(result.skills.technical).toEqual(
      expect.arrayContaining(['GraphQL APIs', 'SQL query optimization'])
    );
  });
});
