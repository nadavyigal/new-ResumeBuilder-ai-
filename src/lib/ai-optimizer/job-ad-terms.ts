import type { OptimizedResume } from './index';
import { countBullets } from './normalize-experience';
import { findJobOnlyTerms } from '@/lib/ats/quick-wins/grounding';

/**
 * Job-ad terms guard (reliability upgrade, Stage 2).
 *
 * A keyword appearing in the job ad is not permission to put it in the résumé. The
 * 2026-09-25 repeat batches measured the optimizer adding named tools the résumé
 * never mentions (Salesforce, Google Ads, Postman, SAP, AWS, "EHR implementation")
 * in 17 of 120 runs, and the nightly gate passed all 17.
 *
 * This module is deliberately narrow. It polices NAMED tools, platforms and
 * credentials, not concepts: "Salesforce" or "PMP" can be traced to a résumé; "API",
 * "B2B" or "leadership" are rewordings that a truthful rewrite may use. Precision
 * matters more than recall here, because a false positive edits a real person's
 * résumé.
 */

const HEBREW = /[֐-׿]/;

/** Acronyms and capitalised words that name a concept, a role or plain English, not a tool. */
const NOT_A_TOOL = new Set([
  'api', 'apis', 'kpi', 'kpis', 'ci', 'cd', 'ci/cd', 'saas', 'b2b', 'b2c', 'qa', 'ui', 'ux', 'hr', 'it', 'ai', 'ml',
  'us', 'uk', 'eu', 'usa', 'ceo', 'cto', 'cfo', 'coo', 'vp', 'ba', 'bs', 'ma', 'ms', 'mba', 'phd', 'erp', 'crm',
  'sla', 'okr', 'okrs', 'roi', 'seo', 'sem', 'ppc', 'etc', 'ok', 'id', 'pm', 'ic', 'fp&a', 'for', 'any', 'the',
  'and', 'not', 'all', 'you', 'our', 'are', 'new', 'tool', 'must', 'will', 'with', 'this', 'that', 'from', 'your',
  'have', 'job', 'role', 'team', 'nyc', 'sf', 'la', 'csat', 'nps', 'arr', 'mrr', 'ltv', 'cac', 'lms', 'ats', 'cms',
  'hris', 'backend', 'frontend', 'fullstack', 'full-stack', 'devops', 'cloud', 'data', 'web', 'mobile', 'product',
  'remote', 'hybrid', 'startup', 'resume', 'instruction', 'important',
]);

/** Vendors whose next capitalised word completes a product name: "Google Ads", "Apache Spark". */
const VENDORS = new Set(['google', 'apache', 'github', 'microsoft', 'adobe', 'amazon', 'articulate', 'atlassian', 'oracle', 'ibm']);

/**
 * Products whose names look like ordinary capitalised words, so the shape rules below
 * cannot find them. Lower-case keys; matched against the job ad case-insensitively.
 */
const KNOWN_PRODUCTS = new Set([
  'salesforce', 'looker', 'tableau', 'mixpanel', 'amplitude', 'postman', 'selenium', 'jenkins', 'kubernetes',
  'docker', 'terraform', 'airflow', 'spark', 'snowflake', 'databricks', 'jira', 'confluence', 'figma', 'zendesk',
  'marketo', 'mailchimp', 'shopify', 'netsuite', 'quickbooks', 'workday', 'python', 'java', 'react', 'angular',
  'vue', 'django', 'flask', 'express', 'lambda', 'kafka', 'storyline', 'articulate', 'moodle', 'gong', 'google',
  'azure', 'facebook', 'instagram', 'linkedin', 'tiktok', 'hubspot', 'github', 'gitlab', 'javascript', 'typescript',
  'mongodb', 'postgresql', 'mysql', 'graphql',
]);

/** Product names that are also English words: matched case-sensitively in the rewrite. */
const CASE_SENSITIVE = new Set(['spark', 'express', 'lambda', 'java', 'react', 'vue', 'flask', 'gong', 'storyline', 'articulate']);

/** Words trimmed off the ends of a capitalised phrase: job titles are not tools. */
const TITLE_WORDS = new Set([
  'senior', 'junior', 'lead', 'principal', 'staff', 'manager', 'engineer', 'engineering', 'developer', 'analyst',
  'director', 'head', 'specialist', 'coordinator', 'associate', 'executive', 'officer', 'consultant', 'designer',
  'scientist', 'administrator', 'architect', 'representative', 'expert', 'certified', 'certification',
]);

/** English and Hebrew spellings of the same platform. The value is how Hebrew text writes it. */
const HEBREW_ALIASES: Record<string, string[]> = {
  facebook: ['פייסבוק'],
  instagram: ['אינסטגרם'],
  google: ['גוגל'],
  linkedin: ['לינקדאין', 'לינקדין'],
  tiktok: ['טיקטוק'],
  whatsapp: ['וואטסאפ', 'ווטסאפ'],
  excel: ['אקסל'],
  youtube: ['יוטיוב'],
};

/**
 * Marks a summary sentence as a goal rather than a claim ("eager to learn Gong"). A
 * goal is not policed. The same word in skills, a bullet or a certification always is.
 */
