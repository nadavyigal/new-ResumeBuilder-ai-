import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

// The slogan is Hebrew only. There is no approved English line, and the English
// page must not print a raw message key in its place.

let mockLocale = 'he';

jest.mock('next-intl', () => ({
  __esModule: true,
  useLocale: () => mockLocale,
  useTranslations: () => (key: string) => (key === 'slogan' ? 'SLOGAN' : key),
}));

jest.mock('@/navigation', () => ({
  __esModule: true,
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/lib/posthog', () => ({ __esModule: true, posthog: { capture: jest.fn() } }));
jest.mock('@/components/landing/UploadForm', () => ({ UploadForm: () => null }));
jest.mock('@/components/landing/AppStoreCta', () => ({ AppStoreCta: () => null }));

describe('FreeATSChecker slogan', () => {
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

  function render(locale: string) {
    mockLocale = locale;
    const { FreeATSChecker } = require('@/components/landing/FreeATSChecker');
    act(() => root.render(<FreeATSChecker />));
    return container.querySelector('[data-testid="ats-checker-slogan"]');
  }

  it('shows under the heading in Hebrew', () => {
    expect(render('he')?.textContent).toBe('SLOGAN');
  });

  it('stays off the English page', () => {
    expect(render('en')).toBeNull();
  });
});
