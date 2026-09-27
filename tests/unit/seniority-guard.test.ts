/**
 * Reliability upgrade, seniority and scope story: the rewrite must not raise a job
 * title, enlarge a team, or claim people management the résumé never states. The
 * summaries marked "batch 3" are verbatim optimizer output from the 2026-09-25 paid
 * batch (config 342f88a3e2fa), where the grounded judge flagged them and every
 * deterministic check passed them.
 */
import { describe, it, expect, jest } from '@jest/globals';
import type { OptimizedResume } from '@/lib/ai-optimizer';
import {
  findSeniorityInflations,
  correctSeniorityInflations,
  enforceSeniorityTruth,
  type SeniorityRepair,
} from '@/lib/ai-optimizer/seniority-guard';

/** A repair stand-in typed like the real one, per tasks/lessons.md (Jest 30 mock typing). */
function repairReturning(value: OptimizedResume | null) {
  return jest.fn(async (...args: Parameters<SeniorityRepair>) => {
    void args;
    return value;
  });
}

type Role = { title: string; company: string; achievements: string[] };

function resume(summary: string, roles: Role[], technical: string[] = [], soft: string[] = []): OptimizedResume {
  return {
    summary,
    contact: { name: 'Test', email: 't@example.com', phone: '555', location: 'Here' },
    skills: { technical, soft },
    experience: roles.map((r) => ({ ...r, location: '', startDate: '2022', endDate: 'Present' })),
    education: [],
    certifications: [],
    matchScore: 0,
    keyImprovements: [],
    missingKeywords: [],
  };
}

// The unsupported-seniority-eng-manager eval case, verbatim.
const ENG_SOURCE = `Priya Raman
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

const ENG_ROLES: Role[] = [
  {
    title: 'Software Engineer II',
    company: 'Triangle Payments',
    achievements: [
      'Led the design of a refund service handling 30,000 requests a day, enhancing payment processing capabilities.',
      'Mentored 2 summer interns, fostering their development in software engineering.',
      'Ran sprint planning for a 5-person team during a 3-month managerial leave, ensuring project continuity.',
    ],
  },
  { title: 'Software Engineer', company: 'Oakridge Bank', achievements: ['Maintained Java batch jobs for account statements.'] },
];

// The he-career-change-army-to-ops eval case, verbatim.
const ARMY_SOURCE = `איתי ברק
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

const ARMY_ROLES: Role[] = [
  {
    title: 'קצין לוגיסטיקה',
    company: 'צבא ההגנה לישראל (צה"ל)',
    achievements: [
      'ניהול מחסן ציוד של 1,200 פריטים ותכנון הפצה ל-14 יחידות',
      'פיקוד על צוות של 9 חיילים',
      'הובלת מעבר ממעקב ידני לגיליונות Excel משותפים',
    ],
  },
  { title: 'רכז תפעול', company: 'מרכז הפצה נגב', achievements: ['תיאום משמרות וקליטת סחורה במרכז הפצה אזורי'] },
];

const MARKETING_SOURCE = `מיכל אברהם
תקציר
רכזת שיווק דיגיטלי עם 3 שנות ניסיון בניהול קמפיינים ברשתות חברתיות.

ניסיון תעסוקתי
רכזת שיווק דיגיטלי, סטודיו אורן — יוני 2023 עד היום
- ניהול קמפיינים ממומנים בפייסבוק ובאינסטגרם.`;

const BILLING_SOURCE = `Sam Ortiz
SUMMARY
Backend engineer focused on billing systems.

EXPERIENCE
Engineer, Acme Robotics — Jan 2020 to Present
- Led a team of 3 engineers on the billing rewrite.
- Built firmware for 3 robot arms.`;

const HE_DEV_SOURCE = `נועה לוי
ניסיון תעסוקתי
מפתח תוכנה, סייבר-טק — ינואר 2021 עד היום
- פיתוח שירותי API ב-Python.
- כתיבת בדיקות אוטומטיות לשירותי התשלום.`;

const kinds = (r: OptimizedResume, source: string) => findSeniorityInflations(r, source).map((i) => `${i.kind}:${i.place}`);

