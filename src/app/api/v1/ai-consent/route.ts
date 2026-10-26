import { NextRequest, NextResponse } from 'next/server';
import { parseAIConsentBody } from '@/lib/ai-consent';
import { createRouteHandlerClient, createServiceRoleClient } from '@/lib/supabase-server';
import { checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from '@/lib/utils/rate-limit';

/**
 * POST /api/v1/ai-consent
 * { version, action: "grant" | "withdraw", clientRecordedAt? }
 *
 * Stores the authenticated user's AI-consent answer. The user id comes from
 * the bearer token, never from the body. This route does not gate other AI
 * routes: installed apps that predate it keep working until a later release
 * starts requiring the record.
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

  const parsed = parseAIConsentBody(await request.json().catch(() => null));
  if (!parsed) {
    return NextResponse.json({ error: 'invalid_consent' }, { status: 400 });
  }

  const rateResult = checkRateLimit(`ai-consent:${user.id}`, RATE_LIMITS.default);
  if (!rateResult.allowed) {
    const retryAfter = Math.max(1, Math.ceil((rateResult.resetTime - Date.now()) / 1000));
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please slow down and try again shortly.' },
      {
        status: 429,
        headers: {
          ...getRateLimitHeaders(rateResult),
          'Retry-After': retryAfter.toString(),
        },
      }
    );
  }

  const { error } = await createServiceRoleClient().from('ai_consent_records').insert({
    user_id: user.id,
    consent_version: parsed.version,
    action: parsed.action,
    client_recorded_at: parsed.clientRecordedAt,
  });

  if (error) {
    const missing = /does not exist|schema cache/i.test(error.message);
    return NextResponse.json(
      { error: missing ? 'ai_consent_unavailable' : 'ai_consent_failed' },
      { status: missing ? 503 : 500 }
    );
  }

  return NextResponse.json({ recorded: true, action: parsed.action });
}
