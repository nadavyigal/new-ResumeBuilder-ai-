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
 * Five narrow, deterministic checks, no model call:
 * - a role title carrying a seniority word its original title lacks gets the original back;
 * - a summary that names the candidate by a title they never held ("Engineering Manager",
 *   "מנהל תפעול") loses that sentence, or falls back to the résumé's own summary;
 * - an "N years of experience" claim above what the dated roles allow is lowered to it;
 * - a people-leadership or track-record phrase the résumé never earns is cut;
 * - a head count no number in the résumé backs ("team of 3" become "org of 30") is cut.
 * Evidence for a role comes from that role's own block in the résumé (its header lines
 * and bullets), so a later manager job never excuses a promoted earlier one. The summary
 * and the skills speak for the whole career and are checked against all of it.
 * Precision matters more than recall, because a false positive edits a real person's
 * résumé. A truthful reword ("Led sprint planning for the team") must pass untouched.
 *
 * Consolidated 2026-10-16 with #161, which brought the prompt rule, the Hebrew title and
 * management patterns, the "management experience" claim, the summary title check and
 * the head-count check (the two batch 3 failures #161 was opened for).
 */

const HE = '\\u05d0-\\u05ea';

const SENIORITY_EN = /\b(?:senior|lead|principal|staff|manager|head|director|vp|vice president|chief|supervisor)\b/gi;
// Hebrew has no \b in JS regexes. "מנהלה" (administration) and "מנהלתי" (administrative)
// are not "מנהל" (manager); "ראשון" (first) is not "ראש" (head); "דירקטוריון" is a board.
const SENIORITY_HE = new RegExp(
  `(?<![${HE}])ה?(בכיר|ראש(?:ת)?(?![${HE}])|סמנכ["״]ל|מנכ["״]ל|דירקטור(?:ית)?(?![${HE}])|מנהל(?!ה(?![${HE}])|תי))`,
  'g'
);
/** Title words that mean the person managed people, so their leadership claims are earned. */
const PEOPLE_LEADER_TITLE = new RegExp(
  `\\b(?:manager|director|head|lead|supervisor|vp|vice president|chief|foreman)\\b|מנהל(?!ה(?![${HE}])|תי)|ראש(?:ת)?\\s+צוות|סמנכ["״]ל|מנכ["״]ל`,
  'i'
);

/** Lower-case, punctuation-free, with common abbreviations spelled out, so "Sr." equals "Senior". */
function canonical(s: string): string {
  return s
    .toLowerCase()
    .replace(/\bsr\b\.?/g, 'senior')
    .replace(/\bmgr\b\.?/g, 'manager')
    .replace(/[^a-z0-9֐-׿+#]+/g, ' ')
    .trim();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Whether canonical text holds a seniority word as a word. English allows a plural or
 * agent ending ("lead" in "Team Leader"); Hebrew a gender or plural ending ("מנהל" in "מנהלת").
 */
function hasWord(canonicalText: string, word: string): boolean {
  const hebrew = /[֐-׿]/.test(word);
  const ending = hebrew ? `(?:ת|ה|ים|ות)?(?![${HE}])` : '(?:s|er|ers)?(?![a-z0-9])';
  return new RegExp(`(?<![a-z0-9${HE}])${hebrew ? 'ה?' : ''}${escapeRegExp(word)}${ending}`).test(canonicalText);
}

const YEAR = /(?<![0-9])(?:19[6-9]\d|20[0-4]\d)(?![0-9])/;

/**
 * A dated range: "May 2022 to Present", "2016-Present", "03/2014-12/2015",
 * "מרץ 2020 עד היום", "since 2019". Spacing around the dash varies, so it is optional.
 */
const RANGE =
  /(?:19|20)\d\d\s*(?:-|–|—|to|until|till|עד)\s*(?:[A-Za-zא-ת]{3,9}\.?\s+)?(?:\d{1,2}\/)?(?:(?:19|20)\d\d|present|current|now|today|היום|כיום)|\bsince\s+(?:[A-Za-z]{3,9}\.?\s+)?(?:19|20)\d\d/i;

const BULLET = /^\s*(?:[-•*▪●–·]|\d+[.)])\s*/;
const SECTION_WORDS =
  /^(?:(?:professional\s+|work\s+)?(?:summary|profile|experience|employment|education|skills|projects|certifications|languages|volunteering)|ניסיון(?:\s+\S+)?|השכלה|תקציר|כישורים|מיומנויות|שפות|פרויקטים|התנדבות)\s*:?$/i;

/** Sections whose dated lines are not jobs: a degree's years are not years of experience. */
const NON_EMPLOYMENT_SECTION =
  /^(?:education|academic|projects?|personal projects|certifications?|licen[cs]es|courses?|training|volunteer(?:ing)?|awards|publications|השכלה|לימודים|פרויקטים|הסמכות|קורסים|התנדבות)\b/i;

function isHeading(line: string): boolean {
  const t = line.trim();
  return (t === t.toUpperCase() && /[A-Z]/.test(t)) || SECTION_WORDS.test(t);
}

/** A line that can hold a job title: not a bullet, not dated, not a sentence, not a shouted header. */
function titleLike(line: string | undefined): line is string {
  if (!line) return false;
  const t = line.trim();
  return t.length > 0 && t.length <= 80 && !BULLET.test(t) && !YEAR.test(t) && !/[.!?]$/.test(t) && t !== t.toUpperCase();
}

/**
 * A word that names a job, so a header segment carrying one can be a title and a
 * location ("New York, NY") or an employer cannot pass for one.
 */
const ROLE_NOUN = new RegExp(
  '\\b(?:engineer|developer|programmer|manager|analyst|designer|scientist|consultant|specialist|coordinator|director|lead|leader|head|officer|associate|assistant|administrator|architect|representative|executive|accountant|teacher|instructor|nurse|technician|intern|owner|founder|tester|writer|editor|producer|recruiter|agent|advisor|adviser|strategist|planner|supervisor|clerk|cashier|barista|chef|cook|driver|operator|controller|auditor|economist|lawyer|attorney|paralegal|therapist|researcher|marketer|buyer|trainer|president|vp|chief|partner|tutor|lecturer|professor|pharmacist|physician|secretary|receptionist|bookkeeper|mechanic|electrician|commander)s?\\b' +
    '|מפתח|מהנדס|מתכנת|מנהל|רכז|אנליסט|מעצב|ראש|קצין|קצינה|יועץ|יועצת|מורה|אחות|נציג|עוזר|סמנכ|מנכ|דירקטור|בודק|חוקר|מדען|מתאם|אחראי|מזכיר|טכנאי|רואה\\s+חשבון|עורך|עורכת|מגייס|מדריך|מאמן|מפקד|מפיק|מוכר|ממונה',
  'i'
);

interface SourceRole {
  /** The dated line. */
  line: string;
  /** The dated line and the header lines around it (company, title, location), nearest first. */
  header: string[];
  /** The header and its bullets, up to the next role or section. */
  section: string;
  /** Calendar years the role covers; an open role ends this year. */
  start: number;
  end: number;
}

/**
 * Every dated role in the résumé as a block: up to two header lines on each side of
 * the dated line ("Acme Corp | New York" above "Software Engineer | 2020 – Present",
 * or "Acme — 2020 to Present" above "New York, NY" and "Software Engineer"), and the
 * bullets under it. The candidate's name, a section heading or a bullet ends a header.
 */
function sourceRoles(source: string, now: Date): SourceRole[] {
  const lines = source.split('\n');
  // The first line of a résumé is the candidate's name, never a title.
  const nameLine = lines.findIndex((l) => l.trim().length > 0);
  const isDated = (l: string) => YEAR.test(l) && RANGE.test(l);
  const isHeader = (i: number) => i >= 0 && i < lines.length && i !== nameLine && titleLike(lines[i]) && !isHeading(lines[i]);

  // Which section each line sits in. Before any heading, a dated line counts as a job.
  let employment = true;
  const inEmployment = lines.map((line) => {
    if (isHeading(line)) employment = !NON_EMPLOYMENT_SECTION.test(line.trim());
    return employment;
  });

  const blocks = lines.flatMap((line, i) => {
    if (!isDated(line) || !inEmployment[i]) return [];
    // Up to three header lines above ("Software Engineer" / "Acme Corp" / "New York, NY"
    // over the dates) and two below.
    const above: number[] = [];
    for (let j = i - 1; j >= i - 3 && isHeader(j); j--) above.push(j);
    const below: number[] = [];
    for (let j = i + 1; j <= i + 2 && isHeader(j); j++) below.push(j);
    // Nearest first: the line right below, the line right above, then further out.
    const header = [
      line,
      ...[below[0], above[0], below[1], above[1], above[2]].filter((j): j is number => j !== undefined).map((j) => lines[j]),
    ];
    const years = (line.match(RANGE)?.[0].match(/(?:19|20)\d\d/g) ?? []).map(Number);
    return [{ dated: i, top: Math.min(i, ...above), bottom: Math.max(i, ...below), header, start: years[0], end: years[1] ?? now.getFullYear() }];
  });

  return blocks.map((block, k) => {
    const limit = k + 1 < blocks.length ? blocks[k + 1].top : lines.length;
    let last = block.bottom;
    while (last + 1 < limit && !isHeading(lines[last + 1])) last++;
    return {
      line: lines[block.dated],
      header: block.header.map((l) => l.trim()),
      section: lines.slice(block.top, last + 1).join('\n'),
      start: block.start,
      end: Math.max(block.start, block.end),
    };
  });
}

const SEGMENT_SPLIT = /\s*(?:[,|•·@]|\s[–—-]\s|\sat\s)\s*/i;

/**
 * The original title of a role: the first header segment, dated line first, that names
 * a job and is not the employer, a date or a place. Empty when none does, so a name,
 * a location or a date is never restored as a title.
 */
function originalTitle(role: SourceRole, company: string): string {
  const employer = company.toLowerCase();
  for (const line of role.header) {
    for (const segment of line.split(SEGMENT_SPLIT)) {
      const s = segment.trim();
      if (!s || YEAR.test(s) || /\b(?:present|current)\b|היום|כיום/i.test(s)) continue;
      if (employer && s.toLowerCase().includes(employer)) continue;
      if (ROLE_NOUN.test(s)) return s;
    }
  }
  return '';
}

function seniorityWords(title: string): string[] {
  return [...(title.match(SENIORITY_EN) ?? []), ...[...title.matchAll(SENIORITY_HE)].map((m) => m[1])].map(canonical);
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

function toNumber(token: string): number {
  return /^\d+$/.test(token) ? Number(token) : NUMBER_WORDS[token.toLowerCase()] ?? NaN;
}

interface YearsSupport {
  /** Above this, a claim is inflated. Generous: counts every calendar year a role touches. */
  ceiling: number;
  /** What an inflated claim is lowered to. Conservative: never above what the résumé shows. */
  replacement: number;
}

/**
 * Years the dated roles cover, gaps between them excluded: 2005-2008 and 2020-now is
 * about nine years, not twenty-one. Overlapping or back-to-back roles merge.
 */
function yearsSupport(source: string, roles: SourceRole[]): YearsSupport | null {
  // Only a years figure stated as experience ("6 years of experience") supports a claim;
  // "Analyzed 10 years of financial data" is a duration of data, not of a career.
  const stated = [...source.matchAll(YEARS_OF_EXPERIENCE)].map((m) => toNumber(m[1])).filter(Number.isFinite);
  const spans = roles.filter((r) => Number.isFinite(r.start)).map((r) => [r.start, r.end]).sort((a, b) => a[0] - b[0]);
  if (spans.length === 0 && stated.length === 0) return null; // nothing to measure against
  const merged: number[][] = [];
  for (const [start, end] of spans) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1] + 1) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  const covered = merged.reduce((n, [start, end]) => n + (end - start), 0);
  const touched = merged.reduce((n, [start, end]) => n + (end - start + 1), 0);
  const statedMax = stated.length > 0 ? Math.max(...stated) : 0;
  return { ceiling: Math.max(touched, statedMax), replacement: Math.max(covered, statedMax, 1) };
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
/** The same verbs without mentoring and coaching, which do not make anyone a manager. */
const MANAGE_VERB =
  '(?:led|leads?|leading|managed|manages?|managing|supervised|supervises?|supervising|directed|directs?|directing|oversaw|oversees?|overseeing|headed|heads?|heading)';
const PEOPLE = '(?:teams?|engineers|developers|people|direct\\s+reports|employees|analysts|designers|representatives|squads?|managers)';
/** Other words résumés use for the people someone managed: "a five-person department", "warehouse staff". */
const PEOPLE_SYNONYMS = '(?:departments?|groups?|staff|personnel|crews?|workforce|workers|technicians|agents|nurses|soldiers)';
// Up to three words between verb and people, none of them a preposition: "leading a team",
// "managing engineering teams", but not "Led sprint planning for the team".
const GAP = '(?:(?!(?:for|with|of|on|to|in|at|by|from|across|alongside|within)\\b)[\\w&/-]+\\s+){0,3}?';

const LEADS_PEOPLE = `\\b${LEAD_VERB}\\s+${GAP}${PEOPLE}\\b|\\b${MANAGE_VERB}\\s+${GAP}${PEOPLE_SYNONYMS}\\b|\\b(?:team|people)\\s+(?:lead|leader|manager)\\b`;

/** Hebrew managing people: "ניהול צוות", "בניהול צוותים", "הובלתי צוות", "פיקוד על צוות של 9", "ראש צוות". */
const HE_MANAGES_PEOPLE =
  `(?<![${HE}])[הובלמשכ]{0,2}(?:ניהול|ניהלתי|ניהל|ניהלה|מנהל|מנהלת|הובלת|הובלתי|הוביל|הובילה|מוביל|מובילה|פיקוד\\s+על|פיקדתי\\s+על|פיקד\\s+על|פיקדה\\s+על)\\s+(?:את\\s+)?ה?(?:צוותים|צוות|עובדים|אנשים|כפיפים|מחלקות|מחלקה|חיילים|מתמחים)(?![${HE}])` +
  `|(?<![${HE}])[הובלמשכ]{0,2}(?:ראש|ראשת)\\s+צוות|ניסיון\\s+ניהולי|גיוס\\s+ו?(?:עובדים|צוות)|(?:הערכות|משובי)\\s+ביצועים`;

/** "management experience" claimed as such. "account management experience" is account work. */
const MANAGEMENT_EXPERIENCE =
  '\\bmanagerial\\s+experience\\b|(?<=^|\\b(?:of|with|has|have|including|strong|proven|extensive|solid|prior|previous|brings?)\\s+)management\\s+experience\\b';

interface ScopePattern {
  claim: RegExp;
  support: RegExp;
  /** A people-leadership claim, which a manager's title or work earns on its own. */
  leadership: boolean;
}

const SCOPE_PATTERNS: ScopePattern[] = [
  {
    claim: new RegExp(`\\b${LEAD_VERB}\\s+${GAP}${PEOPLE}\\b(?!['’]s)`, 'i'),
    support: new RegExp(LEADS_PEOPLE, 'i'),
    leadership: true,
  },
  {
    claim: /\b(?:people|team|staff)\s+(?:management|leadership)\b/i,
    support: new RegExp(`\\b(?:people|team|staff)\\s+(?:management|leadership)\\b|${LEADS_PEOPLE}`, 'i'),
    leadership: true,
  },
  {
    claim: new RegExp(MANAGEMENT_EXPERIENCE, 'i'),
    support: new RegExp(`${MANAGEMENT_EXPERIENCE}|${LEADS_PEOPLE}`, 'i'),
    leadership: true,
  },
  {
    claim: new RegExp(HE_MANAGES_PEOPLE),
    support: new RegExp(`${HE_MANAGES_PEOPLE}|${LEADS_PEOPLE}`, 'i'),
    leadership: true,
  },
  {
    claim: /\b(?:an?\s+)?(?:proven|demonstrated|established|strong)\s+track\s+record\b/i,
    support: /\btrack\s+record\b/i,
    leadership: false,
  },
];

/**
 * Evidence of managing people that the claim patterns cannot see: a manager's title, or
 * the work only a manager does. A title held by someone else in a bullet ("while the
 * manager was on leave") does not count, because only title lines are read.
 */
const MANAGER_WORK = /\bhired\s+\d+|\bdirect\s+reports?\b|\bperformance\s+reviews?\b/i;

/** Where a claim is checked: the text that may support it, and whether a manager's title or work covers it. */
interface Evidence {
  text: string;
  leader: boolean;
  /** Every number the résumé states, so a head count can be traced to it. */
  numbers: Set<number>;
}

function unsupportedScope(text: string, evidence: Evidence): RegExp[] {
  const patterns = SCOPE_PATTERNS.filter(
    (p) => p.claim.test(text) && !p.support.test(evidence.text) && !(evidence.leader && p.leadership)
  ).map((p) => p.claim);
  // The verb that introduces a head count goes with it, so ", leading a team of 8" is cut as a clause.
  const headcounts = headcountClaims(text, evidence.numbers).map(
    (phrase) => new RegExp(`(?:\\b${LEAD_VERB}\\s+(?:[\\w-]+\\s+){0,3}?)?${escapeRegExp(phrase)}`, 'i')
  );
  return [...patterns, ...headcounts];
}

// ------------------------------------------------------------------ team size (from #161)

const HEADCOUNT_WORDS: Record<string, number> = {
  two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  fifteen: 15, twenty: 20, dozen: 12, שניים: 2, שתיים: 2, שני: 2, שתי: 2, שלושה: 3, שלוש: 3, ארבעה: 4, ארבע: 4,
  חמישה: 5, חמש: 5, שישה: 6, שש: 6, שבעה: 7, שבע: 7, שמונה: 8, תשעה: 9, תשע: 9, עשרה: 10, עשר: 10,
};

/** Token-bounded and case-insensitive; a Hebrew word may carry an attached prefix. */
function containsWord(text: string, word: string): boolean {
  const lead = /[֐-׿]/.test(word) ? `(?<![${HE}])[הובלמשכ]{0,2}` : '(?<![A-Za-z0-9])';
  return new RegExp(`${lead}${escapeRegExp(word)}(?![A-Za-z0-9${HE}])`, 'i').test(text);
}

function sourceNumbers(source: string): Set<number> {
  const out = new Set<number>();
  for (const m of source.matchAll(/\d[\d,]*(?:\.\d+)?/g)) out.add(Number(m[0].replace(/,/g, '')));
  for (const [word, n] of Object.entries(HEADCOUNT_WORDS)) if (containsWord(source, word)) out.add(n);
  return out;
}

/** A head count: "team of 30", "a 5-person team", "12 engineers", "צוות של 90", "90 חיילים". */
const HEADCOUNT = [
  /\b(?:team|teams|group|org|organization|department|staff|squad|unit|crew)\s+of\s+(?:over\s+|more\s+than\s+|up\s+to\s+|about\s+|nearly\s+)?(\d[\d,]*)/gi,
  /(\d[\d,]*)\+?(?:\s*|-)(?:person|people|member|headcount|FTE)\b/gi,
  /(\d[\d,]*)\+?\s+(?:[a-z-]+\s+)?(?:engineers|developers|employees|people|staff|reports|interns|analysts|agents|designers|nurses|soldiers|members|associates|technicians|volunteers|students|teachers|managers|reps|representatives)\b/gi,
  /צוות(?:ים)?\s+של\s+(\d[\d,]*)/g,
  /(\d[\d,]*)\s+(?:עובדים|עובדות|חיילים|חיילות|אנשים|מהנדסים|מפתחים|מפתחות|כפיפים|חברי\s+צוות|אנשי\s+צוות|סטודנטים|תלמידים|נציגים|אחיות|מתמחים)/g,
];

/** Head counts in the text that no number in the résumé backs. "30,000 requests" never backs "30 engineers". */
function headcountClaims(text: string, known: Set<number>): string[] {
  const out: string[] = [];
  for (const re of HEADCOUNT) {
    for (const m of text.matchAll(re)) if (!known.has(Number(m[1].replace(/,/g, '')))) out.push(m[0]);
  }
  return out;
}

// ------------------------------------------------------------------ who the summary says the candidate is (from #161)

/** Where a summary sentence turns from a claim into a goal. Text after it is not a claim. */
const GOAL_START =
  /\b(?:seeking|looking (?:for|to)|aiming|aspiring|hoping|eager|keen|ready to|targeting|pursuing|interested in|transitioning (?:to|into)|wants? to|to (?:grow|move|advance|step|transition) into)\b|מחפש|מחפשת|שואף|שואפת|מעוניין|מעוניינת|מבקש|מבקשת/i;

function claimPart(sentence: string): string {
  const m = GOAL_START.exec(sentence);
  return m ? sentence.slice(0, m.index) : sentence;
}

/**
 * Whether the claim part of a summary sentence names the candidate by a titled phrase
 * the résumé never uses, at a seniority no held title gives. Batch 3 called a logistics
 * officer "מנהל תפעול" and an engineer "Engineering Manager": the job ad's title written
 * as who the candidate is. A Senior Frontend Engineer called a "Senior React Engineer"
 * changed specialty, not seniority, and passes.
 */
function summaryNamesUnheldTitle(sentence: string, source: string, heldTitles: string): boolean {
  const claim = claimPart(sentence);
  const phrases: string[] = [];
  for (const m of claim.matchAll(/\b(?:Senior|Sr\.|Lead|Principal|Staff|Chief)\s+[A-Z][\w&/-]*/g)) phrases.push(m[0]);
  for (const m of claim.matchAll(/\b(?:Head|Director|VP|Vice President)\s+of\s+(?:the\s+)?[A-Z][\w&/-]*/g)) phrases.push(m[0]);
  for (const m of claim.matchAll(/\b[A-Z][\w&/-]*\s+(?:Manager|Director|Lead|Supervisor)\b/g)) phrases.push(m[0]);
  const titled = new RegExp(`(?<![${HE}])[ושה]?(מנהל|מנהלת|ראש|סמנכ"ל|סמנכ״ל|מנכ"ל|מנכ״ל|דירקטור|דירקטורית)\\s+([${HE}"״]+)`, 'g');
  for (const [, role, object] of claim.matchAll(titled)) {
    // "מנהל X" also reads as the verb "manages X": fine when the résumé shows managing X.
    const stem = object.replace(/^ה/, '').slice(0, 3);
    if (role.startsWith('מנהל') && new RegExp(`(?:ניהול|ניהל|ניהלה|ניהלתי|מנהל|מנהלת)\\s+ה?${escapeRegExp(stem)}`).test(source)) continue;
    phrases.push(`${role} ${object}`);
  }
  for (const m of claim.matchAll(new RegExp(`[${HE}]+\\s+(?:בכיר|בכירה)(?![${HE}])`, 'g'))) phrases.push(m[0]);
  const held = canonical(heldTitles);
  const canonicalSource = canonical(source);
  return phrases.some((p) => {
    if (canonicalSource.includes(canonical(p))) return false;
    const words = seniorityWords(p);
    return words.length === 0 || words.some((w) => !hasWord(held, w));
  });
}

const SUMMARY_HEADING = /^\s*(?:professional\s+)?(?:summary|profile|about(?: me)?|objective|תקציר|תמצית|פרופיל|סיכום|אודות|על עצמי)\s*:?\s*$/i;

/** The résumé's own summary: the lines under a summary heading, up to the next blank line. */
function sourceSummary(source: string): string | null {
  const lines = source.split('\n');
  const start = lines.findIndex((l) => SUMMARY_HEADING.test(l));
  if (start < 0) return null;
  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (!line.trim()) {
      if (body.length > 0) break;
      continue;
    }
    if (isHeading(line)) break;
    body.push(line.trim());
  }
  return body.length > 0 ? body.join(' ') : null;
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

function stripScope(text: string, evidence: Evidence): string | null {
  let out = text;
  for (let guard = 0; guard < 5; guard++) {
    const claims = unsupportedScope(out, evidence);
    if (claims.length === 0) return out;
    const cut = cutClause(out, claims[0]);
    if (cut === null || cut.length < 12) return null;
    out = cut;
  }
  return null;
}

/** A goal the shared ASPIRATION marker misses: "Seeking a role leading teams". */
const GOAL_ROLE = /\b(?:seeking|pursuing|targeting)\s+(?:a|an)\b|\blooking\s+for\s+(?:a|an)\b/i;

/**
 * Experience the candidate claims to have, inside a goal sentence: "Seeking to apply
 * my experience managing teams" states a past fact, while "Aiming to grow into leading
 * teams" does not.
 */
const CLAIMED_IN_GOAL =
  /\b(?:my|our)\s+(?:[\w-]+\s+){0,2}(?:experience|background|expertise|track\s+record|skills)\b|\bexperience\s+(?:in|with|of|managing|leading)\b|\bhaving\s+(?:led|managed|mentored|supervised|headed)\b|ניסיוני|הניסיון\s+שלי/i;

/** A goal sentence with no claim about the past is never policed. */
function isPureGoal(sentence: string): boolean {
  return (ASPIRATION.test(sentence) || GOAL_ROLE.test(sentence)) && !CLAIMED_IN_GOAL.test(sentence);
}

function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+|\n+/).filter((s) => s.trim().length > 0);
}

// ------------------------------------------------------------------ guard

export interface SeniorityGuardReport {
  checked: true;
  titlesRestored: number;
  yearsCorrected: number;
  /** Summary sentences, bullets, clauses or skills taken out for an unearned leadership claim or head count. */
  scopeRemoved: number;
  /** Summary sentences that named the candidate by a title they never held, dropped or replaced by the résumé's own summary. */
  summaryTitlesRemoved: number;
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
  const report: SeniorityGuardReport = {
    checked: true,
    titlesRestored: 0,
    yearsCorrected: 0,
    scopeRemoved: 0,
    summaryTitlesRemoved: 0,
    unresolved: 0,
  };
  const roles = sourceRoles(source, now);
  const allHeaders = roles.map((r) => r.header.join('\n')).join('\n');
  const managesPeople = (text: string, titles: string) => PEOPLE_LEADER_TITLE.test(titles) || MANAGER_WORK.test(text);
  // The summary and the skills speak for the whole career.
  const numbers = sourceNumbers(source);
  const career: Evidence = { text: source, leader: managesPeople(source, allHeaders), numbers };
  const years = yearsSupport(source, roles);
  let changed = false;

  /** The source role an output role rewrites: same employer, and the same start year when both give one. */
  const findRole = (company: unknown, startDate: unknown): SourceRole | undefined => {
    if (typeof company !== 'string' || !company.trim()) return undefined;
    const employer = company.trim().toLowerCase();
    const same = roles.filter((r) => r.header.join('\n').toLowerCase().includes(employer));
    const year = typeof startDate === 'string' ? startDate.match(/(?:19|20)\d\d/)?.[0] : undefined;
    return (year && same.find((r) => r.line.includes(year))) || same[0];
  };

  const fixYears = (text: string): string => {
    if (!years) return text;
    const r = correctYears(text, years);
    report.yearsCorrected += r.count;
    return r.text;
  };

  // Summary: a pure goal is never policed; a goal that also claims experience is.
  const summaryIn = typeof resume.summary === 'string' ? resume.summary : '';
  const summaryParts = sentences(summaryIn);
  const summaryOut: string[] = [];
  let unheldTitles = 0;
  summaryParts.forEach((sentence) => {
    if (summaryNamesUnheldTitle(sentence, source, allHeaders)) {
      unheldTitles++;
      return; // decided below, once it is known whether an honest sentence remains
    }
    if (isPureGoal(sentence)) return summaryOut.push(sentence);
    const s = fixYears(sentence);
    if (unsupportedScope(s, career).length === 0) return summaryOut.push(s);
    const cut = stripScope(s, career);
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
  if (unheldTitles > 0) {
    // Drop the sentence while an honest one remains; otherwise the résumé's own summary.
    const own = summaryOut.length === 0 ? sourceSummary(source) : null;
    if (summaryOut.length > 0 || own) {
      if (own) summaryOut.push(own);
      report.summaryTitlesRemoved += unheldTitles;
    } else {
      report.unresolved += unheldTitles;
      summaryOut.push(...summaryParts);
    }
  }
  // Untouched sentences keep the summary exactly as written, line breaks included.
  const summaryChanged = summaryOut.length !== summaryParts.length || summaryOut.some((s, i) => s !== summaryParts[i]);
  const summary = summaryChanged ? summaryOut.join(' ') : resume.summary;
  if (summaryChanged) changed = true;

  const experience = (Array.isArray(resume.experience) ? resume.experience : []).map((role) => {
    const match = findRole(role.company, role.startDate);
    // A role is checked against its own block; one that matches no block, against the career.
    const evidence: Evidence = match
      ? { text: match.section, leader: managesPeople(match.section, match.header.join('\n')), numbers }
      : career;
    const titleEvidence = canonical(match ? match.header.join('\n') : roles.length > 0 ? allHeaders : source);

    let title = role.title;
    if (typeof title === 'string' && title && !titleEvidence.includes(canonical(title))) {
      const inflated = seniorityWords(title).some((w) => !hasWord(titleEvidence, w));
      if (inflated) {
        const original = match ? originalTitle(match, String(role.company)) : '';
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
      if (unsupportedScope(fixed, evidence).length === 0) {
        kept.push(fixed);
        continue;
      }
      const cut = stripScope(fixed, evidence);
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
    if (unsupportedScope(s, career).length === 0) return true;
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
