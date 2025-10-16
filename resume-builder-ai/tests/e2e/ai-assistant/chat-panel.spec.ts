
import { test, expect } from '@playwright/test';

test.describe('AI Assistant Chat Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/optimizations/1');
    await page.click('button[aria-label="Open AI Assistant"]');
  });

  test('displays empty state with example prompts', async ({ page }) => {
    const chatPanel = page.locator('div[aria-label="Chat Panel"]');
    await expect(chatPanel.locator('text=Make my second bullet point more impactful')).toBeVisible();
    await expect(chatPanel.locator('text=Add project management keywords')).toBeVisible();
  });

  test('sending a clear request gets a response', async ({ page }) => {
    const chatPanel = page.locator('div[aria-label="Chat Panel"]');
    await chatPanel.locator('textarea').fill('Rewrite my summary to be more concise');
    await chatPanel.locator('button:has-text("Send")').click();
    const aiResponse = chatPanel.locator('.ai-message').last();
    await expect(aiResponse).toBeVisible({ timeout: 10000 });
    await expect(aiResponse).not.toContainText(/Which section/i);
  });

  test('sending a vague request triggers a clarifying question', async ({ page }) => {
    const chatPanel = page.locator('div[aria-label="Chat Panel"]');
    await chatPanel.locator('textarea').fill('make it better');
    await chatPanel.locator('button:has-text("Send")').click();
    const aiResponse = chatPanel.locator('.ai-message').last();
    await expect(aiResponse).toBeVisible({ timeout: 10000 });
    await expect(aiResponse).toContainText(/Which section would you like to improve?/i);
  });

  test('Enter sends message, Shift+Enter creates a new line', async ({ page }) => {
    const chatPanel = page.locator('div[aria-label="Chat Panel"]');
    const textarea = chatPanel.locator('textarea');
    
    await textarea.fill('First line');
    await textarea.press('Shift+Enter');
    await textarea.type('Second line');
    await expect(textarea).toHaveValue('First line\nSecond line');

    await textarea.press('Enter');
    const aiResponse = chatPanel.locator('.ai-message').last();
    await expect(aiResponse).toBeVisible({ timeout: 10000 });
  });

  test('handles network failure gracefully', async ({ page }) => {
    await page.route('**/api/v1/chat', route => route.abort());
    const chatPanel = page.locator('div[aria-label="Chat Panel"]');
    await chatPanel.locator('textarea').fill('This will fail');
    await chatPanel.locator('button:has-text("Send")').click();
    const errorToast = page.locator('div[data-sonner-toast][data-type="error"]');
    await expect(errorToast).toBeVisible();
    await expect(errorToast).toContainText(/Failed to send message/i);
  });

  test('handles rate limiting', async ({ page }) => {
    await page.route('**/api/v1/chat', route => {
      route.fulfill({
        status: 429,
        body: JSON.stringify({ error: 'Too many requests' }),
      });
    });

    const chatPanel = page.locator('div[aria-label="Chat Panel"]');
    await chatPanel.locator('textarea').fill('Rate limit test');
    await chatPanel.locator('button:has-text("Send")').click();

    const errorToast = page.locator('div[data-sonner-toast][data-type="error"]');
    await expect(errorToast).toBeVisible();
    await expect(errorToast).toContainText(/Too many requests/i);
  });
});
