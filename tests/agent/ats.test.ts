import { describe, it, expect } from '@jest/globals';
import { ATS } from '@/lib/agent/tools/ats';

const resume = {
  summary: 'React and TypeScript developer',
  contact: { name: '', email: '', phone: '', location: '' },
  skills: { technical: ['React', 'TypeScript'], soft: [] },
  experience: [
    { title: 'Engineer', company: 'X', location: '', startDate: '', endDate: '', achievements: ['Built React apps'] },
  ],
  education: [],
  matchScore: 0,
  keyImprovements: [],
  missingKeywords: [],
};

describe('ATS.score', () => {
  it('returns a numeric score and recommendations', () => {
    const rep = ATS.score({ resume_json: resume as any, job_text: 'Looking for React and GraphQL experience' });
    expect(typeof rep.score).toBe('number');
    expect(Array.isArray(rep.missing_keywords)).toBe(true);
  });
});

