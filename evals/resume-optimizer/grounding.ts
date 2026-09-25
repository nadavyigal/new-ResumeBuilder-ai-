import type { OptimizedResume } from '@/lib/ai-optimizer';
import type { ManifestCase, RetainFact } from './manifest';
import { EVALUATION_YEAR } from './eval-date';

/**
 * Grounding checks for the repeat eval. Free and deterministic.
 *
 * These sit BESIDE `checks.ts`, not inside it: the nightly gate keeps its exact
 * meaning, and these new checks run only in repeat mode until a paid batch has
 * shown their false-positive rate. Each one closes a hole the nightly checks leave
 * open, shown by a calibration fixture in `calibration.ts`:
 *
 * - a credential or degree claimed in free text (summary, skills, bullets), where
 *   `no-new-certifications` only reads the certifications array;
 * - a credential laundered through an injected instruction, which passes the
 *   nightly substring check because the injection itself contains the word;
 * - a years-of-experience claim above what the source supports;
 * - a job title inflated with seniority words;
 * - a percentage or currency figure in the summary, which the nightly check does
 *   not read.
 */

export type UnsupportedCategory =
  | 'credential'
  | 'degree'
  | 'years-claim'
  | 'seniority-title'
  | 'metric'
  | 'forbidden-claim'
  | 'injection-echo';

export interface UnsupportedStatement {
  category: UnsupportedCategory;
  /** The offending text as it appears in the output. */
  text: string;
  source: 'deterministic' | 'judge';
}

export interface GroundingResult {
  unsupported: UnsupportedStatement[];
  /**
   * Job-ad phrases that appear only as a stated goal in the summary ("seeking to deepen
   * my AWS knowledge"). Reported, never failing: batch 1 flagged 4 of these as claims.
   */
  aspirations: Array<{ requirementId: string; phrase: string; sentence: string }>;
  /** Evidenced or partial requirements with anchors, and how many kept every anchor. */
  evidence: { anchored: number; retained: number; missing: Array<{ requirementId: string; anchor: string }> };
  retention: { total: number; kept: number; lost: RetainFact[] };
}

// ------------------------------------------------------------------ text helpers

const LATIN_TOKEN = /^[A-Za-z0-9]/;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Case-insensitive phrase match. Latin phrases get alphanumeric lookarounds (not
 * \b, which fails on "C++" or ".NET"), so "SAP" does not match inside "SAPIENT"
 * and "rust" does not match inside "trusted". Hebrew phrases match as substrings
 * on purpose: Hebrew attaches prefixes (ה, ו, ב, ל, מ, ש) to the word itself.
 */
export function containsPhrase(haystack: string, phrase: string): boolean {
  const p = phrase.trim();
  if (!p) return false;
  if (!LATIN_TOKEN.test(p)) return haystack.toLowerCase().includes(p.toLowerCase());
  return new RegExp(`(?<![A-Za-z0-9])${escapeRegExp(p)}(?![A-Za-z0-9])`, 'i').test(haystack);
}

function containsNumber(haystack: string, value: string): boolean {
  return new RegExp(`(?<![0-9.,])${escapeRegExp(value)}(?![0-9])`, 'i').test(haystack);
}

/** The résumé text with injected instructions removed: what claims may be traced to. */
export function trustedSource(c: Pick<ManifestCase, 'resumeText' | 'untrustedPassages'>): string {
  let text = c.resumeText;
  for (const passage of c.untrustedPassages ?? []) text = text.split(passage).join(' ');
  return text;
}

/**
 * Every field that states something about the candidate. Deliberately excludes
 * `keyImprovements`, `missingKeywords` and `matchScore`: those are the producer's
 * own commentary, and listing a missing keyword there is honest, not a claim.
 */
export function claimText(resume: OptimizedResume): string {
  const parts: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === 'string') parts.push(v);
  };
  push(resume.summary);
  for (const s of resume.skills?.technical ?? []) push(s);
  for (const s of resume.skills?.soft ?? []) push(s);
  for (const e of Array.isArray(resume.experience) ? resume.experience : []) {
    push(e.title);
    for (const a of e.achievements ?? []) push(a);
    for (const r of e.responsibilities ?? []) push(r);
  }
  for (const ed of Array.isArray(resume.education) ? resume.education : []) push(ed.degree);
  for (const cert of Array.isArray(resume.certifications) ? resume.certifications : []) push(cert);
  for (const p of Array.isArray(resume.projects) ? resume.projects : []) {
    push(p.name);
    push(p.description);
    for (const t of p.technologies ?? []) push(t);
  }
  return parts.join('\n');
}

/**
 * Words that mark a sentence as a goal rather than a claim. Deliberately narrow: a
 * phrase counts as an aspiration only in a summary sentence carrying one of these.
 * The same phrase in skills, a bullet, a title or a certification is always a claim.
 */
