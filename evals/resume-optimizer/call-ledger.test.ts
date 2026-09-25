/**
 * @jest-environment node
 */
import { describe, it, expect, jest } from '@jest/globals';
import OpenAI from 'openai';
import { CallLedger, priceFor, costOf, summarizeCalls } from './call-ledger';

type FetchLike = (input: any, init?: any) => Promise<Response>;

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

function chatBody(model: string) {
  return {
    id: 'chatcmpl-test',
    object: 'chat.completion',
    created: 0,
    model,
    choices: [{ index: 0, message: { role: 'assistant', content: '{}' }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500, prompt_tokens_details: { cached_tokens: 200 } },
  };
}

function target(impl: FetchLike) {
  const inner = jest.fn(impl);
  return { inner, t: { fetch: inner as unknown as FetchLike } };
}

describe('call ledger (offline)', () => {
  it('records requested and returned model, usage, latency and cost for a chat call', async () => {
    const { t } = target(async () => jsonResponse(chatBody('gpt-4o-2024-08-06')));
    const ledger = new CallLedger();
    ledger.install(t);
    ledger.setContext('case#1', 'generation');
    await t.fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'X-Stainless-Retry-Count': '0' },
      body: JSON.stringify({ model: 'gpt-4o' }),
    });
    const [r] = ledger.records;
    expect(r).toMatchObject({ runKey: 'case#1', phase: 'generation', endpoint: 'chat.completions', requestedModel: 'gpt-4o', returnedModel: 'gpt-4o-2024-08-06', status: 200, retryCount: 0 });
    // 800 uncached * 2.50 + 200 cached * 1.25 + 500 out * 10.00, per million.
    expect(r.costUsd).toBeCloseTo((800 * 2.5 + 200 * 1.25 + 500 * 10) / 1e6, 10);
  });

  it('records an unknown model, and charges it at the worst known price so the cap still sees it', async () => {
    const { t } = target(async () => jsonResponse({ usage: { prompt_tokens: 1000, completion_tokens: 100, total_tokens: 1100 } }));
    const ledger = new CallLedger();
    ledger.install(t);
    await t.fetch('https://api.openai.com/v1/embeddings', { method: 'POST', body: 'not json' });
    expect(ledger.records[0]).toMatchObject({ endpoint: 'embeddings', requestedModel: 'unknown', returnedModel: 'unknown', costEstimated: true });
    // Worst known rates: $2.50 in, $10.00 out per million.
    expect(ledger.records[0].costUsd).toBeCloseTo((1000 * 2.5 + 100 * 10) / 1e6, 10);
    expect(summarizeCalls(ledger.records).unpricedCalls).toBe(1);
  });

  it('refuses a second transport retry without sending it', async () => {
    const { inner, t } = target(async () => jsonResponse(chatBody('gpt-4o')));
    const ledger = new CallLedger({ maxTransportRetries: 1 });
    ledger.install(t);
    const res = await t.fetch('https://api.openai.com/v1/chat/completions', {
      headers: { 'X-Stainless-Retry-Count': '2' },
      body: JSON.stringify({ model: 'gpt-4o' }),
    });
    expect(res.status).toBe(503);
    expect(res.headers.get('x-should-retry')).toBe('false');
    expect(inner).not.toHaveBeenCalled();
    expect(ledger.records[0].status).toBe('retry-cap-blocked');
  });

  it('refuses model calls once the hard cost cap is reached', async () => {
    const { inner, t } = target(async () => jsonResponse(chatBody('gpt-4o')));
    const ledger = new CallLedger({ hardCapUsd: 0.001 });
    ledger.install(t);
    const call = () => t.fetch('https://api.openai.com/v1/chat/completions', { body: JSON.stringify({ model: 'gpt-4o' }) });
    await call();
    const res = await call();
    expect(res.status).toBe(503);
    expect(inner).toHaveBeenCalledTimes(1);
    expect(ledger.records.map((r) => r.status)).toEqual([200, 'cost-cap-blocked']);
  });

  it('blocks and records any request that is not a model call, such as analytics', async () => {
    const { inner, t } = target(async () => jsonResponse({}));
    const ledger = new CallLedger();
    ledger.install(t);
    ledger.setContext('case#2', 'generation');
    await expect(t.fetch('https://us.i.posthog.com/batch/', { method: 'POST' })).rejects.toThrow(/blocked an outbound request/);
    expect(inner).not.toHaveBeenCalled();
    expect(ledger.blocked).toEqual([{ runKey: 'case#2', host: 'us.i.posthog.com', method: 'POST' }]);
  });

  it('prices exact models and their dated snapshots, and nothing else', () => {
    expect(priceFor('gpt-4o-mini-2024-07-18')?.input).toBe(0.15);
    expect(priceFor('gpt-4o-2024-08-06')?.input).toBe(2.5);
    expect(priceFor('gpt-4o-audio-preview')).toBeNull();
    expect(priceFor('some-other-model')).toBeNull();
    expect(costOf('gpt-4o', null)).toBeNull();
  });

  it('caps transport retries on the real OpenAI SDK, which obeys the refusal', async () => {
    const saved = globalThis.fetch;
    const upstream = jest.fn(async () => jsonResponse({ error: { message: 'boom' } }, 500, { 'retry-after-ms': '1' }));
    (globalThis as { fetch: unknown }).fetch = upstream;
    const ledger = new CallLedger({ maxTransportRetries: 1 });
    const restore = ledger.install(globalThis as unknown as { fetch: FetchLike });
    try {
      const client = new OpenAI({ apiKey: 'sk-test-not-real' });
      await expect(client.chat.completions.create({ model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }] })).rejects.toThrow();
      // Attempt 0 and retry 1 reach upstream; retry 2 is refused by the ledger.
      expect(upstream).toHaveBeenCalledTimes(2);
      expect(ledger.records.map((r) => [r.retryCount, r.status])).toEqual([
        [0, 500],
        [1, 500],
        [2, 'retry-cap-blocked'],
      ]);
      expect(summarizeCalls(ledger.records)).toMatchObject({ transportRetries: 2, blockedByCap: 1 });
    } finally {
      restore();
      (globalThis as { fetch: unknown }).fetch = saved;
    }
    // The logic takes milliseconds; the allowance covers loading the SDK on a cold disk.
  }, 30_000);
});
