import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

// P3b story 1: one export credit unlocks one optimization (StoreKit spec 6.1).
// The gate applies only when EXPORT_CREDITS_ENABLED is "true" and the request
// comes from the iOS app (spec 6.5, F1). unlock_export is SECURITY DEFINER and
// service-role only, so the wrapper must call it on a service-role client.

type RpcResult = { data: unknown; error: { message: string } | null };

function headers(values: Record<string, string>) {
  return {
    get: (name: string) => values[name.toLowerCase()] ?? null,
  };
}

function loadModule(rpcResult: RpcResult = { data: { status: 'ungated' }, error: null }) {
  jest.resetModules();
  const serviceRpc = jest.fn<(fn: string, params: Record<string, unknown>) => Promise<RpcResult>>(
    async () => rpcResult
  );
  const createServiceRoleClient = jest.fn(() => ({ rpc: serviceRpc }));
  jest.doMock('@/lib/supabase-server', () => ({
    __esModule: true,
    createServiceRoleClient,
  }));
  jest.doMock('@/lib/posthog-server', () => ({ __esModule: true, captureServerEvent: jest.fn() }));
  const mod = require('@/lib/export-credits');
  return { mod, serviceRpc, createServiceRoleClient };
}

describe('export credits', () => {
  const previous = process.env.EXPORT_CREDITS_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.EXPORT_CREDITS_ENABLED;
  });

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.EXPORT_CREDITS_ENABLED;
    } else {
      process.env.EXPORT_CREDITS_ENABLED = previous;
    }
  });

  describe('isExportCharged', () => {
    it('is off by default, even for the iOS app', () => {
      const { mod } = loadModule();
      expect(mod.isExportCharged(headers({ 'x-resumely-client': 'ios' }))).toBe(false);
    });

    it('treats any value other than "true" as off', () => {
      process.env.EXPORT_CREDITS_ENABLED = 'TRUE ';
      const { mod } = loadModule();
      expect(mod.isExportCharged(headers({ 'x-resumely-client': 'ios' }))).toBe(false);
    });

    it('charges the iOS app once the flag is on', () => {
      process.env.EXPORT_CREDITS_ENABLED = 'true';
      const { mod } = loadModule();
      expect(mod.isExportCharged(headers({ 'x-resumely-client': 'ios' }))).toBe(true);
      expect(mod.isExportCharged(headers({ 'x-resumely-client': ' iOS ' }))).toBe(true);
    });

    it('gates only the listed test accounts while the switch is off', () => {
      process.env.EXPORT_CREDITS_USER_IDS = ' 11111111-1111-4111-8111-111111111111 ,22222222-2222-4222-8222-222222222222';
      try {
        const { mod } = loadModule();
        const ios = headers({ 'x-resumely-client': 'ios' });
        expect(mod.isExportCharged(ios, '11111111-1111-4111-8111-111111111111')).toBe(true);
        expect(mod.isExportCharged(ios, '22222222-2222-4222-8222-222222222222'.toUpperCase())).toBe(true);
        expect(mod.isExportCharged(ios, '33333333-3333-4333-8333-333333333333')).toBe(false);
        expect(mod.isExportCharged(ios)).toBe(false);
        // A listed account on the web stays ungated (F1).
        expect(mod.isExportCharged(headers({}), '11111111-1111-4111-8111-111111111111')).toBe(false);
      } finally {
        delete process.env.EXPORT_CREDITS_USER_IDS;
      }
    });

    it('gates nobody with an empty test-account list', () => {
      process.env.EXPORT_CREDITS_USER_IDS = ' , ';
      try {
        const { mod } = loadModule();
        expect(mod.isExportCharged(headers({ 'x-resumely-client': 'ios' }), '')).toBe(false);
      } finally {
        delete process.env.EXPORT_CREDITS_USER_IDS;
      }
    });

    it('keeps the web ungated with the flag on (F1)', () => {
      process.env.EXPORT_CREDITS_ENABLED = 'true';
      const { mod } = loadModule();
      expect(mod.isExportCharged(headers({}))).toBe(false);
      expect(mod.isExportCharged(headers({ 'x-resumely-client': 'web' }))).toBe(false);
    });
  });

  describe('unlockExport', () => {
    it('calls unlock_export on the service-role client with the charge flag', async () => {
      const { mod, serviceRpc, createServiceRoleClient } = loadModule({
        data: { status: 'unlocked', balance: 4, paid_user: true },
        error: null,
      });

      const result = await mod.unlockExport('user-1', 'opt-1', true);

      expect(createServiceRoleClient).toHaveBeenCalledTimes(1);
      expect(serviceRpc).toHaveBeenCalledWith('unlock_export', {
        p_user_id: 'user-1',
        p_optimization_id: 'opt-1',
        p_charge: true,
      });
      expect(result).toEqual({
        ok: true, status: 'unlocked', balance: 4, source: 'credit', paidUser: true,
        freeGrantUsed: false, welcomeExports: null, periodExports: null, periodCap: null,
      });
    });

    it('maps a subscription unlock with its period count and cap', async () => {
      const { mod } = loadModule({
        data: { status: 'unlocked', source: 'subscription', balance: 3, paid_user: true, period_exports: 7, period_cap: 40 },
        error: null,
      });

      await expect(mod.unlockExport('user-1', 'opt-1', true)).resolves.toEqual({
        ok: true, status: 'unlocked', balance: 3, source: 'subscription', paidUser: true,
        freeGrantUsed: false, welcomeExports: null, periodExports: 7, periodCap: 40,
      });
    });

    it('reports the export that used up the welcome grant', async () => {
      const { mod } = loadModule({
        data: { status: 'unlocked', source: 'credit', balance: 0, paid_user: false, free_grant_used: true, welcome_exports: 3 },
        error: null,
      });

      const result = await mod.unlockExport('user-1', 'opt-1', true);
      expect(result).toEqual(expect.objectContaining({ ok: true, freeGrantUsed: true, welcomeExports: 3 }));
    });

    it('maps a 402 for a subscriber over the fair-use cap', async () => {
      const { mod } = loadModule({
        data: { status: 'insufficient', balance: 0, subscription_cap_reached: true, cap_resets_at: '2026-12-01T00:00:00+00:00' },
        error: null,
      });

      await expect(mod.unlockExport('user-1', 'opt-1', true)).resolves.toEqual({
        ok: false, status: 'insufficient', balance: 0, subscriptionCapReached: true, capResetsAt: '2026-12-01T00:00:00+00:00',
      });
    });

    it('maps already_unlocked with its source and balance', async () => {
      const { mod } = loadModule({
        data: { status: 'already_unlocked', source: 'ungated', balance: 1, paid_user: false },
        error: null,
      });

      await expect(mod.unlockExport('user-1', 'opt-1', true)).resolves.toEqual({
        ok: true,
        status: 'already_unlocked',
        balance: 1,
        source: 'ungated',
        paidUser: false,
        freeGrantUsed: false, welcomeExports: null, periodExports: null, periodCap: null,
      });
    });

    it('maps ungated', async () => {
      const { mod } = loadModule({ data: { status: 'ungated' }, error: null });

      await expect(mod.unlockExport('user-1', 'opt-1', false)).resolves.toEqual({
        ok: true,
        status: 'ungated',
        balance: null,
        source: 'ungated',
        paidUser: null,
        freeGrantUsed: false, welcomeExports: null, periodExports: null, periodCap: null,
      });
    });

    it('maps insufficient to a refusal with balance 0', async () => {
      const { mod } = loadModule({ data: { status: 'insufficient', balance: 0 }, error: null });

      await expect(mod.unlockExport('user-1', 'opt-1', true)).resolves.toEqual({
        ok: false,
        status: 'insufficient',
        balance: 0,
        subscriptionCapReached: false,
        capResetsAt: null,
      });
    });

    it('maps not_found', async () => {
      const { mod } = loadModule({ data: { status: 'not_found' }, error: null });

      await expect(mod.unlockExport('user-1', 'opt-1', true)).resolves.toEqual({
        ok: false,
        status: 'not_found',
      });
    });

    it('returns an error when the RPC fails', async () => {
      const { mod } = loadModule({ data: null, error: { message: 'function does not exist' } });

      await expect(mod.unlockExport('user-1', 'opt-1', true)).resolves.toEqual({
        ok: false,
        status: 'error',
        details: 'function does not exist',
      });
    });

    it('returns an error on an unknown status instead of unlocking', async () => {
      const { mod } = loadModule({ data: { status: 'surprise' }, error: null });

      const result = await mod.unlockExport('user-1', 'opt-1', true);

      expect(result.ok).toBe(false);
      expect(result.status).toBe('error');
    });
  });
});
