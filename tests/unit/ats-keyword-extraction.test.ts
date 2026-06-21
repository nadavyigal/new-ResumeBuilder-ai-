import { extractKeywords } from '@/lib/ats/utils/text-utils';
import { extractJobData } from '@/lib/ats/extractors/jd-extractor';

describe('extractKeywords — technical-term boundary matching', () => {
  // Regression: a Business Development Manager JD scored ~34 because the
  // keyword extractor pulled "rust" out of "Trusted", "api" out of "rapidly",
  // and "express" out of "expressing" — tech skills the resume could never
  // match, collapsing keyword_exact and keyword_phrase.
  it('does not extract tech skills from substrings of unrelated words', () => {
    const text =
      'We are a Trusted partner expressing our values while growing rapidly ' +
      'across global markets, powered by Google-scale ambition.';
    const keywords = extractKeywords(text).map((k) => k.toLowerCase());

    expect(keywords).not.toContain('rust');
    expect(keywords).not.toContain('api');
    expect(keywords).not.toContain('express');
    expect(keywords).not.toContain('go');
  });

  it('still extracts genuine standalone technical terms', () => {
    const text =
      'Backend engineer with Python, Rust, and REST API experience building ' +
      'services in Go.';
    const keywords = extractKeywords(text).map((k) => k.toLowerCase());

    expect(keywords).toContain('python');
    expect(keywords).toContain('rust');
    expect(keywords).toContain('api');
    expect(keywords).toContain('go');
  });

  it('does not join capitalized words across line breaks', () => {
    const keywords = extractKeywords('Company: Fresha\nAbout: leading platform');
    expect(keywords).not.toContain('Fresha\nAbout');
  });
});

describe('extractJobData — non-technical JD keyword fallback', () => {
  it('does not fabricate engineering skills for a business-development role', () => {
    const jd =
      'Job Title: Business Development Manager\n' +
      'Company: Fresha\n' +
      'About: As a Trusted advisor you will drive partnerships, expressing our ' +
      'value to clients and growing the portfolio rapidly. You will build ' +
      'relationships, negotiate deals, and own revenue targets.';
    const data = extractJobData(jd);
    const mustHave = data.must_have.map((s) => s.toLowerCase());

    expect(mustHave).not.toContain('rust');
    expect(mustHave).not.toContain('api');
    expect(mustHave).not.toContain('express');
  });
});
