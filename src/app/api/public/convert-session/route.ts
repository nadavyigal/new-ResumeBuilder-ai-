import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient, createServiceRoleClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

type AnonymousAtsScoreRow = {
  id: number;
  session_id?: string | null;
  ats_score: number;
  ats_suggestions: unknown;
  created_at: string;
  converted_at?: string | null;
};

function serializeScoreData(score: AnonymousAtsScoreRow) {
  return {
    session_id: score.session_id,
    ats_score: score.ats_score,
    ats_suggestions: score.ats_suggestions,
    converted_at: score.converted_at ?? null,
    score: score.ats_score,
    suggestions: score.ats_suggestions,
  };
}

async function getAuthenticatedUser() {
  const supabase = await createRouteHandlerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  return { user, response: null };
}

export async function GET() {
  const { user, response } = await getAuthenticatedUser();
  if (!user) return response;

  const serviceRole = createServiceRoleClient();
  const { data: convertedScore, error } = await serviceRole
    .from('anonymous_ats_scores')
    .select('id, session_id, ats_score, ats_suggestions, created_at, converted_at')
    .eq('user_id', user.id)
    .not('converted_at', 'is', null)
    .order('converted_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Converted session lookup error:', error);
    return NextResponse.json({ error: 'Failed to load converted session.' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    scoreData: convertedScore ? serializeScoreData(convertedScore as AnonymousAtsScoreRow) : null,
  });
}

export async function POST(request: NextRequest) {
  const { user, response } = await getAuthenticatedUser();
  if (!user) return response;

  const body = await request.json().catch(() => null);
  const sessionId = typeof body?.sessionId === 'string' ? body.sessionId.trim() : '';

  if (!sessionId) {
    return NextResponse.json({ error: 'Session ID is required.' }, { status: 400 });
  }

  const serviceRole = createServiceRoleClient();
  const { data: anonScore, error: lookupError } = await serviceRole
    .from('anonymous_ats_scores')
    .select('id, session_id, ats_score, ats_suggestions, created_at, converted_at')
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
    const { data: convertedScore, error: convertedLookupError } = await serviceRole
      .from('anonymous_ats_scores')
      .select('id, session_id, ats_score, ats_suggestions, created_at, converted_at')
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .not('converted_at', 'is', null)
      .order('converted_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (convertedLookupError) {
      console.error('Converted session lookup error:', convertedLookupError);
      return NextResponse.json({ error: 'Failed to find session.' }, { status: 500 });
    }

    if (convertedScore) {
      return NextResponse.json({
        success: true,
        alreadyConverted: true,
        scoreData: serializeScoreData(convertedScore as AnonymousAtsScoreRow),
      });
    }

    return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
  }

  const convertedAt = new Date().toISOString();
  const { error: updateError } = await serviceRole
    .from('anonymous_ats_scores')
    .update({
      user_id: user.id,
      converted_at: convertedAt,
    })
    .eq('id', anonScore.id);

  if (updateError) {
    console.error('Anonymous session update error:', updateError);
    return NextResponse.json({ error: 'Failed to convert session.' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    scoreData: serializeScoreData({
      ...(anonScore as AnonymousAtsScoreRow),
      converted_at: convertedAt,
    }),
  });
}
