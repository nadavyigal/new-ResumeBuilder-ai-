/**
 * Optimizer bullets may not take phrases from the job post (2026-10-12).
 *
 * iOS capture, Maya fixture + job-data-analyst.txt, after confirming the optimization:
 * "Prepared monthly reports for managers." came back as "Prepared monthly reports for
 * managers, providing actionable insights to non-technical stakeholders." The job says
 * "presenting insights to non-technical stakeholders"; the résumé never does. The
 * Stage 2 tool guard let it through because it polices named tools only.
 *
 * Fixtures: tests/fixtures/free-check-2026-10-11 (fictional candidates).
 */
import fs from 'fs';
import path from 'path';
import { describe, it, expect } from '@jest/globals';
import {
  enforceJobAdTruth,
  findJobOnlyBulletTerms,
  removeJobOnlyPhrases,
  type TruthRepair,
} from '@/lib/ai-optimizer/job-ad-terms';
import type { OptimizedResume } from '@/lib/ai-optimizer';

const FIXTURES = path.join(process.cwd(), 'tests/fixtures/free-check-2026-10-11');
const read = (name: string) => fs.readFileSync(path.join(FIXTURES, name), 'utf8');

const MAYA = { resume: read('maya-levin-resume.txt'), job: read('job-data-analyst.txt') };
const ITAY = { resume: read('itay-shalev-resume.txt'), job: read('job-customer-success.txt') };
const NOA = { resume: read('noa-mizrahi-resume.txt'), job: read('job-instructional-designer.txt') };

const ORIGINAL_BULLET = 'Prepared monthly reports for managers.';
const OBSERVED_BULLET =
  'Prepared monthly reports for managers, providing actionable insights to non-technical stakeholders.';

function resumeWith(bullets: string[], company = 'Northwind Retail', title = 'Data Analyst'): OptimizedResume {
  return {
    // Empty: the summary is checked too, and each test sets its own when it matters.
    summary: '',
    contact: { name: 'Maya Levin', email: 'maya.levin@example.test', phone: '', location: 'Tel Aviv' },
    skills: { technical: ['Excel', 'Google Sheets', 'SQL', 'Looker'], soft: ['Communication', 'Teamwork'] },
    experience: [
      { title, company, location: 'Tel Aviv', startDate: '2022', endDate: 'Present', achievements: bullets },
    ],
    education: [],
    certifications: [],
    matchScore: 70,
    keyImprovements: [],
    missingKeywords: [],
  } as unknown as OptimizedResume;
}

const MAYA_REWRITE = () =>
  resumeWith([
    'Built SQL dashboards in Looker to monitor weekly sales by region.',
    OBSERVED_BULLET,
    'Supported the sales team with Excel analysis.',
    'Worked with data from several departments.',
  ]);

function repairReturning(result: OptimizedResume | null) {
  return jest.fn(async (...args: Parameters<TruthRepair>) => {
    void args;
    return result;
  });
}

const bulletsOf = (r: OptimizedResume) => r.experience.flatMap((e) => e.achievements ?? []);

describe('job-only phrases in optimizer bullets', () => {
  it('flags the observed bullet and names the borrowed words', () => {
    const flagged = findJobOnlyBulletTerms(MAYA_REWRITE(), MAYA.resume, MAYA.job);
    expect(flagged).toHaveLength(1);
    expect(flagged[0].bullet).toBe(OBSERVED_BULLET);
    expect(flagged[0].terms).toEqual(expect.arrayContaining(['nontechnical', 'stakeholders', 'insights']));
  });

  it('leaves the candidate\'s own bullets and a verb swap alone', () => {
    const clean = resumeWith([
      ORIGINAL_BULLET,
      'Built SQL dashboards in Looker to track weekly sales by region.',
      'Supported the sales team with Excel analysis.',
    ]);
    expect(findJobOnlyBulletTerms(clean, MAYA.resume, MAYA.job)).toEqual([]);
  });
});

describe('enforceJobAdTruth: "Prepared monthly reports for managers." never gains "non-technical stakeholders"', () => {
  const input = { resumeText: MAYA.resume, jobDescription: MAYA.job };

  it('falls back to the bullet\'s own clause when the repair call fails', async () => {
    const repair = repairReturning(null);
    const out = await enforceJobAdTruth(MAYA_REWRITE(), { ...input, repair });

    expect(repair).toHaveBeenCalledTimes(1);
    expect(repair.mock.calls[0][1].jobPhrases).toEqual(expect.arrayContaining(['stakeholders']));
    expect(bulletsOf(out.resume)).toContain(ORIGINAL_BULLET);
    expect(JSON.stringify(out.resume.experience)).not.toMatch(/non-?technical|stakeholders/i);
    expect(out.changed).toBe(true);
    expect(out.report).toMatchObject({ retried: true, retryReason: 'job_only_phrases', jobPhraseBulletsCleaned: 1, jobPhrasesUnresolved: [] });
  });

  it('falls back when the repair returns the same phrase again', async () => {
    const out = await enforceJobAdTruth(MAYA_REWRITE(), { ...input, repair: repairReturning(MAYA_REWRITE()) });
    expect(out.report.repairAccepted).toBe(false);
    expect(bulletsOf(out.resume)).toContain(ORIGINAL_BULLET);
    expect(JSON.stringify(out.resume.experience)).not.toMatch(/non-?technical|stakeholders/i);
  });

  it('keeps a repair that removes the phrase', async () => {
    const fixed = MAYA_REWRITE();
    fixed.experience[0].achievements[1] = ORIGINAL_BULLET;
    const out = await enforceJobAdTruth(MAYA_REWRITE(), { ...input, repair: repairReturning(fixed) });
    expect(out.report).toMatchObject({ repairAccepted: true, jobPhraseBulletsCleaned: 0 });
    expect(bulletsOf(out.resume)).toContain(ORIGINAL_BULLET);
  });

  it('keeps every bullet: a cut never deletes evidence', async () => {
    const out = await enforceJobAdTruth(MAYA_REWRITE(), { ...input, repair: repairReturning(null) });
    expect(bulletsOf(out.resume)).toHaveLength(4);
  });
});

