/** @jest-environment node */
import { describe, expect, it, jest } from '@jest/globals';

function load({ verifyError = null as { message: string } | null } = {}) {
  jest.resetModules();
  const verifyOtp = jest.fn(async (args: { type: string; token_hash: string }) => ({
    data: { user: verifyError ? null : { id: 'user-1', email: 'u@example.com' }, args },
    error: verifyError,
  }));
  const captureServerEvent = jest.fn<(...args: unknown[]) => Promise<undefined>>(
    async () => undefined
  );
  jest.doMock('next/headers', () => ({
    cookies: async () => ({ get: () => undefined, set: () => undefined }),
  }));
  jest.doMock('@supabase/ssr', () => ({
    createServerClient: () => ({ auth: { verifyOtp } }),
  }));
  jest.doMock('@/lib/posthog-server', () => ({ captureServerEvent }));
  jest.doMock('next/server', () => ({
    NextResponse: { redirect: (url: URL) => ({ status: 307, location: url.toString() }) },
  }));
  const { GET } = require('@/app/[locale]/auth/confirm/route');
  return { GET, verifyOtp, captureServerEvent };
}

function request(path: string) {
  const url = new URL(path, 'https://www.resumelybuilderai.com');
  return { url: url.toString(), nextUrl: { origin: url.origin, clone: () => new URL(url.toString()) } };
}

const params = (locale = 'en') => ({ params: Promise.resolve({ locale }) });

describe('GET /auth/confirm with a password reset link', () => {
  it('verifies the recovery token and sends the user to update-password', async () => {
    const { GET, verifyOtp, captureServerEvent } = load();
    const response = await GET(
      request('/auth/confirm?token_hash=th1&type=recovery&next=/auth/update-password'),
      params()
    );

    expect(verifyOtp).toHaveBeenCalledWith({ type: 'recovery', token_hash: 'th1' });
    expect(response.location).toBe('https://www.resumelybuilderai.com/auth/update-password');
    expect(captureServerEvent).not.toHaveBeenCalled();
  });

  it('keeps the Hebrew prefix on the update-password page', async () => {
    const { GET } = load();
    const response = await GET(
      request('/he/auth/confirm?token_hash=th1&type=recovery&next=/auth/update-password'),
      params('he')
    );

    expect(response.location).toBe('https://www.resumelybuilderai.com/he/auth/update-password');
  });

  it('still records signup_completed for a sign-up confirmation', async () => {
    const { GET, captureServerEvent } = load();
    await GET(request('/auth/confirm?token_hash=th2&type=signup'), params());

    expect(captureServerEvent).toHaveBeenCalledWith(
      'user-1',
      'signup_completed',
      expect.objectContaining({ source: 'email_confirmation' })
    );
  });

  it('sends a failed link to sign-in with an error', async () => {
    const { GET } = load({ verifyError: { message: 'expired' } });
    const response = await GET(
      request('/auth/confirm?token_hash=bad&type=recovery&next=/auth/update-password'),
      params()
    );

    expect(response.location).toContain('/auth/signin?error=confirmation_failed');
  });
});
