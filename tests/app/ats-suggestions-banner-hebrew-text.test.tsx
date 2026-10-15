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

let currentLocale: 'en' | 'he' = 'he';

function lookup(path: string): unknown {
  return path.split('.').reduce<unknown>(
    (acc, part) => (acc && typeof acc === 'object' ? (acc as Messages)[part] : undefined),
    MESSAGES[currentLocale],
  );
}

// Resolves the real messages, so the test fails if a key is missing or the
// banner still prints the server's English text on /he.
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

const HEBREW = /[֐-׿]/;

// Suggestions as the dashboard scorer builds them: English template text and
// the sub-score id prefix from generateSuggestionId / the per-keyword split.
const SUGGESTIONS: Suggestion[] = [
  {
    id: 'keyword_exact_1x9k2a',
    text: "Add the missing skill 'sql queries' to Skills and mention it in a recent, relevant achievement if accurate",
    estimated_gain: 2.4,
    targets: ['keyword_exact', 'skills'],
    quick_win: true,
    category: 'keywords',
  },
  {
    id: 'keyword_exact:tableau',
    text: 'Add "tableau" in context on your resume',
    estimated_gain: 1.2,
    targets: ['keyword_exact', 'skills'],
    quick_win: true,
    category: 'keywords',
  },
  {
    id: 'metrics_presence_7hq0lm',
    text: 'Quantify 3 achievements with concrete outcomes (percent, cost, time, or scale)',
    estimated_gain: 2.1,
    targets: ['metrics_presence', 'experience'],
    quick_win: false,
    category: 'metrics',
  },
];

function renderExpandedBanner(root: Root, container: HTMLElement, suggestions: Suggestion[]) {
  const { ATSSuggestionsBanner } = require('@/components/chat/ATSSuggestionsBanner');
  act(() => root.render(<ATSSuggestionsBanner suggestions={suggestions} />));
  const toggle = container.querySelector('button');
  act(() => toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
}

/** The text of each tip row, without its "Tip N" label. */
function tipTexts(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('p'))
    .filter((p) => p.querySelector('span.font-semibold'))
    .map((p) => (p.textContent ?? '').replace(p.querySelector('span')?.textContent ?? '', '').trim());
}

describe('ATSSuggestionsBanner issue text', () => {
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
    currentLocale = 'he';
  });

  it('shows Hebrew tips on /he, not the server English', () => {
    currentLocale = 'he';
    renderExpandedBanner(root, container, SUGGESTIONS);
    const tips = tipTexts(container);

    expect(tips).toHaveLength(SUGGESTIONS.length);
    for (const tip of tips) expect(tip).toMatch(HEBREW);
    for (const suggestion of SUGGESTIONS) expect(container.textContent).not.toContain(suggestion.text);
  });

  it('keeps the job terms the user must add on /he', () => {
    currentLocale = 'he';
    renderExpandedBanner(root, container, SUGGESTIONS);
    const text = container.textContent ?? '';

    expect(text).toContain('sql queries');
    expect(text).toContain('tableau');
  });

  it('prints the server text unchanged on en', () => {
    currentLocale = 'en';
    renderExpandedBanner(root, container, SUGGESTIONS);

    expect(tipTexts(container)).toEqual(SUGGESTIONS.map((s) => s.text));
  });

  it('falls back to the server text on /he when no template matches', () => {
    currentLocale = 'he';
    const custom: Suggestion = {
      id: 'custom_1',
      text: 'A suggestion with no template',
      estimated_gain: 3,
      targets: ['summary'],
      quick_win: true,
      category: 'content',
    };
    renderExpandedBanner(root, container, [custom]);

    expect(tipTexts(container)).toEqual(['A suggestion with no template']);
  });
});
