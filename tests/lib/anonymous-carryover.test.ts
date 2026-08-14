import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  linkCarryoverOptimization,
  materializeAnonymousCarryover,
  type AnonymousCarryoverRow,
} from '@/lib/anonymous-carryover';

type Inserted = { table: string; values: Record<string, unknown> };

function createServiceRole(options: { failOn?: string } = {}) {
  const inserts: Inserted[] = [];
  const updates: Array<Record<string, unknown>> = [];
  let nextId = 0;

  const client = {
    inserts,
    updates,
    from: jest.fn((table: string) => ({
      insert: jest.fn((values: Record<string, unknown>) => {
        inserts.push({ table, values });
        return {
          select: jest.fn(() => ({
            maybeSingle: jest.fn(async () => {
              if (options.failOn === table) {
                return { data: null, error: { message: `${table} insert failed` } };
              }
              nextId += 1;
              return { data: { id: `${table}-id-${nextId}` }, error: null };
            }),
          })),
        };
      }),
      update: jest.fn((values: Record<string, unknown>) => {
        updates.push(values);
        return {
          eq: jest.fn(async () => ({ error: null })),
        };
      }),
    })),
  };

  return client;
}

function makeRow(overrides: Partial<AnonymousCarryoverRow> = {}): AnonymousCarryoverRow {
  return {
    id: 1,
    session_id: 'session-1',
    ats_score: 43,
    ats_suggestions: [],
    created_at: '2026-07-20T09:00:00.000Z',
    converted_at: null,
    resume_text: 'Jane Doe\nSenior Product Manager\nLed a team of 8 and grew revenue 30%.',
    job_description_text:
      'Senior Product Manager\nWe are looking for a product manager to own roadmap and strategy.',
    job_title: 'Senior Product Manager',
    job_source_url: null,
    resume_id: null,
    job_description_id: null,
    ...overrides,
  };
}

describe('materializeAnonymousCarryover', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('copies the anonymous resume and job description into rows the new user owns', async () => {
    const serviceRole = createServiceRole();

    const result = await materializeAnonymousCarryover(
      serviceRole as any,
      makeRow(),
      'user-1',
    );

    expect(result.resumeId).toBe('resumes-id-1');
    expect(result.jobDescriptionId).toBe('job_descriptions-id-2');

    const resumeInsert = serviceRole.inserts.find((i) => i.table === 'resumes');
    expect(resumeInsert?.values.user_id).toBe('user-1');
    expect(resumeInsert?.values.raw_text).toContain('Senior Product Manager');

    const jdInsert = serviceRole.inserts.find((i) => i.table === 'job_descriptions');
    expect(jdInsert?.values.user_id).toBe('user-1');
    expect(jdInsert?.values.title).toBe('Senior Product Manager');
    expect(jdInsert?.values.raw_text).toContain('own roadmap and strategy');
  });

  it('clears the anonymous copies once they belong to the user', async () => {
    const serviceRole = createServiceRole();

    await materializeAnonymousCarryover(serviceRole as any, makeRow(), 'user-1');

    expect(serviceRole.updates).toHaveLength(1);
    expect(serviceRole.updates[0]).toMatchObject({
      resume_id: 'resumes-id-1',
      job_description_id: 'job_descriptions-id-2',
      resume_text: null,
      job_description_text: null,
    });
  });

  it('is idempotent when the session was already materialized', async () => {
    const serviceRole = createServiceRole();

    const result = await materializeAnonymousCarryover(
      serviceRole as any,
      makeRow({ resume_id: 'resume-existing', job_description_id: 'jd-existing' }),
      'user-1',
    );

    expect(result).toEqual({
      resumeId: 'resume-existing',
      jobDescriptionId: 'jd-existing',
    });
    expect(serviceRole.inserts).toHaveLength(0);
  });

  it('converts legacy hash-only sessions without creating empty rows', async () => {
    const serviceRole = createServiceRole();

    const result = await materializeAnonymousCarryover(
      serviceRole as any,
      makeRow({ resume_text: null, job_description_text: null }),
      'user-1',
    );

    expect(result).toEqual({ resumeId: null, jobDescriptionId: null });
    expect(serviceRole.inserts).toHaveLength(0);
  });

  it('does not strand a resume row when the job description insert fails', async () => {
    const serviceRole = createServiceRole({ failOn: 'job_descriptions' });

    const result = await materializeAnonymousCarryover(
      serviceRole as any,
      makeRow(),
      'user-1',
    );

    expect(result).toEqual({ resumeId: null, jobDescriptionId: null });
    // The row is never linked, so the score still carries over on its own.
    expect(serviceRole.updates).toHaveLength(0);
  });
});

