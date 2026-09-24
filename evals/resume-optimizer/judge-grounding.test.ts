import { describe, it, expect } from '@jest/globals';
import { manifest } from './manifest';
import { calibration } from './calibration';
import { parseGroundingVerdict, buildGroundingPrompt, judgeView, JudgeInvalidError } from './judge-grounding';

const c = manifest.find((m) => m.id === 'no-cloud-cert')!;
const resume = calibration.find((x) => x.id === 'cal-01-honest-no-cloud-cert')!.resume;

const valid = {
  requirements: c.requirements.map((r) => ({ id: r.id, ruling: r.support === 'evidenced' ? 'evidenced' : 'not-evidenced' })),
  unsupportedStatements: [],
  honestGapPreserved: true,
};

describe('grounded judge parsing (offline)', () => {
  it('accepts a complete, well-formed verdict', () => {
    const v = parseGroundingVerdict(JSON.stringify(valid), c);
    expect(v.requirements).toHaveLength(c.requirements.length);
    expect(v.honestGapPreserved).toBe(true);
  });

  const invalid: Array<[string, unknown]> = [
    ['non-JSON', 'not json'],
    ['a missing requirement', { ...valid, requirements: valid.requirements.slice(1) }],
    ['an unknown ruling', { ...valid, requirements: [{ id: 'r1', ruling: 'maybe' }, ...valid.requirements.slice(1)] }],
    ['an unknown category', { ...valid, unsupportedStatements: [{ quote: 'x', category: 'vibes' }] }],
    ['a string boolean', { ...valid, honestGapPreserved: 'true' }],
  ];
  for (const [label, body] of invalid) {
    it(`treats ${label} as an invalid evaluation, never a pass`, () => {
      const content = typeof body === 'string' ? body : JSON.stringify(body);
      expect(() => parseGroundingVerdict(content, c)).toThrow(JudgeInvalidError);
    });
  }

  it("never shows the judge the producer's own commentary", () => {
    const view = judgeView(resume) as Record<string, unknown>;
    expect(view).not.toHaveProperty('keyImprovements');
    expect(view).not.toHaveProperty('missingKeywords');
    expect(view).not.toHaveProperty('matchScore');
    const prompt = buildGroundingPrompt(c, resume);
    expect(prompt).not.toContain('Clarified API ownership');
    expect(prompt).toContain(c.resumeText);
    for (const r of c.requirements) expect(prompt).toContain(`${r.id}: ${r.requirement}`);
  });
});
