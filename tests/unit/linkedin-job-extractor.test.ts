import fs from 'fs';
import path from 'path';
import {
  extractFromLinkedIn,
  extractJob,
  extractLinkedInJobId,
  isThinExtraction,
  ThinJobExtractionError,
} from '@/lib/scraper/jobExtractor';

const FIXTURE_DIR = path.join(__dirname, '../fixtures/linkedin');
const guestHtml = fs.readFileSync(path.join(FIXTURE_DIR, 'guest-fragment.html'), 'utf8');
const authwallHtml = fs.readFileSync(path.join(FIXTURE_DIR, 'authwall-fragment.html'), 'utf8');

const GUEST_URL =
  'https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/4429904263';

describe('extractFromLinkedIn — guest fragment', () => {
  it('populates title, company, body, and requirement lists', async () => {
    const result = await extractFromLinkedIn(guestHtml, GUEST_URL);

    expect(result.job_title).toBe('Partnership Manager - Base44');
    expect(result.company_name).toBe('Base44');
    // The full posting body is recovered into about_this_job (no <p> tags in the
    // guest fragment), so the scorer always has real JD text.
    expect((result.about_this_job || '').length).toBeGreaterThan(1000);

    const listCount =
      (result.requirements?.length ?? 0) +
      (result.qualifications?.length ?? 0) +
      (result.responsibilities?.length ?? 0);
    expect(listCount).toBeGreaterThan(0);

    expect(isThinExtraction(result)).toBe(false);
  });
});

describe('isThinExtraction — authwall fragment', () => {
  it('flags the degraded meta-only page as thin', async () => {
    const result = await extractFromLinkedIn(
      authwallHtml,
      'https://www.linkedin.com/jobs/view/4429904263'
    );
    expect(isThinExtraction(result)).toBe(true);
  });
});

describe('extractLinkedInJobId', () => {
  it('reads /jobs/view/{id}', () => {
    expect(
      extractLinkedInJobId(new URL('https://www.linkedin.com/jobs/view/3812345678'))
    ).toBe('3812345678');
  });

  it('reads the currentJobId query param', () => {
    expect(
      extractLinkedInJobId(
        new URL('https://www.linkedin.com/jobs/collections/recommended?currentJobId=3812345678')
      )
    ).toBe('3812345678');
  });

  it('reads a trailing numeric id', () => {
    expect(
      extractLinkedInJobId(
        new URL('https://www.linkedin.com/jobs/partnership-manager-at-base44-4429904263')
      )
    ).toBe('4429904263');
  });

  it('returns null for a non-job URL', () => {
    expect(
      extractLinkedInJobId(new URL('https://www.linkedin.com/feed/'))
    ).toBeNull();
  });
});

describe('extractJob — thinness gate (mocked fetch)', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
    jest.restoreAllMocks();
  });

  function mockFetchHtml(html: string) {
    // jsdom doesn't define fetch/Response as own-properties, so assign a stub
    // that returns the minimal shape extractJob's fetchHtml() reads.
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => html,
    }) as unknown as typeof fetch;
  }

  it('rejects with ThinJobExtractionError on the authwall page', async () => {
    mockFetchHtml(authwallHtml);
    await expect(
      extractJob('https://www.linkedin.com/jobs/view/4429904263')
    ).rejects.toBeInstanceOf(ThinJobExtractionError);
  });

  it('resolves with populated requirements on the guest fragment', async () => {
    mockFetchHtml(guestHtml);
    const result = await extractJob('https://www.linkedin.com/jobs/view/4429904263');
    const listCount =
      (result.requirements?.length ?? 0) +
      (result.qualifications?.length ?? 0) +
      (result.responsibilities?.length ?? 0);
    expect(listCount).toBeGreaterThan(0);
    expect(isThinExtraction(result)).toBe(false);
  });
});
