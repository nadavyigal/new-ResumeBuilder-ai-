import fs from 'fs';
import { describe, expect, it } from '@jest/globals';
import { checkQuickWinGrounding, findJobOnlyTerms, type GroundingContext } from '@/lib/ats/quick-wins/grounding';
import { findJobOnlyBulletTerms } from '@/lib/ai-optimizer/job-ad-terms';
import type { QuickWinSuggestion } from '@/lib/ats/types';

/**
 * Hebrew job-term matching, PR #170 review (Codex, confirmed by the PR Steward on
 * 2026-10-13 with these exact inputs). Each case below failed on 821d5f7.
 */

function qw(original_text: string, optimized_text: string): QuickWinSuggestion {
  return {
    id: 'he',
    original_text,
    optimized_text,
    improvement_type: 'keyword_optimization',
    estimated_impact: 5,
    location: { section: 'experience' },
    rationale: '',
    keywords_added: [],
  };
}

function ctx(resumeText: string, jobText: string): GroundingContext {
  return { resumeText, jobText };
}

describe('Hebrew job-only terms: confirmed review cases', () => {
  it('P1 authority: supporting a team does not become managing it', () => {
    const c = ctx('דנה לוי\nנציגת שירות, מוקד טלפוני\n• תמכתי בצוות השירות.', 'ראש צוות שירות. ניהול צוות השירות.');
    const check = checkQuickWinGrounding(qw('תמכתי בצוות השירות.', 'ניהול צוות השירות.'), c);
    expect(check.ok).toBe(false);
    expect(findJobOnlyTerms('ניהול צוות השירות.', c)).toContain('ניהול');
  });

  it('P1 lexical initials: "הכשרה" (training) is not supported by the name "שרה"', () => {
    const c = ctx('שרה\nרכזת משרד\n• טיפלתי בדוחות.', 'רכז/ת הדרכה. אחריות על הכשרה של עובדים חדשים. טיפול בדוחות.');
    expect(findJobOnlyTerms('טיפלתי בדוחות והכשרה.', c)).toEqual(['והכשרה']);
    expect(checkQuickWinGrounding(qw('טיפלתי בדוחות.', 'טיפלתי בדוחות והכשרה.'), c).violations).toContain('job_terms_added');
  });

  it('P1 lexical collision: "מכירות" (sales) is not supported by "שירות" (service)', () => {
    const c = ctx('דנה לוי\nנציגת שירות\n• טיפלתי בפניות שירות.', 'נציג/ת מכירות. טיפול בפניות מכירות.');
    expect(findJobOnlyTerms('טיפלתי בפניות מכירות.', c)).toEqual(['מכירות']);
    expect(checkQuickWinGrounding(qw('טיפלתי בפניות שירות.', 'טיפלתי בפניות מכירות.'), c).ok).toBe(false);
  });

  it('P2 feminine singular: "משימה" is supported by the résumé\'s "משימות"', () => {
    const c = ctx('דנה לוי\nרכזת פרויקטים\n• טיפלתי במשימות.', 'רכז/ת פרויקטים. טיפול במשימה.');
    expect(findJobOnlyTerms('טיפלתי במשימה.', c)).toEqual([]);
    expect(checkQuickWinGrounding(qw('טיפלתי במשימות.', 'טיפלתי במשימה.'), c)).toMatchObject({ ok: true, violations: [] });
  });
});

describe('Hebrew job-only terms: controls that must keep working', () => {
  const noa = ctx(
    'נועה מזרחי\nמורה למתמטיקה, תיכון כרמל 2017 – היום\n• טיפלתי בדוחות חודשיים למנהלים.\n• בניתי 12 יחידות לימוד מקוונות במודל.',
    'מעצב/ת הדרכה. הכנת דוחות והצגת תובנות לבעלי עניין. פיתוח יחידות לימוד.',
  );

  it.each([
    ['proclitic dropped', 'טיפלתי בדוחות חודשיים למנהלים.', 'טיפלתי בדוחות החודשיים למנהלים.'],
    ['non-authority verb swap', 'טיפלתי בדוחות חודשיים למנהלים.', 'הכנת דוחות חודשיים למנהלים.'],
    ['verb swap to the action noun', 'בניתי 12 יחידות לימוד מקוונות במודל.', 'פיתוח 12 יחידות לימוד מקוונות במודל.'],
    ['two proclitics added', 'בניתי 12 יחידות לימוד מקוונות במודל.', 'בניתי 12 יחידות לימוד מקוונות ובמודל.'],
  ])('accepts an honest rewrite: %s', (_label, original, optimized) => {
    expect(checkQuickWinGrounding(qw(original, optimized), noa)).toMatchObject({ ok: true, violations: [] });
  });

  it('still flags a job-post duty', () => {
    expect(findJobOnlyTerms('טיפלתי בדוחות חודשיים והצגתי תובנות לבעלי עניין.', noa)).toEqual(
      expect.arrayContaining(['תובנות']),
    );
  });

  it('a "manage" swap passes when the bullet already claims authority', () => {
    const c = ctx('דנה לוי\nראש צוות\n• הובלתי את צוות השירות.', 'ראש צוות שירות. ניהול צוות השירות.');
    expect(checkQuickWinGrounding(qw('הובלתי את צוות השירות.', 'ניהלתי את צוות השירות.'), c)).toMatchObject({ ok: true });
  });

  it('"for managers" is not an authority claim', () => {
    const c = ctx(noa.resumeText, 'ניהול דוחות חודשיים.');
    expect(checkQuickWinGrounding(qw('טיפלתי בדוחות חודשיים למנהלים.', 'ניהול דוחות חודשיים למנהלים.'), c).ok).toBe(false);
  });
});