describe('findSeniorityInflations: job titles', () => {
  it('flags "Engineer" rewritten as "Lead Engineer"', () => {
    const out = resume('Backend engineer focused on billing systems.', [
      { title: 'Lead Engineer', company: 'Acme Robotics', achievements: ['Built firmware for 3 robot arms.'] },
    ]);
    expect(kinds(out, BILLING_SOURCE)).toEqual(['title:title']);
  });

  it('flags "Engineer" rewritten as "Head of Engineering"', () => {
    const out = resume('Backend engineer focused on billing systems.', [
      { title: 'Head of Engineering', company: 'Acme Robotics', achievements: ['Built firmware for 3 robot arms.'] },
    ]);
    expect(kinds(out, BILLING_SOURCE)).toEqual(['title:title']);
  });

  it('accepts a senior title the résumé already gives the role', () => {
    const source = BILLING_SOURCE.replace('Engineer, Acme', 'Senior Engineer, Acme');
    const out = resume('Backend engineer focused on billing systems.', [
      { title: 'Senior Engineer', company: 'Acme Robotics', achievements: ['Built firmware for 3 robot arms.'] },
    ]);
    expect(kinds(out, source)).toEqual([]);
  });

  it('does not let "the manager was on leave" excuse a new Manager title', () => {
    const roles = ENG_ROLES.map((r, i) => (i === 0 ? { ...r, title: 'Engineering Manager' } : r));
    const out = resume('Software engineer with 5 years of experience building payment services in Java.', roles);
    expect(kinds(out, ENG_SOURCE)).toEqual(['title:title']);
  });

  it('flags a Hebrew developer retitled as a team lead', () => {
    const out = resume('מפתח תוכנה עם ניסיון בפיתוח שירותי API.', [
      { title: 'ראש צוות פיתוח', company: 'סייבר-טק', achievements: ['פיתוח שירותי API ב-Python.'] },
    ]);
    expect(kinds(out, HE_DEV_SOURCE)).toEqual(['title:title']);
  });

  it('accepts every title in an honest Hebrew rewrite', () => {
    const out = resume('קצין לוגיסטיקה לשעבר עם 5 שנות ניסיון בניהול שרשרת אספקה, כולל פיקוד על צוות של 9 חיילים.', ARMY_ROLES);
    expect(kinds(out, ARMY_SOURCE)).toEqual([]);
  });
});

describe('findSeniorityInflations: who the summary says the candidate is', () => {
  it.each([
    'מנהל תפעול עם ניסיון בניהול שרשרת אספקה ותפעול לוגיסטי, כולל פיקוד על צוותים וניהול מחסנים.',
    'מנהל תפעול עם ניסיון בניהול שרשרת אספקה, ניהול צוותים ותיאום תפעול במגזר העסקי ובצבא.',
    'מנהל תפעול עם ניסיון עשיר בניהול שרשרת אספקה וניהול צוותים, מחפש תפקיד במגזר העסקי לשיפור תהליכים ולהובלת צוותים.',
  ])('flags the batch 3 Hebrew summary that calls a logistics officer an operations manager: %s', (summary) => {
    // The third one also states a goal, but it opens by claiming the title, so it is a claim.
    expect(kinds(resume(summary, ARMY_ROLES), ARMY_SOURCE)).toContain('title:summary');
  });

  it('flags "Engineering Manager" as the candidate identity', () => {
    const out = resume('Engineering Manager with 5 years of experience building payment services.', ENG_ROLES);
    expect(kinds(out, ENG_SOURCE)).toEqual(['title:summary']);
  });

  it('accepts the target role stated as a goal', () => {
    const en = resume('Software engineer with 5 years of experience building payment services in Java. Seeking an Engineering Manager role.', ENG_ROLES);
    const he = resume('קצין לוגיסטיקה לשעבר עם 5 שנות ניסיון בניהול שרשרת אספקה. מחפש תפקיד של מנהל תפעול.', ARMY_ROLES);
    expect(kinds(en, ENG_SOURCE)).toEqual([]);
    expect(kinds(he, ARMY_SOURCE)).toEqual([]);
  });

  it('reads Hebrew "מנהלת" as the verb it is when the résumé shows the same work', () => {
    const out = resume('רכזת שיווק דיגיטלי שמנהלת קמפיינים ממומנים ברשתות חברתיות.', [
      { title: 'רכזת שיווק דיגיטלי', company: 'סטודיו אורן', achievements: ['ניהול קמפיינים ממומנים בפייסבוק ובאינסטגרם.'] },
    ]);
    expect(kinds(out, MARKETING_SOURCE)).toEqual([]);
  });
});

