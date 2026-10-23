'use client';

import { useEffect, useState } from 'react';

/**
 * Whether web exports spend credits now (StoreKit spec 16.7), read once per
 * page from `GET /api/v1/web-checkout`. Off (the default) means every export
 * button keeps its current behaviour.
 */
let gatePromise: Promise<boolean | null> | null = null;

/**
 * True or false once the server answered; null when it could not be read. A
 * caller treats null like gated and asks the unlock route, so a slow or failed
 * read never lets an export skip the server (Codex P1). The server records an
 * ungated unlock and answers 200 when the gate is off.
 */
export function readWebExportGate(): Promise<boolean | null> {
  gatePromise ??= fetch('/api/v1/web-checkout', { cache: 'no-store' })
    .then((response) => (response.ok ? response.json() : null))
    .then((json) => (typeof json?.gated === 'boolean' ? json.gated : null))
    .catch(() => null)
    .then((value) => {
      if (value === null) gatePromise = null; // try again next time
      return value;
    });
  return gatePromise;
}

/** `false` only once the server said the web gate is off; null while unknown. */
export function useWebExportGate(): boolean | null {
  const [gated, setGated] = useState<boolean | null>(null);
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
