import { isIP } from 'node:net';

function findValidIp(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return isIP(trimmed) ? trimmed : null;
}

function parseForwardedFor(headerValue?: string | null): string | null {
  if (!headerValue) return null;
  const forwardedIps = headerValue
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => isIP(entry));

  if (forwardedIps.length === 0) {
    return null;
  }

  // Use the last hop to avoid trusting spoofed client-provided values.
  return forwardedIps[forwardedIps.length - 1];
}

export function getClientIP(request: Request): string {
  const candidates = [
    request.headers.get('x-vercel-ip'),
    request.headers.get('cf-connecting-ip'),
    request.headers.get('x-real-ip'),
  ];

  for (const candidate of candidates) {
    const ip = findValidIp(candidate);
    if (ip) return ip;
  }

  const forwarded = parseForwardedFor(request.headers.get('x-forwarded-for'));
  if (forwarded) return forwarded;

  return 'unknown';
}
