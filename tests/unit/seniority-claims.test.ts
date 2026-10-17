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
import { RESUME_OPTIMIZATION_SYSTEM_PROMPT } from '@/lib/prompts/resume-optimizer';

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
      achievements: ['Shipped the reconciliation service, leading a team of engineers.', 'Hired 6 engineers and ran quarterly performance reviews.'],
    });
    resume.experience = [resume.experience[0]];
    expect(enforceSeniorityTruth(resume, source, NOW).changed).toBe(false);
  });

  it('still cuts a head count the manager\'s résumé never states (2026-10-16, from #161)', () => {
    const source = `Maya Levi\nEngineering Manager, Ledgerly — Jan 2021 to Present\n- Hired 6 engineers and ran quarterly performance reviews.\n- Shipped the reconciliation service.`;
    const resume = priya({ summary: 'Engineering manager with 5 years of experience.' }, {
      title: 'Engineering Manager',
      company: 'Ledgerly',
      startDate: 'Jan 2021',
      achievements: ['Shipped the reconciliation service, leading a team of 8 engineers.', 'Hired 6 engineers and ran quarterly performance reviews.'],
    });
    resume.experience = [resume.experience[0]];
    expect(enforceSeniorityTruth(resume, source, NOW).resume.experience[0].achievements).toEqual([
      'Shipped the reconciliation service.',
      'Hired 6 engineers and ran quarterly performance reviews.',
    ]);
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

/**
 * Consolidation of #161 into this guard (2026-10-16): the PR Steward's #164 findings
 * (full role headers, per-role evidence, leadership synonyms, career gaps) and the
 * Hebrew and English cases #161 covered.
 */
describe('enforceSeniorityTruth: role headers read as whole blocks', () => {
  it('never restores a location line as the title', () => {
    const source = `Priya Raman\n\nTriangle Payments — May 2022 to Present\nRaleigh, NC\nSoftware Engineer\n- Led the design of a refund service.`;
    const out = enforceSeniorityTruth(priya({}, { title: 'Engineering Manager', achievements: ['Led the design of a refund service.'] }), source, NOW);
    expect(out.resume.experience[0].title).toBe('Software Engineer');
  });

  it('finds the company on the header line above the dated title line', () => {
    const source = `Priya Raman\n\nTriangle Payments | Raleigh, NC\nSoftware Engineer | May 2022 – Present\n- Led the design of a refund service.`;
    const out = enforceSeniorityTruth(priya({}, { title: 'Senior Software Engineer', achievements: ['Led the design of a refund service.'] }), source, NOW);
    expect(out.resume.experience[0].title).toBe('Software Engineer');
    expect(out.report.titlesRestored).toBe(1);
  });
});

const CAREER = `Maya Levi

Engineering Manager, Ledgerly — Jan 2022 to Present
- Led a team of 5 engineers on the reconciliation service.
- Hired 3 engineers.

Software Engineer, Oakridge Bank — Jun 2019 to Dec 2021
- Maintained Java batch jobs for account statements.
- Wrote the statement export tests.`;

function career(oakridge: Partial<OptimizedResume['experience'][number]>): OptimizedResume {
  const resume = priya({ summary: 'Engineering manager who builds payment services.' });
  resume.experience = [
    {
      title: 'Engineering Manager',
      company: 'Ledgerly',
      location: '',
      startDate: 'Jan 2022',
      endDate: 'Present',
      achievements: ['Led a team of 5 engineers on the reconciliation service.', 'Hired 3 engineers.'],
    },
    {
      title: 'Software Engineer',
      company: 'Oakridge Bank',
      location: '',
      startDate: 'Jun 2019',
      endDate: 'Dec 2021',
      achievements: ['Maintained Java batch jobs for account statements.', 'Wrote the statement export tests.'],
      ...oakridge,
    },
  ];
  return resume;
}

describe('enforceSeniorityTruth: evidence comes from the same role', () => {
  it('restores a title raised to a seniority the candidate held only at another job', () => {
    const out = enforceSeniorityTruth(career({ title: 'Engineering Manager' }), CAREER, NOW);
    expect(out.resume.experience[1].title).toBe('Software Engineer');
    expect(out.resume.experience[0].title).toBe('Engineering Manager');
  });

  it('cuts a leadership claim from a role where the candidate led no one', () => {
    const out = enforceSeniorityTruth(
      career({
        achievements: ['Maintained Java batch jobs for account statements, managing a team of 6 engineers.', 'Wrote the statement export tests.'],
      }),
      CAREER,
      NOW
    );
    expect(out.resume.experience[1].achievements[0]).toBe('Maintained Java batch jobs for account statements.');
    expect(out.resume.experience[0].achievements).toEqual(['Led a team of 5 engineers on the reconciliation service.', 'Hired 3 engineers.']);
  });
});

describe('enforceSeniorityTruth: leadership the résumé states in other words', () => {
  it.each([
    ['Managed a five-person department.', 'Managed a team of five, keeping supply orders on schedule.'],
    ['Led a group of six analysts.', 'Led a team of six analysts through month-end close.'],
    ['Supervised warehouse staff on the night shift.', 'Supervised a team on the night shift.'],
  ])('keeps a rewrite of "%s"', (sourceBullet, rewritten) => {
    const source = `Noa Mizrahi\n\nOperations Coordinator, Brightline — Jan 2020 to Present\n- ${sourceBullet}\n- Ran weekly supply orders.`;
    const resume = priya({ summary: 'Operations coordinator.' }, {
      title: 'Operations Coordinator',
      company: 'Brightline',
      startDate: 'Jan 2020',
      achievements: [rewritten, 'Ran weekly supply orders.'],
    });
    resume.experience = [resume.experience[0]];
    expect(enforceSeniorityTruth(resume, source, NOW).changed).toBe(false);
  });
});

describe('enforceSeniorityTruth: years count the time in roles, not the gaps between them', () => {
  it('lowers a claim that only the gap between two roles could reach', () => {
    const source = `Dan Avraham\n\nAccountant, Harbor & Co — Jan 2005 to Dec 2008\n- Closed the monthly books.\n\nAccountant, Cedar Group — Jan 2020 to Present\n- Prepared VAT returns.`;
    const resume = priya({ summary: 'Accountant with 15 years of experience in monthly close and VAT.' }, {
      title: 'Accountant',
      company: 'Cedar Group',
      startDate: 'Jan 2020',
      achievements: ['Prepared VAT returns.'],
    });
    resume.experience = [resume.experience[0]];
    const out = enforceSeniorityTruth(resume, source, NOW);
    expect(out.resume.summary).toBe('Accountant with 9 years of experience in monthly close and VAT.');
    expect(out.report.yearsCorrected).toBe(1);
  });
});

const ARMY_SOURCE = `איתי ברק
itai.barak@example.com | 050-0000003 | באר שבע

תקציר
קצין לוגיסטיקה לשעבר עם 5 שנות ניסיון בניהול שרשרת אספקה בצבא.

ניסיון תעסוקתי
קצין לוגיסטיקה, צבא ההגנה לישראל — אוגוסט 2019 עד יולי 2024
- ניהול מחסן ציוד של 1,200 פריטים ותכנון הפצה ל-14 יחידות.
- פיקוד על צוות של 9 חיילים.

רכז תפעול, מרכז הפצה נגב — ספטמבר 2024 עד היום
- תיאום משמרות וקליטת סחורה במרכז הפצה אזורי.`;

function army(summary: string, skills: string[] = []): OptimizedResume {
  const resume = priya({ summary, skills: { technical: ['Excel'], soft: skills } });
  resume.experience = [
    {
      title: 'קצין לוגיסטיקה',
      company: 'צבא ההגנה לישראל',
      location: '',
      startDate: 'אוגוסט 2019',
      endDate: 'יולי 2024',
      achievements: ['ניהול מחסן ציוד של 1,200 פריטים ותכנון הפצה ל-14 יחידות.', 'פיקוד על צוות של 9 חיילים.'],
    },
    { title: 'רכז תפעול', company: 'מרכז הפצה נגב', location: '', startDate: 'ספטמבר 2024', endDate: 'היום', achievements: ['תיאום משמרות וקליטת סחורה במרכז הפצה אזורי.'] },
  ];
  return resume;
}

const MARKETING_SOURCE = `מיכל אברהם

רכזת שיווק דיגיטלי, סטודיו אורן — יוני 2023 עד היום
- ניהול קמפיינים ממומנים בפייסבוק ובאינסטגרם.
- כתיבת תוכן לרשתות החברתיות.`;

function marketing(summary: string, skills: string[] = []): OptimizedResume {
  const resume = priya({ summary, skills: { technical: ['Meta Ads'], soft: skills } });
  resume.experience = [
    {
      title: 'רכזת שיווק דיגיטלי',
      company: 'סטודיו אורן',
      location: '',
      startDate: 'יוני 2023',
      endDate: 'היום',
      achievements: ['ניהול קמפיינים ממומנים בפייסבוק ובאינסטגרם.', 'כתיבת תוכן לרשתות החברתיות.'],
    },
  ];
  return resume;
}

describe('enforceSeniorityTruth: Hebrew (from #161)', () => {
  it('accepts every claim in an honest Hebrew rewrite, team command included', () => {
    const out = enforceSeniorityTruth(army('קצין לוגיסטיקה לשעבר עם 5 שנות ניסיון בניהול שרשרת אספקה, כולל פיקוד על צוות של 9 חיילים.'), ARMY_SOURCE, NOW);
    expect(out.changed).toBe(false);
    const managed = enforceSeniorityTruth(army('קצין לוגיסטיקה לשעבר עם ניסיון בניהול צוותים ושרשרת אספקה.'), ARMY_SOURCE, NOW);
    expect(managed.changed).toBe(false);
  });

  it('drops Hebrew team management invented for a marketing coordinator', () => {
    const out = enforceSeniorityTruth(marketing('רכזת שיווק דיגיטלי עם ניסיון בקמפיינים ממומנים. בעלת ניסיון בניהול צוותים.', ['ניהול צוות', 'כתיבה שיווקית']), MARKETING_SOURCE, NOW);
    expect(out.resume.summary).toBe('רכזת שיווק דיגיטלי עם ניסיון בקמפיינים ממומנים.');
    expect(out.resume.skills.soft).toEqual(['כתיבה שיווקית']);
  });

  it('reads "שמנהלת קמפיינים" as the campaign work the résumé shows', () => {
    const out = enforceSeniorityTruth(marketing('רכזת שיווק דיגיטלי שמנהלת קמפיינים ממומנים ברשתות חברתיות.'), MARKETING_SOURCE, NOW);
    expect(out.changed).toBe(false);
  });

  it.each(['סמנכ"ל שיווק', 'ראש מחלקת שיווק', 'דירקטורית שיווק'])('restores a Hebrew title raised to %s', (raised) => {
    const resume = marketing('רכזת שיווק דיגיטלי.');
    resume.experience[0] = { ...resume.experience[0], title: raised };
    expect(enforceSeniorityTruth(resume, MARKETING_SOURCE, NOW).resume.experience[0].title).toBe('רכזת שיווק דיגיטלי');
  });
});

describe('enforceSeniorityTruth: management claims (from #161)', () => {
  it('drops "management experience" claimed as such, and keeps account management', () => {
    const out = enforceSeniorityTruth(
      priya({ summary: 'Software engineer who builds payment services in Java. Brings 5 years of management experience.' }),
      PRIYA,
      NOW
    );
    expect(out.resume.summary).toBe('Software engineer who builds payment services in Java.');
    const account = enforceSeniorityTruth(
      priya({ summary: 'Software engineer with enterprise account management experience in payment services.' }),
      PRIYA,
      NOW
    );
    expect(account.changed).toBe(false);
  });

  it('drops management skills and keeps plain leadership and mentoring', () => {
    const out = enforceSeniorityTruth(priya({ skills: { technical: ['Java'], soft: ['Leadership', 'Mentoring', 'Team Leadership', 'People Management'] } }), PRIYA, NOW);
    expect(out.resume.skills.soft).toEqual(['Leadership', 'Mentoring']);
  });
});

describe('the optimizer prompt (from #161)', () => {
  it('forbids raising seniority or scope, and keeps the target role a goal', () => {
    expect(RESUME_OPTIMIZATION_SYSTEM_PROMPT).toContain('Never raise seniority or scope.');
    expect(RESUME_OPTIMIZATION_SYSTEM_PROMPT).toContain('Keep every job title exactly as the original resume gives it.');
    expect(RESUME_OPTIMIZATION_SYSTEM_PROMPT).toContain('never as who the candidate already is');
  });
});

/** Codex review of cd8c33a (2026-10-16). Each case failed on that head. */
describe('enforceSeniorityTruth: review of cd8c33a', () => {
  it('reads a title three lines above the dates (title / company / city / dates)', () => {
    const source = `Priya Raman\n\nEXPERIENCE\nSoftware Engineer\nAcme Corp\nNew York, NY\nJan 2020 – Dec 2022\n- Built the billing service.\n- Wrote its tests.`;
    const resume = priya({}, { title: 'Engineering Manager', company: 'Acme Corp', startDate: 'Jan 2020', achievements: ['Built the billing service.', 'Wrote its tests.'] });
    resume.experience = [resume.experience[0]];
    const out = enforceSeniorityTruth(resume, source, NOW);
    expect(out.resume.experience[0].title).toBe('Software Engineer');
  });

  it('does not count education dates as years of experience', () => {
    const source = `Dana Levi\n\nEXPERIENCE\nAnalyst, Acme — Jan 2022 to Present\n- Built weekly reports.\n\nEDUCATION\nBA Economics, State University — 2010 to 2014`;
    const resume = priya({ summary: 'Analyst with 8 years of experience in reporting.' }, { title: 'Analyst', company: 'Acme', startDate: 'Jan 2022', achievements: ['Built weekly reports.'] });
    resume.experience = [resume.experience[0]];
    expect(enforceSeniorityTruth(resume, source, NOW).resume.summary).toBe('Analyst with 4 years of experience in reporting.');
  });

  it('does not take an unrelated duration as stated experience', () => {
    const source = `Tal Mor\n\nFinancial Analyst, Westgate — Aug 2023 to Present\n- Analyzed 10 years of financial data for the annual budget.`;
    const resume = priya({ summary: 'Financial analyst with 10 years of experience in budgeting.' }, { title: 'Financial Analyst', company: 'Westgate', startDate: 'Aug 2023', achievements: ['Analyzed 10 years of financial data for the annual budget.'] });
    resume.experience = [resume.experience[0]];
    expect(enforceSeniorityTruth(resume, source, NOW).resume.summary).toBe('Financial analyst with 3 years of experience in budgeting.');
  });

  it('polices a factual claim inside a goal sentence, and still leaves a pure goal alone', () => {
    const out = enforceSeniorityTruth(
      priya({ summary: 'Software engineer who builds payment services in Java. Seeking to apply my experience managing teams.' }),
      PRIYA,
      NOW
    );
    expect(out.resume.summary).toBe('Software engineer who builds payment services in Java.');
    const goal = priya({ summary: 'Software engineer who builds payment services in Java. Seeking a role leading engineering teams.' });
    expect(enforceSeniorityTruth(goal, PRIYA, NOW).changed).toBe(false);
  });

  it.each([
    ['Managed a five-person department.', 'Managed a team that kept supply orders on schedule.'],
    ['Led a group of six analysts.', 'Managed a team through month-end close.'],
  ])('keeps "managed a team" when the résumé says "%s"', (sourceBullet, rewritten) => {
    const source = `Noa Mizrahi\n\nOperations Coordinator, Brightline — Jan 2020 to Present\n- ${sourceBullet}\n- Ran weekly supply orders.`;
    const resume = priya({ summary: 'Operations coordinator.' }, { title: 'Operations Coordinator', company: 'Brightline', startDate: 'Jan 2020', achievements: [rewritten, 'Ran weekly supply orders.'] });
    resume.experience = [resume.experience[0]];
    expect(enforceSeniorityTruth(resume, source, NOW).changed).toBe(false);
  });
});

// The two batch 3 failures #161 was opened for (2026-09-25, config 342f88a3e2fa), ported
// 2026-10-16: the summary named the target role as the candidate, and team sizes grew.
const ARMY = `איתי ברק
itai.barak@example.com | 050-0000003 | באר שבע

תקציר
קצין לוגיסטיקה לשעבר עם 5 שנות ניסיון בניהול שרשרת אספקה בצבא.

ניסיון תעסוקתי
קצין לוגיסטיקה, צבא ההגנה לישראל (צה"ל) — אוגוסט 2019 עד יולי 2024
- ניהול מחסן ציוד של 1,200 פריטים ותכנון הפצה ל-14 יחידות.
- פיקוד על צוות של 9 חיילים.
- הובלת מעבר ממעקב ידני לגיליונות Excel משותפים.

רכז תפעול, מרכז הפצה נגב — ספטמבר 2024 עד היום
- תיאום משמרות וקליטת סחורה במרכז הפצה אזורי.

השכלה
תואר ראשון בכלכלה וניהול, האוניברסיטה הפתוחה — 2023`;

function itai(summary: string, firstBullets?: string[]): OptimizedResume {
  return {
    summary,
    contact: { name: 'איתי ברק', email: 'itai.barak@example.com', phone: '050-0000003', location: 'באר שבע' },
    skills: { technical: ['Excel'], soft: [] },
    experience: [
      {
        title: 'קצין לוגיסטיקה',
        company: 'צבא ההגנה לישראל (צה"ל)',
        location: '',
        startDate: 'אוגוסט 2019',
        endDate: 'יולי 2024',
        achievements: firstBullets ?? ['ניהול מחסן ציוד של 1,200 פריטים ותכנון הפצה ל-14 יחידות', 'פיקוד על צוות של 9 חיילים', 'הובלת מעבר ממעקב ידני לגיליונות Excel משותפים'],
      },
      { title: 'רכז תפעול', company: 'מרכז הפצה נגב', location: '', startDate: 'ספטמבר 2024', endDate: 'היום', achievements: ['תיאום משמרות וקליטת סחורה במרכז הפצה אזורי'] },
    ],
    education: [],
    certifications: [],
    matchScore: 60,
    keyImprovements: [],
    missingKeywords: [],
  } as OptimizedResume;
}

const SARA = `Sara Kim
SUMMARY
Senior frontend engineer, 6 years of React experience.

EXPERIENCE
Senior Frontend Engineer, Lumen Software — Feb 2019 to Present
- Mentored 3 junior engineers.
- Built a component library used by 12 product teams.`;

const sara = (summary: string) =>
  ({
    ...priya({ summary }),
    experience: [
      { title: 'Senior Frontend Engineer', company: 'Lumen Software', location: '', startDate: 'Feb 2019', endDate: 'Present', achievements: ['Mentored 3 junior engineers.', 'Built a component library used by 12 product teams.'] },
    ],
  }) as OptimizedResume;

describe('enforceSeniorityTruth: who the summary says the candidate is (from #161)', () => {
  it.each([
    'מנהל תפעול עם ניסיון בניהול שרשרת אספקה ותפעול לוגיסטי, כולל פיקוד על צוותים וניהול מחסנים.',
    'מנהל תפעול עם ניסיון עשיר בניהול שרשרת אספקה וניהול צוותים, מחפש תפקיד במגזר העסקי לשיפור תהליכים ולהובלת צוותים.',
  ])('gives back the résumé\'s own summary when a logistics officer is called an operations manager: %s', (summary) => {
    const out = enforceSeniorityTruth(itai(summary), ARMY, NOW);
    expect(out.resume.summary).toBe('קצין לוגיסטיקה לשעבר עם 5 שנות ניסיון בניהול שרשרת אספקה בצבא.');
    expect(out.report.summaryTitlesRemoved).toBe(1);
  });

  it('drops the sentence that names the target role as the candidate, and keeps the honest one', () => {
    const out = enforceSeniorityTruth(
      priya({ summary: 'Engineering Manager with 5 years of experience building payment services. Built a refund service handling 30,000 requests a day.' }),
      PRIYA,
      NOW
    );
    expect(out.resume.summary).toBe('Built a refund service handling 30,000 requests a day.');
    expect(out.report.summaryTitlesRemoved).toBe(1);
  });

  it('leaves the target role alone when it is stated as a goal, in English and Hebrew', () => {
    const en = priya({ summary: 'Software engineer with 5 years of experience building payment services in Java. Seeking an Engineering Manager role.' });
    const he = itai('קצין לוגיסטיקה לשעבר עם 5 שנות ניסיון בניהול שרשרת אספקה. מחפש תפקיד של מנהל תפעול.');
    expect(enforceSeniorityTruth(en, PRIYA, NOW).changed).toBe(false);
    expect(enforceSeniorityTruth(he, ARMY, NOW).changed).toBe(false);
  });

  it('keeps a summary that changes specialty but not seniority, and still catches a raise', () => {
    expect(enforceSeniorityTruth(sara('Senior React Engineer with 6 years of experience in React.'), SARA, NOW).changed).toBe(false);
    const raised = enforceSeniorityTruth(sara('Principal React Engineer with 6 years of React experience.'), SARA, NOW);
    expect(raised.resume.summary).toBe('Senior frontend engineer, 6 years of React experience.');
  });

  it('reads Hebrew "מנהלת" as the verb it is when the résumé shows the same work', () => {
    const source = `מיכל אברהם\nתקציר\nרכזת שיווק דיגיטלי עם 3 שנות ניסיון בניהול קמפיינים ברשתות חברתיות.\n\nניסיון תעסוקתי\nרכזת שיווק דיגיטלי, סטודיו אורן — יוני 2023 עד היום\n- ניהול קמפיינים ממומנים בפייסבוק ובאינסטגרם.`;
    const out = { ...itai('רכזת שיווק דיגיטלי שמנהלת קמפיינים ממומנים ברשתות חברתיות.'), experience: [
      { title: 'רכזת שיווק דיגיטלי', company: 'סטודיו אורן', location: '', startDate: 'יוני 2023', endDate: 'היום', achievements: ['ניהול קמפיינים ממומנים בפייסבוק ובאינסטגרם.'] },
    ] } as OptimizedResume;
    expect(enforceSeniorityTruth(out, source, NOW).changed).toBe(false);
  });
});

describe('enforceSeniorityTruth: team size (from #161)', () => {
  const BILLING = `Sam Ortiz\nSUMMARY\nBackend engineer focused on billing systems.\n\nEXPERIENCE\nEngineer, Acme Robotics — Jan 2020 to Present\n- Led a team of 3 engineers on the billing rewrite.\n- Built firmware for 3 robot arms.`;
  const sam = (bullet: string) =>
    ({
      ...priya({ summary: 'Backend engineer focused on billing systems.' }),
      experience: [{ title: 'Engineer', company: 'Acme Robotics', location: '', startDate: 'Jan 2020', endDate: 'Present', achievements: [bullet, 'Built firmware for 3 robot arms.'] }],
    }) as OptimizedResume;

  it('cuts a bullet whose team of 3 became an org of 30', () => {
    const out = enforceSeniorityTruth(sam('Led an org of 30 engineers on the billing rewrite.'), BILLING, NOW);
    expect(out.resume.experience[0].achievements).toEqual(['Built firmware for 3 robot arms.']);
    expect(out.report.scopeRemoved).toBe(1);
  });

  it('accepts the same team size, however it is written', () => {
    expect(enforceSeniorityTruth(sam('Led a 3-person engineering team on the billing rewrite.'), BILLING, NOW).changed).toBe(false);
  });

  it('does not let "30,000 requests" support "30 engineers"', () => {
    const resume = priya({}, { achievements: ['Led the design of a refund service handling 30,000 requests a day.', 'Mentored 2 summer interns.', 'Ran sprint planning for 30 engineers across payments.'] });
    const out = enforceSeniorityTruth(resume, PRIYA, NOW);
    expect(out.resume.experience[0].achievements).toEqual(['Led the design of a refund service handling 30,000 requests a day.', 'Mentored 2 summer interns.']);
  });

  it('cuts a Hebrew team of 9 soldiers grown to 90', () => {
    const out = enforceSeniorityTruth(
      itai('קצין לוגיסטיקה לשעבר עם 5 שנות ניסיון בניהול שרשרת אספקה.', ['ניהול מחסן ציוד של 1,200 פריטים ותכנון הפצה ל-14 יחידות', 'פיקוד על צוות של 90 חיילים', 'הובלת מעבר ממעקב ידני לגיליונות Excel משותפים']),
      ARMY,
      NOW
    );
    expect(out.resume.experience[0].achievements).toEqual(['ניהול מחסן ציוד של 1,200 פריטים ותכנון הפצה ל-14 יחידות', 'הובלת מעבר ממעקב ידני לגיליונות Excel משותפים']);
  });

  it('leaves an honest Hebrew rewrite of the army résumé alone', () => {
    expect(enforceSeniorityTruth(itai('קצין לוגיסטיקה לשעבר עם 5 שנות ניסיון בניהול שרשרת אספקה בצבא.'), ARMY, NOW).changed).toBe(false);
  });
});