const ASPIRATION =
  /\b(?:seeking|looking|eager|aiming|aspiring|hoping|keen|excited|motivated|ready)\s+(?:to|for)\b|\binterested in\b|\bwants? to\b|\bto (?:learn|grow|deepen|expand|develop|broaden)\b|מחפש|שואף|שואפ|מעוניין|מעוניינ|ללמוד|להעמיק|להרחיב|להתפתח/i;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isTool(word: string): boolean {
  return !NOT_A_TOOL.has(word.toLowerCase());
}

function hasToolShape(word: string): boolean {
  return (
    /^[A-Z][A-Z0-9&]{1,5}$/.test(word) || // SAP, AWS, PMP, CCRN
    /[a-z][A-Z]/.test(word) || // HubSpot, GitHub, JavaScript
    /\.(?:js|NET|io)$|^\.NET$|^C\+\+$|^C#$/.test(word) // Node.js, .NET, C++
  );
}

/**
 * Named tools, platforms and credentials in a job ad, in order of appearance.
 *
 * Hebrew ad: every Latin-script name counts, because Hebrew prose is not Latin; a
 * multi-word Latin name ("Google Ads", "GitHub Actions") is kept whole.
 * English ad: a word counts when it has a tool's shape (SAP, HubSpot, Node.js) or is
 * a known product; a phrase counts only when a vendor leads it ("Apache Spark").
 * Capitalised job-title words, concept acronyms and shouted sentences never count.
 */
export function extractJobAdTerms(jobDescription: string): string[] {
  const found = new Map<string, string>();
  const add = (term: string) => {
    const t = term.trim().replace(/[.,;:)]+$/, '');
    if (t && isTool(t) && !TITLE_WORDS.has(t.toLowerCase()) && !found.has(t.toLowerCase())) found.set(t.toLowerCase(), t);
  };
  const clean = (w: string) => w.replace(/^[(]+|[.,;:)!?]+$/g, '');

  if (HEBREW.test(jobDescription)) {
    const sequences = jobDescription.match(/[A-Za-z.][A-Za-z0-9.+#&/-]*(?:[ \t]+[A-Za-z][A-Za-z0-9.+#&/-]*)*/g) ?? [];
    for (const raw of sequences) {
      const words = raw.split(/[ \t]+/).map(clean).filter(Boolean);
      const kept = words.filter((w) => isTool(w) && !TITLE_WORDS.has(w.toLowerCase()));
      if (words.length > 1 && kept.length === words.length) add(words.join(' '));
      else if (words.length === 1 && kept.length === 1) add(words[0]);
      for (const w of kept) if (words.length > 1 && hasToolShape(w)) add(w);
    }
    return [...found.values()];
  }

  for (const sentence of jobDescription.split(/(?<=[.!?:;])\s+|\n+/)) {
    const words = sentence.split(/[\s,/()]+/).map(clean).filter(Boolean);
    // Three or more all-caps words in a row is shouting, not a list of acronyms.
    const shouted = new Set<number>();
    for (let i = 0; i + 2 < words.length; i++) {
      if ([0, 1, 2].every((k) => /^[A-Z]{2,}$/.test(words[i + k]))) [0, 1, 2].forEach((k) => shouted.add(i + k));
    }
    for (let i = 1; i < words.length; i++) {
      if (shouted.has(i - 1) && /^[A-Z]{2,}$/.test(words[i])) shouted.add(i);
    }
    words.forEach((w, i) => {
      if (shouted.has(i)) return;
      const next = words[i + 1];
      if (VENDORS.has(w.toLowerCase()) && next && /^[A-Z]/.test(next) && isTool(next) && !TITLE_WORDS.has(next.toLowerCase())) {
        add(`${w} ${next}`);
        return;
      }
      const lower = w.toLowerCase();
      // A known product counts in lower case too ("3+ years with salesforce"), except the
      // ones that are also English words, which count only when capitalised.
      if (hasToolShape(w) || (KNOWN_PRODUCTS.has(lower) && (/^[A-Z]/.test(w) || !CASE_SENSITIVE.has(lower)))) add(w);
    });
  }
  return [...found.values()];
}

/**
 * Lines of a résumé that are instructions to an AI, not facts about the candidate.
 * A term named only inside one is unsupported, and is never restored.
 */
const INSTRUCTION =
  /\b(?:ignore|disregard)\b.{0,40}\b(?:previous|prior|above|earlier|all)\b.{0,20}\b(?:instructions?|rules?|prompts?)\b|\bnote to (?:any |the )?(?:ai|assistant|system|model|llm|gpt|chatgpt)\b|\b(?:ai|llm|gpt|chatgpt|language model|assistant)\b.{0,60}\b(?:state|say|write|claim|mention|list)s? that (?:the |this )?(?:candidate|applicant|resume|person)\b|התעלם|הוראה ל(?:מערכת|בינה)/i;

export function trustedResumeText(resumeText: string): string {
  return resumeText
    .split('\n')
    .filter((line) => !INSTRUCTION.test(line))
    .join('\n');
}

/** True when `text` names `term`: token-bounded for Latin, plural-tolerant, Hebrew spellings accepted. */
export function mentionsTerm(text: string, term: string): boolean {
  const lower = term.toLowerCase();
  const flags = CASE_SENSITIVE.has(lower) ? '' : 'i';
  const body = escapeRegExp(term).replace(/\s+/g, '\\s+');
  if (new RegExp(`(?<![A-Za-z0-9])${body}(?:e?s)?(?![A-Za-z0-9])`, flags).test(text)) return true;
  const firstWord = lower.split(/\s+/)[0];
  return (HEBREW_ALIASES[firstWord] ?? []).some((alias) => text.includes(alias));
}

const CONNECTORS = '(?:of|in|and|for|the|&)';

/**
 * True when `text` spells out an acronym term: "Registered Nurse" for RN, "Bachelor of
 * Science in Nursing" for BSN, "Amazon Web Services" for AWS. A résumé that writes the
 * credential out supports the abbreviation; one that never mentions it does not.
 */
export function spellsOut(text: string, term: string): boolean {
  if (!/^[A-Z]{2,6}$/.test(term)) return false;
  const words = term.split('').map((letter) => `${letter}[a-z]+`);
  const body = words.join(`\\s+(?:${CONNECTORS}\\s+)*`);
  return new RegExp(`(?<![A-Za-z])${body}(?![A-Za-z])`, 'i').test(text);
}

/** Support in the source: named directly, or spelled out as an initialism. */
function supports(source: string, term: string): boolean {
  return mentionsTerm(source, term) || spellsOut(source, term);
}

/**
 * The part of the résumé that can justify putting a tool BACK. Role header lines (any
 * line carrying a year) are excluded: "Sales Coordinator, Salesforce — 2017" says where
 * someone worked, not that they know the product, so it must never become a skill.
 */
function restorableText(originalResumeText: string): string {
  return trustedResumeText(originalResumeText)
    .split('\n')
    .filter((line) => !/(?<![0-9])(?:19|20)\d\d(?![0-9])/.test(line))
    .join('\n');
}

function isEmployerName(resume: OptimizedResume, term: string): boolean {
  return (Array.isArray(resume.experience) ? resume.experience : []).some(
    (e) => typeof e.company === 'string' && mentionsTerm(e.company, term)
  );
}

function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+|\n+/).filter((s) => s.trim().length > 0);
}

