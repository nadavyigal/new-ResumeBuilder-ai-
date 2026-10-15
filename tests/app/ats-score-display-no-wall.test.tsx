import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { ATSCheckerResponse } from '@/components/landing/FreeATSChecker';

// G1c-1 (2026-10-15): the free check shows every issue and asks for nothing.
// Before, a sign-up modal opened 900 ms after the score and 7 of 10 issues sat
// behind "Create free account" (seen on production, 2026-10-15).

const capture = jest.fn();

jest.mock('next-intl', () => ({
  __esModule: true,
  useLocale: () => 'en',
  useTranslations: (namespace?: string) => {
    const t = (key: string, values?: Record<string, unknown>) =>
      `${namespace ? `${namespace}.` : ''}${key}${values ? ` ${JSON.stringify(values)}` : ''}`;
    t.has = () => false;
    return t;
  },
}));

jest.mock('@/lib/posthog', () => ({ posthog: { capture: (...args: unknown[]) => capture(...args) } }));
jest.mock('@/components/ui/CountUp', () => ({ CountUp: ({ end }: { end: number }) => <span>{end}</span> }));
jest.mock('@/components/landing/SocialShareButton', () => ({ SocialShareButton: () => null }));
jest.mock('@/components/ats/QuickWinsSection', () => ({ QuickWinsSection: () => null }));

function renderDisplay(root: Root, data: ATSCheckerResponse, onSignup = () => {}) {
  const { ATSScoreDisplay } = require('@/components/landing/ATSScoreDisplay');
  act(() => root.render(<ATSScoreDisplay data={data} onSignup={onSignup} />));
}

const issue = (id: string) => ({ id, text: `Issue ${id}`, category: 'keywords', estimated_gain: 1 });

const data: ATSCheckerResponse = {
  success: true,
  sessionId: 's-1',
  score: { overall: 62, timestamp: '2026-10-15T06:01:25Z' },
  preview: {
    topIssues: [issue('a'), issue('b'), issue('c')],
    moreIssues: [issue('d'), issue('e')],
    totalIssues: 5,
    lockedCount: 2,
  },
  checksRemaining: 4,
};

describe('ATSScoreDisplay without an account wall', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    jest.useFakeTimers();
    capture.mockClear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.useRealTimers();
  });

  it('lists every issue, top three and the rest', () => {
    renderDisplay(root, data);
    expect(container.querySelectorAll('[data-testid="issue-card"]')).toHaveLength(5);
    expect(container.textContent).toContain('Issue e');
  });

  it('locks nothing and opens no modal', () => {
    renderDisplay(root, data);
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(container.querySelector('[data-testid="locked-issues-blur"]')).toBeNull();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(capture).not.toHaveBeenCalledWith('signup_popup_viewed', expect.anything());
    expect(container.textContent).not.toContain('landing.score.lockedTitle');
  });

  it('offers saving the check as an optional link, not a gate', () => {
    const onSignup = jest.fn();
    renderDisplay(root, data, onSignup);
    const save = container.querySelector('[data-testid="save-check-cta"]') as HTMLElement | null;
    expect(save).not.toBeNull();
    act(() => save!.click());
    expect(onSignup).toHaveBeenCalledTimes(1);
  });

  it('still works for a response without moreIssues (older API)', () => {
    const preview = { ...data.preview, lockedCount: 0 };
    delete preview.moreIssues;
    renderDisplay(root, { ...data, preview });
    expect(container.querySelectorAll('[data-testid="issue-card"]')).toHaveLength(3);
  });
});
