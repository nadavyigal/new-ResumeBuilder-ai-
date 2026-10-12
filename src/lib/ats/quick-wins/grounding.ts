/**
 * Quick-win grounding: every fact in a rewrite must come from the résumé.
 *
 * Observed 2026-10-11 on the free check with fictional candidates. The rewrites
 * took facts from the job post and put them in the candidate's mouth:
 *   "Managed a portfolio of mid-market accounts"
 *     -> "Managed a portfolio of 60 mid-market accounts"       (60 is the job's number)
 *   "Renewed 38 of 41 accounts up for renewal in 2024."
 *     -> "Achieved a [X%] renewal rate ..., focusing on reducing churn by tracking
 *         account health and acting early on risk."          (job's duties; 38 dropped)
 *   "Prepared students for national matriculation exams."
 *     -> "Developed comprehensive learning objectives and storyboards..."
 *
 * The prompt now says this is forbidden, but a prompt is a request, not a
 * guarantee (see tasks/lessons.md 2026-09-25). Same posture as
 * `stripFabricatedMetrics` and `job-ad-terms.ts`: instruct, then enforce here.
 *
 * The job text may not add numbers, scopes, tools or activities. A rewrite may
 * reword the candidate's own facts, and swap one action verb for another
 * ("monitor" -> "track"), but every other term must already be in the résumé.
 *
 * 2026-10-11, first live run on the PR preview: with a budget of two borrowed
 * terms the model used the room to append job duties to a real bullet
 * ("...drive engagement, reduce churn, and enhance account health") and a
 * scope ("with customer executives"). Any job-only term is now a rejection.
 */

import type { QuickWinSuggestion } from '../types';

export interface GroundingContext {
  /** Full résumé text, the only source of facts. */
  resumeText: string;
  /** Job text, used to recognise terms copied from the posting. */
  jobText: string;
  /** Target title. A summary may name it: that is positioning, not a claim. */
  jobTitle?: string;
}

export type GroundingViolation =
  | 'original_not_in_resume'
  | 'invented_number'
  | 'dropped_number'
  | 'placeholder_over_real_number'
  | 'inflated_number'
  | 'job_terms_added';

export interface GroundingResult {
  ok: boolean;
  violations: GroundingViolation[];
  /** Job-post terms the rewrite added that the résumé never mentions. */
  jobOnlyTerms: string[];
}


const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'into', 'onto', 'that', 'this', 'these', 'those',
  'are', 'was', 'were', 'been', 'being', 'have', 'has', 'had', 'not', 'but', 'all', 'any',
  'our', 'your', 'their', 'its', 'his', 'her', 'they', 'them', 'you', 'who', 'whom',
  'which', 'what', 'when', 'where', 'why', 'how', 'than', 'then', 'also', 'such', 'each',
  'per', 'via', 'over', 'under', 'about', 'across', 'within', 'while', 'during', 'after',
  'before', 'through', 'between', 'more', 'most', 'other', 'some', 'very', 'will', 'can',
  'out', 'off', 'too', 'both', 'own', 'new', 'key', 'well', 'able',
]);

/**
 * Verbs that re-describe an action rather than add one. Swapping "Built" for
 * "Developed" changes no fact, so these never count as borrowed job terms.
 */
const REWORDING_VERBS = new Set(
  [
    'develop', 'maintain', 'manage', 'led', 'lead', 'built', 'build', 'design', 'create',
    'deliver', 'drove', 'drive', 'own', 'ran', 'run', 'track', 'monitor', 'improve',
    'implement', 'execute', 'coordinate', 'collaborate', 'work', 'partner', 'support',
    'oversaw', 'oversee', 'establish', 'launch', 'achieve', 'spearhead', 'streamline',
    'utilize', 'leverage', 'conduct', 'handle', 'prepare', 'use', 'ensure', 'focus',
    'enhance', 'increase', 'reduce', 'help', 'provide', 'perform', 'make', 'made',
  ].map(stem),
);

