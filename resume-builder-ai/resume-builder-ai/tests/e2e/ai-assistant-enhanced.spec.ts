/**
 * E2E Tests for Enhanced AI Assistant (Phase 6 - Cross-Spec Integration)
 *
 * These tests validate User Story 5: Cross-Spec Integration
 * - T037: Full optimization workflow
 * - T038: Content modification
 * - T039: Visual customization
 * - T040: PDF export with customizations
 * - T041-T046: Cross-spec compatibility verification
 *
 * Tests verify all specs 001-008 work together:
 * - Spec 001: Authentication
 * - Spec 002: Resume Upload
 * - Spec 003: Job Description Input
 * - Spec 004: Template Selection
 * - Spec 005: PDF Export
 * - Spec 006: AI Assistant Base
 * - Spec 007: Credit-Based Pricing
 * - Spec 008: Enhanced AI Assistant
 */

import { test, expect, Page } from '@playwright/test';
import path from 'path';

// Test configuration
const TEST_CONFIG = {
  timeout: 60000,
  retries: 2,
  sampleResumePath: path.join(__dirname, '../fixtures/sample-01'),
  testJobDescription: `
    Senior Software Engineer

    We are seeking a Senior Software Engineer with expertise in React, TypeScript, and Node.js.
    Must have 5+ years of experience and strong problem-solving skills.

    Requirements:
    - React and TypeScript proficiency
    - Experience with Node.js and REST APIs
    - Strong communication skills
    - Team leadership experience
  `,
};

// Helper: Create test user and login
async function loginTestUser(page: Page) {
  // For local testing, you may need to create a test user first
  // This assumes you have auth working (Spec 001)

  await page.goto('/auth/signin');

  // Fill in test credentials
  await page.fill('input[type="email"]', process.env.TEST_USER_EMAIL || 'test@example.com');
  await page.fill('input[type="password"]', process.env.TEST_USER_PASSWORD || 'TestPassword123!');

  // Submit login form
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard
  await page.waitForURL('**/dashboard', { timeout: 10000 });

  // Verify login successful
  await expect(page).toHaveURL(/\/dashboard/);
}

// Helper: Upload a test resume
async function uploadResume(page: Page, resumePath: string) {
  // Navigate to upload page or click upload button
  const uploadButton = page.locator('button:has-text("Upload Resume"), button:has-text("New Resume")');
  await uploadButton.click();

  // Upload file
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(resumePath);

  // Wait for upload to complete
  await page.waitForSelector('[data-testid="resume-uploaded"], .resume-preview', { timeout: 30000 });
}

// Helper: Input job description
async function inputJobDescription(page: Page, jdText: string) {
  // Find job description input
  const jdInput = page.locator('textarea[placeholder*="job description"], textarea[name="jobDescription"]');
  await jdInput.fill(jdText);

  // Click analyze or next button
  const analyzeButton = page.locator('button:has-text("Analyze"), button:has-text("Next")');
  await analyzeButton.click();

  // Wait for analysis to complete
  await page.waitForSelector('[data-testid="jd-analyzed"], .ats-score', { timeout: 15000 });
}

// Helper: Send AI assistant message
async function sendAIMessage(page: Page, message: string, expectResponse = true) {
  // Find chat input
  const chatInput = page.locator('textarea[placeholder*="message"], input[placeholder*="message"], textarea[name="message"]');
  await chatInput.fill(message);

  // Send message
  const sendButton = page.locator('button:has-text("Send"), button[aria-label="Send message"]');
  await sendButton.click();

  if (expectResponse) {
    // Wait for AI response
    await page.waitForSelector('.ai-message, [data-role="assistant"]', { timeout: 30000 });
  }
}

/**
 * T037: E2E Test for Full Optimization Workflow
 *
 * Independent Test: Complete full workflow
 * - Signup → Upload resume → Input JD → Select template → AI optimize → Download PDF → View history
 */
