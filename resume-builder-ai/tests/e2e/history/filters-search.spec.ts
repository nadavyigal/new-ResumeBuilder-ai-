/**
 * E2E tests for History View - Filter and Search functionality
 * Feature: 005-history-view-previous (User Story 3 - T032)
 *
 * Tests search, date range filters, score filters, pagination, sorting, and URL sync
 */

import { test, expect, Page } from '@playwright/test';

// Test data setup helper
async function setupTestData(page: Page) {
  // This should create test optimizations via API or test database
  // For now, we'll assume test data exists or mock it
  // In real implementation, use Playwright's beforeEach to seed data
}

test.describe('History View - Search Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to history page
    await page.goto('/dashboard/history');
    await page.waitForLoadState('networkidle');
  });

  test('should display search input', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search by job title or company/i);
    await expect(searchInput).toBeVisible();
  });

  test('should filter results in real-time by job title', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search by job title or company/i);

    // Type search query
    await searchInput.fill('Software Engineer');

    // Wait for debounce (300ms) + network request
    await page.waitForTimeout(500);

    // Check that table shows filtered results
    const tableRows = page.locator('table tbody tr');
    const rowCount = await tableRows.count();

    // Verify filtered results contain search term
    for (let i = 0; i < rowCount; i++) {
      const rowText = await tableRows.nth(i).textContent();
      expect(rowText?.toLowerCase()).toMatch(/(software|engineer)/);
    }
  });

  test('should filter results by company name', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search by job title or company/i);

    await searchInput.fill('Google');
    await page.waitForTimeout(500);

    const tableRows = page.locator('table tbody tr');
    const firstRowText = await tableRows.first().textContent();
    expect(firstRowText?.toLowerCase()).toContain('google');
  });

  test('should show clear button when search has value', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search by job title or company/i);

    // Initially no clear button
    const clearButton = page.getByLabel(/clear search/i);
    await expect(clearButton).not.toBeVisible();

    // Type and verify clear button appears
    await searchInput.fill('test');
    await expect(clearButton).toBeVisible();

    // Click clear and verify
    await clearButton.click();
    await expect(searchInput).toHaveValue('');
  });

  test('should perform case-insensitive search', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search by job title or company/i);

    await searchInput.fill('ENGINEER');
    await page.waitForTimeout(500);

    const tableRows = page.locator('table tbody tr');
    expect(await tableRows.count()).toBeGreaterThan(0);
  });

  test('should show no results message when search has no matches', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search by job title or company/i);

    await searchInput.fill('nonexistentjobtitle12345');
    await page.waitForTimeout(500);

    // Verify no results message appears
    await expect(page.getByText(/no optimizations match your filters/i)).toBeVisible();

    // Verify clear filters button is visible
    const clearButton = page.getByRole('button', { name: /clear filters/i });
    await expect(clearButton).toBeVisible();
  });
});

test.describe('History View - Date Range Filter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/history');
    await page.waitForLoadState('networkidle');
  });

  test('should display date range filter button', async ({ page }) => {
    const dateButton = page.getByRole('button', { name: /all time/i });
    await expect(dateButton).toBeVisible();
  });

  test('should show date range options when clicked', async ({ page }) => {
    const dateButton = page.getByRole('button', { name: /all time/i });
    await dateButton.click();

    // Verify preset options are visible
    await expect(page.getByRole('button', { name: /last 7 days/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /last 30 days/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /last 90 days/i })).toBeVisible();
  });

  test('should filter by "Last 7 days" preset', async ({ page }) => {
    const dateButton = page.getByRole('button', { name: /all time/i });
    await dateButton.click();

    const last7DaysButton = page.getByRole('button', { name: /last 7 days/i });
    await last7DaysButton.click();

    // Wait for filter to apply
    await page.waitForTimeout(500);

    // Verify button text updates
    await expect(page.getByRole('button', { name: /last 7 days/i })).toBeVisible();

    // Verify URL contains date params
    await expect(page).toHaveURL(/dateFrom/);
    await expect(page).toHaveURL(/dateTo/);
  });

  test('should filter by "Last 30 days" preset', async ({ page }) => {
    const dateButton = page.getByRole('button', { name: /all time/i });
    await dateButton.click();

    await page.getByRole('button', { name: /last 30 days/i }).click();
    await page.waitForTimeout(500);

    await expect(page.getByRole('button', { name: /last 30 days/i })).toBeVisible();
  });

  test('should show calendar for custom date range', async ({ page }) => {
    const dateButton = page.getByRole('button', { name: /all time/i });
    await dateButton.click();

    // Look for calendar component
    const calendar = page.locator('[role="dialog"]').filter({ hasText: /custom range/i });
    await expect(calendar).toBeVisible();
  });

  test('should clear date range filter', async ({ page }) => {
    // Apply filter first
    const dateButton = page.getByRole('button', { name: /all time/i });
    await dateButton.click();
    await page.getByRole('button', { name: /last 7 days/i }).click();
    await page.waitForTimeout(300);

    // Click X to clear
    const clearIcon = page.locator('button svg').filter({ hasText: /x/i }).first();
    await clearIcon.click();

    // Verify reverts to "All time"
    await expect(page.getByRole('button', { name: /all time/i })).toBeVisible();
  });
});

