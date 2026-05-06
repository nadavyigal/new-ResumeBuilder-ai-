/**
 * GET /api/resumes/[id]
 *
 * Returns resume raw_text for the authenticated owner.
 * Used by the iOS client to fetch resume content before scoring.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createRouteHandlerClient(request);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: 'Resume ID is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('resumes')
    .select('raw_text')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
  }

  return NextResponse.json({ raw_text: (data as { raw_text: string }).raw_text });
}
