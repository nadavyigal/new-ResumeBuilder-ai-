/**
 * "Add only if true" (2026-10-12, founder decision): a job-post phrase the guard
 * held back is offered on the review page. Confirming it must give the score back
 * exactly, so a user who really did the thing loses nothing; declining keeps the
 * honest score. Fixtures: tests/fixtures/free-check-2026-10-11 (fictional).
 */
import fs from 'fs';
import path from 'path';
import { describe, it, expect } from '@jest/globals';
import { enforceJobAdTruth } from '@/lib/ai-optimizer/job-ad-terms';
import type { OptimizedResume } from '@/lib/ai-optimizer';
import {
  buildResumeFromApprovedGroups,
  createConfirmGroups,
  createReviewChangeGroups,
} from '@/lib/optimization-review';
import { scoreOptimization } from '@/lib/ats/integration';
import type { ReviewChangeGroup } from '@/types/optimization-review';

const FIXTURES = path.join(process.cwd(), 'tests/fixtures/free-check-2026-10-11');
const MAYA_RESUME = fs.readFileSync(path.join(FIXTURES, 'maya-levin-resume.txt'), 'utf8');
const MAYA_JOB = fs.readFileSync(path.join(FIXTURES, 'job-data-analyst.txt'), 'utf8');

const ORIGINAL_BULLET = 'Prepared monthly reports for managers.';
const OBSERVED_BULLET =
  'Prepared monthly reports for managers, providing actionable insights to non-technical stakeholders.';

function maya(bullets: string[], summary = 'Analyst with 4 years of experience.'): OptimizedResume {
  return {
    summary,
    contact: { name: 'Maya Levin', email: 'maya.levin@example.test', phone: '', location: 'Tel Aviv' },
    skills: { technical: ['Excel', 'Google Sheets'], soft: ['Communication', 'Teamwork'] },
    experience: [
      { title: 'Data Analyst', company: 'Northwind Retail', location: 'Tel Aviv', startDate: '2022', endDate: 'Present', achievements: bullets },
    ],
    education: [],
    certifications: [],
    matchScore: 0,
    keyImprovements: [],
    missingKeywords: [],
  } as unknown as OptimizedResume;
}

const ORIGINAL = maya(['Worked with data from several departments.', ORIGINAL_BULLET, 'Supported the sales team with Excel analysis.']);
// What the optimizer wrote (2026-10-12 iOS capture shape).
const OPTIMIZED = maya([
  'Built SQL dashboards in Looker to monitor weekly sales by region.',
  OBSERVED_BULLET,
  'Supported the sales team with Excel analysis.',
]);

async function review() {
  const guarded = await enforceJobAdTruth(OPTIMIZED, {
    resumeText: MAYA_RESUME,
    jobDescription: MAYA_JOB,
    repair: async () => null,
    holdJobPhrases: true,
  });
  const groups: ReviewChangeGroup[] = [
    ...createReviewChangeGroups(ORIGINAL, guarded.resume),
    ...createConfirmGroups(guarded.held),
  ];
  return { guarded, groups };
}

const bullets = (r: OptimizedResume) => r.experience.flatMap((e) => e.achievements ?? []);
const score = async (r: OptimizedResume) =>
  (await scoreOptimization({ resumeOriginalText: MAYA_RESUME, resumeOptimizedJson: r, jobDescriptionText: MAYA_JOB })).ats_score_optimized;

describe('"Add only if true" on the review page', () => {
  it('offers the held-back phrase as one unselected item', async () => {
    const { groups } = await review();
    const confirm = groups.filter((g) => g.confirm);
    expect(confirm).toHaveLength(1);
    expect(confirm[0].confirm).toMatchObject({ requires: 'experience', kept: ORIGINAL_BULLET, proposed: OBSERVED_BULLET });
    expect(confirm[0].operations).toEqual([]);
  });

  it('confirmed: the résumé and the score are exactly what the optimizer wrote, so nothing drops', async () => {
    const { groups } = await review();
    const confirmed = buildResumeFromApprovedGroups(ORIGINAL, groups);
    expect(bullets(confirmed)).toEqual(bullets(OPTIMIZED));
    expect(await score(confirmed)).toBe(await score(OPTIMIZED));
  }, 60000);

  it('declined: the line stays the candidate\'s own and the score is the honest one', async () => {
    const { groups } = await review();
    const declined = buildResumeFromApprovedGroups(ORIGINAL, groups.filter((g) => !g.confirm));
    expect(bullets(declined)).toContain(ORIGINAL_BULLET);
    expect(JSON.stringify(declined.experience)).not.toMatch(/non-?technical|stakeholders/i);
    expect(await score(declined)).toBeLessThan(await score(OPTIMIZED));
  }, 60000);

  it('does nothing when its section change is not included (it edits that new text)', async () => {
    const { groups } = await review();
    const onlyConfirm = buildResumeFromApprovedGroups(ORIGINAL, groups.filter((g) => g.confirm || g.section !== 'experience'));
    expect(bullets(onlyConfirm)).toEqual(bullets(ORIGINAL));
  });

  it('applies on its own when holding the phrase left the section unchanged', () => {
    const groups = createConfirmGroups([
      { section: 'experience', index: 0, kept: ORIGINAL_BULLET, proposed: OBSERVED_BULLET, after: null, terms: ['stakeholders'] },
    ]);
    groups[0].confirm!.standalone = true;
    expect(bullets(buildResumeFromApprovedGroups(ORIGINAL, groups))).toContain(OBSERVED_BULLET);
  });

  it('puts a held-back whole bullet back after the bullet it followed', () => {
    const sectionGroups = createReviewChangeGroups(ORIGINAL, maya(['Worked with data from several departments.', ORIGINAL_BULLET]));
    const confirm = createConfirmGroups([
      { section: 'experience', index: 0, kept: null, proposed: 'Owned the weekly KPI report for sales leadership.', after: 'Worked with data from several departments.', terms: ['kpi'] },
    ]);
    expect(bullets(buildResumeFromApprovedGroups(ORIGINAL, [...sectionGroups, ...confirm]))).toEqual([
      'Worked with data from several departments.',
      'Owned the weekly KPI report for sales leadership.',
      ORIGINAL_BULLET,
    ]);
  });

  it('restores a summary clause', () => {
    const cut = 'Analyst with 4 years of experience.';
    const proposed = 'Analyst with 4 years of experience, presenting insights to non-technical stakeholders.';
    const sectionGroups = createReviewChangeGroups(maya([ORIGINAL_BULLET], 'Old summary.'), maya([ORIGINAL_BULLET], cut));
    const confirm = createConfirmGroups([{ section: 'summary', index: 0, kept: cut, proposed, after: null, terms: ['stakeholders'] }]);
    expect(buildResumeFromApprovedGroups(maya([ORIGINAL_BULLET], 'Old summary.'), [...sectionGroups, ...confirm]).summary).toBe(proposed);
  });
});
