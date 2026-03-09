import { beforeEach, describe, expect, it, jest } from '@jest/globals';

function buildSupabaseClient({
  user = { id: 'user-1', user_metadata: {} },
  profilePlan = 'free',
}: {
  user?: any;
  profilePlan?: string;
}) {
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user },
        error: null,
      }),
    },
    from: jest.fn((table: string) => {
      if (table !== 'profiles') {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => ({ data: { plan_type: profilePlan }, error: null }),
              };
            },
          };
        },
      };
    }),
  };
}

function loadRouteHarness() {
  jest.resetModules();

  const createRouteHandlerClient = jest.fn();
  const captureServerEvent = jest.fn();
  const runExpertWorkflow = jest.fn();

  jest.doMock('@/lib/supabase-server', () => ({
    __esModule: true,
    createRouteHandlerClient,
  }));

  jest.doMock('@/lib/posthog-server', () => ({
    __esModule: true,
    captureServerEvent,
  }));

  jest.doMock('@/lib/expert-workflows', () => {
    const actual = jest.requireActual('@/lib/expert-workflows');
    return {
      __esModule: true,
      ...actual,
      runExpertWorkflow,
    };
  });

  const { POST } = require('@/app/api/v1/expert-workflows/run/route');
  return { POST, createRouteHandlerClient, captureServerEvent, runExpertWorkflow };
}

describe('POST /api/v1/expert-workflows/run', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EXPERT_WORKFLOWS_ENABLED = 'true';
  });

  it('rejects hidden workflow types from the public run endpoint', async () => {
    const { POST, createRouteHandlerClient, runExpertWorkflow } = loadRouteHarness();
    createRouteHandlerClient.mockResolvedValue(buildSupabaseClient({}));

    const request = new Request('http://localhost/api/v1/expert-workflows/run', {
      method: 'POST',
      body: JSON.stringify({
        optimization_id: 'opt-1',
        workflow_type: 'recruiter_outreach_kit',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.code).toBe('INVALID_WORKFLOW_TYPE');
    expect(payload.supported_workflow_types).toEqual([
      'full_resume_rewrite',
      'achievement_quantifier',
      'ats_optimization_report',
      'professional_summary_lab',
      'cover_letter_architect',
      'screening_answer_studio',
    ]);
    expect(runExpertWorkflow).not.toHaveBeenCalled();
  });

  it('returns a locked preview for non-premium users', async () => {
    const { POST, createRouteHandlerClient, captureServerEvent, runExpertWorkflow } =
      loadRouteHarness();
    createRouteHandlerClient.mockResolvedValue(
      buildSupabaseClient({
        user: { id: 'user-1', user_metadata: { is_premium: false } },
        profilePlan: 'free',
      })
    );

    const request = new Request('http://localhost/api/v1/expert-workflows/run', {
      method: 'POST',
      body: JSON.stringify({
        optimization_id: 'opt-1',
        workflow_type: 'cover_letter_architect',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(402);
    expect(payload.code).toBe('PREMIUM_REQUIRED');
    expect(payload.workflow_type).toBe('cover_letter_architect');
    expect(typeof payload.locked_preview).toBe('string');
    expect(captureServerEvent).toHaveBeenCalledWith(
      'user-1',
      'expert_mode_locked',
      expect.objectContaining({
        workflow_type: 'cover_letter_architect',
        optimization_id: 'opt-1',
      })
    );
    expect(runExpertWorkflow).not.toHaveBeenCalled();
  });

  it('returns structured workflow status for surfaced workflows', async () => {
    const { POST, createRouteHandlerClient, runExpertWorkflow } = loadRouteHarness();
    createRouteHandlerClient.mockResolvedValue(
      buildSupabaseClient({
        user: { id: 'user-1', user_metadata: { is_premium: true } },
      })
    );
    runExpertWorkflow.mockResolvedValue({
      run_id: 'run-1',
      status: 'needs_user_input',
      output: { report: { headline: 'Report' } },
      needs_user_input: true,
      missing_evidence: ['Need a metric'],
    });

    const request = new Request('http://localhost/api/v1/expert-workflows/run', {
      method: 'POST',
      body: JSON.stringify({
        optimization_id: 'opt-1',
        workflow_type: 'professional_summary_lab',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.workflow_type).toBe('professional_summary_lab');
    expect(payload.status).toBe('needs_user_input');
    expect(payload.needs_user_input).toBe(true);
    expect(payload.missing_evidence).toEqual(['Need a metric']);
  });
});