describe('findSeniorityInflations: team size', () => {
  it('flags "team of 3" rewritten as "org of 30"', () => {
    const out = resume('Backend engineer focused on billing systems.', [
      { title: 'Engineer', company: 'Acme Robotics', achievements: ['Led an org of 30 engineers on the billing rewrite.', 'Built firmware for 3 robot arms.'] },
    ]);
    expect(kinds(out, BILLING_SOURCE)).toEqual(['scope:bullet']);
  });

  it('accepts the same team size, however it is written', () => {
    const out = resume('Backend engineer focused on billing systems.', [
      { title: 'Engineer', company: 'Acme Robotics', achievements: ['Led a 3-person engineering team on the billing rewrite.', 'Built firmware for 3 robot arms.'] },
    ]);
    expect(kinds(out, BILLING_SOURCE)).toEqual([]);
  });

  it('does not let "30,000 requests" support "30 engineers"', () => {
    const roles = ENG_ROLES.map((r, i) =>
      i === 0 ? { ...r, achievements: [...r.achievements.slice(0, 2), 'Ran sprint planning for 30 engineers across payments.'] } : r
    );
    const out = resume('Software engineer with 5 years of experience building payment services in Java.', roles);
    expect(kinds(out, ENG_SOURCE)).toEqual(['scope:bullet']);
  });

  it('flags a Hebrew team of 9 soldiers grown to 90', () => {
    const roles = ARMY_ROLES.map((r, i) =>
      i === 0 ? { ...r, achievements: [r.achievements[0], 'פיקוד על צוות של 90 חיילים', r.achievements[2]] } : r
    );
    const out = resume('קצין לוגיסטיקה לשעבר עם 5 שנות ניסיון בניהול שרשרת אספקה.', roles);
    expect(kinds(out, ARMY_SOURCE)).toEqual(['scope:bullet']);
  });
});

describe('findSeniorityInflations: people management the résumé never states', () => {
  it.each([
    'Experienced software engineer with a strong background in payment systems and team leadership. Proven ability to design high-volume systems and mentor junior engineers, enhancing team performance.',
    'Experienced software engineer specializing in payment services, with proven leadership in team management and system design. Skilled in enhancing payment processing efficiency and mentoring engineering talent.',
    'Experienced software engineer with expertise in payment systems, leading teams, and designing scalable services. Proven ability to enhance payment processing efficiency and mentor junior engineers.',
  ])('flags the batch 3 engineering summary: %s', (summary) => {
    expect(kinds(resume(summary, ENG_ROLES), ENG_SOURCE)).toEqual(['management:summary']);
  });

  it('flags management skills, not plain leadership or mentoring', () => {
    const out = resume('Software engineer with 5 years of experience building payment services in Java.', ENG_ROLES, ['Java'], [
      'Leadership',
      'Mentoring',
      'Team Leadership',
      'People Management',
    ]);
    expect(findSeniorityInflations(out, ENG_SOURCE).map((i) => i.phrase)).toEqual(['Team Leadership', 'People Management']);
  });

  it('accepts the batch 3 bullets that keep to the résumé', () => {
    const roles = ENG_ROLES.map((r, i) =>
      i === 0
        ? {
            ...r,
            achievements: [
              ...r.achievements,
              'Managed sprint planning for a 5-person team during a 3-month managerial leave, ensuring project continuity.',
            ],
          }
        : r
    );
    const out = resume('Software engineer with 5 years of experience building payment services in Java.', roles);
    expect(kinds(out, ENG_SOURCE)).toEqual([]);
  });

  it('accepts management the résumé states', () => {
    const source = `${BILLING_SOURCE}\n- Managed a team of 4 support agents.`;
    const out = resume('Backend engineer with team management experience.', [
      { title: 'Engineer', company: 'Acme Robotics', achievements: ['Led a team of 3 engineers on the billing rewrite.'] },
    ]);
    expect(kinds(out, source)).toEqual([]);
  });

  it('flags Hebrew team management invented for a marketing coordinator', () => {
    const out = resume('רכזת שיווק דיגיטלי עם ניסיון בניהול צוותים וקמפיינים ממומנים.', [
      { title: 'רכזת שיווק דיגיטלי', company: 'סטודיו אורן', achievements: ['ניהול קמפיינים ממומנים בפייסבוק ובאינסטגרם.'] },
    ]);
    expect(kinds(out, MARKETING_SOURCE)).toEqual(['management:summary']);
  });

  it('accepts Hebrew team management when the résumé shows command of a team', () => {
    const out = resume('קצין לוגיסטיקה לשעבר עם ניסיון בניהול צוותים ושרשרת אספקה.', ARMY_ROLES);
    expect(kinds(out, ARMY_SOURCE)).toEqual([]);
  });

  it('passes the batch 3 teacher rewrite, which leads workshops, not people', () => {
    const out = resume(
      'Experienced science educator with expertise in curriculum design and teacher training, transitioning to corporate instructional design. Skilled in developing engaging learning materials and facilitating digital education tools.',
      [
        {
          title: 'Science Teacher',
          company: 'Maple Grove High School',
          achievements: [
            'Designed a 9th grade biology curriculum adopted by 4 teachers, enhancing instructional consistency.',
            'Led after-school workshops training colleagues on Google Classroom, improving digital teaching skills across the department.',
          ],
        },
      ],
      ['Curriculum Design', 'Google Classroom'],
      ['Collaboration', 'Training']
    );
    const source = `Rachel Stein
SUMMARY
Science teacher with 9 years of classroom experience.

EXPERIENCE
Science Teacher, Maple Grove High School — Aug 2019 to Present
- Designed a 9th grade biology curriculum adopted by 4 teachers in the department.
- Led after-school workshops training colleagues on Google Classroom.`;
    expect(kinds(out, source)).toEqual([]);
  });
});

