import {
  skillMatchesResume,
  scoreSkillListMatch,
  skillCoverage,
  scoreSkillCoverage,
} from '@/lib/ats/skill-match';
import { buildJobDataFromExtractedJson } from '@/lib/ats/job-data-resolver';

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

  it('does not match short skill names inside longer words', () => {
    const resume = 'Senior JavaScript engineer building React applications';
    expect(skillMatchesResume('Java', resume)).toBe(false);
    expect(skillMatchesResume('JavaScript', resume)).toBe(true);
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

describe('skill coverage (proportional)', () => {
  const resume = `
    OPYO, Business Development Manager, Partnerships.
    Develop and nurture strategic partnerships across the financial ecosystem.
  `;

  it('returns 1 when every significant token is present', () => {
    expect(skillCoverage('strategic partnerships', resume)).toBe(1);
  });

  it('returns a partial fraction, not 0, for partly-covered phrases', () => {
    const c = skillCoverage('strategic partnerships financial ecosystem', resume);
    expect(c).toBeGreaterThan(0.5);
    expect(c).toBeLessThanOrEqual(1);
  });

  it('returns 0 when no significant token is present', () => {
    expect(skillCoverage('kubernetes autoscaling', resume)).toBe(0);
  });

  it('scores a list by average coverage and labels matched/missing', () => {
    const r = scoreSkillCoverage(['strategic partnerships', 'kubernetes autoscaling'], resume);
    expect(r.score).toBeGreaterThan(40);
    expect(r.score).toBeLessThan(60);
    expect(r.matched).toEqual(['strategic partnerships']);
    expect(r.missing).toEqual(['kubernetes autoscaling']);
  });
});

describe('buildJobDataFromExtractedJson atomizes must_have', () => {
  it('turns sentence requirements into short keyword phrases', () => {
    const jd = buildJobDataFromExtractedJson({
      job_title: 'Business Development Manager',
      company_name: 'Cal',
      requirements: [
        'Conduct market research and analyze industry trends',
        'Manage negotiations and close commercial agreements with strategic partners',
        'Experience in the financial services industry and payments ecosystem',
      ],
    });

    expect(jd.must_have.every((k) => k.split(' ').length <= 3)).toBe(true);
    const lc = jd.must_have.map((k) => k.toLowerCase());
    expect(lc.some((k) => k.includes('market research'))).toBe(true);
    expect(lc.some((k) => k.includes('financial services'))).toBe(true);
    expect(lc).not.toContain(
      'conduct market research and analyze industry trends',
    );
  });
});