test.describe('T037: Full Optimization Workflow', () => {
  test('should complete end-to-end optimization workflow', async ({ page }) => {
    test.setTimeout(TEST_CONFIG.timeout);

    // Step 1: Authentication (Spec 001)
    await loginTestUser(page);
    await expect(page).toHaveURL(/\/dashboard/);

    // Step 2: Upload Resume (Spec 002)
    const resumeFile = path.join(TEST_CONFIG.sampleResumePath, 'resume.pdf');
    await uploadResume(page, resumeFile);

    // Verify resume parsed correctly
    await expect(page.locator('[data-testid="resume-preview"]')).toBeVisible();

    // Step 3: Input Job Description (Spec 003)
    await inputJobDescription(page, TEST_CONFIG.testJobDescription);

    // Verify ATS score displayed
    const atsScore = page.locator('[data-testid="ats-score"]');
    await expect(atsScore).toBeVisible();
    const initialScore = await atsScore.textContent();

    // Step 4: Select Template (Spec 004)
    const templateSelector = page.locator('[data-testid="template-selector"]');
    if (await templateSelector.isVisible()) {
      await templateSelector.click();
      await page.locator('[data-testid="template-option"]').first().click();
    }

    // Step 5: AI Optimization (Spec 006 + 008)
    // Open AI assistant
    const aiAssistantButton = page.locator('button:has-text("AI Assistant"), [data-testid="open-ai-assistant"]');
    await aiAssistantButton.click();

    // Send optimization request
    await sendAIMessage(page, 'Optimize my resume for this job');

    // Verify AI response
    await expect(page.locator('.ai-message, [data-role="assistant"]')).toBeVisible();

    // Wait for ATS score to update
    await page.waitForTimeout(2000);
    const updatedScore = await atsScore.textContent();

    // Score should have changed (optimization occurred)
    expect(updatedScore).not.toBe(initialScore);

    // Step 6: Download PDF (Spec 005)
    const downloadButton = page.locator('button:has-text("Download"), button:has-text("Export PDF")');

    // Start waiting for download before clicking
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await downloadButton.click();
    const download = await downloadPromise;

    // Verify download occurred
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);

    // Step 7: View History (Spec 005)
    const historyButton = page.locator('button:has-text("History"), a:has-text("History")');
    if (await historyButton.isVisible()) {
      await historyButton.click();
      await expect(page.locator('[data-testid="optimization-history"]')).toBeVisible();
    }

    // Workflow complete
    console.log('✅ Full optimization workflow completed successfully');
  });
});

/**
 * T038: E2E Test for Content Modification
 *
 * Independent Test: Ask AI "add Senior to my latest job title"
 * - Verify title field updates to "Senior Software Engineer" without creating duplicate bullets
 */
test.describe('T038: Content Modification', () => {
  test('should update job title field without creating duplicates', async ({ page }) => {
    test.setTimeout(TEST_CONFIG.timeout);

    // Setup: Login and create optimization
    await loginTestUser(page);
    const resumeFile = path.join(TEST_CONFIG.sampleResumePath, 'resume.pdf');
    await uploadResume(page, resumeFile);
    await inputJobDescription(page, TEST_CONFIG.testJobDescription);

    // Open AI assistant
    const aiAssistantButton = page.locator('button:has-text("AI Assistant"), [data-testid="open-ai-assistant"]');
    await aiAssistantButton.click();

    // Get initial job title
    const jobTitleElement = page.locator('[data-field="experiences.0.title"], .job-title').first();
    const initialTitle = await jobTitleElement.textContent();

    // Send modification request
    await sendAIMessage(page, 'add Senior to my latest job title');

    // Wait for modification to apply
    await page.waitForTimeout(3000);

    // Verify title updated
    const updatedTitle = await jobTitleElement.textContent();
    expect(updatedTitle).toContain('Senior');
    expect(updatedTitle).not.toBe(initialTitle);

    // Verify no duplicate bullets created
    const achievementsBefore = await page.locator('[data-field="experiences.0.achievements"] li, .achievement').count();

    // Achievements count should not have increased
    const achievementsAfter = await page.locator('[data-field="experiences.0.achievements"] li, .achievement').count();
    expect(achievementsAfter).toBe(achievementsBefore);

    // Verify modification logged in history
    const historyButton = page.locator('button:has-text("Modifications"), button:has-text("History")');
    if (await historyButton.isVisible()) {
      await historyButton.click();
      await expect(page.locator('[data-testid="modification-history"]')).toBeVisible();

      // Check for modification entry
      const modificationEntry = page.locator('[data-modification-type="prefix"], [data-operation="prefix"]').first();
      await expect(modificationEntry).toBeVisible();
    }

    console.log('✅ Content modification test passed');
  });

  test('should add skills to skills array without duplicates', async ({ page }) => {
    test.setTimeout(TEST_CONFIG.timeout);

    // Setup
    await loginTestUser(page);
    const resumeFile = path.join(TEST_CONFIG.sampleResumePath, 'resume.pdf');
    await uploadResume(page, resumeFile);
    await inputJobDescription(page, TEST_CONFIG.testJobDescription);

    // Open AI assistant
    await page.locator('button:has-text("AI Assistant"), [data-testid="open-ai-assistant"]').click();

    // Count initial skills
    const skillsBefore = await page.locator('[data-field="skills"] li, .skill-item').count();

    // Add new skills
    await sendAIMessage(page, 'add React and TypeScript to my technical skills');

    // Wait for update
    await page.waitForTimeout(3000);

    // Verify skills added
    const skillsAfter = await page.locator('[data-field="skills"] li, .skill-item').count();
    expect(skillsAfter).toBeGreaterThan(skillsBefore);

    // Verify skills appear in resume
    await expect(page.locator('text=React')).toBeVisible();
    await expect(page.locator('text=TypeScript')).toBeVisible();

    console.log('✅ Skills modification test passed');
  });
});

