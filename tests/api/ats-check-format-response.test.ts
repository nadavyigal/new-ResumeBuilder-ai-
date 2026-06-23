import { buildPublicAtsCheckResponse } from '@/lib/ats/public-ats-check-response';
import type { JobExtraction } from '@/lib/ats/types';

const jobData: JobExtraction = {
  title: 'Partnership Manager',
  must_have: [
    'market research',
    'strategic partnerships',
    'payment platforms',
    'senior executives',
  ],
  nice_to_have: [],
  responsibilities: [],
};

const scoreRow = {
  ats_score: 74,
  created_at: '2026-06-23T10:00:00.000Z',
  ats_suggestions: [
    { id: 'one', text: 'First issue' },
    { id: 'two', text: 'Second issue' },
    { id: 'three', text: 'Third issue' },
    { id: 'four', text: 'Fourth issue' },
  ],
  ats_quick_wins: [
    {
      id: 'qw-1',
      original_text: 'Built partnerships.',
      optimized_text: 'Built strategic partnerships informed by market research.',
      improvement_type: 'keyword_insertion',
      estimated_impact: 5,
      location: { section: 'experience' },
      rationale: 'Adds truthful role language.',
      keywords_added: ['strategic partnerships'],
    },
  ],
};

describe('formatResponse', () => {
  it('adds the fit block with verdict, score note, top gaps, and missing keywords', () => {
    const response = buildPublicAtsCheckResponse(scoreRow, 'session-1', 3, {
      resumeText: 'I led market research for partner expansion.',
      jobData,
      jobDescription: 'Partnership role requiring market research and payment platforms.',
    });

    expect(response.fit).toEqual({
      verdict: 'Stretch',
      scoreNote: 'Estimated fit vs this job, not a hiring guarantee.',
      topGaps: ['strategic partnerships', 'payment platforms', 'senior executives'],
      missingKeywords: ['strategic partnerships', 'payment platforms', 'senior executives'],
    });
  });

  it('keeps the pre-existing response fields unchanged outside the additive fit block', () => {
    const response = buildPublicAtsCheckResponse(scoreRow, 'session-1', 3, {
      resumeText: 'I led market research for partner expansion.',
      jobData,
      jobDescription: 'Partnership role requiring market research and payment platforms.',
    });
    const { fit, ...legacyResponse } = response;

    expect(fit).toBeDefined();
    expect(legacyResponse).toEqual({
      success: true,
      sessionId: 'session-1',
      score: {
        overall: 74,
        timestamp: '2026-06-23T10:00:00.000Z',
      },
      preview: {
        topIssues: scoreRow.ats_suggestions.slice(0, 3),
        totalIssues: 4,
        lockedCount: 1,
      },
      quickWins: scoreRow.ats_quick_wins,
      checksRemaining: 3,
    });
  });

  it.each([
    [75, 'Strong'],
    [50, 'Stretch'],
    [49, 'Skip'],
  ])('maps score %i to the locked %s fit verdict', (atsScore, verdict) => {
    const response = buildPublicAtsCheckResponse({ ...scoreRow, ats_score: atsScore }, 'session-1', 3);

    expect(response.fit.verdict).toBe(verdict);
    expect(response.fit.topGaps).toEqual([]);
    expect(response.fit.missingKeywords).toEqual([]);
  });
});