/** Joins hyphenated words ("mid-market" -> "midmarket") so both sides compare alike. */
function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/(\p{L})[-‐-—](\p{L})/gu, '$1$2')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

function stem(word: string): string {
  const stripped = word.replace(/(ments?|ings?|ions?|ers?|ed|es|al|ly|s)$/, '').replace(/e$/, '');
  return stripped.length >= 4 ? stripped : word;
}

/** Exact match only: by prefix, "performance" would pass as the verb "perform". */
function isRewordingVerb(s: string): boolean {
  return REWORDING_VERBS.has(s);
}

function sameStem(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 5 && long.startsWith(short);
}

function contentWords(text: string): string[] {
  return words(text).filter((w) => w.length >= 3 && !/^\d/.test(w) && !STOPWORDS.has(w));
}

function contentStems(text: string): string[] {
  return contentWords(text).map(stem);
}

function hasStem(pool: Set<string>, s: string): boolean {
  if (pool.has(s)) return true;
  for (const candidate of pool) {
    if (sameStem(candidate, s)) return true;
  }
  return false;
}

function numbers(text: string): string[] {
  return (text.match(/\d[\d,]*(?:\.\d+)?/g) || []).map((n) => n.replace(/,/g, ''));
}

/** Percentages a rewrite may compute from two numbers in the same bullet (38 of 41 -> 93%). */
function derivedPercents(text: string): Set<string> {
  const values = numbers(text).map(Number).filter((n) => Number.isFinite(n) && n > 0);
  const out = new Set<string>();
  for (const a of values) {
    for (const b of values) {
      if (a >= b) continue;
      const pct = (100 * a) / b;
      out.add(String(Math.floor(pct)));
      out.add(String(Math.round(pct)));
      out.add(String(Math.ceil(pct)));
    }
  }
  return out;
}

/** Lowercase words only, so bullets, dashes, quotes and line breaks never decide a match. */
function flatten(text: string): string {
  return words(text).join(' ');
}

/** The nearest non-filler word before and after each occurrence of `n`. */
function numberContexts(n: string, text: string): Array<[string, string]> {
  const ws = words(text).map((w) => w.replace(/,/g, ''));
  const isContext = (w: string) => !/^\d/.test(w) && w.length >= 3 && !STOPWORDS.has(w);
  const out: Array<[string, string]> = [];
  ws.forEach((w, i) => {
    if (w !== n) return;
    const before = ws.slice(0, i).reverse().find(isContext) ?? '';
    const after = ws.slice(i + 1).find(isContext) ?? '';
    out.push([stem(before), stem(after)]);
  });
  return out;
}

/** "8 years" stays "8 years"; "41 accounts" may not become "41 mid-market accounts" of a portfolio. */
function keepsSourceContext(n: string, optimized: string, resumeText: string): boolean {
  const source = numberContexts(n, resumeText);
  return numberContexts(n, optimized).every(([before, after]) =>
    source.some(([b, a]) => (before && before === b) || (after && after === a)),
  );
}

const PLACEHOLDER = /\[[^\]\n]{1,40}\]/;
const QUALIFIED_NUMBER =
  /\b(over|more than|above|nearly|almost|up to|at least|exceeding|upwards of)\s+(\d[\d,]*)|(\d[\d,]*)\s*\+/gi;

function qualifiedNumbers(text: string): Set<string> {
  const out = new Set<string>();
  for (const match of text.matchAll(QUALIFIED_NUMBER)) {
    out.add(match[0].toLowerCase().replace(/[\s,]+/g, ''));
  }
  return out;
}

/**
 * Check one rewrite against the résumé. Pure and deterministic.
 */