describe('correctSeniorityInflations', () => {
  it('puts back the title the résumé gives the role', () => {
    const lead = resume('Backend engineer focused on billing systems.', [
      { title: 'Lead Engineer', company: 'Acme Robotics', achievements: ['Built firmware for 3 robot arms.'] },
    ]);
    const manager = resume('Software engineer with 5 years of experience building payment services in Java.', [
      { ...ENG_ROLES[0], title: 'Engineering Manager' },
      ENG_ROLES[1],
    ]);
    const he = resume('מפתח תוכנה עם ניסיון בפיתוח שירותי API.', [
      { title: 'ראש צוות פיתוח', company: 'סייבר-טק', achievements: ['פיתוח שירותי API ב-Python.'] },
    ]);
    expect(correctSeniorityInflations(lead, BILLING_SOURCE).resume.experience[0].title).toBe('Engineer');
    expect(correctSeniorityInflations(manager, ENG_SOURCE).resume.experience[0].title).toBe('Software Engineer II');
    expect(correctSeniorityInflations(he, HE_DEV_SOURCE).resume.experience[0].title).toBe('מפתח תוכנה');
  });

  it('drops an inflated summary sentence when an honest one remains', () => {
    const out = resume(
      'Experienced software engineer with expertise in payment systems, leading teams, and designing scalable services. Proven ability to enhance payment processing efficiency and mentor junior engineers.',
      ENG_ROLES
    );
    const fixed = correctSeniorityInflations(out, ENG_SOURCE);
    expect(fixed.resume.summary).toBe('Proven ability to enhance payment processing efficiency and mentor junior engineers.');
    expect(fixed.unresolved).toEqual([]);
  });

  it("falls back to the résumé's own summary when every sentence is inflated", () => {
    const out = resume('מנהל תפעול עם ניסיון בניהול שרשרת אספקה ותפעול לוגיסטי, כולל פיקוד על צוותים וניהול מחסנים.', ARMY_ROLES);
    const fixed = correctSeniorityInflations(out, ARMY_SOURCE);
    expect(fixed.resume.summary).toBe('קצין לוגיסטיקה לשעבר עם 5 שנות ניסיון בניהול שרשרת אספקה בצבא.');
    expect(findSeniorityInflations(fixed.resume, ARMY_SOURCE)).toEqual([]);
  });

  it('reports an inflated summary it cannot fix, and leaves it in place', () => {
    const source = BILLING_SOURCE.replace('SUMMARY\nBackend engineer focused on billing systems.\n', '');
    const out = resume('Head of Engineering for billing systems.', [
      { title: 'Engineer', company: 'Acme Robotics', achievements: ['Built firmware for 3 robot arms.'] },
    ]);
    const fixed = correctSeniorityInflations(out, source);
    expect(fixed.resume.summary).toBe('Head of Engineering for billing systems.');
    expect(fixed.unresolved.map((i) => `${i.kind}:${i.place}`)).toEqual(['title:summary']);
  });

  it("reverts an inflated bullet to the résumé's own line", () => {
    const out = resume('Backend engineer focused on billing systems.', [
      {
        title: 'Engineer',
        company: 'Acme Robotics',
        achievements: ['Led an org of 30 engineers on the billing rewrite, shipping it on schedule.', 'Built firmware for 3 robot arms.'],
      },
    ]);
    const fixed = correctSeniorityInflations(out, BILLING_SOURCE);
    expect(fixed.resume.experience[0].achievements).toEqual(['Led a team of 3 engineers on the billing rewrite.', 'Built firmware for 3 robot arms.']);
  });

  it('drops a management skill and keeps plain leadership', () => {
    const out = resume('Software engineer with 5 years of experience building payment services in Java.', ENG_ROLES, ['Java'], [
      'Leadership',
      'Team Leadership',
    ]);
    expect(correctSeniorityInflations(out, ENG_SOURCE).resume.skills.soft).toEqual(['Leadership']);
  });
});

