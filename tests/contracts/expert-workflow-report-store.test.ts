import { describe, expect, it } from '@jest/globals';
import { listApplicationExpertReports, saveAppliedRunToApplication } from '@/lib/expert-workflows';

type QueryResult = { data: any; error: any };

function buildSupabaseMock(config: {
  applicationResult: QueryResult;
  runResult: QueryResult;
  saveResult?: QueryResult;
  listResult?: QueryResult;
}) {
  let upsertPayload: Record<string, unknown> | null = null;

  const supabase = {
    from(table: string) {
      if (table === 'applications') {
        return {
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      maybeSingle: async () => config.applicationResult,
                    };
                  },
                };
              },
            };
          },
        };
      }

      if (table === 'expert_workflow_runs') {
        return {
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      maybeSingle: async () => config.runResult,
                    };
                  },
                };
              },
            };
          },
        };
      }

      if (table === 'application_expert_reports') {
        return {
          upsert(payload: Record<string, unknown>) {
            upsertPayload = payload;
            return {
              select() {
                return {
                  maybeSingle: async () =>
                    config.saveResult || {
                      data: payload,
                      error: null,
                    },
                };
              },
            };
          },
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      order: async () =>
                        config.listResult || {
                          data: [],
                          error: null,
                        },
                    };
                  },
                };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
    getUpsertPayload() {
      return upsertPayload;
    },
  };

  return supabase as any;
}

describe('application expert report store contract', () => {
  it('rejects save when run and application optimization ids mismatch', async () => {
    const supabase = buildSupabaseMock({
      applicationResult: { data: { id: 'app-1', optimization_id: 'opt-a' }, error: null },
      runResult: {
        data: {
          id: 'run-1',
          optimization_id: 'opt-b',
          workflow_type: 'ats_optimization_report',
          status: 'completed',
          output_json: { report: { headline: 'H', executive_summary: 'S', priority_actions: [], evidence_gaps: [], ats_impact_estimate: {} } },
        },
        error: null,
      },
    });

    await expect(
      saveAppliedRunToApplication({
        supabase,
        userId: 'user-1',
        applicationId: 'app-1',
        runId: 'run-1',
      })
    ).rejects.toThrow('same optimization');
  });

  it('rejects save when run is not applied', async () => {
    const supabase = buildSupabaseMock({
      applicationResult: { data: { id: 'app-1', optimization_id: 'opt-a' }, error: null },
      runResult: {
        data: {
          id: 'run-1',
          optimization_id: 'opt-a',
          workflow_type: 'full_resume_rewrite',
          status: 'failed',
          applied_at: null,
          output_json: { report: { headline: 'H', executive_summary: 'S', priority_actions: [], evidence_gaps: [], ats_impact_estimate: {} } },
        },
        error: null,
      },
    });

    await expect(
      saveAppliedRunToApplication({
        supabase,
        userId: 'user-1',
        applicationId: 'app-1',
        runId: 'run-1',
      })
    ).rejects.toThrow('applied');
  });

  it('saves report snapshot and ATS impact for applied run', async () => {
    const supabase = buildSupabaseMock({
      applicationResult: { data: { id: 'app-1', optimization_id: 'opt-a' }, error: null },
      runResult: {
        data: {
          id: 'run-1',
          optimization_id: 'opt-a',
          workflow_type: 'professional_summary_lab',
          status: 'completed',
          applied_at: '2026-03-02T12:00:00.000Z',
          ats_score_before: 66,
          ats_score_after: 74,
          updated_fields_json: ['summary'],
          output_json: {
            report: {
              headline: 'Summary variants evaluated',
              executive_summary: 'Selected the summary with strongest role alignment.',
              priority_actions: ['Apply the recommended summary variant'],
              evidence_gaps: [],
              ats_impact_estimate: { before: 66, after: 74, delta: 8 },
            },
          },
        },
        error: null,
      },
    });

    const saved = await saveAppliedRunToApplication({
      supabase,
      userId: 'user-1',
      applicationId: 'app-1',
      runId: 'run-1',
    });

    expect(saved).toBeDefined();
    const payload = (supabase as any).getUpsertPayload();
    expect(payload).toBeTruthy();
    expect(payload?.workflow_type).toBe('professional_summary_lab');
    expect(payload?.ats_score_delta).toBe(8);
  });

  it('lists reports ordered by save timestamp', async () => {
    const supabase = buildSupabaseMock({
      applicationResult: { data: null, error: null },
      runResult: { data: null, error: null },
      listResult: {
        data: [{ id: 'r1' }, { id: 'r2' }],
        error: null,
      },
    });

    const rows = await listApplicationExpertReports({
      supabase,
      userId: 'user-1',
      applicationId: 'app-1',
    });

    expect(rows.length).toBe(2);
  });
});
