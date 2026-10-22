import { describe, expect, it } from '@jest/globals';
import { createHmac } from 'node:crypto';
import {
  creditsForTransactionItems,
  decideAdjustment,
  getPaddleWebhookConfig,
  parsePriceMap,
  verifyPaddleSignature,
} from '@/lib/paddle';

// StoreKit spec 16.4 (signature, config), 16.4.1 (credits) and 16.5 (adjustments).

const SECRET = 'pdl_ntfset_test_secret';
const NOW = 1_761_100_000;
const sign = (body: string, ts: number, secret = SECRET) =>
  createHmac('sha256', secret).update(`${ts}:${body}`).digest('hex');

describe('verifyPaddleSignature', () => {
  const body = '{"event_id":"evt_1","event_type":"transaction.completed"}';

  it('accepts a valid signature inside the 5 second window', () => {
    expect(verifyPaddleSignature(body, `ts=${NOW};h1=${sign(body, NOW)}`, SECRET, NOW + 5)).toEqual({ ok: true });
  });

  it('accepts when any of several h1 values matches (secret rotation)', () => {
    const header = `ts=${NOW};h1=${sign(body, NOW, 'pdl_ntfset_old')};h1=${sign(body, NOW)}`;
    expect(verifyPaddleSignature(body, header, SECRET, NOW)).toEqual({ ok: true });
  });

  it('rejects a body changed by one byte', () => {
    expect(verifyPaddleSignature(`${body} `, `ts=${NOW};h1=${sign(body, NOW)}`, SECRET, NOW)).toEqual({ ok: false, reason: 'signature' });
  });

  it('rejects a signature made with another secret (for example the API key)', () => {
    expect(verifyPaddleSignature(body, `ts=${NOW};h1=${sign(body, NOW, 'pdl_live_apikey')}`, SECRET, NOW)).toEqual({ ok: false, reason: 'signature' });
  });

  it('rejects a timestamp older than 5 seconds, even with a valid signature', () => {
    expect(verifyPaddleSignature(body, `ts=${NOW};h1=${sign(body, NOW)}`, SECRET, NOW + 6)).toEqual({ ok: false, reason: 'stale' });
  });

  it('rejects a changed timestamp (it is part of the signed payload)', () => {
    expect(verifyPaddleSignature(body, `ts=${NOW + 1};h1=${sign(body, NOW)}`, SECRET, NOW)).toEqual({ ok: false, reason: 'signature' });
  });

  it.each([null, '', 'h1=abc', `ts=${NOW}`, `ts=abc;h1=${'0'.repeat(64)}`, `ts=${NOW};h1=zz`])(
    'rejects a missing or malformed header %p',
    (header) => {
      expect(verifyPaddleSignature(body, header, SECRET, NOW)).toEqual({ ok: false, reason: 'signature' });
    }
  );
});

describe('config', () => {
  const env = {
    PADDLE_WEBHOOK_SECRET: SECRET,
    PADDLE_PRICE_MAP: 'pri_01one:1, pri_01five:5,pri_01ten:10',
    PADDLE_ENVIRONMENT: 'sandbox',
  };

  it('reads a complete config', () => {
    const config = getPaddleWebhookConfig(env);
    expect(config?.environment).toBe('Sandbox');
    expect([...(config?.priceCredits ?? [])]).toEqual([['pri_01one', 1], ['pri_01five', 5], ['pri_01ten', 10]]);
  });

  it.each([
    ['no secret', { ...env, PADDLE_WEBHOOK_SECRET: '' }],
    ['no price map', { ...env, PADDLE_PRICE_MAP: undefined }],
    ['an unknown environment', { ...env, PADDLE_ENVIRONMENT: 'live' }],
    ['a malformed price entry', { ...env, PADDLE_PRICE_MAP: 'pri_01one:1,pri_01five' }],
    ['a non-pri ID', { ...env, PADDLE_PRICE_MAP: 'pro_01one:1' }],
    ['zero credits', { ...env, PADDLE_PRICE_MAP: 'pri_01one:0' }],
  ])('is null (503, change nothing) with %s', (_label, value) => {
    expect(getPaddleWebhookConfig(value)).toBeNull();
  });

  it('parsePriceMap fails closed on any bad entry', () => {
    expect(parsePriceMap('pri_a:1,pri_b:x')).toBeNull();
    expect(parsePriceMap('pri_a:1:2')).toBeNull();
  });
});

describe('creditsForTransactionItems', () => {
  const map = new Map([['pri_one', 1], ['pri_five', 5], ['pri_ten', 10]]);

  it('sums mapped credits times quantity', () => {
    expect(creditsForTransactionItems([{ price: { id: 'pri_five' }, quantity: 2 }], map)).toEqual({
      credits: 10,
      firstPriceId: 'pri_five',
      unknownPriceIds: [],
    });
  });

  it('grants nothing for an unknown price and reports it', () => {
    expect(creditsForTransactionItems([{ price: { id: 'pri_other' }, quantity: 1 }], map)).toEqual({
      credits: 0,
      firstPriceId: null,
      unknownPriceIds: ['pri_other'],
    });
  });

  it('ignores bad quantities and non-arrays', () => {
    expect(creditsForTransactionItems([{ price: { id: 'pri_one' }, quantity: -3 }], map).credits).toBe(0);
    expect(creditsForTransactionItems([{ price: { id: 'pri_one' }, quantity: 1.5 }], map).credits).toBe(0);
    expect(creditsForTransactionItems(null, map).credits).toBe(0);
  });
});

describe('decideAdjustment (16.5)', () => {
  it.each([
    [{ action: 'refund', status: 'pending_approval', type: 'full' }, { act: false, why: 'refund_pending_approval' }],
    [{ action: 'refund', status: 'rejected', type: 'full' }, { act: false, why: 'refund_rejected' }],
    [{ action: 'refund', status: 'approved', type: 'full' }, { act: true, action: 'refund' }],
    [{ action: 'refund', status: 'approved', type: 'partial', items: [{ type: 'full' }] }, { act: true, action: 'refund' }],
    [{ action: 'refund', status: 'approved', type: 'partial', items: [{ type: 'partial', amount: '100' }] }, { act: false, why: 'partial_amount_refund' }],
    [{ action: 'chargeback', status: 'approved', type: 'full' }, { act: true, action: 'chargeback' }],
    [{ action: 'chargeback_reverse', status: 'approved', type: 'full' }, { act: true, action: 'chargeback_reverse' }],
    [{ action: 'chargeback_warning', status: 'approved', type: 'full' }, { act: false, why: 'chargeback_warning' }],
    [{ action: 'credit', status: 'approved', type: 'full' }, { act: false, why: 'credit' }],
  ])('%p -> %p', (data, expected) => {
    expect(decideAdjustment(data)).toEqual(expected);
  });
});
