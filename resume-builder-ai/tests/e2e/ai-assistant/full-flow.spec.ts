
import { test, expect } from '@playwright/test';

test.describe('AI Assistant Full Flow', () => {
  test('should complete the full AI assistant flow', async ({ page }) => {
    // 1. Navigate to the optimization detail page
    //    Assuming an optimization with ID 1 exists for testing purposes.
    await page.goto('/dashboard/optimizations/1');

    // 2. Click the "Open AI Assistant" button
    await page.click('button[aria-label="Open AI Assistant"]');

    // 3. Verify the sidebar opens with the Content tab active
    const assistantSidebar = page.locator('div[aria-label="AI Resume Assistant"]');
    await expect(assistantSidebar).toBeVisible();
    const contentTab = assistantSidebar.locator('button[role="tab"]:has-text("Content")');
    await expect(contentTab).toHaveAttribute('data-state', 'active');

    // 4. Send a message "Make my second bullet point more impactful"
    const chatPanel = assistantSidebar.locator('div[aria-label="Chat Panel"]');
    await chatPanel.locator('textarea').fill('Make my second bullet point more impactful');
    await chatPanel.locator('button:has-text("Send")').click();

    // 5. Verify the AI response appears within 10 seconds (increased timeout for AI responses)
    const aiResponse = chatPanel.locator('.ai-message').last();
    await expect(aiResponse).toBeVisible({ timeout: 10000 });

    // 6. Verify the response is conversational
    await expect(aiResponse).toContainText(/Great|Let's|Here's/i); // Example conversational keywords

    // 7. Switch to the Design tab
    const designTab = assistantSidebar.locator('button[role="tab"]:has-text("Design")');
    await designTab.click();
    await expect(designTab).toHaveAttribute('data-state', 'active');

    // 8. Type "change background color to light gray" and click Apply Change
    const designPanel = assistantSidebar.locator('div[aria-label="Design Panel"]');
    await designPanel.locator('input[type="text"]').fill('change background color to light gray');
    await designPanel.locator('button:has-text("Apply")').click();

    // 9. Verify a success toast appears
    const successToast = page.locator('div[data-sonner-toast][data-type="success"]');
    await expect(successToast).toBeVisible();
    await expect(successToast).toContainText(/Design updated/i);

    // 10. Verify the design preview updates (check for gray background in DOM)
    const designRenderer = page.locator('div[data-testid="design-renderer"]');
    // This is a simplified check. A real test might check computed styles.
    await expect(designRenderer).toHaveAttribute('style', /background-color: lightgray/);

    // 11. Close the AI Assistant
    await assistantSidebar.locator('button[aria-label="Close"]').click();

    // 12. Verify the sidebar closes
    await expect(assistantSidebar).not.toBeVisible();
  });
});
