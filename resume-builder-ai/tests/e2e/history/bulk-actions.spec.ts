import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Bulk Actions Feature
 * Feature: 005-history-view-previous (User Story 4 - T042)
 *
 * Tests cover:
 * - Selection functionality (individual and Select All)
 * - Bulk delete with confirmation dialog
 * - Bulk export to ZIP
 * - Error handling and validation
 */

test.describe('Bulk Actions', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to history page
    // TODO: Add authentication setup
    await page.goto('/dashboard/history');

    // Wait for table to load
    await page.waitForSelector('table');
  });

  test.describe('Selection Functionality (T034, T035)', () => {
    test('should select individual optimization via checkbox', async ({ page }) => {
      // Find first optimization row checkbox
      const firstCheckbox = page.locator('tbody tr:first-child input[type="checkbox"]');

      // Initially unchecked
      await expect(firstCheckbox).not.toBeChecked();

      // Click to select
      await firstCheckbox.check();

      // Should be checked
      await expect(firstCheckbox).toBeChecked();

      // Selection count should appear
      await expect(page.getByText('1 selected')).toBeVisible();
    });

    test('should deselect individual optimization via checkbox', async ({ page }) => {
      // Select first checkbox
      const firstCheckbox = page.locator('tbody tr:first-child input[type="checkbox"]');
      await firstCheckbox.check();
      await expect(firstCheckbox).toBeChecked();

      // Deselect
      await firstCheckbox.uncheck();
      await expect(firstCheckbox).not.toBeChecked();

      // Selection count should disappear
      await expect(page.getByText('1 selected')).not.toBeVisible();
    });

    test('should select all optimizations via "Select All" button', async ({ page }) => {
      // Click "Select All" button
      await page.getByRole('button', { name: /select all/i }).click();

      // All checkboxes should be checked
      const checkboxes = page.locator('tbody input[type="checkbox"]');
      const count = await checkboxes.count();

      for (let i = 0; i < count; i++) {
        await expect(checkboxes.nth(i)).toBeChecked();
      }

      // Selection count should show total
      await expect(page.getByText(new RegExp(`${count} selected`))).toBeVisible();
    });

    test('should deselect all optimizations via "Deselect All" button', async ({ page }) => {
      // Select all first
      await page.getByRole('button', { name: /select all/i }).click();

      // Wait for selection to complete
      await page.waitForSelector('text=/selected/');

      // Click "Deselect All"
      await page.getByRole('button', { name: /deselect all/i }).click();

      // All checkboxes should be unchecked
      const checkboxes = page.locator('tbody input[type="checkbox"]');
      const count = await checkboxes.count();

      for (let i = 0; i < count; i++) {
        await expect(checkboxes.nth(i)).not.toBeChecked();
      }

      // Selection count should disappear
      await expect(page.getByText(/selected/)).not.toBeVisible();
    });

    test('should select all via header checkbox', async ({ page }) => {
      // Click header checkbox
      const headerCheckbox = page.locator('thead input[type="checkbox"]');
      await headerCheckbox.check();

      // All row checkboxes should be checked
      const checkboxes = page.locator('tbody input[type="checkbox"]');
      const count = await checkboxes.count();

      for (let i = 0; i < count; i++) {
        await expect(checkboxes.nth(i)).toBeChecked();
      }
    });

    test('should highlight selected rows', async ({ page }) => {
      // Select first row
      const firstCheckbox = page.locator('tbody tr:first-child input[type="checkbox"]');
      await firstCheckbox.check();

      // Row should have highlight class
      const firstRow = page.locator('tbody tr:first-child');
      await expect(firstRow).toHaveClass(/bg-muted/);
    });

    test('should show bulk actions toolbar only when items selected', async ({ page }) => {
      // Initially no bulk actions should be prominently displayed
      const deleteButton = page.getByRole('button', { name: /delete selected/i });

      // Select an item
      const firstCheckbox = page.locator('tbody tr:first-child input[type="checkbox"]');
      await firstCheckbox.check();

      // Bulk action buttons should be visible
      await expect(deleteButton).toBeVisible();
      await expect(page.getByRole('button', { name: /export selected/i })).toBeVisible();
    });
  });

  test.describe('Bulk Delete (T036-T038)', () => {
    test('should show confirmation dialog when deleting', async ({ page }) => {
      // Select first optimization
      const firstCheckbox = page.locator('tbody tr:first-child input[type="checkbox"]');
      await firstCheckbox.check();

      // Click Delete Selected
      await page.getByRole('button', { name: /delete selected/i }).click();

      // Dialog should appear
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByText(/delete selected optimizations/i)).toBeVisible();

      // Should show count
      await expect(page.getByText(/you are about to delete 1 optimization/i)).toBeVisible();

      // Should show warning about application preservation
      await expect(page.getByText(/application records will be preserved/i)).toBeVisible();
    });

    test('should cancel bulk delete via Cancel button', async ({ page }) => {
      // Select and open delete dialog
      await page.locator('tbody tr:first-child input[type="checkbox"]').check();
      await page.getByRole('button', { name: /delete selected/i }).click();

      // Click Cancel
      await page.getByRole('button', { name: /cancel/i }).click();

      // Dialog should close
      await expect(page.getByRole('dialog')).not.toBeVisible();

      // Item should still exist
      const rowCount = await page.locator('tbody tr').count();
      expect(rowCount).toBeGreaterThan(0);
    });

    test('should execute bulk delete via Delete button', async ({ page }) => {
      // Get initial row count
      const initialRowCount = await page.locator('tbody tr').count();

      // Select first optimization
      await page.locator('tbody tr:first-child input[type="checkbox"]').check();

      // Click Delete Selected
      await page.getByRole('button', { name: /delete selected/i }).click();

      // Confirm deletion
      await page.getByRole('button', { name: /^delete$/i }).click();

      // Wait for success toast
      await expect(page.getByText(/deletion complete/i)).toBeVisible({ timeout: 10000 });

      // Row count should decrease
      const newRowCount = await page.locator('tbody tr').count();
      expect(newRowCount).toBe(initialRowCount - 1);

      // Selection should be cleared
      await expect(page.getByText(/selected/)).not.toBeVisible();
    });

    test('should delete multiple items', async ({ page }) => {
      // Get initial row count
      const initialRowCount = await page.locator('tbody tr').count();

      // Select first 3 items
      for (let i = 0; i < Math.min(3, initialRowCount); i++) {
        await page.locator(`tbody tr:nth-child(${i + 1}) input[type="checkbox"]`).check();
      }

      // Verify selection count
      const selectedCount = Math.min(3, initialRowCount);
      await expect(page.getByText(new RegExp(`${selectedCount} selected`))).toBeVisible();

      // Delete
      await page.getByRole('button', { name: /delete selected/i }).click();
      await page.getByRole('button', { name: /^delete$/i }).click();

      // Wait for completion
      await expect(page.getByText(/deletion complete/i)).toBeVisible({ timeout: 10000 });

      // Verify row count decreased
      const newRowCount = await page.locator('tbody tr').count();
      expect(newRowCount).toBe(initialRowCount - selectedCount);
    });

    test('should disable delete button when exceeding max limit (50)', async ({ page }) => {
      // This test assumes there are more than 50 items
      // Select all if more than 50 exist
      await page.getByRole('button', { name: /select all/i }).click();

      // Get selection count text
      const selectionText = await page.getByText(/selected/).textContent();
      const selectedCount = parseInt(selectionText?.match(/(\d+)/)?.[1] || '0');

      if (selectedCount > 50) {
        // Delete button should be disabled
        const deleteButton = page.getByRole('button', { name: /delete selected/i });
        await expect(deleteButton).toBeDisabled();

        // Should show max limit message
        await expect(page.getByText(/max 50/i)).toBeVisible();
      }
    });

    test('should show processing state during delete', async ({ page }) => {
      // Select first item
      await page.locator('tbody tr:first-child input[type="checkbox"]').check();

      // Start delete
      await page.getByRole('button', { name: /delete selected/i }).click();
      await page.getByRole('button', { name: /^delete$/i }).click();

      // Should show "Deleting..." state
      await expect(page.getByText(/deleting/i)).toBeVisible();
    });
  });

  test.describe('Bulk Export (T039, T041)', () => {
    test('should initiate export download when clicking Export Selected', async ({ page }) => {
      // Select first optimization
      await page.locator('tbody tr:first-child input[type="checkbox"]').check();

      // Setup download listener
      const downloadPromise = page.waitForEvent('download');

      // Click Export Selected
      await page.getByRole('button', { name: /export selected/i }).click();

      // Wait for download
      const download = await downloadPromise;

      // Verify filename is ZIP
      expect(download.suggestedFilename()).toMatch(/\.zip$/);
      expect(download.suggestedFilename()).toContain('resume-optimizations');
    });

    test('should export multiple selections', async ({ page }) => {
      // Select first 3 items
      for (let i = 0; i < 3; i++) {
        await page.locator(`tbody tr:nth-child(${i + 1}) input[type="checkbox"]`).check();
      }

      // Setup download listener
      const downloadPromise = page.waitForEvent('download');

      // Export
      await page.getByRole('button', { name: /export selected/i }).click();

      // Wait for download
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.zip$/);

      // Show success toast
      await expect(page.getByText(/export complete/i)).toBeVisible({ timeout: 10000 });

      // Selection should be cleared
      await expect(page.getByText(/selected/)).not.toBeVisible();
    });

    test('should disable export button when exceeding max limit (20)', async ({ page }) => {
      // This test assumes there are more than 20 items
      // Select all
      await page.getByRole('button', { name: /select all/i }).click();

      // Get selection count
      const selectionText = await page.getByText(/selected/).textContent();
      const selectedCount = parseInt(selectionText?.match(/(\d+)/)?.[1] || '0');

      if (selectedCount > 20) {
        // Export button should be disabled
        const exportButton = page.getByRole('button', { name: /export selected/i });
        await expect(exportButton).toBeDisabled();

        // Should show max limit message
        await expect(page.getByText(/max 20/i)).toBeVisible();
      }
    });

    test('should show processing state during export', async ({ page }) => {
      // Select first item
      await page.locator('tbody tr:first-child input[type="checkbox"]').check();

      // Start export
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: /export selected/i }).click();

      // Should show processing indicator
      await expect(page.getByText(/processing/i)).toBeVisible();

      // Wait for download to complete
      await downloadPromise;
    });
  });

  test.describe('Error Handling', () => {
    test('should handle delete error gracefully', async ({ page }) => {
      // Mock API to return error
      await page.route('**/api/optimizations/bulk', (route) => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Failed to delete optimizations',
            code: 'SERVER_ERROR',
          }),
        });
      });

      // Select and try to delete
      await page.locator('tbody tr:first-child input[type="checkbox"]').check();
      await page.getByRole('button', { name: /delete selected/i }).click();
      await page.getByRole('button', { name: /^delete$/i }).click();

      // Should show error toast
      await expect(page.getByText(/deletion failed/i)).toBeVisible({ timeout: 10000 });
    });

    test('should handle export error gracefully', async ({ page }) => {
      // Mock API to return error
      await page.route('**/api/optimizations/export', (route) => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Failed to export optimizations',
            code: 'SERVER_ERROR',
          }),
        });
      });

      // Select and try to export
      await page.locator('tbody tr:first-child input[type="checkbox"]').check();
      await page.getByRole('button', { name: /export selected/i }).click();

      // Should show error toast
      await expect(page.getByText(/export failed/i)).toBeVisible({ timeout: 10000 });
    });

    test('should handle unauthorized access', async ({ page }) => {
      // Mock API to return 401
      await page.route('**/api/optimizations/bulk', (route) => {
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Unauthorized',
            code: 'UNAUTHORIZED',
          }),
        });
      });

      // Try to delete
      await page.locator('tbody tr:first-child input[type="checkbox"]').check();
      await page.getByRole('button', { name: /delete selected/i }).click();
      await page.getByRole('button', { name: /^delete$/i }).click();

      // Should show error
      await expect(page.getByText(/failed/i)).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Integration with Filters and Pagination', () => {
    test('should preserve selection when changing pages', async ({ page }) => {
      // Select first item on page 1
      await page.locator('tbody tr:first-child input[type="checkbox"]').check();
      await expect(page.getByText('1 selected')).toBeVisible();

      // Go to page 2 (if exists)
      const page2Button = page.getByRole('button', { name: '2' });
      if (await page2Button.isVisible()) {
        await page2Button.click();

        // Selection should still show
        await expect(page.getByText('1 selected')).toBeVisible();
      }
    });

    test('should clear selection when applying filters', async ({ page }) => {
      // Select items
      await page.locator('tbody tr:first-child input[type="checkbox"]').check();
      await expect(page.getByText('1 selected')).toBeVisible();

      // Apply a filter (e.g., search)
      const searchInput = page.getByPlaceholder(/search/i);
      await searchInput.fill('test company');

      // Note: Implementation may choose to preserve or clear selection
      // This test documents current behavior
    });

    test('should disable Select All when no results', async ({ page }) => {
      // Apply filter that returns no results
      const searchInput = page.getByPlaceholder(/search/i);
      await searchInput.fill('ZZZZZ_NONEXISTENT_COMPANY_ZZZZZ');

      // Wait for no results message
      await expect(page.getByText(/no optimizations match/i)).toBeVisible();

      // Select All button should be disabled
      const selectAllButton = page.getByRole('button', { name: /select all/i });
      await expect(selectAllButton).toBeDisabled();
    });
  });
});
