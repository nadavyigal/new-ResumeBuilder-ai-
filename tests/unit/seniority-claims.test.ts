/**
 * Seniority and scope guard (reliability upgrade, after Stage 2). The cases come from
 * the 2026-09-25 repeat batches and the calibration set in evals/resume-optimizer:
 * a retitled role (cal-07), "8+ years" on a three-year career (cal-06), and
 * "leading teams", "mentoring teams" and "a proven track record in managing
 * engineering projects" for an engineer who mentored 2 interns
 * (unsupported-seniority-eng-manager).
 */
import { describe, it, expect } from '@jest/globals';
import { enforceSeniorityTruth } from '@/lib/ai-optimizer/seniority-claims';
import type { OptimizedResume } from '@/lib/ai-optimizer';

const NOW = new Date('2026-10-07T00:00:00Z');

const PRIYA = `Priya Raman
priya.raman@example.com | 555-0117 | Raleigh, NC

SUMMARY
Software engineer with 5 years of experience building payment services in Java.

EXPERIENCE
Software Engineer II, Triangle Payments — May 2022 to Present
- Led the design of a refund service handling 30,000 requests a day.
- Mentored 2 summer interns.
- Ran sprint planning for a 5-person team while the manager was on leave for 3 months.

Software Engineer, Oakridge Bank — Jun 2021 to Apr 2022
- Maintained Java batch jobs for account statements.

EDUCATION
BS Computer Engineering, NC State University — 2021`;

const TOM = `Tom Walsh
tom.walsh@example.com | 555-0103 | Denver, CO

EXPERIENCE
Financial Analyst, Westgate Capital — Aug 2023 to Present
- Built quarterly financial models in Excel.
- Assisted senior analysts with budget variance reports.

EDUCATION
BS Finance, University of Colorado Boulder — 2023`;

const LEAD = `Dana Cohen
Support Team Lead, Brightdesk — Mar 2020 to Present
- Led a team of 4 support analysts through a ticketing migration.
- Cut first-response time from 9 hours to 2 hours.`;

function priya(overrides: Partial<OptimizedResume> = {}, firstRole: Partial<OptimizedResume['experience'][number]> = {}): OptimizedResume {
  return {
    summary: 'Software engineer with 5 years of experience building payment services in Java.',
    contact: { name: 'Priya Raman', email: 'priya.raman@example.com', phone: '555-0117', location: 'Raleigh, NC' },
    skills: { technical: ['Java', 'Payments'], soft: ['Mentoring'] },
    experience: [
      {
        title: 'Software Engineer II',
        company: 'Triangle Payments',
        location: 'Raleigh, NC',
        startDate: 'May 2022',
        endDate: 'Present',
        achievements: ['Led the design of a refund service handling 30,000 requests a day.', 'Mentored 2 summer interns.'],
        ...firstRole,
      },
      {
        title: 'Software Engineer',
        company: 'Oakridge Bank',
        location: 'Raleigh, NC',
        startDate: 'Jun 2021',
        endDate: 'Apr 2022',
        achievements: ['Maintained Java batch jobs for account statements.'],
      },
    ],
    education: [],
    certifications: [],
    matchScore: 60,
    keyImprovements: [],
    missingKeywords: [],
    ...overrides,
  } as OptimizedResume;
}

describe('enforceSeniorityTruth: titles', () => {
  it('puts back the original title when the rewrite promotes the role (cal-07)', () => {
    const out = enforceSeniorityTruth(priya({}, { title: 'Engineering Manager' }), PRIYA, NOW);
    expect(out.resume.experience[0].title).toBe('Software Engineer II');
    expect(out.report.titlesRestored).toBe(1);
    expect(out.changed).toBe(true);
  });

  it('accepts a title the résumé already uses, and "Senior" for a source "Sr."', () => {
    const input = priya();
    const clean = enforceSeniorityTruth(input, PRIYA, NOW);
    expect(clean.changed).toBe(false);
    expect(clean.resume).toBe(input);

    const sr = `Sr. Software Engineer, Triangle Payments — May 2022 to Present\n- Built the refund service.`;
    const out = enforceSeniorityTruth(priya({}, { title: 'Senior Software Engineer' }), sr, NOW);
    expect(out.resume.experience[0].title).toBe('Senior Software Engineer');
    expect(out.report.titlesRestored).toBe(0);
  });

  it('restores a Hebrew title raised to team lead', () => {
    const source = `נועה לוי\nמפתחת תוכנה, חברת אלפא — ינואר 2021 עד היום\n- פיתחה שירותי תשלום.`;
    const resume = priya({}, { title: 'ראש צוות פיתוח', company: 'חברת אלפא', achievements: ['פיתחה שירותי תשלום.'] });
    const out = enforceSeniorityTruth(resume, source, NOW);
    expect(out.resume.experience[0].title).toBe('מפתחת תוכנה');
  });
});