/** Every place the rewrite states something about the candidate, excluding goal sentences. */
function claimSegments(resume: OptimizedResume): string[] {
  const out: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === 'string' && v.trim()) out.push(v);
  };
  for (const s of sentences(typeof resume.summary === 'string' ? resume.summary : '')) if (!ASPIRATION.test(s)) push(s);
  for (const s of resume.skills?.technical ?? []) push(s);
  for (const s of resume.skills?.soft ?? []) push(s);
  for (const e of Array.isArray(resume.experience) ? resume.experience : []) {
    for (const a of e.achievements ?? []) push(a);
    for (const r of e.responsibilities ?? []) push(r);
  }
  for (const c of Array.isArray(resume.certifications) ? resume.certifications : []) push(c);
  for (const p of Array.isArray(resume.projects) ? resume.projects : []) {
    push(p.name);
    push(p.description);
    for (const t of p.technologies ?? []) push(t);
  }
  return out;
}

/** Everything the rewrite says, including goals, titles and names: for coverage. */
function allText(resume: OptimizedResume): string {
  const parts = [typeof resume.summary === 'string' ? resume.summary : '', ...claimSegments(resume)];
  for (const e of Array.isArray(resume.experience) ? resume.experience : []) parts.push(e.title ?? '', e.company ?? '');
  return parts.join('\n');
}

/** Job-ad terms the rewrite claims and the original résumé never mentions. */
export function findUnsupportedTerms(resume: OptimizedResume, originalResumeText: string, terms: string[]): string[] {
  const source = trustedResumeText(originalResumeText);
  const segments = claimSegments(resume);
  return terms.filter((t) => !supports(source, t) && segments.some((s) => mentionsTerm(s, t)));
}

/** Job-ad terms the original résumé mentions and the rewrite no longer does. */
export function findLostSupportedTerms(resume: OptimizedResume, originalResumeText: string, terms: string[]): string[] {
  const source = restorableText(originalResumeText);
  const text = allText(resume);
  return terms.filter((t) => supports(source, t) && !supports(text, t) && !isEmployerName(resume, t));
}

