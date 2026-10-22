import { createServiceRoleClient } from '@/lib/supabase-server';
import { captureServerEvent } from '@/lib/posthog-server';

/**
 * Export credits (StoreKit spec, docs/superpowers/specs/2026-10-15-resumely-storekit-export-credits-spec.md).
 *
 * One credit unlocks one optimization for export, forever: every format, every
 * re-download (spec 6.1). The gate applies only when `EXPORT_CREDITS_ENABLED`
 * is "true" **and** the request comes from the iOS app (spec 6.5, F1). The web
 * stays ungated until the Paddle checkout ships (spec 16.7).
 */

export const EXPORT_CLIENT_HEADER = 'x-resumely-client';

type HeaderReader = { get(name: string): string | null };

export type UnlockExportResult =
  | {
      ok: true;
      status: 'unlocked' | 'already_unlocked' | 'ungated';
      balance: number | null;
      source: 'credit' | 'ungated';
      /** Has any `apple_iap` ledger row. Null when the database did not say. */
      paidUser: boolean | null;
    }
  | { ok: false; status: 'insufficient'; balance: 0 }
  | { ok: false; status: 'not_found' }
  | { ok: false; status: 'error'; details?: string };

export function exportCreditsEnabled(): boolean {
  return process.env.EXPORT_CREDITS_ENABLED === 'true';
}

/**
 * Accounts gated while the global switch is off: the App Review demo account
 * and the founder's own test account (`EXPORT_CREDITS_USER_IDS`, comma-separated
 * Supabase user ids). App Review and TestFlight buy in Sandbox (F6), so these
 * accounts can reach the paywall and complete a purchase in production before
 * anyone is charged, while every other account stays ungated.
 */
export function exportCreditsTestAccount(userId: string | undefined): boolean {
  if (!userId) return false;
  const ids = (process.env.EXPORT_CREDITS_USER_IDS ?? '')
    .split(',')
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean);
  return ids.includes(userId.trim().toLowerCase());
}

export function exportPlatform(headers: HeaderReader): 'ios' | 'web' {
  return headers.get(EXPORT_CLIENT_HEADER)?.trim().toLowerCase() === 'ios' ? 'ios' : 'web';
}

/** True when this request must spend a credit to export. */
export function isExportCharged(headers: HeaderReader, userId?: string): boolean {
  if (exportPlatform(headers) !== 'ios') return false;
  return exportCreditsEnabled() || exportCreditsTestAccount(userId);
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

function booleanOrNull(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

/**
 * Calls `unlock_export` (supabase/migrations/20261021120000_export_credits.sql).
 *
 * The function is SECURITY DEFINER and trusts `p_user_id`, so it runs on a
 * service-role client only. The caller owns the identity check: `userId` must
 * come from `supabase.auth.getUser()`, never from the request body.
 */
export async function unlockExport(
  userId: string,
  optimizationId: string,
  charge: boolean
): Promise<UnlockExportResult> {
  const supabase = createServiceRoleClient();
  const { data, error } = await (supabase as any).rpc('unlock_export', {
    p_user_id: userId,
    p_optimization_id: optimizationId,
    p_charge: charge,
  });

  if (error) {
    return { ok: false, status: 'error', details: error.message };
  }

  const result = (data ?? {}) as { status?: unknown; balance?: unknown; source?: unknown; paid_user?: unknown };
  const paidUser = booleanOrNull(result.paid_user);
  switch (result.status) {
    case 'unlocked':
      return { ok: true, status: 'unlocked', balance: numberOrNull(result.balance), source: 'credit', paidUser };
    case 'already_unlocked':
      return {
        ok: true,
        status: 'already_unlocked',
        balance: numberOrNull(result.balance),
        source: result.source === 'ungated' ? 'ungated' : 'credit',
        paidUser,
      };
    case 'ungated':
      return { ok: true, status: 'ungated', balance: null, source: 'ungated', paidUser };
    case 'insufficient':
      return { ok: false, status: 'insufficient', balance: 0 };
    case 'not_found':
      return { ok: false, status: 'not_found' };
    default:
      return { ok: false, status: 'error', details: `unexpected unlock status: ${String(result.status)}` };
  }
}

export type ExportAuthorization =
  | { allowed: true; status: 'unlocked' | 'already_unlocked' | 'ungated'; balance: number | null }
  | { allowed: false; httpStatus: 401 | 402 | 404 | 500; body: Record<string, unknown> };

/**
 * Decides whether this export may run, spending a credit when the gate applies.
 * Shared by `/api/v1/exports/unlock` and `/api/download/[id]` so a direct call
 * to the download route spends or refuses exactly like the export button.
 *
 * Charged path fails closed: any error refuses the export. Ungated path is
 * best effort: recording the ungated unlock never blocks a free export.
 */
export async function authorizeExport({
  user,
  optimizationId,
  headers,
}: {
  user: { id: string; is_anonymous?: boolean };
  optimizationId: string;
  headers: HeaderReader;
}): Promise<ExportAuthorization> {
  const charged = isExportCharged(headers, user.id);
  const platform = exportPlatform(headers);

  if (charged && user.is_anonymous) {
    return { allowed: false, httpStatus: 401, body: { error: 'account_required' } };
  }

  let result: UnlockExportResult;
  try {
    result = await unlockExport(user.id, optimizationId, charged);
  } catch (error) {
    // A missing service-role key or a network failure must not crash a free
    // export, and must refuse a charged one.
    result = { ok: false, status: 'error', details: error instanceof Error ? error.message : String(error) };
  }

  if (result.ok) {
    await captureServerEvent(user.id, 'export_unlocked', {
      optimization_id: optimizationId,
      status: result.status,
      paid_user: result.paidUser,
      balance_after: result.balance,
      platform,
    });
    return { allowed: true, status: result.status, balance: result.balance };
  }

  if (result.status === 'not_found') {
    return { allowed: false, httpStatus: 404, body: { error: 'Optimization not found' } };
  }

  if (result.status === 'insufficient') {
    await captureServerEvent(user.id, 'export_blocked', { optimization_id: optimizationId, platform });
    return { allowed: false, httpStatus: 402, body: { error: 'export_credits_required', balance: 0 } };
  }

  if (!charged) {
    console.warn('unlock_export failed on an ungated export; allowing it', {
      optimizationId,
      details: result.details,
    });
    return { allowed: true, status: 'ungated', balance: null };
  }

  console.error('unlock_export failed on a charged export', { optimizationId, details: result.details });
  return { allowed: false, httpStatus: 500, body: { error: 'export_unlock_failed' } };
}