test.describe('History View - ATS Score Filter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/history');
    await page.waitForLoadState('networkidle');
  });

  test('should display score filter dropdown', async ({ page }) => {
    const scoreSelect = page.getByRole('combobox', { name: /score/i });
    await expect(scoreSelect).toBeVisible();
  });

  test('should show score options when opened', async ({ page }) => {
    const scoreSelect = page.getByRole('combobox');
    await scoreSelect.click();

    // Verify options
    await expect(page.getByRole('option', { name: /all scores/i })).toBeVisible();
    await expect(page.getByRole('option', { name: /90% and above/i })).toBeVisible();
    await expect(page.getByRole('option', { name: /80% and above/i })).toBeVisible();
    await expect(page.getByRole('option', { name: /70% and above/i })).toBeVisible();
  });

  test('should filter by "90% and above"', async ({ page }) => {
    const scoreSelect = page.getByRole('combobox');
    await scoreSelect.click();

    await page.getByRole('option', { name: /90% and above/i }).click();
    await page.waitForTimeout(500);

    // Verify table shows only high-scoring optimizations
    const scoreColumns = page.locator('table tbody td').filter({ hasText: /%/ });
    const scores = await scoreColumns.allTextContents();

    scores.forEach((score) => {
      const numericScore = parseInt(score.replace('%', ''));
      expect(numericScore).toBeGreaterThanOrEqual(90);
    });
  });

  test('should filter by "80% and above"', async ({ page }) => {
    const scoreSelect = page.getByRole('combobox');
    await scoreSelect.click();

    await page.getByRole('option', { name: /80% and above/i }).click();
    await page.waitForTimeout(500);

    // Verify URL contains minScore param
    await expect(page).toHaveURL(/minScore=0\.8/);
  });
});

test.describe('History View - Combined Filters', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/history');
    await page.waitForLoadState('networkidle');
  });

  test('should combine search with date filter', async ({ page }) => {
    // Apply search
    const searchInput = page.getByPlaceholder(/search by job title or company/i);
    await searchInput.fill('Engineer');
    await page.waitForTimeout(500);

    // Apply date filter
    const dateButton = page.getByRole('button', { name: /all time/i });
    await dateButton.click();
    await page.getByRole('button', { name: /last 30 days/i }).click();
    await page.waitForTimeout(500);

    // Verify both filters are active (filter count badge shows 2)
    const filterBadge = page.locator('text=/Filters:/').locator('..').getByRole('status');
    await expect(filterBadge).toHaveText('2');

    // Verify URL contains both params
    await expect(page).toHaveURL(/search=Engineer/);
    await expect(page).toHaveURL(/dateFrom/);
  });

  test('should combine search, date, and score filters', async ({ page }) => {
    // Apply all three filters
    await page.getByPlaceholder(/search by job title or company/i).fill('Software');
    await page.waitForTimeout(300);

    const dateButton = page.getByRole('button', { name: /all time/i });
    await dateButton.click();
    await page.getByRole('button', { name: /last 7 days/i }).click();

    const scoreSelect = page.getByRole('combobox');
    await scoreSelect.click();
    await page.getByRole('option', { name: /80% and above/i }).click();

    await page.waitForTimeout(500);

    // Verify filter count badge shows 3
    const filterBadge = page.locator('text=/Filters:/').locator('..').getByRole('status');
    await expect(filterBadge).toHaveText('3');
  });

  test('should clear all filters at once', async ({ page }) => {
    // Apply multiple filters
    await page.getByPlaceholder(/search by job title or company/i).fill('Test');

    const dateButton = page.getByRole('button', { name: /all time/i });
    await dateButton.click();
    await page.getByRole('button', { name: /last 7 days/i }).click();

    await page.waitForTimeout(300);

    // Click "Clear filters" button
    const clearButton = page.getByRole('button', { name: /clear filters/i });
    await clearButton.click();

    // Verify all filters are cleared
    await expect(page.getByPlaceholder(/search/i)).toHaveValue('');
    await expect(page.getByRole('button', { name: /all time/i })).toBeVisible();

    // Verify URL has no filter params
    await expect(page).toHaveURL('/dashboard/history');
  });
});