/** Cuts the term with the words that attach it, leaving the rest of the sentence. */
function cutTerm(text: string, term: string): string {
  const t = escapeRegExp(term).replace(/\s+/g, '\\s+');
  const flags = CASE_SENSITIVE.has(term.toLowerCase()) ? 'g' : 'gi';
  const tok = `(?<![A-Za-z0-9])${t}(?:e?s)?(?![A-Za-z0-9])`;
  const patterns = [
    new RegExp(`${tok}\\s*(?:,\\s*|\\s+and\\s+|\\s+or\\s+|\\s*&\\s*)`, flags), // "Salesforce and ..."
    new RegExp(`(?:,\\s*|\\s+and\\s+|\\s+or\\s+|\\s*&\\s*)${tok}`, flags), // "... and Salesforce"
    new RegExp(`,?\\s*(?:by\\s+)?(?:leveraging|using|utilizing|utilising|via|through|with)\\s+(?:the\\s+)?${tok}`, flags),
    new RegExp(`\\s+(?:in|on)\\s+${tok}(?=[\\s.,;]|$)`, flags),
    new RegExp(`\\s*(?:ו|ב|עם|באמצעות|בעזרת)[-־]?\\s?${tok}`, flags),
  ];
  let out = text;
  for (const p of patterns) out = out.replace(p, '');
  return out.replace(/\s{2,}/g, ' ').replace(/\s+([.,;])/g, '$1').replace(/,\s*\./g, '.').trim();
}

/**
 * Job-post phrases in experience bullets (2026-10-12).
 *
 * The tool guard above is deliberately narrow, so concepts pass it. An iOS capture
 * on the Maya fixture showed what passes: "Prepared monthly reports for managers."
 * became "...managers, providing actionable insights to non-technical stakeholders",
 * the job's "presenting insights to non-technical stakeholders" put in her mouth.
 * Bullets are claims about what the candidate did, so they get the free check's rule
 * (`findJobOnlyTerms`): no word the job uses and the résumé does not, except an
 * action-verb swap. Summary and skills are not policed here.
 */
function bulletsOf(role: OptimizedResume['experience'][number]): string[] {
  return [...(role.achievements ?? []), ...(role.responsibilities ?? [])];
}

/**
 * The job's title, from its first line ("Instructional Designer (fictional demo
 * role) - Lomda Labs, Haifa" -> "Instructional Designer"). A summary may name the
 * role the candidate is targeting; that is positioning, not a claim of experience.
 */
function jobTitleLine(jobDescription: string): string {
  const first = jobDescription.split('\n').find((l) => l.trim()) ?? '';
  return first.replace(/\(.*?\)/g, ' ').split(/\s[-\u2013\u2014|]\s|,/)[0].trim();
}

/**
 * Nouns a summary uses to frame the bullets below it ("a record of beating
 * quota" over "Reached 118% of annual quota"). They borrow the job's framing, not
 * a fact; the facts they frame are checked in the bullets.
 */
const SUMMARY_FRAMING = new Set(['record', 'background', 'expertise']);

function groundingFor(originalResumeText: string, jobDescription: string) {
  return { resumeText: trustedResumeText(originalResumeText), jobText: jobDescription, jobTitle: jobTitleLine(jobDescription) };
}

/** Job-only words in one claim; detection and the fallback both use this, so they agree. */
function jobOnlyIn(text: string, ctx: ReturnType<typeof groundingFor>, isSummary = false): string[] {
  return findJobOnlyTerms(text, ctx, isSummary).filter((t) => !(isSummary && SUMMARY_FRAMING.has(t)));
}

/**
 * Job-only words in each claim of the rewrite: experience bullets, project
 * descriptions and summary sentences (goal sentences excepted). Moving the
 * phrase out of a bullet must not be a way around the guard.
 */
export function findJobOnlyBulletTerms(
  resume: OptimizedResume,
  originalResumeText: string,
  jobDescription: string
): Array<{ bullet: string; terms: string[] }> {
  const ctx = groundingFor(originalResumeText, jobDescription);
  const out: Array<{ bullet: string; terms: string[] }> = [];
  const check = (text: unknown, isSummary = false) => {
    if (typeof text !== 'string' || !text.trim()) return;
    const terms = jobOnlyIn(text, ctx, isSummary);
    if (terms.length > 0) out.push({ bullet: text, terms });
  };
  for (const role of Array.isArray(resume.experience) ? resume.experience : []) bulletsOf(role).forEach((b) => check(b));
  for (const p of Array.isArray(resume.projects) ? resume.projects : []) check(p.description);
  for (const sentence of sentences(typeof resume.summary === 'string' ? resume.summary : '')) {
    if (!ASPIRATION.test(sentence)) check(sentence, true);
  }
  return out;
}

const CLAUSE_BREAK = /(?:,|;|\s[-\u2013\u2014])\s+/;

/**
 * A résumé line that can stand in for a bullet: a sentence, not a role header,
 * contact line, title or skills list. Without this, an invented bullet came
 * back as "Data Analyst" or "Excel, Google Sheets, Communication, Teamwork".
 */
/**
 * A role or education header: a date range ("2021 – Present", "Apr 2021 to
 * Present", "2018 – 2021"). A bullet that mentions one year ("in 2024") is not.
 */
const DATE_RANGE =
  /(?<![0-9])(?:19|20)\d\d\s*(?:[-\u2013\u2014]|to)\s*(?:(?:[A-Za-z]{3,9}\s+)?(?:19|20)\d\d(?![0-9])|present|current|now|today|היום|כיום)/i;

