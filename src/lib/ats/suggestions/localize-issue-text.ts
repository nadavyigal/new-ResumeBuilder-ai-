/**
 * Localized issue text for the web free check
 *
 * The scorer builds issue text from the English templates in ./templates and
 * the iOS app decodes that text as-is, so the API keeps sending English. The
 * web client re-renders it in the page locale: it matches the server text back
 * to its template, pulls out the filled-in values, and formats the matching
 * `landing.issueCard.issueText` message. Text no template matches is shown
 * unchanged, so a new or edited template degrades to English, never to a
 * blank card.
 */

import type { SubScoreKey } from '../types';
import { SUGGESTION_TEMPLATES } from './templates';

export interface IssueTextTranslator {
  (key: string, values?: Record<string, string | number>): string;
  has(key: string): boolean;
}

interface IssueLike {
  id?: string;
  text: string;
}

/** Message key for each server template, keyed by the template's English text. */
const TEMPLATE_MESSAGE_KEYS: Record<string, string> = {
  "Add the missing skill '{keyword}' to Skills and mention it in a recent, relevant achievement if accurate":
    'keywordExact.addMissingSkill',
  'Prioritize these {count} must-have skills in Skills and experience bullets: {keywords}':
    'keywordExact.prioritizeMustHave',
  'If accurate, add these nice-to-have skills to Skills or your tools list: {keywords}':
    'keywordExact.addNiceToHave',
  "Work the concept '{phrase}' into an existing achievement using your own wording":
    'keywordPhrase.workConcept',
  'Add 1-2 job-description phrases to achievements or summary (in your own wording): {phrases}':
    'keywordPhrase.addPhrases',
  'Update your summary to clearly describe relevant experience for this role':
    'semanticRelevance.updateSummary',
  'Add context to achievements to show where and how your skills were applied':
    'semanticRelevance.addContext',
  "Align your headline or summary with the target title '{targetTitle}' if it matches your experience":
    'titleAlignment.alignTitle',
  'Clarify your seniority level ({seniority}) in the summary without changing official job titles':
    'titleAlignment.clarifySeniority',
  'Quantify {count} achievements with concrete outcomes (percent, cost, time, or scale)':
    'metricsPresence.quantify',
  'Add at least one metric to your most recent role (for example: time saved, revenue, users, or efficiency)':
    'metricsPresence.addRecentMetric',
  "Include timeframes showing speed of delivery (e.g., 'in 3 months')": 'metricsPresence.addTimeframes',
  'Add the missing section: {section}': 'sectionCompleteness.addSection',
  'Expand your professional summary to 50-150 words with role-focused detail':
    'sectionCompleteness.expandSummary',
  'Ensure all experience roles have achievement bullets': 'sectionCompleteness.achievementBullets',
  'Switch to an ATS-safe template (single column, no graphics)': 'formatParseability.safeTemplate',
  'Remove tables and use simple text formatting instead': 'formatParseability.removeTables',
  'Remove images, logos, and graphics because ATS systems often cannot parse them':
    'formatParseability.removeImages',
  'Convert multi-column layout to single column': 'formatParseability.singleColumn',
  'Move recent, relevant projects closer to the top of your experience': 'recencyFit.moveRecent',
  'Highlight recent skill growth to show current relevance': 'recencyFit.highlightGrowth',
  'Add recent certifications or training to demonstrate current expertise': 'recencyFit.addCertifications',
};

/** The per-keyword card the generator builds when it splits a keyword suggestion. */
const KEYWORD_IN_CONTEXT = /^Add "(.+)" in context on your resume$/;

/** Values that are words the scorer chose, not terms from the job post. */
const TRANSLATED_VALUES: Record<string, string> = {
  section: 'sections',
  seniority: 'seniority',
};

/** Placeholders that hold a list fillTemplate may have cut to "a, b, c, and N more". */
const LIST_PLACEHOLDERS = new Set(['keywords', 'phrases']);

interface CompiledTemplate {
  subscore: SubScoreKey;
  messageKey: string;
  pattern: RegExp;
  placeholders: string[];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const COMPILED_TEMPLATES: CompiledTemplate[] = (
  Object.entries(SUGGESTION_TEMPLATES) as Array<[SubScoreKey, Array<{ text: string }>]>
).flatMap(([subscore, templates]) =>
  templates.flatMap((template) => {
    const messageKey = TEMPLATE_MESSAGE_KEYS[template.text];
    if (!messageKey) return [];
    const placeholders: string[] = [];
    const source = template.text
      .split(/(\{[a-zA-Z_]+\})/)
      .map((part) => {
        const name = part.match(/^\{([a-zA-Z_]+)\}$/)?.[1];
        if (!name) return escapeRegExp(part);
        placeholders.push(name);
        return '(.+?)';
      })
      .join('');
    return [{ subscore, messageKey, pattern: new RegExp(`^${source}$`), placeholders }];
  }),
);

function subscoreFromId(id?: string): SubScoreKey | null {
  if (!id) return null;
  const match = (Object.keys(SUGGESTION_TEMPLATES) as SubScoreKey[]).find(
    (key) => id.startsWith(`${key}_`) || id.startsWith(`${key}:`),
  );
  return match ?? null;
}

/** First Strong Isolate / Pop Directional Isolate: keeps an English term from reordering RTL text. */
function isolateValue(value: string, isolate: boolean): string {
  return isolate ? `⁨${value}⁩` : value;
}

function formatValue(
  name: string,
  raw: string,
  t: IssueTextTranslator,
  isolate: boolean,
): string {
  const group = TRANSLATED_VALUES[name];
  if (group) {
    const key = `${group}.${raw.trim().toLowerCase()}`;
    return t.has(key) ? t(key) : isolateValue(raw, isolate);
  }

  if (LIST_PLACEHOLDERS.has(name)) {
    const truncated = raw.match(/^(.*), and (\d+) more$/);
    if (truncated) {
      return t('listMore', { list: isolateValue(truncated[1], isolate), count: Number(truncated[2]) });
    }
  }

  return isolateValue(raw, isolate);
}

/**
 * Returns the issue text in the translator's locale, or the server text when
 * no template matches it.
 */
export function localizeIssueText(
  issue: IssueLike,
  t: IssueTextTranslator,
  options: { isolate?: boolean } = {},
): string {
  const isolate = options.isolate ?? true;
  const text = issue.text?.trim();
  if (!text) return issue.text;

  const keywordInContext = text.match(KEYWORD_IN_CONTEXT);
  if (keywordInContext && t.has('keywordExact.keywordInContext')) {
    return t('keywordExact.keywordInContext', { keyword: isolateValue(keywordInContext[1], isolate) });
  }

  const subscore = subscoreFromId(issue.id);
  const candidates = subscore
    ? COMPILED_TEMPLATES.filter((template) => template.subscore === subscore)
    : COMPILED_TEMPLATES;

  for (const template of candidates) {
    const match = text.match(template.pattern);
    if (!match || !t.has(template.messageKey)) continue;
    const values: Record<string, string> = {};
    template.placeholders.forEach((name, index) => {
      values[name] = formatValue(name, match[index + 1], t, isolate);
    });
    return t(template.messageKey, values);
  }

  return issue.text;
}
