/**
 * @jest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

// StoreKit spec 16.3 step 2 and the checkout tests in 16.11: anonymous gets
// 401, unknown priceId gets 400, the paddle_checkouts row carries the caller's
// user ID. The Paddle API is mocked; the founder's sandbox run (L4) is the
// live check.

const USER = '11111111-1111-4111-8111-111111111111';
const ENV = { PADDLE_API_KEY: 'pdl_sdbx_apikey_test', PADDLE_PRICE_MAP: 'pri_one:1,pri_five:5,pri_ten:10', PADDLE_ENVIRONMENT: 'sandbox' };

function load({
  user = { id: USER, is_anonymous: false } as { id: string; is_anonymous?: boolean } | null,
  created = { ok: true, transactionId: 'txn_01abc' } as { ok: boolean; transactionId?: string; status?: number },
  insertError = null as { message: string } | null,
} = {}) {
  jest.resetModules();
  const insert = jest.fn<(row: Record<string, unknown>) => Promise<{ error: typeof insertError }>>(async () => ({ error: insertError }));
  const createPaddleTransaction = jest.fn<(...args: unknown[]) => Promise<typeof created>>(async () => created);
  const captureServerEvent = jest.fn<(...args: unknown[]) => Promise<undefined>>(async () => undefined);
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
  jest.doMock('@/lib/supabase-server', () => ({
    __esModule: true,
    createRouteHandlerClient: async () => ({ auth: { getUser: async () => ({ data: { user }, error: null }) } }),
    createServiceRoleClient: () => ({ from: () => ({ insert }) }),
  }));
  jest.doMock('@/lib/paddle', () => {
    const actual = jest.requireActual('@/lib/paddle') as Record<string, unknown>;
    return { __esModule: true, ...actual, createPaddleTransaction };
  });
  jest.doMock('@/lib/posthog-server', () => ({ __esModule: true, captureServerEvent }));
  const { POST } = require('@/app/api/v1/web-checkout/route');
  return { POST, insert, createPaddleTransaction, captureServerEvent };
}

const request = (body: unknown) => ({ json: async () => body, headers: { get: () => null } }) as any;

describe('POST /api/v1/web-checkout', () => {
  const saved = { ...process.env };
  beforeEach(() => {
    Object.assign(process.env, ENV);
  });
  afterEach(() => {
    for (const key of Object.keys(ENV)) delete process.env[key];
    Object.assign(process.env, saved);
  });

  it('creates the transaction, binds it to the caller, and returns its ID', async () => {
    const { POST, insert, createPaddleTransaction, captureServerEvent } = load();
    const response = await POST(request({ priceId: 'pri_five' }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ transactionId: 'txn_01abc' });
    expect(createPaddleTransaction).toHaveBeenCalledWith(expect.objectContaining({ environment: 'Sandbox' }), 'pri_five', USER);
    expect(insert).toHaveBeenCalledWith({ paddle_transaction_id: 'txn_01abc', user_id: USER, price_id: 'pri_five', environment: 'Sandbox' });
    expect(captureServerEvent).toHaveBeenCalledWith(USER, 'web_checkout_opened', expect.objectContaining({ price_id: 'pri_five' }));
  });

  it('503 without the Paddle config', async () => {
    delete process.env.PADDLE_API_KEY;
    const { POST, createPaddleTransaction } = load();
    expect((await POST(request({ priceId: 'pri_five' }))).status).toBe(503);
    expect(createPaddleTransaction).not.toHaveBeenCalled();
  });

  it('401 for no user, and account_required for an anonymous session', async () => {
    const none = load({ user: null });
    expect((await none.POST(request({ priceId: 'pri_five' }))).status).toBe(401);
    const anonymous = load({ user: { id: USER, is_anonymous: true } });
    const response = await anonymous.POST(request({ priceId: 'pri_five' }));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'account_required' });
    expect(anonymous.createPaddleTransaction).not.toHaveBeenCalled();
  });

  it('400 for a price that is not in the map', async () => {
    const { POST, createPaddleTransaction, insert } = load();
    expect((await POST(request({ priceId: 'pri_other' }))).status).toBe(400);
    expect(createPaddleTransaction).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it('502 and no checkout row when Paddle refuses', async () => {
    const { POST, insert } = load({ created: { ok: false, status: 401 } });
    expect((await POST(request({ priceId: 'pri_five' }))).status).toBe(502);
    expect(insert).not.toHaveBeenCalled();
  });

  it('500 when the checkout row cannot be written (nothing is returned to open)', async () => {
    const { POST } = load({ insertError: { message: 'permission denied' } });
    const response = await POST(request({ priceId: 'pri_five' }));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'checkout_unavailable' });
  });
});

describe('createPaddleTransaction', () => {
  it('calls the sandbox API with the key, one price at quantity 1, and the user as custom_data', async () => {
    const { createPaddleTransaction, getPaddleCheckoutConfig } = jest.requireActual('@/lib/paddle') as typeof import('@/lib/paddle');
    const config = getPaddleCheckoutConfig(ENV)!;
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fakeFetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ data: { id: 'txn_01xyz', status: 'draft' } }), { status: 201 });
    }) as unknown as typeof fetch;

    await expect(createPaddleTransaction(config, 'pri_five', USER, fakeFetch)).resolves.toEqual({ ok: true, transactionId: 'txn_01xyz' });
    expect(calls[0].url).toBe('https://sandbox-api.paddle.com/transactions');
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer pdl_sdbx_apikey_test');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ items: [{ price_id: 'pri_five', quantity: 1 }], custom_data: { user_id: USER } });
  });

  it('uses the live API in production and fails closed on a bad answer', async () => {
    const { createPaddleTransaction, getPaddleCheckoutConfig } = jest.requireActual('@/lib/paddle') as typeof import('@/lib/paddle');
    const config = getPaddleCheckoutConfig({ ...ENV, PADDLE_ENVIRONMENT: 'production' })!;
    expect(config.apiBase).toBe('https://api.paddle.com');
    const noId = (async () => new Response(JSON.stringify({ data: {} }), { status: 201 })) as unknown as typeof fetch;
    await expect(createPaddleTransaction(config, 'pri_five', USER, noId)).resolves.toEqual({ ok: false, status: 502 });
    const refused = (async () => new Response('{}', { status: 403 })) as unknown as typeof fetch;
    await expect(createPaddleTransaction(config, 'pri_five', USER, refused)).resolves.toEqual({ ok: false, status: 403 });
    const offline = (async () => { throw new Error('ENOTFOUND'); }) as unknown as typeof fetch;
    await expect(createPaddleTransaction(config, 'pri_five', USER, offline)).resolves.toEqual({ ok: false, status: 504 });
  });
});
