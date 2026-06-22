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
  'minimum', 'highly', 'desirable', 'naturally', 'curious', 'continually',
]);

const TRAILING_BOILERPLATE =
  /\b(is highly desirable|with a track record of success|you are|you can|you have|a true)\b/gi;

/** Phrases that should never become keyword suggestions after atomization. */
const JUNK_PHRASE_PATTERNS: RegExp[] = [
  /^minimum years\b/i,
  /^industry saas\b/i,
  /^payment platforms highly\b/i,
  /^job title\b/i,
  /^success$/i,
  /^online$/i,
  /^highly$/i,
];

const CONNECTORS = new Set([
  'and', 'or', 'the', 'a', 'an', 'of', 'to', 'in', 'for', 'with', 'while',
  'as', 'within', 'across', 'into', 'your', 'our', 'their', 'that', 'this',
  'on', 'by', 'at', 'from', 'is', 'are', 'be', 'will', 'you', 'we', 'they',
  'them', 'its', 'plus', 'etc', 'via', 'per', 'end', 'able', 'other', 'both',
  'all', 'any', 'using', 'use', 'well', 'more', 'most', 'than', 'then', 'new',
]);

const CLAUSE_SPLIT =
  /[,;:.()\/]|\b(?:and|or|while|including|such as|with|to|but|as|within|across|through|for)\b/gi;

function isJunkSkillPhrase(phrase: string): boolean {
  const trimmed = phrase.trim();
  if (!trimmed) return true;
  return JUNK_PHRASE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * Parse LinkedIn-style bullets like "Industry - SaaS, online marketplaces, or payment platforms".
 */
function extractFromLabeledRequirement(raw: string): string[] {
  // Require a word-only label (e.g. "Industry - SaaS..."), not "2-3 years..." sentences.
  const dashMatch = raw.match(/^([A-Za-z][A-Za-z\s]{2,})\s+-\s*(.+)$/);
  if (!dashMatch) return [];

  let body = dashMatch[2].replace(TRAILING_BOILERPLATE, '').trim();
  if (!body) return [];

  const phrases: string[] = [];
  const segments = body.split(/\s*,\s*|\s+or\s+/i);

  for (const segment of segments) {
    const tokens = tokenize(segment.trim()).filter(
      (token) =>
        !CONNECTORS.has(token) &&
        !LEADING_NOISE.has(token) &&
        token.length >= KEYWORD_THRESHOLDS.min_keyword_length,
    );
    if (tokens.length === 0) continue;

    const phrase = tokens.slice(0, 3).join(' ');
    if (!isJunkSkillPhrase(phrase)) {
      phrases.push(phrase);
    }
  }

  return phrases;
}

/**
 * Turn sentence-style job requirements into short keyword phrases without
 * relying on a domain-specific allow-list.
 */
export function extractSkillPhrases(requirements: string[]): string[] {
  const phrases = new Set<string>();

  for (const raw of requirements) {
    if (!raw) continue;

    const labeledPhrases = extractFromLabeledRequirement(raw);
    if (labeledPhrases.length > 0) {
      labeledPhrases.forEach((phrase) => phrases.add(phrase));
      continue;
    }

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
      const phrase = kept.slice(0, 3).join(' ');
      if (!isJunkSkillPhrase(phrase)) {
        phrases.add(phrase);
      }
    }
  }

  return Array.from(phrases);
}
