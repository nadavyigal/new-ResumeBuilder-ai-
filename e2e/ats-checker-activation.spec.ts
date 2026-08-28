import { test, expect, type Page } from '@playwright/test';

/**
 * Activation-path regression guard for the anonymous free ATS check.
 *
 * Why this path: it is the first meaningful step of the funnel and the one the
 * numbers say leaks worst (73 first-seen -> 9 ever upload). It is also the only
 * part of the activation journey that can run in CI without secrets, because the
 * scoring is deterministic and the one network call is intercepted here.
 *
 * These tests assert the CONTRACT BETWEEN the API response and the rendered
 * result, not the scoring maths. Scoring is covered by the jest suites under
 * src/lib/ats/__tests__ and by the nightly resume-optimizer eval. What was
 * untested before this file is whether a user who uploads a resume ever sees a
 * score at all -- which is exactly the failure the funnel could not distinguish
 * from low traffic.
 */

const CHECK_ENDPOINT = '**/api/public/ats-check';

// A minimal but structurally valid PDF. The route is intercepted, so this only
// has to satisfy the client-side `accept=".pdf,application/pdf"` filter.
const PDF_FIXTURE = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\n' +
    'trailer<</Root 1 0 R>>\n%%EOF\n',
  'utf-8'
);

// The submit button is gated on PUBLIC_ATS_MIN_JOB_DESCRIPTION_WORDS (100) as
// well as on a file being chosen, so this fixture has to clear that bar or the
// button stays disabled and every submit test times out. Asserted below, so a
// future change to the threshold fails loudly here instead of as a timeout.
const JOB_DESCRIPTION = [
  'Job Title: Senior Platform Engineer',
  'Company: Acme Corp',
  '',
  'About the role:',
  'We are looking for a senior platform engineer to join our infrastructure group.',
  'You will own the reliability, scalability and developer experience of the systems',
  'that every product team at the company builds on top of. This is a hands-on role',
  'with a large amount of autonomy and a direct line to the people who depend on it.',
  '',
  'Requirements:',
  '- Experience building and operating distributed systems at scale',
  '- Strong proficiency with TypeScript and React',
  '- Familiarity with Kubernetes and Terraform in production environments',
  '- Comfortable owning services end to end, including on-call rotation',
  '- Track record of improving build, test and deployment pipelines',
  '- Able to communicate technical tradeoffs clearly to non-specialist stakeholders',
  '',
  'Nice to have:',
  '- Experience with PostgreSQL performance tuning and query optimisation',
  '- Exposure to observability tooling such as Prometheus, Grafana or OpenTelemetry',
  '- Prior work on developer platforms, internal tooling or paved-road initiatives',
  '',
  'What we offer:',
  'A small senior team, a short path from decision to production, and real ownership',
  'of the roadmap for the platform you maintain. We care about correctness, about',
  'measuring what we ship, and about leaving systems better documented than we found',
  'them for whoever picks them up next.',
].join('\n');

const SCORE_PAYLOAD = {
  success: true,
  score: 64,
  fit: { verdict: 'moderate', source: 'computed' },
  issues: [
    { id: 'kw-1', severity: 'high', title: 'Missing key skill: Kubernetes', locked: false },
    { id: 'kw-2', severity: 'medium', title: 'Missing key skill: Terraform', locked: false },
  ],
  checksRemaining: 4,
};

const JD_WORD_COUNT = JOB_DESCRIPTION.trim().split(/\s+/).filter(Boolean).length;

async function fillAndSubmit(page: Page) {
  await page.getByTestId('resume-upload').setInputFiles({
    name: 'resume.pdf',
    mimeType: 'application/pdf',
    buffer: PDF_FIXTURE,
  });
  await page.getByTestId('job-description-input').fill(JOB_DESCRIPTION);

  // Fail with a readable message rather than a 30s "element is not enabled"
  // timeout if the word-count gate moves above this fixture.
  await expect(
    page.getByTestId('analyze-button'),
    `submit stayed disabled with a ${JD_WORD_COUNT}-word job description; ` +
      'PUBLIC_ATS_MIN_JOB_DESCRIPTION_WORDS may have been raised above it'
  ).toBeEnabled();

  await page.getByTestId('analyze-button').click();
}

test.describe('free ATS checker activation path', () => {
  test('renders the upload surface a visitor actually lands on', async ({ page }) => {
    await page.goto('/ats-checker');

    await expect(page.getByTestId('free-ats-checker')).toBeVisible();
    await expect(page.getByTestId('ats-checker-heading')).toBeVisible();

    // The two inputs and the submit control must exist. If any of these testids
    // disappear the funnel is broken for every visitor, and no amount of traffic
    // would reveal it as anything other than "nobody converts".
    await expect(page.getByTestId('resume-upload')).toBeAttached();
    await expect(page.getByTestId('job-description-input')).toBeVisible();
    await expect(page.getByTestId('analyze-button')).toBeVisible();
  });

  test('a submitted resume produces a visible score', async ({ page }) => {
    let sawRequest = false;
    await page.route(CHECK_ENDPOINT, async (route) => {
      sawRequest = true;
      await route.fulfill({ status: 200, json: SCORE_PAYLOAD });
    });

    await page.goto('/ats-checker');
    await fillAndSubmit(page);

    await expect(page.getByTestId('ats-score-display')).toBeVisible();
    await expect(page.getByTestId('ats-score')).toContainText('64');
    await expect(page.getByTestId('ats-issues-list')).toBeVisible();
    expect(sawRequest, 'the form must actually call /api/public/ats-check').toBe(true);
  });

  test('the request carries the resume and the job description', async ({ page }) => {
    let body = '';
    await page.route(CHECK_ENDPOINT, async (route) => {
      body = route.request().postData() || '';
      await route.fulfill({ status: 200, json: SCORE_PAYLOAD });
    });

    await page.goto('/ats-checker');
    await fillAndSubmit(page);
    await expect(page.getByTestId('ats-score-display')).toBeVisible();

    // Guards the multipart contract the route parses. A rename on either field
    // returns a 400 that the UI renders as a generic error, which reads to the
    // funnel as a user who chose not to continue.
    expect(body).toContain('name="resume"');
    expect(body).toContain('name="jobDescription"');
    expect(body).toContain('Senior Platform Engineer');
  });

  test('rate limiting shows its own message, not a dead end', async ({ page }) => {
    await page.route(CHECK_ENDPOINT, async (route) => {
      await route.fulfill({
        status: 429,
        json: { success: false, error: 'Rate limited', resetAt: new Date(Date.now() + 3_600_000).toISOString() },
      });
    });

    await page.goto('/ats-checker');
    await fillAndSubmit(page);

    await expect(page.getByTestId('rate-limit-message')).toBeVisible();
    await expect(page.getByTestId('ats-score-display')).toHaveCount(0);
  });

  test('a server error surfaces to the user instead of hanging', async ({ page }) => {
    await page.route(CHECK_ENDPOINT, async (route) => {
      await route.fulfill({ status: 500, json: { success: false, error: 'Scoring failed' } });
    });

    await page.goto('/ats-checker');
    await fillAndSubmit(page);

    // The precise copy is translated, so assert the negative that matters:
    // the user is returned to a usable form rather than left on a spinner.
    await expect(page.getByTestId('analyze-button')).toBeVisible();
    await expect(page.getByTestId('ats-score-display')).toHaveCount(0);
  });
});
