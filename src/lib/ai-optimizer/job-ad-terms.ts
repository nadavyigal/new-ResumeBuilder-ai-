import type { OptimizedResume } from './index';
import { countBullets } from './normalize-experience';

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
  'azure', 'facebook', 'instagram', 'linkedin', 'tiktok',
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
      if (hasToolShape(w) || (KNOWN_PRODUCTS.has(w.toLowerCase()) && /^[A-Z]/.test(w))) add(w);
    });
  }
  return [...found.values()];
}

/**
 * Lines of a résumé that are instructions to an AI, not facts about the candidate.
 * A term named only inside one is unsupported, and is never restored.
 */
const INSTRUCTION =
  /\b(?:ignore|disregard)\b.{0,40}\b(?:previous|prior|above|earlier|all)\b.{0,20}\b(?:instructions?|rules?|prompts?)\b|\bnote to (?:any |the )?(?:ai|assistant|system|model|llm|gpt|chatgpt)\b|\b(?:ai|llm|gpt|chatgpt|language model|assistant)\b.{0,60}\b(?:state that|say that|write that|claim that|must (?:say|state|list|add))\b|התעלם|הוראה ל(?:מערכת|בינה)/i;

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
  return terms.filter((t) => !mentionsTerm(source, t) && segments.some((s) => mentionsTerm(s, t)));
}

/** Job-ad terms the original résumé mentions and the rewrite no longer does. */
export function findLostSupportedTerms(resume: OptimizedResume, originalResumeText: string, terms: string[]): string[] {
  const source = trustedResumeText(originalResumeText);
  const text = allText(resume);
  return terms.filter((t) => mentionsTerm(source, t) && !mentionsTerm(text, t));
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
  removedTerms: string[];
  restoredTerms: string[];
  unresolvedTerms: string[];
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
  input: { resumeText: string; jobDescription: string; repair: TruthRepair }
): Promise<{ resume: OptimizedResume; report: TruthGuardReport; changed: boolean }> {
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
    removedTerms: [],
    restoredTerms: [],
    unresolvedTerms: [],
  };
  if (unsupported.length === 0 && lost.length === 0) return { resume: candidate, report, changed: false };

  report.retried = true;
  report.retryReason = unsupported.length && lost.length ? 'both' : unsupported.length ? 'unsupported_job_ad_terms' : 'lost_supported_terms';

  let best = candidate;
  let repaired: OptimizedResume | null = null;
  try {
    repaired = await input.repair(candidate, { unsupported, lost });
  } catch {
    repaired = null;
  }
  if (repaired && keepsContent(repaired, candidate)) {
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
  return { resume: best, report, changed: best !== candidate };
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
