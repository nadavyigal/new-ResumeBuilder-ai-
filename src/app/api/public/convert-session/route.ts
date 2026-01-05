import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient, createServiceRoleClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const supabase = await createRouteHandlerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const sessionId = body?.sessionId as string | undefined;

  if (!sessionId) {
    return NextResponse.json({ error: 'Session ID is required.' }, { status: 400 });
  }

  const serviceRole = createServiceRoleClient();
  const { data: anonScore, error: lookupError } = await serviceRole
    .from('anonymous_ats_scores')
    .select('id, ats_score, ats_suggestions, created_at')
    .eq('session_id', sessionId)
    .is('user_id', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    console.error('Anonymous session lookup error:', lookupError);
    return NextResponse.json({ error: 'Failed to find session.' }, { status: 500 });
  }

  if (!anonScore) {
    return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
  }

  const { error: updateError } = await serviceRole
    .from('anonymous_ats_scores')
    .update({
      user_id: user.id,
      converted_at: new Date().toISOString(),
    })
    .eq('id', anonScore.id);

  if (updateError) {
    console.error('Anonymous session update error:', updateError);
    return NextResponse.json({ error: 'Failed to convert session.' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    scoreData: {
      score: anonScore.ats_score,
      suggestions: anonScore.ats_suggestions,
    },
  });
}
