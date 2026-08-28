/** @jest-environment node */
/**
 * WP-59 S3c — what the scorer is allowed to call a "requirement".
 *
 * Three defects, all measured on a candidate holding every skill a job asked
 * for, whose keyword_exact read 45.8 against 80.0 for a human's list of the
 * same skills:
 *
 *   1. `normalizeText` used `[^\w\s]`, and `\w` is ASCII-only in JavaScript
 *      without the `u` flag — so every Hebrew character was replaced with a
 *      space. A Hebrew job description was scored on its English technology
 *      names alone, and a requirement written only in Hebrew normalized to the
 *      empty string.
 *   2. Filler was stripped only from the FRONT of a clause, so `proficiency`,
 *      `familiarity`, `building` and `background postgresql` were emitted as
 *      must-haves — and shown to users as gaps in their resume.
 *   3. `min_keyword_length: 3` silently deleted Go, AI, ML, QA and UX from both
 *      the job and the resume, so a job requiring Go never measured it.
 */

import { normalizeText, tokenize, isShortSkillToken } from '../utils/text-utils';
import { extractSkillPhrases } from '../extractors/skill-phrase-extractor';
import { skillMatchesResume, skillCoverage } from '../skill-match';

describe('normalizeText is Unicode-aware', () => {
  it('keeps Hebrew instead of deleting it', () => {
    const out = normalizeText('מהנדס תוכנה בכיר עם ניסיון ב Kubernetes ו PostgreSQL');
    expect(out).toContain('מהנדס');
    expect(out).toContain('kubernetes');
  });

  it('does not reduce a Hebrew-only requirement to the empty string', () => {
    expect(normalizeText('ניסיון בפיתוח')).not.toBe('');
  });

  it('keeps accented Latin', () => {
    expect(normalizeText('José café')).toContain('josé');
  });

  it('still strips real punctuation', () => {
    expect(normalizeText('Node.js, React!')).toBe('node js react');
  });
});

describe('short technology names survive tokenization', () => {
  it('keeps known short skills', () => {
    expect(tokenize('Built services in Go and some ML')).toContain('go');
    expect(isShortSkillToken('go')).toBe(true);
    expect(isShortSkillToken('ml')).toBe(true);
  });

  it('does not admit single letters or ordinary short words', () => {
    expect(isShortSkillToken('r')).toBe(false);
    expect(isShortSkillToken('c')).toBe(false);
    expect(isShortSkillToken('an')).toBe(false);
  });
});

describe('word boundaries are Unicode-aware', () => {
  it('does not match a Hebrew stem buried inside a longer word', () => {
    expect(skillMatchesResume('יתוח', 'פיתוח')).toBe(false);
  });

  it('tolerates a Hebrew particle glued to the front', () => {
    // The job says "in development", the resume says "development".
    expect(skillMatchesResume('פיתוח', 'ניסיון בפיתוח מערכות')).toBe(true);
  });

  it('matches Go as a word but not inside another word', () => {
    expect(skillMatchesResume('go', 'built backend services in go')).toBe(true);
    expect(skillMatchesResume('go', 'used gopher tooling')).toBe(false);
  });
});

describe('the atomizer emits skills, not filler', () => {
  const REQUIREMENTS = [
    'Experience building and operating distributed systems at scale',
    'Strong background in PostgreSQL and database performance tuning',
    'Hands-on experience with Kubernetes in production environments',
    'Proficiency with Go or another statically typed language',
    'Familiarity with Terraform and infrastructure as code',
  ];
  const phrases = extractSkillPhrases(REQUIREMENTS);

  it.each([
    'proficiency',
    'familiarity',
    'building',
    'hands experience',
    'background postgresql',
  ])('never emits %p as a requirement', (junk) => {
    expect(phrases).not.toContain(junk);
  });

  it('keeps the technologies the sentences carried', () => {
    expect(phrases).toContain('postgresql');
    expect(phrases).toContain('terraform');
    expect(phrases).toContain('go');
  });

  it('lets a candidate who has everything actually score for it', () => {
    const perfect = `Senior Backend Engineer
      Built and operated distributed systems serving production traffic.
      PostgreSQL, Kubernetes, Go, AWS, Terraform, Python.
      Tuned database performance and owned infrastructure as code.`;

    // Measured 45.8 before this change on exactly this pair.
    const coverage =
      phrases.reduce((sum, p) => sum + skillCoverage(p, perfect), 0) / phrases.length;
    expect(coverage * 100).toBeGreaterThan(75);
  });

  it('extracts Hebrew requirements at all, and drops Hebrew filler', () => {
    const hebrew = extractSkillPhrases([
      'ניסיון בפיתוח מערכות מבוזרות',
      'שליטה בשפת Go',
    ]);
    expect(hebrew.length).toBeGreaterThan(0);
    // בשפת — "in the language of" — is filler carrying a glued particle.
    expect(hebrew.join(' ')).not.toContain('בשפת');
    expect(hebrew.join(' ')).toContain('go');
  });
});
