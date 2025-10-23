import { describe, it, expect } from '@jest/globals';
import { SkillsMiner } from '@/lib/agent/tools/skills-miner';

describe('SkillsMiner.extract', () => {
  it('returns unique keywords from resume and job text', () => {
    const resume = {
      summary: 'Built GraphQL APIs and React apps',
      contact: { name: '', email: '', phone: '', location: '' },
      skills: { technical: ['React', 'GraphQL'], soft: [] },
      experience: [],
      education: [],
      matchScore: 0,
      keyImprovements: [],
      missingKeywords: [],
    };
    const out = SkillsMiner.extract({ resume_json: resume as any, job_text: 'Experience with React and GraphQL' });
    expect(Array.isArray(out)).toBe(true);
    expect(new Set(out).size).toBe(out.length);
  });
});

