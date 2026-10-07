import type { OptimizedResume } from './index';
import { ASPIRATION, trustedResumeText } from './job-ad-terms';

/**
 * Seniority and scope guard (reliability upgrade, after Stage 2).
 *
 * The 2026-09-25 repeat batches measured the optimizer making a candidate sound more
 * senior than the résumé allows: "leading teams" and "mentoring teams" for an engineer
 * who mentored 2 interns, "a proven track record in managing engineering projects", a
 * role retitled to Engineering Manager, "8+ years" on a three-year career. The nightly
 * judge passed all of them; only the grounded eval judge saw them.
 *
 * Three narrow, deterministic checks, no model call:
 * - a role title carrying a seniority word its original title lacks gets the original back;
 * - an "N years of experience" claim above what the dated roles allow is lowered to it;
 * - a people-leadership or track-record phrase the résumé never earns is cut.
 * Precision matters more than recall, because a false positive edits a real person's
 * résumé. A truthful reword ("Led sprint planning for the team") must pass untouched.
 */

const SENIORITY_EN = /\b(?:senior|lead|principal|staff|manager|head|director|vp|vice president|chief|supervisor)\b/gi;
// Hebrew has no \b in JS regexes, so these match as substrings.
const SENIORITY_HE = /בכיר|ראש\s+צוות|מנהל/g;