export function checkQuickWinGrounding(
  qw: Pick<QuickWinSuggestion, 'original_text' | 'optimized_text' | 'location'>,
  ctx: GroundingContext,
): GroundingResult {
  const violations: GroundingViolation[] = [];
  const original = qw.original_text;
  const optimized = qw.optimized_text;

  const resumeStems = new Set(contentStems(ctx.resumeText));

  // The "before" must be the user's own text, or the card misquotes them. A bag
  // of résumé words is not enough: "Managed quarterly renewals for key accounts"
  // reuses Itay's words but is a sentence he never wrote.
  const flatOriginal = flatten(original);
  if (!flatOriginal || !flatten(ctx.resumeText).includes(flatOriginal)) {
    violations.push('original_not_in_resume');
  }

  // Numbers are facts. None may be added, none dropped, none hidden behind a template.
  const originalNumbers = numbers(original);
  const optimizedNumbers = numbers(optimized);
  // A number from another bullet is a new fact here: "a portfolio of 41
  // accounts" when 41 counts renewals. Only a summary may gather numbers from
  // the rest of the résumé, and each must keep the words it stands next to.
  const borrowed = optimizedNumbers.filter(
    (n) =>
      !originalNumbers.includes(n) &&
      qw.location?.section === 'summary' &&
      keepsSourceContext(n, optimized, ctx.resumeText),
  );
  // A rate may be computed from numbers the résumé states: 38 of 41 -> 93%.
  const percents = derivedPercents([...originalNumbers, ...borrowed].join(' '));
  if (optimizedNumbers.some((n) => !originalNumbers.includes(n) && !borrowed.includes(n) && !percents.has(n))) {
    violations.push('invented_number');
  }
  if (originalNumbers.some((n) => !optimizedNumbers.includes(n))) {
    violations.push('dropped_number');
  }
  if (originalNumbers.length > 0 && PLACEHOLDER.test(optimized)) {
    violations.push('placeholder_over_real_number');
  }
  const originalQualified = qualifiedNumbers(original);
  for (const q of qualifiedNumbers(optimized)) {
    if (!originalQualified.has(q)) {
      violations.push('inflated_number');
      break;
    }
  }

  // Job terms the résumé never uses: each one is a duty, scope or skill claimed
  // on the job post's say-so.
  const jobStems = new Set(contentStems(ctx.jobText));
  const titleStems =
    qw.location?.section === 'summary' && ctx.jobTitle ? new Set(contentStems(ctx.jobTitle)) : new Set<string>();
  const jobOnlyTerms = Array.from(
    new Set(
      contentWords(optimized).filter((w) => {
        const s = stem(w);
        return !hasStem(resumeStems, s) && hasStem(jobStems, s) && !isRewordingVerb(s) && !hasStem(titleStems, s);
      }),
    ),
  );
  if (jobOnlyTerms.length > 0) {
    violations.push('job_terms_added');
  }

  return { ok: violations.length === 0, violations, jobOnlyTerms };
}

const VIOLATION_FEEDBACK: Record<GroundingViolation, string> = {
  original_not_in_resume: 'original_text is not copied exactly from the resume',
  invented_number: 'it adds a number the resume does not contain',
  dropped_number: 'it drops a number the original bullet contains',
  placeholder_over_real_number: 'it uses a [placeholder] although the bullet already has a real number',
  inflated_number: 'it inflates a number ("over", "more than", "+")',
  job_terms_added: 'it adds duties, scopes or terms from the job post that the resume never mentions',
};

export function describeViolations(violations: GroundingViolation[]): string {
  return violations.map((v) => VIOLATION_FEEDBACK[v]).join('; ');
}

/**
 * Keep only keywords the rewrite actually contains. The model listed
 * "reduce churn tracking" as added even where it was not in the text.
 */
export function keywordsPresentIn(keywords: string[], text: string): string[] {
  const textStems = new Set(contentStems(text));
  return keywords.filter((keyword) => {
    const kw = contentStems(keyword);
    return kw.length > 0 && kw.every((s) => hasStem(textStems, s));
  });
}
