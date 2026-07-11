import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const translations: Record<string, string> = {
  'landing.uploadForm.resumeLabel': 'Resume (PDF)',
  'landing.uploadForm.selectedFile': 'Selected file: {fileName}',
  'landing.uploadForm.dropzoneCta': 'Choose a file',
  'landing.uploadForm.fileConstraints': 'PDF only, up to 5MB. Processed privately, never stored.',
  'landing.uploadForm.jobDescriptionLabel': 'Job description',
  'landing.uploadForm.inputModes.text': 'Paste text',
  'landing.uploadForm.inputModes.url': 'From URL',
  'landing.uploadForm.placeholders.description': 'Paste the job description here...',
  'landing.uploadForm.placeholders.url': 'https://',
  'landing.uploadForm.minimumWords': 'Minimum {count} words',
  'landing.uploadForm.wordCount': '{count} words',
  'landing.uploadForm.urlHelper': 'Paste a public job post URL and we will fetch the description.',
  'landing.uploadForm.shortTextNudge': 'Short on text? Switch to "From URL" and paste the job link instead.',
  'landing.uploadForm.linkedinWarning': 'LinkedIn blocks automated fetch. Paste the description text instead for an accurate score.',
  'landing.uploadForm.checking': 'Running ATS check...',
  'landing.uploadForm.submit': 'Get my Match Score',
  'landing.uploadForm.invalidUrl': 'Enter a valid job post URL.',
  'landing.uploadForm.checklist.resume': 'Add your resume',
  'landing.uploadForm.checklist.job': 'Add a job description — 100+ words or a job link',
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

  it('shows both requirements at once and ticks each independently as satisfied', async () => {
    const { UploadForm } = require('@/components/landing/UploadForm');

    await act(async () => {
      root.render(<UploadForm onSubmit={jest.fn()} />);
    });

    const checklist = container.querySelector('[data-testid="submit-checklist"]') as HTMLElement;
    expect(checklist.textContent).toContain('Add your resume');
    expect(checklist.textContent).toContain('Add a job description');

    const items = Array.from(checklist.querySelectorAll('li'));
    expect(items[0].textContent).toContain('○');
    expect(items[1].textContent).toContain('○');

    const fileInput = container.querySelector('[data-testid="resume-upload"]') as HTMLInputElement;
    const resumeFile = new File(['%PDF test'], 'resume.pdf', { type: 'application/pdf' });
    await act(async () => {
      Object.defineProperty(fileInput, 'files', { value: [resumeFile], configurable: true });
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const itemsAfterFile = Array.from(
      (container.querySelector('[data-testid="submit-checklist"]') as HTMLElement).querySelectorAll('li')
    );
    expect(itemsAfterFile[0].textContent).toContain('✓');
    expect(itemsAfterFile[1].textContent).toContain('○');

    const longJobDescription = Array.from({ length: 120 }, () => 'word').join(' ');
    await act(async () => {
      changeValue(container.querySelector('[data-testid="job-description-input"]') as HTMLTextAreaElement, longJobDescription);
    });

    const itemsAfterJob = Array.from(
      (container.querySelector('[data-testid="submit-checklist"]') as HTMLElement).querySelectorAll('li')
    );
    expect(itemsAfterJob[0].textContent).toContain('✓');
    expect(itemsAfterJob[1].textContent).toContain('✓');
  });

  it('nudges short-text users toward the URL path once they start typing under the word minimum', async () => {
    const { UploadForm } = require('@/components/landing/UploadForm');

    await act(async () => {
      root.render(<UploadForm onSubmit={jest.fn()} />);
    });

    expect(container.textContent).not.toContain('Short on text?');

    await act(async () => {
      changeValue(container.querySelector('[data-testid="job-description-input"]') as HTMLTextAreaElement, 'too short');
    });

    expect(container.textContent).toContain('Short on text?');
  });

  it('warns when the job URL is a LinkedIn link', async () => {
    const { UploadForm } = require('@/components/landing/UploadForm');

    await act(async () => {
      root.render(<UploadForm onSubmit={jest.fn()} />);
    });

    await act(async () => {
      (container.querySelector('button[type="button"]') as HTMLButtonElement).parentElement
        ?.querySelectorAll('button')[1]
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const urlInput = container.querySelector('[data-testid="job-description-url-input"]') as HTMLInputElement;
    expect(urlInput).toBeTruthy();

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(urlInput, 'https://www.linkedin.com/jobs/view/12345');
      urlInput.dispatchEvent(new Event('input', { bubbles: true }));
      urlInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(container.textContent).toContain('LinkedIn blocks automated fetch');

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(urlInput, 'https://boards.greenhouse.io/example/jobs/12345');
      urlInput.dispatchEvent(new Event('input', { bubbles: true }));
      urlInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(container.textContent).not.toContain('LinkedIn blocks automated fetch');
  });
});