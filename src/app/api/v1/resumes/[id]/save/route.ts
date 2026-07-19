import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createRouteHandlerClient(request);
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ success: false, resume: null }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const displayName: string | undefined = body.displayName ?? body.display_name;

  // Look up the optimization to get a filename and verify ownership
  const { data: opt, error: optError } = await supabase
    .from('optimizations')
    .select('id, resume_id, created_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (optError || !opt) {
    return NextResponse.json(
      { success: false, resume: null, error: 'Optimization not found' },
      { status: 404 }
    );
  }

  const filename = displayName
    ? `${displayName.replace(/[^a-zA-Z0-9 _-]/g, '')}.pdf`
    : `Resume_${new Date(opt.created_at).toISOString().slice(0, 10)}.pdf`;

  const { data: saved, error: insertError } = await supabase
    .from('saved_resumes')
    .insert({
      user_id: user.id,
      optimization_id: opt.id,
      filename,
      display_name: displayName ?? null,
    })
    .select('id, filename, display_name, size_bytes, created_at, optimization_id')
    .single();

  if (insertError) {
    return NextResponse.json({ success: false, resume: null }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    resume: {
      id: saved.id,
      filename: saved.filename,
      display_name: saved.display_name,
      created_at: saved.created_at,
      size_bytes: saved.size_bytes,
      optimization_id: saved.optimization_id,
    },
  });
}
