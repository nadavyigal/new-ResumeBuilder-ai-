import { describe, it, expect } from '@jest/globals';
import { manifest } from './manifest';
import { calibration } from './calibration';
import {
  parseGroundingVerdict,
  buildGroundingPrompt,
  judgeView,
  groundingSchema,
  groundingFindings,
  JudgeInvalidError,
  type GroundingVerdict,
} from './judge-grounding';

const c = manifest.find((m) => m.id === 'no-cloud-cert')!;
const resume = calibration.find((x) => x.id === 'cal-01-honest-no-cloud-cert')!.resume;

const valid = {
  requirements: c.requirements.map((r) => ({ id: r.id, ruling: r.support === 'evidenced' ? 'evidenced' : 'not-evidenced' })),
  unsupportedStatements: [],
  honestGapPreserved: true,
  honestGapQuote: '',
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
    ['a missing gap quote', { ...valid, honestGapQuote: undefined }],
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

  it('shows source support in its own words, never in the ruling vocabulary', () => {
    const prompt = buildGroundingPrompt(c, resume);
    expect(prompt).toContain('Source support: full.');
    expect(prompt).toContain('Source support: none.');
    expect(prompt).not.toMatch(/Label in the ORIGINAL/);
  });

  it('constrains the answer with a strict schema: ids, rulings and categories are enums', () => {
    const schema = groundingSchema(c).schema;
    expect(groundingSchema(c).strict).toBe(true);
    const req = schema.properties.requirements.items.properties;
    expect(req.id.enum).toEqual(c.requirements.map((r) => r.id));
    expect(req.ruling.enum).toEqual(['evidenced', 'not-evidenced', 'claimed-without-support']);
    expect(schema.properties.unsupportedStatements.items.properties.category.enum).toContain('forbidden-claim');
  });
});

describe('grounded judge findings (offline)', () => {
  const base: GroundingVerdict = { ...(valid as GroundingVerdict) };

  it('fails a run only on a quote that is really in the rewrite', () => {
    const f = groundingFindings(
      {
        ...base,
        unsupportedStatements: [
          { quote: 'Built and maintained internal order-management REST APIs in Django.', category: 'forbidden-claim' },
          { quote: 'Certified Kubernetes Administrator', category: 'credential' },
        ],
      },
      resume
    );
    expect(f.verified.map((s) => s.quote)).toEqual(['Built and maintained internal order-management REST APIs in Django.']);
    expect(f.unverified.map((s) => s.quote)).toEqual(['Certified Kubernetes Administrator']);
    expect(f.pass).toBe(false);
  });

  it('records an uncited gap concern without failing the run', () => {
    const f = groundingFindings({ ...base, honestGapPreserved: false, honestGapQuote: '' }, resume);
    expect(f).toMatchObject({ uncitedGapConcern: true, gapPaperedOver: false, pass: true });
  });

  it('fails the run when the gap concern cites real text', () => {
    const f = groundingFindings({ ...base, honestGapPreserved: false, honestGapQuote: 'ready to grow into cloud infrastructure' }, resume);
    expect(f).toMatchObject({ gapPaperedOver: true, pass: false });
  });

  it('still fails on a requirement ruled claimed-without-support', () => {
    const requirements = base.requirements.map((r) => (r.id === 'r3' ? { ...r, ruling: 'claimed-without-support' as const } : r));
    expect(groundingFindings({ ...base, requirements }, resume)).toMatchObject({ claimedWithoutSupport: ['r3'], pass: false });
  });
});
