import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { captureServerEvent } from '@/lib/posthog-server';
import { applyExpertWorkflowRun } from '@/lib/expert-workflows';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const body = await request.json().catch(() => ({}));
    const applyMode = typeof body.apply_mode === 'string' ? body.apply_mode : 'default';
    const selectionIndex =
      typeof body.selection_index === 'number' ? body.selection_index : undefined;

    await captureServerEvent(user.id, 'expert_apply_clicked', {
      run_id: id,
      apply_mode: applyMode,
    });

    const result = await applyExpertWorkflowRun({
      supabase,
      userId: user.id,
      runId: id,
      applyMode,
      selectionIndex,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to apply expert workflow output.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
