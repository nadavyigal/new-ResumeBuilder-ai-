import { describe, it, expect } from '@jest/globals';
import { ResumeWriter } from '@/lib/agent/tools/resume-writer';
import { ProposedChangeCategory } from '@/lib/agent/types';

const base = {
  summary: 'Experienced dev at Acme',
  contact: { name: '', email: '', phone: '', location: '' },
  skills: { technical: [], soft: [] },
  experience: [
    { title: 'Engineer', company: 'Acme', location: '', startDate: '', endDate: '', achievements: ['Built API'] },
  ],
  education: [],
  matchScore: 0,
  keyImprovements: [],
  missingKeywords: [],
};

describe('ResumeWriter.applyDiff', () => {
  it('replaces paragraph content in summary', () => {
    const res = ResumeWriter.applyDiff(base as any, [{ scope: 'paragraph', before: 'Experienced dev', after: 'Senior developer' }]);
    expect(res.summary).toContain('Senior developer');
  });

  it('applies proposed change using JSON pointer', () => {
    const change = {
      id: 'chg-1',
      summary: 'Update summary',
      scope: 'paragraph',
      category: ProposedChangeCategory.Content,
      confidence: 'medium',
      before: base.summary,
      after: 'Experienced dev with measurable outcomes',
      metadata: { pointer: '/summary' },
    } as any;
    const res = ResumeWriter.applyProposedChanges(base as any, [change]);
    expect(res.summary).toContain('measurable');
  });
});

