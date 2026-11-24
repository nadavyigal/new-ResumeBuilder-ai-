export type OutputLanguage = 'he' | 'en';

const HEBREW_LETTER = /[֐-׿]/;

/**
 * Output language. Unchanged from the rule the optimizer used before this module:
 * Hebrew when either the resume or the job text contains a Hebrew letter,
 * otherwise English. So an English resume with a Hebrew job ad gets Hebrew output.
 */
export function resolveOutputLanguage(resumeText: string, jobText: string): OutputLanguage {
  return HEBREW_LETTER.test(resumeText || '') || HEBREW_LETTER.test(jobText || '') ? 'he' : 'en';
}

export function languageRules(lang: OutputLanguage): string {
  const common = `# Language
- Write every text value the candidate will read in ${lang === 'he' ? 'Hebrew' : 'English'}. JSON keys and enum values stay in English.
- Keep names of tools, products, companies and certifications in their original form and script (React, Node.js, AWS, Wix). Keep job titles as the resume writes them.
- A Hebrew term and an English term with the same meaning count as the same evidence (for example "ניהול מוצר" and "product management").`;
  if (lang !== 'he') return common;
  return `${common}
- Write natural, professional Hebrew, not a word-for-word translation.
- Before a Latin-script name, join the Hebrew prefix with a hyphen: "ב-Node.js", "ל-AWS".
- Keep the grammatical gender the candidate uses for themselves (for example "מתכנתת" stays feminine). If the resume gives no clue, use gender-neutral wording such as action nouns ("פיתוח", "הובלת צוות") instead of picking a gender.
- Never copy slash forms from the job posting, such as "מפתח/ת" or "דרוש/ה", into the candidate's text.
- Plain text only: no emoji, no decorative symbols, no direction-control characters.`;
}
