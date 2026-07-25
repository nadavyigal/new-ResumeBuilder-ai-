/**
 * WP-45 S4 — Extraction quality gate
 *
 * Junk requirements must not be able to produce a confident score. The three
 * strings named in the audit are the acceptance bar: "about", "role objective"
 * and "key responsibilities build" were all shown to a user as things missing
 * from their resume, and all three pass the pre-existing stop-list filter.
 *
 * The fixture matrix the packet requires: technical, non-technical, Hebrew,
 * LinkedIn-style scrape, pasted JD, sparse-but-valid, polluted headings.
 */

import {
  isStructuralHeading,
  isCredibleRequirement,
  assessExtractionQuality,
  MIN_CREDIBLE_REQUIREMENTS,
} from '../extraction-quality';
import { filterRequirementFragments } from '../job-data-resolver';

const LONG_JOB_TEXT = Array(60).fill('word').join(' ');

describe('WP-45 S4: the fragments the audit found', () => {
  it.each(['about', 'role objective', 'key responsibilities build'])(
    'rejects %s',
    fragment => {
      expect(isCredibleRequirement(fragment)).toBe(false);
    }
  );

  it('rejects them through the shared resolver filter too', () => {
    const filtered = filterRequirementFragments([
      'about',
      'role objective',
      'key responsibilities build',
      'Kafka',
    ]);
    expect(filtered).toEqual(['Kafka']);
  });
});

describe('WP-45 S4: structural headings', () => {
  it.each([
    'About us',
    'What you will do',
    "What you'll bring",
    'Requirements',
    'Benefits',
    'Why join us',
    'Nice to have',
  ])('treats %s as furniture', heading => {
    expect(isStructuralHeading(heading)).toBe(true);
  });

  it('catches a heading run together with the content beneath it', () => {
    // The scrape failure mode: the heading and the first words of its section
    // arrive as one string.
    expect(isStructuralHeading('key responsibilities build and maintain')).toBe(true);
  });

  it('does not mistake a real requirement that merely mentions a heading word', () => {
    expect(isStructuralHeading('experience with requirements gathering')).toBe(false);
    expect(isCredibleRequirement('experience with requirements gathering')).toBe(true);
  });
});

describe('WP-45 S4: valid short requirements survive', () => {
  it.each(['SQL', 'AWS', 'CRM', 'ETL', 'Go', 'C#', 'iOS', 'UX'])(
    'keeps %s',
    skill => {
      expect(isCredibleRequirement(skill)).toBe(true);
    }
  );

  it('keeps them through the resolver filter', () => {
    const filtered = filterRequirementFragments(['SQL', 'AWS', 'Go', 'about']);
    expect(filtered).toEqual(['SQL', 'AWS', 'Go']);
  });
});

describe('WP-45 S4: truncated phrases', () => {
  it.each([
    'collaborate with',
    'experience in building and',
    'you will help',
    'responsible for the',
  ])('rejects the dangling phrase %s', fragment => {
    expect(isCredibleRequirement(fragment)).toBe(false);
  });

  it('keeps the same phrase once it is complete', () => {
    expect(isCredibleRequirement('experience building data pipelines')).toBe(true);
  });
});

describe('WP-45 S4: quality assessment across the fixture matrix', () => {
  it('rates a clean technical extraction high', () => {
    const result = assessExtractionQuality({
      requirements: ['Kafka', 'Spark', 'Snowflake', 'SQL', 'Python', 'Airflow'],
      jobText: LONG_JOB_TEXT,
      title: 'Senior Data Engineer',
      source: 'paste',
    });
    expect(result.available).toBe(true);
    expect(result.quality).toBe('high');
    expect(result.junkRatio).toBe(0);
  });

  it('rates a clean non-technical extraction high', () => {
    const result = assessExtractionQuality({
      requirements: [
        'stakeholder management',
        'quarterly forecasting',
        'CRM',
        'team leadership',
        'contract negotiation',
        'B2B sales experience',
      ],
      jobText: LONG_JOB_TEXT,
      title: 'Account Director',
      source: 'paste',
    });
    expect(result.available).toBe(true);
    expect(result.quality).toBe('high');
  });

  it('handles Hebrew requirements without discarding them', () => {
    const result = assessExtractionQuality({
      requirements: ['ניסיון בפיתוח', 'עבודת צוות', 'אנגלית ברמה גבוהה', 'SQL'],
      jobText: LONG_JOB_TEXT,
      title: 'מהנדס תוכנה',
      source: 'paste',
    });
    expect(result.available).toBe(true);
    expect(result.credibleRequirements).toHaveLength(4);
  });

  it('fails closed on a LinkedIn-style scrape that captured page furniture', () => {
    const result = assessExtractionQuality({
      requirements: [
        'About us',
        'role objective',
        'key responsibilities build',
        'What you will do',
        'Benefits',
        'Apply now',
      ],
      jobText: LONG_JOB_TEXT,
      title: null,
      source: 'url',
    });
    expect(result.available).toBe(false);
    expect(result.quality).toBe('unavailable');
    expect(result.reason).toBe('too_few_credible_requirements');
  });

  it('lowers confidence when the job text is thin, without rejecting it', () => {
    // The public route already enforces its own minimum word count before
    // scoring. Rejecting again here only produced false negatives on short
    // but complete postings, so thin text costs confidence, not availability.
    const result = assessExtractionQuality({
      requirements: ['Kafka', 'Spark', 'SQL', 'Python'],
      jobText: 'Data engineer wanted.',
      title: 'Data Engineer',
      source: 'url',
    });
    expect(result.available).toBe(true);
    expect(result.quality).toBe('low');
  });

  it('fails closed when there are no requirements at all', () => {
    const result = assessExtractionQuality({ requirements: [], jobText: LONG_JOB_TEXT });
    expect(result.available).toBe(false);
    expect(result.reason).toBe('no_requirements');
  });

  it('accepts a sparse but valid extraction at reduced confidence', () => {
    // Three real requirements and no title: scoreable, but not something to
    // present as a confident read of the role.
    const result = assessExtractionQuality({
      requirements: ['Kafka', 'Spark', 'SQL'],
      jobText: LONG_JOB_TEXT,
      title: null,
      source: 'url',
    });
    expect(result.available).toBe(true);
    expect(result.quality).toBe('low');
    expect(result.credibleRequirements).toHaveLength(MIN_CREDIBLE_REQUIREMENTS);
  });

  it('rejects an extraction that is mostly junk even when a few reals survive', () => {
    const result = assessExtractionQuality({
      requirements: [
        'About us',
        'Benefits',
        'Why join us',
        'What you will do',
        'Apply now',
        'Perks',
        'role objective',
        'Kafka',
        'Spark',
        'SQL',
      ],
      jobText: LONG_JOB_TEXT,
      title: 'Data Engineer',
      source: 'url',
    });
    expect(result.available).toBe(false);
    expect(result.reason).toBe('mostly_junk');
    expect(result.junkRatio).toBeGreaterThan(0.5);
  });

  it('never returns a low-confidence result as a confident one', () => {
    // The invariant: unavailable must mean unavailable, so a caller cannot
    // read a score off a result the gate rejected.
    const rejected = assessExtractionQuality({ requirements: ['about'], jobText: LONG_JOB_TEXT });
    expect(rejected.available).toBe(false);
    expect(rejected.quality).toBe('unavailable');
  });
});
