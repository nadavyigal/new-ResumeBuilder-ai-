import { describe, expect, it, jest } from '@jest/globals';

/**
 * WP-49 regression guard.
 *
 * The carryover code selects six columns that only exist once migration
 * 20260720000000 is applied. If the code deploys first, those selects fail with
 * Postgres 42703 (or PGRST204 while the schema cache reloads). Before the
 * fallback, the route treated that as a hard lookup failure and returned 500 —
 * so `user_id` / `converted_at` were never set and session conversion, which
 * works in production today, silently stopped.
 *
 * These tests pin the invariant that matters: conversion completes with the new
 * columns absent. That makes deploy order irrelevant.
 */

const SESSION_ID = 'sess-wp49';
const USER_ID = 'user-wp49';

type Update = { values: Record<string, unknown>; column: string; value: unknown };

function buildServiceRole({
  carryoverColumnsExist,
  errorCode = '42703',
}: {
  carryoverColumnsExist: boolean;
  errorCode?: string;
}) {
  const updates: Update[] = [];
  const selectedColumnLists: string[] = [];

  const row = {
    id: 4242,
    session_id: SESSION_ID,
    ats_score: 71,
    ats_suggestions: ['tighten summary'],
    created_at: '2026-07-20T00:00:00.000Z',
    converted_at: null,
  };

  const client = {
    from(table: string) {
      if (table !== 'anonymous_ats_scores') {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        select(columns: string) {
          selectedColumnLists.push(columns);
          const wantsCarryoverColumns = columns.includes('resume_text');

          const chain: any = {
            eq: () => chain,
            is: () => chain,
            not: () => chain,
            order: () => chain,
            limit: () => chain,
            async maybeSingle() {
              if (wantsCarryoverColumns && !carryoverColumnsExist) {
                return {
                  data: null,
                  error: {
                    code: errorCode,
                    message: 'column anonymous_ats_scores.resume_text does not exist',
                  },
                };
              }
              return { data: { ...row }, error: null };
            },
          };

          return chain;
        },

        update(values: Record<string, unknown>) {
          return {
            async eq(column: string, value: unknown) {
              updates.push({ values, column, value });
              return { data: null, error: null };
            },
          };
        },
      };
    },
  };

  return { client, updates, selectedColumnLists };
}

function loadRoute(serviceRoleClient: unknown) {
  jest.resetModules();

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
    createRouteHandlerClient: async () => ({
      auth: {
        getUser: async () => ({ data: { user: { id: USER_ID } }, error: null }),
      },
    }),
    createServiceRoleClient: () => serviceRoleClient,
  }));

  return require('@/app/api/public/convert-session/route');
}

function buildRequest() {
  return { json: async () => ({ sessionId: SESSION_ID }) } as any;
}

describe('WP-49 anonymous carryover — unapplied migration fallback', () => {
  it.each([['42703'], ['PGRST204']])(
    'still converts the session when the carryover columns are missing (%s)',
    async (errorCode) => {
      const { client, updates, selectedColumnLists } = buildServiceRole({
        carryoverColumnsExist: false,
        errorCode,
      });
      const route = loadRoute(client);

      const response = await route.POST(buildRequest());
      const body: any = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);

      // The conversion write is the whole point: without it the user loses the
      // session they just signed up to keep.
      expect(updates).toHaveLength(1);
      expect(updates[0].values.user_id).toBe(USER_ID);
      expect(updates[0].values.converted_at).toEqual(expect.any(String));
      expect(updates[0].column).toBe('id');
      expect(updates[0].value).toBe(4242);

      // It retried with the narrow list rather than giving up.
      expect(selectedColumnLists).toHaveLength(2);
      expect(selectedColumnLists[0]).toContain('resume_text');
      expect(selectedColumnLists[1]).not.toContain('resume_text');

      // Materialization is skipped, not attempted against absent columns.
      expect(body.scoreData.resume_id).toBeNull();
      expect(body.scoreData.job_description_id).toBeNull();
    },
  );

  it('reads the carryover columns directly once the migration is applied', async () => {
    const { client, updates, selectedColumnLists } = buildServiceRole({
      carryoverColumnsExist: true,
    });
    const route = loadRoute(client);

    const response = await route.POST(buildRequest());

    expect(response.status).toBe(200);
    expect(selectedColumnLists).toHaveLength(1);
    expect(selectedColumnLists[0]).toContain('resume_text');
    expect(updates[0].values.user_id).toBe(USER_ID);
  });
});
