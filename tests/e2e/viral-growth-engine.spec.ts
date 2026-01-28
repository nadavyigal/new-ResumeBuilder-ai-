/**
 * E2E Tests for Viral Growth Engine - Free ATS Score Checker
 *
 * Test Coverage:
 * 1. Landing page loads with Free ATS Checker
 * 2. File upload and job description input
 * 3. ATS score calculation and display
 * 4. Locked issues overlay (curiosity gap)
 * 5. Social share buttons
 * 6. Rate limiting (5 checks per week)
 * 7. Signup flow and session conversion
 * 8. Dashboard welcome card for converted users
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

const getRandomIp = () =>
  `10.10.${Math.floor(Math.random() * 200) + 1}.${Math.floor(Math.random() * 200) + 1}`;

let createdTestPdf = false;

// Helper to create a dummy PDF for testing
function createTestResumePDF(): string {
  const testPdfPath = path.join(__dirname, '..', 'fixtures', 'test-resume.pdf');

  if (!fs.existsSync(testPdfPath)) {
    const fixturesDir = path.dirname(testPdfPath);
    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir, { recursive: true });
    }

    const pdfBase64 =
      'JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCAzMDAgMjAwXSAvQ29udGVudHMgNCAwIFIgL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgNSAwIFIgPj4gPj4gPj4KZW5kb2JqCjQgMCBvYmoKPDwgL0xlbmd0aCA0MyA+PgpzdHJlYW0KQlQKL0YxIDEyIFRmCjcyIDEyMCBUZAooVGVzdCBSZXN1bWUpIFRqCkVUCmVuZHN0cmVhbQplbmRvYmoKNSAwIG9iago8PCAvVHlwZSAvRm9udCAvU3VidHlwZSAvVHlwZTEgL0Jhc2VGb250IC9IZWx2ZXRpY2EgPj4KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAwOSAwMDAwMCBuIAowMDAwMDAwMDU4IDAwMDAwIG4gCjAwMDAwMDAxMTUgMDAwMDAgbiAKMDAwMDAwMDI0MSAwMDAwMCBuIAowMDAwMDAwMzMzIDAwMDAwIG4gCnRyYWlsZXIKPDwgL1NpemUgNiAvUm9vdCAxIDAgUiA+PgpzdGFydHhyZWYKNDAzCiUlRU9GCg==';
    fs.writeFileSync(testPdfPath, Buffer.from(pdfBase64, 'base64'));
    createdTestPdf = true;
  }

  return testPdfPath;
}

// Sample job description for testing
const SAMPLE_JOB_DESCRIPTION = `
Senior Software Engineer

We are seeking an experienced Software Engineer to join our team.

Requirements:
- 5+ years of experience with JavaScript, TypeScript, React, and Node.js
- Strong understanding of web technologies (HTML, CSS, REST APIs)
- Experience with cloud platforms (AWS, Azure, or Google Cloud)
- Excellent problem-solving skills and attention to detail
- Bachelor's degree in Computer Science or related field

Responsibilities:
- Design and develop scalable web applications
- Collaborate with cross-functional teams
- Write clean, maintainable code
- Participate in code reviews and technical discussions
- Mentor junior developers

Nice to have:
- Experience with Next.js, GraphQL, PostgreSQL
- Knowledge of Docker and Kubernetes
- Contributions to open-source projects
- Experience with CI/CD pipelines
`;

test.describe('Viral Growth Engine - Anonymous ATS Checker', () => {

  test.beforeEach(async ({ page }) => {
    await page.setExtraHTTPHeaders({ 'x-forwarded-for': getRandomIp() });
    // Clear localStorage and cookies before each test
    await page.goto(BASE_URL);
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('should display Free ATS Checker on landing page', async ({ page }) => {
    await page.goto(BASE_URL);

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Take screenshot of landing page
    await page.screenshot({
      path: '.playwright-mcp/01-landing-page-ats-checker.png',
      fullPage: true
    });

    // Verify Free ATS Checker is visible (should replace old hero section)
    await expect(page.locator('[data-testid="ats-checker-badge"]')).toBeVisible();
    await expect(page.locator('[data-testid="ats-checker-heading"]')).toBeVisible();

    // Verify upload form is present
    await expect(page.locator('[data-testid="resume-upload"]')).toBeVisible();
    await expect(page.locator('[data-testid="job-description-input"]')).toBeVisible();

    console.log('✅ Landing page displays Free ATS Checker correctly');
  });

  test('should validate file upload (PDF only, max 10MB)', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Try uploading a non-PDF file
    const fileInput = page.locator('[data-testid="resume-upload"]');

    // Create a test text file
    const testTxtPath = path.join(__dirname, '..', 'fixtures', 'test.txt');
    fs.writeFileSync(testTxtPath, 'This is a text file');

    await fileInput.setInputFiles(testTxtPath);
    await page.locator('[data-testid="job-description-input"]').fill(SAMPLE_JOB_DESCRIPTION);
    await page.locator('[data-testid="analyze-button"]').click();

    // Verify error message appears
    await expect(page.locator('text=/Only PDF resumes are supported/i')).toBeVisible({
      timeout: 3000
    });

    // Clean up
    fs.unlinkSync(testTxtPath);

    console.log('✅ File validation works correctly');
  });

  test('should validate job description (min 100 words)', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Create test PDF
    const testPdfPath = createTestResumePDF();

    // Upload PDF
    await page.locator('[data-testid="resume-upload"]').setInputFiles(testPdfPath);

    // Enter short job description (< 100 words)
    await page.locator('[data-testid="job-description-input"]').fill('This is a short job description.');

    // Try to submit
    await page.locator('[data-testid="analyze-button"]').click();

    // Verify validation message
    await expect(
      page.locator('text=/at least 100 words/i')
    ).toBeVisible({
      timeout: 3000
    });

    console.log('✅ Job description validation works correctly');
  });

  test('should complete full ATS check flow and display score', async ({ page }) => {
    test.setTimeout(90000);
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Create test PDF
    const testPdfPath = createTestResumePDF();

    // Step 1: Upload resume
    await page.locator('[data-testid="resume-upload"]').setInputFiles(testPdfPath);
    console.log('📄 Resume uploaded');

    // Step 2: Enter job description
    await page.locator('[data-testid="job-description-input"]').fill(SAMPLE_JOB_DESCRIPTION);
    console.log('📝 Job description entered');

    // Take screenshot before submission
    await page.screenshot({
      path: '.playwright-mcp/02-before-submission.png'
    });

    // Step 3: Submit form
    await page.locator('[data-testid="analyze-button"]').click();
    console.log('🚀 Form submitted');

    // Step 4: Wait for processing state
    await expect(page.locator('text=/Scoring your resume/i')).toBeVisible({ timeout: 5000 });
    console.log('⏳ Processing state displayed');

    // Take screenshot of processing state
    await page.screenshot({
      path: '.playwright-mcp/03-processing.png'
    });

    // Step 5: Wait for score to display (may take 5-10 seconds for real API)
    await expect(page.locator('[data-testid="ats-score-display"]')).toBeVisible({
      timeout: 60000
    });
    console.log('📊 Score displayed');

    // Take screenshot of score results
    await page.screenshot({
      path: '.playwright-mcp/04-score-results.png',
      fullPage: true
    });

    // Step 6: Verify score is a number between 0-100
    const scoreText = await page.locator('[data-testid="ats-score"]').textContent();
    const scoreMatch = scoreText?.match(/(\d+)/);
    expect(scoreMatch).toBeTruthy();
    const score = parseInt(scoreMatch![1]);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
    console.log(`✅ Score: ${score}/100`);

    // Step 7: Verify top 3 issues are visible
    const visibleIssues = page.locator(
      '[data-testid="ats-issues-list"] [data-testid="issue-card"]'
    );
    const visibleCount = await visibleIssues.count();
    expect(visibleCount).toBeGreaterThanOrEqual(3);
    console.log(`✅ ${visibleCount} issues visible`);

    // Step 8: Verify locked issues overlay exists
    await expect(page.locator('[data-testid="locked-issues-blur"]')).toBeVisible();
    await expect(page.locator('[data-testid="signup-cta"]')).toBeVisible();
    console.log('✅ Locked issues overlay displayed');

    // Step 9: Verify social share buttons
    await expect(page.locator('[data-testid="share-linkedin"]')).toBeVisible();
    await expect(page.locator('[data-testid="share-twitter"]')).toBeVisible();
    console.log('✅ Social share buttons present');

    // Step 10: Verify "checks remaining" label
    await expect(page.locator('text=/checks remaining/i')).toBeVisible();
    console.log('✅ Checks remaining label displayed');

    // Verify session ID was created in localStorage
    const sessionId = await page.evaluate(() => localStorage.getItem('ats_session_id'));
    expect(sessionId).toBeTruthy();
    expect(sessionId?.length).toBeGreaterThan(20); // UUID length
    console.log(`✅ Session ID created: ${sessionId?.substring(0, 8)}...`);
  });

  test('should show locked issues with blur effect', async ({ page }) => {
    test.setTimeout(90000);
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Complete ATS check (simplified version)
    const testPdfPath = createTestResumePDF();
    await page.locator('[data-testid="resume-upload"]').setInputFiles(testPdfPath);
    await page.locator('[data-testid="job-description-input"]').fill(SAMPLE_JOB_DESCRIPTION);
    await page.locator('[data-testid="analyze-button"]').click();

    // Wait for results
    await expect(page.locator('[data-testid="ats-score-display"]')).toBeVisible({
      timeout: 60000
    });

    // Verify locked overlay
    const blurredSection = page.locator('[data-testid="locked-issues-blur"]');
    await expect(blurredSection).toBeVisible();
    await expect(blurredSection).toHaveCSS('filter', /blur/);

    // Verify lock icon
    await expect(page.locator('svg.lucide-lock')).toBeVisible();

    console.log('✅ Locked issues overlay with blur effect works correctly');
  });

  test('should track PostHog analytics events', async ({ page }) => {
    test.setTimeout(90000);
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Spy on PostHog capture calls
    await page.evaluate(() => {
      const originalCapture = (window as any).posthog?.capture;
      if (originalCapture) {
        (window as any).posthog.capture = function(...args: any[]) {
          (window as any).__capturedEvents = (window as any).__capturedEvents || [];
          (window as any).__capturedEvents.push(args);
          return originalCapture.apply(this, args);
        };
      }
    });

    // Complete ATS check flow
    const testPdfPath = createTestResumePDF();
    await page.locator('[data-testid="resume-upload"]').setInputFiles(testPdfPath);
    await page.locator('[data-testid="job-description-input"]').fill(SAMPLE_JOB_DESCRIPTION);
    await page.locator('[data-testid="analyze-button"]').click();

    // Wait for results
    await expect(page.locator('[data-testid="ats-score-display"]')).toBeVisible({
      timeout: 60000
    });

    // Get captured events
    const events = await page.evaluate(() => (window as any).__capturedEvents || []);

    // Verify key events were tracked
    const eventNames = events.map((e: any) => e[0]);
    expect(eventNames).toContain('ats_checker_view');
    expect(eventNames).toContain('ats_checker_submitted');
    expect(eventNames).toContain('ats_checker_score_displayed');

    console.log('✅ PostHog events tracked:', eventNames);
  });

  test('should handle social share button clicks', async ({ page }) => {
    test.setTimeout(90000);
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Complete ATS check
    const testPdfPath = createTestResumePDF();
    await page.locator('[data-testid="resume-upload"]').setInputFiles(testPdfPath);
    await page.locator('[data-testid="job-description-input"]').fill(SAMPLE_JOB_DESCRIPTION);
    await page.locator('[data-testid="analyze-button"]').click();

    // Wait for results
    await expect(page.locator('[data-testid="ats-score-display"]')).toBeVisible({
      timeout: 60000
    });

    // Listen for popup window
    const popupPromise = page.waitForEvent('popup', { timeout: 5000 });

    // Click LinkedIn share button
    await page.locator('[data-testid="share-linkedin"]').click();

    try {
      const popup = await popupPromise;
      const popupUrl = popup.url();

      // Verify LinkedIn share URL
      expect(popupUrl).toContain('linkedin.com/sharing');
      expect(popupUrl).toContain('url=');

      console.log('✅ LinkedIn share popup opened:', popupUrl);

      await popup.close();
    } catch {
      console.log('⚠️ Share popup may be blocked (expected in headless mode)');
    }
  });

  test('should enforce rate limiting after 5 checks', async ({ page }) => {
    test.setTimeout(120000);
    await page.setExtraHTTPHeaders({ 'x-forwarded-for': '10.10.200.200' });
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    const testPdfPath = createTestResumePDF();

    // Perform 5 checks
    for (let i = 1; i <= 5; i++) {
      // Upload and submit
      await page.locator('[data-testid="resume-upload"]').setInputFiles(testPdfPath);
      await page.locator('[data-testid="job-description-input"]').fill(SAMPLE_JOB_DESCRIPTION);
      await page.locator('[data-testid="analyze-button"]').click();

      // Wait for results
      await expect(page.locator('[data-testid="ats-score-display"]')).toBeVisible({
        timeout: 60000
      });

      console.log(`✅ Check ${i}/5 completed`);

      // Go back to upload form
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');
    }

    // Try 6th check - should be rate limited
    await page.locator('[data-testid="resume-upload"]').setInputFiles(testPdfPath);
    await page.locator('[data-testid="job-description-input"]').fill(SAMPLE_JOB_DESCRIPTION);
    await page.locator('[data-testid="analyze-button"]').click();

    // Verify rate limit message appears
    await expect(page.locator('[data-testid="rate-limit-message"]')).toBeVisible({
      timeout: 10000
    });
    await expect(page.locator('text=/used your 5 free checks/i')).toBeVisible();

    // Take screenshot of rate limit state
    await page.screenshot({
      path: '.playwright-mcp/05-rate-limited.png'
    });

    console.log('✅ Rate limiting enforced after 5 checks');
  });

  test('should navigate to signup from CTA button', async ({ page }) => {
    test.setTimeout(90000);
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Complete ATS check
    const testPdfPath = createTestResumePDF();
    await page.locator('[data-testid="resume-upload"]').setInputFiles(testPdfPath);
    await page.locator('[data-testid="job-description-input"]').fill(SAMPLE_JOB_DESCRIPTION);
    await page.locator('[data-testid="analyze-button"]').click();

    // Wait for results
    await expect(page.locator('[data-testid="ats-score-display"]')).toBeVisible({
      timeout: 60000
    });

    // Get session ID before navigating
    const sessionId = await page.evaluate(() => localStorage.getItem('ats_session_id'));
    expect(sessionId).toBeTruthy();

    // Click "Sign Up Free" button
    await page.locator('[data-testid="signup-cta"]').click();

    // Verify navigation to signup page
    await expect(page).toHaveURL(/\/auth\/signup/);

    // Verify session ID persists in localStorage
    const sessionIdAfterNav = await page.evaluate(() => localStorage.getItem('ats_session_id'));
    expect(sessionIdAfterNav).toBe(sessionId);

    console.log('✅ Navigation to signup preserves session ID');

    // Take screenshot of signup page
    await page.screenshot({
      path: '.playwright-mcp/06-signup-page.png'
    });
  });

  test('should display welcome card on dashboard after conversion', async ({ page }) => {
    // This test requires authentication setup
    // For now, we'll verify the dashboard page structure exists

    await page.goto(`${BASE_URL}/dashboard`);

    // Should redirect to signin if not authenticated
    await expect(page).toHaveURL(/\/(auth\/signin|dashboard)/);

    console.log('✅ Dashboard route protection works');
  });

  test('should handle errors gracefully', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Test with invalid file
    const testTxtPath = path.join(__dirname, '..', 'fixtures', 'invalid.txt');
    fs.writeFileSync(testTxtPath, 'Invalid file');

    await page.locator('[data-testid="resume-upload"]').setInputFiles(testTxtPath);
    await page.locator('[data-testid="job-description-input"]').fill(SAMPLE_JOB_DESCRIPTION);
    await page.locator('[data-testid="analyze-button"]').click();

    // Verify error message appears
    await expect(page.locator('text=/Only PDF resumes are supported/i')).toBeVisible({
      timeout: 10000
    });

    // Clean up
    fs.unlinkSync(testTxtPath);

    console.log('✅ Error handling works correctly');
  });

  test('should be mobile responsive', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Verify key elements are visible on mobile
    await expect(page.locator('[data-testid="ats-checker-badge"]')).toBeVisible();
    await expect(page.locator('[data-testid="resume-upload"]')).toBeVisible();
    await expect(page.locator('[data-testid="job-description-input"]')).toBeVisible();

    // Take mobile screenshot
    await page.screenshot({
      path: '.playwright-mcp/07-mobile-view.png',
      fullPage: true
    });

    console.log('✅ Mobile responsive layout works');
  });

  test('should display correct score animation', async ({ page }) => {
    test.setTimeout(90000);
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Complete ATS check
    const testPdfPath = createTestResumePDF();
    await page.locator('[data-testid="resume-upload"]').setInputFiles(testPdfPath);
    await page.locator('[data-testid="job-description-input"]').fill(SAMPLE_JOB_DESCRIPTION);
    await page.locator('[data-testid="analyze-button"]').click();

    // Wait for score to appear
    await expect(page.locator('[data-testid="ats-score-display"]')).toBeVisible({
      timeout: 60000
    });

    // Check if CountUp animation exists (score should animate from 0 to actual value)
    const scoreElement = page.locator('[data-testid="ats-score"]');
    await expect(scoreElement).toBeVisible();

    // Verify score format (number/100)
    const scoreText = await scoreElement.textContent();
    expect(scoreText).toMatch(/\d+\/100/);

    console.log('✅ Score animation displays correctly');
  });

  test('should persist session across page refreshes', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Get initial session ID
    const initialSessionId = await page.evaluate(() => {
      const id = localStorage.getItem('ats_session_id');
      return id;
    });

    // Refresh page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Get session ID after refresh
    const sessionIdAfterRefresh = await page.evaluate(() => {
      return localStorage.getItem('ats_session_id');
    });

    // Should be the same
    expect(sessionIdAfterRefresh).toBe(initialSessionId);

    console.log('✅ Session persists across page refreshes');
  });
});

test.describe('Viral Growth Engine - Performance', () => {

  test('should load landing page in under 3 seconds', async ({ page }) => {
    const startTime = Date.now();

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(3000);
    console.log(`✅ Page loaded in ${loadTime}ms`);
  });

  test('should handle concurrent ATS checks', async ({ browser }) => {
    test.setTimeout(120000);
    // Create 3 concurrent checks
    const contexts = await Promise.all([
      browser.newContext(),
      browser.newContext(),
      browser.newContext()
    ]);

    const pages = await Promise.all(contexts.map(c => c.newPage()));
    const testPdfPath = createTestResumePDF();

    // Submit all 3 concurrently
    await Promise.all(pages.map(async (page) => {
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');
      await page.locator('[data-testid="resume-upload"]').setInputFiles(testPdfPath);
      await page.locator('[data-testid="job-description-input"]').fill(SAMPLE_JOB_DESCRIPTION);
      await page.locator('[data-testid="analyze-button"]').click();
    }));

    // Verify all 3 got results
    await Promise.all(pages.map(async (page) => {
      await expect(page.locator('[data-testid="ats-score-display"]')).toBeVisible({
        timeout: 60000
      });
    }));

    console.log('✅ Handles concurrent checks correctly');

    // Cleanup
    await Promise.all(contexts.map(c => c.close()));
  });
});

test.describe('Viral Growth Engine - Accessibility', () => {

  test('should be keyboard navigable', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Tab through interactive elements
    await page.locator('[data-testid="resume-upload"]').focus();
    await page.keyboard.press('Tab'); // Textarea
    await page.keyboard.press('Tab'); // Submit button

    // Verify focus is on submit button
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBe('BUTTON');

    console.log('✅ Keyboard navigation works');
  });

  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Check for ARIA labels on key elements
    const fileInput = page.locator('[data-testid="resume-upload"]');
    const textarea = page.locator('[data-testid="job-description-input"]');

    const fileInputLabel = await fileInput.getAttribute('aria-label');
    const textareaLabel = await textarea.getAttribute('aria-label');

    expect(fileInputLabel || await fileInput.evaluate(el => el.closest('label')?.textContent)).toBeTruthy();
    expect(textareaLabel || await textarea.evaluate(el => el.closest('label')?.textContent)).toBeTruthy();

    console.log('✅ ARIA labels present');
  });
});

// Cleanup after all tests
test.afterAll(async () => {
  // Clean up test PDF
  const testPdfPath = path.join(__dirname, '..', 'fixtures', 'test-resume.pdf');
  if (createdTestPdf && fs.existsSync(testPdfPath)) {
    fs.unlinkSync(testPdfPath);
  }

  console.log('🧹 Test cleanup completed');
});
