/**
 * Company names in a job ad
 *
 * A job ad names its employer all through its duties ("Drive revenue growth for
 * Appstock", "Represent Appstock at industry events"). The keyword extractors
 * cannot tell a proper noun from a product, so the employer became a must-have
 * skill: on 2026-10-15 a real optimization for "Business Development Manager -
 * Ad tech at Appstock" told the candidate "Skills/Tools: appstock". No résumé
 * holds the hiring company's name as a skill, so it was also a gap the
 * candidate could never close in the keyword score.
 *
 * `detectCompanyNames` reads the employer from the fields and phrasings job ads
 * use for it; `removeCompanyTerms` takes it out of requirement terms. A company
 * that shares its name with a product it asks for (Salesforce hiring for
 * "Salesforce administration") keeps that term: the ad uses the name as a
 * product there, and a résumé can hold it.
 */

import { normalizeText } from '../utils/text-utils';

/**
 * One capitalised name of up to four capitalised words: "Appstock", "Kesher
 * Commerce", "Monday.com". A lowercase connector may sit between two of them:
 * "Bank of America", "Procter and Gamble".
 */
const NAME =
  "[A-Z0-9][\\w&'.\\-]*(?:[ \\t]+(?:(?:of|and|for|the|de|la|du|von|van|der|&)[ \\t]+)?[A-Z0-9][\\w&'.\\-]*){0,3}";

// "Kesher Commerce is looking for a Data Analyst to join ...". The role ends at
// the first preposition, relative word or punctuation: "a Data Analyst to join",
// "a Senior Product Designer who loves", "an Account Executive for the EMEA region".
const HIRING_SENTENCE =
  /(?:^|[.!?]\s+)([A-Z][\w&'.-]*(?:\s+[A-Z][\w&'.-]*){0,3})\s+(?:is|are)\s+(?:looking for|hiring|seeking)\s+(?:a|an)\s+([A-Z][^\n.,;:!?]*?)(?=\s+(?:to|who|that|for|in|at|on|with|and|based)\b|[\n.,;:!?]|$)/m;

/** "Business Development Manager - Ad tech at Appstock", only as a heading line. */
const TITLE_AT_COMPANY = new RegExp(`\\s(?:at|@)\\s+(${NAME})\\s*$`);
/** "About Appstock" as a heading line. */
const ABOUT_HEADING = new RegExp(`^[ \\t]*About[ \\t]+(${NAME})[ \\t]*:?[ \\t]*$`, 'gm');
/** "Company: Fiverr" / "Company name: Fiverr". */
const COMPANY_LABEL = /^[ \t]*Company(?:[ \t]+name)?[ \t]*:[ \t]*([^\n]{2,60}?)[ \t]*$/gim;
/** "At Wix, we build ..." */
const AT_COMPANY_WE = new RegExp(`(?:^|[.!?]\\s+)At[ \\t]+(${NAME}),[ \\t]+(?:we|our)\\b`, 'gm');

/** Capitalised openers that are not company names ("About Us", "The Company is hiring"). */
const NON_COMPANY_WORDS = new Set([
  'the', 'our', 'this', 'your', 'we', 'it', 'company', 'team', 'us', 'you', 'me', 'a', 'an',
  'role', 'job', 'position',
]);

/** Placeholder company fields that hold no name ("Company name", "Confidential"). */
const PLACEHOLDER_WORDS = new Set([...NON_COMPANY_WORDS, 'name', 'confidential', 'unknown', 'n/a', 'na', 'stealth']);

/**
 * Departments and sections that follow "About" but name no employer ("About
 * Engineering", "About Design").
 */
const FUNCTIONAL_HEADINGS = new Set([
  'engineering', 'product', 'design', 'sales', 'marketing', 'data', 'finance', 'operations', 'people', 'hr',
  'research', 'security', 'support', 'success', 'customer', 'legal', 'growth', 'analytics', 'infrastructure',
  'platform', 'brand', 'content', 'partnerships', 'benefits', 'perks', 'culture', 'compensation', 'requirements',
  'responsibilities', 'qualifications', 'location', 'office', 'hiring', 'process', 'interview', 'diversity',
  'inclusion', 'mission', 'values', 'opportunity', 'department', 'group', 'unit', 'division',
]);

