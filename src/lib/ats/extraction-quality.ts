/**
 * Job extraction quality gate (WP-45 S4)
 *
 * A score is only as good as the requirements it was computed against. The
 * 2026-07-12 audit found user-visible missing-keyword lists containing "about",
 * "role objective" and "key responsibilities build" — page furniture and a
 * truncated sentence, presented to the user as things missing from their
 * resume, and fed to the scorer as though they were real requirements.
 *
 * The pre-existing filter was a stop list of short function words, which none
 * of those three fragments trip. This module adds what the packet requires:
 * phrase shape, source-section awareness, a minimum credible requirement count,
 * and provenance — so a thin or polluted extraction fails closed with a
 * recovery reason instead of returning a confident-looking number.
 */

/**
 * Section furniture from job postings. These are headings and boilerplate, not
 * requirements, and they appear as extracted "requirements" when a scrape
 * captures the page's structure along with its content.
 */
const STRUCTURAL_HEADINGS = [
  'about',
  'about us',
  'about the role',
  'about the company',
  'about you',
  'role objective',
  'the role',
  'job description',
  'job summary',
  'position summary',
  'overview',
  'company overview',
  'key responsibilities',
  'responsibilities',
  'main responsibilities',
  'duties',
  'requirements',
  'minimum requirements',
  'basic qualifications',
  'preferred qualifications',
  'qualifications',
  'skills',
  'required skills',
  'what you will do',
  "what you'll do",
  'what you will bring',
  "what you'll bring",
  'what we offer',
  'who you are',
  'who we are',
  'why join us',
  'our mission',
  'benefits',
  'perks',
  'compensation',
  'salary',
  'equal opportunity',
  'apply now',
  'how to apply',
  'location',
  'employment type',
  'seniority level',
  'nice to have',
  'good to have',
  'bonus points',
];

/**
 * Short tokens that are genuine, checkable requirements. A blunt minimum word
 * or character count would discard every one of these, which is why the packet
 * calls for allowlisted shape rules instead.
 */
const VALID_SHORT_REQUIREMENTS = new Set([
  'sql', 'aws', 'gcp', 'ios', 'css', 'php', 'ci', 'cd', 'ml', 'ai', 'bi', 'qa',
  'ux', 'ui', 'etl', 'elt', 'api', 'crm', 'erp', 'seo', 'sem', 'saas', 'b2b',
  'b2c', 'kpi', 'p&l', 'c#', 'c++', 'js', 'ts', 'k8s', 'gis', 'nlp', 'llm',
  'dba', 'sre', 'hr', 'pm', 'qc', 'iot', 'ar', 'vr', 'rf', 'em',
]);

/**
 * Short names that are also ordinary English words. "Go" is a language, "go"
 * is a verb left behind by a truncated sentence; the same holds for R and C.
 * Casing is the only signal available, so these are accepted only when the
 * source text capitalised them.
 */
const CASE_SENSITIVE_SHORT_REQUIREMENTS = new Set(['Go', 'R', 'C']);

/** Words that leave a phrase dangling when it ends on them. */
const DANGLING_TAIL =
  /\b(build|create|develop|manage|lead|drive|own|deliver|support|work|help|ensure|and|or|with|for|to|in|on|of|the|a|an|that|which|including|such|as)$/i;

/** Function words that carry no requirement meaning on their own. */
const FUNCTION_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'to', 'in', 'on', 'at', 'is', 'it', 'as', 'be',
  'by', 'if', 'of', 'we', 'you', 'our', 'your', 'they', 'their', 'go', 'do',
  'so', 'no', 'up', 'this', 'that', 'with', 'for', 'from', 'will', 'are',
]);

const MAX_CREDIBLE_LENGTH = 160;

