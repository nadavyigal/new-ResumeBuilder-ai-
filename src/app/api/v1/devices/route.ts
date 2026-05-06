import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';

function normalizeToken(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(/[\s<>]/g, '');
}

export async function POST(request: NextRequest) {
  const supabase = await createRouteHandlerClient(request);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const apnsToken = normalizeToken(body?.apnsToken);
  const platform = typeof body?.platform === 'string' ? body.platform : 'ios';

  if (!apnsToken) {
    return NextResponse.json({ error: 'apnsToken is required' }, { status: 400 });
  }

  const { error } = await (supabase as any).from('device_tokens').upsert(
    {
      user_id: user.id,
      apns_token: apnsToken,
      platform,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,apns_token' }
  );

  if (error) {
    return NextResponse.json({ error: error.message || 'Failed to register device token' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createRouteHandlerClient(request);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const apnsToken = normalizeToken(body?.apnsToken);

  if (!apnsToken) {
    return NextResponse.json({ error: 'apnsToken is required' }, { status: 400 });
  }

  const { error } = await (supabase as any)
    .from('device_tokens')
    .delete()
    .eq('user_id', user.id)
    .eq('apns_token', apnsToken);

  if (error) {
    return NextResponse.json({ error: error.message || 'Failed to unregister device token' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