function isSourceSentence(line: string): boolean {
  if (line.split(/\s+/).length < 4) return false;
  if (DATE_RANGE.test(line)) return false;
  if (/@|·|\|/.test(line)) return false;
  const items = line.split(',');
  return !(items.length >= 3 && items.every((item) => item.trim().split(/\s+/).length <= 3));
}

/**
 * The résumé lines under one role: from its header (the line naming its company,
 * or its title) to the next role header or section heading. Restoring a line from
 * anywhere else would credit one employer with another's work (Codex review of
 * #169). Empty when the role cannot be located, so nothing is restored.
 */
function roleSourceLines(originalResumeText: string, role: { company?: string; title?: string }): string[] {
  const lines = trustedResumeText(originalResumeText).split('\n');
  const name = (role.company || role.title || '').trim().toLowerCase();
  if (name.length < 2) return [];
  const header = lines.findIndex((l) => l.toLowerCase().includes(name));
  if (header === -1) return [];
  const out: string[] = [];
  for (const line of lines.slice(header + 1)) {
    const isRoleHeader = !/^\s*[•\-*]/.test(line) && DATE_RANGE.test(line);
    const isSection = /^\s*(?:education|skills|certifications?|projects|summary|languages|השכלה|כישורים|פרויקטים|תעודות)\b/i.test(line);
    if (isRoleHeader || isSection) break;
    out.push(line);
  }
  return out;
}

/** The candidate's own line under this role closest to a bullet, by shared words. Null when none is close. */
function closestSourceLine(bullet: string, sourceLines: string[]): string | null {
  const wordsOf = (t: string) => new Set(t.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 4));
  const target = wordsOf(bullet);
  let best: { line: string; score: number } | null = null;
  for (const raw of sourceLines) {
    const line = raw.replace(/^\s*[•\-*]\s*/, '').trim();
    if (!isSourceSentence(line)) continue;
    const ws = wordsOf(line);
    const shared = [...ws].filter((w) => target.has(w)).length;
    const score = ws.size === 0 ? 0 : shared / ws.size;
    if (!best || score > best.score) best = { line, score };
  }
  return best && best.score >= 0.5 ? best.line : null;
}

/**
 * Deterministic fallback for a bullet that still carries job-only words after the
 * repair. Cut the clauses that carry them ("..., providing insights to non-technical
 * stakeholders"); if the main clause carries them, put back the candidate's own line.
 * Never deletes a bullet, so a role can never be emptied. Returns null when neither
 * works, and the bullet is reported as unresolved.
 */
/**
 * A line rebuilt from its clauses, keeping only `keep` (in their original
 * order). The review page uses the same rule to put confirmed clauses back.
 */
export function joinClauses(clauses: string[], keep: number[]): string {
  const joined = [...new Set(keep)]
    .sort((a, b) => a - b)
    .map((i) => clauses[i])
    .join(', ')
    .replace(/[\s,;.]+$/, '');
  return `${joined}.`;
}

interface ClauseCut {
  kept: string;
  clauses: string[];
  keptIdx: number[];
  /** Each held clause on its own, so the user can confirm one and not another. */
  held: Array<{ clause: number; terms: string[] }>;
}

function cutClauses(text: string, ctx: ReturnType<typeof groundingFor>, isSummary = false): ClauseCut | null {
  const clauses = text.split(CLAUSE_BREAK);
  if (jobOnlyIn(clauses[0], ctx, isSummary).length > 0) return null;
  const keptIdx: number[] = [];
  const held: ClauseCut['held'] = [];
  clauses.forEach((c, i) => {
    const terms = jobOnlyIn(c, ctx, isSummary);
    if (terms.length === 0) keptIdx.push(i);
    else held.push({ clause: i, terms });
  });
  const kept = joinClauses(clauses, keptIdx);
  return kept.length >= 13 ? { kept, clauses, keptIdx, held } : null;
}

type BulletFix = { cut: ClauseCut } | { source: string } | null;

function cleanBullet(
  bullet: string,
  originalResumeText: string,
  jobDescription: string,
  role: { company?: string; title?: string }
): BulletFix {
  const ctx = groundingFor(originalResumeText, jobDescription);
  const cut = cutClauses(bullet, ctx);
  if (cut !== null) return { cut };
  const source = closestSourceLine(bullet, roleSourceLines(originalResumeText, role));
  return source && jobOnlyIn(source, ctx).length === 0 ? { source } : null;
}

/**
 * A job-post phrase held back from the rewrite, kept so the user can confirm it
 * ("Add only if true") and get its score back. Held, not deleted, since
 * 2026-10-12: the founder's call, because a silent cut lowered scores for people
 * who really did the thing.
 */
export interface HeldPhrase {
  section: 'experience' | 'summary' | 'projects';
  /** Role index (experience) or project index (projects); 0 for the summary. */
  index: number;
  /** Text now in the résumé in its place, or null when the whole item was held back. */
  kept: string | null;
  /** What the optimizer wrote. Restored as-is when the user confirms. */
  proposed: string;
  /** For a held-back whole item: the text it followed, so it goes back in place. Null = first. */
  after: string | null;
  /** The job-post words it uses that the résumé does not. */
  terms: string[];
  /** When one clause of a line is held: the line's clauses as written, which are kept, and this one. */
  clauses?: string[];
  keptClauses?: number[];
  clause?: number;
}