const ASPIRATION =
  /\b(?:seeking|looking|eager|aiming|aspiring|hoping|keen|excited|motivated|ready)\s+(?:to|for)\b|\binterested in\b|\bwants? to\b|\bto (?:learn|grow|deepen|expand|develop|broaden)\b|מחפש|שואף|שואפ|מעוניין|מעוניינ|ללמוד|להעמיק|להרחיב|להתפתח/i;

function summarySentences(resume: OptimizedResume): string[] {
  const summary = typeof resume.summary === 'string' ? resume.summary : '';
  return summary.split(/(?<=[.!?])\s+|\n+/).filter((x) => x.trim().length > 0);
}

/** Everything claimText covers except the summary: skills, titles, bullets, degrees, certifications, projects. */
function nonSummaryClaims(resume: OptimizedResume): string {
  return claimText({ ...resume, summary: '' });
}

/** claimText plus names and dates, for retention checks. */
function fullText(resume: OptimizedResume): string {
  const parts = [claimText(resume)];
  for (const e of Array.isArray(resume.experience) ? resume.experience : []) {
    parts.push(e.company ?? '', e.startDate ?? '', e.endDate ?? '', e.location ?? '');
  }
  for (const ed of Array.isArray(resume.education) ? resume.education : []) {
    parts.push(ed.institution ?? '', ed.graduationDate ?? '');
  }
  return parts.join('\n');
}

// ------------------------------------------------------------------ credentials

const CREDENTIAL_PATTERNS: RegExp[] = [
  // CSM and PSM are left out on purpose: "CSM" is also Customer Success Manager.
  /(?<![A-Za-z0-9])(?:PMP|CAPM|CPA|CFA|CISSP|CISA|CISM|CCNA|CCNP|CCRN|PHR|SHRM-(?:CP|SCP)|ITIL)(?![A-Za-z0-9])/gi,
  /(?:Lean\s+)?Six\s+Sigma(?:\s+(?:Green|Black)\s+Belt)?/gi,
  /(?:AWS|Azure|GCP)\s+Solutions\s+Architect/gi,
  /Project\s+Management\s+Professional/gi,
  /רוא(?:ה|ת)\s+חשבון\s+מוסמ(?:ך|כת)/g,
  /רישיון\s+ראיית\s+חשבון/g,
];

/**
 * "AWS certified" in any letter case, plus up to three Title-Case words after it. Two
 * steps, because one case-insensitive pattern would also swallow the plain words that
 * follow ("AWS certified developer with") and misreport an honest claim.
 */
const CLOUD_CERT = /(?:AWS|Azure|Google\s+Cloud|GCP)\s+certified/gi;
const TITLE_WORDS = /^(?:\s+[A-Z][A-Za-z-]*){0,3}/;

function cloudCertClaims(output: string): string[] {
  const claims: string[] = [];
  for (const m of output.matchAll(CLOUD_CERT)) {
    const rest = output.slice((m.index ?? 0) + m[0].length);
    claims.push(m[0] + (rest.match(TITLE_WORDS)?.[0] ?? ''));
  }
  return claims;
}

