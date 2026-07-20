import { beforeEach, describe, expect, it, jest } from '@jest/globals';

type ScoreRow = {
  id: number;
  session_id: string;
  user_id: string | null;
  ats_score: number;
  ats_suggestions: unknown[];
  created_at: string;
  converted_at: string | null;
  resume_text?: string | null;
  job_description_text?: string | null;
  job_title?: string | null;
  job_source_url?: string | null;
  resume_id?: string | null;
  job_description_id?: string | null;
};

function makeRequest(body: unknown) {
  return {
    json: async () => body,
  } as any;
}

function createServiceRoleStore(rows: ScoreRow[]) {
  return {
    rows,
    updates: [] as Array<{ id: number; values: Partial<ScoreRow> }>,
    artifactInserts: [] as Array<{ table: string; values: Record<string, unknown> }>,
    from: jest.fn((table: string) => {
      // WP-49: converting a session also materializes owned resume / job
      // description rows from the carried anonymous text.
      if (table === 'resumes' || table === 'job_descriptions') {
        return {
          insert: jest.fn((values: Record<string, unknown>) => {
            store.artifactInserts.push({ table, values });
            return {
              select: jest.fn(() => ({
                maybeSingle: jest.fn(async () => ({
                  data: { id: `${table}-id` },
                  error: null,
                })),
              })),
            };
          }),
        } as any;
      }

      if (table !== 'anonymous_ats_scores') {
        throw new Error(`Unexpected table: ${table}`);
      }

      const buildQuery = () => {
        const filters: Array<(row: ScoreRow) => boolean> = [];
        const query = {
          select: jest.fn(() => query),
          eq: jest.fn((column: keyof ScoreRow, value: unknown) => {
            filters.push((row) => row[column] === value);
            return query;
          }),
          is: jest.fn((column: keyof ScoreRow, value: unknown) => {
            filters.push((row) => row[column] === value);
            return query;
          }),
          not: jest.fn((column: keyof ScoreRow, operator: string, value: unknown) => {
            if (operator === 'is') {
              filters.push((row) => row[column] !== value);
            }
            return query;
          }),
          order: jest.fn((column: keyof ScoreRow, options: { ascending: boolean }) => {
            rows.sort((a, b) => {
              const left = String(a[column] ?? '');
              const right = String(b[column] ?? '');
              return options.ascending ? left.localeCompare(right) : right.localeCompare(left);
            });
            return query;
          }),
          limit: jest.fn(() => query),
          maybeSingle: jest.fn(async () => ({
            data: rows.find((row) => filters.every((filter) => filter(row))) ?? null,
            error: null,
          })),
        };
        return query;
      };

      return {
        select: jest.fn(() => buildQuery()),
        update: jest.fn((values: Partial<ScoreRow>) => ({
          eq: jest.fn(async (column: keyof ScoreRow, value: unknown) => {
            const row = rows.find((candidate) => candidate[column] === value);
            if (row) {
              Object.assign(row, values);
              store.updates.push({ id: row.id, values });
            }
            return { error: null };
          }),
        })),
      };
    }),
  };
}

let store: ReturnType<typeof createServiceRoleStore>;
let authUser: { id: string } | null;

function loadRoute(rows: ScoreRow[]) {
  jest.resetModules();
  store = createServiceRoleStore(rows);
  authUser = { id: 'user-1' };

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
      auth: {
        getUser: jest.fn(async () => ({ data: { user: authUser }, error: null })),
      },
    })),
    createServiceRoleClient: jest.fn(() => store),
  }));

  return require('@/app/api/public/convert-session/route');
}

describe('/api/public/convert-session', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('attaches an unclaimed anonymous score to the signed-in user', async () => {
    const { POST } = loadRoute([
      {
        id: 1,
        session_id: 'session-1',
        user_id: null,
        ats_score: 43,
        ats_suggestions: [{ text: 'Add impact metrics' }],
        created_at: '2026-07-03T09:00:00.000Z',
        converted_at: null,
      },
    ]);

    const response = await POST(makeRequest({ sessionId: 'session-1' }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(store.rows[0].user_id).toBe('user-1');
    expect(store.rows[0].converted_at).toEqual(expect.any(String));
    expect(payload.scoreData.ats_score).toBe(43);
    expect(payload.scoreData.score).toBe(43);
  });

  it('returns an already converted score without failing the signup flow', async () => {
    const { POST } = loadRoute([
      {
        id: 2,
        session_id: 'session-1',
        user_id: 'user-1',
        ats_score: 43,
        ats_suggestions: [],
        created_at: '2026-07-03T09:00:00.000Z',
        converted_at: '2026-07-03T09:01:00.000Z',
      },
    ]);

    const response = await POST(makeRequest({ sessionId: 'session-1' }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.alreadyConverted).toBe(true);
    expect(payload.scoreData.ats_score).toBe(43);
    expect(store.updates).toHaveLength(0);
  });

  it('loads the latest converted score for the dashboard', async () => {
    const { GET } = loadRoute([
      {
        id: 2,
        session_id: 'session-1',
        user_id: 'user-1',
        ats_score: 43,
        ats_suggestions: [],
        created_at: '2026-07-03T09:00:00.000Z',
        converted_at: '2026-07-03T09:01:00.000Z',
      },
    ]);

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.scoreData.ats_score).toBe(43);
  });

  it('carries the anonymous resume and job description into the new account', async () => {
    const { POST } = loadRoute([
      {
        id: 3,
        session_id: 'session-1',
        user_id: null,
        ats_score: 43,
        ats_suggestions: [],
        created_at: '2026-07-20T09:00:00.000Z',
        converted_at: null,
        resume_text: 'Jane Doe\nSenior Product Manager\nGrew revenue 30%.',
        job_description_text: 'Senior Product Manager\nOwn the roadmap and strategy.',
        job_title: 'Senior Product Manager',
        resume_id: null,
        job_description_id: null,
      },
    ]);

    const response = await POST(makeRequest({ sessionId: 'session-1' }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    // The dashboard needs both ids to offer a one-click optimize.
    expect(payload.scoreData.resume_id).toBe('resumes-id');
    expect(payload.scoreData.job_description_id).toBe('job_descriptions-id');
    expect(store.artifactInserts.map((insert) => insert.table)).toEqual(
      expect.arrayContaining(['resumes', 'job_descriptions']),
    );
    expect(
      store.artifactInserts.every((insert) => insert.values.user_id === 'user-1'),
    ).toBe(true);
    // The anonymous copies are dropped once the user owns them.
    expect(store.rows[0].resume_text).toBeNull();
    expect(store.rows[0].job_description_text).toBeNull();
  });

  it('rejects conversion when no user is signed in', async () => {
    const { POST } = loadRoute([]);
    authUser = null;

    const response = await POST(makeRequest({ sessionId: 'session-1' }));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toBe('Unauthorized');
  });
});
