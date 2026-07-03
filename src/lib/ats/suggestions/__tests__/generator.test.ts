import { generateSuggestions } from '../generator';
import type { AnalyzerResult, SubScores } from '../../types';

const LOW_SUBSCORES: SubScores = {
  keyword_exact: 30,
  keyword_phrase: 70,
  semantic_relevance: 70,
  format_parseability: 90,
  title_alignment: 80,
  metrics_presence: 80,
  section_completeness: 90,
  recency_fit: 90,
};

function keywordAnalyzerResult(missing: string[]): AnalyzerResult {
  return {
    score: 30,
    evidence: {
      missing,
      mustHaveTotal: missing.length * 2,
      mustHaveMatched: missing.length,
    },
    confidence: 1,
    warnings: [],
  };
}

describe('generateSuggestions - keyword_exact fan-out', () => {
  it('emits one suggestion per missing must-have keyword, not bundled duplicates', () => {
    const suggestions = generateSuggestions({
      subscores: LOW_SUBSCORES,
      analyzerResults: new Map([
        ['keyword_exact', keywordAnalyzerResult([
          'market research',
          'led negotiations',
          'partnership strategy',
        ])],
      ]),
      jobData: {
        title: 'Head of Partnerships',
        company: '',
        must_have: ['market research', 'led negotiations', 'partnership strategy'],
        nice_to_have: [],
        responsibilities: [],
        seniority: 'senior',
        location: '',
        industry: '',
      },
    });

    const keywordSuggestions = suggestions.filter((s) => s.action?.type === 'add_keyword');

    expect(keywordSuggestions).toHaveLength(3);
    keywordSuggestions.forEach((suggestion) => {
      expect(suggestion.action?.type).toBe('add_keyword');
      if (suggestion.action?.type === 'add_keyword') {
        expect(suggestion.action.params.keywords).toHaveLength(1);
      }
    });

    const keywordTexts = keywordSuggestions.map((suggestion) =>
      suggestion.action?.type === 'add_keyword' ? suggestion.action.params.keywords[0] : ''
    );
    expect(keywordTexts.sort()).toEqual(
      ['led negotiations', 'market research', 'partnership strategy'].sort()
    );
  });

  it('gives each split keyword suggestion a unique, stable id', () => {
    const suggestions = generateSuggestions({
      subscores: LOW_SUBSCORES,
      analyzerResults: new Map([
        ['keyword_exact', keywordAnalyzerResult(['market research', 'led negotiations'])],
      ]),
      jobData: {
        title: 'Head of Partnerships',
        company: '',
        must_have: ['market research', 'led negotiations'],
        nice_to_have: [],
        responsibilities: [],
        seniority: 'senior',
        location: '',
        industry: '',
      },
    });

    const ids = suggestions.filter((s) => s.action?.type === 'add_keyword').map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(id).toMatch(/^keyword_exact:/));
  });

  it('filters hiring boilerplate out of public keyword suggestions', () => {
    const suggestions = generateSuggestions({
      subscores: LOW_SUBSCORES,
      analyzerResults: new Map([
        ['keyword_exact', keywordAnalyzerResult(['are hiring a', 'strategic partnerships'])],
      ]),
      jobData: {
        title: 'Partnership Manager',
        company: '',
        must_have: ['are hiring a', 'strategic partnerships'],
        nice_to_have: [],
        responsibilities: ['We are hiring a partnership manager to build strategic partnerships.'],
        seniority: 'mid',
        location: '',
        industry: '',
      },
    });

    const keywordTexts = suggestions.flatMap((suggestion) =>
      suggestion.action?.type === 'add_keyword' ? suggestion.action.params.keywords : []
    );

    expect(keywordTexts).toContain('strategic partnerships');
    expect(keywordTexts).not.toContain('are hiring a');
    expect(suggestions.map((suggestion) => suggestion.text.toLowerCase()).join(' '))
      .not.toContain('are hiring a');
  });
});