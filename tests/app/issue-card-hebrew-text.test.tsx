import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { ATSIssue } from '@/components/landing/FreeATSChecker';
import { SUGGESTION_TEMPLATES, fillTemplate } from '@/lib/ats/suggestions/templates';
import enBase from '@/messages/en.json';
import heBase from '@/messages/he.json';
import enOverrides from '@/messages-overrides/funnel/en.json';
import heOverrides from '@/messages-overrides/funnel/he.json';

type Messages = Record<string, unknown>;

// Same merge order as src/i18n.ts for /he: en, en overrides, he, he overrides.
function merge(base: Messages, overrides: Messages): Messages {
  const result: Messages = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    const current = result[key];
    if (
      value && typeof value === 'object' && !Array.isArray(value) &&
      current && typeof current === 'object' && !Array.isArray(current)
    ) {
      result[key] = merge(current as Messages, value as Messages);
    } else {
      result[key] = value;
    }
  }
  return result;
}

const HE_MESSAGES = merge(merge(merge(enBase, enOverrides), heBase), heOverrides);

function lookup(path: string): unknown {
  return path.split('.').reduce<unknown>(
    (acc, part) => (acc && typeof acc === 'object' ? (acc as Messages)[part] : undefined),
    HE_MESSAGES,
  );
}

// Resolves the real Hebrew messages, so the test fails if a key is missing or
// the component still prints the server's English text.
jest.mock('next-intl', () => ({
  __esModule: true,
  useLocale: () => 'he',
  useTranslations: (namespace?: string) => {
    const full = (key: string) => (namespace ? `${namespace}.${key}` : key);
    const t = (key: string, values?: Record<string, unknown>) => {
      const message = lookup(full(key));
      if (typeof message !== 'string') return full(key);
      return message.replace(/\{(\w+)\}/g, (_, name) => String(values?.[name] ?? `{${name}}`));
    };
    t.has = (key: string) => typeof lookup(full(key)) === 'string';
    return t;
  },
}));

const HEBREW = /[֐-׿]/;

// preview.topIssues as /api/public/ats-check returned them on /he/ats-checker
// (2026-10-15): server-built English text plus the sub-score id prefix.
const RECORDED_TOP_ISSUES: ATSIssue[] = [
  {
    id: 'keyword_exact_1x9k2a',
    text: "Add the missing skill 'sql queries' to Skills and mention it in a recent, relevant achievement if accurate",
    category: 'keywords',
    estimated_gain: 2.4,
    quick_win: true,
    action: { type: 'add_keyword', params: { keywords: ['sql queries'], target: 'skills', source: 'must_have' } },
  },
  {
    id: 'keyword_exact:tableau',
    text: 'Add "tableau" in context on your resume',
    category: 'keywords',
    estimated_gain: 1.2,
    quick_win: false,
    action: { type: 'add_keyword', params: { keywords: ['tableau'], target: 'skills', source: 'must_have' } },
  },
  {
    id: 'metrics_presence_7hq0lm',
    text: 'Quantify 3 achievements with concrete outcomes (percent, cost, time, or scale)',
    category: 'metrics',
    estimated_gain: 1.1,
    quick_win: false,
    action: { type: 'add_metric', params: { targetRoleIndex: 0, targetCount: 3, metricHint: 'impact' } },
  },
];

function renderCard(root: Root, issue: ATSIssue) {
  const { IssueCard } = require('@/components/landing/IssueCard');
  act(() => root.render(<IssueCard issue={issue} rank={1} />));
}

describe('IssueCard on /he', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it.each(RECORDED_TOP_ISSUES.map((issue) => [issue.id, issue] as const))(
    'shows Hebrew text, not the server English, for %s',
    (_id, issue) => {
      renderCard(root, issue);
      const text = container.textContent ?? '';
      expect(text).toMatch(HEBREW);
      expect(text).not.toContain(issue.text);
    },
  );

  it('keeps the job terms the user must add', () => {
    renderCard(root, RECORDED_TOP_ISSUES[0]);
    expect(container.textContent).toContain('sql queries');

    renderCard(root, RECORDED_TOP_ISSUES[2]);
    expect(container.textContent).toContain('3');
  });

  it('falls back to the server text when no template matches', () => {
    const issue: ATSIssue = { id: 'custom_1', text: 'A suggestion with no template', category: 'content' };
    renderCard(root, issue);
    expect(container.textContent).toContain('A suggestion with no template');
  });

  it('has a Hebrew line for every server template', () => {
    const { localizeIssueText } = require('@/lib/ats/suggestions/localize-issue-text');
    const { useTranslations } = require('next-intl');
    const t = useTranslations('landing.issueCard.issueText');
    const sample = {
      keyword: 'sql queries',
      keywords: ['sql', 'python', 'tableau', 'dbt', 'airflow'],
      count: 3,
      phrase: 'stakeholder reporting',
      phrases: ['stakeholder reporting', 'data pipelines'],
      targetTitle: 'Data Analyst',
      seniority: 'senior',
      section: 'summary',
    };

    for (const [subscore, templates] of Object.entries(SUGGESTION_TEMPLATES)) {
      for (const template of templates) {
        const english = fillTemplate(template, sample);
        const localized = localizeIssueText({ id: `${subscore}_abc`, text: english }, t, { isolate: false });
        expect({ english, localized: HEBREW.test(localized) }).toEqual({ english, localized: true });
        // A list longer than three names keeps no English "and 2 more".
        expect(localized).not.toMatch(/\band \d+ more\b/);
      }
    }
  });
});
