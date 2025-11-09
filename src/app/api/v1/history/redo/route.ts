/**
 * API Route: POST /api/v1/history/redo
 * Reapplies content from a specified version by creating a new version with that content.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { createResumeVersion, getVersionByNumber, getResumeVersion } from '@/lib/supabase/resume-versions';

export async function POST(req: NextRequest) {
  const supabase = await createRouteHandlerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { optimization_id, version_number, version_id, session_id } = await req.json();

    let base: any = null;
    if (version_id) {
      base = await getResumeVersion(version_id);
      if (!base) return NextResponse.json({ error: 'version_id not found' }, { status: 404 });
    } else {
      if (!optimization_id || typeof version_number !== 'number') {
        return NextResponse.json({ error: 'Provide version_id or (optimization_id and version_number)' }, { status: 400 });
      }
      base = await getVersionByNumber(optimization_id, version_number);
      if (!base) return NextResponse.json({ error: 'Requested version not found' }, { status: 404 });
    }

    const created = await createResumeVersion({
      optimization_id: base.optimization_id,
      session_id: session_id ?? base.session_id ?? null,
      content: base.content,
      change_summary: `Redo: re-applied version ${base.version_number}`,
    });

    return NextResponse.json({ ok: true, version: created });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Redo error' }, { status: 500 });
  }
}