/** One hold per held clause: each is its own "Add only if true" item. */
function clauseHolds(section: HeldPhrase['section'], index: number, cut: ClauseCut): HeldPhrase[] {
  return cut.held.map(({ clause, terms }) => ({
    section,
    index,
    kept: cut.kept,
    proposed: joinClauses(cut.clauses, [...cut.keptIdx, clause]),
    after: null,
    terms,
    clauses: cut.clauses,
    keptClauses: cut.keptIdx,
    clause,
  }));
}

export function removeJobOnlyPhrases(
  resume: OptimizedResume,
  originalResumeText: string,
  jobDescription: string
): { resume: OptimizedResume; cleaned: number; unresolved: string[]; held: HeldPhrase[] } {
  const flagged = new Map(findJobOnlyBulletTerms(resume, originalResumeText, jobDescription).map((f) => [f.bullet, f.terms]));
  if (flagged.size === 0) return { resume, cleaned: 0, unresolved: [], held: [] };
  let cleaned = 0;
  const unresolved = new Set<string>();
  const held: HeldPhrase[] = [];

  const experience = (Array.isArray(resume.experience) ? resume.experience : []).map((role, roleIndex) => {
    // A bullet with no clean clause and no source line is the job post, not the
    // candidate: it is held back whole, unless it is all the role has (WP-64:
    // never empty a role).
    const fix = (bullets: string[] | undefined, othersInRole: number) => {
      if (!bullets) return bullets;
      const out: string[] = [];
      for (const [i, b] of bullets.entries()) {
        const terms = flagged.get(b);
        if (!terms) {
          out.push(b);
          continue;
        }
        const next = cleanBullet(b, originalResumeText, jobDescription, role);
        if (next !== null && 'cut' in next) {
          out.push(next.cut.kept);
          cleaned++;
          held.push(...clauseHolds('experience', roleIndex, next.cut));
        } else if (next !== null) {
          out.push(next.source);
          cleaned++;
          held.push({ section: 'experience', index: roleIndex, kept: next.source, proposed: b, after: null, terms });
        } else if (othersInRole + out.length + (bullets.length - i - 1) > 0) {
          cleaned++;
          held.push({ section: 'experience', index: roleIndex, kept: null, proposed: b, after: out[out.length - 1] ?? null, terms });
        } else {
          terms.forEach((t) => unresolved.add(t));
          out.push(b);
        }
      }
      return out;
    };
    const achievements = fix(role.achievements, role.responsibilities?.length ?? 0) ?? role.achievements;
    return {
      ...role,
      achievements,
      ...(role.responsibilities ? { responsibilities: fix(role.responsibilities, achievements?.length ?? 0) } : {}),
    };
  });
  // Summary: cut the clause; a sentence that is the job post is held back whole,
  // unless it is the whole summary. Projects: cut the clause or report it.
  const ctx = groundingFor(originalResumeText, jobDescription);
  const summaryParts = sentences(typeof resume.summary === 'string' ? resume.summary : '');
  const summary: string[] = [];
  summaryParts.forEach((sentence, i) => {
    const terms = flagged.get(sentence);
    if (!terms || ASPIRATION.test(sentence)) return summary.push(sentence);
    const cut = cutClauses(sentence, ctx, true);
    if (cut !== null) {
      cleaned++;
      held.push(...clauseHolds('summary', 0, cut));
      return summary.push(cut.kept);
    }
    if (summary.length + (summaryParts.length - i - 1) > 0) {
      cleaned++;
      held.push({ section: 'summary', index: 0, kept: null, proposed: sentence, after: summary[summary.length - 1] ?? null, terms });
      return;
    }
    terms.forEach((t) => unresolved.add(t));
    summary.push(sentence);
  });
  const projects = resume.projects?.map((p, projectIndex) => {
    const terms = typeof p.description === 'string' ? flagged.get(p.description) : undefined;
    if (!terms) return p;
    const cut = cutClauses(p.description as string, ctx);
    if (cut === null) {
      terms.forEach((t) => unresolved.add(t));
      return p;
    }
    cleaned++;
    held.push(...clauseHolds('projects', projectIndex, cut));
    return { ...p, description: cut.kept };
  });

  return {
    resume: {
      ...resume,
      experience,
      ...(typeof resume.summary === 'string' ? { summary: summary.join(' ') } : {}),
      ...(resume.projects ? { projects } : {}),
    },
    cleaned,
    unresolved: [...unresolved],
    held,
  };
}

export interface RemovalResult {
  resume: OptimizedResume;
  removed: string[];
  unresolved: string[];
}

/**
 * Last-resort fallback after one repair attempt: take the claim out without inventing
 * anything in its place. Skills and certifications lose the item. A bullet or summary
 * sentence loses the phrase that attaches the tool; if the tool is the whole point of
 * the bullet, the bullet goes, but never the last bullet of a role (WP-64: a role with
 * no bullets deletes the candidate's evidence). What cannot be removed is reported.
 */