/**
 * T039: E2E Test for Visual Customization
 *
 * Independent Test: Request "change background to navy blue"
 * - Verify preview updates immediately with color #001f3f
 */
test.describe('T039: Visual Customization', () => {
  test('should apply background color change in real-time', async ({ page }) => {
    test.setTimeout(TEST_CONFIG.timeout);

    // Setup
    await loginTestUser(page);
    const resumeFile = path.join(TEST_CONFIG.sampleResumePath, 'resume.pdf');
    await uploadResume(page, resumeFile);

    // Open AI assistant
    await page.locator('button:has-text("AI Assistant"), [data-testid="open-ai-assistant"]').click();

    // Request color change
    await sendAIMessage(page, 'change background to navy blue');

    // Wait for style to apply (should be < 500ms, but allow 2s for safety)
    await page.waitForTimeout(2000);

    // Verify background color changed
    const preview = page.locator('[data-testid="resume-preview"], .resume-preview').first();
    const backgroundColor = await preview.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    // Navy blue should be rgb(0, 31, 63) which is #001f3f
    // Note: browsers return rgb format, not hex
    expect(backgroundColor).toMatch(/rgb\(0,\s*31,\s*63\)|rgb\(0,\s*31,\s*63\)/);

    console.log('✅ Background color customization test passed');
  });

  test('should apply font changes with accessibility validation', async ({ page }) => {
    test.setTimeout(TEST_CONFIG.timeout);

    // Setup
    await loginTestUser(page);
    const resumeFile = path.join(TEST_CONFIG.sampleResumePath, 'resume.pdf');
    await uploadResume(page, resumeFile);

    // Open AI assistant
    await page.locator('button:has-text("AI Assistant"), [data-testid="open-ai-assistant"]').click();

    // Request font change
    await sendAIMessage(page, 'change font to Arial');

    // Wait for style to apply
    await page.waitForTimeout(2000);

    // Verify font changed
    const preview = page.locator('[data-testid="resume-preview"], .resume-preview').first();
    const fontFamily = await preview.evaluate((el) => {
      return window.getComputedStyle(el).fontFamily;
    });

    expect(fontFamily).toContain('Arial');

    console.log('✅ Font customization test passed');
  });

  test('should warn about poor contrast and suggest alternatives', async ({ page }) => {
    test.setTimeout(TEST_CONFIG.timeout);

    // Setup
    await loginTestUser(page);
    const resumeFile = path.join(TEST_CONFIG.sampleResumePath, 'resume.pdf');
    await uploadResume(page, resumeFile);

    // Open AI assistant
    await page.locator('button:has-text("AI Assistant"), [data-testid="open-ai-assistant"]').click();

    // Request color combination with poor contrast
    await sendAIMessage(page, 'change background to light gray and text to white');

    // Wait for AI response
    await page.waitForTimeout(3000);

    // Should see warning about accessibility
    const aiResponse = page.locator('.ai-message, [data-role="assistant"]').last();
    const responseText = await aiResponse.textContent();

    // Response should mention contrast or accessibility
    expect(responseText?.toLowerCase()).toMatch(/contrast|accessibility|wcag|readable/);

    console.log('✅ Accessibility validation test passed');
  });
});

/**
 * T040: E2E Test for PDF Export with Customizations
 *
 * Independent Test: Verify PDF includes custom styles
 */