/** Lower-case, punctuation-free, with common abbreviations spelled out, so "Sr." equals "Senior". */
function canonical(s: string): string {
  return s
    .toLowerCase()
    .replace(/\bsr\b\.?/g, 'senior')
    .replace(/\bmgr\b\.?/g, 'manager')
    .replace(/[^a-z0-9֐-׿+#]+/g, ' ')
    .trim();
}

const YEAR = /(?<![0-9])(?:19[6-9]\d|20[0-4]\d)(?![0-9])/;

/** Lines that open a role: they carry a year and a range ("May 2022 to Present", "2021 עד היום"). */
function roleLines(source: string): string[] {
  return source
    .split('\n')
    .filter((line) => YEAR.test(line) && /\bto\b|–|—|\s-\s|עד/i.test(line) && /present|current|now|היום|(?:19|20)\d\d.*(?:19|20)\d\d/i.test(line));
}

/** The title half of a role line: what precedes the employer, or failing that, what follows it. */
function titleFromLine(line: string, company: string): string {
  const at = line.toLowerCase().indexOf(company.toLowerCase());
  if (at < 0) return '';
  const before = line
    .slice(0, at)
    .replace(/(?:\s+at|\s*[,|@–—-])\s*$/i, '')
    .trim();
  if (before) return before;
  const after = line.slice(at + company.length).replace(/^\s*[,|@–—-]\s*/, '');
  return after.split(/\s*[,|–—]\s*|\s+-\s+/)[0]?.trim() ?? '';
}

function seniorityWords(title: string): string[] {
  return [...(title.match(SENIORITY_EN) ?? []), ...(title.match(SENIORITY_HE) ?? [])].map(canonical);
}

// ------------------------------------------------------------------ years

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, twenty: 20,
};
const NUMBER = `\\d{1,2}|${Object.keys(NUMBER_WORDS).join('|')}`;

/** "8+ years of FP&A experience", "5 years' experience". Requires the word "experience", on purpose. */
const YEARS_OF_EXPERIENCE = new RegExp(
  `(?<![A-Za-z0-9])(${NUMBER})(\\s*\\+)?\\s*(years?|yrs)(?:['’]s?)?\\s+(?:of\\s+)?(?:[\\w&/.-]+\\s+){0,4}?experience\\b`,
  'gi'
);
/** Any years figure the résumé states about itself, for support. */
const ANY_YEARS = new RegExp(`(?<![A-Za-z0-9])(${NUMBER})\\s*\\+?\\s*(?:years?|yrs)\\b`, 'gi');

function toNumber(token: string): number {
  return /^\d+$/.test(token) ? Number(token) : NUMBER_WORDS[token.toLowerCase()] ?? NaN;
}

interface YearsSupport {
  /** Above this, a claim is inflated. Generous: counts the current year as a full year. */
  ceiling: number;
  /** What an inflated claim is lowered to. Conservative: never above what the résumé shows. */
  replacement: number;
}

function yearsSupport(source: string, now: Date): YearsSupport | null {
  const stated = [...source.matchAll(ANY_YEARS)].map((m) => toNumber(m[1])).filter(Number.isFinite);
  const starts = roleLines(source)
    .map((line) => Number(line.match(YEAR)?.[0]))
    .filter((y) => Number.isFinite(y) && y > 0);
  if (starts.length === 0 && stated.length === 0) return null; // nothing to measure against
  const span = starts.length > 0 ? now.getFullYear() - Math.min(...starts) : 0;
  const statedMax = stated.length > 0 ? Math.max(...stated) : 0;
  return { ceiling: Math.max(span + 1, statedMax), replacement: Math.max(span, statedMax, 1) };
}

function correctYears(text: string, support: YearsSupport): { text: string; count: number } {
  let count = 0;
  const out = text.replace(YEARS_OF_EXPERIENCE, (match, num: string, plus: string | undefined, unit: string) => {
    if (toNumber(num) <= support.ceiling) return match;
    count++;
    const n = support.replacement;
    const word = unit.toLowerCase().startsWith('yr') ? 'yrs' : n === 1 ? 'year' : 'years';
    return match.replace(new RegExp(`^${num}${plus ? '\\s*\\+' : ''}\\s*${unit}`), `${n} ${word}`);
  });
  return { text: out, count };
}

// ------------------------------------------------------------------ scope

const LEAD_VERB =
  '(?:led|leads?|leading|managed|manages?|managing|mentored|mentors?|mentoring|supervised|supervises?|supervising|directed|directs?|directing|oversaw|oversees?|overseeing|headed|heads?|heading|coached|coaching)';
const PEOPLE = '(?:teams?|engineers|developers|people|direct\\s+reports|employees|analysts|designers|representatives|squads?|managers)';
// Up to three words between verb and people, none of them a preposition: "leading a team",
// "managing engineering teams", but not "Led sprint planning for the team".
const GAP = '(?:(?!(?:for|with|of|on|to|in|at|by|from|across|alongside|within)\\b)[\\w&/-]+\\s+){0,3}?';

const SCOPE_PATTERNS: Array<{ claim: RegExp; support: RegExp }> = [
  {
    claim: new RegExp(`\\b${LEAD_VERB}\\s+${GAP}${PEOPLE}\\b`, 'i'),
    support: new RegExp(`\\b${LEAD_VERB}\\s+${GAP}${PEOPLE}\\b|\\b(?:team|people)\\s+(?:lead|leader|manager)\\b`, 'i'),
  },
  {
    claim: /\b(?:people|team|staff)\s+(?:management|leadership)\b/i,
    support: new RegExp(`\\b(?:people|team|staff)\\s+(?:management|leadership)\\b|\\b${LEAD_VERB}\\s+${GAP}${PEOPLE}\\b|\\b(?:team|people)\\s+(?:lead|leader|manager)\\b`, 'i'),
  },
  {
    claim: /\b(?:an?\s+)?(?:proven|demonstrated|established|strong)\s+track\s+record\b/i,
    support: /\btrack\s+record\b/i,
  },
];

function unsupportedScope(text: string, source: string): RegExp[] {
  return SCOPE_PATTERNS.filter((p) => p.claim.test(text) && !p.support.test(source)).map((p) => p.claim);
}

/**
 * Cuts the clause holding the claim when a connector introduces it (", leading a team of
 * 5 engineers", " and a proven track record in ..."), up to the next comma, semicolon or
 * full stop. Returns null when the claim is the sentence itself.
 */
function cutClause(text: string, claim: RegExp): string | null {
  const m = claim.exec(text);
  if (!m) return text;
  const before = text.slice(0, m.index);
  const connector = before.match(/(?:,\s*(?:and\s+|while\s+|including\s+)?|\s+(?:and|while|including|with)\s+)$/i);
  if (!connector) return null;
  const start = m.index - connector[0].length;
  const rest = text.slice(m.index + m[0].length);
  const stop = rest.search(/[,;.]/);
  const end = m.index + m[0].length + (stop < 0 ? rest.length : stop);
  return (text.slice(0, start) + text.slice(end)).replace(/\s{2,}/g, ' ').replace(/\s+([.,;])/g, '$1').trim();
}

function stripScope(text: string, source: string): string | null {
  let out = text;
  for (let guard = 0; guard < 5; guard++) {
    const claims = unsupportedScope(out, source);
    if (claims.length === 0) return out;
    const cut = cutClause(out, claims[0]);
    if (cut === null || cut.length < 12) return null;
    out = cut;
  }
  return null;
}

function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+|\n+/).filter((s) => s.trim().length > 0);
}

