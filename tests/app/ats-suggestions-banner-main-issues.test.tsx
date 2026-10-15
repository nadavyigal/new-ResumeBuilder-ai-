import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Suggestion } from '@/lib/ats/types';
import enBase from '@/messages/en.json';
import heBase from '@/messages/he.json';
import enOverrides from '@/messages-overrides/funnel/en.json';
import heOverrides from '@/messages-overrides/funnel/he.json';

type Messages = Record<string, unknown>;

// Same merge order as src/i18n.ts: en, en overrides, then the locale and its overrides.
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

const EN_MESSAGES = merge(enBase, enOverrides);
const MESSAGES: Record<'en' | 'he', Messages> = {
  en: EN_MESSAGES,
  he: merge(merge(EN_MESSAGES, heBase), heOverrides),
};

let currentLocale: 'en' | 'he' = 'en';

function lookup(path: string): unknown {
  return path.split('.').reduce<unknown>(
    (acc, part) => (acc && typeof acc === 'object' ? (acc as Messages)[part] : undefined),
    MESSAGES[currentLocale],
  );
}

// Like next-intl, a missing message renders as its full key path, which is
// exactly what users saw in the main-issues summary.
jest.mock('next-intl', () => ({
  __esModule: true,
  useLocale: () => currentLocale,
  useTranslations: (namespace?: string) => {
    const full = (key: string) => (namespace ? `${namespace}.${key}` : key);
    const t = (key: string, values?: Record<string, unknown>) => {
      const message = lookup(full(key));
      if (typeof message !== 'string') return full(key);
      return message.replace(/\{(\w+)\}/g, (_, name) => String(values?.[name] ?? `{${name}}`));
    };
    t.has = (key: string) => typeof lookup(full(key)) === 'string';
    t.rich = t;
    return t;
  },
}));

const BASE_KEY = 'dashboard.chat.suggestionsBanner';
const HEBREW = /[֐-׿]/;

function suggestion(id: string, category: string, quickWin: boolean): Suggestion {
  return {
    id,
    text: `Suggestion text for ${category}`,
    estimated_gain: 2,
    targets: ['skills'],
    quick_win: quickWin,
    category: category as Suggestion['category'],
  };
}

// The summary shows at most three categories, so two sets cover all five.
const FIRST_THREE = [
  suggestion('keyword_exact_a', 'keywords', true),
  suggestion('metrics_presence_b', 'metrics', true),
  suggestion('summary_c', 'content', false),
];
const LAST_TWO = [
  suggestion('sections_d', 'structure', true),
  suggestion('format_e', 'formatting', true),
];

function renderExpandedBanner(root: Root, container: HTMLElement, suggestions: Suggestion[]) {
  const { ATSSuggestionsBanner } = require('@/components/chat/ATSSuggestionsBanner');
  act(() => root.render(<ATSSuggestionsBanner suggestions={suggestions} />));
  const toggle = container.querySelector('button');
  act(() => toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
}

function summaryText(container: HTMLElement): string {
  return container.querySelector('[data-testid="main-issues-summary"]')?.textContent ?? '';
}

describe('ATSSuggestionsBanner main issues summary', () => {
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
    currentLocale = 'en';
  });

  for (const locale of ['en', 'he'] as const) {
    for (const [label, suggestions] of [['first three', FIRST_THREE], ['last two', LAST_TWO]] as const) {
      it(`renders real copy, not message keys, on ${locale} (${label} categories)`, () => {
        currentLocale = locale;
        renderExpandedBanner(root, container, [...suggestions]);

        const summary = summaryText(container);
        expect(summary.length).toBeGreaterThan(0);
        expect(container.textContent).not.toContain(BASE_KEY);
        expect(summary).not.toContain('mainIssues.');
        expect(summary).not.toContain('categories.');
      });
    }
  }

  it('shows the summary in Hebrew on /he', () => {
    currentLocale = 'he';
    renderExpandedBanner(root, container, FIRST_THREE);

    const heading = container.querySelector('[data-testid="main-issues-summary"] h3');
    expect(heading?.textContent).toMatch(HEBREW);
  });

  it('keeps the restored copy free of em dashes and ATS result promises', () => {
    for (const locale of ['en', 'he'] as const) {
      currentLocale = locale;
      const block = lookup(`${BASE_KEY}.mainIssues`);
      expect(block).toBeDefined();
      const text = JSON.stringify(block);

      expect(text).not.toContain('—');
      expect(text).not.toMatch(/pass(es|ing)? (the )?ATS|beat the bots|guarantee/i);
    }
  });
});
