/**
 * Lightweight language detection and RTL handling.
 * No external deps; uses simple Unicode range heuristics.
 */

export type LanguageCode =
  | 'en' // English (default)
  | 'es'
  | 'fr'
  | 'de'
  | 'pt'
  | 'it'
  | 'nl'
  | 'sv'
  | 'no'
  | 'da'
  | 'fi'
  | 'he' // Hebrew (RTL)
  | 'ar' // Arabic (RTL)
  | 'fa' // Persian (RTL)
  | 'ur'; // Urdu (RTL)

export interface LanguageInfo {
  code: LanguageCode;
  direction: 'ltr' | 'rtl';
  probable: boolean; // true if detection found characteristic script
}

const RTL_CODES: LanguageCode[] = ['he', 'ar', 'fa', 'ur'];

export function isRTL(code: LanguageCode): boolean {
  return RTL_CODES.includes(code);
}

// Basic script detection using Unicode ranges
const RE_HEBREW = /[\u0590-\u05FF]/;
const RE_ARABIC = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;

export function detectLanguageCode(text: string | undefined): LanguageCode | null {
  if (!text) return null;
  if (RE_HEBREW.test(text)) return 'he';
  if (RE_ARABIC.test(text)) return 'ar';
  // Heuristic: presence of common function words (very weak; keep minimal)
  const lower = text.toLowerCase();
  if (/( el | la | los | las | de | y | para )/.test(` ${lower} `)) return 'es';
  if (/( le | la | les | des | et | pour )/.test(` ${lower} `)) return 'fr';
  if (/( der | die | das | und | für )/.test(` ${lower} `)) return 'de';
  if (/( and | the | for | with )/.test(` ${lower} `)) return 'en';
  return null;
}

export function detectLanguage(texts: Array<string | undefined>): LanguageInfo {
  for (const t of texts) {
    const code = detectLanguageCode(t);
    if (code) {
      return { code, direction: isRTL(code) ? 'rtl' : 'ltr', probable: true };
    }
  }
  return { code: 'en', direction: 'ltr', probable: false };
}

export function chooseTargetLanguage(params: {
  resumeSummary?: string;
  jobText?: string;
  userPreferred?: LanguageCode;
}): LanguageInfo {
  if (params.userPreferred) {
    return { code: params.userPreferred, direction: isRTL(params.userPreferred) ? 'rtl' : 'ltr', probable: true };
  }
  return detectLanguage([params.resumeSummary, params.jobText]);
}

