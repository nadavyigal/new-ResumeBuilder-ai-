/**
 * PR #214 clears "Not specified" from saved resumes, so a field the parser
 * could not read is now empty. The templates joined fields with " | ", ", "
 * and " - " unconditionally, which printed "Kaltura | " and
 * "Ben Gurion University, " in place of the placeholder. Every template in
 * both engines must print only the fields that have a value.
 */

import { describe, it, expect } from '@jest/globals';
import type { OptimizedResume } from '@/lib/ai-optimizer';
import * as legacyEngine from '@/lib/template-engine';
import * as engine from '@/lib/template-engine/index';

const resumeWithGaps = {
  summary: 'Data analyst with SaaS reporting experience.',
  contact: { name: 'Dana Levi', email: 'dana@example.test', phone: '', location: '' },
  skills: { technical: ['SQL', 'Python'], soft: [] },
  experience: [
    { title: 'Data Analyst', company: 'Kaltura', location: '', startDate: '', endDate: 'Present', achievements: ['Built SQL dashboards'] },
  ],
  education: [
    { degree: 'B.Sc. Information Systems', institution: 'Ben Gurion University', location: '', graduationDate: '' },
  ],
  certifications: [],
  projects: [],
  matchScore: 0,
  keyImprovements: [],
  missingKeywords: [],
} as unknown as OptimizedResume;

/** Visible text lines of the rendered page, CSS and tags removed. */
function visibleLines(html: string): string[] {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // Inline tags sit inside a line ("<span>Title</span> | <span>Company</span>").
    .replace(/<\/?(?:span|strong|em|b|i|a)(?:\s[^>]*)?>/gi, '')
    .replace(/<[^>]+>/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

const DANGLING = /^[|,–-]|[|,–-]$/;

const renderers: Array<[string, (resume: OptimizedResume) => string]> = [
  ['template-engine.ts ATS-safe', legacyEngine.generateATSSafeHTML],
  ['template-engine.ts modern', legacyEngine.generateModernHTML],
  ['template-engine/index.ts ATS-safe', engine.generateATSSafeHTML],
  ['template-engine/index.ts modern', engine.generateModernHTML],
];

describe.each(renderers)('%s with empty location and dates', (_name, render) => {
  const html = render(resumeWithGaps);
  const lines = visibleLines(html);

  it('prints no line that starts or ends with a separator', () => {
    expect(lines.filter((line) => DANGLING.test(line))).toEqual([]);
  });

  it('still prints the values that exist', () => {
    const text = lines.join('\n');
    expect(text).toContain('Kaltura');
    expect(text).toContain('Ben Gurion University');
    expect(text).toContain('Present');
    expect(text).toContain('dana@example.test');
  });
});

describe.each(renderers)('%s with every field present', (_name, render) => {
  it('keeps the separators between real values', () => {
    const full = {
      ...resumeWithGaps,
      contact: { name: 'Dana Levi', email: 'dana@example.test', phone: '+972-50-000-0000', location: 'Haifa' },
      experience: [{ ...resumeWithGaps.experience[0], location: 'Tel Aviv', startDate: '2021' }],
      education: [{ ...resumeWithGaps.education[0], location: 'Beer Sheva', graduationDate: '2019' }],
    } as OptimizedResume;
    const text = visibleLines(render(full)).join('\n');

    expect(text).toMatch(/2021 [–-] Present/);
    expect(text).toMatch(/Ben Gurion University(, | \| )Beer Sheva/);
    expect(text).toContain('Tel Aviv');
    expect(text).toContain('2019');
  });
});
