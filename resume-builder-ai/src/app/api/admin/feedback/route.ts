import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient, createServiceRoleClient } from '@/lib/supabase-server';
import type { FeedbackType, FeedbackStatus } from '@/types/feedback';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'resumebuilderaiteam@gmail.com';
type FeedbackStatRow = { type: string | null; rating: number | null; status: string | null };

async function requireAdmin(): Promise<{ userId: string } | NextResponse> {
  const supabase = await createRouteHandlerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Allow access if user email matches admin email, or if profile role is 'admin'
  if (user.email === ADMIN_EMAIL) {
    return { userId: user.id };
  }

  const serviceClient = createServiceRoleClient();
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return { userId: user.id };
}

export async function GET(request: NextRequest) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const status = searchParams.get('status');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100);
  const offset = parseInt(searchParams.get('offset') ?? '0');

  const serviceClient = createServiceRoleClient();
  let query = (serviceClient as any)
    .from('feedback')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (type) query = query.eq('type', type as FeedbackType);
  if (status) query = query.eq('status', status as FeedbackStatus);

  const { data, error, count } = await query;

  if (error) {
    console.error('Admin feedback list error:', error);
    return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 });
  }

  // Compute stats
  const { data: stats } = await (serviceClient as any)
    .from('feedback')
    .select('type, rating, status');
  const statsRows: FeedbackStatRow[] = Array.isArray(stats) ? stats : [];

  const npsEntries = statsRows.filter((f) => f.type === 'nps' && f.rating != null);
  const avgNps = npsEntries.length
    ? Math.round((npsEntries.reduce((sum, f) => sum + (f.rating ?? 0), 0) / npsEntries.length) * 10) / 10
    : null;

  return NextResponse.json({
    data,
    total: count,
    stats: {
      total: statsRows.length,
      new: statsRows.filter((f) => f.status === 'new').length,
      avg_nps: avgNps,
      by_type: {
        general: statsRows.filter((f) => f.type === 'general').length,
        bug: statsRows.filter((f) => f.type === 'bug').length,
        feature_request: statsRows.filter((f) => f.type === 'feature_request').length,
        nps: npsEntries.length,
        rating: statsRows.filter((f) => f.type === 'rating').length,
      },
    },
  });
}
