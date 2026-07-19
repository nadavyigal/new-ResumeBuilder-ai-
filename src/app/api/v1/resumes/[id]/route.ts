import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createRouteHandlerClient(request);
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const { id } = await params;

  const { error } = await supabase
    .from('saved_resumes')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(
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

  if (!displayName) {
    return NextResponse.json(
      { success: false, resume: null, error: 'displayName is required' },
      { status: 400 }
    );
  }

  const filename = `${displayName.replace(/[^a-zA-Z0-9 _-]/g, '')}.pdf`;

  const { data: updated, error } = await supabase
    .from('saved_resumes')
    .update({ display_name: displayName, filename, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id, filename, display_name, size_bytes, created_at, optimization_id')
    .single();

  if (error) {
    return NextResponse.json({ success: false, resume: null }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    resume: {
      id: updated.id,
      filename: updated.filename,
      display_name: updated.display_name,
      created_at: updated.created_at,
      size_bytes: updated.size_bytes,
      optimization_id: updated.optimization_id,
    },
  });
}
