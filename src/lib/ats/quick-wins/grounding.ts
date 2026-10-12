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
  | 'job_terms_added'
  | 'invented_term'
  | 'inflated_claim';

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

/**
 * Percentages a rewrite may compute: only from a stated part-of-whole pair
 * ("38 of 41", "38 out of 41", "38/41") whose numbers are both allowed. Any
 * other pair is unrelated: "12 units ... 150 students" is not an 8% anything,
 * and "grades 10-12" is not an 83% pass rate.
 */
function derivedPercents(texts: string[], allowed: Set<string>): Set<string> {
  const out = new Set<string>();
  const PAIR = /(\d[\d,]*(?:\.\d+)?)\s*(?:of|out of|\/)\s*(\d[\d,]*(?:\.\d+)?)/gi;
  for (const text of texts) {
    for (const m of text.matchAll(PAIR)) {
      const [a, b] = [m[1].replace(/,/g, ''), m[2].replace(/,/g, '')];
      if (!allowed.has(a) || !allowed.has(b) || Number(a) <= 0 || Number(a) >= Number(b)) continue;
      const pct = (100 * Number(a)) / Number(b);
      out.add(String(Math.floor(pct)));
      out.add(String(Math.round(pct)));
      out.add(String(Math.ceil(pct)));
    }
  }
  return out;
}

/**
 * Quantities written as words. Digits are checked above; these were not, so
 * "sixty mid-market accounts" passed where "60" was caught.
 */
const QUANTITY_WORDS =
  /\b(?:two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundreds?|thousands?|millions?|billions?|dozens?|doubl(?:e|ed|es|ing)|tripl(?:e|ed|es|ing)|quadrupl(?:e|ed|ing)|halv(?:ed|ing)|twice|thrice|(?:two|three|four|five|ten)fold)\b/gi;

function quantityWords(text: string): Set<string> {
  return new Set((text.match(QUANTITY_WORDS) || []).map((w) => w.toLowerCase()));
}

/**
 * Names a rewrite introduces: acronyms (SAP), mixed case (HubSpot) and
 * capitalised words inside a sentence (Camtasia). The job-term rule only sees
 * words the job uses; a tool from nowhere passed it.
 */
