import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

function loadRouteHarness() {
  jest.resetModules();

  const createRouteHandlerClient = jest.fn();
  const captureServerEvent = jest.fn();

  jest.doMock('@/lib/supabase-server', () => ({
    __esModule: true,
    createRouteHandlerClient,
  }));

  jest.doMock('@/lib/posthog-server', () => ({
    __esModule: true,
    captureServerEvent,
  }));

  const { POST } = require('@/app/api/upgrade/route');
  return { POST, createRouteHandlerClient, captureServerEvent };
}

describe('POST /api/upgrade expert-mode source handling', () => {
  const originalFetch = global.fetch;
  const originalSecret = process.env.STRIPE_SECRET_KEY;
  const originalPrice = process.env.STRIPE_PRICE_ID_PREMIUM;
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    process.env.STRIPE_PRICE_ID_PREMIUM = 'price_123';
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.STRIPE_SECRET_KEY = originalSecret;
    process.env.STRIPE_PRICE_ID_PREMIUM = originalPrice;
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  });

  it('passes expert_mode through checkout metadata and analytics', async () => {
    const { POST, createRouteHandlerClient, captureServerEvent } = loadRouteHarness();
    createRouteHandlerClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: {
            user: {
              id: 'user-1',
              email: 'ada@example.com',
            },
          },
        }),
      },
    });

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/pay/cs_test_123',
      }),
    });
    global.fetch = fetchMock as any;

    const request = new Request('http://localhost/api/upgrade', {
      method: 'POST',
      body: JSON.stringify({
        plan: 'premium',
        locale: 'en',
        source: 'expert_mode',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.checkoutUrl).toBe('https://checkout.stripe.com/pay/cs_test_123');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, requestInit] = fetchMock.mock.calls[0];
    const params = new URLSearchParams(requestInit.body as string);

    expect(params.get('metadata[source]')).toBe('expert_mode');
    expect(params.get('success_url')).toContain('source=expert_mode');
    expect(captureServerEvent).toHaveBeenCalledWith('user-1', 'upgrade_clicked_from_expert', {
      source: 'expert_mode',
    });
  });
});