describe('Hebrew job ad fixture (fictional, 2026-10-15)', () => {
  const dir = `${__dirname}/../fixtures/he-job-terms-2026-10-15`;
  const dana = ctx(
    fs.readFileSync(`${dir}/dana-levi-resume.txt`, 'utf8'),
    fs.readFileSync(`${dir}/job-customer-service-team-lead.txt`, 'utf8'),
  );

  it.each([
    ['verb to the job\'s action noun', 'טיפול בפניות שירות בטלפון ובצ\'אט, כ-60 פניות ביום.'],
    ['"מעקב" for "עקבתי"', 'מעקב אחרי משימות פתוחות במערכת ה-CRM עד לסגירתן.'],
    ['singular of a résumé plural', 'עקבתי אחרי כל משימה פתוחה במערכת ה-CRM עד לסגירתה.'],
    ['proclitics moved', 'תמכתי בצוות השירות ובהדרכת העובדים החדשים.'],
  ])('honest rewrite holds nothing: %s', (_label, rewrite) => {
    expect(findJobOnlyTerms(rewrite, dana)).toEqual([]);
  });

  it.each([
    ['management of the team', 'ניהול צוות השירות והכשרה של עובדים חדשים.', ['ניהול', 'והכשרה']],
    ['escalations of business customers', 'טיפלתי בפניות שירות והסלמות של לקוחות עסקיים.', ['והסלמות', 'עסקיים']],
    ['shift scheduling', 'עקבתי אחרי משימות פתוחות ושיבוץ משמרות.', ['ושיבוץ', 'משמרות']],
    ['sales instead of service', 'טיפלתי בפניות מכירות בטלפון ובצ\'אט.', ['מכירות']],
    ['satisfaction metrics', 'עקבתי אחרי מדדי שביעות רצון.', ['מדדי', 'שביעות', 'רצון']],
  ])('job-post claim is flagged: %s', (_label, rewrite, expected) => {
    expect(findJobOnlyTerms(rewrite, dana).sort()).toEqual([...expected].sort());
  });
});

// Codex review of efa8926 (2026-10-15).
describe('Hebrew job-only terms: second review', () => {
  it('P1 authority is scoped to the role, not the whole résumé', () => {
    const resumeText = [
      'דנה לוי',
      'נציגת שירות, מוקד אופק 2021 – היום',
      '• תמכתי בצוות השירות.',
      'אחראית משמרת, רשת קפה 2017 – 2021',
      '• ניהלתי צוות של 6 עובדים.',
    ].join('\n');
    const job = 'ראש צוות שירות. ניהול צוות השירות.';
    const resume = {
      summary: '',
      experience: [
        { company: 'מוקד אופק', title: 'נציגת שירות', achievements: ['ניהול צוות השירות.'] },
        { company: 'רשת קפה', title: 'אחראית משמרת', achievements: ['ניהול צוות של 6 עובדים.'] },
      ],
    } as unknown as Parameters<typeof findJobOnlyBulletTerms>[0];
    const found = findJobOnlyBulletTerms(resume, resumeText, job);
    expect(found).toEqual([{ bullet: 'ניהול צוות השירות.', terms: ['ניהול'] }]);
  });

  it('P1 authority in the free check counts only the bullet being rewritten', () => {
    const c = ctx('דנה לוי\n• תמכתי בצוות השירות.\n• ניהלתי צוות של 6 עובדים.', 'ניהול צוות השירות.');
    expect(checkQuickWinGrounding(qw('תמכתי בצוות השירות.', 'ניהול צוות השירות.'), c).ok).toBe(false);
  });

  it('P1 a final ה is part of the word: "מורה" (teacher) is not the name "מור"', () => {
    const c = ctx('מור כהן\nרכזת משרד\n• טיפלתי בדוחות.', 'דרוש/ה מורה למתמטיקה. טיפול בדוחות.');
    expect(findJobOnlyTerms('טיפלתי בדוחות כמורה.', c)).toEqual(['כמורה']);
  });

  it.each([
    ['עובדות', 'עובדת'],
    ['מנהלות', 'מנהלת'],
    ['משימות', 'משימה'],
    ['דוחות', 'דוח'],
  ])('P2 plural "%s" supports singular "%s"', (plural, singular) => {
    const c = ctx(`דנה לוי\n• טיפלתי ב${plural} חדשות.`, `טיפול ב${singular} חדשה.`);
    expect(findJobOnlyTerms(`טיפלתי ב${singular} חדשה.`, c)).toEqual([]);
  });
});
