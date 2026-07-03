import fs from 'fs';
import path from 'path';
import { describe, expect, it } from '@jest/globals';

type JsonObject = Record<string, unknown>;

const ROOT = process.cwd();
const CRITICAL_FUNNEL_PATHS = ['landing.score.mainIssues', 'landing.popup'];

const MAIN_ISSUE_CATEGORIES = ['keywords', 'metrics', 'content', 'structure', 'formatting'] as const;

/** Leaf keys MainIssuesSummary reads at runtime (see src/components/ats/MainIssuesSummary.tsx). */
const MAIN_ISSUES_RUNTIME_LEAF_KEYS = [
  'title',
  'subtitle',
  'issueBadge',
  'pointsBadge',
  'whyLabel',
  'exampleLabel',
  'copy',
  'copied',
  'continueTitle',
  'continueDescription',
  'continueCta',
  ...MAIN_ISSUE_CATEGORIES.flatMap((category) => [
    `categories.${category}.title`,
    `categories.${category}.description`,
    `categories.${category}.why`,
    `categories.${category}.fallbackTerm`,
    `categories.${category}.examples.example1`,
    `categories.${category}.examples.example2`,
  ]),
];

function readJson(relativePath: string): JsonObject {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8')) as JsonObject;
}

function isPlainObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergeMessages(base: JsonObject, overrides: JsonObject): JsonObject {
  const result: JsonObject = { ...base };

  for (const [key, value] of Object.entries(overrides)) {
    const current = result[key];
    if (isPlainObject(value) && isPlainObject(current)) {
      result[key] = mergeMessages(current, value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

function getAtPath(obj: JsonObject, dotPath: string): unknown {
  return dotPath.split('.').reduce<unknown>((current, part) => {
    if (!isPlainObject(current)) return undefined;
    return current[part];
  }, obj);
}

function collectLeafKeys(value: unknown, basePath = ''): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectLeafKeys(item, `${basePath}[${index}]`));
  }

  if (isPlainObject(value)) {
    return Object.entries(value).flatMap(([key, child]) => {
      const nextPath = basePath ? `${basePath}.${key}` : key;
      return collectLeafKeys(child, nextPath);
    });
  }

  return [basePath];
}

function buildMergedLocale(locale: 'en' | 'he'): JsonObject {
  const en = mergeMessages(
    readJson('src/messages/en.json'),
    readJson('src/messages-overrides/funnel/en.json')
  );

  if (locale === 'en') {
    return en;
  }

  return mergeMessages(mergeMessages(en, readJson('src/messages/he.json')), readJson('src/messages-overrides/funnel/he.json'));
}

describe('funnel i18n critical namespace parity', () => {
  it.each(CRITICAL_FUNNEL_PATHS)('%s has matching EN and HE leaf keys', (namespace) => {
    const en = buildMergedLocale('en');
    const he = buildMergedLocale('he');

    const enKeys = collectLeafKeys(getAtPath(en, namespace)).sort();
    const heKeys = collectLeafKeys(getAtPath(he, namespace)).sort();

    expect(enKeys).toEqual(heKeys);
  });

  it.each(['en', 'he'] as const)('landing.score.mainIssues exposes every MainIssuesSummary runtime key (%s)', (locale) => {
    const messages = buildMergedLocale(locale);
    const namespace = getAtPath(messages, 'landing.score.mainIssues');

    expect(namespace).toBeDefined();

    for (const leafKey of MAIN_ISSUES_RUNTIME_LEAF_KEYS) {
      const value = getAtPath(namespace as JsonObject, leafKey);
      expect(value).toBeDefined();
      expect(typeof value).toBe('string');
      expect((value as string).trim().length).toBeGreaterThan(0);
    }
  });
});
