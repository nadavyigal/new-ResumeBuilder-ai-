import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const longJobDescription = Array(24)
  .fill('Senior product engineer role requiring SwiftUI, TypeScript, analytics, experimentation, collaboration, and shipped customer impact.')
  .join(' ');

function buildRequest(fields: Record<string, string>, file?: File) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value);
  }
  if (file) {
    formData.append('resume', file);
  }

  return {
    headers: {
      get: (name: string) => (name.toLowerCase() === 'x-session-id' ? 'session-1' : null),
    },
    formData: async () => formData,
  } as any;
}

function createAnonymousScoreStore() {
  return {
    from: jest.fn((table: string) => {
      if (table !== 'anonymous_ats_scores') {
        throw new Error(`Unexpected service-role table: ${table}`);
      }

      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                gt: jest.fn(() => ({
                  order: jest.fn(() => ({
                    limit: jest.fn(() => ({
                      maybeSingle: jest.fn(async () => ({ data: null, error: null })),
                    })),
                  })),
                })),
              })),
            })),
          })),
        })),
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(async () => ({
              data: {
                ats_score: 78,
                created_at: '2026-06-28T00:00:00.000Z',
                ats_suggestions: [],
                ats_quick_wins: [],
              },
              error: null,
            })),
          })),
        })),
      };
    }),
  };
}

function createAuthClient({
  user = { id: 'user-1' },
  resumeData = { raw_text: 'Resume text with SwiftUI, TypeScript, analytics, and shipped impact.' },
}: {
  user?: { id: string } | null;
  resumeData?: { raw_text: string } | null;
}) {
  const eq = jest.fn(function (...args: [string, string]) {
    void args;
    return query;
  });
  const maybeSingle = jest.fn(async () => ({ data: resumeData, error: null }));
  const query = {
    select: jest.fn(() => query),
    eq,
    maybeSingle,
  };

  return {
    query,
    client: {
      auth: {
        getUser: jest.fn(async () => ({ data: { user }, error: null })),
      },
      from: jest.fn((table: string) => {
        if (table !== 'resumes') {
          throw new Error(`Unexpected auth table: ${table}`);
        }
        return query;
      }),
    },
  };
}

function loadRouteHarness(authClient: ReturnType<typeof createAuthClient>['client']) {
  jest.resetModules();

  const anonymousStore = createAnonymousScoreStore();
  const createRouteHandlerClient = jest.fn(async () => authClient);
  const createServiceRoleClient = jest.fn(() => anonymousStore);
  const parsePdf = jest.fn(async () => ({ text: 'PDF resume text with SwiftUI and analytics.' }));
  const isPdfUpload = jest.fn(() => true);
  const scoreResume = jest.fn(async () => ({
    ats_score_optimized: 78,
    subscores: {},
    suggestions: [],
    quick_wins: [],
  }));
  const extractJob = jest.fn(async () => ({
    job_title: 'Senior Product Engineer',
    requirements: ['SwiftUI', 'TypeScript', 'analytics'],
    nice_to_have: [],
    responsibilities: [],
  }));

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
    createRouteHandlerClient,
    createServiceRoleClient,
  }));
  jest.doMock('@/lib/pdf-parser', () => ({ __esModule: true, parsePdf }));
  jest.doMock('@/lib/utils/pdf-validation', () => ({ __esModule: true, isPdfUpload }));
  jest.doMock('@/lib/ats', () => ({ __esModule: true, scoreResume }));
  jest.doMock('@/lib/scraper/jobExtractor', () => ({
    __esModule: true,
    extractJob,
  }));
  jest.doMock('@/lib/rate-limiting/check-rate-limit', () => ({
    __esModule: true,
    checkRateLimit: jest.fn(async () => ({
      allowed: true,
      remaining: 4,
      resetAt: new Date('2026-06-28T01:00:00.000Z'),
    })),
  }));
  jest.doMock('@/lib/rate-limiting/get-client-ip', () => ({
    __esModule: true,
    getClientIP: jest.fn(() => '127.0.0.1'),
  }));

  const { POST } = require('@/app/api/public/ats-check/route');
  return {
    POST,
    anonymousStore,
    createRouteHandlerClient,
    createServiceRoleClient,
    parsePdf,
    isPdfUpload,
    scoreResume,
  };
}

describe('POST /api/public/ats-check resumeId input', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('accepts an authenticated resumeId and skips PDF parsing', async () => {
    const auth = createAuthClient({});
    const { POST, parsePdf, isPdfUpload, scoreResume } = loadRouteHarness(auth.client);

    const response = await POST(buildRequest({
      resumeId: 'resume-1',
      jobDescription: longJobDescription,
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.fit.verdict).toBe('Strong');
    expect(parsePdf).not.toHaveBeenCalled();
    expect(isPdfUpload).not.toHaveBeenCalled();
    expect(auth.query.eq).toHaveBeenCalledWith('id', 'resume-1');
    expect(auth.query.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(scoreResume as any).toHaveBeenCalledWith(
      (expect as any).objectContaining({
        resume_original_text: (expect as any).stringContaining('SwiftUI'),
        resume_optimized_text: (expect as any).stringContaining('SwiftUI'),
        job_clean_text: longJobDescription,
      }),
      { generateQuickWins: true }
    );
  });

  it('rejects resumeId without auth', async () => {
    const auth = createAuthClient({ user: null });
    const { POST, scoreResume } = loadRouteHarness(auth.client);

    const response = await POST(buildRequest({
      resumeId: 'resume-1',
      jobDescription: longJobDescription,
    }));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toBe('Unauthorized');
    expect(scoreResume).not.toHaveBeenCalled();
  });

  it('rejects a resumeId that is not owned by the authenticated user', async () => {
    const auth = createAuthClient({ resumeData: null });
    const { POST, scoreResume } = loadRouteHarness(auth.client);

    const response = await POST(buildRequest({
      resumeId: 'other-user-resume',
      jobDescription: longJobDescription,
    }));
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error).toBe('Resume not found.');
    expect(auth.query.eq).toHaveBeenCalledWith('id', 'other-user-resume');
    expect(auth.query.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(scoreResume).not.toHaveBeenCalled();
  });

  it('keeps the existing anonymous PDF upload path working when resumeId is absent', async () => {
    const auth = createAuthClient({});
    const { POST, parsePdf, isPdfUpload, createRouteHandlerClient } = loadRouteHarness(auth.client);
    const resumeFile = new File(['%PDF test'], 'resume.pdf', { type: 'application/pdf' });
    Object.defineProperty(resumeFile, 'arrayBuffer', {
      value: async () => Buffer.from('%PDF test').buffer,
    });

    const response = await POST(buildRequest(
      { jobDescription: longJobDescription },
      resumeFile
    ));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.fit.verdict).toBe('Strong');
    expect(createRouteHandlerClient).not.toHaveBeenCalled();
    expect(isPdfUpload).toHaveBeenCalledTimes(1);
    expect(parsePdf).toHaveBeenCalledTimes(1);
  });

  it('rejects job descriptions below the shared public word minimum', async () => {
    const auth = createAuthClient({});
    const { POST, scoreResume } = loadRouteHarness(auth.client);
    const ninetyWordJobDescription = Array(90).fill('role').join(' ');
    const resumeFile = new File(['%PDF test'], 'resume.pdf', { type: 'application/pdf' });

    const response = await POST(buildRequest(
      { jobDescription: ninetyWordJobDescription },
      resumeFile
    ));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe('Please paste the full job description (at least 100 words).');
    expect(scoreResume).not.toHaveBeenCalled();
  });
});
