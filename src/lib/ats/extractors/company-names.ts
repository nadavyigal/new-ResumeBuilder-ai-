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
 * Salesforce experience) loses that term too; the candidate is told the
 * company's name either way.
 */

import { normalizeText } from '../utils/text-utils';

/** One capitalised name of up to four words: "Appstock", "Kesher Commerce", "Monday.com". */
const NAME = "[A-Z0-9][\\w&'.\\-]*(?:[ \\t]+[A-Z0-9][\\w&'.\\-]*){0,3}";

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

const LEGAL_SUFFIX = /[\s,]+(?:inc|ltd|llc|plc|gmbh|corp|corporation|co|limited|group)\.?$/i;

function isCompanyName(name: string): boolean {
  const first = name.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  return name.trim().length >= 2 && !NON_COMPANY_WORDS.has(first);
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
 * an "About <Company>" heading, a "Company:" label, or "At <Company>, we".
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

  known.forEach(add);

  const firstLine = text.split('\n').find((line) => line.trim().length > 0)?.trim() ?? '';
  if (firstLine && firstLine.split(/\s+/).length <= 12 && !/[.!?]$/.test(firstLine)) {
    add(firstLine.match(TITLE_AT_COMPANY)?.[1]);
  }

  add(extractHiringSentence(text).company);
  for (const match of text.matchAll(ABOUT_HEADING)) add(match[1]);
  for (const match of text.matchAll(COMPANY_LABEL)) add(match[1]);
  for (const match of text.matchAll(AT_COMPANY_WE)) add(match[1]);

  const seen = new Set<string>();
  return found.filter((name) => {
    const key = name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Matchers for one company: its full name, then its name without a legal suffix. */
function companyPatterns(company: string): RegExp[] {
  const forms = [company.trim(), company.trim().replace(LEGAL_SUFFIX, '')];
  return [...new Set(forms)]
    .map((form) => normalizeText(form).split(' ').filter(Boolean))
    .filter((words) => words.join('').length >= 2)
    .map(
      (words) =>
        new RegExp(
          // A word boundary that also works for Hebrew and digits, plus a
          // possessive ("Appstock's", or "appstock s" once punctuation is gone).
          `(?<![\\p{L}\\p{N}])${words.map(escapeRegExp).join('[^\\p{L}\\p{N}]+')}(?:['’]s|\\s+s)?(?![\\p{L}\\p{N}])`,
          'giu',
        ),
    );
}

/**
 * Requirement terms with the company's name taken out. A term that was only the
 * name is dropped; the rest of a phrase the name sat in is kept, so "Represent
 * Appstock at industry events" still yields "industry events" once atomized.
 * A multi-word company is matched as a whole: "Kesher Commerce" never removes
 * "commerce" from "e commerce platforms".
 */
export function removeCompanyTerms(terms: string[], companies: string[]): string[] {
  const patterns = companies.flatMap(companyPatterns);
  if (patterns.length === 0) return terms;

  return terms
    .map((term) => {
      let out = term;
      for (const pattern of patterns) out = out.replace(pattern, ' ');
      return out === term ? term : out.replace(/\s+/g, ' ').trim();
    })
    .filter((term) => /[\p{L}\p{N}]/u.test(term));
}
