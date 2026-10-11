import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { QuickWinSuggestion } from '@/lib/ats/types';
import type { ATSCheckerResponse } from '@/components/landing/FreeATSChecker';

// AI and resume text is usually English even on the Hebrew (/he, dir="rtl") page.
// Without dir="auto" the RTL base direction moves sentence-final punctuation to the
// wrong side (".sales by region"). These tests pin the isolation on every block that
// renders that text.

jest.mock('next-intl', () => ({
  __esModule: true,
  useTranslations: (namespace?: string) => {
    const t = (key: string) => (namespace ? `${namespace}.${key}` : key);
    t.has = () => false;
    return t;
  },
  useLocale: () => 'he',
}));

jest.mock('@/lib/posthog', () => ({
  __esModule: true,
  posthog: { capture: jest.fn() },
}));

jest.mock('@/components/ui/CountUp', () => ({
  __esModule: true,
  CountUp: ({ end }: { end: number }) => <span>{end}</span>,
}));

jest.mock('@/components/landing/SocialShareButton', () => ({
  __esModule: true,
  SocialShareButton: () => null,
}));

jest.mock('@/components/landing/ContextualSignupPopup', () => ({
  __esModule: true,
  ContextualSignupPopup: () => null,
}));

jest.mock('@/components/ats/MainIssuesSummary', () => ({
  __esModule: true,
  MainIssuesSummary: () => null,
}));

const quickWin: QuickWinSuggestion = {
  id: 'qw-1',
  original_text: 'Built SQL dashboards in Looker to monitor weekly sales by region.',
  optimized_text: 'Built SQL dashboards in Looker tracking weekly sales metrics.',
  improvement_type: 'keyword_optimization',
  estimated_impact: 4,
  location: { section: 'experience' },
  rationale: 'Adds the job keywords and clarifies action and scope.',
  keywords_added: ['C++', 'Looker'],
};

const data: ATSCheckerResponse = {
  success: true,
  sessionId: 's1',
  score: { overall: 62, timestamp: '2026-10-11T00:00:00Z' },
  preview: {
    topIssues: [{ id: 'i1', text: 'Add the missing keyword "Tableau" to your skills.', category: 'keywords' }],
    totalIssues: 1,
    lockedCount: 0,
  },
  quickWins: [quickWin],
  checksRemaining: 2,
  fit: {
    verdict: 'Stretch',
    scoreNote: 'Estimated fit vs this job, not a hiring guarantee.',
    topGaps: [],
    missingKeywords: [],
  },
};

function elementWithText(container: HTMLElement, text: string): HTMLElement {
  const match = Array.from(container.querySelectorAll<HTMLElement>('*')).find(
    (el) => el.textContent?.trim() === text && el.children.length === 0
  );
  if (!match) throw new Error(`No element renders "${text}"`);
  return match;
}

describe('free check results keep English AI text LTR inside an RTL page', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    container.setAttribute('dir', 'rtl');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it.each([
    ['fit verdict', 'Stretch'],
    ['issue text', data.preview.topIssues[0].text],
    ['quick win before', quickWin.original_text],
    ['quick win after', quickWin.optimized_text],
    ['quick win why', quickWin.rationale],
    ['keyword badge', 'C++'],
  ])('%s has dir="auto"', (_label, text) => {
    const { ATSScoreDisplay } = require('@/components/landing/ATSScoreDisplay');
    act(() => {
      root.render(<ATSScoreDisplay data={data} onSignup={() => {}} />);
    });

    expect(elementWithText(container, text).getAttribute('dir')).toBe('auto');
  });

  it('shows the translated score note, not the English string from the API', () => {
    const { ATSScoreDisplay } = require('@/components/landing/ATSScoreDisplay');
    act(() => {
      root.render(<ATSScoreDisplay data={data} onSignup={() => {}} />);
    });

    expect(container.textContent).toContain('landing.score.fit.scoreNote');
    expect(container.textContent).not.toContain(data.fit!.scoreNote);
  });
});
