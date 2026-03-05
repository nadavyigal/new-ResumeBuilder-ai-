import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import {
  listApplicationExpertReports,
  saveAppliedRunToApplication,
} from '@/lib/expert-workflows';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const { data: app, error: appError } = await supabase
      .from('applications')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (appError || !app) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    const reports = await listApplicationExpertReports({
      supabase,
      userId: user.id,
      applicationId: id,
    });

    return NextResponse.json({ success: true, reports });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load expert reports.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const body = await req.json().catch(() => ({}));
    const runId = typeof body.run_id === 'string' ? body.run_id : '';

    if (!runId) {
      return NextResponse.json({ error: 'run_id is required' }, { status: 400 });
    }

    const report = await saveAppliedRunToApplication({
      supabase,
      userId: user.id,
      applicationId: id,
      runId,
    });

    return NextResponse.json({ success: true, report });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save expert report.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