describe('enforceSeniorityTruth: years of experience', () => {
  it('lowers "8+ years" to what the dated roles show (cal-06)', () => {
    const resume = priya({
      summary: 'Financial analyst with 8+ years of FP&A experience building quarterly models and budget variance reports.',
      experience: [
        {
          title: 'Financial Analyst',
          company: 'Westgate Capital',
          location: 'Denver, CO',
          startDate: 'Aug 2023',
          endDate: 'Present',
          achievements: ['Built quarterly financial models in Excel.'],
        },
      ],
    });
    const out = enforceSeniorityTruth(resume, TOM, NOW);
    expect(out.resume.summary).toBe('Financial analyst with 3 years of FP&A experience building quarterly models and budget variance reports.');
    expect(out.report.yearsCorrected).toBe(1);
  });

  it('keeps a years figure the résumé states, and leaves undated résumés alone', () => {
    expect(enforceSeniorityTruth(priya(), PRIYA, NOW).report.yearsCorrected).toBe(0);
    const undated = 'Jo Park\nBarista, Bean Co\n- Trained new staff.';
    const out = enforceSeniorityTruth(priya({ summary: 'Barista with 6 years of experience.' }), undated, NOW);
    expect(out.resume.summary).toBe('Barista with 6 years of experience.');
  });
});

describe('enforceSeniorityTruth: people leadership and track-record claims', () => {
  it('drops "leading teams" claims from the summary and cuts the clause from a bullet', () => {
    const resume = priya(
      {
        summary:
          'Software engineer with 5 years of experience building payment services in Java. Experienced in leading teams and mentoring teams.',
      },
      {
        achievements: [
          'Led the design of a refund service handling 30,000 requests a day, leading a team of 5 engineers.',
          'Mentored 2 summer interns.',
        ],
      }
    );
    const out = enforceSeniorityTruth(resume, PRIYA, NOW);
    expect(out.resume.summary).toBe('Software engineer with 5 years of experience building payment services in Java.');
    expect(out.resume.experience[0].achievements).toEqual([
      'Led the design of a refund service handling 30,000 requests a day.',
      'Mentored 2 summer interns.',
    ]);
    expect(out.report.scopeRemoved).toBe(2);
  });

  it('cuts "a proven track record in managing engineering projects"', () => {
    const resume = priya({
      summary:
        'Software engineer with 5 years of experience in Java payment services and a proven track record in managing engineering projects.',
    });
    const out = enforceSeniorityTruth(resume, PRIYA, NOW);
    expect(out.resume.summary).toBe('Software engineer with 5 years of experience in Java payment services.');
  });

  it('drops an unsupported "People management" skill and keeps "Mentoring"', () => {
    const out = enforceSeniorityTruth(priya({ skills: { technical: ['Java'], soft: ['Mentoring', 'People management'] } }), PRIYA, NOW);
    expect(out.resume.skills.soft).toEqual(['Mentoring']);
  });

  it('leaves a truthful reword of "Ran sprint planning for a 5-person team" alone', () => {
    const out = enforceSeniorityTruth(priya({}, { achievements: ['Led sprint planning for the team during a 3-month manager leave.'] }), PRIYA, NOW);
    expect(out.changed).toBe(false);
  });

  it('keeps leadership claims the résumé supports', () => {
    const resume = priya(
      { summary: 'Support team lead experienced in leading teams of analysts.', skills: { technical: [], soft: ['Team leadership'] } },
      { title: 'Support Team Lead', company: 'Brightdesk', achievements: ['Led a team of 4 support analysts through a ticketing migration.'] }
    );
    resume.experience = [resume.experience[0]];
    expect(enforceSeniorityTruth(resume, LEAD, NOW).changed).toBe(false);
  });

  it('does not police a stated goal', () => {
    const resume = priya({
      summary: 'Software engineer with 5 years of experience building payment services in Java. Aiming to grow into leading engineering teams.',
    });
    expect(enforceSeniorityTruth(resume, PRIYA, NOW).changed).toBe(false);
  });

  it('never empties a role: a lone inflated bullet is reported, not deleted', () => {
    const resume = priya({}, { achievements: ['Managed a team of 5 engineers building the refund service.'] });
    const out = enforceSeniorityTruth(resume, PRIYA, NOW);
    expect(out.resume.experience[0].achievements).toEqual(['Managed a team of 5 engineers building the refund service.']);
    expect(out.report.unresolved).toBe(1);
  });

  it('reports counts only, never résumé text', () => {
    const resume = priya({ summary: 'Engineer. Experienced in leading teams.' }, { title: 'Engineering Manager' });
    const report = JSON.stringify(enforceSeniorityTruth(resume, PRIYA, NOW).report);
    expect(report).not.toMatch(/teams|Manager|Priya|Triangle/);
  });
});

