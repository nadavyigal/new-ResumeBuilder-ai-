'use client';

import { useEffect, useState } from 'react';

/**
 * Whether web exports spend credits now (StoreKit spec 16.7), read once per
 * page from `GET /api/v1/web-checkout`. Off (the default) means every export
 * button keeps its current behaviour.
 */
let gatePromise: Promise<boolean> | null = null;

export function readWebExportGate(): Promise<boolean> {
  gatePromise ??= fetch('/api/v1/web-checkout', { cache: 'no-store' })
    .then((response) => (response.ok ? response.json() : null))
    .then((json) => Boolean(json?.gated))
    .catch(() => false);
  return gatePromise;
}

export function useWebExportGate(): boolean {
  const [gated, setGated] = useState(false);
  useEffect(() => {
    let cancelled = false;
    readWebExportGate().then((value) => {
      if (!cancelled) setGated(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return gated;
}

/** Asks the server first. `needs_credit` means 402: send the user to the pack sheet. */
export async function unlockWebExport(optimizationId: string): Promise<'ok' | 'needs_credit' | 'account_required' | 'error'> {
  try {
    const response = await fetch('/api/v1/exports/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ optimizationId }),
    });
    if (response.ok) return 'ok';
    if (response.status === 402) return 'needs_credit';
    const json = await response.json().catch(() => ({}));
    return json?.error === 'account_required' ? 'account_required' : 'error';
  } catch {
    return 'error';
  }
}
