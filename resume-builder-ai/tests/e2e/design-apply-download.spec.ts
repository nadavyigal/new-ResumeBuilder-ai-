import { test, expect, Page } from '@playwright/test';
import path from 'path';

const TEST_CONFIG = {
  timeout: 60000,
  sampleResumePath: path.join(__dirname, '../fixtures/sample-01'),
  testJobDescription: `
    Senior Software Engineer

    We are seeking a Senior Software Engineer with expertise in React, TypeScript, and Node.js.
    Must have 5+ years of experience and strong problem-solving skills.
  `,
  templateName: 'Minimal Serif',
  templateSlug: 'minimal-ssr',
};

async function loginTestUser(page: Page) {
  await page.goto('/auth/signin');

  await page.fill('input[type="email"]', process.env.TEST_USER_EMAIL || 'test@example.com');
  await page.fill('input[type="password"]', process.env.TEST_USER_PASSWORD || 'TestPassword123!');

  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
}

async function uploadResume(page: Page, resumePath: string) {
  const uploadButton = page.locator('button:has-text("Upload Resume"), button:has-text("New Resume")');
  await uploadButton.click();

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(resumePath);

  await page.waitForSelector('[data-testid="resume-uploaded"], .resume-preview', { timeout: 30000 });
}

async function inputJobDescription(page: Page, jdText: string) {
  const jdInput = page.locator('textarea[placeholder*="job description"], textarea[name="jobDescription"]');
  await jdInput.fill(jdText);

  const analyzeButton = page.locator('button:has-text("Analyze"), button:has-text("Next")');
  await analyzeButton.click();

  await page.waitForSelector('[data-testid="ats-score"], .ats-score', { timeout: 30000 });
}

test.describe('Design Apply + Download', () => {
  test('should apply template and download HTML-rendered PDF', async ({ page }) => {
    test.setTimeout(TEST_CONFIG.timeout);

    await loginTestUser(page);

    const resumeFile = path.join(TEST_CONFIG.sampleResumePath, 'resume.pdf');
    await uploadResume(page, resumeFile);
    await inputJobDescription(page, TEST_CONFIG.testJobDescription);

    await page.getByRole('button', { name: /Change Design/i }).click();

    const templateCard = page.getByRole('heading', { name: TEST_CONFIG.templateName }).first();
    await templateCard.click();

    const applyResponsePromise = page.waitForResponse((response) => {
      return response.url().includes('/api/v1/design/') && response.request().method() === 'POST';
    });

    await page.getByRole('button', { name: 'Apply This Template' }).click();

    const applyResponse = await applyResponsePromise;
    expect(applyResponse.ok()).toBeTruthy();

    const applyPayload = await applyResponse.json();
    expect(applyPayload.assignment?.template?.slug).toBe(TEST_CONFIG.templateSlug);

    await expect(page.getByText('Choose a Design')).toBeHidden();

    const downloadResponsePromise = page.waitForResponse((response) => {
      return response.url().includes('/api/download/') && response.request().method() === 'GET';
    });
    const downloadPromise = page.waitForEvent('download');

    await page.getByRole('button', { name: /Download/i }).click();

    const downloadResponse = await downloadResponsePromise;
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.pdf$/);

    const headers = downloadResponse.headers();
    expect(headers['x-resume-pdf-renderer']).toBe('html');
    expect(headers['x-resume-template']).toBe(TEST_CONFIG.templateSlug);
  });
});
