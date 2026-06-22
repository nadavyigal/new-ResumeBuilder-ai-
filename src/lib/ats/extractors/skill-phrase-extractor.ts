import { KEYWORD_THRESHOLDS } from '../config/thresholds';
import { normalizeText, tokenize } from '../utils/text-utils';

const LEADING_NOISE = new Set([
  'develop', 'build', 'lead', 'manage', 'conduct', 'maintain', 'identify',
  'support', 'drive', 'create', 'design', 'execute', 'deliver', 'own', 'scale',
  'generate', 'craft', 'communicate', 'represent', 'strengthen', 'analyze',
  'evaluate', 'close', 'ensure', 'help', 'provide', 'perform', 'handle',
  'oversee', 'coordinate', 'proven', 'strong', 'excellent', 'demonstrated',
  'experienced', 'deep', 'solid', 'ability', 'track', 'record', 'knowledge',
  'understanding', 'experience', 'years', 'including', 'various', 'related',
  'relevant', 'existing', 'potential', 'complex', 'work', 'working',
]);

const CONNECTORS = new Set([
  'and', 'or', 'the', 'a', 'an', 'of', 'to', 'in', 'for', 'with', 'while',
  'as', 'within', 'across', 'into', 'your', 'our', 'their', 'that', 'this',
  'on', 'by', 'at', 'from', 'is', 'are', 'be', 'will', 'you', 'we', 'they',
  'them', 'its', 'plus', 'etc', 'via', 'per', 'end', 'able', 'other', 'both',
  'all', 'any', 'using', 'use', 'well', 'more', 'most', 'than', 'then', 'new',
]);

const CLAUSE_SPLIT =
  /[,;:.()\/]|\b(?:and|or|while|including|such as|with|to|but|as|within|across|through|for)\b/gi;

/**
 * Turn sentence-style job requirements into short keyword phrases without
 * relying on a domain-specific allow-list.
 */
export function extractSkillPhrases(requirements: string[]): string[] {
  const phrases = new Set<string>();

  for (const raw of requirements) {
    if (!raw) continue;

    for (const clause of normalizeText(raw).split(CLAUSE_SPLIT)) {
      const tokens = tokenize(clause).filter(Boolean);
      let start = 0;

      while (
        start < tokens.length &&
        (LEADING_NOISE.has(tokens[start]) ||
          CONNECTORS.has(tokens[start]) ||
          tokens[start].length < KEYWORD_THRESHOLDS.min_keyword_length)
      ) {
        start += 1;
      }

      const kept = tokens
        .slice(start)
        .filter(
          (token) =>
            !CONNECTORS.has(token) &&
            token.length >= KEYWORD_THRESHOLDS.min_keyword_length,
        );

      if (kept.length === 0) continue;
      phrases.add(kept.slice(0, 3).join(' '));
    }
  }

  return Array.from(phrases);
}
