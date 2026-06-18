import { skillMatchesResume, scoreSkillListMatch } from '@/lib/ats/skill-match';

describe('skill-match', () => {
  const resumeText = `
    Senior Software Engineer with 5 years of experience.
    Skills: Python, React, AWS, machine learning, Node.js
    Built scalable microservices on AWS using Python and React.
  `;

  it('matches full skill phrases via substring', () => {
    expect(skillMatchesResume('Python', resumeText)).toBe(true);
    expect(skillMatchesResume('machine learning', resumeText)).toBe(true);
    expect(skillMatchesResume('Node.js', resumeText)).toBe(true);
  });

  it('matches multi-word requirements when most tokens are present', () => {
    expect(skillMatchesResume('Experience with Python and AWS', resumeText)).toBe(true);
  });

  it('does not match unrelated skills', () => {
    expect(skillMatchesResume('COBOL', resumeText)).toBe(false);
  });

  it('scores skill lists proportionally', () => {
    const result = scoreSkillListMatch(['Python', 'React', 'COBOL'], resumeText);
    expect(result.matched).toEqual(['Python', 'React']);
    expect(result.missing).toEqual(['COBOL']);
    expect(result.score).toBeCloseTo(66.67, 1);
  });
});

describe('resolveAtsDisplay', () => {
  it('preserves zero scores instead of falling back', async () => {
    const { resolveAtsDisplay } = await import('@/lib/ats/resolve-display-scores');
    const resolved = resolveAtsDisplay({
      match_score: 82,
      ats_score_original: 0,
      ats_score_optimized: 82,
    });

    expect(resolved?.ats_score_original).toBe(0);
    expect(resolved?.ats_score_optimized).toBe(82);
  });
});
