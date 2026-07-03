import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

function loadRouteHarness() {
  jest.resetModules();

  const createRouteHandlerClient = jest.fn(async () => ({} as any));
  const captureServerEvent = jest.fn();

  jest.doMock('@/lib/supabase-server', () => ({
    __esModule: true,
    createRouteHandlerClient,
  }));

  jest.doMock('@/lib/posthog-server', () => ({
    __esModule: true,
    captureServerEvent,
  }));

  jest.doMock('next/server', () => ({
    __esModule: true,
    NextResponse: class {
      status: number;
      private body: unknown;

      constructor(body: unknown, init?: { status?: number }) {
        this.body = body;
        this.status = init?.status ?? 200;
      }

      static json(body: unknown, init?: { status?: number }) {
        return new this(body, init);
      }

      async json() {
        return this.body;
      }
    },
  }));

  const { POST } = require('@/app/api/upgrade/route');
  return { POST, createRouteHandlerClient, captureServerEvent };
}

describe('POST /api/upgrade monetization gate', () => {
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

  it('blocks checkout while Gate A is closed', async () => {
    const { POST, createRouteHandlerClient, captureServerEvent } = loadRouteHarness();
    createRouteHandlerClient.mockResolvedValue({
      auth: {
        getUser: jest.fn(async () => ({
          data: {
            user: {
              id: 'user-1',
              email: 'ada@example.com',
            },
          },
        })),
      },
    });

    const fetchMock = jest.fn();
    global.fetch = fetchMock as any;

    const request = {
      json: async () => ({
        plan: 'premium',
        locale: 'en',
        source: 'expert_mode',
      }),
    } as any;

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toEqual({
      success: false,
      code: 'MONETIZATION_GATE_CLOSED',
      error: 'Premium upgrades are not open yet.',
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(captureServerEvent).not.toHaveBeenCalled();
  });
});