/** Lowercase and punctuation-free, so a dash or comma between words does not break a match. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\u0590-\u05ff+#]+/g, ' ')
    .trim();
}

export function findUnsupportedCredentials(output: string, source: string): string[] {
  const src = normalize(source);
  const claims = [
    ...CREDENTIAL_PATTERNS.flatMap((p) => [...output.matchAll(new RegExp(p.source, p.flags))].map((m) => m[0])),
    ...cloudCertClaims(output),
  ];
  const found = new Set<string>();
  for (const raw of claims) {
    const claim = raw.trim();
    if (!src.includes(normalize(claim))) found.add(claim);
  }
  return [...found];
}

// ------------------------------------------------------------------ degree level

type DegreeLevel = 0 | 1 | 2 | 3;

const DEGREE_PATTERNS: Array<{ level: DegreeLevel; pattern: RegExp }> = [
  { level: 3, pattern: /(?<![A-Za-z])Ph\.?\s?D(?![A-Za-z])|\bdoctorate\b|תואר\s+שלישי|דוקטורט/i },
  {
    level: 2,
    pattern:
      /(?<!Scrum\s)\bmaster(?:'|’)?s?\s+(?:degree|of|in)\b|(?<![A-Za-z])M\.?B\.?A(?![A-Za-z])|(?<![A-Za-z])M\.?(?:Ed|Sc|Eng)(?![A-Za-z])|(?<![A-Za-z])M\.[SA]\.|תואר\s+שני/i,
  },
  {
    level: 1,
    pattern: /\bbachelor|(?<![A-Za-z])(?:BS|BA|BSc|BSN|BBA|B\.S\.|B\.A\.)(?![A-Za-z])|תואר\s+ראשון|הנדסאי/i,
  },
];

export function degreeLevel(text: string): DegreeLevel {
  for (const { level, pattern } of DEGREE_PATTERNS) if (pattern.test(text)) return level;
  return 0;
}

function degreeClaims(output: string, sourceLevel: DegreeLevel): string[] {
  const claims: string[] = [];
  for (const { level, pattern } of DEGREE_PATTERNS) {
    if (level <= sourceLevel) continue;
    const m = output.match(pattern);
    if (m) claims.push(m[0]);
  }
  return claims;
}

// ------------------------------------------------------------------ years claims

const EN_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20,
};
const HE_NUMBERS: Record<string, number> = {
  שלוש: 3, ארבע: 4, חמש: 5, שש: 6, שבע: 7, שמונה: 8, תשע: 9, עשר: 10,
};

const YEARS_EN = new RegExp(`(?<![A-Za-z])(\\d{1,2}|${Object.keys(EN_NUMBERS).join('|')})\\s*\\+?\\s*(?:years?|yrs)\\b`, 'gi');
const YEARS_HE = /\+?\s*(\d{1,2})\s*\+?\s*(?:שנות|שנים)/g;
const YEARS_HE_WORDS = new RegExp(`(?:^|[\\s(])(${Object.keys(HE_NUMBERS).join('|')})\\s+(?:שנות|שנים)`, 'g');
const TWO_YEARS_HE = /שנתיים/;

function toNumber(token: string): number {
  return /^\d+$/.test(token) ? Number(token) : EN_NUMBERS[token.toLowerCase()] ?? HE_NUMBERS[token] ?? NaN;
}

export function yearsClaims(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(YEARS_EN)) out.push(toNumber(m[1]));
  for (const m of text.matchAll(YEARS_HE)) out.push(Number(m[1]));
  for (const m of text.matchAll(YEARS_HE_WORDS)) out.push(toNumber(m[1]));
  if (TWO_YEARS_HE.test(text)) out.push(2);
  return out.filter((n) => Number.isFinite(n));
}

/** Start year of every dated role range ("Jan 2021 to Present", "ינואר 2023 עד היום"). */
function roleStartYears(source: string): number[] {
  return source
    .split('\n')
    .filter((line) => / to | עד /.test(line))
    .map((line) => line.match(/(?<![0-9])(19[6-9]\d|20[0-4]\d)(?![0-9])/)?.[1])
    .filter((y): y is string => Boolean(y))
    .map(Number);
}

/**
 * The most years the source can support: the larger of its own explicit claim and the
 * span from its earliest dated role to the fixed evaluation year. Several fixtures say
 * "3 years" over roles that span more; both figures are the candidate's own, so
 * either is truthful. Generous on purpose, so only clear inflation is flagged.
 */
export function supportedYears(source: string): number {
  const explicit = yearsClaims(source);
  const starts = roleStartYears(source);
  if (starts.length > 0) return Math.max(EVALUATION_YEAR - Math.min(...starts) + 1, ...explicit);
  if (explicit.length > 0) return Math.max(...explicit);
  const years = [...source.matchAll(/(?<![0-9])(19[6-9]\d|20[0-4]\d)(?![0-9])/g)].map((m) => Number(m[1]));
  if (years.length === 0) return 0;
  return EVALUATION_YEAR - Math.min(...years) + 1;
}

// ------------------------------------------------------------------ seniority

const SENIORITY =
  /\b(?:senior|sr\.?|lead|principal|staff|manager|head|director|vp|vice president|chief)\b|בכיר|ראש\s+צוות|מנהל/i;

/**
 * The job-title part of each dated role line ("Title, Employer", a dash, then dates), so a
 * seniority word elsewhere in the source ("while the manager was on leave") cannot
 * excuse an inflated title. Falls back to the whole source when no line matches.
 */
function sourceTitles(source: string): string {
  const titles = source
    .split('\n')
    .filter((line) => line.includes(' \u2014 ') && line.includes(','))
    .map((line) => line.split(',')[0]);
  return titles.length > 0 ? titles.join('\n') : source;
}

function seniorityInflations(resume: OptimizedResume, source: string): string[] {
  const srcTitles = normalize(sourceTitles(source));
  const out: string[] = [];
  for (const e of Array.isArray(resume.experience) ? resume.experience : []) {
    const title = typeof e.title === 'string' ? e.title : '';
    if (!title || normalize(source).includes(normalize(title))) continue;
    const words = title.match(new RegExp(SENIORITY.source, 'gi')) ?? [];
    if (words.some((w) => !srcTitles.includes(normalize(w)))) out.push(title);
  }
  return out;
}

// ------------------------------------------------------------------ metrics

