/**
 * WP-45 — Hebrew must not score lower for being Hebrew
 *
 * The calibration benchmark surfaced this: `heb-strong` is a top match by its
 * own label and scored 52, while its English equivalents scored 74-92. The gap
 * was not semantics. Two analyzers assumed Latin script:
 *
 *   - section_completeness searched for English header words with `\b`, which
 *     never matches a Hebrew word boundary, so a complete Hebrew resume scored
 *     0 for having no sections at all.
 *   - title_alignment extracted resume titles with /[A-Z][a-z]+/, which cannot
 *     match a script with no case, so it reported "no job titles found" and
 *     returned its 20-point floor.
 *
 * Together that is roughly 18 points off every Hebrew resume — the whole gap.
 * The product ships in Hebrew, so this was a real scoring penalty applied to
 * real users for their language.
 */

import { SectionCompletenessAnalyzer } from '../analyzers/section-completeness';
import { TitleAlignmentAnalyzer } from '../analyzers/title-alignment';
import type { AnalyzerInput } from '../types';

const HEBREW_RESUME = `מועמד לדוגמה
candidate@example.com

תקציר מקצועי
מהנדס תוכנה עם חמש שנות ניסיון בפיתוח בקאנד.

כישורים
Node.js, SQL, Docker, עבודת צוות

ניסיון תעסוקתי

מהנדס תוכנה at Example Ltd
2021 - Present
• פיתוח שירותים ב-Node.js

השכלה
תואר ראשון במדעי המחשב
`;

const ENGLISH_RESUME = `Jane Cohen
jane@example.com

PROFESSIONAL SUMMARY
Backend engineer with five years of experience.

SKILLS
Node.js, SQL, Docker, teamwork

EXPERIENCE

Software Engineer at Example Ltd
2021 - Present
• Built services in Node.js

EDUCATION
BSc Computer Science
`;

function inputFor(resumeText: string, jobTitle: string): AnalyzerInput {
  return {
    resume_text: resumeText,
    job_text: 'Backend engineer role requiring Node.js, SQL and Docker.',
    job_data: {
      title: jobTitle,
      must_have: ['Node.js', 'SQL', 'Docker'],
      nice_to_have: [],
      responsibilities: [],
    },
  } as unknown as AnalyzerInput;
}

describe('WP-45: section_completeness reads Hebrew headings', () => {
  it('recognises a complete Hebrew resume as complete', async () => {
    const result = await new SectionCompletenessAnalyzer().analyze(
      inputFor(HEBREW_RESUME, 'מהנדס תוכנה')
    );
    // Was 0: none of summary/skills/experience/education matched, so a fully
    // structured resume was scored as having no sections whatsoever.
    expect(result.score).toBeGreaterThanOrEqual(100);
  });

  it('scores the Hebrew and English versions of the same resume the same', async () => {
    const analyzer = new SectionCompletenessAnalyzer();
    const [he, en] = await Promise.all([
      analyzer.analyze(inputFor(HEBREW_RESUME, 'מהנדס תוכנה')),
      analyzer.analyze(inputFor(ENGLISH_RESUME, 'Software Engineer')),
    ]);
    expect(he.score).toBe(en.score);
  });

  it('still scores a resume with no headings low', async () => {
    const result = await new SectionCompletenessAnalyzer().analyze(
      inputFor('מועמד לדוגמה\ncandidate@example.com\nטקסט חופשי ללא כותרות.\n', 'מהנדס תוכנה')
    );
    expect(result.score).toBeLessThan(50);
  });

  it('does not match a heading word buried inside another word', async () => {
    // The English path relied on \b for this. The Unicode-aware boundary has
    // to keep that property or "skillset" starts counting as a Skills section.
    const result = await new SectionCompletenessAnalyzer().analyze(
      inputFor('Jane Cohen\nMy skillsets and experiences are varied.\n', 'Engineer')
    );
    expect(result.score).toBeLessThan(100);
  });
});

describe('WP-45: title_alignment reads Hebrew titles', () => {
  it('finds the Hebrew job title in the resume', async () => {
    const result = await new TitleAlignmentAnalyzer().analyze(
      inputFor(HEBREW_RESUME, 'מהנדס תוכנה')
    );
    // Was 20 — the "no job titles found in resume" floor, for a resume whose
    // title is an exact match for the role.
    expect(result.score).toBeGreaterThan(70);
  });

  it('does not award a high score for an unrelated Hebrew title', async () => {
    const result = await new TitleAlignmentAnalyzer().analyze(
      inputFor(HEBREW_RESUME, 'מעצב גרפי')
    );
    expect(result.score).toBeLessThan(70);
  });

  it('leaves English title extraction working', async () => {
    const result = await new TitleAlignmentAnalyzer().analyze(
      inputFor(ENGLISH_RESUME, 'Software Engineer')
    );
    expect(result.score).toBeGreaterThan(70);
  });
});