test.describe('History View - Column Sorting', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/history');
    await page.waitForLoadState('networkidle');
  });

  test('should sort by Date Created column', async ({ page }) => {
    const dateHeader = page.getByRole('button', { name: /date created/i });
    await expect(dateHeader).toBeVisible();

    // Click to sort ascending
    await dateHeader.click();
    await page.waitForTimeout(500);

    // Verify URL contains sort params
    await expect(page).toHaveURL(/sort=date/);
    await expect(page).toHaveURL(/order=asc/);

    // Click again to sort descending
    await dateHeader.click();
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/order=desc/);
  });

  test('should sort by ATS Match % column', async ({ page }) => {
    const scoreHeader = page.getByRole('button', { name: /ats match %/i });
    await scoreHeader.click();
    await page.waitForTimeout(500);

    await expect(page).toHaveURL(/sort=score/);
  });

  test('should sort by Company column', async ({ page }) => {
    const companyHeader = page.getByRole('button', { name: /^company$/i });
    await companyHeader.click();
    await page.waitForTimeout(500);

    await expect(page).toHaveURL(/sort=company/);
  });

  test('should show sort direction icons', async ({ page }) => {
    const dateHeader = page.getByRole('button', { name: /date created/i });

    // Default shows down arrow (desc)
    await expect(dateHeader).toBeVisible();

    // Click to change direction
    await dateHeader.click();
    await page.waitForTimeout(300);

    // Should now show up arrow (asc) - verify icon changed
    await expect(dateHeader.locator('svg')).toBeVisible();
  });
});

test.describe('History View - Pagination', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/history');
    await page.waitForLoadState('networkidle');
  });

  test('should display pagination controls', async ({ page }) => {
    const pagination = page.locator('text=/Showing .* to .* of .* results/i');
    await expect(pagination).toBeVisible();
  });

  test('should show rows per page selector', async ({ page }) => {
    const rowsSelect = page.getByRole('combobox').filter({ hasText: /20|50|100/ });
    await expect(rowsSelect).toBeVisible();
  });

  test('should change items per page', async ({ page }) => {
    const rowsSelect = page.locator('text=/Rows per page:/').locator('..').getByRole('combobox');
    await rowsSelect.click();

    await page.getByRole('option', { name: '50' }).click();
    await page.waitForTimeout(500);

    // Verify URL updates
    await expect(page).toHaveURL(/limit=50/);
  });

  test('should navigate to next page', async ({ page }) => {
    // Click next page button
    const nextButton = page.getByLabel(/go to next page/i);

    // Only test if button is enabled (means there are multiple pages)
    if (await nextButton.isEnabled()) {
      await nextButton.click();
      await page.waitForTimeout(500);

      // Verify page param in URL
      await expect(page).toHaveURL(/page=2/);
    }
  });

  test('should navigate to previous page', async ({ page }) => {
    // Go to page 2 first
    const nextButton = page.getByLabel(/go to next page/i);
    if (await nextButton.isEnabled()) {
      await nextButton.click();
      await page.waitForTimeout(500);

      // Then go back
      const prevButton = page.getByLabel(/go to previous page/i);
      await prevButton.click();
      await page.waitForTimeout(500);

      // Should be back on page 1
      expect(await page.url()).not.toMatch(/page=/);
    }
  });

  test('should jump to specific page number', async ({ page }) => {
    // Find page number buttons
    const page3Button = page.getByRole('button', { name: '3', exact: true });

    // Only test if page 3 exists
    if (await page3Button.isVisible()) {
      await page3Button.click();
      await page.waitForTimeout(500);

      await expect(page).toHaveURL(/page=3/);
    }
  });
});

