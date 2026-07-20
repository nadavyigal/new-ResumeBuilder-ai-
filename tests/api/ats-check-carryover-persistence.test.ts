import { beforeEach, describe, expect, it, jest } from '@jest/globals';

/**
 * WP-49: the anonymous check must persist the resume and job description so
 * signup can carry them into the new account, and must keep working when
 * migration 20260720000000 has not been applied yet.
 */

const longJobDescription = Array(24)
  .fill('Senior product engineer role requiring SwiftUI, TypeScript, analytics, experimentation, collaboration, and shipped customer impact.')
  .join(' ');

function buildResumeFormData() {
  // jsdom's File has no arrayBuffer(), which the route needs before validation.
  const bytes = Buffer.from('%PDF-1.4 fake');
  const resumeFile = new File([bytes], 'resume.pdf', { type: 'application/pdf' });
  Object.defineProperty(resumeFile, 'arrayBuffer', {
    value: async () => bytes,
  });

  const formData = new FormData();
  formData.append('resume', resumeFile);
  formData.append('jobDescription', longJobDescription);
  return formData;
}

function createAnonymousScoreStore(options: { undefinedColumn?: boolean } = {}) {
  const insertPayloads: Array<Record<string, unknown>> = [];
  let insertCount = 0;

  return {
    insertPayloads,
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
        insert: jest.fn((values: Record<string, unknown>) => {
          insertPayloads.push(values);
          insertCount += 1;
          const isFirstInsert = insertCount === 1;
          return {
            select: jest.fn(() => ({
              single: jest.fn(async () => {
                if (options.undefinedColumn && isFirstInsert) {
                  return {
                    data: null,
                    error: { code: '42703', message: "column 'resume_text' does not exist" },
                  };
                }
                return {
                  data: {
                    ats_score: 78,
                    created_at: '2026-07-20T00:00:00.000Z',
                    ats_suggestions: [],
                    ats_quick_wins: [],
                  },
                  error: null,
                };
              }),
            })),
          };
        }),
      };
    }),
  };
}

function loadRouteHarness(options: { undefinedColumn?: boolean } = {}) {
  jest.resetModules();

  const anonymousStore = createAnonymousScoreStore(options);

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
    createRouteHandlerClient: jest.fn(async () => ({
      auth: { getUser: jest.fn(async () => ({ data: { user: null }, error: null })) },
    })),
    createServiceRoleClient: jest.fn(() => anonymousStore),
  }));
  jest.doMock('@/lib/pdf-parser', () => ({
    __esModule: true,
    parsePdf: jest.fn(async () => ({ text: 'PDF resume text with SwiftUI and analytics.' })),
  }));
  jest.doMock('@/lib/utils/pdf-validation', () => ({
    __esModule: true,
    isPdfUpload: jest.fn(() => true),
  }));
  jest.doMock('@/lib/ats', () => ({
    __esModule: true,
    scoreResume: jest.fn(async () => ({
      ats_score_optimized: 78,
      subscores: {},
      suggestions: [],
      quick_wins: [],
    })),
  }));
  jest.doMock('@/lib/scraper/jobExtractor', () => ({
    __esModule: true,
    extractJob: jest.fn(async () => ({
      job_title: 'Senior Product Engineer',
      requirements: ['SwiftUI', 'TypeScript', 'analytics'],
      nice_to_have: [],
      responsibilities: [],
    })),
  }));
  jest.doMock('@/lib/rate-limiting/check-rate-limit', () => ({
    __esModule: true,
    checkRateLimit: jest.fn(async () => ({
      allowed: true,
      remaining: 4,
      resetAt: new Date('2026-07-20T01:00:00.000Z'),
    })),
  }));
  jest.doMock('@/lib/rate-limiting/get-client-ip', () => ({
    __esModule: true,
    getClientIP: jest.fn(() => '127.0.0.1'),
  }));

  const { POST } = require('@/app/api/public/ats-check/route');
  return { POST, anonymousStore };
}

describe('POST /api/public/ats-check carryover persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('stores the resume text and job description so signup can carry them over', async () => {
    const formData = buildResumeFormData();

    const { POST, anonymousStore } = loadRouteHarness();
    const response = await POST({
      headers: { get: () => 'session-1' },
      formData: async () => formData,
    } as any);

    expect(response.status).toBe(200);
    expect(anonymousStore.insertPayloads).toHaveLength(1);
    expect(anonymousStore.insertPayloads[0]).toMatchObject({
      resume_text: 'PDF resume text with SwiftUI and analytics.',
      job_description_text: longJobDescription,
      job_title: 'Senior Product Engineer',
    });
  });

  it('still returns a score when the carryover migration has not been applied', async () => {
    const formData = buildResumeFormData();

    const { POST, anonymousStore } = loadRouteHarness({ undefinedColumn: true });
    const response = await POST({
      headers: { get: () => 'session-1' },
      formData: async () => formData,
    } as any);
    const payload = await response.json();

    // The free funnel must survive an unapplied migration; only the artifact
    // carryover degrades.
    expect(response.status).toBe(200);
    expect(payload.score.overall).toBe(78);
    expect(anonymousStore.insertPayloads).toHaveLength(2);
    expect(anonymousStore.insertPayloads[1]).not.toHaveProperty('resume_text');
  });
});
