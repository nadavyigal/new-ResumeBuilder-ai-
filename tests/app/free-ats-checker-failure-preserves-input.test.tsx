import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const translations: Record<string, string> = {
  'landing.atsChecker.badge': 'Free ATS Resume Check',
  'landing.atsChecker.title': 'See how recruiter systems read your resume',
  'landing.atsChecker.description': 'Upload your resume and match it to a job description.',
  'landing.atsChecker.badges.atsSafe': 'ATS-safe guidance',
  'landing.atsChecker.badges.topFixes': 'Prioritized fixes',
  'landing.atsChecker.badges.weeklyChecks': 'Free weekly checks',
  'landing.atsChecker.bullets.v2Engine': 'Role-aware analysis',
  'landing.atsChecker.bullets.hashPrivacy': 'Privacy-first handling',
  'landing.atsChecker.bullets.unlockFixes': 'Unlock the full fix plan',
  'landing.atsChecker.existingAccount': 'Already have an account?',
  'landing.atsChecker.loginLink': 'Log in',
  'landing.atsChecker.errors.generic': 'Something went wrong. Please try again.',
  'landing.atsChecker.errors.connection': 'We could not reach the server. Please try again.',
  'landing.uploadForm.resumeLabel': 'Resume (PDF)',
  'landing.uploadForm.selectedFile': 'Selected file: {fileName}',
  'landing.uploadForm.jobDescriptionLabel': 'Job description',
  'landing.uploadForm.inputModes.text': 'Paste text',
  'landing.uploadForm.inputModes.url': 'From URL',
  'landing.uploadForm.placeholders.description': 'Paste the job description here...',
  'landing.uploadForm.placeholders.url': 'https://',
  'landing.uploadForm.minimumWords': 'Minimum {count} words',
  'landing.uploadForm.wordCount': '{count} words',
  'landing.uploadForm.urlHelper': 'Paste a public job post URL and we will fetch the description.',
  'landing.uploadForm.checking': 'Running ATS check...',
  'landing.uploadForm.submit': 'Get my Match Score',
  'landing.uploadForm.invalidUrl': 'Enter a valid job post URL.',
  'landing.uploadForm.hints.resumeRequired': 'Upload your resume to start.',
  'landing.uploadForm.hints.jobDescriptionRequired': 'Paste the job description to continue.',
  'landing.uploadForm.hints.jobUrlRequired': 'Add a job post URL to continue.',
  'landing.uploadForm.hints.minimumWords': 'Job description must include at least {count} words.',
  'landing.uploadForm.hints.validUrlRequired': 'Add a valid job post URL.',
};

function formatMessage(template: string, values?: Record<string, unknown>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values?.[key] ?? `{${key}}`));
}

jest.mock('next-intl', () => ({
  __esModule: true,
  useTranslations: (namespace?: string) => (key: string, values?: Record<string, unknown>) => {
    const fullKey = namespace ? `${namespace}.${key}` : key;
    return formatMessage(translations[fullKey] ?? fullKey, values);
  },
}));

jest.mock('@/navigation', () => ({
  __esModule: true,
  Link: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>{children}</a>
  ),
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/lib/posthog', () => ({
  __esModule: true,
  posthog: { capture: jest.fn() },
}));

jest.mock('@/components/landing/LoadingState', () => ({
  __esModule: true,
  LoadingState: () => <div data-testid="loading-state">Analyzing your resume</div>,
}));

const longJobDescription = Array(12)
  .fill('Senior product engineer role requiring SwiftUI TypeScript analytics experimentation collaboration measurable impact')
  .join(' ');

function changeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set;
  const prototype = element instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

  if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
    prototypeValueSetter.call(element, value);
  } else {
    element.value = value;
  }

  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

async function flushReact() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('FreeATSChecker failure handling', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    window.localStorage.clear();
    Object.assign(globalThis.crypto, {
      randomUUID: () => 'session-1',
    });
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Server says the job description is too thin.' }),
    } as Response)) as unknown as typeof fetch;
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    jest.restoreAllMocks();
  });

  it('shows the server error verbatim and keeps the selected file and job description', async () => {
    const { FreeATSChecker } = require('@/components/landing/FreeATSChecker');

    await act(async () => {
      root.render(<FreeATSChecker />);
    });

    const fileInput = container.querySelector('[data-testid="resume-upload"]') as HTMLInputElement;
    const jobDescriptionInput = container.querySelector('[data-testid="job-description-input"]') as HTMLTextAreaElement;
    const resumeFile = new File(['%PDF test'], 'nadav-resume.pdf', { type: 'application/pdf' });

    await act(async () => {
      Object.defineProperty(fileInput, 'files', {
        value: [resumeFile],
        configurable: true,
      });
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      changeValue(jobDescriptionInput, longJobDescription);
    });
    await flushReact();

    const analyzeButton = container.querySelector('[data-testid="analyze-button"]') as HTMLButtonElement;
    expect(analyzeButton.disabled).toBe(false);

    await act(async () => {
      container.querySelector('form')?.dispatchEvent(new Event('submit', {
        bubbles: true,
        cancelable: true,
      }));
    });
    await flushReact();

    expect(container.textContent).toContain('Server says the job description is too thin.');
    expect(container.textContent).toContain('Selected file: nadav-resume.pdf');
    expect((container.querySelector('[data-testid="job-description-input"]') as HTMLTextAreaElement).value)
      .toBe(longJobDescription);
  });
});