export function removeUnsupportedTerms(resume: OptimizedResume, terms: string[]): RemovalResult {
  const unresolved = new Set<string>();
  const hit = (s: string) => terms.filter((t) => mentionsTerm(s, t));
  const keepItem = (s: string) => hit(s).length === 0;

  const summaryParts = sentences(typeof resume.summary === 'string' ? resume.summary : '');
  const cleanedSummary: string[] = [];
  summaryParts.forEach((sentence) => {
    if (ASPIRATION.test(sentence) || hit(sentence).length === 0) return cleanedSummary.push(sentence);
    const cut = hit(sentence).reduce(cutTerm, sentence);
    if (hit(cut).length === 0) return cleanedSummary.push(cut);
    if (summaryParts.length > 1) return; // drop the sentence
    hit(cut).forEach((t) => unresolved.add(t));
    cleanedSummary.push(sentence);
  });

  const experience = (Array.isArray(resume.experience) ? resume.experience : []).map((role) => {
    const bullets = role.achievements ?? [];
    const next: string[] = [];
    const dropped: string[] = [];
    for (const b of bullets) {
      if (hit(b).length === 0) {
        next.push(b);
        continue;
      }
      const cut = hit(b).reduce(cutTerm, b);
      if (hit(cut).length === 0 && cut.length >= 12) next.push(cut);
      else dropped.push(b);
    }
    if (next.length === 0 && dropped.length > 0) {
      // Never empty a role: keep its bullets and report the claim instead.
      dropped.forEach((b) => hit(b).forEach((t) => unresolved.add(t)));
      return { ...role, achievements: bullets };
    }
    return { ...role, achievements: next };
  });

  const out: OptimizedResume = {
    ...resume,
    summary: cleanedSummary.join(' '),
    skills: {
      technical: (resume.skills?.technical ?? []).filter(keepItem),
      soft: (resume.skills?.soft ?? []).filter(keepItem),
    },
    experience,
    certifications: (resume.certifications ?? []).filter(keepItem),
    projects: resume.projects?.map((p) => ({
      ...p,
      description: hit(p.description ?? '').reduce(cutTerm, p.description ?? ''),
      technologies: (p.technologies ?? []).filter(keepItem),
    })),
  };
  const before = new Set(terms.filter((t) => claimSegments(resume).some((s) => mentionsTerm(s, t))));
  const after = new Set(terms.filter((t) => claimSegments(out).some((s) => mentionsTerm(s, t))));
  after.forEach((t) => unresolved.add(t));
  return { resume: out, removed: [...before].filter((t) => !after.has(t)), unresolved: [...unresolved] };
}

/** Section-level fallback for coverage loss: the supported tool goes back into skills. */
export function restoreSupportedTerms(resume: OptimizedResume, terms: string[]): OptimizedResume {
  const technical = [...(resume.skills?.technical ?? [])];
  for (const t of terms) if (!technical.some((s) => mentionsTerm(s, t))) technical.push(t);
  return { ...resume, skills: { technical, soft: resume.skills?.soft ?? [] } };
}

export type TruthGuardRetryReason = 'unsupported_job_ad_terms' | 'lost_supported_terms' | 'both';

export interface TruthGuardReport {
  checkedTerms: number;
  unsupportedBefore: string[];
  lostBefore: string[];
  retried: boolean;
  retryReason: TruthGuardRetryReason | null;
  repairAccepted: boolean;
  /** Tools the repair added that neither the rewrite nor the résumé had. Any one rejects the repair. */
  repairIntroducedTerms: string[];
  removedTerms: string[];
  restoredTerms: string[];
  unresolvedTerms: string[];
  /** Job-only words found in the rewrite's claims (only when phrases are held). */
  jobPhrasesBefore: string[];
  /** Claims held back for the user to confirm: cut, reverted to the candidate's own line, or held whole. */
  jobPhraseBulletsCleaned: number;
  /** Job-only words still in the rewrite because holding them back would empty a role or the summary. */
  jobPhrasesUnresolved: string[];
}

export type TruthRepair = (
  candidate: OptimizedResume,
  issues: { unsupported: string[]; lost: string[] }
) => Promise<OptimizedResume | null>;

/** Mirrors the WP-64 pass-2 rule: a repair may consolidate, not delete a third of the evidence. */
function keepsContent(repaired: OptimizedResume, original: OptimizedResume): boolean {
  const roles = Array.isArray(repaired.experience) ? repaired.experience : [];
  if (roles.length > 0 && countBullets(repaired) === 0) return false;
  const before = countBullets(original);
  return before === 0 || countBullets(repaired) >= Math.ceil(before * (2 / 3));
}

/**
 * One bounded repair, then a deterministic fallback, never more. Keeps the best
 * candidate it has seen and reports what it did, without any résumé text.
 */
