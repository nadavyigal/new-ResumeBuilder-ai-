import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { getCreditBalance } from '@/lib/credits';

export async function GET(request: NextRequest) {
  const supabase = await createRouteHandlerClient(request);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get('limit') || 30), 100);

  const balance = await getCreditBalance(supabase as any, user.id);
  const { data: transactions, error } = await (supabase as any)
    .from('credit_transactions')
    .select('id, delta, reason, source, apple_transaction_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message || 'Failed to load credits' }, { status: 500 });
  }

  return NextResponse.json({
    balance,
    transactions: transactions || [],
  });
}