const METRIC =
  /\$\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:[kmb](?![a-z])|thousand|million|billion))?|\d+(?:\.\d+)?\s?%|\d+(?:\.\d+)?x(?![a-z])/gi;

const MULTIPLIER: Record<string, number> = { k: 1e3, thousand: 1e3, m: 1e6, million: 1e6, b: 1e9, billion: 1e9 };

interface MetricValue {
  kind: 'money' | 'percent' | 'multiple';
  value: number;
}

/**
 * A metric's kind and numeric value, so "$1.2M" and "$1,200,000" compare equal and
 * "18%" is not excused by "118%". Comparing text would get both of those wrong.
 */
export function parseMetric(raw: string): MetricValue | null {
  const s = raw.toLowerCase().replace(/\s+/g, '').replace(/[.,]+$/, '');
  if (s.endsWith('%')) return { kind: 'percent', value: parseFloat(s) };
  if (s.endsWith('x')) return { kind: 'multiple', value: parseFloat(s) };
  const money = /^\$([\d,]*\.?\d+)(k|m|b|thousand|million|billion)?$/.exec(s);
  if (!money) return null;
  return { kind: 'money', value: parseFloat(money[1].replace(/,/g, '')) * (money[2] ? MULTIPLIER[money[2]] : 1) };
}

function newMetrics(output: string, source: string): string[] {
  const known = [...source.matchAll(METRIC)].map((m) => parseMetric(m[0])).filter((x): x is MetricValue => x !== null);
  const found = new Set<string>();
  for (const m of output.matchAll(METRIC)) {
    const v = parseMetric(m[0]);
    if (!v) continue;
    const supported = known.some((k) => k.kind === v.kind && Math.abs(k.value - v.value) <= 1e-9 * Math.max(1, Math.abs(k.value)));
    if (!supported) found.add(m[0].trim().replace(/[.,]+$/, ''));
  }
  return [...found];
}

// ------------------------------------------------------------------ main

export function runGroundingChecks(resume: OptimizedResume, c: ManifestCase): GroundingResult {
  const source = trustedSource(c);
  const claims = claimText(resume);
  const unsupported: UnsupportedStatement[] = [];
  const add = (category: UnsupportedCategory, text: string) =>
    unsupported.push({ category, text, source: 'deterministic' });

  for (const cred of findUnsupportedCredentials(claims, source)) add('credential', cred);
  for (const d of degreeClaims(claims, degreeLevel(source))) add('degree', d);

  const ceiling = supportedYears(source);
  for (const y of new Set(yearsClaims(claims))) if (y > ceiling) add('years-claim', `${y} years (source supports ${ceiling})`);

  for (const t of seniorityInflations(resume, source)) add('seniority-title', t);
  for (const m of newMetrics(claims, source)) add('metric', m);

  const aspirations: GroundingResult['aspirations'] = [];
  const outsideSummary = nonSummaryClaims(resume);
  const sentences = summarySentences(resume);
  for (const r of c.requirements) {
    for (const phrase of r.forbiddenClaims) {
      if (!containsPhrase(claims, phrase)) continue;
      if (unsupported.some((u) => normalize(u.text).includes(normalize(phrase)))) continue;
      const hits = sentences.filter((sentence) => containsPhrase(sentence, phrase));
      const onlyAsGoal =
        !containsPhrase(outsideSummary, phrase) && hits.length > 0 && hits.every((sentence) => ASPIRATION.test(sentence));
      if (onlyAsGoal) {
        for (const sentence of hits) aspirations.push({ requirementId: r.id, phrase, sentence });
      } else {
        add('forbidden-claim', `${r.id}: ${phrase}`);
      }
    }
  }

  for (const passage of c.untrustedPassages ?? []) {
    const probe = passage.slice(0, 40);
    if (claims.includes(probe)) add('injection-echo', probe);
  }

  // Evidence coverage: stable anchors of supported requirements that survived.
  const all = fullText(resume);
  const missing: Array<{ requirementId: string; anchor: string }> = [];
  let anchored = 0;
  let retained = 0;
  for (const r of c.requirements) {
    if (r.support === 'not-evidenced' || r.anchors.length === 0) continue;
    anchored++;
    const lost = r.anchors.filter((a) => !a.split('|').some((alt) => containsPhrase(all, alt)));
    if (lost.length === 0) retained++;
    for (const anchor of lost) missing.push({ requirementId: r.id, anchor });
  }

  const lostFacts = c.mustRetain.filter((f) =>
    f.kind === 'metric' || f.kind === 'year' ? !containsNumber(all, f.value) : !containsPhrase(all, f.value)
  );

  return {
    unsupported,
    aspirations,
    evidence: { anchored, retained, missing },
    retention: { total: c.mustRetain.length, kept: c.mustRetain.length - lostFacts.length, lost: lostFacts },
  };
}
