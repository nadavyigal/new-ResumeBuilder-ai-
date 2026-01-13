import { createServiceRoleClient } from '@/lib/supabase-server';

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

const UNIQUE_VIOLATION = '23505';
const NOT_FOUND = 'PGRST116';
const RPC_NOT_FOUND = 'PGRST202';

interface RateLimitRow {
  requests_count: number;
  window_start: string;
}

async function legacyCheckRateLimit(
  supabase: ReturnType<typeof createServiceRoleClient>,
  identifier: string,
  endpoint: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const now = new Date();

  const { data: existing, error } = await supabase
    .from('rate_limits')
    .select('id, requests_count, window_start')
    .eq('identifier', identifier)
    .eq('endpoint', endpoint)
    .maybeSingle();

  if (error && error.code !== NOT_FOUND) {
    throw new Error(`Rate limit lookup failed: ${error.message}`);
  }

  if (!existing) {
    const { error: insertError } = await supabase
      .from('rate_limits')
      .insert({
        identifier,
        endpoint,
        requests_count: 1,
        window_start: now.toISOString(),
      });

    if (insertError && insertError.code === UNIQUE_VIOLATION) {
      return legacyCheckRateLimit(supabase, identifier, endpoint, config);
    }

    if (insertError) {
      throw new Error(`Rate limit insert failed: ${insertError.message}`);
    }

    return {
      allowed: true,
      remaining: Math.max(0, config.maxRequests - 1),
      resetAt: new Date(now.getTime() + config.windowMs),
    };
  }

  const windowStart = new Date(existing.window_start);
  const resetAt = new Date(windowStart.getTime() + config.windowMs);

  if (now.getTime() > resetAt.getTime()) {
    const { error: resetError } = await supabase
      .from('rate_limits')
      .update({
        requests_count: 1,
        window_start: now.toISOString(),
      })
      .eq('id', existing.id);

    if (resetError) {
      throw new Error(`Rate limit reset failed: ${resetError.message}`);
    }

    return {
      allowed: true,
      remaining: Math.max(0, config.maxRequests - 1),
      resetAt: new Date(now.getTime() + config.windowMs),
    };
  }

  if (existing.requests_count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt,
    };
  }

  const nextCount = existing.requests_count + 1;
  const { error: updateError } = await supabase
    .from('rate_limits')
    .update({ requests_count: nextCount })
    .eq('id', existing.id);

  if (updateError) {
    throw new Error(`Rate limit update failed: ${updateError.message}`);
  }

  return {
    allowed: true,
    remaining: Math.max(0, config.maxRequests - nextCount),
    resetAt,
  };
}

export async function checkRateLimit(
  identifier: string,
  endpoint: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc('increment_rate_limit', {
    p_identifier: identifier,
    p_endpoint: endpoint,
    p_window_ms: config.windowMs,
  });

  if (error) {
    if (error.code === RPC_NOT_FOUND || error.message?.includes('increment_rate_limit')) {
      return legacyCheckRateLimit(supabase, identifier, endpoint, config);
    }
    throw new Error(`Rate limit update failed: ${error.message}`);
  }

  const row = (Array.isArray(data) ? data[0] : data) as RateLimitRow | null;
  if (!row?.window_start) {
    throw new Error('Rate limit update returned no data');
  }

  const requestsCount = Number(row.requests_count) || 0;
  const windowStart = new Date(row.window_start);
  const resetAt = new Date(windowStart.getTime() + config.windowMs);

  return {
    allowed: requestsCount <= config.maxRequests,
    remaining: Math.max(0, config.maxRequests - requestsCount),
    resetAt,
  };
}