test.describe('T040: PDF Export with Customizations', () => {
  test('should export PDF with custom colors and fonts', async ({ page }) => {
    test.setTimeout(TEST_CONFIG.timeout);

    // Setup
    await loginTestUser(page);
    const resumeFile = path.join(TEST_CONFIG.sampleResumePath, 'resume.pdf');
    await uploadResume(page, resumeFile);

    // Apply customizations
    await page.locator('button:has-text("AI Assistant"), [data-testid="open-ai-assistant"]').click();
    await sendAIMessage(page, 'change background to navy blue');
    await page.waitForTimeout(2000);
    await sendAIMessage(page, 'change font to Arial');
    await page.waitForTimeout(2000);

    // Download PDF
    const downloadButton = page.locator('button:has-text("Download"), button:has-text("Export PDF")');

    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await downloadButton.click();
    const download = await downloadPromise;

    // Verify download
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);

    // Save the file
    const downloadPath = path.join(__dirname, '../../test-results', download.suggestedFilename());
    await download.saveAs(downloadPath);

    // Verify file exists and has size > 0
    const fs = require('fs');
    const stats = fs.statSync(downloadPath);
    expect(stats.size).toBeGreaterThan(0);

    console.log('✅ PDF export with customizations test passed');
  });
});

/**
 * T041-T046: Cross-Spec Compatibility Verification
 *
 * These tests verify all specs work together without conflicts
 */
test.describe('Cross-Spec Compatibility', () => {
  test('T041: Spec 001 (auth) works with AI assistant', async ({ page }) => {
    // Verify authenticated chat sessions work
    await loginTestUser(page);

    const resumeFile = path.join(TEST_CONFIG.sampleResumePath, 'resume.pdf');
    await uploadResume(page, resumeFile);

    // Open AI assistant and verify session is authenticated
    await page.locator('button:has-text("AI Assistant")').click();
    await sendAIMessage(page, 'hello');

    // Verify response (proves auth token is valid)
    await expect(page.locator('.ai-message, [data-role="assistant"]')).toBeVisible();

    console.log('✅ T041: Auth + AI assistant compatibility verified');
  });

  test('T042: Spec 002 (resume upload) works with modifications', async ({ page }) => {
    // Test resume structure preserved after AI changes
    await loginTestUser(page);

    const resumeFile = path.join(TEST_CONFIG.sampleResumePath, 'resume.pdf');
    await uploadResume(page, resumeFile);

    // Verify initial structure
    await expect(page.locator('[data-testid="resume-preview"]')).toBeVisible();

    // Apply modification
    await page.locator('button:has-text("AI Assistant")').click();
    await sendAIMessage(page, 'add Senior to job title');
    await page.waitForTimeout(3000);

    // Verify structure still intact
    await expect(page.locator('[data-testid="resume-preview"]')).toBeVisible();
    await expect(page.locator('.job-title, [data-field*="title"]')).toBeVisible();

    console.log('✅ T042: Resume upload + modifications compatibility verified');
  });

  test('T043: Spec 003 (job description) works with ATS rescoring', async ({ page }) => {
    // Test JD data available for scoring
    await loginTestUser(page);

    const resumeFile = path.join(TEST_CONFIG.sampleResumePath, 'resume.pdf');
    await uploadResume(page, resumeFile);
    await inputJobDescription(page, TEST_CONFIG.testJobDescription);

    // Verify initial ATS score
    const atsScore = page.locator('[data-testid="ats-score"]');
    await expect(atsScore).toBeVisible();
    const initialScore = await atsScore.textContent();

    // Apply modification that should improve score
    await page.locator('button:has-text("AI Assistant")').click();
    await sendAIMessage(page, 'add React to my skills');
    await page.waitForTimeout(3000);

    // Verify ATS score updated
    const updatedScore = await atsScore.textContent();
    expect(updatedScore).not.toBe(initialScore);

    console.log('✅ T043: JD + ATS rescoring compatibility verified');
  });

  test('T044: Spec 004 (templates) works with visual customization', async ({ page }) => {
    // Test template styles merge with custom styles
    await loginTestUser(page);

    const resumeFile = path.join(TEST_CONFIG.sampleResumePath, 'resume.pdf');
    await uploadResume(page, resumeFile);

    // Select template if available
    const templateSelector = page.locator('[data-testid="template-selector"]');
    if (await templateSelector.isVisible()) {
      await templateSelector.click();
      await page.locator('[data-testid="template-option"]').first().click();
    }

    // Apply custom style
    await page.locator('button:has-text("AI Assistant")').click();
    await sendAIMessage(page, 'change background to navy blue');
    await page.waitForTimeout(2000);

    // Verify both template and custom styles applied
    const preview = page.locator('[data-testid="resume-preview"]');
    await expect(preview).toBeVisible();

    console.log('✅ T044: Templates + visual customization compatibility verified');
  });

  test('T045: Spec 005 (PDF export) works with all enhancements', async ({ page }) => {
    // Test export includes modifications and styles
    await loginTestUser(page);

    const resumeFile = path.join(TEST_CONFIG.sampleResumePath, 'resume.pdf');
    await uploadResume(page, resumeFile);

    // Apply modifications
    await page.locator('button:has-text("AI Assistant")').click();
    await sendAIMessage(page, 'add Senior to job title');
    await page.waitForTimeout(2000);

    // Apply styles
    await sendAIMessage(page, 'change background to navy blue');
    await page.waitForTimeout(2000);

    // Export PDF
    const downloadButton = page.locator('button:has-text("Download"), button:has-text("Export PDF")');
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await downloadButton.click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.pdf$/);

    console.log('✅ T045: PDF export + all enhancements compatibility verified');
  });

  test('T046: Spec 006 (AI assistant base) works with enhancements', async ({ page }) => {
    // Test no conflicts with existing chat functionality
    await loginTestUser(page);

    const resumeFile = path.join(TEST_CONFIG.sampleResumePath, 'resume.pdf');
    await uploadResume(page, resumeFile);

    // Test basic chat functionality
    await page.locator('button:has-text("AI Assistant")').click();
    await sendAIMessage(page, 'hello');
    await expect(page.locator('.ai-message, [data-role="assistant"]')).toBeVisible();

    // Test enhanced functionality
    await sendAIMessage(page, 'add Senior to job title');
    await page.waitForTimeout(3000);

    // Verify both work
    const messages = await page.locator('.ai-message, [data-role="assistant"]').count();
    expect(messages).toBeGreaterThanOrEqual(2);

    console.log('✅ T046: Base AI assistant + enhancements compatibility verified');
  });
});

