import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
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
