const HEBREW_PATTERN = /[\u0590-\u05FF]/;
const ARABIC_PATTERN = /[\u0600-\u06FF]/;

export type LanguageCode = 'en' | 'he' | 'ar' | 'other';

export interface LanguageBuckets {
  [lang: string]: Set<string>;
}

function detectTokenLanguage(token: string): LanguageCode {
  if (HEBREW_PATTERN.test(token)) return 'he';
  if (ARABIC_PATTERN.test(token)) return 'ar';
  if (/^[a-z0-9\-+]+$/i.test(token)) return 'en';
  return 'other';
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}\+\-]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

export function bucketizeText(text: string): LanguageBuckets {
  const tokens = tokenize(text);
  const buckets: LanguageBuckets = {};

  for (const token of tokens) {
    const lang = detectTokenLanguage(token);
    if (!buckets[lang]) buckets[lang] = new Set();
    buckets[lang].add(token);
  }

  return buckets;
}

export function combineBuckets(...bucketSources: Array<LanguageBuckets | undefined>): LanguageBuckets {
  const combined: LanguageBuckets = {};
  for (const buckets of bucketSources) {
    if (!buckets) continue;
    for (const [lang, tokens] of Object.entries(buckets)) {
      if (!combined[lang]) combined[lang] = new Set();
      for (const token of tokens) {
        combined[lang].add(token);
      }
    }
  }
  return combined;
}

export function diffBuckets(source: LanguageBuckets, compare: LanguageBuckets): Record<string, string[]> {
  const languages = new Set([...Object.keys(source), ...Object.keys(compare)]);
  const result: Record<string, string[]> = {};

  for (const lang of languages) {
    const sourceTokens = source[lang] ?? new Set<string>();
    const compareTokens = compare[lang] ?? new Set<string>();
    const missing: string[] = [];
    for (const token of compareTokens) {
      if (!sourceTokens.has(token)) {
        missing.push(token);
      }
    }
    if (missing.length) {
      result[lang] = Array.from(new Set(missing));
    } else {
      result[lang] = [];
    }
  }

  return result;
}