function namedTerms(text: string): string[] {
  const out: string[] = [];
  for (const sentence of text.split(/[.!?:;](?=\s|$)|\n+/)) {
    const tokens = sentence.match(/[A-Za-z][A-Za-z0-9+#&]*(?:\.[A-Za-z]+)?/g) || [];
    tokens.forEach((t, i) => {
      const acronym = /^[A-Z]{2,}[0-9]*s?$/.test(t);
      const mixed = /[a-z][A-Z]/.test(t);
      const capitalised = i > 0 && /^[A-Z][a-z]/.test(t);
      if (acronym || mixed || capitalised) out.push(t);
    });
  }
  return out;
}

/**
 * Claims that need no number or job term to be false. Each list is a kind of
 * claim the candidate must have made first: re-review of fed7054 found every
 * one of them passing ("enterprise accounts", "Led and managed a team" from
 * "Mentored", "all escalations", "increasing revenue", "award-winning").
 */
const SCOPE = /^(?:enterprise|global|globally|international|internationally|worldwide|nationwide|multinational|companywide|organizationwide|fortune|clevel|executives?|strategic|largescale|flagship|highprofile|highvalue)$/;
const OUTCOME = /^(?:revenues?|profits?|profitability|costs?|savings?|efficiency|efficiencies|productivity|roi|growth|conversions?|retention|churn|satisfaction|engagement|performance|accuracy|adoption|uptime|sales|nps|csat)$/;
const DISTINCTION = /^(?:awards?|awarded|awardwinning|recogni[sz]ed|recognition|promoted|promotion|top|best|record|recordbreaking|ranked|exceeded|exceeding|surpassed|outperformed|outperforming)$/;
/** Authority over people or work; the bullet itself must claim it first. */
const AUTHORITY = /^(?:led|leads?|leading|leadership|manag\w*|direct(?:ed|ing|s)?|owned|owner|ownership|oversaw|oversee\w*|spearhead\w*|head(?:ed|ing|s)?|supervis\w*|chair(?:ed|ing)?|command(?:ed|ing)?)$/;
const ABSOLUTE = /^(?:all|every|entire|entirely|zero|none|always|never|fully)$/;

function inflatedClaims(original: string, optimized: string, resumeText: string, isSummary: boolean): string[] {
  const inResume = new Set(words(resumeText));
  // A summary speaks for the whole résumé; a bullet only for itself.
  const inSource = isSummary ? inResume : new Set(words(original));
  return Array.from(
    new Set(
      words(optimized).filter(
        (w) =>
          ((SCOPE.test(w) || OUTCOME.test(w) || DISTINCTION.test(w)) && !inResume.has(w)) ||
          ((AUTHORITY.test(w) && ![...inSource].some((x) => AUTHORITY.test(x))) || (ABSOLUTE.test(w) && !inSource.has(w))),
      ),
    ),
  );
}

/** Digits outside 0-9 (full-width, Arabic-Indic) slip past every number check. */
const NON_ASCII_DIGIT = /(?![0-9])\p{Nd}/u;

function inventedTerms(optimized: string, ctx: GroundingContext, isSummary: boolean): string[] {
  const known = new Set(words(ctx.resumeText));
  if (isSummary && ctx.jobTitle) words(ctx.jobTitle).forEach((w) => known.add(w));
  return Array.from(new Set(namedTerms(optimized).filter((t) => words(t).some((w) => !known.has(w)))));
}

/** Lowercase words only, so bullets, dashes, quotes and line breaks never decide a match. */
function flatten(text: string): string {
  return words(text).join(' ');
}

/** Like `words`, but "1,500" and "4.5" stay one token, spelled as `numbers` spells them. */
function tokensWithNumbers(text: string): string[] {
  return (
    text
      .toLowerCase()
      .replace(/(\p{L})[-\u2010-\u2014](\p{L})/gu, '$1$2')
      .match(/\d[\d,]*(?:\.\d+)?|\p{L}[\p{L}\p{N}]*/gu) || []
  ).map((t) => t.replace(/,/g, ''));
}

/**
 * The phrase that gives each occurrence of `n` its meaning: from the nearest
 * content word before it to the nearest content word after it, within its
 * sentence. "Renewed 38 of 41 accounts in 2024." gives 41 the span
 * "renewed 38 of 41 accounts".
 */
function numberSpans(n: string, text: string): string[] {
  const isContext = (w: string) => !/^\d/.test(w) && w.length >= 3 && !STOPWORDS.has(w);
  const out: string[] = [];
  // A period ends a sentence only before whitespace or the end, so "4.5" survives.
  for (const sentence of text.split(/[.!?;](?=\s|$)|\n+/)) {
    const ws = tokensWithNumbers(sentence);
    ws.forEach((w, i) => {
      if (w !== n) return;
      let b = i;
      for (let j = i - 1; j >= 0; j--) if (isContext(ws[j])) { b = j; break; }
      let a = i;
      for (let j = i + 1; j < ws.length; j++) if (isContext(ws[j])) { a = j; break; }
      out.push(ws.slice(b, a + 1).join(' '));
    });
  }
  return out;
}

function countSpan(haystack: string, span: string): number {
  let count = 0;
  for (let at = haystack.indexOf(` ${span} `); at !== -1; at = haystack.indexOf(` ${span} `, at + 1)) count++;
  return count;
}

/**
 * A summary may carry a number from elsewhere in the résumé only with the whole
 * phrase it came in. One shared neighbour is not enough: "Renewed 38 of 41
 * accounts" and "a portfolio of 41 accounts" share "accounts" and claim
 * different things, and "Renewed 41 accounts" drops the "38 of". Each use of the
 * number needs its own copy of a source phrase.
 */
function keepsSourceContext(n: string, optimized: string, resumeText: string): boolean {
  const spans = Array.from(new Set(numberSpans(n, resumeText)));
  const uses = tokensWithNumbers(optimized).filter((w) => w === n).length;
  // Fail closed: a number the résumé never states, or one we could not locate.
  if (spans.length === 0 || uses === 0) return false;
  const flat = ` ${tokensWithNumbers(optimized).join(' ')} `;
  return spans.reduce((sum, span) => sum + countSpan(flat, span), 0) >= uses;
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
  const percents = derivedPercents([original, optimized], new Set([...originalNumbers, ...borrowed]));
  const originalQuantities = quantityWords(original);
  if (
    optimizedNumbers.some((n) => !originalNumbers.includes(n) && !borrowed.includes(n) && !percents.has(n)) ||
    [...quantityWords(optimized)].some((w) => !originalQuantities.has(w)) ||
    (NON_ASCII_DIGIT.test(optimized) && !NON_ASCII_DIGIT.test(original))
  ) {
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

  if (inventedTerms(optimized, ctx, qw.location?.section === 'summary').length > 0) {
    violations.push('invented_term');
  }

  if (inflatedClaims(original, optimized, ctx.resumeText, qw.location?.section === 'summary').length > 0) {
    violations.push('inflated_claim');
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
  invented_term: 'it names a tool, product or name the resume never mentions',
  inflated_claim: 'it adds scope, authority, an outcome, an award or an absolute ("all", "zero") the resume does not state',
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
