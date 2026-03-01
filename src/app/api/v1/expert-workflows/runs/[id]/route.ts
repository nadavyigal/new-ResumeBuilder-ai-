import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';

export async function GET(
  _request: NextRequest,
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
  const db = supabase as any;

  const { data: run, error: runError } = await db
    .from('expert_workflow_runs')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (runError) {
    return NextResponse.json({ error: runError.message }, { status: 500 });
  }
  if (!run) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }

  const { data: artifacts, error: artifactsError } = await db
    .from('expert_workflow_artifacts')
    .select('id, artifact_type, artifact_json, created_at')
    .eq('run_id', id)
    .order('created_at', { ascending: true });

  if (artifactsError) {
    return NextResponse.json({ error: artifactsError.message }, { status: 500 });
  }

  return NextResponse.json({
    run,
    artifacts: artifacts || [],
  });
}
