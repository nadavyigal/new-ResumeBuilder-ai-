import fs from 'fs';
import path from 'path';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const optimizationPagePath = path.join(
  process.cwd(),
  'src/app/[locale]/dashboard/optimizations/[id]/page.tsx'
);

function buildSupabaseClient() {
  const query: any = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    maybeSingle: jest.fn(async () => ({
      data: {
        rewrite_data: {
          contact: { name: 'Test Candidate' },
        },
      },
      error: null,
    })),
  };

  return {
    auth: {
      getUser: jest.fn(async () => ({
        data: { user: { id: 'user-1' } },
        error: null,
      })),
    },
    from: jest.fn(() => query),
  };
}

function loadDownloadRoute({ failLocalPdf = false }: { failLocalPdf?: boolean } = {}) {
  jest.resetModules();

  const createRouteHandlerClient = jest.fn(async () => buildSupabaseClient());
  const captureServerEvent = jest.fn(
    async (...args: [string, string, Record<string, unknown>?]) => {
      void args;
      return undefined;
    }
  );
  const generatePdfWithDesign = failLocalPdf
    ? jest.fn(async () => {
        throw new Error('local renderer failed');
      })
    : jest.fn(async () => ({
        buffer: Buffer.from('%PDF-test'),
        renderer: 'local',
        templateSlug: 'minimal-serif',
        usedDesignAssignment: false,
      }));
  const callPDFService = failLocalPdf
    ? jest.fn(async () => {
        throw new Error('docker renderer failed');
      })
    : jest.fn(async () => ({
        success: true,
        pdfBase64: Buffer.from('%PDF-test').toString('base64'),
        metadata: { templateSlug: 'minimal-serif' },
      }));

  jest.doMock('next/server', () => ({
    __esModule: true,
    NextResponse: class {
      status: number;
      headers: Headers;
      body: unknown;

      constructor(body: unknown, init?: { status?: number; headers?: Headers }) {
        this.body = body;
        this.status = init?.status ?? 200;
        this.headers = init?.headers ?? new Headers();
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
    createRouteHandlerClient,
  }));
  jest.doMock('@/lib/posthog-server', () => ({
    __esModule: true,
    captureServerEvent,
  }));
  jest.doMock('@/lib/export', () => ({
    __esModule: true,
    cleanResumeData: jest.fn((value) => value),
    generatePdfWithDesign,
    generateDocxWithDesign: jest.fn(),
  }));
  jest.doMock('@/lib/pdf-design-context', () => ({
    __esModule: true,
    resolvePdfDesignContext: jest.fn(async () => ({
      templateSlug: 'minimal-serif',
      customization: {},
      usedDesignAssignment: false,
    })),
  }));
  jest.doMock('@/lib/pdf-service-client', () => ({
    __esModule: true,
    callPDFService,
  }));
  jest.doMock('@/lib/agent/utils/logger', () => ({
    __esModule: true,
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
  }));

  const { GET } = require('@/app/api/download/[id]/route');
  return { GET, captureServerEvent };
}

describe('web export observability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('tracks optimization visibility and the web export click with an optimization id', () => {
    const source = fs.readFileSync(optimizationPagePath, 'utf8');

    expect(source).toContain("posthog.capture('optimized_viewed'");
    expect(source).toContain("posthog.capture('export_cta_seen'");
    expect(source).toContain("posthog.capture('export_pdf_tapped'");
    expect(source).toContain('optimization_id: optimizationId');
    expect(source).toContain("platform: 'web'");
    expect(source).toContain('window.location.href = `/api/download/${optimizationId}?fmt=pdf`');
  });

  it('records authenticated PDF generation start and success on the server', async () => {
    const { GET, captureServerEvent } = loadDownloadRoute();

    const response = await GET(
      { url: 'https://www.resumelybuilderai.com/api/download/opt-1?fmt=pdf' } as any,
      { params: Promise.resolve({ id: 'opt-1' }) }
    );

    expect(response.status).toBe(200);
    expect(captureServerEvent).toHaveBeenNthCalledWith(
      1,
      'user-1',
      'export_started',
      expect.objectContaining({
        optimization_id: 'opt-1',
        format: 'pdf',
        platform: 'web',
      })
    );
    expect(captureServerEvent).toHaveBeenNthCalledWith(
      2,
      'user-1',
      'export_success',
      expect.objectContaining({
        optimization_id: 'opt-1',
        format: 'pdf',
        platform: 'web',
      })
    );
    expect(captureServerEvent.mock.calls.map((call) => call[1])).not.toContain('export_failed');
  });

  it('records a terminal server failure after export starts', async () => {
    const { GET, captureServerEvent } = loadDownloadRoute({ failLocalPdf: true });

    await expect(
      GET(
        { url: 'https://www.resumelybuilderai.com/api/download/opt-2?fmt=pdf' } as any,
        { params: Promise.resolve({ id: 'opt-2' }) }
      )
    ).rejects.toThrow('local renderer failed');

    expect(captureServerEvent).toHaveBeenCalledWith(
      'user-1',
      'export_failed',
      expect.objectContaining({
        optimization_id: 'opt-2',
        format: 'pdf',
        platform: 'web',
        error_code: 'generation_failed',
      })
    );
    expect(captureServerEvent.mock.calls.map((call) => call[1])).not.toContain('export_success');
  });
});
