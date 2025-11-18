/**
 * API Route: POST /api/v1/history/undo
 * Reverts to the previous version by creating a new version with previous content.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { undoVersion } from '@/lib/chat-manager/versioning';

export async function POST(req: NextRequest) {
  const supabase = await createRouteHandlerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { current_version_id } = await req.json();
    if (!current_version_id) {
      return NextResponse.json({ error: 'current_version_id is required' }, { status: 400 });
    }

    const newVersion = await undoVersion(current_version_id);
    return NextResponse.json({ ok: true, version: newVersion });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Undo error' }, { status: 500 });
  }
}

