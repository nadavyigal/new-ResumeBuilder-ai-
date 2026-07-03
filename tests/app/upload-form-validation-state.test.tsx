import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const translations: Record<string, string> = {
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

function changeValue(element: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

jest.mock('next-intl', () => ({
  __esModule: true,
  useTranslations: (namespace?: string) => (key: string, values?: Record<string, unknown>) => {
    const fullKey = namespace ? `${namespace}.${key}` : key;
    return formatMessage(translations[fullKey] ?? fullKey, values);
  },
}));

describe('UploadForm validation state', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    jest.restoreAllMocks();
  });

  it('does not render the initial 0 word count as an error before input', async () => {
    const { UploadForm } = require('@/components/landing/UploadForm');

    await act(async () => {
      root.render(<UploadForm onSubmit={jest.fn()} />);
    });

    const wordCount = Array.from(container.querySelectorAll('span'))
      .find((node) => node.textContent === '0 words');

    expect(wordCount).toBeDefined();
    expect(wordCount?.className).not.toContain('text-destructive');

    await act(async () => {
      changeValue(container.querySelector('[data-testid="job-description-input"]') as HTMLTextAreaElement, 'too short');
    });

    const shortWordCount = Array.from(container.querySelectorAll('span'))
      .find((node) => node.textContent === '2 words');

    expect(shortWordCount?.className).toContain('text-destructive');
  });
});