function normalise(value: string): string {
  // Unicode-aware on purpose: \w is ASCII-only, so a \W-based strip deletes
  // every Hebrew character and the product ships in Hebrew.
  return value
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^\p{L}\p{N}\s'&+#-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Is this string a section heading rather than a requirement? */
export function isStructuralHeading(value: string): boolean {
  const normalised = normalise(value).replace(/[:.]$/, '');
  if (!normalised) return false;

  if (STRUCTURAL_HEADINGS.includes(normalised)) return true;

  // "Key responsibilities build ..." — a heading that a scrape ran together
  // with the first words of the content beneath it. The heading prefix is the
  // tell; a genuine requirement does not open with one.
  return STRUCTURAL_HEADINGS.some(
    heading => heading.split(' ').length >= 2 && normalised.startsWith(`${heading} `)
  );
}

/**
 * Would a human recognise this as something a candidate could actually be
 * asked for?
 */
export function isCredibleRequirement(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.length > MAX_CREDIBLE_LENGTH) return false;

  const normalised = normalise(trimmed);
  if (!normalised) return false;

  if (isStructuralHeading(trimmed)) return false;

  const words = normalised.split(' ').filter(Boolean);

  if (words.length === 1) {
    const word = words[0];
    if (VALID_SHORT_REQUIREMENTS.has(word)) return true;
    if (CASE_SENSITIVE_SHORT_REQUIREMENTS.has(trimmed)) return true;
    if (FUNCTION_WORDS.has(word)) return false;
    // A lone common word like "about" is furniture; a lone technology name is
    // a requirement. Length is a weak proxy, so it only applies once the
    // allowlist and the furniture checks have had their say.
    return word.length >= 3;
  }

  // A phrase that ends mid-thought was truncated by the scraper.
  if (DANGLING_TAIL.test(normalised)) return false;

  // Needs at least one word carrying meaning.
  return words.some(word => !FUNCTION_WORDS.has(word) && word.length >= 3);
}

export type ExtractionQuality = 'high' | 'medium' | 'low' | 'unavailable';

export interface ExtractionQualityAssessment {
  quality: ExtractionQuality;
  /** True when a score may be computed and shown. */
  available: boolean;
  /** Requirements that survived the credibility filter. */
  credibleRequirements: string[];
  /** Share of extracted requirements that were furniture or fragments (0-1). */
  junkRatio: number;
  /** Machine-readable reason when unavailable. Never user-facing copy. */
  reason?:
    | 'no_requirements'
    | 'too_few_credible_requirements'
    | 'mostly_junk'
    | 'job_text_too_short';
}

/** Below this, there is not enough signal to claim a job-fit measurement. */
export const MIN_CREDIBLE_REQUIREMENTS = 3;
const MIN_USABLE_JOB_TEXT_WORDS = 50;
const MAX_TOLERABLE_JUNK_RATIO = 0.5;

export function assessExtractionQuality(input: {
  requirements: string[];
  jobText?: string;
  title?: string | null;
  /** Where the job came from. A pasted description is trusted more than a scrape. */
  source?: 'paste' | 'url' | 'unknown';
}): ExtractionQualityAssessment {
  const { requirements, jobText = '', title, source = 'unknown' } = input;

  const cleaned = requirements.map(r => r.trim()).filter(Boolean);
  const credibleRequirements = cleaned.filter(isCredibleRequirement);
  const junkRatio =
    cleaned.length === 0 ? 0 : (cleaned.length - credibleRequirements.length) / cleaned.length;

  const wordCount = jobText.trim() ? jobText.trim().split(/\s+/).length : 0;

  const unavailable = (
    reason: ExtractionQualityAssessment['reason']
  ): ExtractionQualityAssessment => ({
    quality: 'unavailable',
    available: false,
    credibleRequirements,
    junkRatio,
    reason,
  });

  if (cleaned.length === 0) return unavailable('no_requirements');
  if (credibleRequirements.length < MIN_CREDIBLE_REQUIREMENTS) {
    return unavailable('too_few_credible_requirements');
  }
  if (junkRatio > MAX_TOLERABLE_JUNK_RATIO) return unavailable('mostly_junk');

  // Short job text lowers confidence but does not by itself make a result
  // unavailable: the public route already enforces its own minimum word count
  // before scoring, and rejecting again here only produced false negatives on
  // legitimate short-but-complete postings. The requirement count and the junk
  // ratio are the load-bearing signals.
  const thinJobText = Boolean(jobText) && wordCount < MIN_USABLE_JOB_TEXT_WORDS;

  // Enough to score. How much to trust it depends on provenance, volume and
  // whether we could even identify the role.
  const hasTitle = Boolean(title && title.trim() && title.trim().toLowerCase() !== 'position');
  const plentiful = credibleRequirements.length >= 6;
  const clean = junkRatio <= 0.2;

  let quality: ExtractionQuality = 'medium';
  if (plentiful && clean && hasTitle && source !== 'unknown' && !thinJobText) {
    quality = 'high';
  } else if (!hasTitle || !clean || thinJobText) {
    quality = 'low';
  }

  return { quality, available: true, credibleRequirements, junkRatio };
}
