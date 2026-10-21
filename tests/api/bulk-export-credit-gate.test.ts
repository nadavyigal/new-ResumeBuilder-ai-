/** @jest-environment node */
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

type Result = { data: { status: string; balance?: number } | null; error: { message: string } | null };
const unlocked: Result = { data: { status: 'unlocked', balance: 0 }, error: null };
function load({ user = { id: 'user-1', is_anonymous: false } as { id: string; is_anonymous?: boolean } | null,
  rows = ['opt-1', 'opt-2'], results = [unlocked, unlocked], client = 'ios' } = {}) {
  jest.resetModules();
  const eq = jest.fn(async () => ({ data: rows.map(id => ({ id, created_at: '2026-10-21', match_score: 0.8,
    rewrite_data: { name: id }, template_key: 'test' })), error: null }));
  const query = { select: jest.fn(() => query), in: jest.fn(() => query), eq };
  const routeClient = { auth: { getUser: jest.fn(async () => ({ data: { user } })) }, from: jest.fn(() => query) };
  let calls = 0;
  const rpc = jest.fn(async () => results[calls++] ?? unlocked);
  const generateResumePDF = jest.fn(async () => Buffer.from('test-pdf'));
  jest.doMock('@/lib/supabase-server', () => ({ createRouteHandlerClient: async () => routeClient,
    createServiceRoleClient: () => ({ rpc }) }));
  jest.doMock('@/lib/pdf-generator', () => ({ generateResumePDF }));
  jest.doMock('@/lib/posthog-server', () => ({ captureServerEvent: jest.fn(async () => {}) }));
  jest.doMock('next/server', () => ({ NextResponse: class {
    status: number; body: unknown;
    constructor(body: unknown, init?: { status?: number }) { this.body = body; this.status = init?.status ?? 200; }
    static json(body: unknown, init?: { status?: number }) { return new this(body, init); }
    async json() { return this.body; }
  } }));
  const { POST } = require('@/app/api/optimizations/export/route');
  const request = { headers: new Headers({ 'x-resumely-client': client }), json: async () => ({ ids: ['opt-1','opt-2'] }) };
  return { POST, request, rpc, generateResumePDF, eq };
}
const previousFlag = process.env.EXPORT_CREDITS_ENABLED;
afterEach(() => { if (previousFlag === undefined) delete process.env.EXPORT_CREDITS_ENABLED;
  else process.env.EXPORT_CREDITS_ENABLED = previousFlag; });

describe('bulk exports enforce the same credit gate as individual downloads', () => {
  it('checks each owned optimization before any PDF rendering', async () => {
    process.env.EXPORT_CREDITS_ENABLED = 'true';
    const h = load();
    expect((await h.POST(h.request)).status).toBe(200);
    expect(h.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(h.rpc).toHaveBeenCalledTimes(2);
    for (const optimizationId of ['opt-1','opt-2']) expect(h.rpc).toHaveBeenCalledWith('unlock_export', {
      p_user_id: 'user-1', p_optimization_id: optimizationId, p_charge: true,
    });
    expect(h.generateResumePDF).toHaveBeenCalledTimes(2);
    expect(h.rpc.mock.invocationCallOrder[1]).toBeLessThan(h.generateResumePDF.mock.invocationCallOrder[0]);
  });

  it.each([
    ['insufficient', 402, 'export_credits_required'],
    ['not_found', 404, 'Optimization not found'],
    ['error', 500, 'export_unlock_failed'],
  ])('refuses the entire response before rendering when the second unlock is %s', async (status, http, error) => {
    process.env.EXPORT_CREDITS_ENABLED = 'true';
    const result: Result = status === 'error' ? { data: null, error: { message: 'offline' } }
      : { data: { status, balance: 0 }, error: null };
    const h = load({ results: [unlocked, result] });
    const response = await h.POST(h.request);
    expect(response.status).toBe(http);
    expect((await response.json()).error).toBe(error);
    expect(h.generateResumePDF).not.toHaveBeenCalled();
  });

  it.each([['true','web'], ['false','ios']])('records ungated exports with flag %s and client %s', async (flag, client) => {
    process.env.EXPORT_CREDITS_ENABLED = flag;
    const h = load({ client, results: [{ data: { status:'ungated' }, error: null }, { data: { status:'ungated' }, error: null }] });
    expect((await h.POST(h.request)).status).toBe(200);
    expect(h.rpc).toHaveBeenCalledTimes(2);
    expect(h.rpc).toHaveBeenCalledWith('unlock_export', expect.objectContaining({ p_charge:false }));
  });

  it('keeps ungated exports available before the migration exists', async () => {
    process.env.EXPORT_CREDITS_ENABLED = 'false';
    const h = load({ results: Array(2).fill({ data: null, error: { message:'function does not exist' } }) });
    expect((await h.POST(h.request)).status).toBe(200);
    expect(h.generateResumePDF).toHaveBeenCalledTimes(2);
  });

  it('rejects anonymous charged exports before any RPC or rendering', async () => {
    process.env.EXPORT_CREDITS_ENABLED = 'true';
    const h = load({ user:{ id:'guest', is_anonymous:true } });
    expect((await h.POST(h.request)).status).toBe(401);
    expect(h.rpc).not.toHaveBeenCalled(); expect(h.generateResumePDF).not.toHaveBeenCalled();
  });

  it('does not unlock a requested row absent from the ownership query', async () => {
    process.env.EXPORT_CREDITS_ENABLED = 'true';
    const h = load({ rows:[] });
    expect((await h.POST(h.request)).status).toBe(404);
    expect(h.rpc).not.toHaveBeenCalled(); expect(h.generateResumePDF).not.toHaveBeenCalled();
  });

  it('removes the unused apply-job PDF endpoint instead of leaving a second bypass', () => {
    expect(existsSync(join(process.cwd(), 'src/app/api/apply-job/route.ts'))).toBe(false);
  });
});
