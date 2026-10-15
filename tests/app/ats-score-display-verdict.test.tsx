import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { ATSCheckerResponse } from '@/components/landing/FreeATSChecker';

// Every translation renders as "<namespace>.<key>" plus its values, so the test
// can see exactly which message the component asked for.
jest.mock('next-intl', () => ({
  __esModule: true,
  useLocale: () => 'he',
  useTranslations: (namespace?: string) => {
    const t = (key: string, values?: Record<string, unknown>) =>
      `${namespace ? `${namespace}.` : ''}${key}${values ? ` ${JSON.stringify(values)}` : ''}`;
    t.has = () => false;
    return t;
  },
}));

jest.mock('@/lib/posthog', () => ({
  posthog: { capture: jest.fn() },
}));

jest.mock('@/components/ui/CountUp', () => ({
  CountUp: ({ end }: { end: number }) => <span>{end}</span>,
}));

jest.mock('@/components/landing/SocialShareButton', () => ({
  SocialShareButton: () => null,
}));

jest.mock('@/components/ats/QuickWinsSection', () => ({
  QuickWinsSection: () => null,
}));

// Required after the mocks: next/jest's transform does not hoist jest.mock above imports.
function renderDisplay(root: Root, data: ATSCheckerResponse) {
  const { ATSScoreDisplay } = require('@/components/landing/ATSScoreDisplay');
  act(() => root.render(<ATSScoreDisplay data={data} onSignup={() => {}} />));
}

// The live free check on 2026-10-15 returned this shape: score 62, verdict
// "Strong" (calibrated band, Strong from 57), and two metrics issues whose gains
// summed to 1.9000000000000001 in floating point.
function response(overrides: Partial<NonNullable<ATSCheckerResponse['fit']>> = {}): ATSCheckerResponse {
  return {
    success: true,
    sessionId: 's-1',
    score: { overall: 62, timestamp: '2026-10-15T06:01:25Z' },
    preview: {
      topIssues: [
        { id: 'metrics_a', text: 'Quantify 3 achievements', category: 'metrics', estimated_gain: 1.1 },
        { id: 'metrics_b', text: 'Add one metric to your most recent role', category: 'metrics', estimated_gain: 0.8 },
      ],
      totalIssues: 2,
      lockedCount: 0,
    },
    checksRemaining: 4,
    fit: {
      verdict: 'Strong',
      scoreNote: 'Estimated fit vs this job, not a hiring guarantee.',
      topGaps: [],
      missingKeywords: [],
      ...overrides,
    },
  };
}

describe('ATSScoreDisplay verdict and points', () => {
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

  it('shows one translated verdict and no second label from another scale', () => {
    renderDisplay(root, response());

    const text = container.textContent ?? '';
    expect(text).toContain('landing.score.fit.verdicts.Strong');
    expect(text).toContain('landing.score.fit.note');
    // The API's English note must not reach the page; the translated note replaces it.
    expect(text).not.toContain('not a hiring guarantee');
    // The old 85/70 label read "Needs improvement" under a "Strong" verdict at 62.
    expect(text).not.toContain('landing.score.match.');
  });

  it('shows no verdict box when the verdict is withheld', () => {
    renderDisplay(root, response({ verdict: null }));

    expect(container.querySelector('[data-testid="fit-verdict"]')).toBeNull();
    expect(container.textContent).toContain('62');
  });

  it('rounds summed gains to one decimal', () => {
    renderDisplay(root, response());

    const text = container.textContent ?? '';
    expect(text).toContain('{"points":1.9}');
    expect(text).not.toContain('1.9000000000000001');
  });
});