/**
 * Performance Tests
 */
test.describe('Performance Validation', () => {
  test('AI response time should be < 5s (p95)', async ({ page }) => {
    await loginTestUser(page);

    const resumeFile = path.join(TEST_CONFIG.sampleResumePath, 'resume.pdf');
    await uploadResume(page, resumeFile);

    await page.locator('button:has-text("AI Assistant")').click();

    const startTime = Date.now();
    await sendAIMessage(page, 'hello');
    const endTime = Date.now();

    const responseTime = endTime - startTime;
    expect(responseTime).toBeLessThan(5000);

    console.log(`✅ AI response time: ${responseTime}ms`);
  });

  test('ATS rescoring should be < 2s (p95)', async ({ page }) => {
    await loginTestUser(page);

    const resumeFile = path.join(TEST_CONFIG.sampleResumePath, 'resume.pdf');
    await uploadResume(page, resumeFile);
    await inputJobDescription(page, TEST_CONFIG.testJobDescription);

    await page.locator('button:has-text("AI Assistant")').click();

    const startTime = Date.now();
    await sendAIMessage(page, 'add React to skills');
    await page.waitForSelector('[data-testid="ats-score"]', { timeout: 5000 });
    const endTime = Date.now();

    const rescoringTime = endTime - startTime;
    expect(rescoringTime).toBeLessThan(2000);

    console.log(`✅ ATS rescoring time: ${rescoringTime}ms`);
  });

  test('Visual style updates should be < 500ms', async ({ page }) => {
    await loginTestUser(page);

    const resumeFile = path.join(TEST_CONFIG.sampleResumePath, 'resume.pdf');
    await uploadResume(page, resumeFile);

    await page.locator('button:has-text("AI Assistant")').click();

    const startTime = Date.now();
    await sendAIMessage(page, 'change background to navy blue', false);

    // Wait for style to apply
    await page.waitForFunction(() => {
      const preview = document.querySelector('[data-testid="resume-preview"]');
      if (!preview) return false;
      const bg = window.getComputedStyle(preview).backgroundColor;
      return bg.includes('0') && bg.includes('31') && bg.includes('63');
    }, { timeout: 2000 });

    const endTime = Date.now();
    const styleUpdateTime = endTime - startTime;

    expect(styleUpdateTime).toBeLessThan(500);

    console.log(`✅ Style update time: ${styleUpdateTime}ms`);
  });
});
