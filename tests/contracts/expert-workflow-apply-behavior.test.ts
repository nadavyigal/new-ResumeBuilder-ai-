import { beforeEach, describe, expect, it, jest } from '@jest/globals';

type QueryResult = { data: any; error: any };

function buildUpdateChain() {
  return {
    eq() {
      return {
        error: null,
        eq: async () => ({ error: null }),
      };
    },
  };
}

function buildSelectChain(result: QueryResult, needsSecondEq = false) {
  if (!needsSecondEq) {
    return {
      eq() {
        return {
          maybeSingle: async () => result,
        };
      },
    };
  }

  return {
    eq() {
      return {
        eq() {
          return {
            maybeSingle: async () => result,
          };
        },
      };
    },
  };
}

function buildSupabaseMock(config: {
  runResult: QueryResult;
  optimizationResult: QueryResult;
  resumeResult: QueryResult;
  jobDescriptionResult: QueryResult;
}) {
  const optimizationUpdates: Record<string, unknown>[] = [];
  const applicationUpdates: Record<string, unknown>[] = [];
  const runUpdates: Record<string, unknown>[] = [];

  const supabase = {
    from(table: string) {
      if (table === 'expert_workflow_runs') {
        return {
          select() {
            return buildSelectChain(config.runResult, true);
          },
          update(payload: Record<string, unknown>) {
            runUpdates.push(payload);
            return buildUpdateChain();
          },
        };
      }

      if (table === 'optimizations') {
        return {
          select() {
            return buildSelectChain(config.optimizationResult, true);
          },
          update(payload: Record<string, unknown>) {
            optimizationUpdates.push(payload);
            return buildUpdateChain();
          },
        };
      }

      if (table === 'resumes') {
        return {
          select() {
            return buildSelectChain(config.resumeResult);
          },
        };
      }

      if (table === 'job_descriptions') {
        return {
          select() {
            return buildSelectChain(config.jobDescriptionResult);
          },
        };
      }

      if (table === 'applications') {
        return {
          update(payload: Record<string, unknown>) {
            applicationUpdates.push(payload);
            return buildUpdateChain();
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
    getOptimizationUpdates() {
      return optimizationUpdates;
    },
    getApplicationUpdates() {
      return applicationUpdates;
    },
    getRunUpdates() {
      return runUpdates;
    },
  };

  return supabase as any;
}

function loadApplyHarness() {
  jest.resetModules();

  const scoreOptimization = jest.fn();
  jest.doMock('@/lib/ats/integration', () => ({
    __esModule: true,
    scoreOptimization,
  }));

  const { applyExpertWorkflowRun } = require('@/lib/expert-workflows');
  return { applyExpertWorkflowRun, scoreOptimization };
}

describe('expert workflow apply behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates resume data and ATS impact for resume-changing workflows', async () => {
    const { applyExpertWorkflowRun, scoreOptimization } = loadApplyHarness();
    scoreOptimization.mockResolvedValue({
      ats_score_original: 58,
      ats_score_optimized: 74,
      subscores: { keywordExact: 74 },
      subscores_original: { keywordExact: 58 },
      suggestions: ['Add metrics'],
      confidence: 'high',
    });

    const rewrittenResume = {
      summary: 'Rewritten summary',
      contact: { name: 'Ada', email: 'ada@example.com', phone: '', location: '' },
      skills: { technical: ['TypeScript'], soft: [] },
      experience: [],
      education: [],
      matchScore: 74,
      keyImprovements: [],
      missingKeywords: [],
    };

    const supabase = buildSupabaseMock({
      runResult: {
        data: {
          id: 'run-1',
          user_id: 'user-1',
          optimization_id: 'opt-1',
          workflow_type: 'full_resume_rewrite',
          output_json: {
            rewritten_resume: rewrittenResume,
          },
        },
        error: null,
      },
      optimizationResult: {
        data: {
          id: 'opt-1',
          rewrite_data: {
            summary: 'Old summary',
          },
          resume_id: 'resume-1',
          jd_id: 'jd-1',
          ats_score_optimized: 62,
          match_score: 62,
        },
        error: null,
      },
      resumeResult: {
        data: { raw_text: 'Original resume text' },
        error: null,
      },
      jobDescriptionResult: {
        data: { raw_text: 'JD raw', clean_text: 'JD clean', title: 'Engineer' },
        error: null,
      },
    });

    const result = await applyExpertWorkflowRun({
      supabase,
      userId: 'user-1',
      runId: 'run-1',
    });

    expect(result.success).toBe(true);
    expect(result.workflow_type).toBe('full_resume_rewrite');
    expect(result.updated_fields).toEqual(['entire_resume']);
    expect(result.ats_impact).toEqual({ before: 62, after: 74, delta: 12 });
    expect(result.new_ats_score).toBe(74);
    expect((supabase as any).getOptimizationUpdates()[0]).toEqual({ rewrite_data: rewrittenResume });
    expect((supabase as any).getApplicationUpdates()[0]).toEqual({ ats_score: 74 });
    expect((supabase as any).getRunUpdates()[0]).toMatchObject({
      status: 'completed',
      updated_fields_json: ['entire_resume'],
      apply_mode: 'default',
      applied_assets_json: [],
    });
  });

  it('stores selected assets and keeps ATS impact null-safe for non-resume workflows', async () => {
    const { applyExpertWorkflowRun, scoreOptimization } = loadApplyHarness();

    const supabase = buildSupabaseMock({
      runResult: {
        data: {
          id: 'run-cover',
          user_id: 'user-1',
          optimization_id: 'opt-1',
          workflow_type: 'cover_letter_architect',
          output_json: {
            recommended_index: 2,
            cover_letter_variants: [
              { angle: 'concise', title: 'A', opening_paragraph: 'A', letter: 'L1', rationale: 'R1' },
              { angle: 'narrative', title: 'B', opening_paragraph: 'B', letter: 'L2', rationale: 'R2' },
              { angle: 'impact', title: 'C', opening_paragraph: 'C', letter: 'L3', rationale: 'R3' },
            ],
          },
        },
        error: null,
      },
      optimizationResult: {
        data: {
          id: 'opt-1',
          rewrite_data: { summary: 'No change' },
          resume_id: 'resume-1',
          jd_id: 'jd-1',
          ats_score_optimized: 62,
          match_score: 62,
        },
        error: null,
      },
      resumeResult: {
        data: { raw_text: 'Original resume text' },
        error: null,
      },
      jobDescriptionResult: {
        data: { raw_text: 'JD raw', clean_text: 'JD clean', title: 'Engineer' },
        error: null,
      },
    });

    const result = await applyExpertWorkflowRun({
      supabase,
      userId: 'user-1',
      runId: 'run-cover',
      applyMode: 'select_cover_letter_variant',
      selectionIndex: 1,
    });

    expect(result.success).toBe(true);
    expect(result.workflow_type).toBe('cover_letter_architect');
    expect(result.updated_fields).toEqual([]);
    expect(result.applied_assets).toEqual(['cover_letter_variant:1']);
    expect(result.ats_impact).toEqual({ before: null, after: null, delta: null });
    expect(result.new_ats_score).toBeNull();
    expect((supabase as any).getOptimizationUpdates()).toHaveLength(0);
    expect((supabase as any).getApplicationUpdates()).toHaveLength(0);
    expect((supabase as any).getRunUpdates()[0]).toMatchObject({
      apply_mode: 'select_cover_letter_variant',
      selection_index: 1,
      applied_assets_json: ['cover_letter_variant:1'],
    });
    expect(scoreOptimization).not.toHaveBeenCalled();
  });
});
