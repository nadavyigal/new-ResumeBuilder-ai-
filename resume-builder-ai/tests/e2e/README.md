# E2E Tests for Enhanced AI Assistant

This directory contains end-to-end (E2E) tests for Phase 6 - Cross-Spec Integration.

## Overview

The E2E tests validate User Story 5 and ensure all specifications (001-008) work together without conflicts:

- **Spec 001**: Authentication & User Management
- **Spec 002**: Resume Upload & Parsing
- **Spec 003**: Job Description Input
- **Spec 004**: Template Selection
- **Spec 005**: PDF Export
- **Spec 006**: AI Resume Assistant (Base)
- **Spec 007**: Credit-Based Pricing
- **Spec 008**: Enhanced AI Assistant

## Test Coverage

### T037: Full Optimization Workflow
Tests the complete user journey:
1. Login (Spec 001)
2. Upload resume (Spec 002)
3. Input job description (Spec 003)
4. Select template (Spec 004)
5. AI optimization (Spec 006 + 008)
6. Download PDF (Spec 005)
7. View history (Spec 005)

### T038: Content Modification
Tests smart content modification:
- "Add Senior to my latest job title" → Title updates without creating duplicate bullets
- "Add React to skills" → Skills array updated correctly
- Modification history tracked

### T039: Visual Customization
Tests real-time styling:
- "Change background to navy blue" → Preview updates with #001f3f
- "Change font to Arial" → Font applies correctly
- Accessibility validation for poor contrast

### T040: PDF Export with Customizations
Tests PDF generation:
- Custom colors persist in PDF
- Custom fonts persist in PDF
- File downloads successfully

### T041-T046: Cross-Spec Compatibility
Tests integration between specs:
- Auth + AI assistant
- Resume upload + modifications
- Job description + ATS rescoring
- Templates + visual customization
- PDF export + all enhancements
- Base AI assistant + enhancements

## Prerequisites

### 1. Environment Variables

Create a `.env.local` file in the `resume-builder-ai` directory:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Test User Credentials
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=TestPassword123!

# Playwright
PLAYWRIGHT_BASE_URL=http://localhost:3000
```

### 2. Test User Setup

Create a test user in your Supabase database:

```sql
-- Insert test user (use the credentials from .env.local)
INSERT INTO auth.users (email, encrypted_password)
VALUES ('test@example.com', crypt('TestPassword123!', gen_salt('bf')));
```

Or use the Supabase dashboard to create a test user manually.

### 3. Test Data

Ensure you have sample resumes in `tests/fixtures/sample-01/`:
- `resume.pdf` - A valid PDF resume

### 4. Database Migrations

Ensure all database migrations are applied:

```bash
cd resume-builder-ai
npx supabase db reset  # Reset to latest migrations
npx supabase db push   # Or push migrations
```

## Running Tests

### Install Playwright Browsers

First time only:

```bash
cd resume-builder-ai
npx playwright install
```

### Run All E2E Tests

```bash
npm run test:e2e
```

### Run Specific Test Suite

```bash
npm run test:e2e -- --grep "T037"         # Full workflow
npm run test:e2e -- --grep "T038"         # Content modification
npm run test:e2e -- --grep "T039"         # Visual customization
npm run test:e2e -- --grep "T040"         # PDF export
npm run test:e2e -- --grep "Cross-Spec"   # Compatibility tests
```

### Run Tests with UI

Interactive mode with visual test runner:

```bash
npm run test:e2e:ui
```

### Debug Tests

Step through tests with debugger:

```bash
npm run test:e2e:debug
```

### View Test Report

After running tests:

```bash
npm run test:e2e:report
```

## Test Configuration

Configuration is in `playwright.config.ts`:

- **Timeout**: 60 seconds per test
- **Retries**: 2 on CI, 0 locally
- **Browsers**: Chromium, Firefox, WebKit
- **Base URL**: `http://localhost:3000` (configurable)
- **Screenshots**: On failure only
- **Videos**: Retained on failure
- **Traces**: On first retry

## Writing New E2E Tests

### Test Structure

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test('should do something specific', async ({ page }) => {
    // 1. Setup (login, navigate)
    await loginTestUser(page);

    // 2. Perform actions
    await page.click('button[data-testid="action"]');

    // 3. Assert results
    await expect(page.locator('[data-testid="result"]')).toBeVisible();
  });
});
```

### Helper Functions

Available helpers in `ai-assistant-enhanced.spec.ts`:

- `loginTestUser(page)` - Login with test credentials
- `uploadResume(page, path)` - Upload a resume file
- `inputJobDescription(page, text)` - Input job description
- `sendAIMessage(page, message)` - Send AI assistant message

### Best Practices

1. **Use data-testid attributes** for reliable selectors
2. **Wait for async operations** with `page.waitForSelector()`
3. **Test user flows, not implementation** details
4. **Keep tests independent** - each test should work standalone
5. **Use descriptive test names** - "should update job title when requested"
6. **Add timeouts for slow operations** - AI responses, PDF generation
7. **Clean up after tests** - delete test data if needed

## Performance Targets

Tests validate these performance targets:

| Operation | Target (p95) | Test |
|-----------|--------------|------|
| AI response time | < 5s | Performance Validation |
| ATS recalculation | < 2s | Performance Validation |
| Visual style updates | < 500ms | Performance Validation |

## Troubleshooting

### Tests Fail with "element not found"

- Check that the frontend uses `data-testid` attributes
- Increase timeout if elements load slowly
- Verify selectors match actual DOM structure

### Tests Fail with Authentication Errors

- Ensure test user exists in Supabase
- Check `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` in `.env.local`
- Verify Supabase credentials are correct

### Tests Timeout

- Increase timeout in test: `test.setTimeout(120000)`
- Check dev server is running: `npm run dev`
- Verify network connectivity to Supabase/OpenAI

### PDF Download Fails

- Ensure download directory is writable
- Check that PDF export endpoint is working
- Verify Puppeteer is installed correctly

### AI Responses Don't Work

- Check `OPENAI_API_KEY` is set correctly
- Verify OpenAI API has credits
- Check network connectivity

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Install dependencies
        run: |
          cd resume-builder-ai
          npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Run E2E tests
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
          TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}
        run: npm run test:e2e

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: resume-builder-ai/playwright-report/
```

## Test Maintenance

### Updating Tests

When UI changes:
1. Update selectors in helper functions
2. Re-run tests to verify
3. Update snapshots if needed

When features change:
1. Review test coverage
2. Add new tests for new features
3. Remove tests for deprecated features

### Regular Checks

- Run tests weekly to catch regressions
- Update test data fixtures monthly
- Review and update performance targets quarterly

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Tests](https://playwright.dev/docs/debug)
- [CI/CD Integration](https://playwright.dev/docs/ci)

## Support

For issues with E2E tests:
1. Check this README for troubleshooting steps
2. Review test output and screenshots
3. Run tests in debug mode: `npm run test:e2e:debug`
4. Check Playwright documentation
5. Contact the development team

---

**Last Updated**: 2025-01-19
**Test Version**: Phase 6 Complete
**Status**: ✅ All E2E Tests Implemented