// ------------------------------------------------------------------ guard

export interface SeniorityGuardReport {
  checked: true;
  titlesRestored: number;
  yearsCorrected: number;
  /** Summary sentences, bullets, clauses or skills taken out for an unearned leadership claim. */
  scopeRemoved: number;
  /** Claims left in place because removing them would empty a role or the summary. */
  unresolved: number;
}

/**
 * Corrects the rewrite against the original résumé. Returns the input object untouched
 * when nothing is wrong. The report carries counts only, never résumé text.
 */
export function enforceSeniorityTruth(
  resume: OptimizedResume,
  resumeText: string,
  now: Date = new Date()
): { resume: OptimizedResume; report: SeniorityGuardReport; changed: boolean } {
  const source = trustedResumeText(resumeText);
  const report: SeniorityGuardReport = { checked: true, titlesRestored: 0, yearsCorrected: 0, scopeRemoved: 0, unresolved: 0 };
  const lines = roleLines(source);
  const sourceTitles = canonical(lines.length > 0 ? lines.join('\n') : source);
  const years = yearsSupport(source, now);
  let changed = false;

  const fixYears = (text: string): string => {
    if (!years) return text;
    const r = correctYears(text, years);
    report.yearsCorrected += r.count;
    return r.text;
  };

  // Summary: goal sentences are never policed.
  const summaryIn = typeof resume.summary === 'string' ? resume.summary : '';
  const summaryParts = sentences(summaryIn);
  const summaryOut: string[] = [];
  summaryParts.forEach((sentence) => {
    if (ASPIRATION.test(sentence)) return summaryOut.push(sentence);
    const s = fixYears(sentence);
    if (unsupportedScope(s, source).length === 0) return summaryOut.push(s);
    const cut = stripScope(s, source);
    if (cut !== null) {
      report.scopeRemoved++;
      return summaryOut.push(cut);
    }
    if (summaryParts.length > 1) {
      report.scopeRemoved++;
      return; // drop the sentence
    }
    report.unresolved++;
    summaryOut.push(s);
  });
  const summary = summaryOut.join(' ');
  if (summaryOut.length !== summaryParts.length || summaryOut.some((s, i) => s !== summaryParts[i])) changed = true;

  const experience = (Array.isArray(resume.experience) ? resume.experience : []).map((role) => {
    let title = role.title;
    if (typeof title === 'string' && title && !canonical(source).includes(canonical(title))) {
      const inflated = seniorityWords(title).some((w) => !sourceTitles.includes(w));
      if (inflated && typeof role.company === 'string' && role.company) {
        const line = lines.find((l) => l.toLowerCase().includes(role.company.toLowerCase()) && (!role.startDate || l.includes(role.startDate.slice(-4)))) ??
          lines.find((l) => l.toLowerCase().includes(role.company.toLowerCase()));
        const original = line ? titleFromLine(line, role.company) : '';
        if (original) {
          title = original;
          report.titlesRestored++;
          changed = true;
        } else {
          report.unresolved++;
        }
      }
    }

    const bullets = role.achievements ?? [];
    const fixedBullets = bullets.map(fixYears);
    if (fixedBullets.some((b, i) => b !== bullets[i])) changed = true;
    const kept: string[] = [];
    const dropped: string[] = [];
    for (const fixed of fixedBullets) {
      if (unsupportedScope(fixed, source).length === 0) {
        kept.push(fixed);
        continue;
      }
      const cut = stripScope(fixed, source);
      if (cut !== null) {
        kept.push(cut);
        report.scopeRemoved++;
        changed = true;
      } else {
        dropped.push(fixed);
      }
    }
    let achievements = kept;
    if (dropped.length > 0) {
      if (kept.length === 0) {
        // Never empty a role (WP-64): keep its bullets and report the claim instead.
        achievements = fixedBullets;
        report.unresolved += dropped.length;
      } else {
        report.scopeRemoved += dropped.length;
        changed = true;
      }
    }
    return { ...role, title, achievements };
  });

  const keepSkill = (s: string) => {
    if (unsupportedScope(s, source).length === 0) return true;
    report.scopeRemoved++;
    changed = true;
    return false;
  };
  const skills = {
    technical: (resume.skills?.technical ?? []).filter(keepSkill),
    soft: (resume.skills?.soft ?? []).filter(keepSkill),
  };

  if (!changed) return { resume, report, changed: false };
  return { resume: { ...resume, summary, experience, skills }, report, changed: true };
}
