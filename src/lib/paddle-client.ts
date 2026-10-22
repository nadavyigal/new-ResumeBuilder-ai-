'use client';

/**
 * Paddle.js in the browser (StoreKit spec 16.3), loaded from Paddle's CDN with
 * no package (W2). It only opens the overlay for a transaction the server
 * created and shows Paddle's localized prices; it never grants anything.
 */

export type PaddleEnvironmentName = 'sandbox' | 'production';

type PaddleEvent = { name?: string };

type PricePreviewResult = {
  data?: {
    details?: {
      lineItems?: Array<{ price?: { id?: string }; formattedTotals?: { total?: string } }>;
    };
  };
};

export interface PaddleGlobal {
  Environment: { set(environment: string): void };
  Initialize(options: { token: string; eventCallback?: (event: PaddleEvent) => void }): void;
  Checkout: {
    open(options: { transactionId: string; settings?: { displayMode?: 'overlay'; locale?: string } }): void;
    close(): void;
  };
  PricePreview(request: { items: Array<{ priceId: string; quantity: number }> }): Promise<PricePreviewResult>;
}

declare global {
  interface Window {
    Paddle?: PaddleGlobal;
  }
}

export const PADDLE_SCRIPT_URL = 'https://cdn.paddle.com/paddle/v2/paddle.js';

let loading: Promise<PaddleGlobal> | null = null;
let eventListener: ((event: PaddleEvent) => void) | null = null;

/** One listener at a time: the open export sheet. */
export function setPaddleEventListener(listener: ((event: PaddleEvent) => void) | null) {
  eventListener = listener;
}

export function loadPaddle(environment: PaddleEnvironmentName): Promise<PaddleGlobal> {
  const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
  if (!token) return Promise.reject(new Error('paddle_client_token_missing'));
  if (loading) return loading;

  loading = new Promise<PaddleGlobal>((resolve, reject) => {
    const initialize = () => {
      const paddle = window.Paddle;
      if (!paddle) {
        reject(new Error('paddle_unavailable'));
        return;
      }
      if (environment === 'sandbox') paddle.Environment.set('sandbox');
      paddle.Initialize({ token, eventCallback: (event) => eventListener?.(event) });
      resolve(paddle);
    };
    if (window.Paddle) {
      initialize();
      return;
    }
    const script = document.createElement('script');
    script.src = PADDLE_SCRIPT_URL;
    script.async = true;
    script.onload = initialize;
    script.onerror = () => {
      loading = null;
      reject(new Error('paddle_script_failed'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/** Paddle's own localized totals per price ID (shekels in Israel, W3). Empty on failure. */
export async function previewPrices(paddle: PaddleGlobal, priceIds: string[]): Promise<Record<string, string>> {
  try {
    const result = await paddle.PricePreview({ items: priceIds.map((priceId) => ({ priceId, quantity: 1 })) });
    const prices: Record<string, string> = {};
    for (const item of result?.data?.details?.lineItems ?? []) {
      if (item?.price?.id && item.formattedTotals?.total) prices[item.price.id] = item.formattedTotals.total;
    }
    return prices;
  } catch {
    return {};
  }
}

/**
 * After `checkout.completed`, waits for the webhook's grant to show in the
 * balance. The browser event itself grants nothing (16.3 step 4).
 */
export async function waitForBalanceAbove(
  before: number,
  readBalance: () => Promise<number | null>,
  { attempts = 20, intervalMs = 1500, sleep = (ms: number) => new Promise((r) => setTimeout(r, ms)) } = {}
): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    const balance = await readBalance();
    if (balance !== null && balance > before) return true;
    await sleep(intervalMs);
  }
  return false;
}
