/**
 * @jest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

// P3b story 1: GET /api/download/[id] spends or refuses exactly like the export
// button (StoreKit spec 6.4, E1). The unlock runs after the ownership read and
// before any renderer, so calling the route directly cannot skip the credit.

type RpcResult = { data: unknown; error: { message: string } | null };
type TestUser = { id: string; is_anonymous?: boolean } | null;

function buildRequest(format: 'pdf' | 'docx', client?: string) {
  return {
    url: `https://example.test/api/download/opt-1?fmt=${format}`,
    headers: {
      get: (name: string) => (name.toLowerCase() === 'x-resumely-client' ? client ?? null : null),
    },
  } as any;
}

const params = { params: Promise.resolve({ id: 'opt-1' }) };

function loadRoute({
  user = { id: 'user-1' } as TestUser,
  optimization = { rewrite_data: { contact: { name: 'Dana Levi' } } } as unknown,
  rpcResult = { data: { status: 'ungated' }, error: null } as RpcResult,
  rpcThrows = false,
} = {}) {
  jest.resetModules();

  const maybeSingle = jest.fn(async () => ({ data: optimization, error: null }));
  const query = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    maybeSingle,
  };
  const routeClient = {
    auth: { getUser: jest.fn(async () => ({ data: { user } })) },
    from: jest.fn(() => query),
  };
  const serviceRpc = jest.fn<(fn: string, params: Record<string, unknown>) => Promise<RpcResult>>(
    async () => {
      if (rpcThrows) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
      return rpcResult;
    }
  );
  const generateDocxWithDesign = jest.fn(async () => Buffer.from('docx'));
  const generatePdfWithDesign = jest.fn(async () => ({
    buffer: Buffer.from('pdf'),
    renderer: 'local',
    templateSlug: null,
    usedDesignAssignment: false,
  }));
  const callPDFService = jest.fn(async () => ({ success: false, error: 'offline' }));
  const resolvePdfDesignContext = jest.fn(async () => ({
    templateSlug: 'classic',
    customization: null,
    usedDesignAssignment: false,
  }));
  const captureServerEvent = jest.fn(async (...args: unknown[]) => {
    void args;
  });

  jest.doMock('next/server', () => ({
    __esModule: true,
    NextResponse: class {
      status: number;
      private body: unknown;

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
  jest.doMock('@/lib/supabase-server', () => ({
    __esModule: true,
    createRouteHandlerClient: jest.fn(async () => routeClient),
    createServiceRoleClient: jest.fn(() => ({ rpc: serviceRpc })),
  }));
  jest.doMock('@/lib/export', () => ({
    __esModule: true,
    cleanResumeData: (data: unknown) => data,
    generatePdfWithDesign,
    generateDocxWithDesign,
  }));
  jest.doMock('@/lib/pdf-design-context', () => ({ __esModule: true, resolvePdfDesignContext }));
  jest.doMock('@/lib/pdf-service-client', () => ({ __esModule: true, callPDFService }));
  jest.doMock('@/lib/agent/utils/logger', () => ({
    __esModule: true,
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  }));
  jest.doMock('@/lib/posthog-server', () => ({ __esModule: true, captureServerEvent }));

  const { GET } = require('@/app/api/download/[id]/route');
  return { GET, serviceRpc, generateDocxWithDesign, generatePdfWithDesign, callPDFService, captureServerEvent };
}

describe('GET /api/download/[id] export gate', () => {
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

  it('renders with the flag off and records the export as ungated', async () => {
    const { GET, serviceRpc, generateDocxWithDesign } = loadRoute();

    const response = await GET(buildRequest('docx', 'ios'), params);

    expect(response.status).toBe(200);
    expect(serviceRpc).toHaveBeenCalledWith('unlock_export', {
      p_user_id: 'user-1',
      p_optimization_id: 'opt-1',
      p_charge: false,
    });
    expect(generateDocxWithDesign).toHaveBeenCalledTimes(1);
  });

  it('gates a listed test account on iOS with the switch off (App Review, TestFlight)', async () => {
    process.env.EXPORT_CREDITS_USER_IDS = 'user-1';
    try {
      const { GET, serviceRpc, generatePdfWithDesign } = loadRoute({
        rpcResult: { data: { status: 'insufficient', balance: 0 }, error: null },
      });
      const response = await GET(buildRequest('pdf', 'ios'), params);
      expect(response.status).toBe(402);
      expect(serviceRpc).toHaveBeenCalledWith('unlock_export', expect.objectContaining({ p_charge: true }));
      expect(generatePdfWithDesign).not.toHaveBeenCalled();
    } finally {
      delete process.env.EXPORT_CREDITS_USER_IDS;
    }
  });

  it('keeps every other account ungated while a test account is listed', async () => {
    process.env.EXPORT_CREDITS_USER_IDS = 'someone-else';
    try {
      const { GET, serviceRpc } = loadRoute();
      const response = await GET(buildRequest('pdf', 'ios'), params);
      expect(response.status).toBe(200);
      expect(serviceRpc).toHaveBeenCalledWith('unlock_export', expect.objectContaining({ p_charge: false }));
    } finally {
      delete process.env.EXPORT_CREDITS_USER_IDS;
    }
  });

  it('still renders while ungated when the unlock cannot be recorded', async () => {
    const { GET, generateDocxWithDesign } = loadRoute({
      rpcResult: { data: null, error: { message: 'function does not exist' } },
    });

    const response = await GET(buildRequest('docx', 'ios'), params);

    expect(response.status).toBe(200);
    expect(generateDocxWithDesign).toHaveBeenCalledTimes(1);
  });

  it('still renders while ungated when the unlock throws', async () => {
    const { GET, generateDocxWithDesign } = loadRoute({ rpcThrows: true });

    const response = await GET(buildRequest('docx'), params);

    expect(response.status).toBe(200);
    expect(generateDocxWithDesign).toHaveBeenCalledTimes(1);
  });

  it('refuses a charged export when the unlock throws', async () => {
    process.env.EXPORT_CREDITS_ENABLED = 'true';
    const { GET, generateDocxWithDesign } = loadRoute({ rpcThrows: true });

    const response = await GET(buildRequest('docx', 'ios'), params);

    expect(response.status).toBe(500);
    expect(generateDocxWithDesign).not.toHaveBeenCalled();
  });

  it('keeps the web ungated with the flag on (F1)', async () => {
    process.env.EXPORT_CREDITS_ENABLED = 'true';
    const { GET, serviceRpc, generateDocxWithDesign } = loadRoute();

    const response = await GET(buildRequest('docx'), params);

    expect(response.status).toBe(200);
    expect(serviceRpc).toHaveBeenCalledWith('unlock_export', expect.objectContaining({ p_charge: false }));
    expect(generateDocxWithDesign).toHaveBeenCalledTimes(1);
  });

  it('spends one credit and renders for the iOS app once the gate applies', async () => {
    process.env.EXPORT_CREDITS_ENABLED = 'true';
    const { GET, serviceRpc, generateDocxWithDesign } = loadRoute({
      rpcResult: { data: { status: 'unlocked', balance: 0 }, error: null },
    });

    const response = await GET(buildRequest('docx', 'ios'), params);

    expect(response.status).toBe(200);
    expect(serviceRpc).toHaveBeenCalledTimes(1);
    expect(serviceRpc).toHaveBeenCalledWith('unlock_export', expect.objectContaining({ p_charge: true }));
    expect(generateDocxWithDesign).toHaveBeenCalledTimes(1);
  });

  it('re-downloads an unlocked optimization without a second spend', async () => {
    process.env.EXPORT_CREDITS_ENABLED = 'true';
    const { GET, generateDocxWithDesign } = loadRoute({
      rpcResult: { data: { status: 'already_unlocked', source: 'credit', balance: 0 }, error: null },
    });

    const response = await GET(buildRequest('docx', 'ios'), params);

    expect(response.status).toBe(200);
    expect(generateDocxWithDesign).toHaveBeenCalledTimes(1);
  });

  it('returns 402 without credits and never calls a renderer (PDF)', async () => {
    process.env.EXPORT_CREDITS_ENABLED = 'true';
    const { GET, generatePdfWithDesign, callPDFService, captureServerEvent } = loadRoute({
      rpcResult: { data: { status: 'insufficient', balance: 0 }, error: null },
    });

    const response = await GET(buildRequest('pdf', 'ios'), params);

    expect(response.status).toBe(402);
    expect(await response.json()).toEqual({ error: 'export_credits_required', balance: 0 });
    expect(callPDFService).not.toHaveBeenCalled();
    expect(generatePdfWithDesign).not.toHaveBeenCalled();
    expect(captureServerEvent).not.toHaveBeenCalledWith('user-1', 'export_started', expect.anything());
  });

  it('returns 402 without credits and never calls a renderer (DOCX)', async () => {
    process.env.EXPORT_CREDITS_ENABLED = 'true';
    const { GET, generateDocxWithDesign } = loadRoute({
      rpcResult: { data: { status: 'insufficient', balance: 0 }, error: null },
    });

    const response = await GET(buildRequest('docx', 'ios'), params);

    expect(response.status).toBe(402);
    expect(generateDocxWithDesign).not.toHaveBeenCalled();
  });

  // Spec 11 step 3 preserves today's guest exports while billing is off.
  // F1 also keeps web exports ungated. Do not expand spec 6.3's account
  // requirement into a blanket 401 for installed guest clients.
  it.each([
    { flag: undefined, client: 'ios' },
    { flag: undefined, client: 'web' },
    { flag: 'true', client: 'web' },
  ])('preserves anonymous owned downloads when ungated: %j', async ({ flag, client }) => {
    if (flag === undefined) delete process.env.EXPORT_CREDITS_ENABLED;
    else process.env.EXPORT_CREDITS_ENABLED = flag;
    const { GET, serviceRpc, generateDocxWithDesign } = loadRoute({
      user: { id: 'anon-1', is_anonymous: true },
    });

    const response = await GET(buildRequest('docx', client), params);

    expect(response.status).toBe(200);
    expect(serviceRpc).toHaveBeenCalledWith('unlock_export', {
      p_user_id: 'anon-1', p_optimization_id: 'opt-1', p_charge: false,
    });
    expect(generateDocxWithDesign).toHaveBeenCalledTimes(1);
  });

  it('asks an anonymous iOS session for an account once the gate applies', async () => {
    process.env.EXPORT_CREDITS_ENABLED = 'true';
    const { GET, serviceRpc, generateDocxWithDesign } = loadRoute({
      user: { id: 'anon-1', is_anonymous: true },
    });

    const response = await GET(buildRequest('docx', 'ios'), params);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'account_required' });
    expect(serviceRpc).not.toHaveBeenCalled();
    expect(generateDocxWithDesign).not.toHaveBeenCalled();
  });

  it('fails closed with no file when the charged unlock cannot run', async () => {
    process.env.EXPORT_CREDITS_ENABLED = 'true';
    const { GET, generateDocxWithDesign } = loadRoute({
      rpcResult: { data: null, error: { message: 'boom' } },
    });

    const response = await GET(buildRequest('docx', 'ios'), params);

    expect(response.status).toBe(500);
    expect(generateDocxWithDesign).not.toHaveBeenCalled();
  });

  it('checks ownership before any unlock', async () => {
    process.env.EXPORT_CREDITS_ENABLED = 'true';
    const { GET, serviceRpc } = loadRoute({ optimization: null });

    const response = await GET(buildRequest('docx', 'ios'), params);

    expect(response.status).toBe(404);
    expect(serviceRpc).not.toHaveBeenCalled();
  });
});
