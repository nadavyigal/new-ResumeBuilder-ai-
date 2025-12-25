export function getClientIP(request: Request): string {
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;

  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp;

  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  return 'unknown';
}
