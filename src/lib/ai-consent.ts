export const AI_CONSENT_VERSIONS = ['ai_data_consent_v1'] as const;
export type AIConsentVersion = (typeof AI_CONSENT_VERSIONS)[number];
export type AIConsentAction = 'grant' | 'withdraw';

export function parseAIConsentBody(body: unknown): {
  version: AIConsentVersion;
  action: AIConsentAction;
  clientRecordedAt: string | null;
} | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  const version = record.version;
  const action = record.action;
  if (typeof version !== 'string' || !AI_CONSENT_VERSIONS.includes(version as AIConsentVersion)) return null;
  if (action !== 'grant' && action !== 'withdraw') return null;
  return {
    version,
    action,
    clientRecordedAt: parseClientRecordedAt(record.clientRecordedAt),
  };
}

/** The phone's clock is evidence, not the legal timestamp. Drop anything unusable. */
function parseClientRecordedAt(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const skewMs = parsed.getTime() - Date.now();
  if (skewMs > 24 * 60 * 60 * 1000) return null;
  return parsed.toISOString();
}
