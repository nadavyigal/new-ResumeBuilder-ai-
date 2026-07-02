import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { hasUnlimitedAccess } from '@/lib/entitlements';
import { captureServerEvent } from '@/lib/posthog-server';
import { runExpertWorkflow } from '@/lib/expert-workflows/orchestrator';
import {
  SURFACED_EXPERT_WORKFLOW_TYPES,
  isSurfacedExpertWorkflowType,
  type SurfacedExpertWorkflowType,
} from '@/lib/expert-workflows';

function getLockedPreview(workflowType: SurfacedExpertWorkflowType) {
  const previews: Record<SurfacedExpertWorkflowType, string> = {
    full_resume_rewrite:
      'Preview: your summary and experience bullets will be rewritten for role fit with ATS-safe structure.',
    achievement_quantifier:
      'Preview: weak bullets will be upgraded into outcome-focused statements with clear evidence checks.',
    ats_optimization_report:
      'Preview: you will get keyword coverage insights, section compliance checks, and ATS format guidance.',
    professional_summary_lab:
      'Preview: you will receive 5 targeted summary options with one recommended direction.',
    cover_letter_architect:
      'Preview: Dear Hiring Team, I am excited to apply for this role because my recent work aligns directly with your priorities. Unlock Premium to generate all 3 tailored variants and save one to your application.',
    screening_answer_studio:
      'Preview: you will receive role-specific screening answers with evidence notes and confidence guidance.',
  };
  return previews[workflowType];
}

async function isPremiumUser(supabase: any, userId: string, user: any): Promise<boolean> {
  return hasUnlimitedAccess(supabase, userId, user?.user_metadata);
}

export async function POST(request: NextRequest) {
  if (process.env.EXPERT_WORKFLOWS_ENABLED === 'false') {
    return NextResponse.json({ error: 'Expert workflows are disabled.' }, { status: 503 });
  }

  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const workflowType = String(body.workflow_type || '');
    const optimizationId = String(body.optimization_id || '');
    const options = body.options && typeof body.options === 'object' ? body.options : {};
    const evidenceInputs =
      body.evidence_inputs && typeof body.evidence_inputs === 'object' ? body.evidence_inputs : {};

    if (!optimizationId || !workflowType || !isSurfacedExpertWorkflowType(workflowType)) {
      return NextResponse.json(
        {
          error: 'optimization_id and valid workflow_type are required.',
          code: 'INVALID_WORKFLOW_TYPE',
          supported_workflow_types: SURFACED_EXPERT_WORKFLOW_TYPES,
        },
        { status: 400 }
      );
    }

    const premium = await isPremiumUser(supabase, user.id, user);
    await captureServerEvent(user.id, 'expert_mode_run_started', {
      workflow_type: workflowType,
      optimization_id: optimizationId,
      source: 'api_v1_expert_workflows_run',
      is_premium: premium,
    });
    await captureServerEvent(user.id, 'expert_run_started', {
      workflow_type: workflowType,
      optimization_id: optimizationId,
      source: 'api_v1_expert_workflows_run',
      is_premium: premium,
    });
    if (!premium) {
      await captureServerEvent(user.id, 'expert_mode_locked', {
        workflow_type: workflowType,
        optimization_id: optimizationId,
        is_premium: false,
      });

      return NextResponse.json(
        {
          error: 'Premium required',
          code: 'PREMIUM_REQUIRED',
          workflow_type: workflowType,
          locked_preview: getLockedPreview(workflowType),
          supported_workflow_types: SURFACED_EXPERT_WORKFLOW_TYPES,
        },
        { status: 402 }
      );
    }

    const result = await runExpertWorkflow({
      supabase,
      userId: user.id,
      optimizationId,
      workflowType,
      options,
      evidenceInputs,
    });

    await captureServerEvent(user.id, 'expert_mode_run_completed', {
      workflow_type: workflowType,
      optimization_id: optimizationId,
      run_id: result.run_id,
      status: result.status,
      needs_user_input: result.needs_user_input,
      is_premium: true,
    });
    await captureServerEvent(user.id, 'expert_run_completed', {
      workflow_type: workflowType,
      optimization_id: optimizationId,
      run_id: result.run_id,
      status: result.status,
      needs_user_input: result.needs_user_input,
      is_premium: true,
    });

    return NextResponse.json({
      workflow_type: workflowType,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to run expert workflow.';
    return NextResponse.json(
      {
        error: message,
        status: 'failed',
        needs_user_input: false,
        missing_evidence: [],
      },
      { status: 500 }
    );
  }
}