test.describe('History View - URL State Synchronization', () => {
  test('should restore filters from URL on page load', async ({ page }) => {
    // Navigate with pre-set filters in URL
    await page.goto('/dashboard/history?search=Engineer&minScore=0.8&page=2');
    await page.waitForLoadState('networkidle');

    // Verify search input has value
    const searchInput = page.getByPlaceholder(/search by job title or company/i);
    await expect(searchInput).toHaveValue('Engineer');

    // Verify score filter is set
    const scoreSelect = page.getByRole('combobox');
    await expect(scoreSelect).toHaveText(/80%/);

    // Verify pagination shows page 2
    const page2Button = page.getByRole('button', { name: '2', exact: true });
    await expect(page2Button).toHaveAttribute('aria-current', 'page');
  });

  test('should restore sort state from URL', async ({ page }) => {
    await page.goto('/dashboard/history?sort=score&order=asc');
    await page.waitForLoadState('networkidle');

    // Verify sort is applied (check URL still has params after load)
    await expect(page).toHaveURL(/sort=score/);
    await expect(page).toHaveURL(/order=asc/);
  });

  test('should enable bookmarking of filtered views', async ({ page }) => {
    // Apply filters
    await page.goto('/dashboard/history');
    await page.getByPlaceholder(/search by job title or company/i).fill('Engineer');
    await page.waitForTimeout(500);

    // Get current URL
    const url = page.url();

    // Navigate away
    await page.goto('/dashboard');

    // Navigate back using bookmarked URL
    await page.goto(url);
    await page.waitForLoadState('networkidle');

    // Verify filters are still applied
    await expect(page.getByPlaceholder(/search/i)).toHaveValue('Engineer');
  });

  test('should update URL without page reload', async ({ page }) => {
    await page.goto('/dashboard/history');
    const initialLoadCount = await page.evaluate(() => performance.navigation.type);

    // Change filter
    await page.getByPlaceholder(/search by job title or company/i).fill('Test');
    await page.waitForTimeout(500);

    // Verify URL changed but page didn't reload
    await expect(page).toHaveURL(/search=Test/);
    const newLoadCount = await page.evaluate(() => performance.navigation.type);
    expect(newLoadCount).toBe(initialLoadCount);
  });
});

test.describe('History View - No Results State', () => {
  test('should show no results message when filters match nothing', async ({ page }) => {
    await page.goto('/dashboard/history');

    // Apply filters that won't match
    await page.getByPlaceholder(/search by job title or company/i).fill('zzznomatchzz');
    await page.waitForTimeout(500);

    // Verify no results message
    await expect(page.getByText(/no optimizations match your filters/i)).toBeVisible();
    await expect(
      page.getByText(/try adjusting your search criteria/i)
    ).toBeVisible();

    // Verify "Clear filters" button is present
    const clearButton = page.getByRole('button', { name: /clear filters/i });
    await expect(clearButton).toBeVisible();
  });

  test('should clear filters from no results state', async ({ page }) => {
    await page.goto('/dashboard/history?search=zzznomatchzz');
    await page.waitForLoadState('networkidle');

    // Click clear filters
    const clearButton = page.getByRole('button', { name: /clear filters/i });
    await clearButton.click();

    // Verify results appear
    await page.waitForTimeout(500);
    const tableRows = page.locator('table tbody tr');
    expect(await tableRows.count()).toBeGreaterThan(0);
  });
});
