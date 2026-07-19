import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const supabase = await createRouteHandlerClient(request);
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('saved_resumes')
    .select('id, filename, display_name, size_bytes, created_at, optimization_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const resumes = (data || []).map(r => ({
    id: r.id,
    filename: r.filename,
    display_name: r.display_name ?? null,
    created_at: r.created_at,
    size_bytes: r.size_bytes ?? null,
    optimization_id: r.optimization_id ?? null,
  }));

  return NextResponse.json({ resumes });
}
