/**
 * @jest-environment node
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals';

// History downloads with the web gate on (spec 16.7): the server decides, and a
// 402 sends the user to the pack sheet instead of a tab showing raw JSON.

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
  jest.resetModules();
});

function mockFetch(handler: (url: string, init?: RequestInit) => { status: number; json: unknown }) {
  global.fetch = (async (url: string, init?: RequestInit) => {
    const { status, json } = handler(url, init);
    return new Response(JSON.stringify(json), { status });
  }) as unknown as typeof fetch;
}

describe('unlockWebExport', () => {
  it.each([
    [200, { status: 'unlocked' }, 'ok'],
    [402, { error: 'export_credits_required' }, 'needs_credit'],
    [401, { error: 'account_required' }, 'account_required'],
    [500, { error: 'export_unlock_failed' }, 'error'],
  ])('maps %i to %s', async (status, json, expected) => {
    mockFetch(() => ({ status, json }));
    const { unlockWebExport } = require('@/lib/web-export-gate');
    await expect(unlockWebExport('opt-1')).resolves.toBe(expected);
  });

  it('sends the optimization id to the unlock route', async () => {
    const calls: Array<{ url: string; body: string }> = [];
    mockFetch((url, init) => {
      calls.push({ url, body: String(init?.body) });
      return { status: 200, json: { status: 'ungated' } };
    });
    const { unlockWebExport } = require('@/lib/web-export-gate');
    await unlockWebExport('opt-9');
    expect(calls).toEqual([{ url: '/api/v1/exports/unlock', body: JSON.stringify({ optimizationId: 'opt-9' }) }]);
  });
});

describe('readWebExportGate', () => {
  it('is false when the server says not gated or cannot be reached', async () => {
    mockFetch(() => ({ status: 200, json: { gated: false } }));
    expect(await require('@/lib/web-export-gate').readWebExportGate()).toBe(false);
    jest.resetModules();
    global.fetch = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
    expect(await require('@/lib/web-export-gate').readWebExportGate()).toBe(false);
  });

  it('is true when gated', async () => {
    mockFetch(() => ({ status: 200, json: { gated: true, packs: [] } }));
    expect(await require('@/lib/web-export-gate').readWebExportGate()).toBe(true);
  });
});
