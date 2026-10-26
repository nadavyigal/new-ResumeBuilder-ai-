/** @jest-environment node */
import { describe, expect, it, jest } from '@jest/globals';

function load({
  user = { id: 'user-1' } as { id: string } | null,
  insertError = null as { message: string } | null,
} = {}) {
  jest.resetModules();
  const insert = jest.fn(async () => ({ error: insertError }));
  const routeClient = { auth: { getUser: jest.fn(async () => ({ data: { user }, error: null })) } };
  jest.doMock('@/lib/supabase-server', () => ({
    createRouteHandlerClient: async () => routeClient,
    createServiceRoleClient: () => ({ from: () => ({ insert }) }),
  }));
  jest.doMock('next/server', () => ({
    NextResponse: class {
      status: number;
      body: unknown;
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
  const { POST } = require('@/app/api/v1/ai-consent/route');
  return { POST, insert };
}

function request(body: unknown) {
  return { headers: new Headers(), json: async () => body };
}

describe('POST /api/v1/ai-consent', () => {
  it('rejects a caller with no session', async () => {
    const { POST, insert } = load({ user: null });
    const response = await POST(request({ version: 'ai_data_consent_v1', action: 'grant' }));
    expect(response.status).toBe(401);
    expect(insert).not.toHaveBeenCalled();
  });

  it('rejects an unknown version or action', async () => {
    const { POST, insert } = load();
    const response = await POST(request({ version: 'ai_data_consent_v9', action: 'grant' }));
    expect(response.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it('stores a grant for the token user, not a user id from the body', async () => {
    const { POST, insert } = load();
    const response = await POST(request({
      version: 'ai_data_consent_v1',
      action: 'grant',
      userId: 'someone-else',
      clientRecordedAt: '2026-10-26T08:00:00.000Z',
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ recorded: true, action: 'grant' });
    expect(insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      consent_version: 'ai_data_consent_v1',
      action: 'grant',
      client_recorded_at: '2026-10-26T08:00:00.000Z',
    });
  });

  it('stores a withdrawal as its own row', async () => {
    const { POST, insert } = load();
    const response = await POST(request({ version: 'ai_data_consent_v1', action: 'withdraw' }));
    expect(response.status).toBe(200);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ action: 'withdraw', user_id: 'user-1' }));
  });

  it('says the record is unavailable when the table is not migrated yet', async () => {
    const { POST } = load({ insertError: { message: 'relation "ai_consent_records" does not exist' } });
    const response = await POST(request({ version: 'ai_data_consent_v1', action: 'grant' }));
    expect(response.status).toBe(503);
    expect((await response.json()).error).toBe('ai_consent_unavailable');
  });
});
