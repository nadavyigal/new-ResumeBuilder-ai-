import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { ATSCheckerResponse } from '@/components/landing/FreeATSChecker';

// Session replay masks only what sits inside PostHog's maskTextSelector. The
// selector was configured with nothing in the markup matching it, so a recording
// of a free check would have held CV and job text in the clear. The selector
// here is read from the real init call, so renaming it on either side fails.

const posthogInit = jest.fn();

jest.mock('posthog-js', () => ({
  __esModule: true,
  default: { init: (...args: unknown[]) => posthogInit(...args), capture: jest.fn(), __loaded: false },
}));

jest.mock('next-intl', () => ({
  __esModule: true,
  useLocale: () => 'en',
  useTranslations: (namespace?: string) => {
    const t = (key: string, values?: Record<string, unknown>) =>
      `${namespace ? `${namespace}.` : ''}${key}${values ? ` ${JSON.stringify(values)}` : ''}`;
    t.has = () => false;
    t.raw = () => [];
    return t;
  },
}));

jest.mock('@/components/ui/CountUp', () => ({ CountUp: ({ end }: { end: number }) => <span>{end}</span> }));

const CV_TEXT = 'CVSENTINEL led the payments team';
const JOB_TEXT = 'JOBSENTINEL senior staff engineer';

const data: ATSCheckerResponse = {
  success: true,
  sessionId: 's-1',
  score: { overall: 62, timestamp: '2026-10-31T06:01:25Z' },
  preview: {
    topIssues: [
      {
        id: 'a',
        text: `Add ${JOB_TEXT}`,
        category: 'keywords',
        estimated_gain: 3,
        action: { type: 'add_keyword', params: { keywords: [JOB_TEXT] } },
      },
    ],
    moreIssues: [{ id: 'b', text: `Rewrite ${CV_TEXT}`, category: 'content', estimated_gain: 2 }],
    totalIssues: 2,
    lockedCount: 0,
  },
  quickWins: [
    {
      id: 'q',
      original_text: CV_TEXT,
      optimized_text: `${CV_TEXT} with numbers`,
      improvement_type: 'quantified_achievement',
      estimated_impact: 4,
      location: { section: 'experience', subsection: `${CV_TEXT} Inc` },
      rationale: `Matches ${JOB_TEXT}`,
      keywords_added: [JOB_TEXT],
    },
  ],
  checksRemaining: 4,
  fit: { verdict: 'Stretch', scoreNote: JOB_TEXT, topGaps: [JOB_TEXT], missingKeywords: [JOB_TEXT] },
};

function textNodesContaining(container: HTMLElement, needles: string[]): Text[] {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const found: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (needles.some((needle) => node.textContent?.includes(needle))) found.push(node);
  }
  return found;
}

describe('free check text stays out of session replay', () => {
  let selector: string;
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test';
    const { initPostHog } = require('@/lib/posthog');
    initPostHog();
    const options = posthogInit.mock.calls[0]?.[1] as { session_recording: { maskTextSelector: string } };
    selector = options.session_recording.maskTextSelector;
  });

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

  it('masks every CV-derived and job-derived string in the result', () => {
    const { ATSScoreDisplay } = require('@/components/landing/ATSScoreDisplay');
    act(() => root.render(<ATSScoreDisplay data={data} onSignup={() => {}} />));

    const nodes = textNodesContaining(document.body, ['CVSENTINEL', 'JOBSENTINEL']);

    expect(nodes.length).toBeGreaterThan(0);
    nodes.forEach((node) => {
      expect(node.parentElement?.closest(selector)).not.toBeNull();
    });
  });

  it('masks the selected file name, which usually holds the person’s name', () => {
    const { UploadForm } = require('@/components/landing/UploadForm');
    act(() => root.render(<UploadForm onSubmit={() => {}} />));

    const input = container.querySelector('[data-testid="resume-upload"]') as HTMLInputElement;
    const file = new File(['%PDF'], 'NAMESENTINEL-cv.pdf', { type: 'application/pdf' });
    Object.defineProperty(input, 'files', { value: [file] });
    act(() => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const nodes = textNodesContaining(container, ['NAMESENTINEL']);

    expect(nodes.length).toBeGreaterThan(0);
    nodes.forEach((node) => {
      expect(node.parentElement?.closest(selector)).not.toBeNull();
    });
  });

  it('masks a server error, which can repeat what the visitor sent', () => {
    const { UploadForm } = require('@/components/landing/UploadForm');
    act(() =>
      root.render(<UploadForm onSubmit={() => {}} errorMessage="Could not fetch JOBSENTINEL" />),
    );

    const [node] = textNodesContaining(container, ['JOBSENTINEL']);

    expect(node.parentElement?.closest(selector)).not.toBeNull();
  });
});
