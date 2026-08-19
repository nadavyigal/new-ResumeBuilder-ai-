import { KEYWORD_THRESHOLDS } from '../config/thresholds';
import { normalizeText, tokenize, isShortSkillToken } from '../utils/text-utils';

/**
 * Words that describe HAVING a skill rather than naming one.
 *
 * These were stripped only from the FRONT of a clause, so anything that
 * survived into the middle became part of the "requirement" a resume then had
 * to match. Measured on a candidate holding every skill a job asked for,
 * `keyword_exact` read 45.8 against 80.0 for a human's list of the same skills,
 * because the atomizer emitted these as must-haves (WP-59 S3c):
 *
 *   "Experience building and operating distributed systems"  -> `building`
 *   "Strong background in PostgreSQL"                        -> `background postgresql`
 *   "Hands-on experience with Kubernetes"                    -> `hands experience`
 *   "Proficiency with Go"                                    -> `proficiency`
 *   "Familiarity with Terraform and infrastructure as code"  -> `familiarity`
 *
 * Six of twelve extracted requirements were unmatchable by construction. Worse,
 * they are shown to the user as things missing from their resume — people were
 * being told to add "proficiency" to their CV.
 *
 * They are now removed wherever they appear, and a clause that reduces to
 * nothing but noise is dropped rather than emitted as a bare filler word.
 */
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
  // Added WP-59 S3c — every one of these was observed as an emitted "skill".
  'proficiency', 'proficient', 'familiarity', 'familiar', 'background',
  'hands', 'expertise', 'exposure', 'comfort', 'comfortable', 'fluency',
  'fluent', 'passion', 'passionate', 'desire', 'willingness', 'willing',
  'building', 'operating', 'managing', 'leading', 'developing', 'designing',
  'great', 'good', 'prior', 'previous', 'several', 'multiple',
  'plus', 'bonus', 'advantage', 'required', 'preferred', 'must', 'nice',
]);

/**
 * The same class of filler in Hebrew.
 *
 * Needed as soon as `normalizeText` stopped deleting Hebrew outright: Hebrew
 * requirements now survive into the atomizer, and without this they would
 * atomize into filler phrases exactly as the English ones did — trading one
 * source of unmatchable requirements for another.
 */
const HEBREW_NOISE = new Set([
  'ניסיון', 'ידע', 'יכולת', 'הבנה', 'היכרות', 'שליטה', 'שנות', 'שנים',
  'חובה', 'יתרון', 'לפחות', 'גבוהה', 'גבוה', 'מעולה', 'טובה', 'טוב',
  'עם', 'של', 'על', 'את', 'או', 'וכן', 'גם', 'כולל', 'רלוונטי', 'מוכח',
  'שפת', 'שפה', 'תחום', 'סביבת', 'עבודה', 'צוות', 'חברה', 'משרה',
]);

/** Hebrew one-letter proclitics: and / the / in / to / from / that / like. */
const HEBREW_PROCLITICS = 'והבלמשכ';

function isNoiseToken(token: string): boolean {
  if (LEADING_NOISE.has(token) || HEBREW_NOISE.has(token) || CONNECTORS.has(token)) {
    return true;
  }

  // Hebrew glues "in", "the" and "of" onto the following word, so the filler
  // arrives inflected: בשפת ("in the language of"), בניסיון ("in experience").
  // Listing every inflection would be endless; test the stem instead. Without
  // this, `בשפת go` survived as a two-token requirement that a resume saying Go
  // could not satisfy, because one of the two tokens was pure filler.
  if (token.length > 3 && HEBREW_PROCLITICS.includes(token[0])) {
    return HEBREW_NOISE.has(token.slice(1));
  }

  return false;
}

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
  'another', 'language', 'languages',
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

  const body = dashMatch[2].replace(TRAILING_BOILERPLATE, '').trim();
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

      // Noise is dropped wherever it sits, not only at the front. Leaving it in
      // the middle is what produced `background postgresql` — a two-token
      // requirement that a resume saying "PostgreSQL" could never satisfy,
      // because coverage needs 60% of the tokens and one of the two was a word
      // no resume would ever contain.
      const kept = tokens.filter(
        (token) =>
          !isNoiseToken(token) &&
          (token.length >= KEYWORD_THRESHOLDS.min_keyword_length || isShortSkillToken(token)),
      );

      // A clause that was ALL filler names no skill. Emitting its leftovers as
      // a requirement is what put `proficiency` and `familiarity` in front of
      // users as gaps in their resume.
      if (kept.length === 0) continue;

      const phrase = kept.slice(0, 3).join(' ');
      if (!isJunkSkillPhrase(phrase)) {
        phrases.add(phrase);
      }
    }
  }

  return Array.from(phrases);
}
