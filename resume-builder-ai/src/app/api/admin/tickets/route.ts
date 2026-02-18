import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient, createServiceRoleClient } from '@/lib/supabase-server';
import type { TicketStatus, TicketCategory, TicketPriority } from '@/types/feedback';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'resumebuilderaiteam@gmail.com';

async function requireAdmin(): Promise<true | NextResponse> {
  const supabase = await createRouteHandlerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (user.email === ADMIN_EMAIL) return true;

  const serviceClient = createServiceRoleClient();
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  return true;
}

export async function GET(request: NextRequest) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const category = searchParams.get('category');
  const priority = searchParams.get('priority');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100);
  const offset = parseInt(searchParams.get('offset') ?? '0');

  const serviceClient = createServiceRoleClient();
  let query = serviceClient
    .from('support_tickets')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq('status', status as TicketStatus);
  if (category) query = query.eq('category', category as TicketCategory);
  if (priority) query = query.eq('priority', priority as TicketPriority);

  const { data, error, count } = await query;

  if (error) {
    console.error('Admin tickets list error:', error);
    return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 });
  }

  // Ticket stats
  const { data: allTickets } = await serviceClient
    .from('support_tickets')
    .select('status, priority');

  return NextResponse.json({
    data,
    total: count,
    stats: {
      total: allTickets?.length ?? 0,
      open: allTickets?.filter((t) => t.status === 'open').length ?? 0,
      in_progress: allTickets?.filter((t) => t.status === 'in_progress').length ?? 0,
      resolved: allTickets?.filter((t) => t.status === 'resolved').length ?? 0,
      high_priority: allTickets?.filter((t) => t.priority === 'high').length ?? 0,
    },
  });
}
