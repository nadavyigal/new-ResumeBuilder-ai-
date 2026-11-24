/**
 * Quick wins after the prompt upgrade (S5): static system prompt, tagged user
 * message, estimate kept, Hebrew grounding unchanged.
 */
import {
  QUICK_WINS_RESUME_CHAR_LIMIT,
  QUICK_WINS_SYSTEM_PROMPT,
  buildQuickWinsPrompt,
} from '@/lib/ats/quick-wins/prompt';
import { checkQuickWinGrounding } from '@/lib/ats/quick-wins/grounding';

const job = { title: 'QA Automation Engineer', must_have: ['Selenium', 'Playwright'], nice_to_have: [], responsibilities: [] } as any;
const subscores = { keyword_exact: 40, keyword_phrase: 80 } as any;

describe('quick wins prompt', () => {
  it('system prompt is static and keeps the estimate field', () => {
    expect(QUICK_WINS_SYSTEM_PROMPT).toContain('estimated_impact');
    expect(QUICK_WINS_SYSTEM_PROMPT).toContain('rough estimate');
    expect(QUICK_WINS_SYSTEM_PROMPT).toContain('Return fewer if fewer sentences can be honestly improved.');
    expect(QUICK_WINS_SYSTEM_PROMPT).not.toContain('Generate exactly 3');
  });

  it('user message tags the resume last and labels the score as an estimate', () => {
    const user = buildQuickWinsPrompt({ resume_text: 'Wrote 120 Selenium tests.', resume_json: {} as any, job_data: job, subscores, current_ats_score: 61.4 });
    expect(user).toContain('<current_match_score_estimate>61/100 (estimate)</current_match_score_estimate>');
    expect(user).toContain('Playwright (do not claim these)');
    expect(user.trim().endsWith('Return only the JSON object.')).toBe(true);
    expect(user.indexOf('<original_resume>')).toBeGreaterThan(user.indexOf('<weak_areas>'));
  });

  it('sends the whole resume up to the cap, not the first 2,000 characters', () => {
    const long = `${'a'.repeat(5000)} TAIL_MARKER ${'b'.repeat(QUICK_WINS_RESUME_CHAR_LIMIT)}`;
    const user = buildQuickWinsPrompt({ resume_text: long, resume_json: {} as any, job_data: job, subscores, current_ats_score: 50 });
    expect(user).toContain('TAIL_MARKER');
    expect(user.length).toBeLessThan(QUICK_WINS_RESUME_CHAR_LIMIT + 3000);
  });

  it('asks for Hebrew when the resume is Hebrew', () => {
    const user = buildQuickWinsPrompt({ resume_text: 'כתבתי 120 תרחישי בדיקה ב-Selenium.', resume_json: {} as any, job_data: job, subscores, current_ats_score: 50 });
    expect(user).toContain('in Hebrew');
  });
});

describe('quick wins grounding on Hebrew text', () => {
  const resumeText = 'בודקת QA, פינטק בע"מ\n- כתבתי 120 תרחישי בדיקה אוטומטיים ב-Selenium ו-Python.';
  const ctx = { resumeText, jobText: 'דרוש/ה QA עם Playwright ו-TypeScript', jobTitle: 'QA Automation Engineer' };
  const location = { section: 'experience' as const };

  it('accepts a Hebrew rewrite that keeps the facts', () => {
    const r = checkQuickWinGrounding(
      { original_text: 'כתבתי 120 תרחישי בדיקה אוטומטיים ב-Selenium ו-Python.', optimized_text: 'פיתחתי 120 תרחישי בדיקה אוטומטיים ב-Selenium ו-Python.', location },
      ctx
    );
    expect(r.violations).not.toContain('invented_number');
    expect(r.violations).not.toContain('original_not_in_resume');
  });

  it('rejects a Hebrew rewrite with an invented number', () => {
    const r = checkQuickWinGrounding(
      { original_text: 'כתבתי 120 תרחישי בדיקה אוטומטיים ב-Selenium ו-Python.', optimized_text: 'כתבתי 120 תרחישי בדיקה ב-Selenium ו-Python וקיצרתי את זמן הבדיקות ב-40%.', location },
      ctx
    );
    expect(r.ok).toBe(false);
    expect(r.violations).toContain('invented_number');
  });
});
