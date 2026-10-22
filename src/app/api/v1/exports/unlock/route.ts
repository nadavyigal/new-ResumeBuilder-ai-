import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { authorizeExport } from '@/lib/export-credits';
import { checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from '@/lib/utils/rate-limit';

/**
 * POST /api/v1/exports/unlock { optimizationId }
 *
 * Unlocks one optimization for export (StoreKit spec 6.4). Spends a credit only
 * when the gate applies (the iOS app, with EXPORT_CREDITS_ENABLED or a test
 * account listed in EXPORT_CREDITS_USER_IDS, spec 6.5);
 * otherwise it records an ungated unlock and answers 200 { status: 'ungated' }.
 */
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
  const optimizationId = typeof body?.optimizationId === 'string' ? body.optimizationId.trim() : '';
  if (!optimizationId) {
    return NextResponse.json({ error: 'optimizationId is required' }, { status: 400 });
  }

  const rateResult = checkRateLimit(`export-unlock:${user.id}`, RATE_LIMITS.export);
  if (!rateResult.allowed) {
    const retryAfter = Math.max(1, Math.ceil((rateResult.resetTime - Date.now()) / 1000));
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please slow down and try again shortly.' },
      {
        status: 429,
        headers: {
          ...getRateLimitHeaders(rateResult),
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': RATE_LIMITS.export.maxRequests.toString(),
        },
      }
    );
  }

  const authorization = await authorizeExport({ user, optimizationId, headers: request.headers });
  if (!authorization.allowed) {
    return NextResponse.json(authorization.body, { status: authorization.httpStatus });
  }

  return NextResponse.json({ status: authorization.status, balance: authorization.balance });
}
