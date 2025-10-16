
import { test, expect } from '@playwright/test';

test.describe('AI Assistant Design Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/optimizations/1');
    await page.click('button[aria-label="Open AI Assistant"]');
    const assistantSidebar = page.locator('div[aria-label="AI Resume Assistant"]');
    await assistantSidebar.locator('button[role="tab"]:has-text("Design")').click();
  });

  test('displays current template', async ({ page }) => {
    const designPanel = page.locator('div[aria-label="Design Panel"]');
    await expect(designPanel.locator('text=Current Template:')).toBeVisible();
    // Assuming a default template is applied for the test optimization
    await expect(designPanel.locator('text=Modern')).toBeVisible(); 
  });

  test('suggestion buttons populate input field', async ({ page }) => {
    const designPanel = page.locator('div[aria-label="Design Panel"]');
    const input = designPanel.locator('input[type="text"]');
    await designPanel.locator('button:has-text("Change header color to dark blue")').click();
    await expect(input).toHaveValue('Change header color to dark blue');
  });

  test('applies a color change request', async ({ page }) => {
    const designPanel = page.locator('div[aria-label="Design Panel"]');
    await designPanel.locator('input[type="text"]').fill('make header blue');
    await designPanel.locator('button:has-text("Apply")').click();

    const successToast = page.locator('div[data-sonner-toast][data-type="success"]');
    await expect(successToast).toBeVisible();
    await expect(successToast).toContainText(/Design updated/i);

    const designRenderer = page.locator('div[data-testid="design-renderer"]');
    await expect(designRenderer).toHaveAttribute('style', /--header-color: blue/);
  });

  test('unsupported request returns an error', async ({ page }) => {
    await page.route('**/api/v1/design/**/customize', route => {
        route.fulfill({
            status: 400,
            body: JSON.stringify({ error: 'Unsupported request' }),
        });
    });

    const designPanel = page.locator('div[aria-label="Design Panel"]');
    await designPanel.locator('input[type="text"]').fill('add dancing animations');
    await designPanel.locator('button:has-text("Apply")').click();

    const errorToast = page.locator('div[data-sonner-toast][data-type="error"]');
    await expect(errorToast).toBeVisible();
    await expect(errorToast).toContainText(/Unsupported request/i);
  });

  test('ATS warning appears when score drops >10%', async ({ page }) => {
    await page.route('**/api/v1/design/**/customize', route => {
        route.fulfill({
            status: 200,
            body: JSON.stringify({ 
                success: true, 
                ats_warning: 'ATS score dropped by 15%' 
            }),
        });
    });

    const designPanel = page.locator('div[aria-label="Design Panel"]');
    await designPanel.locator('input[type="text"]').fill('use a fancy font');
    await designPanel.locator('button:has-text("Apply")').click();

    const warningToast = page.locator('div[data-sonner-toast][data-type="warning"]');
    await expect(warningToast).toBeVisible();
    await expect(warningToast).toContainText(/ATS score dropped/i);
  });

  test('undo functionality works', async ({ page }) => {
    const designPanel = page.locator('div[aria-label="Design Panel"]');
    
    // First, make a change
    await designPanel.locator('input[type="text"]').fill('make header blue');
    await designPanel.locator('button:has-text("Apply")').click();
    await page.waitForSelector('div[data-sonner-toast][data-type="success"]');

    // Then, click undo
    const undoButton = page.locator('button:has-text("Undo")');
    await expect(undoButton).toBeEnabled();
    await undoButton.click();

    const successToast = page.locator('div[data-sonner-toast][data-type="success"]');
    await expect(successToast).toBeVisible();
    await expect(successToast).toContainText(/reverted/i);

    const designRenderer = page.locator('div[data-testid="design-renderer"]');
    await expect(designRenderer).not.toHaveAttribute('style', /--header-color: blue/);
  });
});
