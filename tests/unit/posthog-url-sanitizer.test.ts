import {
  sanitizeAnalyticsUrl,
  sanitizePostHogProperties,
} from '@/lib/posthog';

const FAKE_ACCESS_TOKEN = 'fake-access-token-value';
const FAKE_REFRESH_TOKEN = 'fake-refresh-token-value';

describe('posthog URL sanitizer', () => {
  it('strips auth callback hash tokens down to pathname only', () => {
    const leakedUrl =
      `https://resumely.app/en/auth/callback#access_token=${FAKE_ACCESS_TOKEN}` +
      `&refresh_token=${FAKE_REFRESH_TOKEN}&type=magiclink`;

    expect(sanitizeAnalyticsUrl(leakedUrl)).toBe('/en/auth/callback');
  });

  it('strips auth reset-password query and hash down to pathname only', () => {
    const leakedUrl =
      'https://resumely.app/he/auth/reset-password?code=fake-code&email=user%40example.com#access_token=fake-token';

    expect(sanitizeAnalyticsUrl(leakedUrl)).toBe('/he/auth/reset-password');
  });

  it('removes sensitive params from non-auth URLs while preserving safe query params', () => {
    const url =
      'https://resumely.app/en/dashboard?utm_source=google&access_token=leaked-token&tab=overview';

    expect(sanitizeAnalyticsUrl(url)).toBe(
      'https://resumely.app/en/dashboard?utm_source=google&tab=overview',
    );
  });

  it('removes sensitive hash params from non-auth URLs', () => {
    const url =
      'https://resumely.app/en/pricing#access_token=leaked-token&plan=pro';

    expect(sanitizeAnalyticsUrl(url)).toBe('https://resumely.app/en/pricing#plan=pro');
  });

  it('never leaves auth callback tokens intact in properties sent to posthog.capture', () => {
    const leakedUrl =
      `/auth/callback#access_token=${FAKE_ACCESS_TOKEN}` +
      `&refresh_token=${FAKE_REFRESH_TOKEN}&type=magiclink`;

    const sanitized = sanitizePostHogProperties(
      {
        $current_url: `https://resumely.app${leakedUrl}`,
        $pathname: '/auth/callback',
      },
    );

    expect(sanitized.$current_url).toBe('/auth/callback');
    expect(String(sanitized.$current_url)).not.toContain('access_token');
    expect(String(sanitized.$current_url)).not.toContain('refresh_token');
    expect(String(sanitized.$current_url)).not.toContain(FAKE_ACCESS_TOKEN);
    expect(String(sanitized.$current_url)).not.toContain(FAKE_REFRESH_TOKEN);
    expect(sanitized.$pathname).toBe('/auth/callback');
  });
});
