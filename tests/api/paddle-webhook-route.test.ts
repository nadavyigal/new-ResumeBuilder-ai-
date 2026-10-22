/**
 * @jest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createHmac } from 'node:crypto';

// StoreKit spec 16.4, 16.5 and the webhook tests in 16.11. Supabase is mocked;
// scripts/tests/paddle-local-db.mjs proves the SQL behind the two RPCs.

const SECRET = 'pdl_ntfset_test_secret';
const USER = '11111111-1111-4111-8111-111111111111';
const ENV = {
  PADDLE_WEBHOOK_SECRET: SECRET,
  PADDLE_PRICE_MAP: 'pri_one:1,pri_five:5,pri_ten:10',
  PADDLE_ENVIRONMENT: 'sandbox',
};

type Rows = {
  checkout?: { user_id?: string; price_id?: string; environment?: string } | null;
  grantDelta?: number | null;
  seenEvent?: boolean;
};

function signed(payload: unknown, { ts = Math.floor(Date.now() / 1000), secret = SECRET, header }: { ts?: number; secret?: string; header?: string | null } = {}) {
  const body = JSON.stringify(payload);
  const signature = createHmac('sha256', secret).update(`${ts}:${body}`).digest('hex');
  const value = header === undefined ? `ts=${ts};h1=${signature}` : header;
  return {
    text: async () => body,
    headers: { get: (name: string) => (name.toLowerCase() === 'paddle-signature' ? value : null) },
  } as any;
}

function completed(overrides: Record<string, unknown> = {}) {
  return {
    event_id: 'evt_1',
    event_type: 'transaction.completed',
    data: { id: 'txn_1', status: 'completed', custom_data: { user_id: USER }, items: [{ price: { id: 'pri_five' }, quantity: 1 }], ...overrides },
  };
}

function adjustment(data: Record<string, unknown>, type = 'adjustment.created') {
  return { event_id: 'evt_adj', event_type: type, data: { id: 'adj_1', transaction_id: 'txn_1', type: 'full', ...data } };
}

function load({
  rows = { checkout: { user_id: USER, price_id: 'pri_five', environment: 'Sandbox' }, grantDelta: 5 } as Rows,
  rpcResult = { data: { status: 'granted', balance: 6 }, error: null } as { data: unknown; error: { message: string } | null },
  readError = null as { message: string } | null,
  capture = (async () => undefined) as (...args: unknown[]) => Promise<undefined>,
} = {}) {
  jest.resetModules();
  const rpc = jest.fn<(fn: string, args: Record<string, unknown>) => Promise<typeof rpcResult>>(async () => rpcResult);
  const upsert = jest.fn<(...args: unknown[]) => Promise<{ error: null }>>(async () => ({ error: null }));
  const from = jest.fn((table: string) => {
    const query: any = {
      select: () => query,
      eq: () => query,
      maybeSingle: async () => {
        if (readError) return { data: null, error: readError };
        if (table === 'paddle_events') return { data: rows.seenEvent ? { event_id: 'evt' } : null, error: null };
        if (table === 'paddle_checkouts') return { data: rows.checkout ?? null, error: null };
        if (table === 'credit_transactions') return { data: rows.grantDelta == null ? null : { delta: rows.grantDelta }, error: null };
        return { data: null, error: null };
      },
      upsert,
    };
    return query;
  });
  const captureServerEvent = jest.fn<(...args: unknown[]) => Promise<undefined>>(capture);

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
  jest.doMock('@/lib/supabase-server', () => ({ __esModule: true, createServiceRoleClient: () => ({ rpc, from }) }));
  jest.doMock('@/lib/posthog-server', () => ({ __esModule: true, captureServerEvent }));
  const { POST } = require('@/app/api/v1/paddle/webhook/route');
  return { POST, rpc, upsert, captureServerEvent };
}

describe('POST /api/v1/paddle/webhook', () => {
  const saved = { ...process.env };
  beforeEach(() => {
    Object.assign(process.env, ENV);
  });
  afterEach(() => {
    for (const key of Object.keys(ENV)) delete process.env[key];
    Object.assign(process.env, saved);
  });

  it('grants the mapped credits once, to the checkout user, and records the event after handling', async () => {
    const { POST, rpc, upsert, captureServerEvent } = load();
    const response = await POST(signed(completed({ items: [{ price: { id: 'pri_five' }, quantity: 2 }] })));
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('grant_paddle_credits', {
      p_user_id: USER,
      p_delta: 10,
      p_paddle_transaction_id: 'txn_1',
      p_price_id: 'pri_five',
      p_environment: 'Sandbox',
    });
    expect(upsert).toHaveBeenCalledWith({ event_id: 'evt_1', event_type: 'transaction.completed' }, expect.anything());
    expect(captureServerEvent).toHaveBeenCalledWith(USER, 'paddle_purchase_granted', expect.objectContaining({ credits_granted: 10, status: 'granted', store: 'paddle' }));
  });

  it('503 and no change without config', async () => {
    delete process.env.PADDLE_WEBHOOK_SECRET;
    const { POST, rpc } = load();
    const response = await POST(signed(completed()));
    expect(response.status).toBe(503);
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    ['a bad signature', { secret: 'pdl_ntfset_wrong' }],
    ['a missing header', { header: null }],
    ['a timestamp older than 5 seconds', { ts: Math.floor(Date.now() / 1000) - 60 }],
  ])('401 and no change for %s', async (_label, options) => {
    const { POST, rpc, upsert } = load();
    const response = await POST(signed(completed(), options as any));
    expect(response.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it('accepts a second h1 during secret rotation', async () => {
    const { POST, rpc } = load();
    const ts = Math.floor(Date.now() / 1000);
    const body = JSON.stringify(completed());
    const good = createHmac('sha256', SECRET).update(`${ts}:${body}`).digest('hex');
    const old = createHmac('sha256', 'pdl_ntfset_old').update(`${ts}:${body}`).digest('hex');
    const request = { text: async () => body, headers: { get: () => `ts=${ts};h1=${old};h1=${good}` } } as any;
    expect((await POST(request)).status).toBe(200);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('a rejected request does not wait on analytics', async () => {
    const { POST } = load({ capture: () => new Promise<undefined>(() => {}) });
    const response = await POST(signed(completed(), { secret: 'pdl_ntfset_wrong' }));
    expect(response.status).toBe(401);
  });

  it('an analytics failure after the grant still answers 200 (no retry loop)', async () => {
    const { POST, rpc } = load({ capture: async () => { throw new Error('posthog down'); } });
    const response = await POST(signed(completed()));
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('a checkout from the other Paddle environment grants nothing', async () => {
    const { POST, rpc, captureServerEvent } = load({ rows: { checkout: { user_id: USER, environment: 'Production' } } });
    const response = await POST(signed(completed()));
    expect(response.status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
    expect(captureServerEvent).toHaveBeenCalledWith('server', 'paddle_webhook_rejected', { reason: 'environment_mismatch' });
  });

  it('a grant the database calls unbound answers 200 without the granted event', async () => {
    const { POST, captureServerEvent } = load({ rpcResult: { data: { status: 'unbound' }, error: null } });
    expect((await POST(signed(completed()))).status).toBe(200);
    expect(captureServerEvent).not.toHaveBeenCalledWith(USER, 'paddle_purchase_granted', expect.anything());
  });

  it('a repeated event_id changes nothing', async () => {
    const { POST, rpc } = load({ rows: { checkout: { user_id: USER, environment: 'Sandbox' }, seenEvent: true } });
    const response = await POST(signed(completed()));
    expect(response.status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('a transaction with no paddle_checkouts row grants nothing and answers 200', async () => {
    const { POST, rpc, captureServerEvent } = load({ rows: { checkout: null } });
    const response = await POST(signed(completed()));
    expect(response.status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
    expect(captureServerEvent).toHaveBeenCalledWith('server', 'paddle_webhook_rejected', { reason: 'unbound_transaction' });
  });

  it('custom_data naming another user grants nothing', async () => {
    const { POST, rpc } = load();
    const response = await POST(signed(completed({ custom_data: { user_id: '22222222-2222-4222-8222-222222222222' } })));
    expect(response.status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('an unknown price ID grants nothing', async () => {
    const { POST, rpc } = load();
    const response = await POST(signed(completed({ items: [{ price: { id: 'pri_unknown' }, quantity: 1 }] })));
    expect(response.status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('a database failure answers 500 so Paddle retries, and the event is not recorded', async () => {
    const { POST, upsert } = load({ rpcResult: { data: null, error: { message: 'connection reset' } } });
    const response = await POST(signed(completed()));
    expect(response.status).toBe(500);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('a read failure answers 500', async () => {
    const { POST, rpc } = load({ readError: { message: 'timeout' } });
    const response = await POST(signed(completed()));
    expect(response.status).toBe(500);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('an unparseable body after a valid signature is 400', async () => {
    const { POST, rpc } = load();
    const ts = Math.floor(Date.now() / 1000);
    const body = 'not json';
    const request = {
      text: async () => body,
      headers: { get: () => `ts=${ts};h1=${createHmac('sha256', SECRET).update(`${ts}:${body}`).digest('hex')}` },
    } as any;
    expect((await POST(request)).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('other event types are ignored with 200', async () => {
    const { POST, rpc } = load();
    const response = await POST(signed({ event_id: 'evt_9', event_type: 'customer.created', data: { id: 'ctm_1' } }));
    expect(response.status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
  });

  describe('adjustments', () => {
    it('pending_approval changes nothing', async () => {
      const { POST, rpc } = load();
      expect((await POST(signed(adjustment({ action: 'refund', status: 'pending_approval' })))).status).toBe(200);
      expect(rpc).not.toHaveBeenCalled();
    });

    it('an approved full refund deducts the pack through apply_paddle_adjustment', async () => {
      const { POST, rpc, captureServerEvent } = load({
        rpcResult: { data: { status: 'deducted', user_id: USER, credits_changed: -5 }, error: null },
      });
      const response = await POST(signed(adjustment({ action: 'refund', status: 'approved' }, 'adjustment.updated')));
      expect(response.status).toBe(200);
      expect(rpc).toHaveBeenCalledWith('apply_paddle_adjustment', {
        p_paddle_transaction_id: 'txn_1',
        p_paddle_adjustment_id: 'adj_1',
        p_action: 'refund',
        p_credits: 5,
      });
      expect(captureServerEvent).toHaveBeenCalledWith(USER, 'paddle_adjustment_processed', expect.objectContaining({ action: 'refund', credits_deducted: 5 }));
    });

    it('a refund before the grant uses the checkout pack and is kept by the database', async () => {
      const { POST, rpc } = load({
        rows: { checkout: { user_id: USER, price_id: 'pri_ten', environment: 'Sandbox' }, grantDelta: null },
        rpcResult: { data: { status: 'recorded_before_grant' }, error: null },
      });
      expect((await POST(signed(adjustment({ action: 'refund', status: 'approved' })))).status).toBe(200);
      expect(rpc).toHaveBeenCalledWith('apply_paddle_adjustment', expect.objectContaining({ p_credits: 10 }));
    });

    it('a chargeback reversal re-grants through the reverse action', async () => {
      const { POST, rpc } = load({ rpcResult: { data: { status: 'reversed', user_id: USER, credits_changed: 5 }, error: null } });
      expect((await POST(signed(adjustment({ action: 'chargeback_reverse', status: 'approved' })))).status).toBe(200);
      expect(rpc).toHaveBeenCalledWith('apply_paddle_adjustment', expect.objectContaining({ p_action: 'chargeback_reverse' }));
    });

    it('a chargeback deducts through the chargeback action', async () => {
      const { POST, rpc } = load({ rpcResult: { data: { status: 'deducted', user_id: USER, credits_changed: -5 }, error: null } });
      expect((await POST(signed(adjustment({ action: 'chargeback', status: 'approved' })))).status).toBe(200);
      expect(rpc).toHaveBeenCalledWith('apply_paddle_adjustment', expect.objectContaining({ p_action: 'chargeback', p_credits: 5 }));
    });

    it('an adjustment for a transaction with no checkout is sent with 0 credits and answered 200 (database says unbound)', async () => {
      const { POST, rpc } = load({ rows: { checkout: null, grantDelta: null }, rpcResult: { data: { status: 'unbound' }, error: null } });
      expect((await POST(signed(adjustment({ action: 'refund', status: 'approved' })))).status).toBe(200);
      expect(rpc).toHaveBeenCalledWith('apply_paddle_adjustment', expect.objectContaining({ p_credits: 0 }));
    });

    it('an adjustment whose checkout is from the other environment changes nothing', async () => {
      const { POST, rpc } = load({ rows: { checkout: { user_id: USER, price_id: 'pri_five', environment: 'Production' }, grantDelta: 5 } });
      expect((await POST(signed(adjustment({ action: 'refund', status: 'approved' })))).status).toBe(200);
      expect(rpc).not.toHaveBeenCalled();
    });

    it('a partial-amount refund deducts nothing', async () => {
      const { POST, rpc } = load();
      expect((await POST(signed(adjustment({ action: 'refund', status: 'approved', type: 'partial', items: [{ type: 'partial', amount: '100' }] })))).status).toBe(200);
      expect(rpc).not.toHaveBeenCalled();
    });

    it('a database failure answers 500 so Paddle retries', async () => {
      const { POST } = load({ rpcResult: { data: null, error: { message: 'deadlock' } } });
      expect((await POST(signed(adjustment({ action: 'refund', status: 'approved' })))).status).toBe(500);
    });
  });
});
