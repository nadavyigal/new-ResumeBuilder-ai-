import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { captureServerEvent } from '@/lib/posthog-server';
import { runExpertWorkflow } from '@/lib/expert-workflows';
import type { ExpertWorkflowType } from '@/lib/expert-workflows';

const EXPERT_WORKFLOW_TYPES: ExpertWorkflowType[] = [
  'full_resume_rewrite',
  'achievement_quantifier',
  'ats_optimization_report',
  'professional_summary_lab',
];

function isExpertWorkflowType(value: string): value is ExpertWorkflowType {
  return EXPERT_WORKFLOW_TYPES.includes(value as ExpertWorkflowType);
}

function getLockedPreview(workflowType: ExpertWorkflowType) {
  const previews: Record<ExpertWorkflowType, string> = {
    full_resume_rewrite:
      'Preview: your summary and experience bullets will be rewritten for role fit with ATS-safe structure.',
    achievement_quantifier:
      'Preview: weak bullets will be upgraded into outcome-focused statements with clear evidence checks.',
    ats_optimization_report:
      'Preview: you will get keyword coverage insights, section compliance checks, and ATS format guidance.',
    professional_summary_lab:
      'Preview: you will receive 5 targeted summary options with one recommended direction.',
  };
  return previews[workflowType];
}

async function isPremiumUser(supabase: any, userId: string, user: any): Promise<boolean> {
  const metadata = user?.user_metadata || {};
  if (metadata.is_premium === true || metadata.plan_type === 'premium') {
    return true;
  }

  const { data } = await supabase
    .from('profiles')
    .select('plan_type')
    .eq('user_id', userId)
    .maybeSingle();

  return data?.plan_type === 'premium';
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

    if (!optimizationId || !workflowType || !isExpertWorkflowType(workflowType)) {
      return NextResponse.json(
        { error: 'optimization_id and valid workflow_type are required.' },
        { status: 400 }
      );
    }

    await captureServerEvent(user.id, 'expert_run_started', {
      workflow_type: workflowType,
      optimization_id: optimizationId,
      source: 'api_v1_expert_workflows_run',
    });

    const premium = await isPremiumUser(supabase, user.id, user);
    if (!premium) {
      await captureServerEvent(user.id, 'expert_mode_locked', {
        workflow_type: workflowType,
        optimization_id: optimizationId,
      });

      return NextResponse.json(
        {
          error: 'Premium required',
          code: 'PREMIUM_REQUIRED',
          locked_preview: getLockedPreview(workflowType),
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

    await captureServerEvent(user.id, 'expert_run_completed', {
      workflow_type: workflowType,
      optimization_id: optimizationId,
      run_id: result.run_id,
      status: result.status,
      needs_user_input: result.needs_user_input,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to run expert workflow.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