export async function enforceJobAdTruth(
  candidate: OptimizedResume,
  input: {
    resumeText: string;
    jobDescription: string;
    repair: TruthRepair;
    /**
     * Hold job-post phrases back for the user to confirm. Off unless the client
     * can show "Add only if true"; installed iOS builds cannot yet, and get the
     * tools-only guard they had before.
     */
    holdJobPhrases?: boolean;
  }
): Promise<{ resume: OptimizedResume; report: TruthGuardReport; changed: boolean; held: HeldPhrase[] }> {
  const terms = extractJobAdTerms(input.jobDescription);
  const unsupported = findUnsupportedTerms(candidate, input.resumeText, terms);
  const lost = findLostSupportedTerms(candidate, input.resumeText, terms);
  const report: TruthGuardReport = {
    checkedTerms: terms.length,
    unsupportedBefore: unsupported,
    lostBefore: lost,
    retried: false,
    retryReason: null,
    repairAccepted: false,
    repairIntroducedTerms: [],
    removedTerms: [],
    restoredTerms: [],
    unresolvedTerms: [],
    jobPhrasesBefore: [],
    jobPhraseBulletsCleaned: 0,
    jobPhrasesUnresolved: [],
  };

  let best = candidate;
  if (unsupported.length > 0 || lost.length > 0) {
    report.retried = true;
    report.retryReason = unsupported.length && lost.length ? 'both' : unsupported.length ? 'unsupported_job_ad_terms' : 'lost_supported_terms';

    let repaired: OptimizedResume | null = null;
    try {
      repaired = await input.repair(candidate, { unsupported, lost });
    } catch {
      repaired = null;
    }
    if (repaired) {
      // The repair was asked to remove a tool; it must not invent a different one. Any tool
      // in the repair that neither the rewrite nor the résumé had rejects it outright.
      const before = claimSegments(candidate).join('\n');
      const source = trustedResumeText(input.resumeText);
      report.repairIntroducedTerms = extractJobAdTerms(claimSegments(repaired).join('\n')).filter(
        (t) => !mentionsTerm(before, t) && !supports(source, t)
      );
    }
    if (repaired && keepsContent(repaired, candidate) && report.repairIntroducedTerms.length === 0) {
      const u = findUnsupportedTerms(repaired, input.resumeText, terms);
      const l = findLostSupportedTerms(repaired, input.resumeText, terms);
      if (u.length <= unsupported.length && l.length <= lost.length && u.length + l.length < unsupported.length + lost.length) {
        best = repaired;
        report.repairAccepted = true;
      }
    }

    const stillUnsupported = findUnsupportedTerms(best, input.resumeText, terms);
    if (stillUnsupported.length > 0) {
      const removal = removeUnsupportedTerms(best, stillUnsupported);
      best = removal.resume;
      report.removedTerms = removal.removed;
      report.unresolvedTerms = removal.unresolved;
    }
    const stillLost = findLostSupportedTerms(best, input.resumeText, terms);
    if (stillLost.length > 0) {
      best = restoreSupportedTerms(best, stillLost);
      report.restoredTerms = stillLost;
    }
  }

  // Phrases last, on the final text, so each record points at what the user will
  // see. Deterministic: no repair call, so nothing the user could confirm is lost.
  let held: HeldPhrase[] = [];
  // Hebrew pairs are guarded too: `findJobOnlyTerms` strips proclitics and knows
  // Hebrew verb swaps (2026-10-12; skipped before, Codex review of #169).
  if (input.holdJobPhrases) {
    report.jobPhrasesBefore = [
      ...new Set(findJobOnlyBulletTerms(best, input.resumeText, input.jobDescription).flatMap((f) => f.terms)),
    ];
    const phrases = removeJobOnlyPhrases(best, input.resumeText, input.jobDescription);
    if (phrases.cleaned > 0) best = phrases.resume;
    report.jobPhraseBulletsCleaned = phrases.cleaned;
    report.jobPhrasesUnresolved = phrases.unresolved;
    held = phrases.held;
    // Holding a whole bullet can take out the only mention of a tool the résumé
    // really has; it goes back into skills, as in the tools guard above.
    const lostAfterHold = findLostSupportedTerms(best, input.resumeText, terms);
    if (lostAfterHold.length > 0) {
      best = restoreSupportedTerms(best, lostAfterHold);
      report.restoredTerms = [...new Set([...report.restoredTerms, ...lostAfterHold])];
    }
  }
  return { resume: best, report, changed: best !== candidate, held };
}

export interface WireTruthGuard {
  /** The guard ran on this result. */
  checked: boolean;
  /** A repair call's output was accepted. */
  repaired: boolean;
  /** Job-ad tools taken out because the résumé never mentions them. */
  removedTerms: string[];
  /** Supported tools put back into skills after the rewrite dropped them. */
  restoredTerms: string[];
  /** Unsupported tools still in the rewrite because removing them would empty a role. */
  unresolvedTerms: string[];
}

/**
 * The additive `truthGuard` field on the /api/optimize response. Installed iOS builds
 * decode with Codable, which ignores unknown keys, so this cannot break them.
 */
export function toWireTruthGuard(report: TruthGuardReport | undefined): WireTruthGuard | null {
  if (!report) return null;
  return {
    checked: true,
    repaired: report.repairAccepted,
    removedTerms: report.removedTerms,
    restoredTerms: report.restoredTerms,
    unresolvedTerms: report.unresolvedTerms,
  };
}
