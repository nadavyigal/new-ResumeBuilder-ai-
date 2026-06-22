import { extractSkillPhrases } from '@/lib/ats/extractors/skill-phrase-extractor';

const CAL_REQUIREMENTS = [
  'Develop, build, and lead strategic partnerships while identifying opportunities for market expansion and entry into new markets',
  'Conduct market research and analyze industry trends, competitive landscapes, and customer behavior',
  'Lead the identification, evaluation, and analysis of new business opportunities within the financial services sector',
  'Manage negotiations and close commercial agreements with strategic partners and potential key clients',
  'Lead cross-functional initiatives and support the execution of the growth strategy',
  '2-3 years of experience in Business Development, Strategy Consulting, or as a Commercial Lawyer',
  'Experience working with senior executives and key stakeholders',
  'Experience in the financial services industry and/or payments ecosystem',
];

describe('extractSkillPhrases', () => {
  const phrases = extractSkillPhrases(CAL_REQUIREMENTS);
  const lc = phrases.map((p) => p.toLowerCase());
  const has = (needle: string) => lc.some((p) => p.includes(needle));

  it('produces short keyword phrases, not whole sentences', () => {
    expect(phrases.length).toBeGreaterThan(8);
    expect(phrases.every((p) => p.split(' ').length <= 3)).toBe(true);
  });

  it('extracts the truthfully-addable BD/finance keywords', () => {
    expect(has('market research')).toBe(true);
    expect(has('strategic partnerships')).toBe(true);
    expect(has('financial services')).toBe(true);
    expect(has('negotiation')).toBe(true);
    expect(has('business development')).toBe(true);
    expect(has('stakeholders')).toBe(true);
  });

  it('drops leading action verbs and bare connectors', () => {
    expect(lc).not.toContain('develop');
    expect(lc).not.toContain('lead');
    expect(lc).not.toContain('and');
    expect(lc).not.toContain('the');
    expect(lc).not.toContain('');
  });
});