const LEGAL_SUFFIX = /[\s,]+(?:inc|ltd|llc|plc|gmbh|corp|corporation|co|limited|group)\.?$/i;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** An inferred name: refused when it opens with a generic word ("The Company", "Our team"). */
function isCompanyName(name: string): boolean {
  const first = name.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  return name.trim().length >= 2 && !NON_COMPANY_WORDS.has(first);
}

/**
 * A company field's value: trusted even when it opens with an article ("The
 * Trade Desk", "A Place for Mom"), refused only when every word is generic.
 */
function isKnownCompanyName(name: string): boolean {
  const words = name.trim().toLowerCase().split(/\s+/);
  return name.trim().length >= 2 && !words.every((word) => PLACEHOLDER_WORDS.has(word));
}

/**
 * Whether an "About <Name>" heading names the employer: never a department,
 * and never a word the ad also writes in lowercase, as a skill ("Software
 * engineering"). A domain ("fiverr.com") is not such a use.
 */
function isEmployerHeading(name: string, text: string): boolean {
  if (name.toLowerCase().split(/\s+/).some((word) => FUNCTIONAL_HEADINGS.has(word))) return false;
  const lowercaseUse = new RegExp(
    `(?<![\\p{L}\\p{N}])${escapeRegExp(name.toLowerCase())}(?![\\p{L}\\p{N}]|\\.[a-z])`,
    'u',
  );
  return !lowercaseUse.test(text);
}

/**
 * Title and company from a pasted post's "<Company> is looking for a <Title>"
 * sentence, for LABELLING the saved job only.
 *
 * Deliberately not wired into `extractJobData`: a non-empty job title makes
 * title_alignment compare against the resume's titles, and when those cannot be
 * parsed from flattened PDF text the analyzer returns 20 instead of its neutral
 * 50. On the 2026-10-12 Maya fixture that cost a real Data Analyst 4 points.
 * Changing the score is its own story; this only stops the saved job reading
 * "Job Position" / "Company Name" in the iOS preview header.
 */
export function extractHiringSentence(text: string): { title: string; company: string } {
  const match = text.match(HIRING_SENTENCE);
  if (!match) return { title: '', company: '' };
  const subject = match[1].trim();
  const generic = NON_COMPANY_WORDS.has(subject.split(/\s+/)[0].toLowerCase());
  return { title: match[2].trim(), company: generic ? '' : subject };
}

/**
 * The employer's name as a job ad gives it: from known fields (`known`), the
 * "<Title> at <Company>" heading on the first line, "<Company> is looking for",
 * a "Company:" label, "At <Company>, we", or, when none of those names one, an
 * "About <Company>" heading.
 * A mid-sentence "at" is never read, so "work at scale" names no company.
 */