describe('enforceSeniorityTruth', () => {
  const INFLATED = resume('Experienced software engineer with a strong background in payment systems and team leadership.', ENG_ROLES);
  const HONEST = resume('Software engineer with 5 years of experience building payment services in Java.', ENG_ROLES);

  it('leaves an honest rewrite alone and makes no repair call', async () => {
    const repair = repairReturning(null);
    const out = await enforceSeniorityTruth(HONEST, { resumeText: ENG_SOURCE, repair });
    expect(repair).not.toHaveBeenCalled();
    expect(out.changed).toBe(false);
    expect(out.report).toMatchObject({ foundBefore: [], retried: false });
  });

  it('accepts one repair that removes the inflation', async () => {
    const repair = repairReturning(HONEST);
    const out = await enforceSeniorityTruth(INFLATED, { resumeText: ENG_SOURCE, repair });
    expect(repair).toHaveBeenCalledTimes(1);
    expect(repair.mock.calls[0][1].map((i) => i.phrase)).toEqual(['team leadership']);
    expect(out.resume).toBe(HONEST);
    expect(out.report).toMatchObject({ retried: true, repairAccepted: true, corrected: 0, unresolved: [] });
  });

  it('corrects deterministically when the repair still inflates', async () => {
    const out = await enforceSeniorityTruth(INFLATED, { resumeText: ENG_SOURCE, repair: repairReturning(INFLATED) });
    expect(out.report).toMatchObject({ repairAccepted: false, corrected: 1, unresolved: [] });
    expect(out.resume.summary).toBe('Software engineer with 5 years of experience building payment services in Java.');
  });

  it('corrects deterministically when the repair call fails', async () => {
    const repair = jest.fn(async (...args: Parameters<SeniorityRepair>) => {
      void args;
      throw new Error('timeout');
    });
    const out = await enforceSeniorityTruth(INFLATED, { resumeText: ENG_SOURCE, repair });
    expect(out.report).toMatchObject({ repairAccepted: false, corrected: 1 });
    expect(findSeniorityInflations(out.resume, ENG_SOURCE)).toEqual([]);
  });

  it('rejects a repair that deletes the evidence', async () => {
    const gutted = resume(HONEST.summary, [{ ...ENG_ROLES[0], achievements: [] }, { ...ENG_ROLES[1], achievements: [] }]);
    const out = await enforceSeniorityTruth(INFLATED, { resumeText: ENG_SOURCE, repair: repairReturning(gutted) });
    expect(out.report.repairAccepted).toBe(false);
    expect(out.resume.experience[0].achievements).toHaveLength(3);
  });

  it('reports kinds and places, never résumé text', async () => {
    const out = await enforceSeniorityTruth(INFLATED, { resumeText: ENG_SOURCE, repair: repairReturning(INFLATED) });
    expect(out.report.foundBefore).toEqual([{ kind: 'management', place: 'summary' }]);
    expect(JSON.stringify(out.report)).not.toMatch(/leadership|payment/i);
  });
});