describe('removeJobOnlyPhrases: other shapes from the 2026-10-12 iOS capture (Itay)', () => {
  it('reverts a main-clause swap to the candidate\'s own line', () => {
    const r = resumeWith(
      ['Ran executive business reviews with account stakeholders.', 'Renewed 38 of 41 accounts up for renewal in 2024.'],
      'Brightdesk',
      'Customer Success Manager',
    );
    const out = removeJobOnlyPhrases(r, ITAY.resume, ITAY.job);
    expect(bulletsOf(out.resume)[0]).toBe('Ran quarterly business reviews with account stakeholders.');
  });

  it('drops an invented duty bullet when the role keeps other bullets', () => {
    const r = resumeWith(
      ['Renewed 38 of 41 accounts up for renewal in 2024.', 'Maintained accurate account data in Salesforce and Gainsight.'],
      'Brightdesk',
      'Customer Success Manager',
    );
    const out = removeJobOnlyPhrases(r, ITAY.resume, ITAY.job);
    expect(bulletsOf(out.resume)).toEqual(['Renewed 38 of 41 accounts up for renewal in 2024.']);
    expect(out.unresolved).toEqual([]);
  });

  it('never empties a role: an invented only-bullet is reported, not deleted', () => {
    const r = resumeWith(['Maintained accurate account data in Salesforce and Gainsight.'], 'Brightdesk', 'Customer Success Manager');
    const out = removeJobOnlyPhrases(r, ITAY.resume, ITAY.job);
    expect(bulletsOf(out.resume)).toHaveLength(1);
    expect(out.unresolved.length).toBeGreaterThan(0);
  });
});

// Review of PR #169, 2026-10-12. Each case failed before its fix.
describe('review: false positives from résumé formatting', () => {
  it('accepts "mid-market" when the résumé writes "mid market"', () => {
    const resumeText = ITAY.resume.replace('mid-market', 'mid market');
    const r = resumeWith(['Managed a portfolio of mid-market accounts and ensured customer satisfaction.'], 'Brightdesk');
    expect(findJobOnlyBulletTerms(r, resumeText, ITAY.job)).toEqual([]);
  });

  it('accepts "self-paced" when the PDF text breaks it across a line', () => {
    const resumeText = NOA.resume.replace('self-paced', 'self-\npaced');
    const r = resumeWith(['Built 12 self-paced online course units in Moodle, used by 150 students during remote learning.'], 'Carmel High School');
    expect(findJobOnlyBulletTerms(r, resumeText, NOA.job)).toEqual([]);
  });
});

describe('review: the fallback never puts a header or a skills list in a bullet', () => {
  it.each([
    ['role header', 'Data analyst presenting insights to stakeholders at Northwind Retail.'],
    ['skills line', 'Used Excel and Google Sheets for stakeholder communication and teamwork.'],
  ])('%s', (_label, invented) => {
    const out = removeJobOnlyPhrases(resumeWith([invented, 'Supported the sales team with Excel analysis.']), MAYA.resume, MAYA.job);
    expect(bulletsOf(out.resume)).toEqual(['Supported the sales team with Excel analysis.']);
  });
});

describe('review: the same phrase moved out of the bullets', () => {
  it('cuts it from a summary sentence', () => {
    const r = { ...resumeWith([ORIGINAL_BULLET]), summary: 'Data Analyst with 4 years of experience, presenting insights to non-technical stakeholders.' } as OptimizedResume;
    const out = removeJobOnlyPhrases(r, MAYA.resume, MAYA.job);
    expect(out.resume.summary).toBe('Data Analyst with 4 years of experience.');
  });

  it('lets a summary name the target role from the job title', () => {
    const r = { ...resumeWith(['Built 12 self-paced online course units in Moodle, used by 150 students during remote learning.'], 'Carmel High School'), summary: 'Instructional designer with 8 years of teaching experience.' } as OptimizedResume;
    expect(findJobOnlyBulletTerms(r, NOA.resume, NOA.job)).toEqual([]);
  });

  it('cuts it from a project description', () => {
    const r = { ...resumeWith([ORIGINAL_BULLET]), projects: [{ name: 'Monthly reports', description: 'Prepared monthly reports for managers, presenting insights to non-technical stakeholders.' }] } as unknown as OptimizedResume;
    const out = removeJobOnlyPhrases(r, MAYA.resume, MAYA.job);
    expect(out.resume.projects?.[0].description).toBe('Prepared monthly reports for managers.');
  });
});