export function detectCompanyNames(text: string, known: Array<string | null | undefined> = []): string[] {
  const found: string[] = [];
  const add = (name: string | null | undefined) => {
    // The hiring sentence's subject may run across a line break ("About You\nThe
    // Company is looking for"); only the line right before the verb names anyone.
    const lastLine = (name || '').split('\n').pop() ?? '';
    const trimmed = lastLine.trim().replace(/[.,;:]+$/, '');
    if (trimmed && isCompanyName(trimmed)) found.push(trimmed);
  };

  for (const name of known) {
    const trimmed = (name || '').trim();
    if (trimmed && isKnownCompanyName(trimmed)) found.push(trimmed);
  }

  const firstLine = text.split('\n').find((line) => line.trim().length > 0)?.trim() ?? '';
  if (firstLine && firstLine.split(/\s+/).length <= 12 && !/[.!?]$/.test(firstLine)) {
    add(firstLine.match(TITLE_AT_COMPANY)?.[1]);
  }

  add(extractHiringSentence(text).company);
  for (const match of text.matchAll(COMPANY_LABEL)) add(match[1]);
  for (const match of text.matchAll(AT_COMPANY_WE)) add(match[1]);

  // Ads also title their sections "About <Name>" ("About Engineering"), so this
  // is the weakest evidence: read only when nothing above names the employer.
  if (found.length === 0) {
    for (const match of text.matchAll(ABOUT_HEADING)) {
      if (isEmployerHeading(match[1], text)) add(match[1]);
    }
  }

  const seen = new Set<string>();
  return found.filter((name) => {
    const key = name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * A company's names as word lists: in full, without a legal suffix, and
 * without a leading article ("The Trade Desk" is written "Trade Desk" in its
 * duties). A one-word remainder ("The Hub" -> "Hub") is too common to remove.
 */
function companyForms(company: string): string[][] {
  const full = company.trim();
  const noSuffix = full.replace(LEGAL_SUFFIX, '');
  const noArticle = noSuffix.replace(/^(?:the|a|an)\s+/i, '');
  const forms = [full, noSuffix];
  if (noArticle !== noSuffix && noArticle.split(/\s+/).length >= 2) forms.push(noArticle);

  const seen = new Set<string>();
  return forms
    .map((form) => normalizeText(form).split(' ').filter(Boolean))
    .filter((words) => {
      const key = words.join(' ');
      if (words.join('').length < 2 || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** The words of a name, separated by anything that is not a letter or digit (Hebrew included). */
const namePattern = (words: string[]) => words.map(escapeRegExp).join('[^\\p{L}\\p{N}]+');

/** Matchers for one company, plus a possessive ("Appstock's", or "appstock s" once punctuation is gone). */
function companyPatterns(company: string): RegExp[] {
  return companyForms(company).map(
    (words) => new RegExp(`(?<![\\p{L}\\p{N}])${namePattern(words)}(?:['’]s|\\s+s)?(?![\\p{L}\\p{N}])`, 'giu'),
  );
}

/** Words right before a name that make it a tool the candidate uses: "experience with Salesforce". */
const PRODUCT_USE_BEFORE =
  '(?:experience|proficiency|proficient|expertise|expert|knowledge|familiarity|familiar|skilled|skills|hands[ -]on|certified|certification|background|fluency|fluent|using|use|administer|administering|configure|configuring)(?:[ \\t]+(?:with|in|of|on|using))?(?:[ \\t]+the)?';
/** Words right after a name that make it a product: "Salesforce administration", "HubSpot CRM". */
const PRODUCT_USE_AFTER =
  '(?:administration|admin|administrator|certification|certified|development|developer|platform|api|apis|crm|cloud|cpq|integration|integrations|configuration|experience|proficiency|skills|ecosystem|sdk|apex|reports|reporting|dashboards|implementation|suite|stack)';

/**
 * Whether the ad asks for the company's name as a product ("Salesforce
 * administration", "experience with Salesforce"). Then the name is a skill a
 * résumé can hold. A possessive ("Appstock's network") is the employer.
 */
function isUsedAsProduct(company: string, sources: string[]): boolean {
  const text = sources.join('\n');
  return companyForms(company).some((words) => {
    const name = namePattern(words);
    const before = new RegExp(`(?<![\\p{L}\\p{N}])${PRODUCT_USE_BEFORE}[ \\t]+${name}(?![\\p{L}\\p{N}'’])`, 'iu');
    const after = new RegExp(`(?<![\\p{L}\\p{N}])${name}[ \\t]+${PRODUCT_USE_AFTER}(?![\\p{L}\\p{N}])`, 'iu');
    return before.test(text) || after.test(text);
  });
}

/**
 * Requirement terms with the company's name taken out. A term that was only the
 * name is dropped; the rest of a phrase the name sat in is kept, so "Represent
 * Appstock at industry events" still yields "industry events" once atomized.
 * A multi-word company is matched as a whole: "Kesher Commerce" never removes
 * "commerce" from "e commerce platforms".
 *
 * A company the ad also asks for as a product, in `terms` or in `contextText`
 * (the ad itself), is left in every term: "Salesforce administration" is a
 * requirement at Salesforce too.
 */
export function removeCompanyTerms(terms: string[], companies: string[], contextText = ''): string[] {
  const patterns = companies
    .filter((company) => !isUsedAsProduct(company, [...terms, contextText]))
    .flatMap(companyPatterns);
  if (patterns.length === 0) return terms;

  return terms
    .map((term) => {
      let out = term;
      for (const pattern of patterns) out = out.replace(pattern, ' ');
      return out === term ? term : out.replace(/\s+/g, ' ').trim();
    })
    .filter((term) => /[\p{L}\p{N}]/u.test(term));
}
