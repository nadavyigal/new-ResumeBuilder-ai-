import type { SupabaseClient } from '@supabase/supabase-js';
import { log } from '@/lib/logger';
import type { Database } from '@/types/database';

const TELEMETRY_ENABLED = process.env.TELEMETRY_ENABLED === 'true';
const TELEMETRY_SHADOW = process.env.TELEMETRY_SHADOW === 'true';
const TELEMETRY_NAMESPACE = process.env.TELEMETRY_NAMESPACE ?? 'resume_builder_ai';

export interface TelemetryEvent {
  name: string;
  userId: string;
  payload?: Record<string, unknown>;
  context?: Record<string, unknown>;
}

export interface TelemetryResult {
  recorded: boolean;
  event: TelemetryEvent;
  reason?: 'disabled' | 'error';
  error?: unknown;
}

export type TelemetryMonitor = (result: TelemetryResult) => void;

type TelemetryClient = SupabaseClient<Database>;

let monitor: TelemetryMonitor | null = null;

function emit(result: TelemetryResult) {
  if (monitor) {
    try {
      monitor(result);
    } catch (error) {
      log.warn('[telemetry] monitor callback failed', {
        error: error instanceof Error ? error.message : error,
      });
    }
  }
}

export function setTelemetryMonitor(handler: TelemetryMonitor | null) {
  monitor = handler;
}

export function getTelemetryFlags() {
  return {
    enabled: TELEMETRY_ENABLED,
    shadow: TELEMETRY_SHADOW,
  } as const;
}

export function isTelemetryActive() {
  return TELEMETRY_ENABLED || TELEMETRY_SHADOW;
}

export function isTelemetryShadowMode() {
  return TELEMETRY_SHADOW && !TELEMETRY_ENABLED;
}

export async function recordTelemetryEvent(
  client: TelemetryClient,
  event: TelemetryEvent
): Promise<TelemetryResult> {
  if (!isTelemetryActive()) {
    const result: TelemetryResult = { recorded: false, event, reason: 'disabled' };
    emit(result);
    return result;
  }

  const payload = {
    ...event.payload,
    context: event.context,
    namespace: TELEMETRY_NAMESPACE,
    shadow: isTelemetryShadowMode(),
    timestamp: new Date().toISOString(),
  } satisfies Record<string, unknown>;

  try {
    await client.from('events').insert([
      {
        user_id: event.userId,
        type: event.name,
        payload_data: payload,
      },
    ]);

    const result: TelemetryResult = { recorded: true, event };
    emit(result);
    return result;
  } catch (error) {
    log.warn('[telemetry] failed to record event', {
      event: event.name,
      userId: event.userId,
      error: error instanceof Error ? error.message : error,
    });

    const result: TelemetryResult = {
      recorded: false,
      event,
      reason: 'error',
      error,
    };
    emit(result);
    return result;
  }
}
