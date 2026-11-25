import {
  checkTailoredResume,
  contentRuleFindings,
  dateFindings,
  genderFindings,
  languageMatch,
  placeholderFindings,
  slashFormFindings,
} from './content-rules';
import rules from '../content-rules.json';
import { promptUpgradeCases, selectEvalCases } from './manifest-prompt-upgrade';
import { manifest } from './manifest';

describe('content-rule lint', () => {
  it('passes clean text', () => {
    expect(contentRuleFindings('Built dashboards that recruiters and screening software read easily.')).toEqual([]);
  });

  it('fails beat-ATS, robot, guarantee and price language in English and Hebrew', () => {
    const checks = (t: string) => contentRuleFindings(t).map((f) => f.check);
    expect(checks('This resume will beat the ATS.')).toContain('content.atsBeat');
    expect(checks('Written so robots pick it up.')).toContain('content.robot');
    expect(checks('You are guaranteed an interview.')).toContain('content.guarantee');
    expect(checks('Only $9 per month.')).toContain('content.price');
    expect(checks('קורות חיים שיעזרו לך לעקוף את מערכת הסינון')).toContain('content.atsBeat');
    expect(checks('ראיון מובטח')).toContain('content.guarantee');
  });

  it('downgrades a phrase the source resume already uses to a warning', () => {
    const f = contentRuleFindings('Owned the pricing plan for 3 products.', 'Owned the pricing plan for 3 products.');
    expect(f.every((x) => x.severity === 'warning')).toBe(true);
  });

  it('ships with an empty competitor list until the founder approves one', () => {
    expect(rules.competitors).toEqual([]);
    expect(contentRuleFindings('Unlike AcmeResume, we...', '', { competitors: ['AcmeResume'] })[0].check).toBe('content.competitors');
  });
});

describe('Hebrew and structure checks', () => {
  it('finds slash forms copied from the job ad', () => {
    expect(slashFormFindings('מפתח/ת Backend')).toHaveLength(1);
    expect(slashFormFindings('מפתח Backend עם CI/CD')).toEqual([]);
  });

  it('flags placeholders', () => {
    expect(placeholderFindings(['N/A', 'Haifa', 'לא צוין'])).toHaveLength(2);
  });

  it('measures language match and ignores tool names from the source', () => {
    expect(languageMatch('פיתוח שירותים ב-Go ו-Docker', 'he', 'Go Docker').ratio).toBe(1);
    expect(languageMatch('Built services in Go and Docker', 'he', 'Go Docker').finding?.check).toBe('language.match');
  });

  it('keeps source dates', () => {
    expect(dateFindings('מרץ 2022 היום', 'מרץ 2022 עד היום')).toEqual([]);
    expect(dateFindings('Mar 2022 Present', 'מרץ 2022 עד היום').map((f) => f.detail)).toEqual(['מרץ', 'היום']);
  });

  it('warns on a gender flip only', () => {
    expect(genderFindings('בודק QA עם ניסיון', 'בודקת QA')).toEqual([{ check: 'hebrew.gender_flip', severity: 'warning', detail: 'בודקת -> בודק' }]);
    expect(genderFindings('בודקת QA', 'בודקת QA')).toEqual([]);
  });

  it('runs every check on a tailored resume', () => {
    const r = checkTailoredResume(
      { summary: 'מפתח/ת שיעבור את ה-ATS', experience: [{ title: 'Dev', company: 'X', location: '', startDate: 'N/A', endDate: '', achievements: [] }] } as any,
      'Dev at X 2021',
      'he'
    );
    const checks = r.findings.map((f) => f.check);
    expect(checks).toEqual(expect.arrayContaining(['placeholder', 'hebrew.slash_form', 'dates.changed']));
  });
});

describe('prompt-upgrade cases', () => {
  it('adds five uniquely named cases without touching the 20-case manifest', () => {
    expect(manifest).toHaveLength(20);
    expect(promptUpgradeCases).toHaveLength(5);
    const ids = selectEvalCases({ EVAL_CASE_SET: 'prompt-upgrade' }).map((c) => c.id);
    expect(new Set(ids).size).toBe(25);
    expect(selectEvalCases({ EVAL_CASE_IDS: 'he-fit-qa-automation' }).map((c) => c.id)).toEqual(['he-fit-qa-automation']);
  });

  it('every evidenced requirement quotes the resume', () => {
    for (const c of promptUpgradeCases) {
      for (const r of c.requirements) {
        for (const e of r.evidence) expect([c.id, c.resumeText.includes(e)]).toEqual([c.id, true]);
      }
      for (const f of c.mustRetain) expect([c.id, f.value, c.resumeText.includes(f.value)]).toEqual([c.id, f.value, true]);
    }
  });
});