describe('enforceSeniorityTruth: false positives found in review (2026-10-07)', () => {
  it('reads "2016-Present" as a role range, so the dates support "10 years" over a stale "6 years"', () => {
    const source = `Lior Ben-David\nData analyst with 6 years of experience.\n\nData Analyst, Northwind | 2016-Present\n- Built weekly revenue dashboards.\n\nJunior Analyst, Contoso | 03/2014-12/2015\n- Cleaned sales data.`;
    const resume = priya({ summary: 'Data analyst with 10 years of experience building revenue dashboards.' }, {
      title: 'Data Analyst',
      company: 'Northwind',
      achievements: ['Built weekly revenue dashboards.'],
    });
    resume.experience = [resume.experience[0]];
    const out = enforceSeniorityTruth(resume, source, NOW);
    expect(out.changed).toBe(false);
  });

  it('lets a manager title support leadership claims its bullets never spell out', () => {
    const source = `Maya Levi\nEngineering Manager, Ledgerly — Jan 2021 to Present\n- Hired 6 engineers and ran quarterly performance reviews.\n- Shipped the reconciliation service.`;
    const resume = priya({ summary: 'Engineering manager with 5 years of experience.' }, {
      title: 'Engineering Manager',
      company: 'Ledgerly',
      startDate: 'Jan 2021',
      achievements: ['Shipped the reconciliation service, leading a team of 8 engineers.', 'Hired 6 engineers and ran quarterly performance reviews.'],
    });
    resume.experience = [resume.experience[0]];
    expect(enforceSeniorityTruth(resume, source, NOW).changed).toBe(false);
  });

  it('reads a title written on the line below "Company — dates", and never restores a date as a title', () => {
    const source = `Priya Raman\nTriangle Payments — May 2022 to Present\nSenior Software Engineer\n- Led the design of a refund service.`;
    const kept = enforceSeniorityTruth(priya({}, { title: 'Senior Backend Engineer', achievements: ['Led the design of a refund service.'] }), source, NOW);
    expect(kept.resume.experience[0].title).toBe('Senior Backend Engineer');

    const promoted = enforceSeniorityTruth(priya({}, { title: 'Engineering Manager', achievements: ['Led the design of a refund service.'] }), source, NOW);
    expect(promoted.resume.experience[0].title).toBe('Senior Software Engineer');
    expect(promoted.resume.experience[0].title).not.toMatch(/20\d\d|Present/);
  });

  it('never restores the candidate\'s name as a title', () => {
    const source = `Priya Raman\nTriangle Payments — May 2022 to Present\n- Led the design of a refund service.`;
    const out = enforceSeniorityTruth(priya({}, { title: 'Engineering Manager', achievements: ['Led the design of a refund service.'] }), source, NOW);
    expect(out.resume.experience[0].title).not.toBe('Priya Raman');
    expect(out.report.unresolved).toBe(1);
  });

  it('keeps the summary text exactly as written when only a title is corrected', () => {
    const summary = 'Software engineer with 5 years of experience.\nBuilds payment services in Java.';
    const out = enforceSeniorityTruth(priya({ summary }, { title: 'Engineering Manager' }), PRIYA, NOW);
    expect(out.resume.experience[0].title).toBe('Software Engineer II');
    expect(out.resume.summary).toBe(summary);
  });

  it('does not read Hebrew "מנהלה" (administration) as "מנהל" (manager)', () => {
    const source = `דנה כהן\nרכזת משרד, חברת בטא — מרץ 2020 עד היום\n- ניהלה את יומן הפגישות.`;
    const resume = priya({}, { title: 'רכזת מנהלה', company: 'חברת בטא', achievements: ['ניהלה את יומן הפגישות.'] });
    resume.experience = [resume.experience[0]];
    expect(enforceSeniorityTruth(resume, source, NOW).resume.experience[0].title).toBe('רכזת מנהלה');
  });
});
