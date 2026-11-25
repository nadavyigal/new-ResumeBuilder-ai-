/**
 * Quick wins may not turn shared work into sole ownership (Preview check,
 * 2026-11-24: "Helped document release notes" -> "Documented release notes").
 */
import { describe, it, expect } from '@jest/globals';
import { checkQuickWinGrounding, dropsContribution } from '@/lib/ats/quick-wins/grounding';
import { QUICK_WINS_SYSTEM_PROMPT } from '@/lib/ats/quick-wins/prompt';

const resumeText = [
  'QA Engineer, Acme, 2021 - Present',
  'Helped document release notes for 12 product releases.',
  'Monitor nightly test runs and report failures.',
  'Led customer support onboarding for new hires.',
  'עזרתי בכתיבת מסמכי בדיקות לצוות הפיתוח.',
].join('\n');
const ctx = { resumeText, jobText: 'We need a QA engineer who documents releases and tracks test runs.' };
const bullet = (original_text: string, optimized_text: string) => ({
  original_text,
  optimized_text,
  location: { section: 'experience' as const, subsection: 'Acme' },
});

describe('contribution level', () => {
  it('rejects "helped document" rewritten as "documented"', () => {
    const r = checkQuickWinGrounding(
      bullet('Helped document release notes for 12 product releases.', 'Documented release notes for 12 product releases.'),
      ctx,
    );
    expect(r.ok).toBe(false);
    expect(r.violations).toContain('inflated_claim');
  });

  it('allows swapping one contribution verb for another', () => {
    expect(dropsContribution('Helped document release notes', 'Assisted with documenting release notes')).toBe(false);
    const r = checkQuickWinGrounding(
      bullet('Helped document release notes for 12 product releases.', 'Helped document release notes across 12 product releases.'),
      ctx,
    );
    expect(r.violations).not.toContain('inflated_claim');
  });

  it('still allows a plain verb swap with no contribution word', () => {
    const r = checkQuickWinGrounding(bullet('Monitor nightly test runs and report failures.', 'Track nightly test runs and report failures.'), ctx);
    expect(r.violations).not.toContain('inflated_claim');
  });

  it('does not treat the noun "customer support" as shared credit', () => {
    expect(dropsContribution('Led customer support onboarding for new hires.', 'Led onboarding for new hires.')).toBe(false);
  });

  it('rejects the Hebrew case: "עזרתי בכתיבת" rewritten as "כתבתי"', () => {
    expect(dropsContribution('עזרתי בכתיבת מסמכי בדיקות לצוות הפיתוח.', 'כתבתי מסמכי בדיקות לצוות הפיתוח.')).toBe(true);
    expect(dropsContribution('עזרתי בכתיבת מסמכי בדיקות לצוות הפיתוח.', 'סייעתי בכתיבת מסמכי בדיקות לצוות הפיתוח.')).toBe(false);
  });

  it('the prompt tells the model to keep the contribution level', () => {
    expect(QUICK_WINS_SYSTEM_PROMPT).toContain('Keep the candidate\'s level of contribution');
  });
});
