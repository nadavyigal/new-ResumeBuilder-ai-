import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Paddle web checkout (StoreKit spec section 16). No Paddle package (W2): the
 * webhook signature is a plain HMAC checked with `node:crypto`, and the Paddle
 * API is called with `fetch`.
 */

export type PaddleEnvironment = 'Production' | 'Sandbox';

export interface PaddleWebhookConfig {
  /** The notification destination's secret (`pdl_ntfset_...`), not the API key. */
  webhookSecret: string;
  /** `pri_` price ID to credits (16.2). Unknown price IDs grant nothing. */
  priceCredits: ReadonlyMap<string, number>;
  environment: PaddleEnvironment;
}

/**
 * `PADDLE_PRICE_MAP` is `pri_...:1,pri_...:5,pri_...:10` (16.8). Returns null when
 * any entry is malformed, so a typo fails closed instead of granting wrongly.
 */
export function parsePriceMap(raw: string | undefined): Map<string, number> | null {
  if (!raw?.trim()) return null;
  const map = new Map<string, number>();
  for (const entry of raw.split(',')) {
    const [priceId, credits, extra] = entry.split(':').map((part) => part.trim());
    if (extra !== undefined || !/^pri_[a-z0-9]+$/i.test(priceId ?? '') || !/^[1-9]\d{0,2}$/.test(credits ?? '')) {
      return null;
    }
    map.set(priceId, Number(credits));
  }
  return map.size > 0 ? map : null;
}

export function paddleEnvironment(raw: string | undefined): PaddleEnvironment | null {
  switch (raw?.trim().toLowerCase()) {
    case 'production':
      return 'Production';
    case 'sandbox':
      return 'Sandbox';
    default:
      return null;
  }
}

/** Check 1 of 16.4. Null means 503 and nothing changes. */
export function getPaddleWebhookConfig(
  env: Record<string, string | undefined> = process.env
): PaddleWebhookConfig | null {
  const webhookSecret = env.PADDLE_WEBHOOK_SECRET?.trim();
  const priceCredits = parsePriceMap(env.PADDLE_PRICE_MAP);
  const environment = paddleEnvironment(env.PADDLE_ENVIRONMENT);
  if (!webhookSecret || !priceCredits || !environment) return null;
  return { webhookSecret, priceCredits, environment };
}

/** Paddle's own default tolerance (16.4 step 4). */
export const PADDLE_SIGNATURE_TOLERANCE_SECONDS = 5;

export type PaddleSignatureResult = { ok: true } | { ok: false; reason: 'signature' | 'stale' };

/**
 * Checks `Paddle-Signature: ts=...;h1=...` (16.4 steps 3 and 4): HMAC-SHA256 of
 * `ts + ":" + rawBody` with the destination secret, compared in constant time
 * with every `h1` (secret rotation can send two). `rawBody` must be the exact
 * bytes Paddle sent, read with `request.text()` before any parsing.
 */
export function verifyPaddleSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): PaddleSignatureResult {
  if (!header) return { ok: false, reason: 'signature' };
  let ts: string | null = null;
  const signatures: string[] = [];
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key === 'ts') ts = value;
    if (key === 'h1' && value) signatures.push(value.toLowerCase());
  }
  if (!ts || !/^\d{1,12}$/.test(ts) || signatures.length === 0) return { ok: false, reason: 'signature' };

  const expected = createHmac('sha256', secret).update(`${ts}:${rawBody}`).digest();
  const matches = signatures.some((signature) => {
    if (!/^[0-9a-f]{64}$/.test(signature)) return false;
    return timingSafeEqual(Buffer.from(signature, 'hex'), expected);
  });
  if (!matches) return { ok: false, reason: 'signature' };

  if (Math.abs(nowSeconds - Number(ts)) > PADDLE_SIGNATURE_TOLERANCE_SECONDS) {
    return { ok: false, reason: 'stale' };
  }
  return { ok: true };
}

type TransactionItem = { price?: { id?: unknown } | null; quantity?: unknown };

/**
 * Credits for a completed transaction (16.4.1 step 2): the sum over items of
 * the mapped credits times the quantity. Unknown price IDs grant nothing and
 * are returned so the route can log them.
 */
export function creditsForTransactionItems(
  items: unknown,
  priceCredits: ReadonlyMap<string, number>
): { credits: number; firstPriceId: string | null; unknownPriceIds: string[] } {
  let credits = 0;
  let firstPriceId: string | null = null;
  const unknownPriceIds: string[] = [];
  for (const item of Array.isArray(items) ? (items as TransactionItem[]) : []) {
    const priceId = typeof item?.price?.id === 'string' ? item.price.id : '';
    const quantity = Number.isInteger(item?.quantity) && (item.quantity as number) > 0 ? (item.quantity as number) : 0;
    const perUnit = priceCredits.get(priceId);
    if (!perUnit) {
      if (priceId) unknownPriceIds.push(priceId);
      continue;
    }
    credits += perUnit * quantity;
    firstPriceId ??= priceId;
  }
  return { credits, firstPriceId, unknownPriceIds };
}

export type AdjustmentDecision =
  | { act: true; action: 'refund' | 'chargeback' | 'chargeback_reverse' }
  | { act: false; why: string };

type AdjustmentData = {
  action?: unknown;
  status?: unknown;
  type?: unknown;
  items?: unknown;
};

/**
 * Which adjustments move credits (16.5). Checkouts this server opens have one
 * price at quantity 1, so a refunded item of type `full` means the whole pack;
 * an amount-only (`partial`, `tax`, `proration`) refund deducts nothing.
 *   refund: only once `approved`; `pending_approval` and `rejected` do nothing.
 *   chargeback: any status but `rejected` deducts, as an approved refund.
 *   chargeback_reverse: gives back what the chargeback took.
 *   credit, chargeback_warning and the rest: logged only.
 */
export function decideAdjustment(data: AdjustmentData): AdjustmentDecision {
  const action = typeof data.action === 'string' ? data.action : '';
  const status = typeof data.status === 'string' ? data.status : '';
  const wholeItem =
    data.type === 'full' ||
    (Array.isArray(data.items) && (data.items as Array<{ type?: unknown }>).some((item) => item?.type === 'full'));

  switch (action) {
    case 'refund':
      if (status !== 'approved') return { act: false, why: `refund_${status || 'unknown'}` };
      return wholeItem ? { act: true, action: 'refund' } : { act: false, why: 'partial_amount_refund' };
    case 'chargeback':
      if (status === 'rejected') return { act: false, why: 'chargeback_rejected' };
      return { act: true, action: 'chargeback' };
    case 'chargeback_reverse':
      if (status === 'rejected') return { act: false, why: 'chargeback_reverse_rejected' };
      return { act: true, action: 'chargeback_reverse' };
    default:
      return { act: false, why: action || 'unknown_action' };
  }
}
