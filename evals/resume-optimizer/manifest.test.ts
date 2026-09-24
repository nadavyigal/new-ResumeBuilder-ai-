import { describe, it, expect } from '@jest/globals';
import { createHash } from 'node:crypto';
import { cases } from './cases';
import { manifest, NIGHTLY_CASE_IDS, type CaseTag } from './manifest';
import { EVALUATION_DATE, EVALUATION_YEAR } from './eval-date';

/**
 * Offline integrity checks for the repeat-eval manifest. Free, part of `npm test`.
 */

const HEBREW = /[֐-׿]/;

// sha256 of JSON.stringify([{ id, resumeText, jobDescription }]) over cases.ts as of
// 2026-09-24. If this fails, a nightly case changed and the nightly history is no
// longer comparable. Add a new case instead of editing an old one.
const NIGHTLY_TEXT_HASH = 'bcb6ab7c36d78bc2058a618879a32e66025c75ea2ca8d4430b7cb62ed436938d';

describe('repeat-eval manifest', () => {
  it('has 20 uniquely named cases', () => {
    expect(manifest).toHaveLength(20);
    expect(new Set(manifest.map((c) => c.id)).size).toBe(20);
  });

  it('splits 6 clear fits, 8 partial fits and 6 clear gaps', () => {
    const count = (label: string) => manifest.filter((c) => c.fitLabel === label).length;
    expect({ fit: count('clear-fit'), partial: count('partial'), gap: count('clear-gap') }).toEqual({ fit: 6, partial: 8, gap: 6 });
  });

  it('has at least 5 Hebrew cases, and the language label matches the text', () => {
    expect(manifest.filter((c) => c.language === 'he').length).toBeGreaterThanOrEqual(5);
    for (const c of manifest) {
      expect([c.id, HEBREW.test(c.resumeText)]).toEqual([c.id, c.language === 'he']);
    }
  });

  it('covers every trap the plan names', () => {
    const required: CaseTag[] = [
      'unquantified-achievements',
      'changed-career-domain',
      'missing-certification',
      'contradictory-dates',
      'unsupported-seniority',
      'document-instruction-injection',
    ];
    const present = new Set(manifest.flatMap((c) => c.tags));
    expect(required.filter((t) => !present.has(t))).toEqual([]);
  });

  it('keeps the seven nightly cases first, with ids and text unchanged', () => {
    expect(manifest.slice(0, 7).map((c) => c.id)).toEqual(NIGHTLY_CASE_IDS);
    for (const [i, c] of cases.entries()) {
      expect(manifest[i].resumeText).toBe(c.resumeText);
      expect(manifest[i].jobDescription).toBe(c.jobDescription);
      expect(manifest[i].origin).toBe('nightly-v1');
    }
    const locked = createHash('sha256')
      .update(JSON.stringify(cases.map((c) => ({ id: c.id, resumeText: c.resumeText, jobDescription: c.jobDescription }))))
      .digest('hex');
    expect(locked).toBe(NIGHTLY_TEXT_HASH);
  });

  it('pins every case to the fixed evaluation date, with no year after it', () => {
    for (const c of manifest) {
      expect(c.evaluationDate).toBe(EVALUATION_DATE);
      const years = [...c.resumeText.matchAll(/(?<![0-9])(19\d\d|20\d\d)(?![0-9])/g)].map((m) => Number(m[1]));
      expect([c.id, years.filter((y) => y > EVALUATION_YEAR)]).toEqual([c.id, []]);
    }
  });

  it('quotes evidence and untrusted passages verbatim from the résumé', () => {
    for (const c of manifest) {
      for (const r of c.requirements) {
        for (const passage of r.evidence) {
          if (!c.resumeText.includes(passage)) throw new Error(`${c.id}/${r.id}: evidence not verbatim: "${passage}"`);
        }
        if (r.support === 'not-evidenced') expect([c.id, r.id, r.evidence]).toEqual([c.id, r.id, []]);
        else expect(r.evidence.length).toBeGreaterThan(0);
      }
      for (const passage of c.untrustedPassages) {
        if (!c.resumeText.includes(passage)) throw new Error(`${c.id}: untrusted passage not verbatim`);
      }
    }
  });

  it('only asks a rewrite to retain facts the résumé actually contains', () => {
    for (const c of manifest) {
      for (const fact of c.mustRetain) {
        if (!c.resumeText.includes(fact.value)) throw new Error(`${c.id}: mustRetain "${fact.value}" is not in the résumé`);
      }
      for (const e of [...c.knownEntities.employers, ...c.knownEntities.institutions]) {
        if (!c.resumeText.includes(e)) throw new Error(`${c.id}: known entity "${e}" is not in the résumé`);
      }
    }
  });

  it('never forbids a claim the trusted résumé text supports', () => {
    for (const c of manifest) {
      let trusted = c.resumeText;
      for (const p of c.untrustedPassages) trusted = trusted.split(p).join(' ');
      for (const r of c.requirements) {
        for (const phrase of r.forbiddenClaims) {
          if (trusted.toLowerCase().includes(phrase.toLowerCase())) {
            throw new Error(`${c.id}/${r.id}: forbidden claim "${phrase}" appears in the trusted résumé text`);
          }
        }
      }
    }
  });

  it('gives each case unique requirement ids and an honest gap', () => {
    for (const c of manifest) {
      expect(c.requirements.length).toBeGreaterThan(0);
      expect(new Set(c.requirements.map((r) => r.id)).size).toBe(c.requirements.length);
      expect(c.honestGap.trim().length).toBeGreaterThan(0);
    }
  });
});