type LinkFilter = { op: string; column: string; value: unknown };
type LinkCall = { table: string; values: Record<string, unknown>; filters: LinkFilter[] };

function createLinkClient(
  result: { data?: Array<{ id: number }> | null; error?: { message: string } | null } = {},
) {
  const calls: LinkCall[] = [];

  const client = {
    calls,
    from: jest.fn((table: string) => ({
      update: jest.fn((values: Record<string, unknown>) => {
        const call: LinkCall = { table, values, filters: [] };
        calls.push(call);
        const builder: Record<string, unknown> = {
          eq: jest.fn((column: string, value: unknown) => {
            call.filters.push({ op: 'eq', column, value });
            return builder;
          }),
          is: jest.fn((column: string, value: unknown) => {
            call.filters.push({ op: 'is', column, value });
            return builder;
          }),
          select: jest.fn(async () => ({
            data: result.data === undefined ? [{ id: 1 }] : result.data,
            error: result.error ?? null,
          })),
        };
        return builder;
      }),
    })),
  };

  return client;
}

/**
 * The join that makes the carryover countable.
 *
 * An anonymous check that converts and then produces an optimization is the
 * whole point of WP-49, and without this link the two ends cannot be tied
 * together — so the feature's contribution to the activation number is
 * unmeasurable even when the feature works perfectly, which it now does.
 */
describe('linkCarryoverOptimization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('stamps the optimization onto the anonymous check whose artifacts produced it', async () => {
    const serviceRole = createLinkClient();

    const linked = await linkCarryoverOptimization(serviceRole as any, {
      userId: 'user-1',
      resumeId: 'resume-1',
      jobDescriptionId: 'jd-1',
      optimizationId: 'opt-1',
    });

    expect(linked).toBe(true);

    const call = serviceRole.calls[0];
    expect(call.table).toBe('anonymous_ats_scores');
    expect(call.values).toEqual({ optimization_id: 'opt-1' });
    // Matched on the owner AND both artifacts: those two columns are written
    // only by materializeAnonymousCarryover, so nothing except a genuinely
    // carried-over session can match.
    expect(call.filters).toEqual(
      expect.arrayContaining([
        { op: 'eq', column: 'user_id', value: 'user-1' },
        { op: 'eq', column: 'resume_id', value: 'resume-1' },
        { op: 'eq', column: 'job_description_id', value: 'jd-1' },
      ]),
    );
  });

  it('attributes the anonymous check to the first optimization it produced, not the latest', async () => {
    const serviceRole = createLinkClient();

    await linkCarryoverOptimization(serviceRole as any, {
      userId: 'user-1',
      resumeId: 'resume-1',
      jobDescriptionId: 'jd-1',
      optimizationId: 'opt-2',
    });

    // Without this guard, re-optimizing the same carried résumé would keep
    // moving the link and the activation would be dated by the most recent run.
    expect(serviceRole.calls[0].filters).toContainEqual({
      op: 'is',
      column: 'optimization_id',
      value: null,
    });
  });

  it('writes nothing when the optimization did not come from a carried session', async () => {
    const serviceRole = createLinkClient();

    const linked = await linkCarryoverOptimization(serviceRole as any, {
      userId: 'user-1',
      resumeId: null,
      jobDescriptionId: null,
      optimizationId: 'opt-1',
    });

    expect(linked).toBe(false);
    expect(serviceRole.calls).toHaveLength(0);
  });

  it('reports not linked, without throwing, when the stamp fails', async () => {
    const serviceRole = createLinkClient({ data: null, error: { message: 'permission denied' } });

    // The optimization row already exists by this point. Throwing here would
    // fail an apply that has already succeeded, to protect a measurement.
    await expect(
      linkCarryoverOptimization(serviceRole as any, {
        userId: 'user-1',
        resumeId: 'resume-1',
        jobDescriptionId: 'jd-1',
        optimizationId: 'opt-1',
      }),
    ).resolves.toBe(false);
  });

  it('reports not linked when the user never had an anonymous check', async () => {
    const serviceRole = createLinkClient({ data: [] });

    await expect(
      linkCarryoverOptimization(serviceRole as any, {
        userId: 'user-1',
        resumeId: 'resume-1',
        jobDescriptionId: 'jd-1',
        optimizationId: 'opt-1',
      }),
    ).resolves.toBe(false);
  });
});
